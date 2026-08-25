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
- **Backend**: Python, Django 5, Django REST Framework, SimpleJWT, django-cors-headers
- **Database**: SQLite (dev) / MySQL (production ready)
- **AI**: OpenRouter API with vision-capable models

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data   # Load demo data + copy plant images into backend/media/
python manage.py runserver 0.0.0.0:8000
```

`backend/media/` is not tracked by git. `seed_data` populates it from the demo images in
`frontend/src/assets/plants/`, so run it after cloning or plant images will 404.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173

## Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123! |
| Expert | drnkeng | expert123! |
| Practitioner | mbaforc | pract123! |
| User | demo_user | user1234! |

## Environment Variables

### Backend (.env)
```
SECRET_KEY=your-secret-key
DEBUG=True
DB_ENGINE=sqlite3    # or 'mysql'
DB_NAME=herbacam
DB_USER=root
DB_PASSWORD=password
DB_HOST=127.0.0.1
DB_PORT=3306
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

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/login/ | POST | JWT Login |
| /api/auth/register/ | POST | User registration |
| /api/auth/profile/ | GET/PATCH | User profile |
| /api/plants/ | GET | List plants |
| /api/plants/:id/ | GET | Plant detail |
| /api/symptoms/ | GET | List symptoms |
| /api/symptoms/search/?q= | GET | Symptom search |
| /api/identification/identify/ | POST | AI identification |
| /api/identification/history/ | GET | ID history |
| /api/knowledge/submissions/ | GET | Submissions |
| /api/knowledge/submissions/create/ | POST | New submission |
| /api/knowledge/submissions/:id/review/ | POST | Review |
| /api/knowledge/traditional-uses/ | GET | Traditional uses |
| /api/evidence/ | GET | Evidence records |
| /api/safety/ | GET | Safety info |
| /api/articles/ | GET | Articles |
| /api/analytics/favorites/ | GET | Favorites |
| /api/notifications/ | GET | Notifications |
| /api/preservation/risk/ | GET | Risk assessments |
| /api/geography/regions/ | GET | Regions |

## Important Disclaimers

- This is an **educational and informational platform**
- It is **NOT** a replacement for professional medical diagnosis or treatment
- Traditional knowledge is presented as documented cultural information
- AI identification is **probabilistic** and should not be considered absolute certainty
- All demo/sample data is clearly labeled as such
