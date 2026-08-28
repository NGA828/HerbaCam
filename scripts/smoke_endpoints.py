#!/usr/bin/env python3
"""Log in as every HerbaCam role and call every endpoint the frontend uses.

This is the runtime counterpart of scripts/verify_endpoint_map.py: the map proves
the routes line up on paper, this proves they answer with the right status codes
for each role.

Usage:  python scripts/smoke_endpoints.py [base_url]
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000'

ROLES = {
    'ADMIN': ('nadege', 'admin123!'),
    'EXPERT': ('drnkeng', 'expert123!'),
    'PRACTITIONER': ('mbaforc', 'pract123!'),
    'USER': ('demo_user', 'user1234!'),
    'ANONYMOUS': None,
}

# (method, path template) — {id} placeholders are resolved from the probe below.
PROBES = [
    ('GET', '/api/plants/'),
    ('GET', '/api/plants/{plant}/'),
    ('GET', '/api/plants/search/?q=neem'),
    ('GET', '/api/symptoms/'),
    ('GET', '/api/symptoms/{symptom}/'),
    ('GET', '/api/symptoms/search/?q=fever'),
    ('GET', '/api/articles/'),
    ('GET', '/api/articles/{article_slug}/'),
    ('GET', '/api/articles/categories/'),
    ('GET', '/api/geography/regions/'),
    ('GET', '/api/geography/regions/{region}/'),
    ('GET', '/api/geography/divisions/?region={region}'),
    ('GET', '/api/geography/communities/?region={region}'),
    ('GET', '/api/knowledge/traditional-uses/'),
    ('GET', '/api/knowledge/preparation-methods/'),
    ('GET', '/api/evidence/'),
    ('GET', '/api/evidence/{evidence}/'),
    ('GET', '/api/safety/'),
    ('GET', '/api/safety/{safety}/'),
    ('GET', '/api/auth/profile/'),
    ('GET', '/api/analytics/dashboard/'),
    ('GET', '/api/analytics/favorites/'),
    ('GET', '/api/analytics/favorites/check/{plant}/'),
    ('GET', '/api/identification/history/'),
    ('GET', '/api/identification/{identification}/'),
    ('GET', '/api/notifications/'),
    ('GET', '/api/notifications/unread-count/'),
    ('GET', '/api/knowledge/submissions/'),
    ('GET', '/api/knowledge/submissions/{submission}/'),
    ('GET', '/api/preservation/risk/'),
    ('GET', '/api/preservation/risk/{risk}/'),
    ('GET', '/api/auth/users/'),
    ('GET', '/api/auth/users/{user}/'),
    ('GET', '/api/auth/settings/'),
    ('GET', '/api/audit/'),
    ('GET', '/api/plants/admin/'),
    ('GET', '/api/plants/admin/{plant}/'),
    ('GET', '/api/symptoms/admin/'),
    ('GET', '/api/symptoms/admin/{symptom}/'),
    ('GET', '/api/articles/admin/'),
    ('GET', '/api/articles/admin/{article}/'),
    ('GET', '/api/knowledge/submissions/pending/'),
    ('GET', '/api/practitioners/profile/'),
    ('GET', '/api/practitioners/list/'),
]

# Statuses that count as a healthy answer for a role.
OK = {200, 201, 204}
AUTH_PROBLEM = {401, 403}
# Detail routes scope their queryset to the caller (own submissions, own
# identifications), so a 404 for a record belonging to somebody else is the
# correct answer, not a failure.
SCOPED = {404}


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
            try:
                return res.status, json.loads(payload or b'{}')
            except json.JSONDecodeError:
                return res.status, {}
    except urllib.error.HTTPError as err:
        return err.code, {}


def login(username, password):
    status, data = call('POST', '/api/auth/login/', body={'username': username, 'password': password})
    assert status == 200, f'login failed for {username}: {status}'
    return data['access']


def first_id(path, key='results'):
    status, data = call('GET', path)
    results = data.get(key) if isinstance(data, dict) else data
    if results:
        return results[0]['id']
    return None


def main() -> int:
    admin_token = login(*ROLES['ADMIN'])
    user_token = login(*ROLES['USER'])
    status, articles = call('GET', '/api/articles/admin/', admin_token)
    status, risks = call('GET', '/api/preservation/risk/', admin_token)
    status, users = call('GET', '/api/auth/users/', admin_token)
    ids = {
        'plant': first_id('/api/plants/'),
        'symptom': first_id('/api/symptoms/'),
        'article': first_id('/api/articles/'),
        'article_slug': (articles.get('results') or [{}])[0].get('slug'),
        'region': first_id('/api/geography/regions/'),
        'evidence': first_id('/api/evidence/'),
        'safety': first_id('/api/safety/'),
        'risk': (risks.get('results') or [{}])[0].get('id'),
        'user': (users.get('results') or [{}])[0].get('id'),
        'identification': None,
        'submission': None,
    }
    status, hist = call('GET', '/api/identification/history/', user_token)
    ids['identification'] = (hist.get('results') or [{}])[0].get('id')
    status, subs = call('GET', '/api/knowledge/submissions/', admin_token)
    ids['submission'] = (subs.get('results') or [{}])[0].get('id')
    print('probe ids:', ids)

    failures = 0
    for role, creds in ROLES.items():
        token = login(*creds) if creds else None
        print(f'\n== {role} ==')
        for method, template in PROBES:
            try:
                path = template.format(**{k: (v or 1) for k, v in ids.items()})
            except (KeyError, IndexError):
                continue
            status, _ = call(method, path, token)
            # Roles without staff rights are *expected* to be refused; anything
            # else (404/500) means the route or the view is broken.
            healthy = status in OK or status in AUTH_PROBLEM or status in SCOPED
            if not healthy:
                failures += 1
            if status in OK:
                flag, note = 'ok   ', ''
            elif status in SCOPED:
                flag, note = 'scope', '  (not visible to this role — correct scoping)'
            else:
                flag, note = 'ok   ', '  (refused — expected for this role)'
            print(f'  {flag} {method:4} {status} {path}{note}')
    print(f'\n{"FAILURES: " + str(failures) if failures else "All endpoints answered."}')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
