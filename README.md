# Workforce IQ — Executive Workforce Intelligence Platform

**Bloomberg for HR data.** AI-powered workforce analytics platform that transforms employee lifecycle data into actionable intelligence for C-suite executives, VPs, and HR leaders.

Transform raw employee data (headcount, job history, org structure) into strategic workforce insights: turnover prediction, flight risk scoring, career progression analysis, and manager effectiveness metrics.

**Status:** Production-ready for local testing | **Backend:** Port 8119 | **Frontend:** Port 3000 | **Data:** 2,466 employees, 11,803 career moves, 1,000 recognition awards

---

## The Problem

HR teams have **fragmented data** across multiple systems — hiring dates, org charts, job history, turnover — but **no unified intelligence layer**. Executives can't answer critical questions:

- "What's our actual turnover rate by department?"
- "Which employees are at flight risk?"
- "Who's been stuck in the same role for 3+ years?"
- "Are our best managers retaining their teams?"
- "Where are promotion bottlenecks?"

**Workforce IQ solves this** by unifying employee lifecycle data and computing executive-grade KPIs in real-time.

---

## What It Does

### Core Analytics
- **Headcount & Composition** — Active vs departed, trends, breakdowns by department/grade/location/function
- **Turnover & Attrition** — Rates by every dimension, danger zones, tenure-at-departure patterns
- **Tenure Analysis** — Distribution by cohorts (0-1yr, 1-3yr, 3-5yr, 5-10yr, 10yr+), retention curves
- **Flight Risk** — ML-predicted risk scores (LogisticRegression on tenure, role changes, manager turnover)
- **Career Progression** — Promotion velocity, career paths, "stuck" employee detection, grade advancement trends
- **Manager Analytics** — Span of control distribution, team retention rates, revolving-door managers
- **Org Structure** — Hierarchy depth, department growth/shrinkage, restructuring detection

### Intelligence Layer
- **AI Chatbot** — Natural language queries ("How many employees in Sales?", "Show me turnover trends")
- **Knowledge Base** — ChromaDB semantic search over workforce metrics
- **Memory System** — Persistent user context and saved queries

### Data Integration
- **CSV Upload** — Drop function_wh.csv + wh_history_full.csv for instant loading
- **Auto-Taxonomy** — LLM classification of job titles → families (Engineering, Sales, Finance, etc.)
- **Real-time Refresh** — Pipeline triggers on data upload, rebuilds all analytics

---

## Quick Start (5 Minutes)

### 1. Backend (Port 8119)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8119
```

Backend auto-loads data from `wh_Dataset/` if it exists. Look for:
```
✓ Workforce data loaded: 2,466 employees
✓ Career moves classified: 3,297 moves
✓ Knowledge base built: 25+ documents
✓ Application startup complete
```

### 2. Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** → Click fire orb (bottom right) → Chat with your data.

### 3. Test Chat
Try:
- "How many employees do we have?"
- "What's our turnover rate?"
- "Show me headcount by department"

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI 0.121 + Pandas + SQLAlchemy 2.0 async + SQLite |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| **AI/LLM** | LangGraph agent + ChromaDB vector DB + OpenAI/OpenRouter |
| **Analytics** | scikit-learn (ML flight risk) + numpy + pandas |
| **Design** | Premium dark theme, glass morphism, orange accent (#FF8A4C) |
| **Deployment** | Docker + docker-compose (local), Cloud Run + Firebase (production) |

---

## Architecture

```
┌─────────────────┐
│   React 18      │
│   (Port 3000)   │
└────────┬────────┘
         │ HTTP
┌────────▼────────┐
│   FastAPI       │
│  (Port 8119)    │ ◄─ /api/chat, /api/workforce, /api/turnover, etc.
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │          │          │          │
┌───▼──┐ ┌───▼──┐ ┌───▼──┐ ┌───▼──┐
│ Data │ │Analytics│ChromaDB│Memory │
│Cache │ │Engine │ (KB)  │  DB   │
└──────┘ └──────┘ └──────┘ └──────┘
```

**Data Flow:**
1. User uploads CSV → Pipeline processes → Data cached in memory
2. Chat message received → Analytics engine queries cache → Returns structured KPIs
3. Frontend renders response → Word-by-word animation effect

---

## Data Schema

### Employee Master (`function_wh.csv`)
2,466 rows, 13 columns
- `PK_PERSON`: Unique employee ID
- `Hire`, `Expire`: Employment dates
- `job_title`, `grade_title`, `position_title`: Role levels
- `department_name`, `function_title`: Org structure
- `location_title`, `country`: Geography
- Derived: `is_active`, `tenure_years`, `current_manager_id`

### Career History (`wh_history_full.csv`)
11,803 rows, 5 columns
- `pk_user`: Employee ID
- `job_title`: Title at this date
- `effective_start_date`, `effective_end_date`: Date range
- `fk_direct_manager`: Manager in this role
- Derived: `promotion`, `lateral_transfer`, `demotion`, `restructure` (via LLM)

### Recognition (`mockup_awards.csv`)
1,000 rows, recognition messages with behavioral taxonomy

---

## API Endpoints

| Category | Count | Examples |
|----------|-------|----------|
| **Chat** | 1 | `POST /api/chat` — Natural language queries |
| **Workforce** | 8+ | Headcount by dept/grade/location/function |
| **Turnover** | 6+ | Attrition rates, trends, danger zones |
| **Tenure** | 5+ | Cohorts, distribution, retention |
| **Careers** | 5+ | Promotion velocity, stuck employees |
| **Managers** | 5+ | Span of control, retention, revolving doors |
| **Predictions** | 3+ | Flight risk scores, model metadata |
| **Admin** | 6+ | Upload, reload, settings, health |

**Base URL:** `http://localhost:8119/api`

Full API docs: Start backend, then visit `http://localhost:8119/docs`

---

## Performance

In-memory caching + GZip compression:
- Analytics queries: **<10ms** (cached)
- Chat responses: **<500ms** (analytics + formatting)
- Frontend load: **<2s** (gzipped)

---

## Deployment (Production)

### Docker
```bash
docker-compose up
```

Starts:
- Backend on `http://localhost:8119`
- Frontend on `http://localhost:3000`

### Cloud (AWS/Google Cloud/Azure)
See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Cloud Run setup (backend)
- Firebase/Netlify (frontend)
- Database migration (PostgreSQL)
- Environment configuration

---

## Docs

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](./QUICKSTART.md) | 30-second and 5-minute setup guides |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment instructions |
| [RUN_ON_8119.md](./RUN_ON_8119.md) | Local testing on port 8119 |
| [CLAUDE.md](./CLAUDE.md) | Project scope and constraints |
| [docs/design-system.md](./docs/design-system.md) | UI/UX guidelines |

---

## Team

**Chirag Verma** — Full-stack, product vision
- LinkedIn: [linkedin.com/in/vkin](https://linkedin.com/in/vkin/)
- Email: verma.ch@northeastern.edu

**Kashyap Akula** — Design & product
- LinkedIn: [linkedin.com/in/kashyap-akula-804937210](https://linkedin.com/in/kashyap-akula-804937210/)

Built as **MS Capstone (IE 7945)** at Northeastern University, Spring 2026.

---

## License

Proprietary. Contact for licensing inquiries.

---

## Next Steps

1. **Explore the data** — Use the chat to ask questions about your workforce
2. **Build analytics pages** — Workforce Composition, Turnover Analysis, Career Progression
3. **Connect your data** — Upload real employee CSVs
4. **Deploy to production** — Follow DEPLOYMENT.md

Questions? Check [QUICKSTART.md](./QUICKSTART.md) or [DEPLOYMENT.md](./DEPLOYMENT.md).
