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

- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router, Axios, Recharts, Leaflet, Lucide React
- **Backend**: Python, Django 4.2 LTS, Django REST Framework, SimpleJWT, django-cors-headers
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
| Notifications | 80 | Submission, review and identification events |
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
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
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

### For Administrators
- Manage users and roles
- Manage plants, symptoms, and knowledge
- View analytics and preservation risk
- Monitor audit logs
- Manage articles and content

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

Two checks keep that map honest — both are plain-Python and run anywhere:

```bash
python scripts/verify_endpoint_map.py --markdown docs/API_ENDPOINT_MAP.md
# backend endpoints : 82 / frontend calls : 82 / matched 1:1 : 82
# orphan endpoints  : 0   / unmatched calls : 0

python scripts/smoke_endpoints.py          # logs in as every role and calls every route
```

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
| /api/plants/admin/ | GET/POST | Curator plant management |
| /api/plants/admin/:id/ | GET/PATCH/DELETE | Curator plant management |
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
| /api/articles/admin/ · /api/articles/admin/:id/ | GET/POST · GET/PATCH/DELETE | Article management |
| /api/analytics/dashboard/ | GET | Role-aware platform statistics |
| /api/analytics/favorites/ · /add/ · /remove/ · /check/:id/ | GET · POST · GET | Favorites |
| /api/notifications/ · /unread-count/ · /:id/read/ · /mark-all-read/ | GET · POST | Notifications |
| /api/preservation/risk/ · /risk/:id/ · /risk/calculate/ | GET · GET · POST | Preservation risk |
| /api/geography/regions/ · /divisions/ · /communities/ | GET/POST | Administrative tree |
| /api/geography/regions/:id/ | GET/PATCH/DELETE | Single region |
| /api/practitioners/profile/ · /api/practitioners/list/ | GET/PATCH · GET | Practitioner profiles |
| /api/audit/ | GET | Audit trail (admin) |

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
