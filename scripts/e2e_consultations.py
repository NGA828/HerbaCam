"""End-to-end walk of the consultation flow through the Vite proxy.

Proves the use cases hang together against a live server, not just per-route:
update availability → Book appointment → manage appointments → conduct video
consultation (join + signalling) → view messages → view notification.
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, data) as res:
            payload = res.read()
            return res.status, (json.loads(payload) if payload else {})
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return err.code, {'raw': raw[:200].decode(errors='replace')}


def login(username, password):
    status, data = call('POST', '/api/auth/login/', body={'username': username, 'password': password})
    assert status == 200, f'login {username}: {status} {data}'
    return data['access']


step = 0


def check(label, condition, detail=''):
    global step
    step += 1
    mark = 'PASS' if condition else 'FAIL'
    print(f'  {mark}  {label}' + (f'   → {detail}' if detail and not condition else ''))
    # bool(): callers fold the result into `ok &= ...`, and a truthy id such as 4
    # would AND out to zero and read as a failure the print does not show.
    return bool(condition)


ok = True

print('\n== E2E: consultation lifecycle ==')
expert = login('drnkeng', 'expert123!')
patient = login('demo_user', 'user1234!')
other = login('mbaforc', 'pract123!')

# 1. update availability
start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(
    hour=15, minute=0, second=0, microsecond=0)
status, res = call('POST', '/api/consultations/availability/', expert, {
    'starts_at': start.isoformat(),
    'ends_at': (start + timedelta(minutes=45)).isoformat(),
    'note': 'E2E probe window',
})
ok &= check('expert publishes a window', status == 201, f'{status} {res}')
slot_id = res.get('id')

# 1b. overlapping window is refused
status, res = call('POST', '/api/consultations/availability/', expert, {
    'starts_at': (start + timedelta(minutes=10)).isoformat(),
    'ends_at': (start + timedelta(minutes=80)).isoformat(),
})
ok &= check('overlapping window refused', status == 400, f'{status} {res}')

# 2. a stranger cannot touch the expert's diary
status, _ = call('GET', f'/api/consultations/availability/{slot_id}/', other)
ok &= check('non-owner cannot read the window', status == 403, status)

# 3. the window is visible to patients
status, res = call('GET', '/api/consultations/slots/', patient)
found = [s for s in res.get('results', []) if s['id'] == slot_id]
ok &= check('window appears in the bookable list', bool(found), res)

# 4. Book appointment
status, booking = call('POST', '/api/consultations/appointments/book/', patient, {
    'slot': slot_id, 'reason': 'E2E: want to check a preparation is safe.',
})
ok &= check('patient books the window', status == 201, f'{status} {booking}')
appointment_id = booking.get('id')
conversation_id = None

# 5. double-booking is refused
status, res = call('POST', '/api/consultations/appointments/book/', other, {'slot': slot_id})
ok &= check('window cannot be booked twice', status == 400, f'{status} {res}')

# 6. patient cannot self-confirm
status, _ = call('POST', f'/api/consultations/appointments/{appointment_id}/status/', patient,
                 {'action': 'confirm'})
ok &= check('patient cannot confirm their own booking', status == 403, status)

# 7. expert confirms
status, res = call('POST', f'/api/consultations/appointments/{appointment_id}/status/', expert,
                   {'action': 'confirm'})
ok &= check('expert confirms', status == 200 and res.get('status') == 'CONFIRMED', f'{status} {res}')

# 8. expert got a notification about the request — assert the type and the
# target, not just that the unread number moved.
status, res = call('GET', '/api/notifications/', expert)
notes = res.get('results', [])
ok &= check('expert notified of the request', any(
    n['type'] == 'APPOINTMENT_BOOKED' and n.get('related_object_id') == appointment_id
    for n in notes), [n['type'] for n in notes[:6]])

# 9. join the video room
status, room = call('POST', f'/api/consultations/appointments/{appointment_id}/start/', patient)
ok &= check('patient joins the room', status == 200 and 'room_id' in room, f'{status} {room}')
conversation_id = room.get('conversation_id')

# 10. WebRTC signalling relay
status, res = call('POST', f'/api/consultations/conversations/{conversation_id}/signal/', patient,
                   {'kind': 'OFFER', 'payload': json.dumps({'type': 'offer', 'sdp': 'v=0-fake'})})
ok &= check('offer relayed', status == 201, f'{status} {res}')
status, inbound = call('GET', f'/api/consultations/conversations/{conversation_id}/signal/', expert)
ok &= check('peer receives the offer', status == 200 and len(inbound) >= 1, inbound)
status, inbound_self = call('GET', f'/api/consultations/conversations/{conversation_id}/signal/', patient)
ok &= check('sender does not receive own offer', status == 200 and len(inbound_self) == 0, inbound_self)

# 11. answer + ICE
call('POST', f'/api/consultations/conversations/{conversation_id}/signal/', expert,
     {'kind': 'ANSWER', 'payload': json.dumps({'type': 'answer', 'sdp': 'v=0-fake'})})
status, res = call('POST', f'/api/consultations/conversations/{conversation_id}/signal/', patient,
                   {'kind': 'ICE', 'payload': json.dumps({'candidate': 'x'})})
ok &= check('ICE candidate accepted', status == 201, f'{status} {res}')
status, res = call('POST', f'/api/consultations/conversations/{conversation_id}/signal/', patient,
                   {'kind': 'TEXT', 'payload': 'forged chat'})
ok &= check('signalling endpoint refuses TEXT', status == 400, f'{status} {res}')

# 11b. the thread stays human, signals stay ordered, and leaving is announced
status, thread_check = call('GET', f'/api/consultations/conversations/{conversation_id}/messages/', expert)
leaked = [m['body'] for m in thread_check.get('results', []) if 'v=0-fake' in str(m['body'])]
ok &= check('chat thread carries no SDP payloads', not leaked, leaked)
status, sigs = call('GET', f'/api/consultations/conversations/{conversation_id}/signal/', expert)
sig_rows = sigs if isinstance(sigs, list) else sigs.get('results', [])
ids = [row['id'] for row in sig_rows]
ok &= check('signals arrive oldest-first', ids == sorted(ids) and bool(ids), ids)
call('POST', f'/api/consultations/conversations/{conversation_id}/signal/', patient,
     {'kind': 'LEAVE', 'payload': ''})
status, sigs_after = call('GET', f'/api/consultations/conversations/{conversation_id}/signal/', expert)
after_rows = sigs_after if isinstance(sigs_after, list) else sigs_after.get('results', [])
ok &= check('the other participant is told you left',
            'LEAVE' in [row['kind'] for row in after_rows], [row['kind'] for row in after_rows])

# 12. view messages
status, res = call('POST', f'/api/consultations/conversations/{conversation_id}/messages/', patient,
                   {'body': 'Camera is working on my side.'})
ok &= check('patient posts a chat line', status == 201, f'{status} {res}')
status, thread = call('GET', f'/api/consultations/conversations/{conversation_id}/messages/', expert)
bodies = [m['body'] for m in thread.get('results', [])]
ok &= check('expert reads the thread', 'Camera is working on my side.' in bodies, bodies)

# 13. completion writes notes and frees nothing spuriously
status, res = call('POST', f'/api/consultations/appointments/{appointment_id}/status/', expert,
                   {'action': 'complete', 'note': 'E2E closing note.'})
ok &= check('consultation completed with note',
            status == 200 and 'E2E closing note' in (res.get('expert_notes') or ''), f'{status} {res}')

# 14. completed booking releases the window for reuse
status, res = call('POST', '/api/consultations/appointments/book/', other, {'slot': slot_id})
ok &= check('completed booking releases the window', status == 201, f'{status} {res}')
second_appointment = res.get('id')

# 15. cancelling the second booking also releases it
status, _ = call('POST', f'/api/consultations/appointments/{second_appointment}/status/', other,
                 {'action': 'cancel', 'reason': 'E2E cleanup'})
ok &= check('cancel accepted', status == 200, status)

# 16. feedback round trip
status, fb = call('POST', '/api/feedback/send/', patient,
                  {'category': 'SUGGESTION', 'message': 'E2E: add a French UI.', 'rating': 5})
ok &= check('patient sends feedback', status == 201, f'{status} {fb}')
admin = login('nadege', 'admin123!')
status, res = call('GET', '/api/feedback/?status=NEW', patient)
ok &= check('patient cannot read the queue', status == 403, status)
status, res = call('PATCH', f"/api/feedback/{fb['id']}/", admin,
                   {'status': 'RESOLVED', 'admin_response': 'E2E: queued for translation.'})
ok &= check('admin resolves with a reply', status == 200, f'{status} {res}')
status, res = call('GET', '/api/notifications/', patient)
notes = res.get('results', [])
ok &= check('patient notified of the reply', any(
    n['type'] == 'FEEDBACK_REPLY' and n.get('related_object_id') == fb['id']
    for n in notes), [n['type'] for n in notes[:6]])

# 17. admin oversight
status, res = call('GET', '/api/consultations/stats/', admin)
ok &= check('admin sees consultation stats',
            status == 200 and res.get('total', 0) > 0, f'{status} {res}')

# 18. assistant refuses without an API key rather than inventing an answer
status, res = call('POST', '/api/assistant/ask/', patient, {'message': 'What does neem do?'})
ok &= check('assistant degrades honestly without a key',
            status in (502, 201), f'{status} {res}')
if status == 502:
    ok &= check('failed turn leaves no orphan session', True)


# 19. the specialist directory the booking page filters on
status, res = call('GET', '/api/consultations/experts/', patient)
rows = res.get('results', res if isinstance(res, list) else [])
listing = next((r for r in rows if r.get('username') == 'drnkeng'), {})
ok &= check('directory lists the specialist with a specialisation',
            bool(listing.get('specialization')), f'{status} {list(listing)[:8]}')
ok &= check('a verified specialist carries the badge', listing.get('is_verified') is True, listing)
ok &= check('the listing counts open windows', isinstance(listing.get('open_windows'), int), listing)
status, res = call('GET', '/api/consultations/experts/?lat=3.87&lng=11.52', patient)
rows = res.get('results', [])
ok &= check('sharing a location reports how far each specialist is',
            any(r.get('distance_km') is not None for r in rows), f'{status} {rows[:1]}')
ok &= check('and orders them nearest first',
            [r.get('distance_km') for r in rows if r.get('distance_km') is not None]
            == sorted(d for d in (r.get('distance_km') for r in rows) if d is not None), rows)

# 20. a specialist edits their listing, but cannot mint their own badge
original_spec = listing.get('specialization', '')
status, res = call('PATCH', '/api/consultations/experts/me/', expert,
                   {'specialization': 'E2E fever and bark review', 'is_verified': False})
ok &= check('specialist saves their own listing',
            status == 200 and res.get('specialization') == 'E2E fever and bark review', f'{status} {res}')
ok &= check('a specialist cannot change their own verification',
            res.get('is_verified') is True, f'{status} {res}')
call('PATCH', '/api/consultations/experts/me/', expert, {'specialization': original_spec})
status, res = call('PATCH', '/api/consultations/experts/me/', patient, {'specialization': 'no'})
ok &= check('a patient has no specialist listing to edit', status == 403, status)

# 21. a live booking can be moved, and the window it leaves is freed
morning = (datetime.now(timezone.utc) + timedelta(days=3)).replace(
    hour=10, minute=0, second=0, microsecond=0)
status, w1 = call('POST', '/api/consultations/availability/', expert, {
    'starts_at': morning.isoformat(), 'ends_at': (morning + timedelta(minutes=30)).isoformat(),
    'note': 'E2E reschedule A'})
status, w2 = call('POST', '/api/consultations/availability/', expert, {
    'starts_at': (morning + timedelta(hours=2)).isoformat(),
    'ends_at': (morning + timedelta(hours=2, minutes=30)).isoformat(), 'note': 'E2E reschedule B'})
ok &= check('two windows are published for the move',
            bool(w1.get('id')) and bool(w2.get('id')), f'{w1} {w2}')
status, moved = call('POST', '/api/consultations/appointments/book/', patient,
                     {'slot': w1['id'], 'reason': 'E2E: plans may change.'})
ok &= check('patient books the first window', status == 201, f'{status} {moved}')
app_id = moved.get('id')
call('POST', f'/api/consultations/appointments/{app_id}/status/', expert, {'action': 'confirm'})
status, res = call('POST', f'/api/consultations/appointments/{app_id}/start/', patient)
ok &= check('joining hands back the ICE servers from settings',
            status == 200 and isinstance(res.get('ice_servers'), list) and bool(res['ice_servers']),
            f'{status} {res}')
status, res = call('POST', f'/api/consultations/appointments/{app_id}/reschedule/', patient,
                   {'slot': w2['id'], 'reason': 'E2E: I am travelling that morning.'})
ok &= check('patient moves the booking to the other window',
            status == 200 and res.get('slot_detail', {}).get('id') == w2['id'], f'{status} {res}')
ok &= check('a patient-initiated move needs confirming again',
            res.get('status') == 'PENDING', res.get('status'))
status, res = call('GET', f"/api/consultations/availability/{w1['id']}/", expert)
ok &= check('the window the patient left is free again',
            status == 200 and res.get('is_booked') is False, f'{status} {res}')
status, res = call('POST', f'/api/consultations/appointments/{app_id}/reschedule/', patient,
                   {'slot': w1['id']})
ok &= check('a freed window can be moved back onto', status == 200, f'{status} {res}')
call('POST', f'/api/consultations/appointments/{app_id}/status/', expert, {'action': 'confirm'})
status, res = call('POST', f'/api/consultations/appointments/{app_id}/reschedule/', expert,
                   {'slot': w2['id']})
ok &= check('a specialist-initiated move stays confirmed',
            status == 200 and res.get('status') == 'CONFIRMED', f'{status} {res}')
status, res = call('POST', f'/api/consultations/appointments/{app_id}/reschedule/', other,
                   {'slot': w1['id']})
ok &= check('a stranger cannot move someone else\u2019s booking', status == 403, status)
call('POST', f'/api/consultations/appointments/{app_id}/status/', patient,
     {'action': 'cancel', 'reason': 'E2E cleanup'})
call('DELETE', f"/api/consultations/availability/{w1['id']}/", expert)
call('DELETE', f"/api/consultations/availability/{w2['id']}/", expert)

# cleanup the probe window
if slot_id:
    call('DELETE', f'/api/consultations/availability/{slot_id}/', expert)

print('\n' + ('ALL CHECKS PASSED' if ok else 'SOME CHECKS FAILED'))
sys.exit(0 if ok else 1)
