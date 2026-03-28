# Workforce IQ — HR Analytics Platform

AI-powered workforce intelligence platform that transforms employee lifecycle data (job histories, org structure, tenure, career progression) into actionable analytics for HR leaders, VPs, and C-Suite.

**Live:** [hr-analytics-f23c0.web.app](https://hr-analytics-f23c0.web.app) | **API Docs:** [Swagger UI](https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/docs)

![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)
![Google Cloud](https://img.shields.io/badge/Cloud%20Run-Deployed-4285F4?style=flat-square&logo=google-cloud)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=flat-square&logo=firebase)

---

## What It Does

Analyzes **2,466 employees** and **11,803 job history records** across 37 departments, 15 countries, and 869 unique job titles to surface:

- **Workforce Composition** — Headcount by department, business unit, function, grade, location, country
- **Turnover & Attrition** — Rates by every dimension, monthly trends, danger zone departments
- **Tenure Analysis** — Cohort retention curves, distribution bins, early-attrition detection
- **Flight Risk Scoring** — ML-predicted risk via LogisticRegression on career signals
- **Career Progression** — Promotion velocity, stuck employees (3yr+ same role), lateral vs upward moves
- **Manager Analytics** — Span of control, report retention scores, revolving-door flags
- **Org Structure** — Hierarchy depth, department growth/shrinkage, restructuring detection
- **AI Chatbot** — Natural language workforce queries with inline charts, navigation, and follow-up suggestions
- **Executive Reports** — LLM-generated summaries with embedded charts and recommendations

## Target Users

| Role | Example Questions |
|------|-------------------|
| **CEO** | "What's our overall attrition rate vs last year?" "Which departments are growing fastest?" |
| **VP** | "Show me turnover in my org for 4 quarters" "Who's at flight risk?" |
| **CHRO** | "Retention by location" "Succession plan for Director+ roles" |
| **HR Manager** | "Which managers have highest report turnover?" "Employees stuck 3+ years in same role?" |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI + SQLAlchemy 2.0 async + Pandas + scikit-learn |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts |
| **AI / LLM** | OpenRouter (Nemotron 120B free) for chat, OpenAI (GPT-4o) for reports |
| **Design** | CodeRabbit-inspired dark theme with glass morphism |
| **Database** | SQLite (pipeline metadata) + in-memory DataFrames (analytics) |
| **Hosting** | Google Cloud Run (backend) + Firebase Hosting (frontend) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: create .env for AI features
cat > .env << 'EOF'
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENAI_API_KEY=your-key-here
EOF

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

The backend auto-loads CSV data from `wh_Dataset/` on startup. **No API keys needed** — all analytics work without them. Chat and reports fall back to data-driven local responses.

---

## Deployment

Deployed on Google Cloud Platform:

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Firebase Hosting | [hr-analytics-f23c0.web.app](https://hr-analytics-f23c0.web.app) |
| Backend | Cloud Run (us-central1) | [hr-analytics-backend-ymez3d52nq-uc.a.run.app](https://hr-analytics-backend-ymez3d52nq-uc.a.run.app) |
| API Docs | Swagger UI | [/docs](https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/docs) |

### Deploy Script

```bash
# Prerequisites: gcloud CLI + firebase CLI, both authenticated
# gcloud config set project hr-analytics-f23c0

bash deploy.sh
```

The script:
1. Builds and deploys the backend to Cloud Run (from Dockerfile)
2. Writes the Cloud Run URL into `frontend/.env.production`
3. Builds the frontend with Vite
4. Deploys to Firebase Hosting

---

## Pages (14 total)

| Page | Route | Key Features |
|------|-------|-------------|
| **Dashboard** | `/` | 4 KPI cards, headcount trend, two-color turnover chart, tenure distribution, flight risk table |
| **Workforce** | `/workforce` | Headcount by 8 dimensions (dept, BU, function, grade, location, country), active vs departed |
| **Turnover** | `/turnover` | Attrition rates by dimension, monthly trends, danger zones, tenure-at-departure |
| **Tenure** | `/tenure` | Cohorts (0-6mo through 10yr+), retention curves, long-tenured employees list |
| **Flight Risk** | `/flight-risk` | ML risk scores, feature importance, top watchlist, risk by department |
| **Careers** | `/careers` | Promotion velocity, stuck employees (3yr+ same role), lateral vs upward moves |
| **Managers** | `/managers` | Span of control, report retention scores, revolving-door detection |
| **Org Structure** | `/org` | Hierarchy depth, department growth/shrinkage, restructuring events |
| **AI Insights** | `/insights` | Auto-generated taxonomy, grade/function/job family classification |
| **Pipeline Hub** | `/pipeline` | Run management, log streaming, artifact downloads |
| **Upload** | `/upload` | Drag-and-drop CSV, column validation, processing status |
| **Reports** | `/reports` | LLM executive summary with embedded charts, metric cards, recommendations |
| **Settings** | `/settings` | LLM provider/model switching, user profile, company branding |

---

## AI Assistant (Fire Orb)

A persistent slide-out AI panel accessible from every page:

- **Fire Orb** — CSS-animated orb trigger (bottom-right), replaces static images
- **420px slide-out panel** that compresses main content (doesn't obscure)
- **Deep analysis engine** — 16 data sections injected as context per query:
  - Department stats (6 metrics each), flight risk top 10, manager metrics
  - Career mobility, grade distributions, tenure bins, country/function breakdowns
  - Hire cohort retention, manager retention analysis, cross-metric correlations
  - Anomaly detection (100% churn depts, early attrition, no recent hires)
- **Navigation agent** — AI can route you to pages via "show me turnover" / "take me to careers"
- **Multi-turn conversations** (6-turn history)
- **Inline charts** rendered in AI messages
- **Follow-up suggestion pills** parsed from AI response
- **Proactive anomaly alerts** on app load
- **Chart-click integration** — click any chart element to auto-ask the AI about it
- **Onboarding tour** — first-time welcome with guided exploration

### LLM Configuration

| Feature | Provider | Model |
|---------|----------|-------|
| Chat | OpenRouter (default) | nvidia/nemotron-3-super-120b-a12b:free |
| Reports | OpenAI (always) | gpt-4o |
| Fallback | Local | Data-driven pattern matching (no API key needed) |

Switch models at runtime via **Settings > AI / LLM Configuration**, or via API:

```bash
curl -X POST https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/api/settings/llm \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek/deepseek-chat-v3-0324:free"}'
```

Available free models via OpenRouter:
- `nvidia/nemotron-3-super-120b-a12b:free` (default)
- `meta-llama/llama-3.3-8b-instruct:free`
- `deepseek/deepseek-chat-v3-0324:free`
- `google/gemini-2.0-flash-exp:free`
- `qwen/qwen3-235b-a22b:free`

---

## API Endpoints (90+)

| Route | Endpoints | Purpose |
|-------|-----------|---------|
| `/api/workforce/*` | 16 | Headcount by dept/BU/function/location/grade, trends, pyramid |
| `/api/turnover/*` | 11 | Attrition rates, trends, danger zones, tenure-at-departure |
| `/api/tenure/*` | 8 | Cohorts, distribution (7 bins), retention curves, median |
| `/api/careers/*` | 6 | Promotion velocity, stuck employees, career paths |
| `/api/managers/*` | 6 | Span of control, retention scores, revolving doors |
| `/api/org/*` | 6 | Hierarchy depth, department sizes, restructuring |
| `/api/predictions/*` | 4 | Flight risk ML scores, feature importance |
| `/api/chat/*` | 1 | AI chatbot with deep analysis + navigation |
| `/api/reports/*` | 3 | Executive summary, structured reports, export |
| `/api/settings/*` | 2 | GET/POST LLM config, runtime model switching |
| `/api/upload/*` | 3 | CSV upload, validation, taxonomy trigger |
| `/api/taxonomy/*` | 6 | Job family classification, grade mapping |
| `/api/pipeline/*` | 11 | Pipeline run management, logs, artifacts |
| `/ws/*` | 2 | WebSocket endpoints for real-time updates |

---

## Data Source

Three CSV files in `wh_Dataset/`:

| File | Rows | Columns | Purpose |
|------|------|---------|---------|
| `function_wh.csv` | 2,466 | 14 | Employee master — hire/expire dates, job title, grade, department, location, country |
| `wh_history_full.csv` | 11,803 | 5 | Job change history (~4.8 records/person) with manager hierarchy |
| `wh_user_history_v2.csv` | 100 | 6 | Enriched subset with position titles |

**Join key:** `PK_PERSON` = `pk_user` | **Manager hierarchy:** `fk_direct_manager` self-references `pk_user`

### Key Stats
- Total: 2,466 | Active: 1,110 (45%) | Departed: 1,356 (55%)
- Turnover rate: 55.0% | Avg tenure: 5.5yr | Median: 2.6yr
- 37 departments | 15 countries | 25 grades | 151 functions | 869 job titles
- 222 managers | Avg span: 2.92 | Max span: 13
- 3,297 career moves classified

### Data Pipeline
On startup or CSV upload:
1. Load all 3 CSVs, parse dates
2. Join on `PK_PERSON` = `pk_user`
3. Compute per-employee: `is_active`, `tenure_days`, `current_role`, `num_role_changes`, `time_in_current_role`, `manager_changes_count`, `has_been_promoted`
4. Taxonomy classification (rule-based): job families, grade levels, career move types
5. Cache processed DataFrames in memory

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `LLM_PROVIDER` | No | `openrouter` | `openrouter` or `openai` |
| `OPENROUTER_API_KEY` | For AI chat | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `nvidia/nemotron-3-super-120b-a12b:free` | Chat model |
| `OPENAI_API_KEY` | For AI reports | — | OpenAI API key (GPT-4o for reports) |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI fallback model |
| `DATA_DIR` | No | `wh_Dataset/` | CSV data directory path |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./hr_platform.db` | SQLite for metadata |
| `SENTRY_DSN` | No | — | Error monitoring |

**Without any API key:** All analytics, charts, and pages work fully. Chat and reports use intelligent data-driven local fallbacks.

---

## Design System

CodeRabbit-inspired premium dark theme:

- **Glass morphism** panels with `backdrop-filter: blur(20px)`
- **Orange accent** (`#FF8A4C`) with emerald, purple, rose, amber supporting colors
- **Animated counters** with staggered fade-up entrance animations
- **Custom Recharts tooltips** with glass styling
- **shadcn/ui** components (v4.1) for new features alongside existing custom components
- **CSS Fire Orb** — pure CSS animated AI identity (radial gradients + keyframe animations)
- See [`docs/design-system.md`](docs/design-system.md) for full token reference

---

## Architecture

```
backend/
  app/
    main.py              # FastAPI with async lifespan
    config.py            # Pydantic settings (.env)
    llm.py               # Unified LLM client (OpenRouter + OpenAI)
    data_loader.py       # CSV loading → joining → enrichment → cache
    taxonomy.py          # Deterministic job/grade/career classifier
    database.py          # SQLAlchemy async + SQLite
    routers/             # 14 route modules (workforce, turnover, chat, etc.)
    services/            # Pipeline runners, auth, scheduler, WebSocket
  wh_Dataset/            # CSV data files
  Dockerfile             # Python 3.11-slim, uvicorn on PORT
  requirements.txt

frontend/
  src/
    pages/               # 14 page components
    components/
      ui/                # Panel, KpiCard, Badge, PageHero, AnimatedNumber, etc.
      layout/            # Sidebar, AmbientBackground
      charts/            # ChartTooltip
      chat/              # ChatTrigger (fire orb), ChatPanel (slide-out)
    hooks/               # useWorkforce, useTurnover, etc.
    lib/                 # API client (axios), utilities
    types/               # TypeScript interfaces

deploy.sh                # One-command deploy (Cloud Run + Firebase)
firebase.json            # Firebase Hosting config (SPA rewrites)
```

### Key Architectural Decisions
1. **CSV → Pandas → in-memory cache** — no SQL for analytics, SQLite only for pipeline metadata
2. **Unified LLM client** (`llm.py`) — single source of truth for all AI calls
3. **Deep context, not RAG** — pre-compute 16 data sections per chat query (no vector DB needed)
4. **Local fallback everywhere** — chat, reports, pipeline all work without API keys
5. **Fire orb side panel** — AI is always-present, not a navigation destination
6. **Deterministic taxonomy** — rule-based classification, not LLM-dependent
7. **Multi-turn via history** — last 6 turns sent in API call, no server-side sessions

---

## License

Private repository.
