# HerbaCam — Postman API Test Suite

A ready-to-run Postman collection that exercises **every endpoint** in
`backend/*/urls.py` (the 119 routes documented in
[`docs/API_ENDPOINT_MAP.md`](../docs/API_ENDPOINT_MAP.md)) with assertions on
status codes and key response fields, including negative tests for the
400 / 401 / 403 / 404 contracts.

## Files

| File | Purpose |
| --- | --- |
| `HerbaCam.postman_collection.json` | The test collection (18 folders, 188 requests, ~298 assertions) |
| `HerbaCam.postman_environment.json` | Environment with `baseUrl` |
| `generate_collection.py` | Regenerates the collection + environment (`python3 postman/generate_collection.py`) |
| `sample-plant.jpg` | Sample image used by the `Identify plant (image upload)` request (form-data) |
| `screenshots/` | Screenshots of the suite in Postman (collection view + green run) |

## Requirements

1. The backend must be running with demo data:

   ```bash
   cd backend
   python manage.py migrate
   python manage.py seed_data --clear
   python manage.py runserver 0.0.0.0:8000
   ```

2. Demo accounts (also collection variables, so you can override them):

   | Role | Username | Password |
   | --- | --- | --- |
   | Admin | `admin` | `admin123!` |
   | Expert | `drnkeng` | `expert123!` |
   | Practitioner | `mbaforc` | `pract123!` |
   | User | `demo_user` | `user1234!` |

## How to run

1. Import `HerbaCam.postman_collection.json` and
   `HerbaCam.postman_environment.json` into Postman (or point the `baseUrl`
   collection variable at your server — e.g. `http://localhost:8000`).
2. Select the **HerbaCam Local** environment.
3. Run the collection top-to-bottom (right-click the collection → *Run
   collection*), or run folder by folder in order. **Folder 0 must run first**:
   it registers a throwaway user and logs in as all four demo roles, storing
   the JWTs in collection variables (`admin_token`, `expert_token`,
   `practitioner_token`, `user_token`, `newuser_token`) that every later
   request uses.
4. Expected result: **188 requests, 298 assertions, 0 failures.**

Or run headlessly with [Newman](https://github.com/postmanlabs/newman):

```bash
newman run postman/HerbaCam.postman_collection.json \
         -e postman/HerbaCam.postman_environment.json
```

## What the suite covers

- **Auth & users** — registration (including password-mismatch and admin-role
  rejections), login, token refresh, profile read/update, password change,
  admin user management, system settings.
- **Geography / symptoms / plants** — public catalogue, search & filters,
  admin-only CRUD (including the *unpublished plants are hidden from the
  public* 404 contract).
- **Knowledge workflow** — draft → submit → request revision → reject →
  resubmit → approve; approval publishes a verified traditional use, which the
  suite then re-fetches publicly.
- **Evidence / safety** — public reads, expert-only writes.
- **Identification** — multipart image upload, history, detail, report,
  delete, plus the no-auth 401 contract.
- **Consultations** — the full lifecycle: publish an availability window
  (overlap refusal included), patient books from the public slot list
  (double-book refusal), confirm, consultation notes, start (WebRTC room +
  ICE servers), reschedule (patient moves go back to *pending*), booked-window
  delete refusal, complete, chat messages, WebRTC signalling relay, thread
  read marks, specialist directory (filter + distance sort), verification by
  admin, consultation stats.
- **Assistant** — sessions, transcript, archive, delete, and the `ask`
  endpoint (see AI note below).
- **Articles** — public reading room, categories, draft → publish → public
  visibility, cleanup.
- **Notifications, analytics & favorites, preservation, audit, feedback,
  practitioners, admin & system** — role-gated reads/writes and the 401/403
  contracts for each.

The suite is **repeatable**: every run generates unique usernames, slugs and
window times, cleans up the records it creates, and never modifies the seeded
demo accounts (the password-change test uses a freshly registered user).

## Note on the AI endpoints

`Identify plant (image upload)` and `Ask the assistant` call OpenRouter.
When the backend `.env` has a valid `OPENROUTER_API_KEY` they assert the
success contract (201 with results / a persisted reply). Without a key they
assert the **failure contract** instead (503 / 502 with an error message) —
so the suite is green in both configurations.
