# Workforce IQ — Recognition Intelligence Platform

AI-powered employee recognition analytics platform that transforms unanalyzed peer-to-peer recognition messages into executive-grade behavioral intelligence. Built as an MS Capstone project (IE 7945) at Northeastern University in partnership with **Workhuman**.

**Live:** [hr-analytics-f23c0.web.app](https://hr-analytics-f23c0.web.app) | **App:** [/app](https://hr-analytics-f23c0.web.app/app) | **API:** [Swagger Docs](https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/docs) | **GitHub:** [vkinnnnn/HR-ANALYTICS](https://github.com/vkinnnnn/HR-ANALYTICS)

![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=three.js)
![Google Cloud](https://img.shields.io/badge/Cloud%20Run-Deployed-4285F4?style=flat-square&logo=google-cloud)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=flat-square&logo=firebase)

---

## What It Does

Analyzes **1,000 peer-to-peer recognition awards** from Workhuman's platform using LLM taxonomy classification, NLP quality scoring, and social network analysis — plus **2,466 employee workforce records** for turnover, tenure, and career analytics.

### Recognition Intelligence (Primary)
- **Behavioral Taxonomy** — 4 categories, 25 subcategories classified via LLM grounded theory
- **Inequality Analytics** — Gini coefficient (0.463), Lorenz curves, power law distribution
- **NLP Message Quality** — Specificity scoring, action verb detection, cliche analysis
- **Recognition Flow** — Cross-function heatmaps, seniority direction analysis, reciprocal pairs
- **Social Network** — PageRank, hub scores, isolated roles, cross-functional bridges
- **Nominator Effectiveness** — Composite scoring (volume + specificity + diversity + breadth)
- **Fairness Audit** — Specificity gaps by function and seniority level

### Workforce Analytics (Secondary)
- **Turnover & Attrition** — Rates by department/grade/location, danger zones, trends
- **Tenure Analysis** — Cohort retention, distribution bins, early-attrition detection
- **Flight Risk** — ML-predicted scores via LogisticRegression on career signals
- **Career Progression** — Promotion velocity, stuck employees, grade pyramid
- **Manager Analytics** — Span of control, retention scores, revolving-door flags

### AI Assistant (Fire Orb)
- Persistent slide-out chat panel with voice input, file upload, mode toggles (Search/Think/Report)
- Deep context engine: recognition taxonomy + workforce data + 16 analytics sections per query
- Navigation agent: "show me turnover" routes to the right page
- Follow-up suggestion pills, inline charts, proactive anomaly alerts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts + Three.js + framer-motion |
| **Backend** | FastAPI + Pandas + scikit-learn + SQLAlchemy 2.0 async |
| **AI / LLM** | OpenRouter (Nemotron 120B free) for chat, OpenAI (GPT-4o) for reports |
| **Landing** | WebGL fluid distortion shader (Three.js + GLSL simplex noise) |
| **Design** | Premium dark theme (#09090b), glass morphism, orange accent (#FF8A4C) |
| **Performance** | In-memory TTL cache, GZip compression, aggregate dashboard endpoint |
| **Hosting** | Google Cloud Run (backend) + Firebase Hosting (frontend) |

---

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
```

Auto-loads CSV data from `wh_Dataset/` on startup. **No API keys needed** — all analytics work without them. AI features fall back to data-driven local responses.

Optional `.env` for AI:
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
OPENAI_API_KEY=your-key
```

---

## Pages (21)

| Page | Route | Description |
|------|-------|-------------|
| **Landing Page** | `/` | 3D WebGL fluid shader, fire orb hero, team section, "Enter Platform" |
| **Dashboard** | `/app` | 4 recognition KPIs, category distribution, direction donut, specificity histogram, grade pyramid |
| **Recognition Explorer** | `/app/explorer` | Filterable/searchable table of all 1,000 awards with expandable messages |
| **Categories** | `/app/categories` | Treemap, subcategory drill-down, category x function heatmap |
| **Inequality** | `/app/inequality` | Gini gauge, Lorenz curve, top-10 vs bottom-50, power recipients |
| **Message Quality** | `/app/quality` | Specificity histogram, action verb rate, cliche rate, word count stats |
| **Recognition Flow** | `/app/flow` | Direction KPIs, cross-function heatmap, reciprocal pairs |
| **Social Graph** | `/app/network` | Network visualization (reuses Flow) |
| **Nominators** | `/app/nominators` | Leaderboard with composite scores, blind spots, coaching candidates |
| **Fairness Audit** | `/app/fairness` | Specificity by function/seniority with below-avg highlighting |
| **Data Hub** | `/app/data-hub` | Upload + pipeline stepper + reports (unified) |
| **Workforce** | `/app/workforce` | Headcount by 8 dimensions |
| **Turnover** | `/app/turnover` | Attrition rates, trends, danger zones |
| **Careers** | `/app/careers` | Promotion velocity, stuck employees |
| **Managers** | `/app/managers` | Span of control, retention scores |
| **Settings** | `/app/settings` | LLM config, API key management, test connection |

---

## API Endpoints (120+)

| Route | Endpoints | Purpose |
|-------|-----------|---------|
| `/api/recognition/*` | 12 | Summary, categories, inequality, flow, NLP quality, fairness, network, nominators, award types, explorer, top roles |
| `/api/dashboard/*` | 1 | Aggregate endpoint — all dashboard data in single call (cached 60s) |
| `/api/workforce/*` | 16 | Headcount by every dimension, grade pyramid |
| `/api/turnover/*` | 11 | Attrition rates, trends, danger zones |
| `/api/tenure/*` | 8 | Cohorts, distribution, retention curves |
| `/api/careers/*` | 6 | Promotion velocity, stuck employees |
| `/api/managers/*` | 6 | Span of control, retention |
| `/api/predictions/*` | 4 | Flight risk ML scores |
| `/api/chat/*` | 2 | AI chatbot (standard + SSE streaming) |
| `/api/reports/*` | 3 | Executive reports, structured reports, export ZIP |
| `/api/settings/*` | 5 | LLM config, API key management, test connection, platform status |
| `/api/upload/*` | 3 | CSV upload, reload, status |
| `/api/profiling/*` | 2 | Per-route latency profiling (p50/p95/p99) |

---

## Data Sources

### Primary: Recognition Awards (Workhuman)
| File | Rows | Description |
|------|------|-------------|
| `annotated_results.csv` | 1,000 | Recognition messages + LLM behavioral taxonomy (4 categories, 25 subcategories) |
| `mockup_awards.csv` | 1,000 | Raw messages with job titles |

**Key stats:** 314 unique recipient roles, Gini 0.463, avg specificity 0.254, 42.9% cross-function, 69.6% zero action verbs

### Secondary: Workforce Lifecycle
| File | Rows | Description |
|------|------|-------------|
| `function_wh.csv` | 2,466 | Employee master — hire/expire, job title, grade, department, country |
| `wh_history_full.csv` | 11,803 | Job change history with manager hierarchy |

**Key stats:** 1,110 active (45%), 55% turnover, 3.9yr avg tenure, 222 managers

---

## Performance

Profiled with custom middleware (p50/p95 over 20 iterations):

| Endpoint | Before | After (cached) | Improvement |
|----------|--------|-----------------|-------------|
| `/api/recognition/nominators` | 64.6ms | 1.8ms | 36x |
| `/api/recognition/categories` | 8.6ms | 0.9ms | 10x |
| `/api/dashboard/overview` | N/A (6 calls ~120ms) | 1.1ms | Single call |

**Optimizations:** TTL cache (120s, 100 entries), GZip compression (>1KB), aggregate endpoint, version-based cache invalidation on data reload.

---

## Deployment

```bash
bash deploy.sh  # Deploys backend (Cloud Run) + frontend (Firebase)
```

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Firebase Hosting | [hr-analytics-f23c0.web.app](https://hr-analytics-f23c0.web.app) |
| Backend | Cloud Run (us-central1) | [hr-analytics-backend-ymez3d52nq-uc.a.run.app](https://hr-analytics-backend-ymez3d52nq-uc.a.run.app) |

---

## Team

| Name | Role | LinkedIn |
|------|------|----------|
| **Chirag Verma** | Project Lead, Full-Stack | [linkedin.com/in/vkin](https://linkedin.com/in/vkin/) |
| **Arav Pandey** | Data Science, ML | [linkedin.com/in/aravpandey](https://linkedin.com/in/aravpandey/) |
| **Rohan Reddy Kolla** | Backend, Analytics | [linkedin.com/in/rohan-reddy-kolla](https://linkedin.com/in/rohan-reddy-kolla/) |

**Northeastern University** — MS Capstone (IE 7945) — Spring 2026 — in partnership with **Workhuman**

---

## License

Private repository.
