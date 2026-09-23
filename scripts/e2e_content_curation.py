"""End-to-end check of who may curate content, through the Vite proxy.

The ANCESTOR use-case diagram hands `manage plant information` and `manage
articles` to the specialized expert, so this proves the grant is real against a
live server — and that the boundaries next to it did not move: readers still
cannot see drafts, patients and practitioners still cannot write, and the shared
symptom vocabulary stays with the administrator.

Everything it creates is deleted again, so it is safe to run against the demo
database at any time.

    python scripts/e2e_content_curation.py [BASE_URL]
"""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'

ACCOUNTS = {
    'EXPERT': ('drnkeng', 'expert123!'),
    'ADMIN': ('nadege', 'admin123!'),
    'PRACTITIONER': ('mbaforc', 'pract123!'),
    'USER': ('demo_user', 'user1234!'),
}

failures = []


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
            return err.code, {'detail': raw[:120].decode(errors='replace')}


def check(label, got, want):
    ok = got == want or (isinstance(want, tuple) and got in want)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {got}")
    if not ok:
        failures.append(f'{label}: got {got}, want {want}')


def login(role):
    username, password = ACCOUNTS[role]
    status, payload = call('POST', '/api/auth/login/', body={'username': username, 'password': password})
    if status != 200:
        failures.append(f'could not log in as {role} (HTTP {status})')
        return None
    return payload.get('access')


def plant_payload(name):
    return {'scientific_name': name, 'common_name': 'Curation probe',
            'family': 'Testaceae', 'is_published': False}


print('specialized expert curates the plant library:')
expert = login('EXPERT')
admin = login('ADMIN')
patient = login('USER')
practitioner = login('PRACTITIONER')

status, plant = call('POST', '/api/plants/admin/', expert, plant_payload('Curation probe species'))
check('create a plant', status, 201)
plant_id = plant.get('id')
search = '/api/plants/?search=Curation%20probe%20species'
check('an unpublished species stays out of the public catalogue',
      [row['scientific_name'] for row in call('GET', search)[1].get('results', [])].count('Curation probe species'), 0)
check('edit a plant', call('PATCH', f'/api/plants/admin/{plant_id}/', expert,
                           {'description': 'Added by the expert curation check.'})[0], 200)
check('publish a plant', call('PATCH', f'/api/plants/admin/{plant_id}/', expert, {'is_published': True})[0], 200)
check('the published plant is now readable by everyone',
      'Curation probe species' in [row['scientific_name'] for row in call('GET', search)[1].get('results', [])], True)
check('withdraw a plant', call('DELETE', f'/api/plants/admin/{plant_id}/', expert)[0], 204)

print('specialized expert curates articles:')
slug = 'curation-probe-article'
status, article = call('POST', '/api/articles/admin/', expert,
                       {'title': 'Curation probe article', 'slug': slug,
                        'content': 'Written by the automated curation check.', 'is_published': False})
check('create an article', status, 201)
article_id = article.get('id')
check('the expert is recorded as the author', bool(article.get('author_name')), True)
check('publish it', call('PATCH', f'/api/articles/admin/{article_id}/', expert, {'is_published': True})[0], 200)
check('the published article is readable', call('GET', f'/api/articles/{slug}/')[0], 200)
check('withdraw it', call('DELETE', f'/api/articles/admin/{article_id}/', expert)[0], 204)

print('boundaries that deliberately did not move:')
check('expert cannot rename the shared symptom vocabulary',
      call('POST', '/api/symptoms/admin/', expert, {'name': 'Curation probe symptom'})[0], 403)
check('practitioner cannot write plants',
      call('POST', '/api/plants/admin/', practitioner, plant_payload('Nope species'))[0], 403)
check('patient cannot write plants',
      call('POST', '/api/plants/admin/', patient, plant_payload('Nope species'))[0], 403)
check('patient cannot read the plant management list (drafts live there)',
      call('GET', '/api/plants/admin/', patient)[0], 403)
check('anonymous cannot read the plant management list', call('GET', '/api/plants/admin/')[0], (401, 403))
status, by_admin = call('POST', '/api/plants/admin/', admin, plant_payload('Curation probe admin species'))
check('administrator rights are unchanged', status, 201)
check('administrator can still delete',
      call('DELETE', f"/api/plants/admin/{by_admin.get('id')}/", admin)[0], 204)

leftovers = [row['scientific_name'] for row in
             call('GET', '/api/plants/admin/?page_size=200', admin)[1].get('results', [])
             if 'curation probe' in row['scientific_name'].lower()]
check('the check leaves no rows behind', leftovers, [])

print()
if failures:
    print(f'{len(failures)} FAILURE(S):')
    for line in failures:
        print(f'  - {line}')
    raise SystemExit(1)
print('ALL CHECKS PASSED')
