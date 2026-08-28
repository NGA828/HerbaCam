#!/usr/bin/env python3
"""Verify the 1:1 mapping between HerbaCam's REST endpoints and the React client.

Two checks, because a mismatch can happen in either direction:

  1. ORPHAN ENDPOINTS  – a backend route that no frontend code ever calls.
  2. MISSING ENDPOINTS – a frontend call that has no matching backend route.

Usage:  python scripts/verify_endpoint_map.py [--markdown docs/API_ENDPOINT_MAP.md]

The script only needs the standard library; it parses the Django URL configs and
the axios calls statically instead of importing anything.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
FRONTEND_SRC = ROOT / 'frontend' / 'src'

# Django generic views -> HTTP methods they answer.
GENERIC_METHODS = {
    'ListAPIView': ['GET'],
    'ListCreateAPIView': ['GET', 'POST'],
    'RetrieveAPIView': ['GET'],
    'RetrieveUpdateAPIView': ['GET', 'PUT', 'PATCH'],
    'RetrieveUpdateDestroyAPIView': ['GET', 'PUT', 'PATCH', 'DELETE'],
    'CreateAPIView': ['POST'],
    'UpdateAPIView': ['PUT', 'PATCH'],
    'DestroyAPIView': ['DELETE'],
    'TokenObtainPairView': ['POST'],
    'TokenRefreshView': ['POST'],
}

# Views imported from third-party packages (simplejwt) are not defined in the
# app's views.py, so their verbs are declared here.
IMPORTED_METHODS = {
    'TokenObtainPairView': ['POST'],
    'TokenRefreshView': ['POST'],
    'TokenVerifyView': ['POST'],
    'TokenBlacklistView': ['POST'],
}

PATH_ARG = re.compile(r'<[^>]+>')
TEMPLATE = re.compile(r'\$\{[^}]+\}')


def normalise(path: str) -> str:
    """Turn a Django/axios path into a comparable '/a/{p}/' skeleton."""
    path = TEMPLATE.sub('{p}', path)
    path = PATH_ARG.sub('{p}', path)
    if not path.startswith('/'):
        path = '/' + path
    if not path.endswith('/'):
        path += '/'
    return re.sub(r'/+', '/', path)


def parse_backend():
    """Return [(method, path, view)] for every route in config/urls.py."""
    config = (BACKEND / 'config' / 'urls.py').read_text()
    mounts = re.findall(r"path\('([\w/]*)', include\('(\w+)\.urls'\)\)", config)

    endpoints = []
    for prefix, app in mounts:
        urls_file = BACKEND / app / 'urls.py'
        if not urls_file.exists():
            continue
        views_file = BACKEND / app / 'views.py'
        views_src = views_file.read_text() if views_file.exists() else ''
        for route, view in re.findall(r"path\(\s*'([^']*)',\s*([\w.]+(?:\([^)]*\))?)\.as_view\(\)", urls_file.read_text()):
            methods = view_methods(view.split('.')[0], views_src)
            for method in methods:
                endpoints.append((method, normalise(f'/{prefix}{route}'), view))
    endpoints.sort(key=lambda e: (e[1], e[0]))
    return endpoints


def view_methods(view: str, views_src: str) -> list[str]:
    """Work out which HTTP verbs a view class answers."""
    if view in IMPORTED_METHODS:
        return IMPORTED_METHODS[view]
    match = re.search(rf'class {view}\(([^)]+)\):', views_src)
    if not match:
        return ['GET']
    bases = [b.strip().split('.')[-1] for b in match.group(1).split(',')]

    # Explicit handlers on APIView subclasses add verbs.
    body = views_src[match.end():]
    nxt = re.search(r'\nclass ', body)
    if nxt:
        body = body[:nxt.start()]

    methods: set[str] = set()
    for base in bases:
        if base in GENERIC_METHODS:
            methods.update(GENERIC_METHODS[base])
    for handler in re.findall(r'\n    def (get|post|put|patch|delete)\(', body):
        methods.add(handler.upper())
    if 'APIView' in bases and not methods:
        methods.add('GET')

    # A view can narrow its verbs with http_method_names.
    declared = re.search(r'http_method_names = \[(.*?)\]', body)
    if declared:
        allowed = {m.strip().strip("'\"").upper() for m in declared.group(1).split(',')}
        methods &= allowed

    return sorted(methods) or ['GET']


def parse_frontend():
    """Return {path_key: {'bindings': [...], 'files': [...]}} for every axios call."""
    calls: dict[tuple[str, str], dict] = {}

    def record(verb, raw, binding, filepath=None):
        key = (verb.upper(), normalise('/api' + raw.split('?')[0]))
        entry = calls.setdefault(key, {'bindings': [], 'files': []})
        if binding and binding not in entry['bindings']:
            entry['bindings'].append(binding)
        if filepath and filepath not in entry['files']:
            entry['files'].append(filepath)

    client = FRONTEND_SRC / 'api' / 'client.js'
    src = client.read_text()
    for group, body in re.findall(r"export const (\w+API) = \{(.*?)\n\};", src, re.S):
        for method, verb, raw in re.findall(r"(\w+): \(.*?\) => api\.(get|post|patch|put|delete)\(\s*[`']([^`']+?)[`'?]", body, re.S):
            record(verb, raw, f'{group}.{method}')

    # Managers often alias the API group (const api = kind === 'evidence' ? evidenceAPI : safetyAPI)
    alias_map: dict[str, list[str]] = {}
    for file in FRONTEND_SRC.rglob('*.js*'):
        for alias, a, b in re.findall(r"const (\w+) = [^;]*?(\w+API)\s*:\s*(\w+API)", file.read_text()):
            alias_map.setdefault(alias, [a, b])

    for file in sorted(FRONTEND_SRC.rglob('*.js*')):
        rel = file.relative_to(ROOT).as_posix()
        # client.js only *declares* the bindings (parsed above) and hosts the 401
        # refresh interceptor; the interesting part is which pages use them.
        if rel.endswith('api/client.js'):
            continue
        text = file.read_text()
        for verb, raw in re.findall(r"api\.(get|post|patch|put|delete)\(\s*[`']([^`']+?)[`'?]", text):
            record(verb, raw, None, rel)
        # Attribute-style usage: plantsAPI.list(...) or an alias such as managerApi.detail(...)
        for group, method in re.findall(r"\b(\w+)\.(\w+)\b", text):
            targets = [group] if group.endswith('API') else alias_map.get(group, [])
            for target in targets:
                for entry in calls.values():
                    if f'{target}.{method}' in entry['bindings'] and rel not in entry['files']:
                        entry['files'].append(rel)
    return calls


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--markdown', help='write the map as a markdown table')
    args = parser.parse_args()

    backend = parse_backend()
    frontend = parse_frontend()

    backend_keys = {(m, p) for m, p, _ in backend}
    frontend_keys = set(frontend)

    orphans = sorted((m, p) for (m, p) in backend_keys if (m, p) not in frontend_keys)
    missing = sorted((m, p) for (m, p) in frontend_keys if (m, p) not in backend_keys)

    matched = sorted(backend_keys & frontend_keys)

    print(f'backend endpoints : {len(backend)}')
    print(f'frontend calls    : {len(frontend_keys)}')
    print(f'matched 1:1       : {len(matched)}')
    print(f'orphan endpoints  : {len(orphans)}')
    print(f'unmatched calls   : {len(missing)}')

    if orphans:
        print('\nBackend endpoints with no frontend caller:')
        for m, p in orphans:
            print(f'  {m:6} {p}')
    if missing:
        print('\nFrontend calls with no backend endpoint:')
        for m, p in missing:
            print(f'  {m:6} {p}   <- {", ".join(sorted(set(frontend[(m, p)])))}')

    if args.markdown:
        lines = [
            '# API ↔ frontend endpoint map',
            '',
            'Generated by `scripts/verify_endpoint_map.py` — the single source of truth for the',
            'bidirectional check between `backend/*/urls.py` and the axios calls in `frontend/src`',
            '(mostly `frontend/src/api/client.js`).',
            '',
            f'- Backend endpoints: **{len(backend)}**',
            f'- Frontend call sites: **{len(frontend_keys)}**',
            f'- Matched 1:1: **{len(matched)}**',
            f'- Orphan endpoints (backend only): **{len(orphans)}**',
            f'- Unmatched calls (frontend only): **{len(missing)}**',
            '',
            '| Method | Endpoint | Client binding | Used by |',
            '| --- | --- | --- | --- |',
        ]
        for m, p in sorted(backend_keys):
            entry = frontend.get((m, p), {})
            binding = ', '.join(entry.get('bindings') or []) or '—'
            files = [f.replace('frontend/src/', '') for f in sorted(entry.get('files') or [])]
            if not files and 'authAPI.refreshToken' in (entry.get('bindings') or []):
                files = ['api/client.js (401 refresh interceptor)']
            used_by = ', '.join(files) if files else '—'
            lines.append(f'| {m} | `{p}` | `{binding}` | {used_by} |')
        if orphans:
            lines += ['', '## Orphans', '']
            lines += [f'- `{m} {p}`' for m, p in orphans]
        if missing:
            lines += ['', '## Calls without a backend route', '']
            lines += [f'- `{m} {p}`' for m, p in missing]
        Path(args.markdown).write_text('\n'.join(lines) + '\n')
        print(f'\nwrote {args.markdown}')

    return 1 if (orphans or missing) else 0


if __name__ == '__main__':
    sys.exit(main())
