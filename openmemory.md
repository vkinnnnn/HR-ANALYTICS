# HR Workforce Analytics Platform — Session Memory

## Last Updated
2026-03-27 — Session 11: shadcn/ui, CSS fire orb, navigation agent, structured reports, user profile.

---

## Session History (Reverse Chronological)

### Session 11 — Major Feature Build (shadcn/ui, Navigation, Reports, Profile)

**Decision:** Did NOT fully migrate existing components to shadcn primitives (would break too much). Instead, installed shadcn as a parallel library — new features use shadcn, existing code untouched.

#### 11a — shadcn/ui Foundation
- Initialized shadcn/ui v4.1 with Tailwind v4 + Vite
- Added `@/*` path alias in tsconfig + vite.config
- Installed 14 components: button, card, badge, sheet, scroll-area, tooltip, separator, avatar, dropdown-menu, dialog, input, textarea, tabs
- Fixed CSS: dark-only `:root` (removed light mode), orange primary accent, kept Inter font
- Preserved custom Badge, Tabs, Panel, KpiCard, AnimatedNumber (no migration)
- Restored utils.ts (formatNumber, CHART_COLORS + shadcn's cn/twMerge)

#### 11b — CSS Fire Orb + Chat Rebuild
- Pure CSS `.fire-orb` class: radial-gradient, `flameShift` animation, `::after` glass reflection
- Resolution-independent — replaces all PNG references
- ChatTrigger: 56px CSS fire orb circle (no more img tags)
- ChatPanel: all fire-orb-sm.png → `.fire-orb` CSS class (header, message avatars, empty state)
- Removed model branding from header (no more "GPT-4o-mini" badge)
- Added `onNavigate` prop for AI-driven page navigation

#### 11c — Navigation Agent
- Backend: `NavigationCommand` model (action, route, scroll_to, highlight)
- System prompt: NAVIGATE: /route#section format
- `_parse_response` extracts navigation commands from LLM output
- `_detect_navigation` local fallback: keyword → route mapping for "show me", "take me to"
- Frontend: ChatPanel processes navigation → React Router navigate + scroll + highlight
- `ai-highlight-pulse` CSS: 3-pulse orange glow on target section
- Dashboard section IDs: kpi-cards, headcount-chart, turnover-chart, tenure-chart, flight-risk-table
- Panel component: added `id` prop

#### 11d — Onboarding Tour
- First-time detection via `localStorage.workforceiq_onboarded`
- Auto-opens chat panel after 2s with welcome system message
- "Restart Tour" option in profile dropdown resets localStorage

#### 11e — Structured Report Engine
- `POST /api/reports/generate`: structured JSON with sections, chart data, metrics, recommendations
- 4 sections: Workforce Composition, Turnover & Attrition, Tenure Analysis, Career Mobility
- Auto-generated recommendations with priority levels (critical/high/medium)
- LLM executive summary with local fallback
- Reports page: interactive rendering with embedded Recharts, metric cards, insight callouts

#### 11f — User Profile + Company Branding
- Sidebar: user avatar section with initials, name, role
- Profile dropdown: Settings, Restart Tour, Sign Out
- Settings page: Profile & Company section (name, role, company, industry)
- localStorage persistence (workforceiq_user_name, _role, _company, _industry)
- 8 role options (CEO → People Analyst), 7 industry options

#### 11g — Port/CORS Cleanup
- Backend CORS: added localhost:5173 (Vite default)
- API base URL: port 8004 (zombie processes on 8000-8003)

**Git Commits (Session 11):**
- shadcn/ui foundation
- CSS fire orb + chat rebuild + navigation plumbing
- Navigation agent + onboarding tour + section IDs
- Structured report engine + interactive report page
- User profile, company branding, sidebar identity

### Session 10 — Complete UI/UX Overhaul + AI Assistant Rebuild

**Scope:** 6 sub-sessions covering dashboard redesign, AI chatbot rebuild, multi-LLM support, and deep analysis engine.

#### 10a — Dashboard Visual Overhaul
- Rewrote PageHero component (gradient icon, subtitle at ml-52, orange underline)
- 4 KPI cards: Total Headcount (orange), Turnover Rate (rose), Avg Tenure (purple), New Hires 90d (emerald)
- AI Insight banner between KPIs and charts (data-driven anomaly text)
- Turnover chart: two-color system (rose above avg, emerald below) + dashed reference line
- Tenure distribution: 7 meaningful bins (0-6mo through 10yr+), rose for early-attrition
- Flight risk table: NaN→"Untitled Role", colored risk badges, CSS Grid, "Take Action" buttons
- Glass morphism: box-shadow added to .glass-panel, ChartTooltip with blur+shadow
- Backend: new_hires_90d, prior_hires_90d in workforce/summary; meaningful tenure bins + median

#### 10b — Multi-LLM Support + Settings
- Created `backend/app/llm.py` — unified LLM client (OpenRouter + OpenAI)
- `llm_call()` for chat (user-selected model), `llm_call_premium()` for reports (GPT-4o)
- OpenRouter default: `nvidia/nemotron-3-super-120b-a12b:free`
- Both OpenAI + OpenRouter API keys configured in `backend/.env`
- Settings router: GET/POST `/api/settings/llm` for runtime model switching
- Settings page: live provider/model picker, key status indicators, 8+ models
- Local fallback for chat + reports when no API key
- Reports use GPT-4o via OpenAI for premium quality
- Registered settings router in main.py
- Complete README rewrite

#### 10c — Fire Orb AI Assistant Identity
- **Product vision:** "Workforce IQ" — Bloomberg Terminal for people data
- Fire orb PNGs: `public/assets/fire-orb-{lg,md,sm}.png` from Figma exports
- CSS fallback: `.fire-orb-fallback` radial-gradient orb
- ChatTrigger: 56x56 fire orb circle with `orbGlow` pulse animation, notification badge
- Removed AI Chatbot page from sidebar nav + routes
- ChatPanel complete rebuild:
  - Header: fire-orb-sm + "Workforce AI" + dynamic model badge + Clear + Close
  - Empty state: 120px fire orb, welcome text, 2x2 starter prompt cards
  - Messages: fire-orb-sm avatar on AI messages, timestamp separators
  - System messages for proactive alerts (orange-tinted cards)
  - Typing: 3-dot `dotBounce` animation with fire orb avatar
  - Inline charts with highlight support
  - Input: 14px radius, focus glow ring, Escape to close
- App.tsx: proactive insights (danger zones + flight risk check on load), model name from settings API

#### 10d — Deep Analysis Chatbot Engine
- Backend chat.py complete rewrite with 16+ data sections in context:
  - Department stats (6 metrics each for 15 depts)
  - Flight risk top 10 with individual factors
  - Manager metrics (total/avg/max span, overhead, overload)
  - Career mobility (role changes, title changes, stuck 3yr+/5yr+)
  - Grade band + grade title distributions
  - Tenure distribution (7 bins)
  - Country/function/business unit breakdowns
  - **Hire cohort retention** (last 5 years: hired → retained → %)
  - **Manager retention analysis** (worst/best managers by report retention)
  - **Cross-metric correlations** (manager changes→departures, stagnation→churn, promotions→retention)
  - **Org structure** (manager-to-employee ratio)
  - Anomaly detection (100% churn depts, early attrition, no recent hires)
  - Page-specific context (varies by current page)
- Senior analyst system prompt with:
  - Industry benchmark comparisons (turnover 15-20%, tenure 4.1yr, span 5-8)
  - Metric definitions on demand
  - Root cause analysis, not just symptoms
  - Ambiguity resolution (notes assumptions)
  - Data storytelling structure (headline → changes → risks → actions)
- Multi-turn conversation (last 6 turns sent as history)
- Analysis type classification (comparative, trend, root_cause, predictive, risk, recommendation)
- Follow-up suggestions parsed from AI response, rendered as orange pills
- Rich local fallback with charts + suggestions for offline mode
- Frontend: conversation history in API calls, suggestion pills below AI messages

#### 10e — Turnover Two-Color Fix
- Bug: `companyAvgTurnover` computed from top-10 slice (all ~100%), making all bars emerald
- Fix: now uses `summary.turnover_rate` (55.0%) from company-wide data

#### 10f — Pipeline Fix
- `pipeline_runners.py` report_generate used old direct OpenAI call
- Fixed: now uses unified `llm.py` via `reports._llm_call` → `llm_call_premium`
- Added local summary fallback so pipeline never fails due to missing keys
- Stale `__pycache__` on Windows was root cause of "OPENAI_API_KEY not set" error

**All Files Created/Modified in Session 10:**
- `frontend/src/App.tsx` — full rewrite (3 times)
- `frontend/src/pages/Dashboard.tsx` — full rewrite
- `frontend/src/pages/SettingsPage.tsx` — full rewrite
- `frontend/src/components/chat/ChatTrigger.tsx` — NEW, then rewrite (fire orb)
- `frontend/src/components/chat/ChatPanel.tsx` — NEW, then 2 rewrites
- `frontend/src/components/ui/PageHero.tsx` — rewrite
- `frontend/src/components/ui/KpiCard.tsx` — rewrite
- `frontend/src/components/ui/AnimatedNumber.tsx` — rewrite
- `frontend/src/components/ui/InsightBanner.tsx` — rewrite
- `frontend/src/components/ui/SectionHeader.tsx` — fix
- `frontend/src/components/charts/ChartTooltip.tsx` — rewrite
- `frontend/src/components/layout/Sidebar.tsx` — removed AI Chatbot
- `frontend/src/index.css` — orbGlow, dotBounce, fire-orb-fallback, box-shadow
- `frontend/src/lib/api.ts` — port update (8000→8003)
- `frontend/public/assets/fire-orb-{lg,md,sm}.png` — NEW
- `backend/app/llm.py` — NEW (unified LLM client)
- `backend/app/config.py` — OpenRouter settings added
- `backend/app/main.py` — settings router registered
- `backend/app/routers/chat.py` — 3 rewrites (deep analysis engine)
- `backend/app/routers/reports.py` — unified LLM + local fallback
- `backend/app/routers/settings.py` — NEW
- `backend/app/routers/workforce.py` — new_hires_90d
- `backend/app/routers/tenure.py` — meaningful bins + median
- `backend/app/services/pipeline_runners.py` — unified LLM + fallback
- `backend/.env` — NEW (OpenRouter + OpenAI keys, gitignored)
- `.gitignore` — .env, backend/.env
- `.mcp.json` — removed stitch, added figma
- `README.md` — complete rewrite
- `openmemory.md` — this file

**Git Commits (Session 10):**
- `75c0db6` — feat: dashboard overhaul, AI chatbot panel, multi-LLM settings
- `4db27cd` — feat: fire orb AI assistant — product vision rebuild
- `54772d5` — feat: OpenAI + OpenRouter dual-key setup, GPT-4o for reports
- `8a8cd33` — feat: deep analysis chatbot — multi-turn, root cause, follow-up suggestions
- `697af32` — feat: advanced analytics — cohort retention, manager deep dive, correlations
- `352aa84` — fix: pipeline report_generate — use unified LLM with local fallback

### Session 9 — MCP + Skills Ecosystem
- Memory MCP, Context7 MCP, GitHub MCP, 2 local skills
- Commit: `4649d3f`

### Session 8 — Production Infrastructure
- ARQ + Redis, Firebase Auth, WebSocket, APScheduler, Sentry, GitHub Actions
- Commit: `a3448fe`

### Session 7 — Pipeline Orchestration
- PipelineRun model, batch_processor, run_manager, 5 runners, PipelineHub
- Commit: `7679f9d`

### Session 6 — Fix Page Crashes
- Commit: `3334c5c`

### Session 5 — Frontend-API Alignment (18 Mismatches)
- Commit: `93775aa`

### Session 4 — Bug Fixes + Taxonomy Dimensions
- Commit: `4688c76`

### Session 3 — Deterministic Taxonomy Engine
- Commit: `5ef279d`

### Session 2 — Cleanup, Types, Git Init
- Commits: `fef37a6`, `8539953`

### Session 1 — Full Platform Build + Pivot
- Built Recognition IQ → pivoted to Workforce Analytics
- Initial commit: `965cc63`

---

## Current State (Post-Session 10)

### Backend — 14 routers, 90+ endpoints
| Router | File | Key Features |
|--------|------|-------------|
| Workforce | workforce.py | 16 endpoints, new_hires_90d |
| Turnover | turnover.py | 11 endpoints, meaningful bins |
| Tenure | tenure.py | 8 endpoints, median_tenure_years |
| Careers | careers.py | 6 endpoints |
| Managers | managers.py | 6 endpoints |
| Org | org.py | 6 endpoints |
| Predictions | predictions.py | 4 endpoints (flight risk ML) |
| Chat | chat.py | Deep analysis engine, multi-turn, 16 data sections |
| Reports | reports.py | GPT-4o premium + local fallback |
| Upload | upload.py | 3 endpoints |
| **Settings** | **settings.py** | **GET/POST LLM config, runtime model switching** |
| Taxonomy | taxonomy_router.py | 6 endpoints |
| Pipeline | pipeline_router.py | 11 endpoints |
| WebSocket | ws.py | 2 WS endpoints |

### Shared Modules
| Module | Purpose |
|--------|---------|
| `llm.py` | Unified LLM client (OpenRouter/OpenAI), `llm_call()` + `llm_call_premium()` |
| `config.py` | Pydantic settings with OpenRouter + OpenAI + Bedrock support |
| `data_loader.py` | CSV load → join → enrich → taxonomy → cache |
| `taxonomy.py` | Deterministic grade/function/title/career classifier |

### Frontend — 13 pages + fire orb AI panel
| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/` | Full redesign: 4 KPIs, insight banner, two-color turnover, glass panels |
| Workforce | `/workforce` | 8 dimension tabs |
| Turnover | `/turnover` | Rates + trend + danger zones |
| Tenure | `/tenure` | Cohorts + retention curve |
| Flight Risk | `/flight-risk` | ML scores + features |
| Careers | `/careers` | Velocity + stuck + paths |
| Managers | `/managers` | Span + retention + revolving doors |
| Org Structure | `/org` | Dept sizes + growth + restructuring |
| AI Insights | `/insights` | Taxonomy charts |
| Pipeline Hub | `/pipeline` | Launch/monitor/cancel |
| Upload | `/upload` | Drag-drop CSV |
| Reports | `/reports` | LLM summary + export ZIP |
| **Settings** | `/settings` | **Live LLM provider/model picker** |
| ~~AI Chatbot~~ | ~~`/chat`~~ | **REMOVED — replaced by fire orb side panel** |

### AI Assistant (Fire Orb)
- Fire orb trigger: 56px circle, bottom-right, glow pulse animation
- 420px slide-out panel, content compresses (not obscured)
- "Workforce AI" header with dynamic model badge
- Empty state: 120px orb, welcome text, 2x2 starter cards
- Multi-turn conversations (6-turn history)
- Deep analysis: 16 data sections, benchmarking, root cause, cohort, correlations
- Inline charts in AI messages
- Follow-up suggestion pills
- Proactive anomaly detection on app load
- Chart-click → auto-ask integration
- Escape to close, chat persists across navigation

### LLM Configuration
| Feature | Provider | Model |
|---------|----------|-------|
| Chat | OpenRouter (default) | nvidia/nemotron-3-super-120b-a12b:free |
| Reports | OpenAI (always) | gpt-4o |
| Fallback | Local | Data-driven pattern matching |
| Switching | Settings page | Runtime, no restart needed |

### MCP Ecosystem
| Server | Purpose | Status |
|--------|---------|--------|
| Memory | Persistent knowledge graph | Active |
| Context7 | Library docs lookup | Active |
| GitHub | Issues/PRs/commits | Active |
| Figma | Design validation | Installed (needs OAuth) |
| ~~Stitch~~ | ~~Google Gemini~~ | **Removed** (missing API key) |

---

## Known Issues

1. **Port 8000 zombie processes** — Windows doesn't release sockets. Backend runs on port 8003.
2. **new_hires_90d = 0** — Dataset is historical, no hires in last 90 days. Correct behavior.
3. **gcloud not in PATH** — Use full path for deployment commands.
4. **Suggestions parsing** — Some models don't follow SUGGESTIONS: format consistently.

---

## Architecture Decisions

1. **Workforce, not recognition** — permanent pivot from Session 1
2. **CSV → pandas → in-memory cache** — no SQL for analytics, SQLite only for pipeline metadata
3. **Unified LLM client** — `llm.py` is single source of truth for all LLM calls
4. **OpenRouter default** — free tier for chat, OpenAI GPT-4o for premium reports
5. **Fire orb, not page** — AI assistant is always-present side panel, not a navigation destination
6. **Deep context, not RAG** — pre-compute 16 data sections per query, no vector search needed
7. **Multi-turn via history** — send last 6 turns in API call, not server-side session storage
8. **Local fallback everywhere** — chat, reports, pipeline all work without API keys
9. **Deterministic taxonomy** — rule-based, not LLM-dependent
10. **Design system preserved** — CodeRabbit dark theme, glass morphism, orange accent

---

## Data Understanding

### Dataset (Workhuman workforce data)
| File | Rows | Key Columns |
|------|------|-------------|
| function_wh.csv | 2,466 | PK_PERSON, Hire, Expire, job_title, grade_title, function_title, department_name, country |
| wh_history_full.csv | 11,803 | pk_user, fk_direct_manager, job_title, effective_start_date, effective_end_date |
| wh_user_history_v2.csv | 100 | pk_user, fk_direct_manager, job_title, position_title, dates |

### Key Stats
- Total: 2,466 | Active: 1,110 (45%) | Departed: 1,356 (55%)
- Turnover: 55.0% | Avg tenure: 3.9yr active | Median: 2.6yr
- 37 departments | 15 countries | 25 grades | 151 functions | 869 job titles
- 222 managers | Avg span: 2.92 | Max span: 13
- 3,297 career moves classified

### Environment Variables
| Variable | Location | Purpose |
|----------|----------|---------|
| LLM_PROVIDER | backend/.env | `openrouter` or `openai` |
| OPENROUTER_API_KEY | backend/.env | Chat LLM |
| OPENROUTER_MODEL | backend/.env | Default: nemotron-3-super-120b-a12b:free |
| OPENAI_API_KEY | backend/.env | Reports LLM (GPT-4o) |
| OPENAI_MODEL | backend/.env | Default: gpt-4o-mini |
| GITHUB_PERSONAL_ACCESS_TOKEN | .claude/settings.local.json | GitHub MCP |
