# HR Workforce Analytics Platform

AI-powered workforce intelligence platform that transforms employee lifecycle data (job histories, org structure, tenure, career progression) into actionable analytics for HR leaders, VPs, and C-Suite.

**IMPORTANT:** This is NOT a recognition/award platform. The original prototype analyzed recognition messages — the real product analyzes workforce data. All backend routers and frontend pages must reflect this.

## Tech Stack
- **Backend:** FastAPI + SQLAlchemy 2.0 async + SQLite + Pandas + scikit-learn
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide React
- **LLM:** OpenAI (GPT-4o-mini) for taxonomy generation and AI chatbot
- **Design:** CodeRabbit-inspired dark theme — see @docs/design-system.md

## Commands
```bash
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev  # port 3000
```

## Data Source
Location: `C:\PROJECTS\HR_ANALYTICS_PLATFORM\wh_Dataset`

### function_wh.csv (2,466 rows × 14 cols) — Employee Master
PK_PERSON, CREATED, Hire, Expire, job_title, position_title, grade_title, function_title, business_unit_name, department_name, location_title, country, location_country

### wh_history_full.csv (11,803 rows × 5 cols) — Job Change History
pk_user, fk_direct_manager, job_title, effective_start_date, effective_end_date
~4.8 records per person avg = rich career progression data

### wh_user_history_v2.csv (100 rows × 6 cols) — Enriched Subset
pk_user, fk_direct_manager, job_title, position_title, effective_start_date, effective_end_date

### Key Relationships
- function_wh.PK_PERSON ↔ wh_history_full.pk_user (join key)
- wh_history_full.fk_direct_manager → wh_history_full.pk_user (self-referencing hierarchy)
- Active employee: Expire IS NULL or Expire > today
- Departed employee: Expire IS NOT NULL and Expire <= today
- Tenure = today (or Expire) minus Hire date
- Promotion = job_title changed between consecutive history records for same pk_user

## Architecture
```
backend/
├── app/
│   ├── main.py              # FastAPI with lifespan pattern
│   ├── config.py            # pydantic-settings
│   ├── database.py          # SQLAlchemy async + SQLite
│   ├── data_loader.py       # CSV parsing, joining, derived field calculation
│   ├── taxonomy.py          # LLM-based job title/grade/move classification
│   └── routers/
│       ├── workforce.py     # Headcount, composition, grade pyramid, geo
│       ├── turnover.py      # Attrition rates, trends, danger zones
│       ├── tenure.py        # Cohorts, distribution, retention curves
│       ├── careers.py       # Progression paths, velocity, stuck employees
│       ├── managers.py      # Span of control, retention, revolving doors
│       ├── org.py           # Hierarchy depth, restructuring, layers
│       ├── predictions.py   # Flight risk ML, promotion prediction
│       ├── chat.py          # LLM-powered natural language Q&A
│       ├── reports.py       # Executive summaries, export bundles
│       ├── upload.py        # CSV upload, validation, taxonomy trigger
│       └── settings.py      # Configuration endpoints
frontend/
├── src/
│   ├── pages/               # 14 page components
│   ├── components/ui/       # Panel, Kpi, Badge, Chart wrappers
│   ├── components/layout/   # Sidebar, Header
│   ├── hooks/               # useWorkforce, useTurnover, etc.
│   ├── lib/api.ts           # Axios client
│   └── types/               # API response types
```

## API Routes
| Route | Purpose |
|---|---|
| `/api/workforce` | Headcount by dept/BU/function/location/country/grade, active vs departed, trends, pyramid |
| `/api/turnover` | Attrition rates sliced by every dimension, trends, tenure-at-departure, danger zones |
| `/api/tenure` | Avg tenure, cohorts, distribution, long-tenured risk, short-tenure signals |
| `/api/careers` | Promotion velocity, career paths, stuck employees, lateral vs upward, grade progression |
| `/api/managers` | Span of control, report retention, manager churn, revolving door detection |
| `/api/org` | Hierarchy depth, dept growth/shrinkage, restructuring detection, layers |
| `/api/predictions` | Flight risk scores, feature importance, promotion prediction |
| `/api/chat` | Natural language queries about workforce |
| `/api/reports` | Executive summaries, Power BI export, PDF generation |
| `/api/upload` | CSV upload, validation, taxonomy regeneration |
| `/api/settings` | Data source config, model params |

## Data Processing Pipeline
On CSV upload or startup:
1. Load function_wh.csv + wh_history_full.csv + wh_user_history_v2.csv
2. Join on PK_PERSON ↔ pk_user
3. Calculate derived fields per employee:
   - tenure_days, tenure_years
   - is_active (Expire null or future)
   - current_role (latest history record)
   - number_of_role_changes
   - time_in_current_role_days
   - has_been_promoted (LLM classifies title changes)
   - manager_changes_count
   - current_manager_id
4. LLM taxonomy generation:
   - Classify unique job_titles → job families (Engineering, Sales, Ops, etc.)
   - Classify unique grade_titles → standard levels (IC1-5, Manager, Director, VP, C-Suite)
   - Classify consecutive title changes → promotion / lateral / demotion / restructure
5. Cache processed DataFrame in memory for API queries

## Frontend Navigation
- **Overview:** Dashboard, Workforce Composition
- **Retention:** Turnover & Attrition, Tenure Analysis, Flight Risk
- **People:** Career Progression, Manager Analytics, Org Structure
- **Intelligence:** AI Chatbot, AI Insights / Taxonomy
- **Operations:** Data Upload, Reports & Export, Settings

## Target Users & Their Questions
- **CEO:** "What's our overall attrition rate vs last year?" "Which depts growing fastest?"
- **VP:** "Show me turnover in my org for 4 quarters" "Who's at flight risk?"
- **HR Manager:** "Which managers have highest report turnover?" "Employees stuck 3+ years in same role?"
- **CHRO:** "Retention by location" "Succession plan for Director+ roles"

## Key Formulas
- Turnover rate = departed in period / avg headcount in period × 100
- Span of control = count of direct reports per manager (from fk_direct_manager)
- Promotion velocity = avg days between consecutive title changes for same person
- Tenure at departure = Expire - Hire (for departed employees only)
- Flight risk features: tenure, time_in_role, manager_changes, grade_stagnation, dept_turnover_rate

## Important Rules
- FastAPI uses async lifespan context manager (NOT @app.on_event)
- CORS allows http://localhost:3000
- All analytics compute from pandas DataFrames (no SQL queries for analytics)
- LLM calls use OpenAI SDK with temperature=0.1 for classification, 0.7 for reports
- Frontend design system: @docs/design-system.md (CodeRabbit dark theme, orange accent)
- Frontend component patterns: @docs/component-patterns.md
