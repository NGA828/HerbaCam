#!/usr/bin/env python3
"""Generate the HerbaCam Postman API test collection.

Maps every endpoint in backend/*/urls.py (see docs/API_ENDPOINT_MAP.md) to a
request with authentication, sample payloads and assertions. Run:

    python3 postman/generate_collection.py

Outputs (written next to this file):
    HerbaCam.postman_collection.json
    HerbaCam.postman_environment.json

The collection is self-contained: the "0. Auth & Users" folder logs in as the
four demo roles (credentials are collection variables you can override) and
stores the JWTs in collection variables that every later request uses.
Dynamic ids (plants, slots, appointments, ...) are captured by test scripts
as the suite progresses, so folders must be run in their listed order.
"""
import json
import os
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))


def uid():
    return uuid.uuid4().hex[:24]


def bearer(var):
    return {
        "type": "bearer",
        "bearer": [{"key": "token", "value": "{{%s}}" % var, "type": "string"}],
    }


def json_body(obj):
    return {
        "mode": "raw",
        "raw": json.dumps(obj, indent=2),
        "options": {"raw": {"language": "json"}},
    }


def raw_body(text):
    return {"mode": "raw", "raw": text, "options": {"raw": {"language": "json"}}}


def form_body(fields):
    return {"mode": "formdata", "formdata": fields}


def build_url(path, query):
    """Structured URL object — parsed the same way by the Postman app and newman.

    Django routes all API paths with a trailing slash (APPEND_SLASH redirects
    cost a 301/500), so the slash is kept as a trailing empty path segment —
    exactly how Postman itself serialises such URLs.
    """
    from urllib.parse import parse_qsl
    parts = [p for p in path.split("/")[1:] if p != ""]
    if path.endswith("/") and len(path) > 1:
        parts.append("")
    url = {
        "raw": "{{baseUrl}}%s%s" % (path, ("?%s" % query) if query else ""),
        "host": ["{{baseUrl}}"],
        "path": parts,
    }
    if query:
        url["query"] = [
            {"key": k, "value": v} for k, v in parse_qsl(query, keep_blank_values=True)
        ]
    return url


def req(name, method, path, query="", auth=None, body=None, pre=None, tests=None, desc=""):
    request = {
        "method": method,
        "header": [],
        "url": build_url(path, query),
    }
    if auth:
        request["auth"] = bearer(auth)
    if body is not None:
        request["body"] = body
    item = {
        "id": uid(),
        "name": name,
        "request": request,
    }
    events = []
    if pre:
        events.append({"listen": "prerequest", "script": {"type": "text/javascript", "exec": pre.strip().splitlines()}})
    if tests:
        events.append({"listen": "test", "script": {"type": "text/javascript", "exec": tests.strip().splitlines()}})
    if events:
        item["event"] = events
    if desc:
        item["description"] = desc
    return item


def folder(name, items, desc="", pre=None):
    f = {"id": uid(), "name": name, "item": items}
    if pre:
        f["event"] = [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": pre.strip().splitlines()}}]
    if desc:
        f["description"] = desc
    return f


# Preamble shared by every test script. `list()` normalises paginated
# ({count, results}) and plain-array responses.
HEAD = """const _c = pm.response.code;
const _j = (() => { try { return pm.response.json(); } catch (e) { return null; } })();
const list = (o) => (o && Array.isArray(o.results)) ? o.results : (Array.isArray(o) ? o : []);"""


def T(extra):
    return HEAD + "\n" + extra.strip() + "\n"


# ---------------------------------------------------------------------------
# Folder 0 — Auth & Users
# ---------------------------------------------------------------------------
def folder_auth():
    items = []

    items.append(req(
        "API root (public)", "GET", "/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('exposes the endpoint map', () => {
    pm.expect(_j).to.be.an('object');
    pm.expect(_j).to.have.property('endpoints');
    pm.expect(_j).to.have.property('name');
});
""")))

    items.append(req(
        "Register new user", "POST", "/api/auth/register/",
        pre="""
const u = 'pm_' + Date.now().toString(36);
const p = 'Passw0rd!x' + Math.floor(1000 + Math.random() * 9000);
pm.collectionVariables.set('newuser_username', u);
pm.collectionVariables.set('newuser_password', p);
""",
        body=json_body({
            "username": "{{newuser_username}}",
            "email": "{{newuser_username}}@example.com",
            "first_name": "Postman",
            "last_name": "Tester",
            "password": "{{newuser_password}}",
            "password_confirm": "{{newuser_password}}",
            "role": "USER",
        }),
        desc="Creates a unique throwaway account on every run and stores its JWT. Used by the change-password and admin user-management tests.",
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('returns user and JWT pair', () => {
    pm.expect(_j.user).to.have.property('username');
    pm.expect(_j.tokens).to.have.property('access');
    pm.expect(_j.tokens).to.have.property('refresh');
});
pm.collectionVariables.set('newuser_token', _j.tokens.access);
pm.collectionVariables.set('newuser_id', _j.user.id);
""")))

    items.append(req(
        "Register — password mismatch (expect 400)", "POST", "/api/auth/register/",
        body=json_body({
            "username": "pm_mismatch_1", "email": "mismatch@example.com",
            "password": "Passw0rd!x1", "password_confirm": "Passw0rd!x2",
            "role": "USER",
        }),
        tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")))

    items.append(req(
        "Register — admin role refused (expect 400)", "POST", "/api/auth/register/",
        body=json_body({
            "username": "pm_admin_attempt", "email": "admin_attempt@example.com",
            "password": "Passw0rd!x1", "password_confirm": "Passw0rd!x1",
            "role": "ADMIN",
        }),
        desc="ADMIN can never come from a registration form.",
        tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
pm.test('role error reported', () => pm.expect(_j).to.have.property('role'));
""")))

    def login(name, uname, upass, tvar, extra=""):
        return req(
            name, "POST", "/api/auth/login/",
            body=json_body({"username": "{{%s}}" % uname, "password": "{{%s}}" % upass}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('returns JWT pair', () => {
    pm.expect(_j).to.have.property('access');
    pm.expect(_j).to.have.property('refresh');
});
pm.collectionVariables.set('%s', _j.access);
%s
""" % (tvar, extra.strip())),
        )

    items.append(login("Login as Admin", "admin_username", "admin_password", "admin_token",
                       "pm.collectionVariables.set('admin_refresh', _j.refresh);"))
    items.append(login("Login as Expert", "expert_username", "expert_password", "expert_token"))
    items.append(login("Login as Practitioner", "practitioner_username", "practitioner_password", "practitioner_token"))
    items.append(login("Login as User", "user_username", "user_password", "user_token"))

    items.append(req(
        "Login — wrong password (expect 401)", "POST", "/api/auth/login/",
        body=json_body({"username": "{{user_username}}", "password": "totally-wrong-password"}),
        tests=T("""
pm.test('status 401', () => pm.expect(_c).to.eql(401));
""")))

    items.append(req(
        "Refresh access token", "POST", "/api/auth/token/refresh/",
        body=json_body({"refresh": "{{admin_refresh}}"}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('issues a new access token', () => pm.expect(_j).to.have.property('access'));
""")))

    items.append(req(
        "Get my profile", "GET", "/api/auth/profile/", auth="user_token",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('is the demo user', () => pm.expect(_j.username).to.eql('demo_user'));
pm.collectionVariables.set('user_id', _j.id);
""")))

    items.append(req(
        "Update my profile", "PATCH", "/api/auth/profile/", auth="user_token",
        body=json_body({"bio": "Updated by the Postman API test suite.", "phone": "+237 6 00 00 00 00"}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('bio persisted', () => pm.expect(_j.bio).to.eql('Updated by the Postman API test suite.'));
""")))

    items.append(req(
        "Change password (throwaway user)", "POST", "/api/auth/change-password/", auth="newuser_token",
        body=json_body({"old_password": "{{newuser_password}}", "new_password": "Postman2nd!pass"}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))

    items.append(req(
        "Login with new password", "POST", "/api/auth/login/",
        body=json_body({"username": "{{newuser_username}}", "password": "Postman2nd!pass"}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.collectionVariables.set('newuser_token', _j.access);
""")))

    return folder("0. Auth & Users", items,
                  "Run this folder first: it issues the JWTs stored in collection variables (admin_token, expert_token, practitioner_token, user_token, newuser_token). Demo credentials are collection variables — override them here if your demo accounts differ.")


# ---------------------------------------------------------------------------
# Folder 1 — Geography
# ---------------------------------------------------------------------------
def folder_geography():
    items = []
    items.append(req(
        "List regions (public)", "GET", "/api/geography/regions/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists the ten regions', () => pm.expect(list(_j).length).to.be.gte(10));
pm.collectionVariables.set('region_id', list(_j)[0].id);
""")))
    items.append(req(
        "List regions (detailed)", "GET", "/api/geography/regions/", "detailed=1",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('embeds divisions', () => pm.expect(list(_j)[0].divisions).to.be.an('array'));
""")))
    items.append(req(
        "Region detail", "GET", "/api/geography/regions/{{region_id}}/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has a name', () => pm.expect(_j.name).to.be.a('string').that.is.not.empty);
""")))
    items.append(req(
        "List divisions", "GET", "/api/geography/divisions/", "region={{region_id}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has at least one division', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('division_id', list(_j)[0].id);
""")))
    items.append(req(
        "List communities", "GET", "/api/geography/communities/", "region={{region_id}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has at least one community', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('community_id', list(_j)[0].id);
""")))
    items.append(req(
        "Locate region from coordinates", "GET", "/api/geography/locate/", "lat=3.848&lng=11.502",
        desc="Coordinates of Yaoundé — should resolve to the Centre region.",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('returns nearest region', () => {
    pm.expect(_j.region).to.have.property('name');
    pm.expect(_j).to.have.property('distance_km');
});
""")))
    items.append(req(
        "Locate — invalid coordinates (expect 400)", "GET", "/api/geography/locate/", "lat=abc&lng=11.502",
        tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")))
    items.append(req(
        "Create region (admin)", "POST", "/api/geography/regions/", auth="admin_token",
        body=json_body({"name": "Postman Test Region", "code": "PMT", "description": "Created by the Postman API test suite."}),
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('new_region_id', _j.id);
""")))
    items.append(req(
        "Create division (admin)", "POST", "/api/geography/divisions/", auth="admin_token",
        body=json_body({"name": "Postman Test Division", "region": "{{new_region_id}}", "description": "Created by the Postman API test suite."}),
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('new_division_id', _j.id);
""")))
    items.append(req(
        "Create community (admin)", "POST", "/api/geography/communities/", auth="admin_token",
        body=json_body({"name": "Postman Test Community", "region": "{{new_region_id}}"}),
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('new_community_id', _j.id);
""")))
    items.append(req(
        "Update region (admin)", "PATCH", "/api/geography/regions/{{new_region_id}}/", auth="admin_token",
        body=json_body({"description": "Updated by the Postman API test suite."}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    # NOTE: the API only exposes DELETE for regions; divisions and communities
    # are created via the list endpoints and cleaned up by the region cascade.
    items.append(req(
        "Delete region (cascades to divisions/communities, admin)",
        "DELETE", "/api/geography/regions/{{new_region_id}}/", auth="admin_token",
        tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")))
    items.append(req(
        "Create region as plain user (expect 403)", "POST", "/api/geography/regions/", auth="user_token",
        body=json_body({"name": "Rogue Region"}),
        tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")))
    return folder("1. Geography", items, "Regions / divisions / communities reference data. Reads are public; writes are admin-only (the symptom vocabulary is managed the same way).")


# ---------------------------------------------------------------------------
# Folder 2 — Symptoms
# ---------------------------------------------------------------------------
def folder_symptoms():
    items = []
    items.append(req(
        "List symptoms (public)", "GET", "/api/symptoms/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists symptoms', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('symptom_id', list(_j)[0].id);
const term = (list(_j)[0].name || '').split(' ')[0];
pm.collectionVariables.set('symptom_search_term', term);
""")))
    items.append(req(
        "Search symptoms", "GET", "/api/symptoms/", "search={{symptom_search_term}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('search matches', () => pm.expect(list(_j).length).to.be.gte(1));
""")))
    items.append(req(
        "Symptom detail", "GET", "/api/symptoms/{{symptom_id}}/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has traditional_uses_count', () => pm.expect(_j).to.have.property('traditional_uses_count'));
""")))
    items.append(req(
        "Search plants by symptom (reverse)", "GET", "/api/symptoms/search/", "q={{symptom_search_term}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('returns symptoms and plant results', () => {
    pm.expect(_j.symptoms).to.be.an('array');
    pm.expect(_j.results).to.be.an('array');
    pm.expect(_j).to.have.property('count');
});
""")))
    items.append(req(
        "List symptoms (admin)", "GET", "/api/symptoms/admin/", auth="admin_token",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Create symptom (admin)", "POST", "/api/symptoms/admin/", auth="admin_token",
        body=json_body({"name": "Postman Test Symptom", "description": "Created by the Postman API test suite.", "category": "Testing"}),
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('admin_symptom_id', _j.id);
""")))
    items.append(req(
        "Symptom detail (admin)", "GET", "/api/symptoms/admin/{{admin_symptom_id}}/", auth="admin_token",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Update symptom (admin)", "PATCH", "/api/symptoms/admin/{{admin_symptom_id}}/", auth="admin_token",
        body=json_body({"description": "Updated by the Postman API test suite."}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Delete symptom (admin)", "DELETE", "/api/symptoms/admin/{{admin_symptom_id}}/", auth="admin_token",
        tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")))
    items.append(req(
        "Create symptom as plain user (expect 403)", "POST", "/api/symptoms/admin/", auth="user_token",
        body=json_body({"name": "Rogue Symptom"}),
        tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")))
    return folder("2. Symptoms", items, "Public symptom browsing + admin-only vocabulary management.")


# ---------------------------------------------------------------------------
# Folder 3 — Plants
# ---------------------------------------------------------------------------
def folder_plants():
    items = []
    items.append(req(
        "List plants (public)", "GET", "/api/plants/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists published plants', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('plant_id', list(_j)[0].id);
const p = list(_j)[0];
const term = (p.common_name || p.scientific_name).split(' ')[0];
pm.collectionVariables.set('plant_search_term', term);
""")))
    items.append(req(
        "Search plants", "GET", "/api/plants/", "search={{plant_search_term}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('search matches', () => pm.expect(list(_j).length).to.be.gte(1));
""")))
    items.append(req(
        "Filter plants by region", "GET", "/api/plants/", "region={{region_id}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('response is a list', () => pm.expect(list(_j)).to.be.an('array'));
""")))
    items.append(req(
        "Plant detail (public)", "GET", "/api/plants/{{plant_id}}/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has scientific name and local names', () => {
    pm.expect(_j.scientific_name).to.be.a('string').that.is.not.empty;
    pm.expect(_j.local_names).to.be.an('array');
    pm.expect(_j.parts).to.be.an('array');
});
""")))
    items.append(req(
        "Advanced plant search (text)", "GET", "/api/plants/search/", "q={{plant_search_term}}",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('search matches', () => pm.expect(list(_j).length).to.be.gte(1));
""")))
    items.append(req(
        "Advanced plant search (evidence level)", "GET", "/api/plants/search/", "evidence=STRONG",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('response is a list', () => pm.expect(list(_j)).to.be.an('array'));
""")))
    items.append(req(
        "List plants (admin)", "GET", "/api/plants/admin/", auth="expert_token",
        desc="IsContentCurator — experts and admins may read unpublished plants too.",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Create plant (expert)", "POST", "/api/plants/admin/", auth="expert_token",
        body=json_body({
            "scientific_name": "Postmania postmanii",
            "common_name": "Postman Test Plant",
            "family": "Asteraceae",
            "description": "Created by the Postman API test suite.",
            "habitat": "FOREST",
            "is_published": False,
        }),
        tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('admin_plant_id', _j.id);
""")))
    items.append(req(
        "Plant detail (admin)", "GET", "/api/plants/admin/{{admin_plant_id}}/", auth="expert_token",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Unpublished plant hidden from public (expect 404)", "GET", "/api/plants/{{admin_plant_id}}/",
        tests=T("""
pm.test('status 404', () => pm.expect(_c).to.eql(404));
""")))
    items.append(req(
        "Publish plant (expert)", "PATCH", "/api/plants/admin/{{admin_plant_id}}/", auth="expert_token",
        body=json_body({"is_published": True}),
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('is now published', () => pm.expect(_j.is_published).to.eql(true));
""")))
    items.append(req(
        "Published plant visible to public", "GET", "/api/plants/{{admin_plant_id}}/",
        tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")))
    items.append(req(
        "Update plant as plain user (expect 403)", "PATCH", "/api/plants/admin/{{admin_plant_id}}/", auth="user_token",
        body=json_body({"common_name": "Rogue"}),
        tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")))
    items.append(req(
        "Delete plant (expert)", "DELETE", "/api/plants/admin/{{admin_plant_id}}/", auth="expert_token",
        tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")))
    return folder("3. Plants", items, "Public catalogue (list/search/detail) and curator-only management (experts and admins).")


# ---------------------------------------------------------------------------
# Folder 4 — Knowledge
# ---------------------------------------------------------------------------
def folder_knowledge():
    draft_body = {
        "plant": "{{plant_id}}",
        "symptom": "{{symptom_id}}",
        "plant_part": "Leaf",
        "preparation_method": "Decoction",
        "traditional_use_description": "A leaf decoction traditionally used to ease fever. (Postman test draft)",
        "status": "DRAFT",
    }
    full_body = {
        "plant": "{{plant_id}}",
        "symptom": "{{symptom_id}}",
        "plant_part": "Leaf",
        "preparation_method": "Decoction",
        "traditional_use_description": "A leaf decoction traditionally used to ease fever. (Postman test submission)",
        "dosage": "Two cups of decoction",
        "frequency": "Three times a day",
        "duration": "Five days",
        "administration": "Orally, after meals",
        "cultural_context": "Shared by elders in the community.",
        "region": "{{region_id}}",
        "community": "{{community_id}}",
        "supporting_information": "Oral interviews with two community healers.",
    }
    items = [
        req("List traditional uses (public)", "GET", "/api/knowledge/traditional-uses/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has verified uses', () => pm.expect(list(_j).length).to.be.gte(1));
pm.test('public list contains only verified uses', () =>
    list(_j).forEach((u) => pm.expect(u.is_verified).to.eql(true)));
""")),
        req("Traditional uses for a plant", "GET", "/api/knowledge/traditional-uses/", "plant={{plant_id}}",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('all uses belong to the plant', () =>
    list(_j).forEach((u) => pm.expect(u.plant).to.eql(Number(pm.variables.get('plant_id')))));
""")),
        req("List preparation methods", "GET", "/api/knowledge/preparation-methods/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists methods', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("Create submission as draft (practitioner)", "POST", "/api/knowledge/submissions/create/",
            auth="practitioner_token", body=json_body(draft_body),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('saved as DRAFT', () => pm.expect(_j.status).to.eql('DRAFT'));
pm.collectionVariables.set('draft_id', _j.id);
""")),
        req("Create submission for review (practitioner)", "POST", "/api/knowledge/submissions/create/",
            auth="practitioner_token", body=json_body(full_body),
            desc="Omitting status (or anything but DRAFT) auto-submits and notifies every expert.",
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('status is SUBMITTED', () => pm.expect(_j.status).to.eql('SUBMITTED'));
pm.collectionVariables.set('submission_id', _j.id);
""")),
        req("Pending review list (expert)", "GET", "/api/knowledge/submissions/pending/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the new submission', () =>
    pm.expect(list(_j).map((s) => s.id)).to.include(Number(pm.variables.get('submission_id'))));
""")),
        req("Review — request revision (expert)", "POST", "/api/knowledge/submissions/{{submission_id}}/review/",
            auth="expert_token",
            body=json_body({"action": "request_revision", "comments": "Please add a source for the duration."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('status is REVISION_REQUESTED', () => pm.expect(_j.status).to.eql('REVISION_REQUESTED'));
""")),
        req("Edit revised submission (practitioner)", "PATCH", "/api/knowledge/submissions/{{submission_id}}/",
            auth="practitioner_token",
            body=json_body({"supporting_information": "Elder interviews from two villages. (revised)"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Review — reject (expert)", "POST", "/api/knowledge/submissions/{{submission_id}}/review/",
            auth="expert_token",
            body=json_body({"action": "reject", "reason": "Needs clearer sourcing."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('status is REJECTED', () => pm.expect(_j.status).to.eql('REJECTED'));
""")),
        req("Resubmit rejected submission (practitioner)", "PATCH", "/api/knowledge/submissions/{{submission_id}}/",
            auth="practitioner_token",
            body=json_body({"dosage": "Two cups of decoction"}),
            desc="A contributor editing a rejected record resubmits it: the view flips status back to SUBMITTED.",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('automatically resubmitted', () => pm.expect(_j.status).to.eql('SUBMITTED'));
""")),
        req("Review — approve (expert)", "POST", "/api/knowledge/submissions/{{submission_id}}/review/",
            auth="expert_token",
            body=json_body({"action": "approve", "comments": "Verified for publication."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('published after approval', () => pm.expect(_j.status).to.eql('PUBLISHED'));
""")),
        req("Approved use now public", "GET", "/api/knowledge/traditional-uses/",
            "plant={{plant_id}}&symptom={{symptom_id}}",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('a verified use exists for this plant+symptom', () =>
    pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("My submissions (practitioner, filtered)", "GET", "/api/knowledge/submissions/",
            "status=PUBLISHED", auth="practitioner_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the published submission', () =>
    pm.expect(list(_j).map((s) => s.id)).to.include(Number(pm.variables.get('submission_id'))));
""")),
        req("Submission detail (practitioner)", "GET", "/api/knowledge/submissions/{{submission_id}}/",
            auth="practitioner_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('reviewer recorded', () => pm.expect(_j.reviewer_name).to.be.a('string').that.is.not.empty);
""")),
        req("Create submission as plain user (expect 403)", "POST", "/api/knowledge/submissions/create/",
            auth="user_token", body=json_body(draft_body),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
        req("List all submissions (expert)", "GET", "/api/knowledge/submissions/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('experts see every submission', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("Edit published submission as plain user (expect 403/404)", "PATCH",
            "/api/knowledge/submissions/{{submission_id}}/", auth="user_token",
            body=json_body({"dosage": "hacked"}),
            tests=T("""
pm.test('denied', () => pm.expect([403, 404]).to.include(_c));
""")),
    ]
    return folder("4. Knowledge", items,
                  "The full verification workflow: practitioner submits (draft or for review), expert requests revision / rejects / approves; approval publishes a verified TraditionalUse and notifies the contributor.")


# ---------------------------------------------------------------------------
# Folder 5 — Evidence
# ---------------------------------------------------------------------------
def folder_evidence():
    items = [
        req("List evidence (public)", "GET", "/api/evidence/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists evidence', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('evidence_id', list(_j)[0].id);
""")),
        req("Evidence for a plant", "GET", "/api/evidence/", "plant={{plant_id}}",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Evidence by level", "GET", "/api/evidence/", "level=STRONG",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('all STRONG', () => list(_j).forEach((e) => pm.expect(e.level).to.eql('STRONG')));
""")),
        req("Evidence detail (public)", "GET", "/api/evidence/{{evidence_id}}/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has level and summary', () => {
    pm.expect(_j.level).to.be.a('string');
    pm.expect(_j.summary).to.be.a('string');
});
""")),
        req("Create evidence (expert)", "POST", "/api/evidence/create/", auth="expert_token",
            body=json_body({
                "plant": "{{plant_id}}", "level": "MODERATE",
                "summary": "Field observations support the traditional use. (Postman test)",
                "source": "Postman API test suite",
                "reference_url": "https://example.org/study",
                "publication_date": "2024-06-01",
            }),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('new_evidence_id', _j.id);
""")),
        req("Update evidence (expert)", "PATCH", "/api/evidence/{{new_evidence_id}}/update/",
            auth="expert_token", body=json_body({"level": "STRONG"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('level upgraded', () => pm.expect(_j.level).to.eql('STRONG'));
""")),
        req("Create evidence as plain user (expect 403)", "POST", "/api/evidence/create/",
            auth="user_token",
            body=json_body({"plant": "{{plant_id}}", "level": "STRONG", "summary": "nope", "source": "nope"}),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("5. Evidence", items, "Scientific evidence per plant. Reads public; writes expert/admin only.")


# ---------------------------------------------------------------------------
# Folder 6 — Safety
# ---------------------------------------------------------------------------
def folder_safety():
    items = [
        req("List safety records (public)", "GET", "/api/safety/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists records', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('safety_id', list(_j)[0].id);
""")),
        req("Safety records for a plant", "GET", "/api/safety/", "plant={{plant_id}}",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Safety detail (public)", "GET", "/api/safety/{{safety_id}}/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has risk level', () => pm.expect(_j.risk_level).to.be.a('string'));
""")),
        req("Create safety record (expert)", "POST", "/api/safety/create/", auth="expert_token",
            body=json_body({
                "plant": "{{plant_id}}", "risk_level": "LOW",
                "precautions": "Standard precautions. (Postman test)",
                "general_warning": "Traditional use only — not medical advice.",
            }),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('new_safety_id', _j.id);
""")),
        req("Update safety record (expert)", "PATCH", "/api/safety/{{new_safety_id}}/update/",
            auth="expert_token", body=json_body({"risk_level": "MODERATE"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('risk level changed', () => pm.expect(_j.risk_level).to.eql('MODERATE'));
""")),
        req("Create safety record as plain user (expect 403)", "POST", "/api/safety/create/",
            auth="user_token",
            body=json_body({"plant": "{{plant_id}}", "risk_level": "HIGH", "precautions": "nope"}),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("6. Safety", items, "Safety information per plant. Reads public; writes expert/admin only.")


# ---------------------------------------------------------------------------
# Folder 7 — Identification
# ---------------------------------------------------------------------------
def folder_identification():
    items = [
        req(
            "Identify plant (image upload)", "POST", "/api/identification/identify/",
            auth="user_token",
            body=form_body([{"key": "image", "type": "file", "src": "sample-plant.jpg", "contentType": "image/jpeg"}]),
            desc="multipart/form-data with an `image` file field (sample-plant.jpg ships next to the collection — point it at any plant photo). Returns 201 with AI results when OPENROUTER_API_KEY is configured; without a key it returns 503 (or 400 for a non-image upload) and still creates a FAILED record.",
            tests=T("""
pm.test('201 (AI configured) or 400/503 (no key / bad image)', () =>
    pm.expect([201, 400, 503]).to.include(_c));
if (_j && _j.identification && _j.identification.id) {
    pm.collectionVariables.set('my_ident_id', _j.identification.id);
}
if (_c === 201) {
    pm.test('has at least one result', () => pm.expect(_j.results).to.be.an('array').with.length.gte(1));
    pm.test('has analysis', () => pm.expect(_j.analysis).to.be.an('object'));
}
""")),
        req("Identification history", "GET", "/api/identification/history/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('history is not empty', () => pm.expect(list(_j).length).to.be.gte(1));
if (!pm.collectionVariables.get('my_ident_id')) {
    pm.collectionVariables.set('my_ident_id', list(_j)[0].id);
}
""")),
        req("Identification detail", "GET", "/api/identification/{{my_ident_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has a status', () => pm.expect(['PROCESSING', 'COMPLETED', 'FAILED']).to.include(_j.status));
""")),
        req("Report incorrect identification", "POST", "/api/identification/{{my_ident_id}}/report/",
            auth="user_token", body=json_body({"identification": "{{my_ident_id}}", "reason": "Wrong species — reported by the Postman API test suite."}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
""")),
        req("Delete identification", "DELETE", "/api/identification/{{my_ident_id}}/delete/", auth="user_token",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
        req("History without auth (expect 401)", "GET", "/api/identification/history/",
            tests=T("""
pm.test('status 401', () => pm.expect(_c).to.eql(401));
""")),
    ]
    return folder("7. Identification", items,
                  "AI identification needs OPENROUTER_API_KEY in the backend .env for 201s; without it the suite still validates the failure contract (400/503) and history/detail/report/delete.")


# ---------------------------------------------------------------------------
# Folder 8 — Consultations
# ---------------------------------------------------------------------------
def folder_consultations():
    folder_pre = """
// Compute the test windows once per run (ISO strings are consumed as-is).
if (!pm.collectionVariables.get('slot_start')) {
    // +45 days base with a random 0-59 minute offset so re-runs never
    // overlap windows left behind by previous runs.
    const jitter = Math.floor(Math.random() * 59 * 60e3);
    const start = new Date(Date.now() + 45 * 864e5 + jitter);
    pm.collectionVariables.set('slot_start', start.toISOString());
    pm.collectionVariables.set('slot_end', new Date(start.getTime() + 45 * 60e3).toISOString());
    const start2 = new Date(start.getTime() + 2 * 3600e3);
    pm.collectionVariables.set('slot2_start', start2.toISOString());
    pm.collectionVariables.set('slot2_end', new Date(start2.getTime() + 45 * 60e3).toISOString());
    const startB = new Date(Date.now() + 20 * 864e5 + Math.floor(Math.random() * 59 * 60e3));
    pm.collectionVariables.set('slotB_start', startB.toISOString());
    pm.collectionVariables.set('slotB_end', new Date(startB.getTime() + 45 * 60e3).toISOString());
}
"""
    slots_pre = """
// Make sure the specialist we log in as has an open window the patient can book.
(async () => {
    const base = pm.variables.get('baseUrl');
    const tok = pm.collectionVariables.get('user_token');
    const admTok = pm.collectionVariables.get('admin_token');
    const expertId = pm.collectionVariables.get('expert_user_id');
    const { error, response } = await pm.sendRequest({
        url: base + '/api/consultations/slots/?expert=' + expertId,
        header: [{ key: 'Authorization', value: 'Bearer ' + tok }],
    });
    const body = (response && response.json()) || {};
    const open = (body.results || []).filter((s) => s.is_open);
    if (error || !open.length) {
        await pm.sendRequest({
            url: base + '/api/consultations/availability/',
            method: 'POST',
            header: [{ key: 'Authorization', value: 'Bearer ' + admTok }],
            body: { mode: 'raw', raw: JSON.stringify({
                expert: Number(expertId),
                starts_at: pm.collectionVariables.get('slotB_start'),
                ends_at: pm.collectionVariables.get('slotB_end'),
                note: 'Fallback window for the Postman suite',
            }) },
        });
    }
})();
"""
    items = [
        req("Specialist profile (me)", "GET", "/api/consultations/experts/me/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.collectionVariables.set('expert_profile_id', _j.id);
pm.collectionVariables.set('expert_user_id', _j.user);
""")),
        req("My availability windows", "GET", "/api/consultations/availability/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Publish availability window", "POST", "/api/consultations/availability/", auth="expert_token",
            body=json_body({"starts_at": "{{slot_start}}", "ends_at": "{{slot_end}}", "note": "Published by the Postman API test suite."}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('slot_id', _j.id);
""")),
        req("Availability window detail", "GET", "/api/consultations/availability/{{slot_id}}/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Update availability window", "PATCH", "/api/consultations/availability/{{slot_id}}/", auth="expert_token",
            body=json_body({"note": "Updated by the Postman API test suite."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Overlapping window refused (expect 400)", "POST", "/api/consultations/availability/", auth="expert_token",
            body=json_body({"starts_at": "{{slot_start}}", "ends_at": "{{slot_end}}"}),
            tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")),
        req("Publish second window (to delete later)", "POST", "/api/consultations/availability/", auth="expert_token",
            body=json_body({"starts_at": "{{slot2_start}}", "ends_at": "{{slot2_end}}"}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('slot2_id', _j.id);
""")),
        req("Open slots for the specialist (patient)", "GET", "/api/consultations/slots/",
            "expert={{expert_user_id}}", auth="user_token", pre=slots_pre,
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
const items = list(_j).filter((s) => s.expert === Number(pm.variables.get('expert_user_id')));
pm.test('specialist has an open window', () => pm.expect(items.some((s) => s.is_open)).to.eql(true));
const pick = items.find((s) => s.is_open);
pm.collectionVariables.set('booked_slot_id', pick.id);
pm.collectionVariables.set('booked_slot_expert_id', pick.expert);
""")),
        req("Book appointment (patient)", "POST", "/api/consultations/appointments/book/", auth="user_token",
            body=json_body({"slot": "{{booked_slot_id}}", "reason": "Booked by the Postman API test suite."}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('starts PENDING', () => pm.expect(_j.status).to.eql('PENDING'));
pm.collectionVariables.set('appointment_id', _j.id);
""")),
        req("Double-book same slot (expect 400)", "POST", "/api/consultations/appointments/book/", auth="user_token",
            body=json_body({"slot": "{{booked_slot_id}}", "reason": "Second attempt."}),
            tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")),
        req("My appointments (patient)", "GET", "/api/consultations/appointments/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the new booking', () =>
    pm.expect(list(_j).map((a) => a.id)).to.include(Number(pm.variables.get('appointment_id'))));
""")),
        req("Appointment detail (patient)", "GET", "/api/consultations/appointments/{{appointment_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('patient is the demo user', () => pm.expect(_j.patient.username).to.eql('demo_user'));
pm.test('slot details embedded', () => pm.expect(_j.slot_detail).to.have.property('starts_at'));
""")),
        req("Pending appointments (specialist)", "GET", "/api/consultations/appointments/",
            "status=PENDING", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('sees the patient request', () =>
    pm.expect(list(_j).map((a) => a.id)).to.include(Number(pm.variables.get('appointment_id'))));
""")),
        req("Confirm appointment (specialist)", "POST", "/api/consultations/appointments/{{appointment_id}}/status/",
            auth="expert_token", body=json_body({"action": "confirm"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('status CONFIRMED', () => pm.expect(_j.status).to.eql('CONFIRMED'));
""")),
        req("Patient cannot confirm (expect 403)", "POST", "/api/consultations/appointments/{{appointment_id}}/status/",
            auth="user_token", body=json_body({"action": "confirm"}),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
        req("Add consultation notes (specialist)", "PATCH", "/api/consultations/appointments/{{appointment_id}}/",
            auth="expert_token",
            body=json_body({"expert_notes": "Pre-consultation note written by the Postman API test suite."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('notes persisted', () => pm.expect(_j.expert_notes).to.include('Postman API test suite'));
""")),
        req("Start consultation (patient)", "POST", "/api/consultations/appointments/{{appointment_id}}/start/",
            auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('returns room id and ICE servers', () => {
    pm.expect(_j.room_id).to.be.a('string').that.is.not.empty;
    pm.expect(_j.ice_servers).to.be.an('array');
});
""")),
        req("Reschedule (patient)", "POST", "/api/consultations/appointments/{{appointment_id}}/reschedule/",
            auth="user_token",
            body=json_body({"slot": "{{slot_id}}", "reason": "Reschedule test by the Postman API test suite."}),
            desc="Patient-initiated moves return the booking to PENDING (the new time needs confirmation again).",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('moved to the new window', () => pm.expect(_j.slot_detail.id).to.eql(Number(pm.variables.get('slot_id'))));
pm.test('back to PENDING', () => pm.expect(_j.status).to.eql('PENDING'));
""")),
        req("Booked window cannot be deleted (expect 400)", "DELETE",
            "/api/consultations/availability/{{slot_id}}/", auth="expert_token",
            tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")),
        req("Confirm after reschedule (specialist)", "POST", "/api/consultations/appointments/{{appointment_id}}/status/",
            auth="expert_token", body=json_body({"action": "confirm"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Complete consultation (specialist)", "POST", "/api/consultations/appointments/{{appointment_id}}/status/",
            auth="expert_token",
            body=json_body({"action": "complete", "note": "Completed by the Postman API test suite."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('status COMPLETED', () => pm.expect(_j.status).to.eql('COMPLETED'));
pm.test('completed_at stamped', () => pm.expect(_j.completed_at).to.be.a('string'));
""")),
        req("Complete twice (expect 400)", "POST", "/api/consultations/appointments/{{appointment_id}}/status/",
            auth="expert_token", body=json_body({"action": "complete"}),
            tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")),
        req("Cleanup — delete reschedule window (specialist)", "DELETE",
            "/api/consultations/availability/{{slot_id}}/", auth="expert_token",
            desc="The consultation is COMPLETED, so the window is free again and can be withdrawn.",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
        req("Delete unused window (specialist)", "DELETE", "/api/consultations/availability/{{slot2_id}}/",
            auth="expert_token",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
        req("My conversations (specialist)", "GET", "/api/consultations/conversations/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
const conv = list(_j).find((c) => c.appointment === Number(pm.variables.get('appointment_id')));
pm.test('thread exists for the appointment', () => pm.expect(conv).to.exist);
pm.collectionVariables.set('conversation_id', conv.id);
""")),
        req("Send chat message (patient)", "POST", "/api/consultations/conversations/{{conversation_id}}/messages/",
            auth="user_token", body=json_body({"body": "Hello from the Postman API test suite!"}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('echoed back', () => pm.expect(_j.body).to.include('Postman API test suite'));
""")),
        req("Read thread (specialist)", "GET", "/api/consultations/conversations/{{conversation_id}}/messages/",
            auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the patient message', () =>
    pm.expect(list(_j).some((m) => m.body.includes('Postman API test suite'))).to.eql(true));
""")),
        req("Relay WebRTC offer (patient)", "POST", "/api/consultations/conversations/{{conversation_id}}/signal/",
            auth="user_token",
            body=json_body({"kind": "OFFER", "payload": "{\"type\":\"postman-sdp-offer\"}"}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.test('stored as OFFER', () => pm.expect(_j.kind).to.eql('OFFER'));
""")),
        req("Poll signals (specialist)", "GET", "/api/consultations/conversations/{{conversation_id}}/signal/",
            auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('received the offer', () =>
    pm.expect(list(_j).some((m) => m.kind === 'OFFER')).to.eql(true));
""")),
        req("Mark thread read (specialist)", "POST", "/api/consultations/conversations/{{conversation_id}}/read/",
            auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('reports how many were marked', () => pm.expect(_j).to.have.property('marked_read'));
""")),
        req("Specialist directory (public)", "GET", "/api/consultations/experts/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists specialists', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("Directory filtered by specialisation (public)", "GET", "/api/consultations/experts/",
            "specialization=herbal",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Directory ordered by distance (public)", "GET", "/api/consultations/experts/",
            "lat=3.848&lng=11.502",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('distance computed', () =>
    pm.expect(list(_j).every((e) => e.distance_km === null || typeof e.distance_km === 'number')).to.eql(true));
""")),
        req("Specialist profile detail", "GET", "/api/consultations/experts/{{expert_profile_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Update own listing (specialist)", "PATCH", "/api/consultations/experts/me/", auth="expert_token",
            body=json_body({"specialization": "Ethnobotany (updated by Postman)", "is_accepting_patients": True}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('specialisation persisted', () => pm.expect(_j.specialization).to.include('Postman'));
""")),
        req("Verify specialist (admin)", "PATCH", "/api/consultations/experts/{{expert_profile_id}}/", auth="admin_token",
            body=json_body({"is_verified": True}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('verified', () => pm.expect(_j.is_verified).to.eql(true));
""")),
        req("Plain user cannot verify (expect 403)", "PATCH", "/api/consultations/experts/{{expert_profile_id}}/",
            auth="user_token", body=json_body({"is_verified": True}),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
        req("Consultation stats (admin)", "GET", "/api/consultations/stats/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has totals', () => {
    pm.expect(_j.total).to.be.a('number');
    pm.expect(_j.by_status).to.be.an('object');
});
""")),
        req("Stats as plain user (expect 403)", "GET", "/api/consultations/stats/", auth="user_token",
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
        req("Update booking reason (patient)", "PATCH", "/api/consultations/appointments/{{appointment_id}}/",
            auth="user_token", body=json_body({"reason": "Reason updated by the Postman API test suite."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
    ]
    return folder("8. Consultations", items, pre=folder_pre,
                  desc="Full booking lifecycle: publish window -> patient books -> specialist confirms -> start (WebRTC room) -> reschedule -> complete, plus chat, signalling and the public specialist directory. Driven by the demo expert account, so its specialist owns every window it manages.")


# ---------------------------------------------------------------------------
# Folder 9 — Assistant
# ---------------------------------------------------------------------------
def folder_assistant():
    items = [
        req("Create chat session", "POST", "/api/assistant/", auth="user_token",
            body=json_body({"title": "Postman API test session"}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('chat_session_id', _j.id);
""")),
        req("List my sessions", "GET", "/api/assistant/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the new session', () =>
    pm.expect(list(_j).map((s) => s.id)).to.include(Number(pm.variables.get('chat_session_id'))));
""")),
        req("Ask — empty message (expect 400)", "POST", "/api/assistant/ask/", auth="user_token",
            body=json_body({"message": "   "}),
            tests=T("""
pm.test('status 400', () => pm.expect(_c).to.eql(400));
""")),
        req("Ask the assistant", "POST", "/api/assistant/ask/", auth="user_token",
            body=json_body({"message": "What is the traditional use of aloe vera for skin?", "session": "{{chat_session_id}}"}),
            desc="201 with the reply when OPENROUTER_API_KEY is configured; 502 otherwise (the turn is rolled back).",
            tests=T("""
pm.test('201 (AI configured) or 502 (no key)', () => pm.expect([201, 502]).to.include(_c));
if (_c === 201) {
    pm.test('reply persisted', () => pm.expect(_j.reply.content).to.be.a('string').that.is.not.empty);
    pm.test('grounded flag present', () => pm.expect(_j).to.have.property('grounded'));
}
""")),
        req("Session detail", "GET", "/api/assistant/{{chat_session_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Session transcript", "GET", "/api/assistant/{{chat_session_id}}/messages/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('transcript is a list', () => pm.expect(list(_j)).to.be.an('array'));
""")),
        req("Archive session", "PATCH", "/api/assistant/{{chat_session_id}}/archive/", auth="user_token",
            body=json_body({"is_archived": True}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('archived', () => pm.expect(_j.is_archived).to.eql(true));
""")),
        req("Delete session", "DELETE", "/api/assistant/{{chat_session_id}}/", auth="user_token",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
    ]
    return folder("9. Assistant", items,
                  "Conversational assistant. The `Ask the assistant` request returns 201 only when the backend has an OPENROUTER_API_KEY; without one it asserts the 502 failure contract.")


# ---------------------------------------------------------------------------
# Folder 10 — Articles
# ---------------------------------------------------------------------------
def folder_articles():
    items = [
        req("List articles (public)", "GET", "/api/articles/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists published articles', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('article_id', list(_j)[0].id);
pm.collectionVariables.set('article_slug', list(_j)[0].slug);
""")),
        req("List categories", "GET", "/api/articles/categories/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has categories', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('category_slug', list(_j)[0].slug);
""")),
        req("Articles by category (public)", "GET", "/api/articles/", "category={{category_slug}}",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Article detail (public)", "GET", "/api/articles/{{article_slug}}/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('slug matches', () => pm.expect(_j.slug).to.eql(pm.variables.get('article_slug')));
pm.test('has content', () => pm.expect(_j.content).to.be.a('string'));
""")),
        req("List articles (admin, incl. drafts)", "GET", "/api/articles/admin/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists articles', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("Create article (expert)", "POST", "/api/articles/admin/", auth="expert_token",
            pre="""
pm.collectionVariables.set('new_article_slug', 'postman-article-' + Date.now().toString(36));
""",
            body=json_body({
                "title": "Postman Test Article",
                "slug": "{{new_article_slug}}",
                "content": "Content created by the Postman API test suite.",
                "summary": "A test article.",
                "category": None,
                "is_published": False,
            }),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('admin_article_id', _j.id);
""")),
        req("Article detail (admin)", "GET", "/api/articles/admin/{{admin_article_id}}/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Publish article (expert)", "PATCH", "/api/articles/admin/{{admin_article_id}}/", auth="expert_token",
            body=json_body({"is_published": True}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('published_at stamped', () => pm.expect(_j.published_at).to.be.a('string'));
""")),
        req("New article visible to public", "GET", "/api/articles/{{new_article_slug}}/",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Delete article (expert)", "DELETE", "/api/articles/admin/{{admin_article_id}}/", auth="expert_token",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
        req("Create article as plain user (expect 403)", "POST", "/api/articles/admin/", auth="user_token",
            body=json_body({"title": "Rogue", "slug": "rogue-article", "content": "x", "is_published": False}),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("10. Articles", items, "Public reading room + curator (expert/admin) authoring: draft -> publish -> readers see it -> cleanup.")


# ---------------------------------------------------------------------------
# Folder 11 — Notifications
# ---------------------------------------------------------------------------
def folder_notifications():
    items = [
        req("My notifications", "GET", "/api/notifications/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has notifications', () => pm.expect(list(_j).length).to.be.gte(1));
const items = list(_j);
const target = items.find((n) => n.is_read === false) || items[0];
pm.collectionVariables.set('notification_id', target.id);
""")),
        req("Unread count", "GET", "/api/notifications/unread-count/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('count is a number', () => pm.expect(_j.count).to.be.a('number'));
""")),
        req("Mark one read", "POST", "/api/notifications/{{notification_id}}/read/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Mark all read", "POST", "/api/notifications/mark-all-read/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Unread count after mark-all", "GET", "/api/notifications/unread-count/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('count is a number', () => pm.expect(_j.count).to.be.a('number'));
""")),
        req("Delete notification", "DELETE", "/api/notifications/{{notification_id}}/", auth="user_token",
            tests=T("""
pm.test('status 204', () => pm.expect(_c).to.eql(204));
""")),
        req("Notifications without auth (expect 401)", "GET", "/api/notifications/",
            tests=T("""
pm.test('status 401', () => pm.expect(_c).to.eql(401));
""")),
    ]
    return folder("11. Notifications", items)


# ---------------------------------------------------------------------------
# Folder 12 — Analytics & Favorites
# ---------------------------------------------------------------------------
def folder_analytics():
    items = [
        req("My favorites", "GET", "/api/analytics/favorites/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Add favorite", "POST", "/api/analytics/favorites/add/", auth="user_token",
            body=json_body({"plant_id": "{{plant_id}}"}),
            tests=T("""
pm.test('201 (added) or 200 (already saved)', () => pm.expect([200, 201]).to.include(_c));
""")),
        req("Check favorite (should be true)", "GET", "/api/analytics/favorites/check/{{plant_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('is favorite', () => pm.expect(_j.is_favorite).to.eql(true));
""")),
        req("Remove favorite", "POST", "/api/analytics/favorites/remove/", auth="user_token",
            body=json_body({"plant_id": "{{plant_id}}"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Check favorite (should be false)", "GET", "/api/analytics/favorites/check/{{plant_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('not favorite anymore', () => pm.expect(_j.is_favorite).to.eql(false));
""")),
        req("Dashboard", "GET", "/api/analytics/dashboard/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has plant totals', () => pm.expect(_j.total_plants).to.be.a('number').that.is.gte(1));
pm.test('has symptom totals', () => pm.expect(_j.total_symptoms).to.be.a('number'));
""")),
    ]
    return folder("12. Analytics & Favorites", items)


# ---------------------------------------------------------------------------
# Folder 13 — Preservation
# ---------------------------------------------------------------------------
def folder_preservation():
    items = [
        req("Risk assessments", "GET", "/api/preservation/risk/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has assessments', () => pm.expect(list(_j).length).to.be.gte(1));
pm.collectionVariables.set('risk_id', list(_j)[0].id);
""")),
        req("High-risk only", "GET", "/api/preservation/risk/", "level=HIGH", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('all HIGH', () => list(_j).forEach((r) => pm.expect(r.risk_level).to.eql('HIGH')));
""")),
        req("Risk detail", "GET", "/api/preservation/risk/{{risk_id}}/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Run full risk assessment (expert)", "POST", "/api/preservation/risk/calculate/", auth="expert_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('reports what it assessed', () => pm.expect(_j.detail).to.be.a('string'));
""")),
        req("Run assessment as plain user (expect 403)", "POST", "/api/preservation/risk/calculate/", auth="user_token",
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("13. Preservation", items)


# ---------------------------------------------------------------------------
# Folder 14 — Audit
# ---------------------------------------------------------------------------
def folder_audit():
    items = [
        req("Audit log (admin)", "GET", "/api/audit/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('has entries', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("Audit log filtered by action", "GET", "/api/audit/", "action=KNOWLEDGE", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('filter applied', () => list(_j).forEach((e) =>
    pm.expect(String(e.action).toLowerCase()).to.include('knowledge')));
""")),
        req("Audit log as plain user (expect 403)", "GET", "/api/audit/", auth="user_token",
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("14. Audit", items)


# ---------------------------------------------------------------------------
# Folder 15 — Feedback
# ---------------------------------------------------------------------------
def folder_feedback():
    items = [
        req("Send feedback (user)", "POST", "/api/feedback/send/", auth="user_token",
            body=json_body({"category": "SUGGESTION", "message": "Postman API test suite: the API is solid.", "rating": 5, "page": "/postman"}),
            tests=T("""
pm.test('status 201', () => pm.expect(_c).to.eql(201));
pm.collectionVariables.set('feedback_id', _j.id);
""")),
        req("Feedback queue (admin)", "GET", "/api/feedback/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('contains the new note', () =>
    pm.expect(list(_j).map((f) => f.id)).to.include(Number(pm.variables.get('feedback_id'))));
""")),
        req("Queue filtered by status", "GET", "/api/feedback/", "status=NEW", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('all NEW', () => list(_j).forEach((f) => pm.expect(f.status).to.eql('NEW')));
""")),
        req("Feedback detail (admin)", "GET", "/api/feedback/{{feedback_id}}/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('author visible', () => pm.expect(_j.user_name).to.be.a('string').that.is.not.empty);
""")),
        req("Pick up feedback (admin)", "PATCH", "/api/feedback/{{feedback_id}}/", auth="admin_token",
            body=json_body({"status": "IN_REVIEW", "admin_response": "Thanks — reviewing now."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('IN_REVIEW', () => pm.expect(_j.status).to.eql('IN_REVIEW'));
""")),
        req("Resolve feedback (admin)", "PATCH", "/api/feedback/{{feedback_id}}/", auth="admin_token",
            body=json_body({"status": "RESOLVED", "admin_response": "Resolved by the Postman API test suite."}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('resolved and stamped', () => {
    pm.expect(_j.status).to.eql('RESOLVED');
    pm.expect(_j.resolved_at).to.be.a('string');
});
""")),
        req("Queue as plain user (expect 403)", "GET", "/api/feedback/", auth="user_token",
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("15. Feedback", items)


# ---------------------------------------------------------------------------
# Folder 16 — Practitioners
# ---------------------------------------------------------------------------
def folder_practitioners():
    items = [
        req("My practitioner profile", "GET", "/api/practitioners/profile/", auth="practitioner_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.collectionVariables.set('practitioner_user_id', _j.user);
""")),
        req("Update practitioner profile", "PATCH", "/api/practitioners/profile/", auth="practitioner_token",
            body=json_body({
                "community_name": "Postman Village",
                "years_of_experience": 15,
                "areas_of_knowledge": "Aloe vera, ginger, African basil",
            }),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('experience persisted', () => pm.expect(_j.years_of_experience).to.eql(15));
""")),
        req("List practitioners (admin)", "GET", "/api/practitioners/list/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('admin sees all profiles', () => pm.expect(list(_j).length).to.be.gte(1));
""")),
        req("List as plain user (expect empty list)", "GET", "/api/practitioners/list/", auth="user_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('non-admins get an empty list', () => pm.expect(list(_j).length).to.eql(0));
""")),
    ]
    return folder("16. Practitioners", items)


# ---------------------------------------------------------------------------
# Folder 17 — Admin & System
# ---------------------------------------------------------------------------
def folder_admin():
    items = [
        req("List users (admin)", "GET", "/api/auth/users/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('lists users', () => pm.expect(list(_j).length).to.be.gte(10));
const admin = list(_j).find((u) => u.username === 'admin');
pm.collectionVariables.set('admin_user_id', admin ? admin.id : '');
""")),
        req("Users by role", "GET", "/api/auth/users/", "role=EXPERT", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('all experts', () => list(_j).forEach((u) => pm.expect(u.role).to.eql('EXPERT')));
""")),
        req("Users by search", "GET", "/api/auth/users/", "search=demo", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('finds demo_user', () =>
    pm.expect(list(_j).some((u) => u.username === 'demo_user')).to.eql(true));
""")),
        req("User detail (admin)", "GET", "/api/auth/users/{{user_id}}/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('is demo_user', () => pm.expect(_j.username).to.eql('demo_user'));
""")),
        req("Change throwaway user role (admin)", "PATCH", "/api/auth/users/{{newuser_id}}/", auth="admin_token",
            body=json_body({"role": "PRACTITIONER"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('role changed', () => pm.expect(_j.role).to.eql('PRACTITIONER'));
""")),
        req("Revert throwaway user role (admin)", "PATCH", "/api/auth/users/{{newuser_id}}/", auth="admin_token",
            body=json_body({"role": "USER"}),
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.test('role restored', () => pm.expect(_j.role).to.eql('USER'));
""")),
        req("User list as plain user (expect 403)", "GET", "/api/auth/users/", auth="user_token",
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
        req("Get system settings (admin)", "GET", "/api/auth/settings/", auth="admin_token",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
pm.collectionVariables.set('settings_json', JSON.stringify(_j));
""")),
        req("Update system settings (admin, idempotent)", "PUT", "/api/auth/settings/", auth="admin_token",
            body=raw_body("{{settings_json}}"),
            desc="PUTs back the values read in the previous request, so the run is repeatable. The endpoint ignores disallowed keys and refuses anything that looks like credentials.",
            tests=T("""
pm.test('status 200', () => pm.expect(_c).to.eql(200));
""")),
        req("Update settings as plain user (expect 403)", "PUT", "/api/auth/settings/", auth="user_token",
            body=raw_body("{}", ),
            tests=T("""
pm.test('status 403', () => pm.expect(_c).to.eql(403));
""")),
    ]
    return folder("17. Admin & System", items)


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------
VARS = [
    ("baseUrl", "http://localhost:8000"),
    # Demo credentials (override if your seeded accounts differ)
    ("admin_username", "admin"), ("admin_password", "admin123!"),
    ("expert_username", "drnkeng"), ("expert_password", "expert123!"),
    ("practitioner_username", "mbaforc"), ("practitioner_password", "pract123!"),
    ("user_username", "demo_user"), ("user_password", "user1234!"),
    # Tokens (filled by the Auth folder)
    ("admin_token", ""), ("expert_token", ""), ("practitioner_token", ""),
    ("user_token", ""), ("newuser_token", ""), ("admin_refresh", ""),
    # Identities captured along the way
    ("newuser_username", ""), ("newuser_password", ""), ("newuser_id", ""),
    ("user_id", ""), ("expert_user_id", ""), ("practitioner_user_id", ""), ("admin_user_id", ""),
    # Geography
    ("region_id", ""), ("division_id", ""), ("community_id", ""),
    ("new_region_id", ""), ("new_division_id", ""), ("new_community_id", ""),
    # Symptoms / plants
    ("symptom_id", ""), ("symptom_search_term", ""), ("admin_symptom_id", ""),
    ("plant_id", ""), ("plant_search_term", ""), ("admin_plant_id", ""),
    # Knowledge / evidence / safety
    ("draft_id", ""), ("submission_id", ""),
    ("evidence_id", ""), ("new_evidence_id", ""), ("safety_id", ""), ("new_safety_id", ""),
    # Identification
    ("my_ident_id", ""),
    # Consultations
    ("slot_start", ""), ("slot_end", ""), ("slot2_start", ""), ("slot2_end", ""),
    ("slotB_start", ""), ("slotB_end", ""),
    ("slot_id", ""), ("slot2_id", ""), ("booked_slot_id", ""), ("booked_slot_expert_id", ""),
    ("appointment_id", ""), ("conversation_id", ""), ("expert_profile_id", ""),
    # Assistant
    ("chat_session_id", ""),
    # Articles
    ("article_id", ""), ("article_slug", ""), ("category_slug", ""),
    ("admin_article_id", ""), ("new_article_slug", ""),
    # Notifications / feedback / preservation / settings
    ("notification_id", ""), ("feedback_id", ""), ("risk_id", ""), ("settings_json", "{}"),
]


def main():
    collection = {
        "info": {
            "name": "HerbaCam API",
            "_postman_id": uid(),
            "description": (
                "API test suite for HerbaCam (Django REST + JWT).\n\n"
                "**How to run**\n"
                "1. Import this collection and the `HerbaCam` environment (or set the `baseUrl` collection variable to your server).\n"
                "2. Make sure the backend is running with demo data (`python manage.py seed_data --clear`) and that the demo credentials below match your accounts.\n"
                "3. Run the collection top-to-bottom (Run Collection). Folder 0 logs in as the four demo roles and every later folder depends on the tokens/ids it stores.\n\n"
                "**Roles**\n"
                "- admin — `admin` / `admin123!`\n"
                "- expert — `drnkeng` / `expert123!`\n"
                "- practitioner — `mbaforc` / `pract123!`\n"
                "- user — `demo_user` / `user1234!`\n\n"
                "**AI endpoints**\n"
                "`Identify plant` and `Ask the assistant` return success (201) only when `OPENROUTER_API_KEY` is set in the backend `.env`; without a key they assert the failure contract (503/502) instead.\n\n"
                "Every request asserts status codes and key response fields, and negative tests cover 400/401/403/404 contracts."
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": [
            folder_auth(),
            folder_geography(),
            folder_symptoms(),
            folder_plants(),
            folder_knowledge(),
            folder_evidence(),
            folder_safety(),
            folder_identification(),
            folder_consultations(),
            folder_assistant(),
            folder_articles(),
            folder_notifications(),
            folder_analytics(),
            folder_preservation(),
            folder_audit(),
            folder_feedback(),
            folder_practitioners(),
            folder_admin(),
        ],
        "variable": [{"key": k, "value": v} for k, v in VARS],
    }

    env = {
        "id": uid(),
        "name": "HerbaCam Local",
        "values": [
            {"key": "baseUrl", "value": "http://localhost:8000", "type": "default"},
        ],
        "_postman_variable_scope": "environment",
    }

    out_dir = HERE
    with open(os.path.join(out_dir, "HerbaCam.postman_collection.json"), "w") as f:
        json.dump(collection, f, indent=2)
        f.write("\n")
    with open(os.path.join(out_dir, "HerbaCam.postman_environment.json"), "w") as f:
        json.dump(env, f, indent=2)
        f.write("\n")

    n = sum(len(fl["item"]) for fl in collection["item"])
    print("Wrote %s (%d folders, %d requests)" % (
        os.path.join(out_dir, "HerbaCam.postman_collection.json"),
        len(collection["item"]), n))
    print("Wrote %s" % os.path.join(out_dir, "HerbaCam.postman_environment.json"))


if __name__ == "__main__":
    main()
