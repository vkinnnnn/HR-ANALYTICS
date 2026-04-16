# Features — Workforce IQ

Comprehensive guide to all analytics capabilities and how to use them.

---

## Overview

Workforce IQ provides 50+ analytics endpoints across 8 major categories, accessible via:
- **Dashboard Pages** — Visual interfaces with charts, tables, filters
- **API Endpoints** — RESTful JSON access (for integrations, exports)
- **AI Chatbot** — Natural language queries ("What's our attrition rate?")

---

## 1. Workforce Composition

Understand your employee base: headcount, distribution, grade pyramids, geography.

### Headcount Summary
**What**: Total active, departed, turnover rate, new hires  
**API**: `GET /api/workforce/headcount`  
**Chat**: "How many employees do we have?" "What's our headcount?"  
**Output**:
```json
{
  "total": 2466,
  "active": 2300,
  "departed": 166,
  "turnover_rate_pct": 6.7,
  "new_hires_ytd": 340,
  "departures_ytd": 280
}
```

### Headcount by Department
**What**: Active count sliced by department (Sales, Engineering, Finance, etc.)  
**API**: `GET /api/workforce/headcount-by-dept`  
**Chat**: "Show me headcount by department" "Which dept is largest?"  
**Output**: `{ "Sales": 450, "Engineering": 380, "Finance": 120, ... }`

### Headcount by Grade
**What**: Distribution across IC1–5, Manager, Director, VP, C-Suite (standardized via LLM)  
**API**: `GET /api/workforce/headcount-by-grade`  
**Chat**: "How many managers vs individual contributors?" "Show grade pyramid"  
**Output**: `{ "IC1": 200, "IC2": 350, "IC3": 600, "IC4": 250, "IC5": 100, "Manager": 450, ... }`

### Headcount by Function
**What**: By functional area (Engineering, Sales, Operations, Finance, HR, Legal, etc.)  
**API**: `GET /api/workforce/headcount-by-function`  
**Chat**: "Headcount by function"  
**Output**: `{ "Engineering": 800, "Sales": 450, "Operations": 300, ... }`

### Headcount by Location
**What**: By office location / country  
**API**: `GET /api/workforce/headcount-by-location`  
**Chat**: "How many employees in NYC?" "Where are we located?"  
**Output**: `{ "New York": 450, "San Francisco": 380, "London": 200, "Remote": 936 }`

### Grade Pyramid Visualization
**What**: Visual representation of IC pyramid (broader at bottom, narrower at top)  
**API**: `GET /api/workforce/grade-pyramid`  
**Chart**: Bar chart with IC1–5 stacked horizontally  
**Insight**: Healthy pyramid has ~2× more IC3 than IC4, ~2× more IC4 than IC5  
**Warning**: Inverted pyramid (many directors, few ICs) = high overhead, bottleneck

### Active vs. Departed
**What**: Breakdown of active employees (Expire is NULL or future) vs departed (Expire in past)  
**API**: `GET /api/workforce/active-vs-departed`  
**Chat**: "How many people have left?" "Active vs inactive employees"  
**Output**:
```json
{
  "active": 2300,
  "departed": 166,
  "active_pct": 93.3,
  "departed_pct": 6.7
}
```

### Headcount Trend (Last 12 Months)
**What**: Monthly headcount snapshots showing growth/shrinkage trajectory  
**API**: `GET /api/workforce/headcount-trend?months=12`  
**Chart**: Area chart, month over month  
**Insight**: Spot seasonal hiring, planned reductions, unplanned turnover  
**Example**: "Hired 120 in June, but lost 45 to natural attrition → net +75"

---

## 2. Turnover & Attrition

Track departures, identify at-risk departments, understand why people leave.

### Overall Attrition Rate
**What**: % of workforce that departed in a period  
**Formula**: `(departures_in_period / avg_headcount) × 100`  
**API**: `GET /api/turnover/attrition-rate?period=annual|quarterly|monthly`  
**Chat**: "What's our turnover rate?" "Attrition this year?"  
**Output**: `{ "rate_pct": 6.7, "departures": 156, "avg_headcount": 2333 }`  
**Benchmark**: Tech industry ~12–15%; most mature companies ~5–8%

### Attrition by Department
**What**: Turnover rate per department; spotting "danger zones"  
**API**: `GET /api/turnover/attrition-by-dept`  
**Chat**: "Which department has highest turnover?" "Show me attrition by dept"  
**Output**: `{ "Sales": 18.2, "Engineering": 5.1, "Finance": 4.3, ... }`  
**Danger Zone**: Dept with 2× company-average turnover (red flag for manager or role)

### Attrition by Grade
**What**: Turnover rate per level; identifying weak points  
**API**: `GET /api/turnover/attrition-by-grade`  
**Chat**: "Do junior or senior people leave more?"  
**Output**: `{ "IC1": 8.5, "IC2": 6.2, "IC3": 5.1, "Manager": 3.2, "Director": 1.8 }`  
**Pattern**: High IC1 attrition = bad onboarding or weak manager; high IC5 attrition = retirement or poaching

### Attrition by Location
**What**: Turnover by office / remote / country  
**API**: `GET /api/turnover/attrition-by-location`  
**Chat**: "Is turnover higher in remote or office?" "Attrition by location"  
**Output**: `{ "New York": 5.2, "San Francisco": 7.8, "Remote": 8.1 }`

### Tenure at Departure
**What**: How long did departed employees stay (average, histogram)  
**API**: `GET /api/turnover/tenure-at-departure`  
**Chart**: Histogram bins (0–6 mo, 6–12 mo, 1–2 yr, 2–5 yr, 5+ yr)  
**Insight**: Large spike at 0–6 mo = hiring/onboarding problem; large spike at 2–3 yr = career ceiling or burnout  
**Output**:
```json
{
  "avg_tenure_departed_days": 847,
  "avg_tenure_departed_years": 2.3,
  "distribution": {
    "0-6mo": 34,
    "6-12mo": 28,
    "1-2yr": 42,
    "2-5yr": 38,
    "5+yr": 24
  }
}
```

### Attrition Trend (Last 12 Months)
**What**: Monthly attrition rate trajectory  
**API**: `GET /api/turnover/attrition-trend?months=12`  
**Chart**: Line chart with trend indicator  
**Insight**: Is attrition improving or worsening? Seasonal patterns?  
**Example**: "April–June had 10% attrition due to summer departures; Sept–Dec back to 6%"

### Voluntary vs. Involuntary
**What**: If detectable, separate resignations from terminations  
**API**: `GET /api/turnover/voluntary-vs-involuntary` (if expense_type / reason_code available)  
**Chat**: "How many people left vs were laid off?"  
**Note**: Requires exit reason in source data (not always available)

---

## 3. Tenure Analysis

Understand workforce stability: how long people stay, cohort retention, long-tenured risk.

### Average Tenure
**What**: Mean tenure across entire workforce  
**API**: `GET /api/tenure/summary`  
**Chat**: "What's the average tenure?" "How long do people stay?"  
**Output**:
```json
{
  "avg_tenure_years": 4.2,
  "median_tenure_years": 3.8,
  "min_tenure_years": 0.05,
  "max_tenure_years": 18.2
}
```
**Benchmark**: 4–5 years is healthy; <3 = high churn; >6 = aging, risk of stagnation

### Tenure by Department
**What**: Average tenure per department; identify stable vs unstable areas  
**API**: `GET /api/tenure/by-dept`  
**Chat**: "Which department has highest average tenure?"  
**Output**: `{ "Sales": 2.8, "Engineering": 5.1, "Finance": 6.2, ... }`

### Tenure by Grade
**What**: Average tenure per level; spotting bottlenecks  
**API**: `GET /api/tenure/by-grade`  
**Chat**: "Do managers or ICs stay longer?"  
**Output**: `{ "IC1": 1.2, "IC2": 2.8, "IC3": 4.5, "IC4": 6.2, "Manager": 5.8, "Director": 8.1 }`  
**Insight**: IC3→IC4 jump (2× tenure) = promotion bottleneck; many ICs never make it past IC3

### Tenure Cohort Distribution
**What**: % of workforce in each tenure band  
**API**: `GET /api/tenure/cohorts`  
**Chat**: "How many people have 1–3 years tenure?" "Show me tenure cohorts"  
**Output**:
```json
{
  "0-1yr": { "count": 340, "pct": 14.8 },
  "1-3yr": { "count": 560, "pct": 24.3 },
  "3-5yr": { "count": 480, "pct": 20.9 },
  "5-10yr": { "count": 520, "pct": 22.6 },
  "10+yr": { "count": 300, "pct": 13.0 }
}
```
**Healthy distribution**: Fairly even across bands; avoids cliff (e.g., no 5–10yr cohort = mass departure 5 yrs ago)

### Retention Curve
**What**: % of hires retained after N years (Kaplan-Meier style survival curve)  
**API**: `GET /api/tenure/retention-curve`  
**Chart**: Area chart showing cohort survival  
**Insight**: Where do people drop off? After 2 years? After promotion to manager?  
**Example**: "80% retained at 1yr, 60% at 3yr, 45% at 5yr" = significant drop after 3 years

### Long-Tenured Employees
**What**: List of employees 10+ years (institutional knowledge, retirement risk)  
**API**: `GET /api/tenure/long-tenured?min_years=10`  
**Chat**: "Who's been here the longest?" "Show me employees with 10+ years tenure"  
**Output**:
```json
{
  "count": 300,
  "employees": [
    { "name": "Alice Johnson", "tenure_years": 18.2, "grade": "Director", "dept": "Engineering" },
    ...
  ]
}
```
**Use case**: Succession planning, knowledge transfer, retention/retirement conversations

### Tenure Distribution
**What**: Histogram of tenure across all employees  
**API**: `GET /api/tenure/distribution`  
**Chart**: Histogram with 1-year bins  
**Insight**: Spot cohort spikes (e.g., 2 years ago we hired 200 → spike at 2yr mark)

---

## 4. Career Progression

Track promotion velocity, identify stuck employees, understand career paths.

### Promotion Stats
**What**: Count, rate, velocity of promotions  
**API**: `GET /api/careers/promotion-stats`  
**Chat**: "How many people got promoted?" "What's our promotion rate?"  
**Output**:
```json
{
  "employees_promoted_total": 450,
  "promotion_rate_pct": 19.6,
  "avg_time_between_promotions_days": 1247,
  "avg_time_between_promotions_years": 3.4,
  "promotions_last_12mo": 89
}
```
**Benchmark**: 15–25% annual promotion rate is healthy; <10% = stagnation; >30% = unsustainable jumping

### Promotion Velocity by Department
**What**: Avg days to next promotion per department  
**API**: `GET /api/careers/promotion-velocity-by-dept`  
**Chat**: "Which department promotes fastest?" "Time to promotion by dept"  
**Output**: `{ "Engineering": 1100, "Sales": 980, "Finance": 1450, ... }`  
**Insight**: Sales promotes fastest (commission-driven); Finance slowest (hierarchy-driven)

### Stuck Employees
**What**: Active employees in same role for 3+ years  
**API**: `GET /api/careers/stuck-employees?years=3`  
**Chat**: "How many people have been in the same role for 3+ years?" "Show me stuck employees"  
**Output**:
```json
{
  "count": 128,
  "pct_of_workforce": 5.6,
  "employees": [
    { "name": "Bob Smith", "role": "Senior Engineer", "years_in_role": 5.2, "grade": "IC3" },
    ...
  ]
}
```
**Risk**: Career stagnation → flight risk, low engagement, potential legal liability (age discrimination)

### Grade Progression
**What**: % promoted from IC2→IC3, IC3→IC4, IC4→IC5, IC→Manager, etc.  
**API**: `GET /api/careers/grade-progression`  
**Chat**: "What % of ICs become managers?" "Grade progression rates"  
**Output**:
```json
{
  "ic1_to_ic2": 0.68,
  "ic2_to_ic3": 0.55,
  "ic3_to_ic4": 0.28,
  "ic4_to_ic5": 0.12,
  "ic_to_manager": 0.20
}
```
**Insight**: Low IC3→IC4 transition (28%) = bottleneck; promotion path is slow/unclear

### Career Paths (Top Journeys)
**What**: Most common title progression sequences  
**API**: `GET /api/careers/top-paths?limit=10`  
**Chat**: "What are the most common career paths?" "How do engineers advance?"  
**Output**:
```json
{
  "paths": [
    { "sequence": ["Engineer II", "Engineer III", "Senior Engineer"], "count": 120 },
    { "sequence": ["Engineer III", "Manager", "Director"], "count": 45 },
    ...
  ]
}
```

### Lateral Transfers vs. Promotions
**What**: % of moves that are lateral (same grade) vs upward (promotion)  
**API**: `GET /api/careers/lateral-vs-upward`  
**Chat**: "Do people move laterally or get promoted?" "Promotion vs lateral transfers"  
**Output**:
```json
{
  "total_moves": 3297,
  "promotions": 1850,
  "lateral_transfers": 1200,
  "demotions": 47,
  "restructures": 200,
  "promotion_rate": 56.1
}
```
**Insight**: <50% promotion rate = good; horizontal growth matters for learning

---

## 5. Flight Risk

Predict who is likely to leave and intervene early.

### Flight Risk Scores
**What**: ML-predicted probability of departure (0–100%) for each active employee  
**Model**: LogisticRegression on tenure, time_in_role, manager_changes, dept attrition  
**API**: `GET /api/predictions/flight-risk`  
**Chat**: "Who's at risk of leaving?" "Show me high flight risk employees"  
**Output**:
```json
{
  "total_employees": 2300,
  "high_risk": 180,
  "medium_risk": 420,
  "low_risk": 1700,
  "top_watchlist": [
    {
      "name": "Carol Williams",
      "risk_score": 0.87,
      "risk_level": "HIGH",
      "grade": "IC4",
      "dept": "Sales",
      "tenure_years": 2.1,
      "time_in_role_days": 180,
      "manager_changes": 3,
      "dept_attrition_rate": 18.2
    },
    ...
  ]
}
```
**Accuracy**: 75%+ on demo dataset; improves with 6+ months of departure history

### Feature Importance
**What**: Which factors contribute most to flight risk  
**API**: `GET /api/predictions/flight-risk-features`  
**Chart**: Bar chart showing relative importance  
**Output**:
```json
{
  "features": {
    "time_in_role_days": 0.32,
    "manager_changes": 0.24,
    "tenure_years": 0.18,
    "dept_attrition_rate": 0.16,
    "grade_level": 0.10
  }
}
```
**Insight**: Time in role is strongest signal; short tenure + frequent manager changes = high risk

### Flight Risk by Department
**What**: Avg risk score per department; identifying problem areas  
**API**: `GET /api/predictions/flight-risk-by-dept`  
**Chart**: Bar chart  
**Output**: `{ "Sales": 0.42, "Engineering": 0.28, "Finance": 0.35, ... }`

### High-Risk Watchlist
**What**: Top 50–100 people to focus retention efforts on  
**API**: `GET /api/predictions/flight-risk-watchlist?limit=50`  
**Chat**: "Show me the top 50 people we're at risk of losing"  
**Output**: Detailed person-by-person table with scores, context

### Retention Intervention Suggestions
**What**: AI-generated retention strategies per employee  
**API**: `GET /api/predictions/retention-suggestions/{employee_id}`  
**Chat**: "Why might Carol leave? How do we keep her?"  
**Output**:
```json
{
  "factors": [
    "Time in role (6 months) is below median 18 months",
    "Manager changed 3 times in 2 years (high churn)",
    "Sales attrition is 18% (double company average)"
  ],
  "suggestions": [
    "Schedule growth conversation (career path, next role)",
    "Manager skip-level 1:1 (surface issues)",
    "Consider promotion or lateral move to stable team",
    "Benchmark compensation vs market"
  ]
}
```

---

## 6. Manager Analytics

Understand manager quality, team retention, span of control.

### Span of Control
**What**: Average # of direct reports per manager  
**API**: `GET /api/managers/span-of-control`  
**Chat**: "What's our average span of control?" "Manager-to-employee ratio"  
**Output**:
```json
{
  "avg_span": 5.2,
  "median_span": 4,
  "min_span": 1,
  "max_span": 18
}
```
**Healthy range**: 4–8 direct reports; <3 = over-managed; >12 = too many to develop

### Span of Control Distribution
**What**: Histogram of direct reports per manager  
**API**: `GET /api/managers/span-distribution`  
**Chart**: Bar chart  
**Insight**: Bell curve is healthy; outliers (1 report or 20 reports) need attention

### Manager Retention Scorecard
**What**: % of manager's reports who stayed 1yr, 2yr, 3yr+  
**API**: `GET /api/managers/retention-scorecard`  
**Chat**: "Which managers retain their teams best?"  
**Output**:
```json
{
  "managers": [
    {
      "name": "Alice Manager",
      "reports_count": 7,
      "1yr_retention_rate": 0.86,
      "2yr_retention_rate": 0.71,
      "3yr_retention_rate": 0.57,
      "avg_tenure_of_reports": 3.8
    },
    ...
  ]
}
```
**Use case**: Identify high-retention managers for promotion / mentoring; troubled managers for coaching

### Revolving Door Managers
**What**: Managers with >50% annual turnover of reports  
**API**: `GET /api/managers/revolving-doors`  
**Chat**: "Which managers have high report turnover?"  
**Output**:
```json
{
  "revolving_doors": [
    {
      "name": "Bob Bad Manager",
      "reports_count": 10,
      "annual_turnover_rate": 0.65,
      "departures_last_year": 6,
      "avg_tenure_of_departed": 1.2
    },
    ...
  ]
}
```
**Action**: Immediate manager coaching, 360 review, or replacement

### Manager-to-Employee Ratio
**What**: % of workforce in management positions  
**API**: `GET /api/managers/ratio-by-level`  
**Chat**: "How many managers vs individual contributors?"  
**Output**:
```json
{
  "total_managers": 450,
  "total_ics": 1850,
  "ratio": "1:4.1",
  "pct_in_management": 19.6
}
```
**Healthy range**: 15–20%; >25% = over-management; <10% = stretch assignments

### Manager Promotion Paths
**What**: How quickly do ICs become managers (and directors)  
**API**: `GET /api/managers/promotion-paths`  
**Chat**: "How do people become managers?" "Manager career paths"  
**Output**:
```json
{
  "ic_to_manager_rate": 0.20,
  "avg_ic_years_before_manager": 4.8,
  "manager_to_director_rate": 0.18,
  "avg_manager_years_before_director": 3.2
}
```

---

## 7. Org Structure

Understand hierarchy, growth, restructuring events.

### Hierarchy Depth
**What**: Levels from IC1 to CEO (reporting chain length)  
**API**: `GET /api/org/hierarchy-depth`  
**Output**:
```json
{
  "max_levels": 7,
  "avg_levels_to_ceo": 5.2,
  "ceo_direct_reports": 8
}
```
**Healthy**: 5–7 levels; <4 = flat (scaling challenges); >8 = bureaucratic

### Department Growth
**What**: Headcount trend per department (last 12 months)  
**API**: `GET /api/org/dept-growth?months=12`  
**Chart**: Multi-line chart by department  
**Output**:
```json
{
  "departments": {
    "Engineering": { "month_1": 350, "month_2": 365, ..., "month_12": 420 },
    "Sales": { ... },
    ...
  }
}
```
**Insight**: Identify growth priorities (hiring) vs shrinkage (attrition)

### Restructuring Events
**What**: Detected org changes (dept splits, mergers, role eliminations)  
**API**: `GET /api/org/restructuring-events`  
**Note**: Detected via sudden title change patterns or manager reassignments  
**Output**:
```json
{
  "events": [
    {
      "date": "2024-02-15",
      "type": "dept_split",
      "detail": "Sales split into Enterprise and SMB",
      "affected_people": 120
    },
    ...
  ]
}
```

### Department Size Distribution
**What**: Histogram of dept sizes (help spot imbalances)  
**API**: `GET /api/org/dept-distribution`  
**Chart**: Bar chart (depts sorted by size)

### Reporting Relationships
**What**: Full org chart (hierarchical tree or adjacency list)  
**API**: `GET /api/org/chart` or `GET /api/org/reporting-tree`  
**Note**: Can be large; use filters for specific department or level  
**Output**: Nested JSON or CSV export

---

## 8. AI Chatbot & Insights

Natural language interface to all metrics + AI-generated insights.

### Natural Language Chat
**What**: Ask any question about your workforce in plain English  
**API**: `POST /api/chat` with `{ "message": "...", "user_id": "..." }`  
**Chat**: "What's our attrition rate in Sales?" "Show me stuck employees" "Who reports to Alice?"  
**Under the hood**: Routes to appropriate analytics query, formats response, suggests follow-ups

### Example Questions (Sample Prompts)
```
1. "How many employees do we have?" → Headcount summary
2. "What's our turnover rate?" → Attrition rate + by-dept breakdown
3. "Show me headcount by department" → Bar chart by dept
4. "Who's at flight risk?" → Top 10 flight risk employees
5. "Which managers have highest team retention?" → Manager scorecard
6. "Show me the grade pyramid" → Grade distribution chart
7. "Tell me about tenure distribution" → Cohorts + histogram
8. "What % of ICs become managers?" → Grade progression rates
9. "How has headcount grown in the last year?" → Trend chart
10. "Why are so many people leaving?" → Tenure-at-departure analysis
```

### Auto-Generated Insights
**What**: AI proactively suggests findings ("You have a problem...")  
**Triggers**:
- Attrition > 2× company average in a dept
- New "revolving door" manager detected
- Promotion bottleneck (low IC3→IC4 rate)
- High flight risk cluster (10+ high-risk people in one dept)
- Sudden tenure cliff (cohort spike + departure spike)

**Output**:
```
🚨 Alert: Sales attrition jumped to 18% in Q1 (vs 8% company avg)
   Likely causes:
   - 3 manager departures in 12 months (high churn)
   - Promotion rate dropped from 24% → 12% (career stagnation)
   - 12 people now "stuck" 3+ years in same role
   
   Recommended actions:
   1. Exit interview analysis (call departed sales people)
   2. Manager skip-level 1:1s (surface issues)
   3. Review compensation vs market (poaching risk?)
   4. Expand career paths (sideways moves, special projects)
```

### Knowledge Base Search
**What**: Semantic search over analytics docs + company HR policies (if loaded)  
**API**: `GET /api/brain/search?q=...`  
**Example**: "What's the promotion rate?" → Returns doc summary + relevant metrics

---

## 9. Reporting & Export

Generate reports, share insights, integrate with BI tools.

### Executive Summary
**What**: AI-generated narrative of workforce health  
**API**: `POST /api/reports/executive-summary`  
**Output**:
```
WORKFORCE IQ EXECUTIVE SUMMARY
Generated: 2024-04-16

HEADLINE: Workforce is stable with early attrition signals in Sales.

KEY METRICS:
• Headcount: 2,466 active (+2.1% YoY)
• Attrition: 6.7% annual (target: 5–8%) ✓
• Promotion Rate: 19.6% (healthy)
• Flight Risk: 180 people (7.8%) requiring attention

TRENDS:
✓ Engineering headcount +12% (hiring focused)
⚠ Sales attrition 18% (double company avg) — investigate manager churn
✓ Tenure stable (avg 4.2 yr, up from 4.0 yr last year)

RECOMMENDATIONS:
1. Address Sales manager turnover (3 departures in 12 months)
2. Launch retention program for 50 high-risk employees
3. Implement manager training (improve span of control)

APPENDIX: Full metrics attached...
```

### Power BI Export
**What**: ZIP file of CSVs ready to load into Power BI  
**API**: `GET /api/reports/export-powerbi`  
**Contents**:
```
workforce_master.csv        # Headcount, grade, dept, location, tenure, flight_risk
career_history.csv          # Job moves with promotion classifications
manager_metrics.csv         # Span, retention rate, report churn
attrition_detail.csv        # Departed employees with exit context
```

### PDF Report Download
**What**: Printable 10–15 page report with charts, tables, insights  
**API**: `POST /api/reports/generate-pdf`  
**Sections**:
1. Title page
2. Executive summary
3. Headcount metrics + charts
4. Attrition deep-dive
5. Tenure & retention analysis
6. Flight risk watchlist
7. Manager performance
8. Recommendations

### Scheduled Reports
**What**: Auto-generate & email reports on cadence (daily, weekly, monthly)  
**API**: `POST /api/reports/schedule` with `{ "frequency": "weekly", "recipients": [...] }`  
**Output**: Email with PDF attached + link to live dashboard

---

## 10. Settings & Administration

Configure data sources, LLM models, security, preferences.

### Data Source Configuration
**What**: Upload CSV files, validate schema  
**API**: `POST /api/upload` (multipart file) → `POST /api/pipeline/process`  
**UI**: Drag-drop zone, column mapping, data preview

### LLM Configuration
**What**: API key, model selection (GPT-4o-mini, Nemotron, etc.)  
**API**: `POST /api/settings/llm-config`  
**Options**: Temperature for creative responses, max_tokens, retry logic

### User Preferences
**What**: Theme (light/dark), notification settings, export format defaults  
**API**: `POST /api/settings/user-prefs`  
**Stored in**: SQLite per-user config

### Model Parameters
**What**: Flight risk threshold, promotion cutoff, manager span target  
**API**: `POST /api/settings/model-config`  
**Example**: Set flight_risk threshold to 0.75 (only flag 75%+ risk), or adjust IC promotion rate target from 15% → 20%

---

## Feature Matrix: What Requires Data

| Feature | Requires | Notes |
|---------|----------|-------|
| Headcount, turnover, tenure | function_wh.csv | Core dataset |
| Career progression, promotion, grade advancement | wh_history_full.csv | Job change history with dates |
| Manager analytics, span of control | fk_direct_manager field | Must have manager hierarchy in data |
| Flight risk prediction | 6+ months of departure history | ML model trains on departed employees |
| Insights, recommendations | Multiple queries together | AI synthesizes patterns |
| Org structure, hierarchy depth | Manager hierarchy + job levels | Need depth across org |

---

## Performance & Limits

| Metric | Value | Notes |
|--------|-------|-------|
| Query latency (cached) | <10ms | Headcount, turnover, tenure queries |
| Chat response time | 300–800ms | Analytics query (5–10ms) + LLM formatting |
| Max employees per dataset | ~100K | Memory efficient up to this scale |
| Max API throughput | 1,000 req/sec | Single FastAPI instance |
| Max concurrent users | Unlimited | Stateless API |

---

## What's NOT Included (Yet)

- **Real-time streaming** — Data updates daily, not minute-by-minute
- **Multi-company support** — Single org per instance
- **RBAC** — No role-based access (all users see all data)
- **Pay equity audit** — Needs salary field (not in demo data)
- **Skills/competency mapping** — Requires skills data source
- **Predictive hiring forecasts** — Requires historical hiring targets
- **Benchmark vs peers** — Needs external industry data sources

---

## Next Steps

Explore features via:
1. **Dashboard** — Visual overview
2. **Chat** — Try natural language queries
3. **API docs** — `http://localhost:8119/docs` for full endpoint reference
4. **Reports** — Generate PDF / Power BI export

Questions? See QUICKSTART.md or ARCHITECTURE.md for deeper dives.
