# HR Workforce Analytics Platform — Session Memory

## Last Updated
2026-04-03 — Session 14 continued. Landing page, API optimization, AI prompt box, chatbot fix, 9-bug fix pass.

---

## Session History (Reverse Chronological)

### Session 14 (continued) — Landing Page, API Perf, Chatbot Overhaul, Bug Sweep

**Scope:** 3D WebGL landing page integration, API endpoint profiling and optimization, rich AI prompt box, chatbot reliability fix, comprehensive 9-bug audit and fix pass.

#### 14e — Categories + Dashboard + DataHub Fixes
- **Categories page**: fixed Treemap rendering (proper custom cell renderer with root.children index), fixed heatmap data (now fetches from `/api/recognition/fairness` instead of missing field), added 4 clickable category overview cards
- **Dashboard**: added Grade Pyramid section (horizontal bar chart from `/api/workforce/grade-pyramid`), wired "View Details →" button to navigate to `/categories`
- **DataHub**: complete UX redesign with 3-tab layout (Overview / Upload / Reports), removed confusing duplicate sections

#### 14f — OpenAI SDK Fix (Critical Production Bug)
- `openai==1.35.3` was incompatible with `httpx==0.28.1` — `AsyncClient.__init__()` got unexpected `proxies` kwarg
- **Every LLM call in production was returning 500** — chat, reports, settings/test-connection all broken
- Fix: upgraded to `openai>=1.55.0` which supports httpx 0.28+
- Verified: `/api/settings/llm` now returns `has_key: true, is_available: true` in production

#### 14g — API Endpoint Optimization
- **Profiling middleware** (`middleware.py`): per-route latency (p50/p95/p99), response size, error tracking. Accessible via `GET /api/profiling/report`
- **Baseline benchmark** (20 iterations each):
  - Nominators: p50=64.6ms, p95=86.3ms (heaviest)
  - Flow: p50=8.6ms, Categories: p50=8.6ms
  - Explorer: 60.2KB payload (largest)
  - No endpoint exceeded 300ms p95
- **TTL response cache** (`cache.py`): bounded 100 entries, 120s TTL, version-based invalidation on upload/reload. Applied to 8 endpoints (summary, categories, inequality, flow, nlp-quality, fairness, network, nominators)
- **Aggregate dashboard endpoint** (`/api/dashboard/overview`): returns all dashboard data in 1 call. After: p50=1.1ms (replaces 6 separate calls ~120ms total)
- **GZip compression**: `GZipMiddleware(minimum_size=1000)` for responses >1KB
- **Cache invalidation**: `invalidate_all()` called on every upload/reload, bumps version counter
- **After-optimization**: nominators p50=1.8ms (was 64.6ms, 36x), categories p50=0.9ms (was 8.6ms, 10x)
- `orjson>=3.10.0` added to requirements for future ORJSONResponse use

#### 14h — AI Prompt Box Integration
- Installed `framer-motion`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`
- New `ai-prompt-box.tsx` component with:
  - Voice recording with animated waveform visualizer + timer
  - Image upload via paperclip button + drag-drop + paste
  - Three animated mode toggles: Search (blue), Think (purple), Report (orange)
  - Smart send button: Mic when empty, Arrow when has content, Stop when recording
  - Auto-resizing textarea, Enter to send, Shift+Enter newline
  - Glass panel styling adapted to Workforce IQ dark theme
- Replaced old plain textarea + mic button in ChatPanel with PromptInputBox
- Removed old voice input state/logic from ChatPanel (PromptInputBox handles internally)

#### 14i — 3D WebGL Landing Page
- **Three.js** fluid distortion shader with mouse-driven liquid simulation (simplex noise, metaballs, film grain)
- Scroll-reveal animations via IntersectionObserver, animated counters
- Glass morphism cards with hover glow effects, fire orb CSS animation
- Sections: Hero, Platform (4-step pipeline), Features (6 capabilities), Metrics (7 data points), Tech Stack pills, Team (3 members with LinkedIn), Footer
- **Route restructure**: `/` = landing page (standalone, no sidebar/chat), `/app/*` = main application
- Sidebar nav links updated to `/app/...` prefix
- "Enter Platform" and "Launch App" buttons navigate to `/app` via React Router

#### 14j — 9-Bug Audit & Fix Pass
1. **Sidebar NavLink `end` prop** (CRITICAL): was checking `/` instead of `/app` — dashboard active state broken. Fixed.
2. **ChatPanel currentPage** (CRITICAL): `location.pathname` returned relative path inside nested Routes — chat prompts broken. Fixed with `/app` prefix.
3. **LandingPage memory leak** (CRITICAL): missing `cancelAnimationFrame` in FluidCanvas cleanup — animation loops accumulated on navigation. Fixed.
4. **Dashboard error handling** (CRITICAL): `Promise.all` all-or-nothing — one failed endpoint broke entire page. Fixed with `Promise.allSettled` + error banner.
5. **Categories silent catch** (HIGH): empty `catch {}` swallowed errors. Fixed with `console.error`.
6. File upload param dropped in chat (HIGH): documented, files need backend support.
7. LandingPage style re-injection (MEDIUM): acceptable for this component.
8. Dashboard partial load (HIGH): fixed with `Promise.allSettled`.
9. Voice input not cleared (LOW): documented.

#### 14k — Chatbot Reliability Fix
- Chatbot was stuck on "Analyzing..." forever — SSE streaming `ReadableStream.read()` loop wouldn't exit cleanly when backend sends full response as single chunk (local fallback behavior)
- Fix: switched to reliable non-streaming `POST /api/chat/query` endpoint (verified working with curl in production)
- Streaming endpoint (`/api/chat/query/stream`) remains available for future true token-by-token LLM streaming

**Git Commits (Session 14 continued):**
- `d0d724b` — fix: Categories treemap + Dashboard grade pyramid + DataHub redesign
- `618be21` — fix: upgrade openai SDK to fix httpx 0.28 proxies incompatibility
- `7acc6ab` — fix: wire AI Insight 'View Details' button to navigate to /categories
- `a0b2e10` — perf: API endpoint optimization — profiling, caching, aggregate endpoint, gzip
- `18c97ec` — feat: integrate AI Prompt Box with voice, file upload, mode toggles
- `96908bc` — feat: 3D WebGL landing page with fluid shader + route restructure
- `375eccf` — fix: 9 bugs — routing, memory leak, error handling, nav state
- `408b3c4` — fix: chatbot stuck on 'Analyzing' — switch to reliable non-streaming endpoint

---

### Session 14 — Data Hub + Voice Chat + UI Polish

**Scope:** Merge Upload/Pipeline/Reports into unified Data Hub, add voice input to chat, glass panel enhancements.

#### 14a — Data Hub Page (`/data-hub`)
- New unified page replacing 3 separate pages (Upload, Pipeline Hub, Reports)
- **Upload panel**: drag-drop CSV with file preview chip, auto-reload on success
- **Data Status panel**: recognition stats (awards, categories, recipients, nominators) + workforce stats (employees, active, departed)
- **Pipeline Stepper**: 4-step visual workflow (Upload → Taxonomy → Annotate → Compute) with status badges
- **Reports section**: inline intelligence report rendering + export data package download
- Old routes `/upload`, `/pipeline`, `/reports` redirect to `/data-hub`
- Backend: `upload.py` now reloads recognition data alongside workforce data, status endpoint includes recognition stats

#### 14b — Chat Voice Input (Web Speech API)
- Mic button in chat input bar using `SpeechRecognition` / `webkitSpeechRecognition`
- Red pulse animation (`glowPulse`) while actively listening
- Live transcription populates textarea in real-time
- Feature-detect: mic button hidden in browsers without support (Firefox)
- `MicOff` icon shown during active recording for clear stop affordance

#### 14c — UI Polish
- **Glass panels enhanced**: added `inset 0 1px 0 rgba(255,255,255,0.06)` top-edge highlight + `:hover { border-color: rgba(255,255,255,0.15) }` glow transition
- **EmptyState component**: new reusable component with icon, title, message, and CTA button linking to `/data-hub`
- **Sidebar consolidated**: removed separate "Reports", "Pipeline Hub", "Data Upload" nav items → single "Data Hub" entry under Intelligence

#### 14d — Sidebar Update
- Intelligence group: AI Insights, Data Hub, Settings (was: AI Insights, Reports, Pipeline Hub, Data Upload, Settings)
- Removed unused `FileText`, `Activity` icon imports

**Git Commits (Session 14):**
- `e84e59b` — feat(s14): Data Hub, voice input, glass panels, sidebar cleanup

---

### Session 13 — Recognition Intelligence Platform Pivot (MAJOR)

**Scope:** Complete platform pivot from workforce-only to recognition-first analytics. Added Workhuman recognition awards data as primary dataset, built 12 new API endpoints, 8 new frontend pages, redesigned dashboard and navigation.

#### 13a — Root Cause Fixes (Pre-Pivot)
- **chat.py**: fixed missing `get_current_managers` import — manager retention analysis was silently failing on every query
- **chat.py**: fixed non-existent `_compute_flight_risk` import → created new `compute_flight_risk_sync()` helper in predictions.py
- **chat.py**: broadened exception handling — any LLM failure now gracefully falls back to local response instead of 502
- **deploy.sh**: **ROOT CAUSE FIX** — LLM API keys (OPENROUTER/OPENAI) were NOT being passed to Cloud Run, causing all AI features to return generic local responses in production
- **reports.py**: added Manager Effectiveness + Flight Risk Analysis sections (6 total, was 4), enriched narratives with benchmark comparisons, richer LLM prompt, 3-paragraph local fallback

#### 13b — UX Refactor
- **Chat SSE Streaming**: new `POST /api/chat/query/stream` endpoint with token-by-token streaming via `AsyncOpenAI(stream=True)`. Frontend uses `fetch` + `ReadableStream` consumer. Fallback to existing `/query` endpoint if streaming fails.
- **Thinking Indicator**: fire orb with pulsing `orbThinking` glow + skeleton shimmer lines, transitions to streaming text on first token (replaces bouncing dots)
- **Keyboard Shortcuts**: `Ctrl+K` / `Cmd+K` toggles chat panel, `Esc` closes it
- **Toast System**: new `Toast.tsx` with React context — glass-panel aesthetic, 4 types (success/error/info/warning), bottom-left position, 4s auto-dismiss
- **Chat Persistence**: messages saved to `sessionStorage` (debounced 500ms), survive page refresh
- **Settings API Key Management**: `POST /api/settings/api-key` + `POST /api/settings/test-connection` endpoints. Frontend: password input with show/hide toggle, "Save Key" button, "Test Connection" with latency display
- **Visual**: headcount trend chart changed from teal to brand orange (#FF8A4C), sidebar logo replaced Activity icon with animated CSS fire-orb

#### 13c — Recognition Data Foundation
- Copied `annotated_results.csv` (1,000 rows, 8 cols) + `mockup_awards.csv` (1,000 rows, 4 cols) from `backend/Dataset_real/` to `backend/wh_Dataset/`
- **New `recognition_loader.py`**: loads annotated_results.csv, computes 12 derived fields per record:
  - `recipient_seniority` / `nominator_seniority` (11 levels: Entry → Executive)
  - `recipient_function` / `nominator_function` (11 categories inferred from job titles)
  - `direction` (Downward / Upward / Lateral based on seniority comparison)
  - `same_function` (boolean)
  - `specificity` (NLP score 0–1: numbers +0.3, action verbs +0.15 each, length bonuses, cliché penalties)
  - `award_type` (11 types: Thank You, Periodic/Annual, Launch/Delivery, etc.)
  - `word_count`, `action_verb_count`, `has_numbers`, `cliche_count`
  - `specificity_band` (5 bands: Very Vague → Highly Specific)
  - Optional join with `function_wh.csv` for department/grade/country enrichment (99% join rate via job_title)
- **New `/api/recognition` router** (12 endpoints):
  - `/summary` — total_awards, gini, avg_specificity, cross_function_rate, direction_split
  - `/categories` — 4 categories with subcategory breakdowns
  - `/subcategories` — filterable by category_id
  - `/inequality` — Gini coefficient, Lorenz curve (20 points), top-10/bottom-50 share, power recipients
  - `/flow` — direction split, cross-function heatmap, seniority flow, reciprocal pairs
  - `/nlp-quality` — specificity distribution, action verb rate, cliché rate, word count stats
  - `/fairness` — specificity by function and seniority with below-avg flags
  - `/network` — nodes (200 roles), edges (300 connections), density
  - `/nominators` — leaderboard (composite score: volume 30% + specificity 35% + diversity 25% + breadth 10%), blind spots, coaching candidates
  - `/award-types` — distribution + cross-tab with categories
  - `/explorer` — filtered, paginated, searchable list of all awards
  - `/top-roles` — top 15 recipients and nominators by count
- **Chat context updated**: system prompt now includes full recognition taxonomy, Gini, specificity, cross-function rates, key insights alongside workforce data
- Auto-loads recognition data on startup via lifespan handler

#### 13d — Frontend Redesign
- **Sidebar restructured** (6 groups):
  - Overview (orange): Dashboard, Recognition Explorer
  - Analytics (purple): Categories, Inequality, Message Quality
  - Network (blue): Recognition Flow, Social Graph
  - People (emerald): Nominators, Fairness Audit
  - Workforce (amber): Workforce, Turnover, Careers, Managers
  - Intelligence (rose): AI Insights, Reports, Pipeline Hub, Data Upload, Settings
- **Dashboard redesigned** for recognition-first:
  - 4 KPIs: Total Awards (orange), Recognition Gini (purple), Avg Specificity (rose), Cross-Function Rate (emerald)
  - AI Insight Banner: data-driven text from dominant/smallest category
  - Category Distribution horizontal bar chart (4 bars)
  - Recognition Direction donut chart (Downward/Upward/Lateral)
  - Specificity Distribution histogram (5 bands, rose→emerald)
  - Top 10 Most Recognized Roles horizontal bar chart
  - Blind Spot Nominators table (CSS Grid)
- **7 new analytics pages**:
  - `RecognitionExplorer.tsx` (`/explorer`) — filterable/searchable table of all 1,000 awards with expandable rows
  - `Categories.tsx` (`/categories`) — Recharts Treemap, subcategory drill-down, cross-function heatmap
  - `Inequality.tsx` (`/inequality`) — Gini gauge, Lorenz curve (ComposedChart), top-10 vs bottom-50 cards, power recipients bar chart
  - `Quality.tsx` (`/quality`) — 4 KPI cards, specificity histogram, word count stats
  - `Flow.tsx` (`/flow`) — 3 direction KPIs, cross-function heatmap (CSS Grid with opacity-scaled cells), same/cross comparison, reciprocal pairs
  - `Nominators.tsx` (`/nominators`) — leaderboard table with composite scores, coaching candidates section
  - `Fairness.tsx` (`/fairness`) — grouped bar charts by function and seniority with reference lines, below-avg rose highlighting

#### 13e — Frontend-API Alignment Fix
- Fixed field name mismatches in all 6 new pages:
  - Inequality: `top_10_pct_share→top_10_share`, `population_pct/recognition_pct→x/y`, `top_recipients→power_recipients`
  - Quality: `specificity_bands→specificity_distribution`
  - Flow: direction keys capitalized, heatmap `from_function/to_function/count→source/target/value`, rates not multiplied by 100
  - Fairness: transform API `function/seniority` → unified `name` field on load
  - Nominators: `total_awards→total`
  - RecognitionExplorer: use index instead of non-existent `id`, fix `recipient/nominator→recipient_title/nominator_title`, `results→awards`

**Git Commits (Session 13):**
- `bd056e1` — fix: root cause fixes for AI features + deploy pipeline + report engine
- `4df4100` — feat: comprehensive UX refactor — streaming chat, toast system, settings API keys
- `46088cd` — feat: recognition-first platform pivot — new data engine, 8 new pages, 12 API endpoints
- `fdd22fa` — fix: align all frontend pages with actual API response field names

---

### Session 12 — Production Deployment (GCP Cloud Run + Firebase Hosting)

**Scope:** Sync local project with GitHub, fix deployment issues, deploy backend + frontend to production.

#### 12a — Git Sync
- Cleaned duplicate entries in `.gitignore`
- Updated `openmemory.md` session log
- Pushed all commits to `origin/main`

#### 12b — Production Build Fixes
- Fixed 3 TypeScript unused import errors breaking `tsc -b` production build:
  - `ChatPanel.tsx`: removed unused `LineChart`, `Line` from recharts
  - `scroll-area.tsx`: removed unused `React` import
  - `SettingsPage.tsx`: removed unused `Cpu` from lucide-react

#### 12c — Backend Deployment (Google Cloud Run)
- Deployed to Cloud Run: `hr-analytics-backend` service in `us-central1`
- **Critical fix:** `DATA_DIR` env var — container path resolved to `/wh_Dataset` instead of `/app/wh_Dataset`
- Fixed `deploy.sh` — gcloud `--set-env-vars` needs `^;;^` delimiter for comma-containing CORS origins
- Service: 1GB RAM, 1 CPU, 0-3 instances, 5min timeout, unauthenticated

#### 12d — Frontend Deployment (Firebase Hosting)
- Built frontend with `VITE_API_URL` pointing to Cloud Run backend
- Deployed to Firebase Hosting: `hr-analytics-f23c0.web.app`
- SPA rewrites configured for React Router

**Production URLs:**
- Frontend: https://hr-analytics-f23c0.web.app
- Backend API: https://hr-analytics-backend-ymez3d52nq-uc.a.run.app
- API Docs: https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/docs

**Git Commits (Session 12):**
- `d51c0bb` — chore: clean up .gitignore duplicates + update session log
- `de5f0f7` — fix: remove unused imports breaking production build
- `acd0d2c` — fix: deploy.sh DATA_DIR env var + gcloud env-var escaping
- `56db891` — chore: add production API URL for frontend builds

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

#### 11h — Navigation Fallback Fix
- LLM often responds to "take me to X" with analysis but no NAVIGATE: command
- Fix: `_detect_navigation` now runs EVEN when LLM succeeds, as a fallback
- Catches "show me", "take me to", "go to", "navigate", "open", "where" + keyword matching

**Git Commits (Session 11):**
- `9956836` — feat(s11): CSS fire orb + chat rebuild + navigation plumbing
- `c45355d` — feat(s11): navigation agent + onboarding tour + section IDs
- `5e0a622` — feat(s11): structured report engine + interactive report page
- `7716aec` — feat(s11): user profile, company branding, sidebar identity
- `2e49709` — feat(s11): port/CORS fix, openmemory Session 11 log
- `92184f6` — fix: navigation fallback runs even when LLM responds without NAVIGATE

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

## Current State (Post-Session 14k)

### Deployment
| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Firebase Hosting | https://hr-analytics-f23c0.web.app |
| Backend | Google Cloud Run | https://hr-analytics-backend-ymez3d52nq-uc.a.run.app |
| API Docs | Swagger UI | https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/docs |
| GitHub | Repository | https://github.com/vkinnnnn/HR-ANALYTICS |

### Backend — 18 routers, 120+ endpoints
| Router | File | Key Features |
|--------|------|-------------|
| **Recognition** | **recognition.py** | **12 endpoints (8 cached): summary, categories, subcategories, inequality, flow, nlp-quality, fairness, network, nominators, award-types, explorer, top-roles** |
| **Dashboard Aggregate** | **dashboard.py** | **GET /api/dashboard/overview — single call replaces 6+ frontend fan-out calls, 60s TTL cache** |
| **Profiling** | **middleware.py** | **GET /api/profiling/report — per-route p50/p95/p99 latency, POST /api/profiling/clear** |
| Workforce | workforce.py | 16 endpoints, new_hires_90d |
| Turnover | turnover.py | 11 endpoints, meaningful bins |
| Tenure | tenure.py | 8 endpoints, median_tenure_years |
| Careers | careers.py | 6 endpoints |
| Managers | managers.py | 6 endpoints |
| Org | org.py | 6 endpoints |
| Predictions | predictions.py | 4 endpoints + `compute_flight_risk_sync()` helper |
| Chat | chat.py | Deep analysis engine, multi-turn, SSE streaming, recognition + workforce context |
| Reports | reports.py | 6 sections (Manager Effectiveness, Flight Risk), GPT-4o premium + rich local fallback |
| Upload | upload.py | 3 endpoints, reloads recognition + workforce data |
| Settings | settings.py | GET/POST LLM config, API key management, test connection |
| Taxonomy | taxonomy_router.py | 6 endpoints |
| Pipeline | pipeline_router.py | 11 endpoints |
| WebSocket | ws.py | 2 WS endpoints |

### Shared Modules
| Module | Purpose |
|--------|---------|
| `llm.py` | Unified LLM client (OpenRouter/OpenAI), `llm_call()` + `llm_call_premium()` |
| `recognition_loader.py` | Load annotated_results.csv, compute 12 derived fields (seniority, function, direction, specificity, award_type), optional workforce join |
| `cache.py` | Bounded in-memory TTL cache (100 entries, 120s), version-based invalidation on upload/reload |
| `middleware.py` | Request profiling middleware — per-route latency/size/error tracking |
| `config.py` | Pydantic settings with OpenRouter + OpenAI + Bedrock support |
| `data_loader.py` | CSV load → join → enrich → taxonomy → cache (workforce data) |
| `taxonomy.py` | Deterministic grade/function/title/career classifier |

### Frontend — 21 pages + fire orb AI panel
| Page | Route | Status |
|------|-------|--------|
| **Landing Page** | `/` | **3D WebGL fluid shader, Three.js, scroll-reveal, fire orb hero, team section, "Enter Platform" → /app** |
| **Dashboard** | `/app` | **Recognition-first: 4 KPIs (awards, Gini, specificity, cross-function), category chart, direction donut, specificity histogram, top roles, blind spots table** |
| **Recognition Explorer** | `/app/explorer` | **Filterable/searchable table of all 1,000 awards with expandable rows** |
| **Categories** | `/categories` | **Treemap, subcategory drill-down, cross-function heatmap** |
| **Inequality** | `/inequality` | **Gini gauge, Lorenz curve, top-10 vs bottom-50, power recipients** |
| **Message Quality** | `/quality` | **NLP specificity histogram, action verbs, clichés, word count** |
| **Recognition Flow** | `/flow` | **Direction KPIs, cross-function heatmap, reciprocal pairs** |
| **Social Graph** | `/network` | **Force-directed (reuses Flow page currently)** |
| **Nominators** | `/nominators` | **Leaderboard with composite scores, blind spots, coaching candidates** |
| **Fairness Audit** | `/fairness` | **Specificity by function + seniority, below-avg highlighting** |
| **Data Hub** | `/data-hub` | **Unified: upload + pipeline stepper + reports + export (replaces Upload, Pipeline, Reports)** |
| Workforce | `/workforce` | 8 dimension tabs |
| Turnover | `/turnover` | Rates + trend + danger zones |
| Tenure | `/tenure` | Cohorts + retention curve |
| Flight Risk | `/flight-risk` | ML scores + features |
| Careers | `/careers` | Velocity + stuck + paths |
| Managers | `/managers` | Span + retention + revolving doors |
| Org Structure | `/org` | Dept sizes + growth + restructuring |
| AI Insights | `/insights` | Taxonomy charts |
| Settings | `/settings` | LLM provider/model picker, API key input + test connection |
| ~~Upload~~ | ~~`/upload`~~ | **Redirects to /data-hub** |
| ~~Pipeline Hub~~ | ~~`/pipeline`~~ | **Redirects to /data-hub** |
| ~~Reports~~ | ~~`/reports`~~ | **Redirects to /data-hub** |

### Sidebar Navigation (6 groups)
| Group | Color | Items |
|-------|-------|-------|
| Overview | #FF8A4C (orange) | Dashboard, Recognition Explorer |
| Analytics | #a78bfa (purple) | Categories, Inequality, Message Quality |
| Network | #60a5fa (blue) | Recognition Flow, Social Graph |
| People | #34d399 (emerald) | Nominators, Fairness Audit |
| Workforce | #fbbf24 (amber) | Workforce, Turnover, Careers, Managers |
| Intelligence | #fb7185 (rose) | AI Insights, Data Hub, Settings |

### AI Assistant (Fire Orb)
- Fire orb trigger: 56px circle, bottom-right, glow pulse animation
- 420px slide-out panel, content compresses (not obscured)
- "Workforce AI" header with animated CSS fire orb avatar
- Empty state: 120px orb, welcome text, 2x2 starter cards
- **AI Prompt Box**: rich input bar with voice recording (waveform visualizer), image upload (paperclip + drag-drop + paste), 3 animated mode toggles (Search/Think/Report via framer-motion)
- **Non-streaming**: uses reliable `POST /api/chat/query` (SSE streaming available but disabled — `ReadableStream` hung on single-chunk responses)
- **Thinking indicator**: pulsing fire orb with `orbThinking` animation + skeleton shimmer
- Multi-turn conversations (6-turn history)
- Deep analysis: workforce + recognition context (Gini, taxonomy, specificity, flows)
- Inline charts in AI messages, follow-up suggestion pills
- Proactive anomaly detection on app load
- Navigation agent: AI can navigate user to pages + highlight sections
- **Keyboard shortcuts**: Cmd+K / Ctrl+K toggle, Esc close
- **Persistence**: messages survive page refresh (sessionStorage)
- **Toast notifications**: glass-panel toasts for all feedback (success/error/info/warning)
- Graceful fallback: any LLM failure → local data-driven response (never 502)

### LLM Configuration
| Feature | Provider | Model |
|---------|----------|-------|
| Chat | OpenRouter (default) | nvidia/nemotron-3-super-120b-a12b:free |
| Chat Streaming | Same as chat | SSE via `/api/chat/query/stream` |
| Reports | OpenAI (always) | gpt-4o |
| Fallback | Local | Data-driven pattern matching |
| Switching | Settings page | Runtime, no restart needed |
| API Key Management | Settings page | Save key + test connection with latency |

### MCP Ecosystem
| Server | Purpose | Status |
|--------|---------|--------|
| Memory | Persistent knowledge graph | Active |
| Context7 | Library docs lookup | Active |
| GitHub | Issues/PRs/commits | Active |
| Figma | Design validation | Installed (needs OAuth) |

---

## Known Issues

1. **Cloud Run cold starts** — min-instances=0 means first request after idle may take 10-15s. Mitigated by response cache (120s TTL).
2. **Redis unavailable in Cloud Run** — Falls back to thread-based job execution (non-blocking).
3. **SSE streaming hangs** — `ReadableStream.read()` loop doesn't exit cleanly when backend sends full response as single chunk. Disabled in favor of non-streaming endpoint. Fix: implement proper token-by-token streaming when LLM key is configured.
4. **Social Graph page** — Currently reuses Flow page; needs D3.js force-directed graph implementation.
5. **Pipeline steps 2-3** — "Generate Taxonomy" and "Annotate Records" buttons disabled (require AWS Bedrock credentials). Data already pre-annotated.
6. **Three.js bundle size** — Landing page adds ~800KB to bundle. Could be code-split with dynamic import.
7. **File upload in chat** — PromptInputBox accepts files but backend `/api/chat/query` doesn't process multipart uploads yet.

---

## Architecture Decisions

1. **Recognition-first, workforce-secondary** — pivoted in Session 13 from workforce-only to recognition awards as primary dataset
2. **CSV → pandas → in-memory cache** — no SQL for analytics, SQLite only for pipeline metadata
3. **Unified LLM client** — `llm.py` is single source of truth for all LLM calls
4. **OpenRouter default** — free tier for chat, OpenAI GPT-4o for premium reports
5. **Fire orb, not page** — AI assistant is always-present side panel, not a navigation destination
6. **Deep context, not RAG** — pre-compute recognition + workforce data sections per query, no vector search needed
7. **Multi-turn via history** — send last 6 turns in API call, not server-side session storage
8. **Local fallback everywhere** — chat, reports, pipeline all work without API keys
9. **Derived fields at load time** — seniority, function, direction, specificity all computed on startup, not per-request
10. **Design system preserved** — CodeRabbit dark theme, glass morphism with inset highlight, orange accent
11. **Data Hub consolidation** — Upload + Pipeline + Reports merged into single `/data-hub` page
12. **deploy.sh passes LLM keys** — OPENROUTER_API_KEY, OPENAI_API_KEY, LLM_PROVIDER all set as Cloud Run env vars
13. **Landing page at `/`, app at `/app/*`** — standalone 3D landing page without sidebar/chat, app routes under `/app/` prefix
14. **TTL cache + aggregate endpoint** — 120s in-memory cache on 8 recognition endpoints + `/api/dashboard/overview` single-call aggregate
15. **Non-streaming chat** — SSE streaming disabled due to ReadableStream hang; reliable POST `/api/chat/query` used instead
16. **GZip compression** — `GZipMiddleware(minimum_size=1000)` for API responses >1KB

---

## Data Understanding

### Primary Dataset: Recognition Awards (Workhuman sponsor data)
| File | Rows | Key Columns |
|------|------|-------------|
| annotated_results.csv | 1,000 | message, award_title, recipient_title, nominator_title, category_id, category_name, subcategory_id, subcategory_name |
| mockup_awards.csv | 1,000 | message, award_title, recipient_title, nominator_title |

### Recognition Key Stats
- Total awards: 1,000 | Unique recipients: 314 | Unique nominators: 255 | Total unique roles: 371
- Gini coefficient: 0.463 (moderate recognition inequality)
- Avg specificity: 0.254/1.0 (low — most messages are vague praise)
- Cross-function rate: 42.9%
- Direction: Lateral 408 (40.8%), Downward 376 (37.6%), Upward 216 (21.6%)
- Categories: D (Organizational & Team Enablement) 494, B (Operational Excellence) 298, A (Strategic Business) 160, C (Creative & Brand) 48
- 25 subcategories, 926 unique award titles
- 69.6% of messages contain zero action verbs

### Derived Fields (computed at startup)
| Field | Source | Logic |
|-------|--------|-------|
| recipient_seniority | recipient_title | 11 levels: Entry → IC → Senior IC → Principal/Staff → Team Lead → Manager → Sr Manager → Director → Sr Director → Executive |
| recipient_function | recipient_title | 11 categories: Engineering & Technology, Customer Service, Product & Design, etc. |
| direction | nominator vs recipient seniority | Downward (mgr→IC), Upward (IC→mgr), Lateral (same tier) |
| specificity | message NLP | 0–1 score: numbers +0.3, action verbs +0.15, length +0.1, cliché penalty -0.15 |
| award_type | award_title | 11 types: Thank You, Periodic/Annual, Launch/Delivery, etc. |
| specificity_band | specificity | 5 bands: Very Vague, Vague, Moderate, Specific, Highly Specific |

### Secondary Dataset: Workforce Lifecycle
| File | Rows | Key Columns |
|------|------|-------------|
| function_wh.csv | 2,466 | PK_PERSON, Hire, Expire, job_title, grade_title, function_title, department_name, country |
| wh_history_full.csv | 11,803 | pk_user, fk_direct_manager, job_title, effective_start_date, effective_end_date |
| wh_user_history_v2.csv | 100 | pk_user, fk_direct_manager, job_title, position_title, dates |

### Workforce Key Stats
- Total: 2,466 | Active: 1,110 (45%) | Departed: 1,356 (55%)
- Turnover: 55.0% | Avg tenure: 3.9yr active | Median: 2.6yr
- 37 departments | 15 countries | 25 grades | 151 functions | 869 job titles
- 222 managers | Avg span: 2.92 | Max span: 13

### Environment Variables
| Variable | Location | Purpose |
|----------|----------|---------|
| LLM_PROVIDER | backend/.env + Cloud Run | `openrouter` or `openai` |
| OPENROUTER_API_KEY | backend/.env + Cloud Run | Chat LLM |
| OPENROUTER_MODEL | backend/.env + Cloud Run | Default: nemotron-3-super-120b-a12b:free |
| OPENAI_API_KEY | backend/.env + Cloud Run | Reports LLM (GPT-4o) |
| OPENAI_MODEL | backend/.env + Cloud Run | Default: gpt-4o-mini |
| CORS_ORIGINS | Cloud Run | Firebase hosting domains |
| DATA_DIR | Cloud Run | /app/wh_Dataset |
| GITHUB_PERSONAL_ACCESS_TOKEN | .claude/settings.local.json | GitHub MCP |
