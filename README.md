# HerbaCam

**AI-Powered Web Application for the Identification, Recommendation, and Preservation of Cameroonian Traditional Medicinal Plant Knowledge**

## Architecture

```
Users (Browser)
      │
      ▼
React Frontend (Vite, Tailwind CSS, React Router)
      │
      │ Axios (JWT Bearer tokens)
      ▼
Django REST API (DRF, JWT Auth)
      │
      ├────────────┐
      │            │
      ▼            ▼
    SQLite     OpenRouter
   (MySQL      (Vision AI)
    ready)
```

Django is the central controller. The AI never directly accesses the database. The frontend never directly accesses OpenRouter.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router v7, Axios, Recharts, Leaflet, Lucide React
- **Backend**: Python, Django 4.2 LTS, Django REST Framework, SimpleJWT, django-cors-headers
- **Realtime**: browser WebRTC (peer-to-peer media) with Django relaying the handshake over the message thread
- **Database**: MySQL 5.7+ / MariaDB 10.4+ (default for this project) / SQLite (fallback for local dev when no MySQL is configured)
- **AI**: OpenRouter API with vision-capable models

## Quick Start

### Backend

1. Copy `.env.example` to `.env` and fill in your MySQL credentials:
```bash
cp .env.example .env
```

2. Install dependencies and run the database:
```bash
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data --clear   # Load demo data + copy plant images into backend/media/
python manage.py runserver 0.0.0.0:8000
```

`backend/media/` is not tracked by git. `seed_data` populates it from the demo images in
`frontend/src/assets/plants/`, so run it after cloning or plant images will 404.

> Note: `mysqlclient` is the recommended production driver, but the included `PyMySQL` fallback
> lets the backend connect to MySQL on Windows/common dev machines without build tools.

> Note: the project targets Django 4.2 LTS so it runs against MariaDB 10.4 (as shipped with
> XAMPP/WAMP). Django 5 requires MariaDB 10.11+ or MySQL 8.0.11+.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173

## Demo Accounts

All demo accounts share the password pattern below; every role has several
accounts so notifications, reviews and audit history have realistic actors.

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin`, `nadege` | `admin123!` |
| Expert | `drnkeng`, `dretoundi`, `profeyong` | `expert123!` |
| Practitioner | `mbaforc`, `talla_e`, `njikam_a`, `awah_p`, `bongfen_r` | `pract123!` |
| User | `demo_user` (+ 5 more) | `user1234!` |

### Demo dataset

`python manage.py seed_data --clear` builds a complete, deterministic dataset
(seeded with `random.Random(20260828)`, timestamps back-dated over ~3 years):

| Entity | Count | Notes |
| --- | --- | --- |
| Users | 16 | 2 admins, 3 experts, 6 practitioners, 5 users |
| Plants | 32 | With local names, parts, regions, images |
| Symptoms | 32 | Across 16 categories |
| Traditional uses | 109 | Every plant/region combination referenced |
| Evidence records | 45 | INSUFFICIENT → STRONG |
| Safety records | 32 | LOW / MODERATE / HIGH |
| Knowledge submissions | 29 | Every workflow status, incl. rejected and in-revision |
| AI identifications | 42 | COMPLETED / PROCESSING / FAILED |
| Favorites | 45 | Spread across users |
| Notifications | 80 | Submission, review, identification, booking and message events |
| Availability windows | ~14 | Future-dated per expert, about half booked |
| Appointments / thread messages | 7 / 20 | Every consultation status represented |
| Feedback notes | 8 | Across 5 categories, some answered and resolved |
| Assistant conversations | 12 | Demo transcripts (not live model output) |
| Risk assessments | 42 | LOW / MODERATE / HIGH with component scores |
| Audit log entries | 148+ | Logins, reviews, admin actions |
| Regions / divisions / communities | 10 / 40 / 120 | The real Cameroonian administrative tree |
| Articles | 14 | Published and draft, across 6 categories |

Always pass `--clear`: the seeder is idempotent only when it starts from an
empty database.

## Environment Variables

### Backend (.env)
```
SECRET_KEY=your-secret-key
DEBUG=True
DB_ENGINE=mysql
DB_NAME=herbacam
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_HOST=127.0.0.1
DB_PORT=3306
# DATABASE_URL=mysql://root:your-mysql-password@127.0.0.1:3306/herbacam
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=google/gemini-3.8-flash
```

### Frontend (.env)
```
VITE_API_URL=/api
```

## Features

### For All Visitors
- Browse medicinal plants with search and filtering
- Search by symptom to find traditionally associated plants
- View plant details with traditional uses, evidence, and safety
- See traditionally reported dosage (amount, frequency, duration, how to take it) on every verified use
- Read educational articles
- AI-powered plant identification (login required)

### For Registered Users
- Upload plant images for AI identification
- View identification history
- Save favorite plants
- Search by symptoms
- Manage profile

### For Traditional Medicine Practitioners
- Submit traditional knowledge contributions
- Track submission status through verification workflow
- Edit and resubmit rejected contributions

### For Experts/Reviewers
- Review pending knowledge submissions
- Approve, reject, or request revisions
- Manage evidence records
- Manage safety information
- Manage plant information — add a species, edit or publish one, withdraw it
- Manage articles for the public reading room (drafts stay invisible to readers)

### For Administrators
- Manage users and roles
- Manage plants, symptoms, and knowledge — plant and article curation is shared
  with experts, but the symptom vocabulary is administrator-only, because
  renaming a symptom relabels every contribution that already matched on it
- View analytics and preservation risk
- Monitor audit logs
- Manage articles and content
- Oversee every consultation and its utilisation stats
- Triage user feedback and reply to it (the author is notified)

### Consultations between patients and specialists
- Specialists publish availability windows; overlapping or past windows are refused
- Patients book an open window and state what they want to discuss
- Specialists confirm, complete (with a closing note) or mark a no-show
- Cancelling or completing returns the window to the pool automatically
- Each appointment carries one messaging thread, visible only to its two participants
- The thread doubles as the WebRTC signalling channel, so a video consultation
  runs peer-to-peer with no third-party room service
- Administrators see all consultations and platform-wide booking stats

### AI assistant
- Multi-turn chat grounded in an extract Django assembles from verified records
- Every answer links the plants it cited; dosage text is only ever copied from a
  record, never generated
- A failed provider call rolls the turn back instead of leaving a dangling question

## Knowledge Verification Workflow

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED
                          ↓
                       REJECTED → RESUBMISSION
                          ↓
                  REVISION_REQUESTED → RESUBMISSION
```

## Preservation Risk Calculation

The risk score (0-100) is calculated from five component scores (0-20 each):

1. **Contributor Scarcity** — Fewer contributors = higher risk
2. **Knowledge Recency** — Older contributions = higher risk  
3. **Geographic Concentration** — More concentrated = higher risk
4. **Documentation Scarcity** — Fewer documented uses = higher risk
5. **Submission Decline** — Declining submissions = higher risk

**Risk Levels:**
- LOW: 0-33
- MODERATE: 34-66
- HIGH: 67-100

*Note: This is an analytical indicator for prioritizing documentation, not a scientific prediction.*

## API Endpoints

The full, generated **API ↔ frontend map** lives in
[`docs/API_ENDPOINT_MAP.md`](docs/API_ENDPOINT_MAP.md): every backend route,
the axios binding that calls it, and the page that uses it.

Four plain-Python checks and one Node check keep that map honest. Three of them
need a running server — start both dev servers first, since the Vite proxy is
what puts `/api` in reach:

```bash
python scripts/verify_endpoint_map.py --markdown docs/API_ENDPOINT_MAP.md
# backend endpoints : 113 / frontend calls : 113 / matched 1:1 : 113
# orphan endpoints  : 0   / unmatched calls : 0

python scripts/smoke_endpoints.py          # logs in as every role and calls every route
python scripts/e2e_consultations.py        # walks the whole booking → room → message flow
python scripts/e2e_content_curation.py     # proves who may write plants and articles, and who may not
cd frontend && npm run smoke:ssr           # renders every page under Vite SSR
```

`npm run smoke:ssr` exists because a bundler will not catch a free identifier
(`<Leaf>` with no import is not a module-resolution error), so the build passes
and the page white-screens. The SSR harness actually executes the components.

Highlights:

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/login/ | POST | JWT Login |
| /api/auth/register/ | POST | User registration |
| /api/auth/profile/ | GET/PATCH | User profile (PATCH only — no PUT) |
| /api/auth/settings/ | GET/PUT | Non-secret system settings (admin) |
| /api/auth/users/:id/ | GET/PATCH | Admin user management |
| /api/plants/ | GET | List published plants |
| /api/plants/search/ | GET | Filter by region, habitat, family, part, evidence |
| /api/plants/:id/ | GET | Plant detail |
| /api/plants/admin/ | GET/POST | Plant management — expert or admin |
| /api/plants/admin/:id/ | GET/PATCH/DELETE | Plant management — expert or admin |
| /api/symptoms/ · /api/symptoms/:id/ | GET | Symptom index and detail |
| /api/symptoms/search/?q= | GET | Symptom search |
| /api/symptoms/admin/ · /api/symptoms/admin/:id/ | GET/POST · GET/PATCH/DELETE | Curator symptom management |
| /api/identification/identify/ | POST | AI identification |
| /api/identification/history/ | GET | ID history |
| /api/identification/:id/ | GET | Single identification |
| /api/identification/:id/delete/ · /report/ | DELETE · POST | Remove or dispute a result |
| /api/knowledge/submissions/ | GET | Submissions |
| /api/knowledge/submissions/create/ | POST | New submission |
| /api/knowledge/submissions/pending/ | GET | Expert review queue |
| /api/knowledge/submissions/:id/ | GET/PATCH | Detail / practitioner edit & resubmit |
| /api/knowledge/submissions/:id/review/ | POST | approve · reject · request_revision |
| /api/knowledge/traditional-uses/ | GET | Traditional uses |
| /api/knowledge/preparation-methods/ | GET | Preparation vocabulary |
| /api/evidence/ · /api/evidence/create/ · /api/evidence/:id/update/ | GET · POST · PATCH | Evidence records |
| /api/safety/ · /api/safety/create/ · /api/safety/:id/update/ | GET · POST · PATCH | Safety records |
| /api/articles/ · /api/articles/:slug/ · /api/articles/categories/ | GET | Reading room |
| /api/articles/admin/ · /api/articles/admin/:id/ | GET/POST · GET/PATCH/DELETE | Article management — expert or admin |
| /api/analytics/dashboard/ | GET | Role-aware platform statistics |
| /api/analytics/favorites/ · /add/ · /remove/ · /check/:id/ | GET · POST · GET | Favorites |
| /api/notifications/ · /unread-count/ · /:id/read/ · /mark-all-read/ | GET · POST | Notifications |
| /api/preservation/risk/ · /risk/:id/ · /risk/calculate/ | GET · GET · POST | Preservation risk |
| /api/geography/regions/ · /divisions/ · /communities/ | GET/POST | Administrative tree |
| /api/geography/regions/:id/ | GET/PATCH/DELETE | Single region |
| /api/practitioners/profile/ · /api/practitioners/list/ | GET/PATCH · GET | Practitioner profiles |
| /api/audit/ | GET | Audit trail (admin) |
| /api/consultations/availability/ | GET/POST | Specialist's own windows |
| /api/consultations/availability/:id/ | GET/PATCH/DELETE | One window (owner or admin) |
| /api/consultations/slots/ | GET | Open windows patients may book |
| /api/consultations/appointments/ | GET | Role-scoped appointments |
| /api/consultations/appointments/book/ | POST | Book a window (row-locked) |
| /api/consultations/appointments/:id/ | GET/PATCH | Detail / reason and notes |
| /api/consultations/appointments/:id/status/ | POST | confirm · cancel · complete · no_show |
| /api/consultations/appointments/:id/start/ | POST | Join the room, returns room id |
| /api/consultations/conversations/ | GET | Threads the caller is part of |
| /api/consultations/conversations/:id/messages/ | GET/POST | Read thread / post a line |
| /api/consultations/conversations/:id/signal/ | GET/POST | WebRTC offer/answer/ICE relay |
| /api/consultations/conversations/:id/read/ | POST | Mark the thread read |
| /api/consultations/stats/ | GET | Consultation oversight (admin) |
| /api/assistant/ | GET/POST | Chat sessions |
| /api/assistant/ask/ | POST | One grounded turn (throttled 60/hour) |
| /api/assistant/:id/ · /messages/ · /archive/ | GET/DELETE · GET · PATCH | Transcript control |
| /api/feedback/send/ | POST | Any user sends feedback |
| /api/feedback/ · /:id/ | GET · GET/PATCH | Triage queue and replies (admin) |
| /api/geography/locate/?lat=&lng= | GET | Nearest region for browser coordinates |

## Interface conventions

The UI was built so that every action gives feedback and every transition is
animated:

- **Toasts** (`useToast()`) — success, error, warning, info and loading states
  for every mutation, plus automatic reporting of unhandled API failures
  (network loss, 5xx, 429) from the axios layer.
- **Confirmations** (`useConfirm()`) — destructive and role-changing actions ask
  through an animated dialog instead of `window.confirm`.
- **Motion** (`components/ui/motion.jsx`) — route transitions on every page,
  scroll-reveal for cards and rows, animated KPI counters, skeleton shimmer
  while loading, and hover/press states on interactive elements.
- **Empty and error states** — every list explains what is missing and offers a
  retry or a shortcut to create the first record.

## Important Disclaimers

- This is an **educational and informational platform**
- It is **NOT** a replacement for professional medical diagnosis or treatment
- Traditional knowledge is presented as documented cultural information
- AI identification is **probabilistic** and should not be considered absolute certainty
- All demo/sample data is clearly labeled as such
