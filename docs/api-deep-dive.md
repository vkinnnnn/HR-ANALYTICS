# Workforce Analytics API Reference

FastAPI backend. CORS allows `http://localhost:3000`.

| Environment | Base URL |
|---|---|
| Development | `http://localhost:8000` |
| Production | `https://hr-analytics-backend-88806953030.us-central1.run.app` |

## Data Source

Three CSV files loaded into pandas at startup:

| File | Rows | Description |
|---|---|---|
| `function_wh.csv` | 2,466 | Current workforce snapshot (one row per person) |
| `wh_history_full.csv` | 11,803 | Historical role/department/manager changes |
| `wh_user_history_v2.csv` | 100 | Supplementary user history |

**Join key:** `PK_PERSON` = `pk_user`
**Active employee:** `Expire` is null or in the future.
**Departed employee:** `Expire` is filled with a past date.

### Key Formulas

| Metric | Formula |
|---|---|
| Turnover rate | `departed / total * 100` |
| Span of control | Direct reports per manager (from `fk_direct_manager`) |
| Promotion velocity | Avg days between consecutive title changes per employee |
| Flight risk | LogisticRegression on: `tenure_days`, `time_in_current_role_days`, `num_role_changes`, `num_manager_changes`, `num_actual_title_changes` |

---

## 1. Workforce Router — `/api/workforce`

Headcount composition and structure.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Total headcount, active/departed counts, avg tenure |
| GET | `/by-department` | Headcount grouped by department |
| GET | `/by-business-unit` | Headcount grouped by business unit |
| GET | `/by-function` | Headcount grouped by function |
| GET | `/by-grade` | Headcount grouped by grade/level |
| GET | `/by-location` | Headcount grouped by location |
| GET | `/by-country` | Headcount grouped by country |
| GET | `/grade-pyramid` | Grade distribution shaped as a pyramid |
| GET | `/headcount-trend` | Headcount over time (monthly) |
| GET | `/active-vs-departed` | Side-by-side active vs departed breakdown |

```jsonc
// GET /api/workforce/summary
{
  "total": 2466,
  "active": 2104,
  "departed": 362,
  "turnover_rate": 14.68,
  "avg_tenure_days": 1823.5
}

// GET /api/workforce/by-department
[
  { "department": "Engineering", "count": 412, "pct": 16.71 },
  { "department": "Sales", "count": 308, "pct": 12.49 }
]
```

---

## 2. Turnover Router — `/api/turnover`

Attrition analysis.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Overall turnover rate and departed count |
| GET | `/by-department` | Turnover rate per department |
| GET | `/by-grade` | Turnover rate per grade |
| GET | `/by-location` | Turnover rate per location |
| GET | `/by-function` | Turnover rate per function |
| GET | `/trend` | Monthly turnover over time |
| GET | `/tenure-at-departure` | Distribution of tenure length at time of leaving |
| GET | `/danger-zones` | Segments with abnormally high turnover |

```jsonc
// GET /api/turnover/danger-zones
[
  {
    "segment": "Sales — Grade 5 — London",
    "turnover_rate": 32.1,
    "departed": 18,
    "total": 56,
    "severity": "high"
  }
]
```

---

## 3. Tenure Router — `/api/tenure`

Tenure distribution and retention analysis.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Avg/median/p90 tenure, active vs departed |
| GET | `/by-department` | Avg tenure per department |
| GET | `/by-grade` | Avg tenure per grade |
| GET | `/cohorts` | Tenure grouped by hire-year cohort |
| GET | `/distribution` | Histogram buckets (0-1y, 1-2y, 2-5y, 5-10y, 10y+) |
| GET | `/long-tenured` | Employees with tenure above threshold |
| GET | `/short-departures` | Departed employees who left within first year |
| GET | `/retention-curve` | Survival/retention curve by months since hire |

```jsonc
// GET /api/tenure/distribution
[
  { "bucket": "0-1 years", "count": 310, "pct": 12.57 },
  { "bucket": "1-2 years", "count": 485, "pct": 19.67 },
  { "bucket": "2-5 years", "count": 890, "pct": 36.09 },
  { "bucket": "5-10 years", "count": 520, "pct": 21.09 },
  { "bucket": "10+ years", "count": 261, "pct": 10.58 }
]
```

---

## 4. Careers Router — `/api/careers`

Promotions, title changes, and career progression.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Avg promotion velocity, total title changes |
| GET | `/promotion-velocity` | Avg days between promotions, by grade and dept |
| GET | `/stuck-employees` | Employees with no title change in extended period |
| GET | `/career-paths` | Common title progression sequences |
| GET | `/title-changes` | Recent title change events |
| GET | `/by-department` | Career mobility stats per department |

```jsonc
// GET /api/careers/promotion-velocity
{
  "overall_avg_days": 547,
  "by_grade": [
    { "grade": "5", "avg_days_to_next": 612 },
    { "grade": "6", "avg_days_to_next": 483 }
  ]
}
```

---

## 5. Managers Router — `/api/managers`

Manager effectiveness and span of control.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Total managers, avg span, median span |
| GET | `/span-distribution` | Histogram of span-of-control values |
| GET | `/leaderboard` | Managers ranked by team size |
| GET | `/retention` | Manager-level retention rates (team turnover) |
| GET | `/ratio-by-department` | Manager-to-IC ratio per department |
| GET | `/churn` | Manager turnover (managers who departed) |

```jsonc
// GET /api/managers/summary
{
  "total_managers": 318,
  "avg_span": 6.2,
  "median_span": 5,
  "max_span": 24,
  "managers_with_1_report": 42
}
```

---

## 6. Org Router — `/api/org`

Organizational structure and change.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Dept count, avg dept size, org depth |
| GET | `/department-sizes` | Employee count per department |
| GET | `/department-growth` | Headcount change per department over time |
| GET | `/restructuring` | Department transfer events |
| GET | `/hierarchy` | Org tree from manager relationships |
| GET | `/layers` | Number of hierarchy layers per department |

```jsonc
// GET /api/org/layers
[
  { "department": "Engineering", "layers": 5, "deepest_chain": "VP > Dir > Sr Mgr > Mgr > IC" },
  { "department": "Marketing", "layers": 3, "deepest_chain": "Dir > Mgr > IC" }
]
```

---

## 7. Predictions Router — `/api/predictions`

ML-based flight risk scoring.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/flight-risk` | Per-employee flight risk scores (0-1) |
| GET | `/feature-importance` | Model feature weights |
| GET | `/risk-by-department` | Avg flight risk aggregated by department |
| POST | `/retrain` | Retrain the LogisticRegression model on current data |

**Model:** `LogisticRegression` trained on departed employees as positive class.

**Features:**
- `tenure_days` — total days since hire
- `time_in_current_role_days` — days in current title
- `num_role_changes` — number of department/role moves
- `num_manager_changes` — number of manager reassignments
- `num_actual_title_changes` — number of distinct title changes

```jsonc
// GET /api/predictions/flight-risk
[
  {
    "pk_person": 1042,
    "name": "Jane Doe",
    "department": "Sales",
    "risk_score": 0.82,
    "top_factors": ["time_in_current_role_days", "num_manager_changes"]
  }
]

// GET /api/predictions/feature-importance
[
  { "feature": "time_in_current_role_days", "importance": 0.34 },
  { "feature": "num_manager_changes", "importance": 0.28 },
  { "feature": "tenure_days", "importance": -0.22 },
  { "feature": "num_role_changes", "importance": 0.11 },
  { "feature": "num_actual_title_changes", "importance": 0.05 }
]
```

---

## 8. Chat Router — `/api/chat`

Natural-language Q&A over the workforce data.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/query` | Send a question, get an LLM-generated answer |

```jsonc
// POST /api/chat/query
// Request:
{ "question": "Which department has the highest turnover?" }

// Response:
{
  "answer": "Sales has the highest turnover rate at 22.3%, followed by Support at 18.7%.",
  "sources": ["turnover_by_department"]
}
```

---

## 9. Reports Router — `/api/reports`

Pre-built report generation.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/executive-summary` | Generate an LLM-written executive summary |
| GET | `/export` | Download report data as file |

```jsonc
// POST /api/reports/executive-summary
// Response:
{
  "summary": "...",
  "key_metrics": {
    "headcount": 2104,
    "turnover_rate": 14.68,
    "avg_tenure_years": 4.99,
    "flight_risk_high_count": 87
  },
  "recommendations": ["...", "..."]
}
```

---

## 10. Upload Router — `/api/upload`

Data ingestion and reload.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/csv` | Upload a new CSV file (multipart/form-data) |
| GET | `/status` | Check processing status of last upload |
| POST | `/reload` | Re-read all CSVs from disk and rebuild in-memory dataframes |

```jsonc
// POST /api/upload/csv
// Request: multipart/form-data with file field
// Response:
{ "filename": "function_wh.csv", "rows": 2466, "status": "accepted" }

// POST /api/upload/reload
{ "status": "ok", "tables_loaded": 3, "total_rows": 14369 }
```
