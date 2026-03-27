# HR Workforce Analytics Platform — Session Memory

## Last Updated
2026-03-27 — Complete rewrite of openmemory.md reflecting all 9 sessions of work. MCP ecosystem live. All infrastructure deployed.

---

## Session History (Reverse Chronological)

### Session 9 — MCP + Skills Ecosystem
- Added Memory MCP (`@modelcontextprotocol/server-memory`) — persistent knowledge graph at `.mcp-data/memory/`
- Added Context7 MCP (`@upstash/context7-mcp`) — real-time library docs lookup
- Added GitHub MCP (`@modelcontextprotocol/server-github`) — issues/PRs/commits via PAT
- Extracted 2 local skills into `.claude/skills/`: gh-issues, skill-lookup
- GITHUB_TOKEN in gitignored `.claude/settings.local.json`, referenced via `${GITHUB_TOKEN}` in `.mcp.json`
- Created `docs/mcp-integration.md` — full architecture, config, troubleshooting
- Commit: `4649d3f`

### Session 8 — Production Infrastructure (ARQ, Auth, WebSocket, Scheduler, Sentry)
- ARQ + Redis job queue with thread fallback (`job_queue.py`, `worker.py`)
- Firebase Auth middleware with graceful no-auth mode (`auth.py`)
- WebSocket log streaming `/ws/pipeline/{id}/logs` + `/ws/pipeline/all` (`ws.py`)
- APScheduler cron scheduling + dependency chains (`scheduler.py`)
- `POST /api/pipeline/chain` — chained runs (data_reload → taxonomy → ML)
- `GET /api/pipeline/schedules` + `/health` endpoints
- Sentry SDK in lifespan (if `SENTRY_DSN` set)
- GitHub Actions: daily cron + test CI (`.github/workflows/`)
- PipelineHub frontend: WebSocket with polling fallback
- Commit: `a3448fe`

### Session 7 — Pipeline Orchestration (Phases B-G from Regata3010)
- Analyzed friend's repo (Regata3010/HR-Analytics) pipeline patterns
- Extended PipelineRun model: progress, cancellation, PipelineArtifact table
- Built `batch_processor.py`: configurable batch_size/workers/retries/checkpoints/resume
- Built `run_manager.py`: async lifecycle, log append, artifact registry, cancel flags
- Built `pipeline_router.py`: 7 endpoints (start, runs, detail, log, cancel, download, types)
- Built 5 pipeline runners: data_reload, taxonomy_regen, flight_risk_train, report_generate, export_bundle
- Built `PipelineHub.tsx` frontend page
- 28 tests passing (12 batch + 9 lifecycle + 7 API)
- `docs/pipeline-migration.md` — source→local capability mapping
- Commit: `7679f9d`

### Session 6 — Fix Page Crashes (Tenure, Turnover, Careers, Org, Upload)
- All 5 pages crashed due to frontend interface field names mismatching actual API responses
- Fixed Tenure (7 fields), Turnover (summary+trend+danger), Careers (PK_PERSON+paths+velocity), Org (growth pivot+restructuring), Upload (status fields)
- Commit: `3334c5c`

### Session 5 — Comprehensive Frontend-API Alignment (18 Mismatches)
- Audited all 13 pages vs actual API — found 18 mismatches across 7 pages
- Fixed: Careers (3), Managers (3), Org (2), Tenure (4), Turnover (1), Dashboard (1), FlightRisk (4)
- Commit: `93775aa`

### Session 4 — Bug Fixes + Taxonomy-Enriched Dimensions
- Fixed 3 broken endpoints: careers/stuck-employees, chat/query (OpenAI proxies), org/restructuring
- Added 5 workforce + 3 turnover taxonomy-enriched endpoints (by-grade-band, by-function-family, by-job-family, by-seniority, by-grade-track)
- Updated Workforce page with 8 dimension tabs + normalized data parsing
- Commit: `4688c76`

### Session 3 — Precise Data-Driven Taxonomy
- Deep analysis: 25 grades, 151 functions, 869 titles, 3,297 career transitions
- Rebuilt `taxonomy.py` — Workhuman-specific grade hierarchy (P1-P6, M1-M6, S1-S5, E1-E2, EXEC, C-Suite, CEO)
- 12 function families via regex, job title seniority + family classifiers
- Career move classifier: multi-signal (grade + title level + family + overlap)
- Taxonomy auto-runs on data load, adds 7 enrichment columns
- Built `/api/taxonomy` router (6 endpoints) + rebuilt Insights page with real charts
- Commit: `5ef279d`

### Session 2 — Cleanup, Types Fix, Git Init
- Replaced old recognition types/api.ts with workforce interfaces
- Cleaned stale recognition-era files (create_taxonomy.py, run_topic_annotation.py, backend/pipeline/)
- Initialized git, first commit, push to GitHub (vkinnnnn/HR-ANALYTICS)
- Commit: `fef37a6`, `8539953`

### Session 1 — Full Platform Build + Pivot
- Built original Recognition IQ (12 routers + 14 pages) from project docs
- Deployed to Firebase Hosting + Cloud Run
- **PIVOTED** to Workforce Analytics when real dataset arrived (wh_Dataset/)
- Rebuilt entire backend (11 routers) + frontend (13 pages) for workforce domain
- Verified: 2,466 employees, 1,110 active, 1,356 departed, 11,803 history records
- Initial commit: `965cc63`

---

## Current State

### What's Built & Working

**Backend — 85 API routes on Cloud Run:**

| Area | File | Endpoints | Status |
|---|---|---|---|
| Core | main.py | Lifespan, CORS, 13 routers + WS | ✅ |
| Config | config.py | All env vars (LLM, pipeline, batch, auth) | ✅ |
| Database | database.py | PipelineRun + PipelineArtifact models | ✅ |
| Data | data_loader.py | CSV load, join, enrich, taxonomy, cache | ✅ |
| Taxonomy | taxonomy.py | Grade/function/title/career move classifier | ✅ |
| Workforce | routers/workforce.py | 16 endpoints (incl. taxonomy dimensions) | ✅ |
| Turnover | routers/turnover.py | 11 endpoints (incl. taxonomy breakdowns) | ✅ |
| Tenure | routers/tenure.py | 8 endpoints | ✅ |
| Careers | routers/careers.py | 6 endpoints | ✅ |
| Managers | routers/managers.py | 6 endpoints | ✅ |
| Org | routers/org.py | 6 endpoints | ✅ |
| Predictions | routers/predictions.py | 4 endpoints (flight risk ML) | ✅ |
| Taxonomy API | routers/taxonomy_router.py | 6 endpoints | ✅ |
| Chat | routers/chat.py | 1 endpoint (LLM) | ✅ (needs valid key) |
| Reports | routers/reports.py | 2 endpoints (LLM + ZIP) | ✅ (needs valid key) |
| Upload | routers/upload.py | 3 endpoints | ✅ |
| Pipeline | routers/pipeline_router.py | 11 endpoints (start, runs, chain, health, schedules) | ✅ |
| WebSocket | routers/ws.py | 2 WS endpoints (per-run logs, all-runs) | ✅ |
| Services | services/batch_processor.py | Generic batch processing utility | ✅ |
| Services | services/run_manager.py | Run lifecycle, logs, artifacts, cancel | ✅ |
| Services | services/pipeline_runners.py | 5 runner implementations | ✅ |
| Services | services/job_queue.py | ARQ + Redis with thread fallback | ✅ |
| Services | services/scheduler.py | APScheduler cron + dependency chains | ✅ |
| Services | services/auth.py | Firebase Auth middleware | ✅ |
| Worker | worker.py | ARQ worker process config | ✅ |
| Tests | tests/ | 28 tests (batch, lifecycle, API) | ✅ All passing |

**Frontend — 14 pages on Firebase Hosting:**

| Page | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ Working |
| Workforce | `/workforce` | ✅ Working (8 dimension tabs) |
| Turnover | `/turnover` | ✅ Working |
| Tenure | `/tenure` | ✅ Working |
| Flight Risk | `/flight-risk` | ✅ Working |
| Careers | `/careers` | ✅ Working |
| Managers | `/managers` | ✅ Working |
| Org Structure | `/org` | ✅ Working |
| AI Chatbot | `/chat` | ✅ Working (needs LLM key) |
| AI Insights | `/insights` | ✅ Working (real taxonomy data) |
| Pipeline Hub | `/pipeline` | ✅ Working (WebSocket + polling) |
| Data Upload | `/upload` | ✅ Working |
| Reports | `/reports` | ✅ Working (needs LLM key) |
| Settings | `/settings` | ✅ Read-only |

**Infrastructure:**

| Component | URL/Location | Status |
|---|---|---|
| Frontend | https://hr-analytics-f23c0.web.app | ✅ Live |
| Backend | https://hr-analytics-backend-88806953030.us-central1.run.app | ✅ Live |
| API Docs | .../docs (Swagger UI) | ✅ Live |
| GitHub | https://github.com/vkinnnnn/HR-ANALYTICS | ✅ 10+ commits on main |
| Firebase Project | hr-analytics-f23c0 | ✅ Billing linked |
| Cloud Run Region | us-central1 | ✅ |
| GCloud Account | vkinnnnn@gmail.com | ✅ |
| Billing Account | 01BFD0-079732-2ED266 | ✅ |

**MCP Ecosystem (4 servers + 2 skills):**

| Server | Package | Purpose | Status |
|---|---|---|---|
| Stitch | `github:davideast/stitch-mcp` | Google Gemini AI | ✅ |
| Memory | `@modelcontextprotocol/server-memory` | Persistent knowledge graph | ✅ |
| Context7 | `@upstash/context7-mcp` | Library docs lookup | ✅ |
| GitHub | `@modelcontextprotocol/server-github` | Issues/PRs/commits | ✅ |

| Skill | Location | Purpose |
|---|---|---|
| gh-issues | `.claude/skills/gh-issues/` | Auto-fix GitHub issues |
| skill-lookup | `.claude/skills/skill-lookup/` | Discover agent skills |

---

## What's NOT Built Yet / Remaining Work

### High Priority
- ❌ **Settings page write functionality** — currently read-only, needs forms for LLM config, thresholds
- ❌ **PDF report generation** — Reports page generates text via LLM but no PDF download
- ❌ **Synthetic data generation** — for features not in dataset (salary, performance, demographics, engagement)
- ❌ **End-to-end page testing** — some pages may still have minor rendering issues with edge case data
- ❌ **Code-splitting** — frontend bundle is 750KB, needs lazy loading for pages

### Medium Priority
- ❌ **Redis setup for production** — ARQ falls back to threads. Need Cloud Memorystore or Redis Cloud for persistent jobs
- ❌ **Firebase Auth activation** — middleware exists but `FIREBASE_PROJECT_ID` not set on Cloud Run. Auth is in no-auth mode
- ❌ **Sentry DSN configuration** — SDK wired but `SENTRY_DSN` not set. No error monitoring active
- ❌ **Move Stitch GOOGLE_API_KEY to env var** — currently hardcoded in `.mcp.json`
- ❌ **prompts.chat MCP server** — needed for skill-lookup skill to fully work
- ❌ **Headcount trend optimization** — iterates every month since first hire, slow for large datasets

### Low Priority / Nice-to-Have
- ❌ **Project-specific skills** — create deploy, test-all, release skills
- ❌ **Memory auto-backup cron** — periodic backup of .mcp-data/memory/
- ❌ **WebSocket auth** — WS endpoints currently unauthenticated
- ❌ **Celery migration** — replace thread-based jobs with Celery for true production queue
- ❌ **Rate limiting** — no rate limits on API endpoints
- ❌ **API versioning** — all endpoints at /api/ with no version prefix
- ❌ **Dark mode toggle** — design system is dark-only, no light mode option
- ❌ **Mobile responsive** — sidebar doesn't collapse on mobile
- ❌ **i18n** — English only
- ❌ **Accessibility audit** — no ARIA labels, keyboard nav needs work

---

## Architecture Decisions

1. **Workforce, not recognition** — permanent pivot from Session 1
2. **CSV → pandas → in-memory cache** — no SQL for analytics, SQLite only for pipeline metadata
3. **Data bundled in Docker** — wh_Dataset/ copied into image for Cloud Run
4. **Dual deploy** — Firebase Hosting (static) + Cloud Run (API)
5. **Deterministic taxonomy** — rule-based (Workhuman grade hierarchy), not LLM-dependent
6. **Hybrid job queue** — ARQ+Redis when available, threads otherwise
7. **Graceful degradation** — auth/sentry/redis all optional, app works without them
8. **MCP tokens via env vars** — `${GITHUB_TOKEN}` ref in .mcp.json, actual value in gitignored settings.local.json
9. **Design system preserved** — CodeRabbit dark theme with orange accent, Inter font

---

## Known Issues & Bugs

1. **Chat/Reports LLM** — OpenAI key (`sk-or-v1-...`) needs to be valid. May get 502 if expired
2. **gcloud not in PATH** — must use full path: `/c/Users/chira/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd`
3. **utcnow() deprecation** — SQLAlchemy model defaults use deprecated `datetime.utcnow()`. Cosmetic warnings in tests
4. **Cloud Run cold starts** — first request after scale-to-zero takes 5-10s (data loading)
5. **Bundle size** — 750KB JS bundle. Should code-split with dynamic imports
6. **Some NaN values in job_title** — employees with no history show "nan" as job title in flight risk table

---

## Do's and Don'ts

### DO:
- ✅ Update openmemory.md after EVERY task
- ✅ Use FastAPI async lifespan (NOT @app.on_event)
- ✅ Read CSVs with pandas, cache in `_data_cache` dict
- ✅ Parse all dates explicitly, handle NaN/NaT
- ✅ Use design tokens from docs/design-system.md
- ✅ Use Recharts + custom ChartTooltip
- ✅ Use CSS Grid for tables (not HTML `<table>`)
- ✅ Stagger KPI animations by 60ms
- ✅ Use `${ENV_VAR}` refs for secrets in .mcp.json
- ✅ Keep .claude/settings.local.json gitignored
- ✅ Run tests before deploying (`python -m pytest tests/ -v`)

### DON'T:
- ❌ NEVER build recognition/award analytics
- ❌ NEVER store HR data in SQLite
- ❌ NEVER hardcode colors in frontend
- ❌ NEVER hardcode tokens in committed files
- ❌ NEVER use default Recharts tooltip
- ❌ NEVER use HTML `<table>`
- ❌ NEVER assume demographics data exists
- ❌ NEVER delete session history from this file
- ❌ NEVER push env.yaml or settings.local.json to git

---

## Data Understanding

### Dataset (Workhuman workforce data)
| File | Rows | Key Columns |
|---|---|---|
| function_wh.csv | 2,466 | PK_PERSON, Hire, Expire, job_title, grade_title, function_title, department_name, country |
| wh_history_full.csv | 11,803 | pk_user, fk_direct_manager, job_title, effective_start_date, effective_end_date |
| wh_user_history_v2.csv | 100 | pk_user, fk_direct_manager, job_title, position_title, dates |

### Key Stats
- Total: 2,466 employees | Active: 1,110 (45%) | Departed: 1,356 (55%)
- Avg tenure active: 5.5yr | Avg tenure departed: 2.5yr | Median departed: 1.4yr
- 37 departments | 15 countries | 25 grades | 151 functions | 869 unique job titles
- 222 managers | Avg span: 2.92 | Max span: 13
- 3,297 career moves: 1,113 promotions, 799 laterals, 541 transfers, 505 demotions, 339 restructures

### Grade Hierarchy (Workhuman-specific)
```
Support:      S1 → S2 → S3 → S4 → S5
Professional: P1 → P2 → P3 → P4 → P5 → P6
Management:   M1 → M2 → M3 → M4 → M5 → M6
Executive:    E1 → E2 → EXEC → C-Suite → CEO
Other:        Hourly, Salary, Contingent Workers
```

### Join Key
`function_wh.PK_PERSON = wh_history_full.pk_user`

### Active/Departed Rule
- Active: `Expire IS NULL` or `Expire > today`
- Departed: `Expire IS NOT NULL` and `Expire <= today`

---

## Environment Variables Reference

### Cloud Run (backend/env.yaml — gitignored)
| Variable | Value | Purpose |
|---|---|---|
| CORS_ORIGINS | Firebase URLs | CORS whitelist |
| DATABASE_URL | sqlite+aiosqlite:///./hr_platform.db | Pipeline metadata DB |
| DATA_DIR | /app/wh_Dataset | Dataset location in Docker |
| OPENAI_API_KEY | sk-or-v1-... | LLM features (chat, reports) |
| OPENAI_MODEL | gpt-5.2 | LLM model |
| LLM_PROVIDER | openai | Provider switch |

### Optional (not yet configured on Cloud Run)
| Variable | Purpose |
|---|---|
| REDIS_URL | ARQ persistent job queue |
| SENTRY_DSN | Error monitoring |
| FIREBASE_PROJECT_ID | Auth token verification |
| SCHEDULE_DATA_RELOAD | Cron expression for auto-reload |
| PIPELINE_CHAIN | Comma-separated chain steps |
| SCHEDULE_CHAIN | Cron expression for chain |
| DEFAULT_BATCH_SIZE | Batch processor (default: 50) |
| MAX_WORKERS | Parallel workers (default: 4, max: 8) |
| MAX_RETRIES | Retry attempts per batch (default: 3) |

### Local (.claude/settings.local.json — gitignored)
| Variable | Purpose |
|---|---|
| GITHUB_TOKEN | GitHub MCP authentication |

---

## File Registry

### Root
| File | Description | Status |
|---|---|---|
| CLAUDE.md | Root project brief (workforce V2) | ✅ |
| openmemory.md | THIS FILE — persistent session memory | ✅ |
| .gitignore | Excludes secrets, build, .mcp-data | ✅ |
| .mcp.json | 4 MCP servers (stitch, memory, context7, github) | ✅ |
| .firebaserc | Firebase project ID | ✅ |
| firebase.json | Hosting config → frontend/dist | ✅ |
| deploy.sh | Full deployment script | ✅ |

### Backend
| File | Description | Status |
|---|---|---|
| app/main.py | FastAPI, lifespan, 13 routers + WS, sentry init | ✅ |
| app/config.py | All env vars (LLM, pipeline, batch, auth) | ✅ |
| app/database.py | PipelineRun + PipelineArtifact models | ✅ |
| app/data_loader.py | CSV load → join → enrich → taxonomy → cache | ✅ |
| app/taxonomy.py | Deterministic grade/function/title/move classifier | ✅ |
| app/routers/workforce.py | 16 endpoints | ✅ |
| app/routers/turnover.py | 11 endpoints | ✅ |
| app/routers/tenure.py | 8 endpoints | ✅ |
| app/routers/careers.py | 6 endpoints | ✅ |
| app/routers/managers.py | 6 endpoints | ✅ |
| app/routers/org.py | 6 endpoints | ✅ |
| app/routers/predictions.py | 4 endpoints (flight risk ML) | ✅ |
| app/routers/taxonomy_router.py | 6 endpoints | ✅ |
| app/routers/pipeline_router.py | 11 endpoints (runs, chain, schedules, health) | ✅ |
| app/routers/chat.py | 1 LLM endpoint | ✅ |
| app/routers/reports.py | 2 endpoints (LLM summary + ZIP export) | ✅ |
| app/routers/upload.py | 3 endpoints | ✅ |
| app/routers/ws.py | 2 WebSocket endpoints | ✅ |
| app/services/batch_processor.py | Generic batch utility (retry, checkpoint, cancel) | ✅ |
| app/services/run_manager.py | Run lifecycle, logs, artifacts, cancel flags | ✅ |
| app/services/pipeline_runners.py | 5 runner implementations | ✅ |
| app/services/job_queue.py | ARQ+Redis with thread fallback | ✅ |
| app/services/scheduler.py | APScheduler cron + chains | ✅ |
| app/services/auth.py | Firebase Auth middleware | ✅ |
| worker.py | ARQ worker process config | ✅ |
| tests/test_batch_processor.py | 12 tests | ✅ |
| tests/test_run_lifecycle.py | 9 tests | ✅ |
| tests/test_pipeline_api.py | 7 tests | ✅ |
| Dockerfile | Python 3.11 + wh_Dataset bundled | ✅ |
| requirements.txt | All deps (fastapi, arq, firebase-admin, sentry) | ✅ |

### Frontend
| File | Description | Status |
|---|---|---|
| src/App.tsx | React Router, 14 routes | ✅ |
| src/pages/Dashboard.tsx | KPIs + charts + flight risk table | ✅ |
| src/pages/Workforce.tsx | 8-tab dimension breakdown | ✅ |
| src/pages/Turnover.tsx | Rates + trend + danger zones | ✅ |
| src/pages/Tenure.tsx | Cohorts + retention curve | ✅ |
| src/pages/FlightRisk.tsx | ML risk scores + features | ✅ |
| src/pages/Careers.tsx | Velocity + stuck + paths | ✅ |
| src/pages/Managers.tsx | Span + retention + revolving doors | ✅ |
| src/pages/Org.tsx | Dept sizes + growth + restructuring | ✅ |
| src/pages/Chat.tsx | Full chat UI | ✅ |
| src/pages/Insights.tsx | Taxonomy charts + move examples | ✅ |
| src/pages/PipelineHub.tsx | Launch/monitor/cancel/artifacts | ✅ |
| src/pages/Upload.tsx | Drag-drop + status + reload | ✅ |
| src/pages/Reports.tsx | LLM summary + export ZIP | ✅ |
| src/pages/SettingsPage.tsx | Read-only config display | ✅ |
| src/components/ui/*.tsx | 9 shared components | ✅ |
| src/components/charts/ChartTooltip.tsx | Custom glass tooltip | ✅ |
| src/components/layout/Sidebar.tsx | 5 nav groups + Pipeline Hub | ✅ |

### Docs
| File | Description | Status |
|---|---|---|
| docs/design-system.md | Full design token reference | ✅ |
| docs/api-deep-dive.md | Workforce API reference (10 routers) | ✅ |
| docs/pipeline-migration.md | Regata3010 → local adaptation mapping | ✅ |
| docs/mcp-integration.md | MCP + Skills architecture + troubleshooting | ✅ |
| .claude/rules/frontend.md | Frontend rules (workforce V2) | ✅ |
| .claude/rules/backend.md | Backend rules (workforce V2) | ✅ |

### CI/CD
| File | Description | Status |
|---|---|---|
| .github/workflows/test.yml | Run pytest on push/PR | ✅ |
| .github/workflows/pipeline-schedule.yml | Daily cron + manual dispatch | ✅ |

### MCP + Skills
| File | Description | Status |
|---|---|---|
| .mcp.json | 4 MCP server configs | ✅ |
| .mcp-data/memory/ | Persistent memory storage (gitignored) | ✅ |
| .claude/skills/gh-issues/SKILL.md | GitHub issue auto-fix skill | ✅ |
| .claude/skills/skill-lookup/SKILL.md | Skill discovery skill | ✅ |
| .claude/settings.local.json | GITHUB_TOKEN env var (gitignored) | ✅ |

---

## Next Improvements (Prioritized)

### Immediate (next session)
1. Fix any remaining frontend page rendering issues found during live testing
2. Configure `FIREBASE_PROJECT_ID` on Cloud Run to activate auth
3. Set up Sentry DSN for error monitoring
4. Test the AI Chatbot and Reports with a valid OpenAI key

### Short-term (this sprint)
5. Settings page write functionality (forms for thresholds, LLM config)
6. PDF report generation (via weasyprint or reportlab)
7. Synthetic data generator for missing fields (salary, performance ratings)
8. Code-split frontend with React.lazy + Suspense
9. Fix "nan" display in job titles for employees without history

### Medium-term
10. Redis Cloud or Memorystore for persistent ARQ queue
11. WebSocket authentication
12. Rate limiting on API endpoints
13. Mobile responsive sidebar
14. Create project-specific skills (deploy, test-all, release-notes)

### Long-term
15. Celery migration for production job queue
16. API versioning (v1/v2 prefix)
17. Multi-tenant support (multiple datasets/clients)
18. Real-time data connectors (Workday, BambooHR API)
19. i18n / localization
20. Accessibility audit (ARIA, keyboard nav)
