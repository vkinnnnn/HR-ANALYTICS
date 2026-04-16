# Architecture — Workforce IQ

Internal system design, data flow, and technical decisions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React 18 Frontend (Port 3000)              │
│  Dashboard │ Turnover │ Careers │ Managers │ Chat │ Settings │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/JSON
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              FastAPI Backend (Port 8119)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routers: workforce, turnover, careers, managers...   │   │
│  └────────────┬─────────────────────────┬──────────────┘   │
│               │                         │                   │
│  ┌────────────▼────────┐    ┌──────────▼──────────┐        │
│  │  Data Loader        │    │ LLM Services        │        │
│  │ (pandas, CSV parse) │    │ (OpenAI, OpenRouter)│        │
│  └─────────┬───────────┘    └──────────┬──────────┘        │
│            │                            │                   │
│  ┌─────────▼────────────────────────────▼──────────┐       │
│  │ Analytics Engine                                │       │
│  │ - Calculations (turnover, flight risk, etc.)    │       │
│  │ - ML models (LogisticRegression flight risk)    │       │
│  │ - Knowledge base (ChromaDB embeddings)          │       │
│  └─────────┬──────────────────────────────────────┘       │
└────────────┼──────────────────────────────────────────────┘
             │
   ┌─────────▼──────────┐
   │ Data Store         │
   │ SQLite (dev)       │
   │ PostgreSQL (prod)  │
   │ + Redis cache      │
   └────────────────────┘
```

---

## Data Pipeline

### 1. CSV Upload

User uploads 3 CSVs via `/api/upload/csv`:

```
function_wh.csv (2,466 rows)
├─ PK_PERSON (employee ID)
├─ Hire, Expire (dates)
├─ job_title, position_title, grade_title
├─ department_name, location_title, country
└─ business_unit_name, function_title

wh_history_full.csv (11,803 rows)
├─ pk_user (join key)
├─ fk_direct_manager (self-referencing hierarchy)
├─ job_title (historical)
├─ effective_start_date, effective_end_date
└─ (tracks all role changes per employee)

wh_user_history_v2.csv (100 rows)
└─ (enriched subset with position_title)
```

### 2. Data Loading (`data_loader.py`)

```python
# 1. Load all 3 CSVs
df_employees = pd.read_csv("function_wh.csv")
df_history = pd.read_csv("wh_history_full.csv")

# 2. Join on PK_PERSON = pk_user
merged = df_employees.merge(df_history, left_on="PK_PERSON", right_on="pk_user")

# 3. Calculate derived fields per employee
df["is_active"] = (df["Expire"].isna()) | (df["Expire"] > today)
df["tenure_days"] = (today - df["Hire"]).dt.days
df["tenure_years"] = df["tenure_days"] / 365.25
df["current_role"] = df.groupby("pk_user")["job_title"].shift(0)  # latest
df["time_in_current_role_days"] = (today - df.groupby("pk_user")["effective_start_date"].shift(0).max())
df["num_role_changes"] = df.groupby("pk_user").size()
df["num_manager_changes"] = df.groupby("pk_user")["fk_direct_manager"].nunique()

# 4. LLM taxonomy generation
# Batch-classify unique job_titles → job_families
# Batch-classify unique grade_titles → standard levels (IC1-5, Manager, Director, VP, C-Suite)
# Classify transitions → promotion/lateral/demotion

# 5. Cache in memory (_data_cache dict)
_data_cache["employees"] = df
_data_cache["history"] = df_history
_data_cache["_loaded_at"] = datetime.now()
```

### 3. Knowledge Base

After loading, ChromaDB indexes processed data:

```python
# Build knowledge base from cached data
docs = [
    f"Total headcount: {len(df)} employees (active: {df.is_active.sum()})",
    f"Turnover rate: {turnover_rate}%",
    f"Departments: {df.department_name.unique()}",
    f"Flight risk employees: {risk_count} high-risk (>80%)",
    ... (25+ summary docs)
]

# Embed with OpenAI & store in ChromaDB
knowledge_base = ChromaDB()
for doc in docs:
    embedding = openai.Embedding.create(input=doc)
    knowledge_base.add(doc, embedding)
```

This enables semantic search: "How many people in sales?" → finds relevant doc → uses for chat context.

---

## Analytics Calculations

### Turnover Rate

```python
def get_turnover_rate():
    departed = df[~df["is_active"]]
    total = len(df)
    # Annualized (all-time departures / total employees × 100)
    return (len(departed) / total * 100) if total > 0 else 0
```

### Span of Control

```python
def get_manager_span():
    span = df.groupby("fk_direct_manager").size().reset_index(name="direct_reports")
    return span  # 1 row per manager
```

### Flight Risk (ML Model)

Trained on historical data:

```python
from sklearn.linear_model import LogisticRegression

# Training set: departed employees
training = df[~df["is_active"]][
    ["tenure_days", "time_in_current_role_days", "num_manager_changes", "num_role_changes"]
]
y_train = 1  # Departed = 1

# Test set: active employees
test = df[df["is_active"]][same_features]

# Fit & predict
model = LogisticRegression()
model.fit(training, y_train)
risk_scores = model.predict_proba(test)[:, 1]  # Class 1 probability
```

Feature importance:
- **Tenure** (newer = higher risk)
- **Time in role** (stagnation = higher risk)
- **Manager changes** (instability = higher risk)
- **Role changes** (blocked = higher risk)
- **Dept turnover rate** (contagion effect)

### Career Progression

```python
# Promotion velocity = avg days between title changes
def promotion_velocity():
    promoted_employees = df[df["num_role_changes"] > 1]
    # For each person, calc days between consecutive role changes
    velocity_days = []
    for emp_id in promoted_employees["pk_user"].unique():
        emp_history = df[df["pk_user"] == emp_id].sort_values("effective_start_date")
        date_diffs = emp_history["effective_start_date"].diff().dt.days
        velocity_days.extend(date_diffs.dropna())
    return velocity_days.mean()  # Avg days
```

---

## Chat & AI

### LangGraph Agent ("The Brain")

Multi-tool agent with context memory:

```
User Query ("How many employees in sales?")
    ↓
Brain Agent
├─ Query parser (what dimension/metric?)
├─ Tool selection
│  ├─ workforce_summary()  ← Fetch from _data_cache
│  ├─ department_breakdown()
│  └─ flight_risk_context()
├─ Context builder (assemble relevant data)
├─ LLM synthesis (GPT-4o-mini)
│  └─ Provides reasoning + answer
├─ Suggestion generator
│  └─ "What other questions might you ask?"
└─ Response + suggestions
    ↓
Frontend displays
```

### Knowledge Base Search

When user asks a question:

```python
# 1. Embed the user query
query_embedding = openai.Embedding.create(input=user_question)

# 2. Search ChromaDB for similar docs
relevant_docs = knowledge_base.search(query_embedding, top_k=3)

# 3. Build context from retrieved docs
context = "\n".join(relevant_docs)

# 4. Prompt LLM with context + question
response = openai.ChatCompletion.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are Workforce AI..."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {user_question}"}
    ]
)
```

---

## API Endpoints

### Request/Response Pattern

All endpoints follow REST + JSON:

```
GET /api/workforce/summary

Response:
{
  "total_active": 2400,
  "total_departed": 66,
  "turnover_rate": 2.7,
  ...
}
```

### Data Aggregation (Not Raw Access)

For privacy, all endpoints return aggregates, never raw employee records:

```python
# ❌ Never exposed
df.to_json()  # Raw employee list with salaries, etc.

# ✅ Always aggregated
{
  "total_active": 2400,
  "by_department": [
    {"name": "Engineering", "count": 800}
  ]
}
```

---

## Frontend Architecture

### State Management (Zustand)

Chat state is persisted across navigation:

```typescript
// stores/chatStore.ts
const useChatStore = create((set) => ({
  messages: [],
  isOpen: false,
  conversationId: `conv_${Date.now()}`,
  
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg]
  })),
  
  appendToLastMessage: (token) => set((state) => ({
    messages: state.messages.map((m, i) =>
      i === state.messages.length - 1 
        ? { ...m, content: m.content + token }
        : m
    )
  }))
}))
```

### Components

- **Pages** — Dashboard, Turnover, Careers, etc. (13 pages)
- **UI** — Panel, KpiCard, Badge, SectionHeader, PageHero
- **Charts** — Recharts wrappers (AreaChart, BarChart, etc.)
- **Chat** — ChatPanel (slide-out), ChatInput, ChatMessage

### Design System

See `/docs/design-system.md` for tokens, colors, spacing, animations.

---

## Performance Optimizations

### Caching

- **In-memory cache** (`_data_cache` dict) — Entire processed dataset
- **Redis cache** (production) — 1-hour TTL on computed aggregates
- **Frontend cache** — React Query for API responses

### Database Indexing (PostgreSQL)

```sql
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_employees_department ON employees(department_name);
CREATE INDEX idx_history_pk_user ON wh_history(pk_user);
CREATE INDEX idx_history_manager ON wh_history(fk_direct_manager);
```

### API Response Compression

FastAPI + GZipMiddleware automatically compresses >1KB responses.

---

## Error Handling

### Graceful Degradation

```python
try:
    load_recognition_data()  # Optional
except Exception:
    pass  # Continue without recognition data

# System still works without optional features
```

### User-Facing Errors

```python
# ❌ Confusing
raise Exception("KeyError in column 'fk_direct_manager'")

# ✅ Helpful
raise HTTPException(
    status_code=400,
    detail="Workforce data not loaded. Please upload CSV first."
)
```

---

## Security

### Data Privacy

- No raw employee PII exposed via API
- All responses are aggregates (dept totals, not names)
- GDPR compliance via `/api/settings/clear-memory` endpoint

### API Authentication (Production)

```python
# Add JWT verification
from fastapi.security import HTTPBearer

security = HTTPBearer()

@router.get("/workforce/summary")
async def get_summary(credentials: HTTPAuthCredentials = Depends(security)):
    token = credentials.credentials
    user = verify_token(token)  # Validate JWT
    ...
```

### Secrets Management

```bash
# Never in code
export OPENAI_API_KEY=sk-...
export DATABASE_URL=postgresql://...

# Use: os.getenv("OPENAI_API_KEY")
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_data_loader.py
def test_tenure_calculation():
    df = load_test_data()
    assert df["tenure_years"].mean() == 5.2  # Known value

def test_flight_risk_model():
    risk_scores = predict_flight_risk()
    assert 0 <= risk_scores.min() <= 1
    assert 0 <= risk_scores.max() <= 1
```

### Integration Tests

```python
# tests/test_api.py
def test_get_workforce_summary():
    response = client.get("/api/workforce/summary")
    assert response.status_code == 200
    assert "total_active" in response.json()
```

### E2E Tests

```typescript
// cypress/e2e/dashboard.cy.ts
describe("Dashboard", () => {
  it("loads KPIs and charts", () => {
    cy.visit("/app/dashboard");
    cy.contains("Active Headcount").should("be.visible");
    cy.get("[data-testid=headcount-kpi]").contains(/\d+/);
  });
});
```

---

## Monitoring & Observability

### Logging

```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"Workforce data loaded: {len(df)} employees")
logger.error(f"Flight risk model failed: {e}")
```

### Tracing (Sentry)

```python
import sentry_sdk
sentry_sdk.init(dsn="https://...@sentry.io/...")

# Automatic error tracking + performance monitoring
```

### Metrics (Prometheus)

```python
from prometheus_client import Counter, Histogram

request_count = Counter("api_requests_total", "Total API requests")
request_latency = Histogram("api_request_seconds", "API latency")

@app.middleware("http")
async def add_metrics(request, call_next):
    start = time.time()
    request_count.inc()
    response = await call_next(request)
    request_latency.observe(time.time() - start)
    return response
```

---

## Future Roadmap

### Planned Features

1. **Scenario modeling** — "What if we hired 200 engineers?"
2. **Succession planning** — High-potential employee tracking
3. **Custom reports** — User-defined KPI dashboards
4. **Real-time streaming** — WebSocket updates as data changes
5. **Export to PowerBI** — Embed in existing BI stack
6. **Slack integration** — Daily standup alerts
7. **Org chart visualization** — Interactive hierarchy
8. **Predictive attrition** — ML model for individual retention risk
9. **Benchmarking** — Compare to industry standards
10. **Multi-tenant SaaS** — Separate orgs, shared infrastructure

### Technical Debt

- [ ] Add request validation (Pydantic models for all routes)
- [ ] Refactor data_loader (too many responsibilities)
- [ ] Add database migrations (Alembic setup)
- [ ] Increase test coverage (currently ~30%)
- [ ] Remove hardcoded assumptions (time periods, cohorts, etc.)

---

## Deployment Checklist

See `/docs/deployment-guide.md` for step-by-step production setup.

---

## Troubleshooting

### "Data not loaded" Error

```bash
# Check data directory
ls -la wh_Dataset/
# Must have: function_wh.csv, wh_history_full.csv

# Manually trigger load
curl -X POST http://localhost:8119/api/upload/process
```

### Flight Risk Scores All 0.5

```
→ Model not trained (no departed employees in dataset)
→ Use default constant prediction
→ Add departed employees, retrain
```

### Chat Returns Generic Responses

```
→ Knowledge base not built
→ Check `/api/brain/health` endpoint
→ Rebuild: POST /api/pipeline/rebuild-knowledge-base
```

---

For more, see individual module documentation in `backend/app/` and `frontend/src/`.
