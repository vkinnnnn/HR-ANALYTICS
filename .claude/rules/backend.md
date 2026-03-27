---
paths:
  - "backend/**/*.py"
---
# Backend Rules — Workforce Analytics Platform

IMPORTANT: This is a WORKFORCE analytics platform, NOT a recognition/awards platform. We analyze employee lifecycle data (job histories, org structure, tenure, career progression).

## Data Source
3 CSV files in wh_Dataset/:
- function_wh.csv (2,466 rows): Employee master — PK_PERSON, Hire, Expire, job_title, position_title, grade_title, function_title, business_unit_name, department_name, location_title, country, location_country
- wh_history_full.csv (11,803 rows): Job change history — pk_user, fk_direct_manager, job_title, effective_start_date, effective_end_date
- wh_user_history_v2.csv (100 rows): Enriched subset with position_title

Join key: function_wh.PK_PERSON = wh_history_full.pk_user
Manager hierarchy: fk_direct_manager references pk_user (self-referencing)

## Stack
- FastAPI 0.111.0 with async lifespan pattern
- SQLAlchemy 2.0 async + SQLite (for upload metadata and settings only)
- Pandas + NumPy for all data processing
- scikit-learn for ML (LogisticRegression, GradientBoosting for flight risk)
- OpenAI SDK for LLM taxonomy generation and chatbot

## Data Pipeline (runs on upload or startup)
1. Load all 3 CSVs with pandas, parse dates
2. Join function_wh + wh_history_full on PK_PERSON=pk_user
3. Calculate per-employee derived fields:
   - is_active: Expire is NaT or > today
   - tenure_days: (today or Expire) - Hire
   - current_role: latest history record (max effective_start_date)
   - time_in_current_role: today - current_role.effective_start_date
   - num_role_changes: count of history records per pk_user
   - num_manager_changes: count of distinct fk_direct_manager values
   - has_been_promoted: LLM classifies consecutive title changes
4. LLM taxonomy (batch process unique values):
   - job_titles → standardized job families
   - grade_titles → IC/Manager/Director/VP/C-Suite levels
   - title transitions → promotion/lateral/demotion/restructure
5. Cache processed DataFrames in memory (_data_cache dict)

## Key Calculations
- Turnover rate: departed_in_period / avg_headcount × 100
- Span of control: COUNT(*) WHERE fk_direct_manager = manager_id
- Promotion velocity: avg days between consecutive title changes for same person
- Retention rate: (end_headcount / start_headcount) × 100
- Flight risk: sklearn model trained on departed employees' features, scored on active employees
  - Features: tenure, time_in_role, manager_changes, grade_stagnation_days, dept_turnover_rate
  - Target: is_active = False (departed)

## Router Pattern
```python
@router.get("/summary")
async def get_summary():
    df = get_cached_data()  # from _data_cache
    # pandas operations on df
    return { ... }
```

## Error Handling
- File not found → 404 with list of available files
- Empty dataset → 200 with empty arrays and zero KPIs
- LLM failures → log, return "unclassified" as taxonomy fallback
- ML model not trained → 503 with "Upload data first" message

## AI Chatbot Router
- Accepts natural language query string
- Constructs data context from cached DataFrames (summary stats, not raw data)
- Sends to LLM with system prompt explaining available metrics
- Returns structured response with text + optional chart data
- Examples: "What's the attrition rate in Sales?" "Who reports to manager X?" "Show tenure distribution"
