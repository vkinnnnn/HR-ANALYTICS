# User Guide — Workforce IQ

How to use Workforce IQ to analyze your workforce data and answer critical HR questions.

---

## Getting Started

### 1. Upload Your Data

**Where:** Settings → Data Upload

**Files needed:**
- `function_wh.csv` — Employee master (current roles, departments, locations)
- `wh_history_full.csv` — Job change history (promotions, lateral moves, departures)

**How to upload:**
1. Click **Data Upload** in the sidebar
2. Drag & drop CSV files or click to select
3. Click **Upload**
4. Wait 2-5 minutes while the system:
   - Parses and validates data
   - Classifies job titles into families
   - Builds AI knowledge base
   - Computes flight risk scores

**Expected message:**
```
✓ 2,466 employees loaded
✓ 11,803 career moves classified
✓ Knowledge base ready
```

---

## Dashboard

Your workforce at a glance. 4 KPIs + 4 charts.

### KPI Row

- **Active Headcount** — Total employees currently employed
- **Turnover Rate** — Percentage of employees who left (this quarter or YTD)
- **Avg Tenure** — Mean years of service across all employees
- **Flight Risk** — Count of high-risk employees (85%+ risk score)

### Charts

**Headcount Trend** — Line chart of active employees over time
- Use to spot hiring ramps, layoffs, or seasonal patterns
- Hover for exact numbers

**Turnover by Department** — Bar chart of departures by team
- Red bars = danger zones (>20% annual turnover)
- Drill into Turnover & Attrition page for deeper analysis

**Tenure Distribution** — Histogram of employees by tenure band
- Helps identify retention strength and cohort gaps
- E.g., "We have lots of 1-3yr employees but few at 5-10yr"

**Flight Risk Watchlist** — Top 5 at-risk employees
- Purple badges show risk percentages
- Hover to see job title and department
- Click to drill into predictions page for full list + features

### Workforce Alert (AI-Generated)

"Sales has 28.5% turnover — 10x above company average. Consider retention initiatives."

These insights are auto-generated based on your data. They change as data updates.

---

## Workforce Composition

Slice workforce data by any dimension.

**Available slices:**
- Department
- Job Grade (IC1-5, Manager, Director, VP, C-Suite)
- Location (city/country)
- Function (Engineering, Sales, Finance, etc.)
- Business Unit

**How to use:**
1. Open **Workforce Composition**
2. Select a dimension (e.g., "Department")
3. View headcount, active/departed split, turnover %
4. Click any row to drill into that group

**Example questions:**
- "How many engineers do we have?" → Dimension: Function
- "Which office has the highest turnover?" → Dimension: Location
- "What grades have we hired in the last 6 months?" → Dimension: Job Grade

---

## Turnover & Attrition

Understand why employees leave and which teams are at risk.

### Summary View
- **Turnover Rate** — Company-wide (all departures / total headcount × 100)
- **This Quarter's Departures** — Count + names (if available)
- **Avg Tenure at Exit** — How long do people usually stay before leaving?

### Danger Zones
Red-highlighted departments with turnover >20% annually. These need immediate attention.

**What to do:**
1. Identify danger zone departments
2. Open **Manager Analytics** to see if specific managers have high turnover
3. Open **Career Progression** to check if employees are "stuck" (no moves)
4. Use **Flight Risk** to identify who might leave next

### Monthly Trend
Line chart showing departures over time.
- Flat = stable attrition
- Spikes = layoff, RIF, or external factor (e.g., competitor acquisition, office closure)

---

## Tenure Analysis

Understand how long employees typically stay and where retention is strong.

### KPI Row
- **Avg Tenure** — Mean years of service
- **Median Tenure** — Middle point (less skewed by 20-year employees)
- **Long-Tenured (10yr+)** — Count of "institutional knowledge" holders

### Tenure Cohorts
Employees grouped by hire year:
- **0-1 year** — Onboarding cohort (should be 50-100 new hires/yr)
- **1-3 years** — Early-career (highest turnover risk, especially in tech)
- **3-5 years** — Established
- **5-10 years** — Senior
- **10yr+** — Leadership/core team

**Use for:**
- Spotting "broken rung" (stuck at same level for 3+ yrs)
- Identifying generation gaps in hiring
- Planning for retirement (10yr+ employees)

### Retention Curves
Kaplan-Meier style chart showing "survival rate" by hire cohort.

Interpretation:
```
2020 hires: 92% still employed after 3 years → strong retention
2019 hires: 78% still employed after 4 years → some attrition
2018 hires: 65% still employed after 5 years → higher churn
```

---

## Flight Risk

Predict which employees are most likely to leave in the next 6-12 months.

### Risk Score
0-100% probability of departure based on ML model trained on past leavers.

**Model features:**
- Tenure (newer employees higher risk)
- Time in current role (stagnation = risk)
- Manager changes (instability = risk)
- Grade stagnation (no promotions = risk)
- Department turnover rate (contagion effect = risk)

### Watchlist

**Red (80-100%)** — Active conversations recommended
**Yellow (50-80%)** — Monitor, consider retention
**Green (0-50%)** — Low risk

### What to Do
1. Click on high-risk employees to see which features drive their risk
2. If "3+ years in same role" is a factor → offer promotion, sideways move, or development
3. If "2+ manager changes" is a factor → check for management stability issues
4. If "High dept turnover" is a factor → company-wide initiative (not individual)

### Limitations
- Model trained on departed employees only
- "Reasons for leaving" data not available (voluntary vs layoff unknown)
- Future external events (recession, competitor job market) not captured

---

## Career Progression

Track how fast (or slow) employees move through your organization.

### Key Metrics

**Promotion Velocity** — Avg days between job title changes
- 840 days (2.3 years) = typical tech company
- 1200+ days = slow moving, possibly stuck
- 180 days = fast-tracked, high potential

**Promotion Rate** — % of workforce promoted this year
- 15-25% = healthy
- <10% = limited opportunities, retention risk
- >30% = hypergrowing

### Career Paths

Visual flow diagram:
```
IC1 → IC2 → IC3 (60% to Senior IC)
IC2 → Manager (20% make jump)
Manager → Senior Manager (30% advance)
```

Shows what % take each path (lateral, upward, downward moves).

### Stuck Employees

Employees in same role for 3+ years (time_in_current_role_days > 1095).

**Risk:** Disengagement, attrition, external recruitment.

**What to do:**
1. Sort by department/grade
2. Offer: promotion, lateral move, special project, mentoring role
3. Document reason: "waiting for opening" vs "not ready" vs "not interested"

---

## Manager Analytics

Understand manager effectiveness through retention and span metrics.

### Span of Control

How many direct reports per manager?

**Healthy range:** 5-8 reports per manager
- <3 = micromanagement risk or overstaffing
- 3-8 = ideal
- 8-12 = at capacity, stretch leader
- >12 = overloaded, risk of burnout & team churn

### Top Retainers

Managers with highest 1yr, 2yr, 3yr retention of their teams.

**Use for:**
- Identifying leadership role models
- Identifying who mentors well (succession planning)
- Comparing retention across similar-sized teams

### Revolving Doors

Managers with high turnover among their direct reports.

**Actions:**
- 1:1 with manager to understand issues
- Exit interviews: "Did your manager contribute to your decision?"
- Consider management training or reassignment

---

## Org Structure

Understand organization shape, layers, and restructuring.

### Hierarchy Metrics

**Max Depth** — Layers from CEO to IC
- 5-8 = typical
- <4 = flat org (startup-like)
- >10 = highly bureaucratic

**Avg Span by Level:**
- C-suite: 5-6 reports
- Director: 4-8 reports
- Manager: 5-8 reports
- IC: 0 reports

### Department Growth

Timeline showing headcount changes per department.

**Interpretation:**
```
Engineering: 800 → 820 → 850 (steady growth)
Sales: 400 → 450 → 420 (hired, then downsized)
Finance: 180 → 180 → 180 (flat, mature)
```

### Restructuring Detection

Algorithm flags when:
- Departments merge (headcount jumps under new manager)
- Layers added/removed (avg span changes)
- Teams move between departments (manager changes)

---

## AI Chatbot ("The Brain")

Ask natural language questions about your workforce. Always available (bottom right 🔥).

### Question Types

**Headcount questions:**
- "How many employees in sales?"
- "Total headcount by country?"
- "New hires this quarter?"

**Turnover questions:**
- "What's our turnover rate?"
- "Which department has highest attrition?"
- "Why did people leave?"

**Career questions:**
- "Promotion velocity?"
- "Who's been in same role for 3 years?"
- "Careers in product?"

**Manager questions:**
- "Who has the most direct reports?"
- "Manager retention scores?"

**Org questions:**
- "How many layers do we have?"
- "Org chart for sales?"

### Tips

1. **Be specific** — "Sales in EMEA" vs just "Sales"
2. **Ask for context** — "Compared to industry" or "vs last quarter"
3. **Ask for suggestions** — "What should I look at for retention?"
4. **Follow up** — Brain remembers conversation history

### Limitations

- Doesn't know "why" (reasons for leaving, satisfaction scores, competitor moves)
- Returns top-line numbers, not raw employee records (privacy)
- Based only on current data (can't predict or model scenarios)

---

## Settings

Configure data source, API keys, and preferences.

### Data Settings

- **Data Directory** — Where CSV files live (auto-scanned on startup)
- **Auto-load** — Enable/disable automatic loading on startup
- **Refresh Schedule** — How often to recalculate metrics (hourly, daily, weekly)

### LLM Settings

- **Model** — OpenAI GPT-4o-mini (default) or OpenRouter alternatives
- **Temperature** — 0.1 (precise classifications) to 0.7 (creative summaries)
- **API Key** — Required for chat, insights, and auto-taxonomy

### Privacy & Security

- **Data Retention** — How long to keep uploaded CSVs (90 days default)
- **Audit Log** — See who accessed what and when (GDPR-compliant)
- **Export Policy** — Whether users can download raw data

---

## Common Workflows

### Scenario: High Turnover in Engineering

1. **Dashboard** → Spot "Engineering turnover 18%"
2. **Turnover & Attrition** → See departures by quarter
3. **Manager Analytics** → Which manager's team is churning?
4. **Career Progression** → Are they stuck? No promotions?
5. **Flight Risk** → Who might leave next?
6. **Chat** → "Why do engineers leave? Avg tenure?"

### Scenario: Find Promotion-Ready Employees

1. **Career Progression** → Stuck employees list
2. **Flight Risk** → Filter by risk <50% (engaged employees)
3. **Manager Analytics** → Check their manager's retention (good mentor?)
4. **Tenure Analysis** → 3-5yr band (sweet spot)
5. **Chat** → "Top promoters this year? Career paths?"

### Scenario: Org Redesign Planning

1. **Org Structure** → Current layers and span
2. **Department Growth** → Historical headcount trends
3. **Manager Analytics** → Identify high-capacity managers (could absorb new reports)
4. **Flight Risk** → Identify who might resist change
5. **Chat** → "Which departments are understaffed vs overloaded?"

---

## FAQs

**Q: How often is data updated?**
A: After each CSV upload (2-5 min processing). Or manually via Settings → Refresh.

**Q: Can I export raw employee data?**
A: No. System returns aggregates only (dept totals, not names). This protects privacy.

**Q: How accurate is flight risk?**
A: 75-85% ROC AUC on historical test set. Use as signal, not prediction.

**Q: Why is this department's turnover 0%?**
A: Either no departures on record, or all departures happened before your data start date.

**Q: Can I model scenarios (e.g., "if we hire 200 engineers")?**
A: Not yet. Future feature. Currently: backward-looking analytics only.

**Q: How do I integrate with my HRIS?**
A: Use API endpoints to push/pull data. Docs at `/docs/api-endpoints.md`.

**Q: Is my data encrypted?**
A: Encrypted in transit (HTTPS). At rest depends on database (PostgreSQL: yes, SQLite: no).
