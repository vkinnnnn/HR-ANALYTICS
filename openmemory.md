# HR Workforce Analytics Platform — Session Memory

## Last Updated
2026-03-27 — Built taxonomy.py, updated API docs, pushed to GitHub (vkinnnnn/HR-ANALYTICS). All code live.

## Session History

### 2026-03-27 — Cleanup, Types Fix, Git Init (Session 2)
**What was done:**
1. Read openmemory.md for context from previous session
2. Fixed frontend/src/types/api.ts — replaced all old recognition interfaces with new workforce types (WorkforceSummary, TurnoverSummary, TenureSummary, FlightRiskEmployee, ManagerSummary, etc.)
3. Cleaned up stale recognition-era files: removed create_taxonomy.py, run_topic_annotation.py, backend/pipeline/, old .txt doc files
4. Updated .gitignore to exclude env.yaml, .claude/settings.local.json, .cursor/, .firebase/
5. Verified all 8 major API endpoints return real data from Cloud Run
6. Rebuilt frontend and redeployed to Firebase Hosting
7. Initialized git repo, created initial commit (965cc63) with 80 files
8. Push to GitHub failed — needs authentication (PAT or gh CLI)

**Where I stopped:**
- All code pushed to GitHub (vkinnnnn/HR-ANALYTICS) — 3 commits on main
- taxonomy.py built (LLM batch classifier for job families, grades, move types)
- API docs rewritten for workforce analytics
- Everything deployed and live

**What's next:**
- Test each frontend page end-to-end against live backend
- Integrate taxonomy.py into data_loader (auto-run on startup)
- Build the Insights page to display taxonomy results
- Redeploy backend with taxonomy module


### 2026-03-27 — Full Platform Pivot & Redeployment
**What was done:**
1. Read all 6 original project docs (setup-script.sh, design-system-doc.txt, claude-rules-frontend.txt, claude-rules-backend.txt, claude-md-root.txt, api-deep-dive-doc.txt)
2. Created .md rule files: CLAUDE.md, docs/design-system.md, docs/api-deep-dive.md, .claude/rules/frontend.md, .claude/rules/backend.md
3. Built entire original "Recognition IQ" backend (FastAPI + 12 routers + pipeline) and frontend (React + 14 pages)
4. Configured Stitch MCP server with Google API key in .mcp.json
5. Deployed frontend to Firebase Hosting (hr-analytics-f23c0.web.app)
6. Installed gcloud CLI, linked billing account (01BFD0-079732-2ED266), enabled Cloud Run + Cloud Build + Artifact Registry APIs
7. Deployed backend to Cloud Run (hr-analytics-backend-88806953030.us-central1.run.app)
8. **MAJOR PIVOT**: User provided real dataset (wh_Dataset/) — workforce/HR lifecycle data, NOT recognition awards
9. Read V2 rule files (claude-md-v2.txt, claude-rules-backend_V2.txt, claude-rules-frontend_V2.txt)
10. Updated all .md rule files for workforce analytics pivot
11. Built data_loader.py — loads 3 CSVs, joins on PK_PERSON=pk_user, computes tenure/is_active/role_changes/manager_changes/time_in_current_role
12. Verified data loader: 2,466 employees, 1,110 active, 1,356 departed, 11,803 history records, 37 departments, 15 countries, 25 grades
13. Built 11 new backend routers: workforce, turnover, tenure, careers, managers, org, predictions, chat, reports, upload (replaced old recognition routers)
14. Updated Sidebar with new nav groups: Overview, Retention, People, Intelligence, Operations
15. Built all 13 new frontend pages: Dashboard, Workforce, Turnover, Tenure, FlightRisk, Careers, Managers, Org, Chat, Insights, Upload, Reports, SettingsPage
16. Fixed TypeScript build errors (ReactNode type-only imports, unused vars)
17. Copied wh_Dataset into backend/ for Docker build
18. Redeployed both frontend (Firebase) and backend (Cloud Run) with real data bundled
19. Verified live API: /api/workforce/summary returns real data (2466 employees, 55% turnover, 5.5yr avg tenure)

**Decisions made:**
- Platform is WORKFORCE analytics, not recognition analytics — permanent pivot
- Data lives in wh_Dataset/ and is bundled into Docker image for Cloud Run
- All analytics computed from pandas DataFrames in memory, no SQL for analytics
- SQLite only for metadata (upload logs, settings)
- OpenAI API key and model (gpt-5.2) set via Cloud Run env vars
- Firebase project: hr-analytics-f23c0, billing account: 01BFD0-079732-2ED266
- User is vkinnnnn@gmail.com on gcloud

**What's next:**
- User should verify the live site at https://hr-analytics-f23c0.web.app
- May need to fix frontend issues if API response shapes don't match what pages expect
- Taxonomy generation (LLM-based job family/grade classification) not yet implemented
- AI Chatbot endpoint works but needs OpenAI key to be valid
- Settings page is read-only placeholder

---

## Current State

### What's Built & Working

**Backend (all deployed to Cloud Run):**
- ✅ app/main.py — FastAPI entry point with lifespan, CORS, 10 routers registered
- ✅ app/config.py — pydantic-settings with .env support
- ✅ app/database.py — SQLAlchemy async + PipelineRun model
- ✅ app/data_loader.py — Loads 3 CSVs, joins, computes derived fields, caches in memory
- ✅ app/routers/workforce.py — 11 endpoints: summary, by-dept/BU/function/grade/location/country, grade-pyramid, headcount-trend, active-vs-departed
- ✅ app/routers/turnover.py — 8 endpoints: summary, by-dept/grade/location/function, trend, tenure-at-departure, danger-zones
- ✅ app/routers/tenure.py — 8 endpoints: summary, by-dept/grade, cohorts, distribution, long-tenured, short-departures, retention-curve
- ✅ app/routers/careers.py — 6 endpoints: summary, promotion-velocity, stuck-employees, career-paths, title-changes, by-department
- ✅ app/routers/managers.py — 6 endpoints: summary, span-distribution, leaderboard, retention, ratio-by-department, churn
- ✅ app/routers/org.py — 6 endpoints: summary, department-sizes, department-growth, restructuring, hierarchy, layers
- ✅ app/routers/predictions.py — 4 endpoints: flight-risk, feature-importance, risk-by-department, retrain
- ✅ app/routers/chat.py — 1 endpoint: POST /query (needs valid OpenAI key)
- ✅ app/routers/reports.py — 2 endpoints: POST /executive-summary, GET /export
- ✅ app/routers/upload.py — 3 endpoints: POST /csv, GET /status, POST /reload

**Frontend (all deployed to Firebase Hosting):**
- ✅ components/ui/ — Panel, KpiCard, AnimatedNumber, Badge, SectionHeader, PageHero, InsightBanner, Tabs, Skeleton
- ✅ components/charts/ChartTooltip.tsx — Custom glass tooltip
- ✅ components/layout/Sidebar.tsx — 5 nav groups (Overview/Retention/People/Intelligence/Operations)
- ✅ components/layout/AmbientBackground.tsx — Radial gradients
- ✅ pages/Dashboard.tsx — KPIs + headcount trend + turnover by dept + tenure dist + flight risk table
- ✅ pages/Workforce.tsx — Tab-based dimension breakdown + grade pyramid + active/departed pie
- ✅ pages/Turnover.tsx — Rates + trend line + dept bars + tenure-at-departure + danger zones
- ✅ pages/Tenure.tsx — Cohorts + distribution + retention curve + long-tenured list
- ✅ pages/FlightRisk.tsx — Risk scores table + feature importance + risk by dept
- ✅ pages/Careers.tsx — Promotion velocity + stuck employees + career paths
- ✅ pages/Managers.tsx — Span distribution + leaderboard + retention + revolving doors
- ✅ pages/Org.tsx — Dept sizes + growth timeline + restructuring events
- ✅ pages/Chat.tsx — Chat UI with suggested prompts
- ✅ pages/Insights.tsx — Taxonomy placeholder panels
- ✅ pages/Upload.tsx — Drag-drop upload + status + reload
- ✅ pages/Reports.tsx — Executive summary generation + export download
- ✅ pages/SettingsPage.tsx — Read-only config display
- ✅ lib/api.ts — Axios client pointing to VITE_API_URL
- ✅ lib/utils.ts — cn(), CHART_COLORS, formatNumber, formatCurrency, formatPercent
- ✅ types/api.ts — TypeScript interfaces (may need updating for new API shapes)
- ✅ App.tsx — React Router with all 13 routes
- ✅ index.css — Tailwind + design tokens + animations

**Infrastructure:**
- ✅ Firebase Hosting — hr-analytics-f23c0.web.app
- ✅ Cloud Run — hr-analytics-backend-88806953030.us-central1.run.app
- ✅ Billing linked (account 01BFD0-079732-2ED266)
- ✅ APIs enabled: run, cloudbuild, artifactregistry
- ✅ .mcp.json — Stitch MCP server configured
- ✅ .firebaserc — project hr-analytics-f23c0
- ✅ firebase.json — hosting config pointing to frontend/dist
- ✅ deploy.sh — full deployment script
- ✅ backend/Dockerfile — Python 3.11 slim with wh_Dataset bundled
- ✅ backend/env.yaml — CORS, DATABASE_URL, DATA_DIR, OPENAI_API_KEY, OPENAI_MODEL

### What's NOT Built Yet
- ❌ taxonomy.py — LLM-based job title/grade/move classification (planned but not implemented)
- ❌ Synthetic data generation for features not in current dataset
- ❌ Settings page write functionality (currently read-only)
- ❌ PDF report generation
- ❌ Scheduled reports
- ❌ Git repo initialization and push to GitHub

### Where I Stopped
- All code pushed to GitHub: https://github.com/vkinnnnn/HR-ANALYTICS (3 commits on main)
- All code deployed and live (Firebase + Cloud Run)
- taxonomy.py built, API docs rewritten
- Next: integrate taxonomy into pipeline, test frontend pages, redeploy

---

## Architecture Decisions Made

1. **Workforce, not recognition** — The platform analyzes employee lifecycle data (jobs, tenure, turnover, careers). The original recognition/NLP prototype is dead code that has been removed.
2. **CSV → pandas → in-memory cache** — All analytics computed from pandas DataFrames. No SQL queries for analytics. SQLite only for metadata.
3. **Data bundled in Docker** — wh_Dataset/ is copied into the backend Docker image so Cloud Run has the data on startup.
4. **Dual deploy** — Frontend on Firebase Hosting (free, static), Backend on Cloud Run (serverless, auto-scales 0-3).
5. **OpenAI for AI features** — GPT model (currently set to gpt-5.2) for chatbot and taxonomy. Temperature 0.1 for classification, 0.7 for reports.
6. **Design system preserved** — CodeRabbit-inspired dark theme with orange accent. All existing UI components (Panel, KpiCard, Badge, etc.) reused for new pages.
7. **CORS origins** — Backend allows https://hr-analytics-f23c0.web.app and https://hr-analytics-f23c0.firebaseapp.com.

---

## Known Issues & Bugs

1. **Frontend types may mismatch API** — types/api.ts still has old recognition interfaces. May need updating to match new workforce API response shapes.
2. **Taxonomy not implemented** — taxonomy.py doesn't exist yet. The Insights page is a placeholder.
3. **OpenAI key validity** — The key in env.yaml (sk-or-v1-...) needs to be valid for chat and report generation to work.
4. **gcloud path** — gcloud.cmd is at `/c/Users/chira/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd` — not in PATH, must be referenced by full path.
5. **Headcount trend may be slow** — The /api/workforce/headcount-trend endpoint iterates over every month since first hire. Could be optimized.
6. **GitHub repo** — https://github.com/vkinnnnn/HR-ANALYTICS (NOT Regata3010 — that's the friend's reference repo). PAT removed from remote URL after push.

---

## Do's and Don'ts (NEVER VIOLATE THESE)

### DO:
- ✅ Update openmemory.md after EVERY task completion
- ✅ Use FastAPI async lifespan pattern for startup
- ✅ Read CSVs with pandas, process in memory, cache in dicts
- ✅ Parse all date columns explicitly
- ✅ Handle NaN/NaT in Expire and fk_direct_manager
- ✅ Use design system tokens from docs/design-system.md
- ✅ Use Recharts with custom glass tooltips
- ✅ Use CSS Grid for tabular data
- ✅ Stagger KPI animations by 60ms
- ✅ Include loading skeletons on every page

### DON'T:
- ❌ NEVER build recognition/award analytics
- ❌ NEVER use @app.on_event("startup")
- ❌ NEVER store HR data in SQLite
- ❌ NEVER hardcode colors in frontend
- ❌ NEVER use default Recharts tooltip
- ❌ NEVER use HTML <table>
- ❌ NEVER assume demographics data exists
- ❌ NEVER delete session history from openmemory.md

---

## Data Understanding

### Dataset Stats (verified from real data)
- **Total employees:** 2,466
- **Active:** 1,110 (45%)
- **Departed:** 1,356 (55%)
- **History records:** 11,803 (~4.8 per person average)
- **Departments:** 37
- **Countries:** 15
- **Grades:** 25 unique grade_title values
- **Avg tenure (active):** 5.5 years
- **Avg tenure (departed):** 2.5 years
- **Median tenure (departed):** 1.4 years
- **Overall turnover rate:** 55.0%
- **Total managers:** 222 (unique fk_direct_manager values)
- **Avg span of control:** 2.92 direct reports per manager
- **Max span of control:** 13 direct reports

### Tenure Cohort Distribution
- 0-1yr: 574 employees
- 1-3yr: 737 employees
- 3-5yr: 535 employees
- 5-10yr: 423 employees
- 10yr+: 189 employees

### Edge Cases Found
- function_wh.csv has an unnamed first column (index column from pandas export) — handled by `index_col=0`
- fk_direct_manager is float type (nullable int stored as float due to NaN values)
- Some employees have no history records (appear in function_wh but not wh_history_full)
- Expire dates exist for 1,356 of 2,466 employees

---

## File Registry

### Root
| File | Description | Status |
|---|---|---|
| CLAUDE.md | Root project brief (V2 workforce) | ✅ Current |
| openmemory.md | THIS FILE — persistent memory | ✅ Current |
| .gitignore | Git ignore rules | ✅ Created |
| .mcp.json | Stitch MCP server config | ✅ Created |
| .firebaserc | Firebase project: hr-analytics-f23c0 | ✅ Created |
| firebase.json | Firebase Hosting config | ✅ Created |
| deploy.sh | Full deployment script | ✅ Created |
| create_taxonomy.py | OLD — NLP taxonomy builder (recognition era) | ⚠️ Stale, should remove |
| run_topic_annotation.py | OLD — NLP annotator (recognition era) | ⚠️ Stale, should remove |

### Backend
| File | Description | Status |
|---|---|---|
| backend/app/main.py | FastAPI entry, lifespan, 10 routers | ✅ Working |
| backend/app/config.py | pydantic-settings | ✅ Working |
| backend/app/database.py | SQLAlchemy async + PipelineRun model | ✅ Working |
| backend/app/data_loader.py | CSV loading, joining, derived fields | ✅ Working |
| backend/app/routers/workforce.py | 11 endpoints | ✅ Working |
| backend/app/routers/turnover.py | 8 endpoints | ✅ Working |
| backend/app/routers/tenure.py | 8 endpoints | ✅ Working |
| backend/app/routers/careers.py | 6 endpoints | ✅ Working |
| backend/app/routers/managers.py | 6 endpoints | ✅ Working |
| backend/app/routers/org.py | 6 endpoints | ✅ Working |
| backend/app/routers/predictions.py | 4 endpoints (flight risk ML) | ✅ Working |
| backend/app/routers/chat.py | 1 endpoint (LLM chatbot) | ✅ Built, needs valid key |
| backend/app/routers/reports.py | 2 endpoints (summary + export) | ✅ Built, needs valid key |
| backend/app/routers/upload.py | 3 endpoints (csv upload, status, reload) | ✅ Working |
| backend/pipeline/core.py | OLD — LLM wrapper (recognition era) | ⚠️ Stale |
| backend/pipeline/runners.py | OLD — Pipeline runners (recognition era) | ⚠️ Stale |
| backend/Dockerfile | Python 3.11 + wh_Dataset bundled | ✅ Working |
| backend/env.yaml | Cloud Run env vars | ✅ Working |
| backend/requirements.txt | Python dependencies | ✅ Working |
| backend/wh_Dataset/ | Copy of dataset for Docker build | ✅ Working |

### Frontend
| File | Description | Status |
|---|---|---|
| frontend/src/App.tsx | React Router, 13 routes | ✅ Working |
| frontend/src/main.tsx | React entry point | ✅ Working |
| frontend/src/index.css | Tailwind + design tokens + animations | ✅ Working |
| frontend/src/lib/api.ts | Axios client (VITE_API_URL) | ✅ Working |
| frontend/src/lib/utils.ts | cn, CHART_COLORS, formatters | ✅ Working |
| frontend/src/types/api.ts | TS interfaces | ⚠️ May need updating for new API |
| frontend/src/components/ui/*.tsx | 9 shared UI components | ✅ Working |
| frontend/src/components/charts/ChartTooltip.tsx | Custom glass tooltip | ✅ Working |
| frontend/src/components/layout/Sidebar.tsx | 5-group workforce nav | ✅ Working |
| frontend/src/components/layout/AmbientBackground.tsx | Radial gradients | ✅ Working |
| frontend/src/pages/Dashboard.tsx | Workforce dashboard | ✅ Built |
| frontend/src/pages/Workforce.tsx | Composition breakdown | ✅ Built |
| frontend/src/pages/Turnover.tsx | Attrition analysis | ✅ Built |
| frontend/src/pages/Tenure.tsx | Tenure analysis | ✅ Built |
| frontend/src/pages/FlightRisk.tsx | ML risk scores | ✅ Built |
| frontend/src/pages/Careers.tsx | Career progression | ✅ Built |
| frontend/src/pages/Managers.tsx | Manager analytics | ✅ Built |
| frontend/src/pages/Org.tsx | Org structure | ✅ Built |
| frontend/src/pages/Chat.tsx | AI chatbot | ✅ Built |
| frontend/src/pages/Insights.tsx | Taxonomy placeholder | ✅ Built |
| frontend/src/pages/Upload.tsx | Data upload | ✅ Built |
| frontend/src/pages/Reports.tsx | Reports & export | ✅ Built |
| frontend/src/pages/SettingsPage.tsx | Settings (read-only) | ✅ Built |
| frontend/.env.production | VITE_API_URL for Cloud Run | ✅ Working |
| frontend/.env.development | VITE_API_URL for localhost | ✅ Working |

### Docs
| File | Description | Status |
|---|---|---|
| docs/design-system.md | Full design token reference | ✅ Current |
| docs/api-deep-dive.md | OLD — recognition API docs | ⚠️ Stale, needs rewrite |
| .claude/rules/frontend.md | Frontend rules (V2 workforce) | ✅ Current |
| .claude/rules/backend.md | Backend rules (V2 workforce) | ✅ Current |

### Dataset
| File | Rows | Description |
|---|---|---|
| wh_Dataset/function_wh.csv | 2,466 | Employee master (PK_PERSON, Hire, Expire, job/dept/grade/location) |
| wh_Dataset/wh_history_full.csv | 11,803 | Job change history (pk_user, manager, title, dates) |
| wh_Dataset/wh_user_history_v2.csv | 100 | Enriched subset with position_title |
