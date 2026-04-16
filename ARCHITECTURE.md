# Architecture — Workforce IQ

Technical system design, component breakdown, data flow, and performance patterns.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React 18 Frontend                         │
│          (Port 3000, Tailwind CSS, Recharts)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────────┐
│              FastAPI Backend (Port 8119)                     │
│  ┌────────┬──────────┬────────┬───────────┬──────────────┐   │
│  │ Routers│ Services │Database│ Analytics │ LLM Pipeline│   │
│  └────────┴──────────┴────────┴───────────┴──────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
    ┌─────────┐  ┌──────────┐  ┌────────────┐
    │  SQLite │  │ Pandas DF│  │  ChromaDB  │
    │  (Meta) │  │(In-mem)  │  │  (Vector)  │
    └─────────┘  └──────────┘  └────────────┘
         ▲
         │
    ┌────┴─────┐
    │ wh_Dataset│
    │ 3 CSVs   │
    └──────────┘
```

### Key Components

1. **Frontend** — React SPA with 14 analytics pages
2. **Backend API** — FastAPI with 8 router groups (30+ endpoints)
3. **Data Cache** — In-memory Pandas DataFrames (loaded at startup)
4. **Analytics Engine** — 7+ query types with compiled aggregations
5. **Knowledge Base** — ChromaDB vector search over analytics docs
6. **Brain Agent** — LangGraph state machine for natural language Q&A
7. **Memory Manager** — SQLite persistence for user session context
8. **ML Pipeline** — scikit-learn flight risk prediction

---

## Data Flow

### On Startup / CSV Upload
```
1. Load 3 CSV files (function_wh.csv, wh_history_full.csv, wh_user_history_v2.csv)
2. Pandas join on PK_PERSON = pk_user
3. Calculate 20+ derived fields per employee
   - tenure_years, is_active, current_role, time_in_current_role
   - num_role_changes, has_been_promoted, manager_changes_count
4. LLM taxonomy batch (unique titles → families/levels/move types)
5. Train ML flight risk model on departed employees
6. Cache entire processed DataFrame in memory
7. Build ChromaDB knowledge base from analytics summaries
```

### On User Chat Query
```
1. Frontend sends: POST /api/chat { message, user_id, conversation_id }
2. Backend /api/chat endpoint:
   - Routes user intent (headcount? turnover? promotion?)
   - Queries analytics engine from cached DataFrames
   - Formats response with KPIs + suggestions
   - Returns: { response, suggestions }
3. Frontend simulates streaming: breaks response into words, 15ms delays
4. User sees word-by-word animation
```

### On Analytics Request (API)
```
1. Frontend calls GET /api/workforce/headcount?dept=Sales
2. Backend queries cached Pandas DF (no SQL)
3. Aggregation runs in-process (microseconds)
4. Returns structured JSON
5. Frontend renders with Recharts
```

---

## Backend Architecture

### Routers (30+ endpoints, 8 groups)

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| **workforce.py** | 8 | Headcount by dept/BU/function/grade/location/country, composition, pyramids |
| **turnover.py** | 6 | Attrition rates, trends, tenure-at-departure, danger zones, voluntary/involuntary |
| **tenure.py** | 5 | Cohorts, distribution, retention curves, long-tenured list, risk factors |
| **careers.py** | 5 | Promotion velocity, career paths, stuck employees, grade progression, lateral vs upward |
| **managers.py** | 5 | Span of control, report retention, revolving door detection, manager quality |
| **org.py** | 4 | Hierarchy depth, department growth, restructuring events, layers |
| **predictions.py** | 3 | Flight risk scores, model metadata, feature importance |
| **reports.py** | 4 | Executive summaries, Power BI export, PDF generation, scheduled reports |
| **upload.py** | 3 | CSV upload, validation, taxonomy regeneration trigger |
| **settings.py** | 3 | Data source path, LLM keys, model parameters, user prefs |
| **simple_chat.py** | 1 | POST /api/chat — natural language Q&A over workforce data |
| **brain_router.py** | 2 | Health check, memory retrieval |

**Total: 49 endpoints**

### Services

#### data_loader.py
- `load_and_process(data_dir)` — Loads CSVs, calculates derived fields, returns DataFrame
- `load_recognition(data_dir)` — Loads awards/recognition messages (optional)
- `_data_cache` — Global dict holding: employees, history, manager_span, recognition_kpis
- `get_stats()` — Returns {employee_count, move_count, recognition_count} for health checks

#### analytics_engine.py
- `get_analytics_engine(data_cache)` — Factory returns AnalyticsEngine instance
- `query(query_type)` — Executes: headcount_summary, headcount_by_dept, tenure_summary, etc.
- All queries operate on cached Pandas DataFrames (no database)
- Returns typed dicts matching frontend expectations

#### taxonomy.py
- `classify_job_titles(unique_titles)` — LLM batch classifies titles → job families
- `classify_grade_levels(unique_grades)` — LLM batch classifies grades → IC/Manager/Director/VP
- `classify_move_type(prev_title, new_title)` — Returns: promotion, lateral, demotion, restructure

#### knowledge_base.py
- `rebuild_knowledge_base(data_cache)` — Generates 25+ documents from analytics summaries
- Documents include: "Sales turnover rate is 12% vs company 8%", "Top 5 job families", etc.
- Embeds with OpenAI text-embedding-3-small, stores in ChromaDB
- `search(query, n_results=3)` — Semantic search returns relevant doc snippets

#### brain.py (LangGraph Agent)
- `BrainAgent` — State machine with 4 nodes:
  - `router` — Intent classification (analytics vs knowledge)
  - `search_kb` — ChromaDB semantic search
  - `query_analytics` — Execute analytics queries
  - `respond` — Format and return response
- `process_message(user_id, message)` — Entry point, returns final response string

#### memory_manager.py
- SQLite persistent storage for user session context
- `save(user_id, context)` — Stores messages, queries, insights
- `retrieve(user_id)` — Loads full session history
- Connection pooling for in-memory vs file-based databases
- Used by brain agent to maintain conversation state

#### job_queue.py
- Task queue (ARQ + Redis, or thread fallback)
- Handles: taxonomy batch jobs, report generation, export tasks
- Non-blocking, processes in background

#### scheduler.py
- APScheduler for scheduled reports
- Triggers on: daily 9am (summary), weekly Monday (department dive), monthly 1st

---

## Frontend Architecture

### Pages (14 total)
See @docs/design-system.md for all color tokens, typography, component patterns.

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | KPIs, headcount trend, turnover by dept, tenure histogram, flight risk top 10 |
| Workforce Composition | `/workforce` | Headcount by every dimension, grade pyramid, geo map |
| Turnover & Attrition | `/turnover` | Attrition rate, trends, danger zones, tenure-at-departure |
| Tenure Analysis | `/tenure` | Cohorts (0-1yr, etc), retention curves, long-tenured list |
| Flight Risk | `/flight-risk` | Risk scores table, feature importance, watchlist, dept heatmap |
| Career Progression | `/careers` | Promotion velocity, career paths, stuck employees, grade progression |
| Manager Analytics | `/managers` | Span of control, report retention, revolving door flags |
| Org Structure | `/org` | Hierarchy depth, dept growth timeline, restructuring events |
| AI Chatbot | `/chat` | Full-screen chat, natural language Q&A, inline charts |
| AI Insights | `/insights` | Job family taxonomy, grade standardization, career move classifications |
| Data Upload | `/upload` | CSV drag-drop, validation, preview, commit |
| Reports & Export | `/reports` | Executive summary, Power BI ZIP, PDF download, scheduling |
| Settings | `/settings` | Data path, LLM keys, model params, user prefs |

### Hooks (custom)
- `useWorkforce()` — Fetches /api/workforce/* endpoints, caches with SWR
- `useTurnover()` — Fetches /api/turnover/* endpoints
- `useChartData()` — Formats API responses for Recharts
- `useChat()` — Manages chat state, streaming simulation, message history
- Plus 7 more domain-specific hooks

### Layout
- **Sidebar** — 228px expanded, 60px collapsed, navigation groups with color coding
- **Header** — Page title, breadcrumbs, optional export/filter controls
- **Content** — Centered max-width 1320px, 28px horizontal padding, 44px bottom padding

### State Management
- Zustand store: `useStore()` for global chat context, user ID, preferences
- Per-page state: React hooks + SWR for data fetching
- No Redux — keep it simple

---

## Technology Rationale

### FastAPI (Backend Framework)
- **Why**: Async-first, auto-OpenAPI docs, Pydantic validation, rapid development
- **Trade-off**: Smaller ecosystem than Django, but sufficient for analytics API
- **Lifespan pattern**: Handles startup/shutdown cleanly (data loading, DB init)

### Pandas + In-Memory DF (Data Storage)
- **Why**: Fast aggregations (1-10ms), no SQL learning curve for analysts, easy debugging
- **Trade-off**: ~50MB memory footprint for 2,466 employees + 11,803 moves; acceptable
- **Scale limit**: Works to ~100K employees; beyond that, consider data warehouse

### SQLAlchemy 2.0 Async
- **Why**: Used only for metadata (upload history, user settings), not analytics queries
- **Trade-off**: Async complexity, but isolates to configuration layer
- **Future**: Can swap SQLite for PostgreSQL without changing code

### scikit-learn (ML)
- **Why**: LogisticRegression + GradientBoosting mature, stable, no cloud dependencies
- **Trade-off**: Model lives in-process memory; retrains on each upload
- **Scale**: Sufficient for 2K–50K employee datasets

### ChromaDB (Vector DB)
- **Why**: Semantic search over analytics docs, in-process, no external service
- **Trade-off**: In-memory only; doesn't persist across restarts
- **Future**: Can persist to SQLite or upgrade to Pinecone/Weaviate

### LangGraph (Agent Orchestration)
- **Why**: Composable state machine, explicit node control, no magic loops
- **Trade-off**: More boilerplate than LangChain, but clearer failure modes
- **Pattern**: Router node decides analytics vs knowledge branch, avoiding async complexity

### React 18 + TypeScript + Tailwind
- **Why**: Type safety, small bundle (Vite), design tokens via CSS, familiar to most teams
- **Trade-off**: No server-side rendering (SPA only), but works for internal analytics tool
- **Performance**: Gzipped bundle ~85KB, loads in <2s

### Recharts
- **Why**: React-native charting, composable, data-driven, no canvas math
- **Trade-off**: Not as powerful as D3 for custom shapes, but sufficient for KPI dashboards
- **Customization**: Custom tooltip and gradient fills handled via props

---

## Performance Characteristics

### Query Latency (cached in-memory)
| Operation | Latency | Notes |
|-----------|---------|-------|
| Headcount summary | <1ms | Single aggregation |
| Headcount by dept (top 10) | <3ms | Group + sort |
| Turnover trend (12 months) | <5ms | Time series aggregation |
| Flight risk top 50 | <10ms | Model predict + sort |
| Tenure distribution (histogram) | <2ms | Binning operation |
| Full org tree traversal | <20ms | Recursive manager hierarchy |

### Network Latency
| Operation | Latency | Notes |
|-----------|---------|-------|
| Chat response | 300–800ms | Analytics query (5–10ms) + LLM formatting (500–700ms) or direct response if LLM unavailable |
| Page load (data) | 100–300ms | Parallel API calls with SWR caching |
| Screenshot/export | 2–5s | PDF generation, Power BI ZIP assembly |

### Memory Footprint
- Base FastAPI: ~80MB
- Loaded DataFrames: ~50MB
- ChromaDB + embeddings: ~100MB
- **Total: ~230MB** (can optimize with chunking if needed)

### Network Transfer (Gzip)
- HTML: 15KB
- JS bundle: 85KB
- CSS: 20KB
- Initial data payload (first page): 50–150KB
- Subsequent API calls: 5–20KB

---

## Async Pattern & Concurrency

### Backend Async Rules
1. **Lifespan context manager** — All startup/shutdown logic runs here, not `@app.on_event`
2. **Router endpoints** — All are `async def`, even if they only call sync functions
3. **Database queries** — SQLAlchemy async session used for metadata only; analytics queries are sync Pandas
4. **LLM calls** — Wrapped in `asyncio.to_thread()` if blocking; simple_chat endpoint avoids async entirely
5. **No asyncio.run()** — Never called from within FastAPI context; use `asyncio.to_thread()` instead

### Frontend Async Patterns
1. **SWR (data fetching)** — Auto-retry on failure, background revalidation, deduplication
2. **Chat streaming simulation** — Word-by-word animation (15ms delays) over single HTTP request
3. **Event handlers** — Debounced filters, throttled scroll listeners

---

## Security & Scale Limits

### Security
- CORS locked to http://localhost:3000 (and extra origins via env var)
- No authentication (internal tool assumption)
- No sensitive data in logs (redact user IDs in production)
- Sentry optional (init via DSN env var)

### Scale Limits (Current Design)
- **Employees**: 2,466 (demo); tested to ~20K; limit ~100K before DF memory becomes 1GB+
- **API throughput**: ~1,000 req/sec (single instance, FastAPI capable of more)
- **Chat response time**: 300–800ms (LLM latency dominates)
- **Concurrent users**: Stateless API; scale horizontally via load balancer

### Bottlenecks to Watch
1. **CSV upload** — Large files (>50MB) slow down taxonomy LLM batch
2. **ML model training** — Retrains on every upload; consider incremental learning
3. **ChromaDB rebuild** — Full rebuild on data reload; consider incremental embedding
4. **LLM API rate limits** — Monitor OpenRouter quota during peak usage

---

## Deployment Topology (Production)

### Local Development
```
React Dev Server (Vite)     FastAPI dev server
  port 3000          ←→        port 8119
(hot reload)          (auto reload)
```

### Docker (Compose)
```
docker-compose up
├─ backend:8119 (Uvicorn, 1 worker)
└─ frontend:3000 (nginx serving built bundle)
```

### Cloud (Cloud Run + Firebase)
```
Google Cloud Run (backend) ←→ Firebase Hosting (frontend)
  auto-scaling                 CDN + rewrite to /api
  SQLite persistence via
    Cloud Storage or
    embedded SQLite
```

See DEPLOYMENT.md for cloud-specific config.

---

## Error Handling & Observability

### Logging Levels
- **INFO**: Router entry/exit, data load completion, knowledge base rebuild
- **DEBUG**: Analytics query details, message routing decisions
- **WARNING**: Missing data, LLM failures, model not trained
- **ERROR**: Exception stack traces, fatal startup failures

### Fallback Strategy
1. **LLM unavailable** → Return analytics data directly (no formatting)
2. **Knowledge base empty** → Skip KB search, go straight to analytics
3. **ML model not trained** → Return 503 with "Upload data first" message
4. **Malformed CSV** → Return 400 with column error, suggest schema

### Monitoring (Optional Sentry)
- Error rate tracking
- Performance monitoring (slow endpoints)
- Release tracking
- Initialize via `SENTRY_DSN` env var

---

## Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| In-memory Pandas instead of SQL | Fast, simple, easy to debug | Fits only to ~100K rows |
| Sync analytics + async FastAPI | LLM calls block, but acceptable latency | No true async throughout |
| LangGraph over LangChain agents | Explicit control, visible error modes | More boilerplate |
| ChromaDB instead of external vector DB | No DevOps burden, in-process | Doesn't persist; rebuilds on startup |
| React SPA instead of SSR | Simpler deployment, faster iteration | No SEO (not needed for internal tool) |
| CSS Grid instead of HTML tables | Design system consistency, responsive | Slight learning curve for analysts |

---

## Future Improvements (Post-MVP)

1. **Data Warehouse** — PostgreSQL or BigQuery for 100K+ employees, timeseries tables
2. **Real-time Streaming** — Kafka ingest for continuous HR system feeds
3. **Advanced ML** — Churn prediction via gradient boosting, promotion probability scoring
4. **Mobile App** — React Native version for iOS/Android KPI access
5. **Scheduled Reports** — Email summaries, Slack notifications, Power BI refresh
6. **Multi-tenant** — Support multiple companies, data isolation, billing
7. **RBAC** — Role-based access control (HR admin vs company admin vs C-suite)
8. **Benchmarking** — Compare metrics against industry standards, peer companies
9. **Scenario Planning** — "What-if" models for hiring, retention, promotion policies

---

## Glossary

- **Flight Risk** — ML-predicted likelihood an active employee will depart soon
- **Tenure** — Time from hire to today (or departure if already left)
- **Span of Control** — Number of direct reports per manager
- **Promotion Velocity** — Average days between consecutive title changes
- **Cohort** — Group of employees binned by tenure (e.g., 0-1yr, 1-3yr)
- **Danger Zone** — Department with attrition rate >2× company average
- **Stuck Employee** — Active employee in same role for 3+ years
- **Revolving Door** — Manager with >50% report turnover year-over-year
- **Derived Field** — Calculated per-employee (tenure, is_active, promoted, etc)
