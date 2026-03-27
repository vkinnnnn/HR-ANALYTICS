---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.css"
  - "frontend/tailwind.config.*"
---
# Frontend Rules — Workforce Analytics Platform

IMPORTANT: This is a WORKFORCE analytics platform. Pages show headcount, turnover, tenure, career progression, manager analytics, org structure, flight risk — NOT recognition awards.

## MUST READ: @docs/design-system.md for all tokens, colors, component specs

## Stack
React 18 + TypeScript strict + Vite + Tailwind CSS + Recharts + Lucide React + Axios

## Sidebar Navigation Groups
```
Overview (orange):     Dashboard, Workforce Composition
Retention (rose):      Turnover & Attrition, Tenure Analysis, Flight Risk
People (emerald):      Career Progression, Manager Analytics, Org Structure
Intelligence (purple): AI Chatbot, AI Insights / Taxonomy
Operations (amber):    Data Upload, Reports & Export, Settings
```

## 14 Pages to Build

1. **Dashboard** — KPIs: headcount, turnover rate, avg tenure, new hires this qtr, departures this qtr. Charts: headcount trend line, turnover by dept bar, tenure distribution histogram, top 5 flight risk employees
2. **Workforce Composition** — Headcount by every dimension (dept, BU, function, grade, location, country). Grade pyramid visualization. Geographic map. Active vs departed breakdown
3. **Turnover & Attrition** — Overall rate + by dept/grade/location/function. Monthly trend line. Tenure-at-departure histogram. "Danger zone" departments highlighted. Voluntary vs involuntary if detectable
4. **Tenure Analysis** — Avg tenure KPIs by dept/grade. Cohort breakdown (0-1yr, 1-3yr, 3-5yr, 5-10yr, 10yr+). Retention curves (Kaplan-Meier style). Long-tenured employees list (institutional knowledge)
5. **Flight Risk** — ML-predicted risk scores table. Feature importance chart. Top 10 watchlist. Risk by department heatmap. Filters by dept/grade/location
6. **Career Progression** — Promotion velocity by dept/grade. Career path Sankey diagram or flow chart. "Stuck" employees list (3+ yrs same role). Lateral vs upward move ratio. Grade progression timeline
7. **Manager Analytics** — Span of control distribution. Manager retention scorecard (% of reports who stay 1yr, 2yr, 3yr). "Revolving door" manager flags. Manager-to-employee ratio by dept
8. **Org Structure** — Hierarchy depth metrics. Department size timeline. Restructuring event detection. Interactive org tree (if feasible) or nested treemap
9. **AI Chatbot** — Full-screen chat interface. Natural language queries about the workforce. Renders charts inline when appropriate. Suggested prompts for each user persona (CEO, VP, HR Manager)
10. **AI Insights / Taxonomy** — Auto-generated job family taxonomy. Grade level standardization results. Career move classifications. Refresh/regenerate button
11. **Data Upload** — Drag-and-drop CSV upload zone. Column validation feedback. Processing status with progress. Preview of parsed data before committing
12. **Reports & Export** — Executive summary (LLM-generated). Power BI export ZIP. PDF report download. Scheduled report configuration
13. **Settings** — Data source path configuration. LLM API key management. Model parameters (risk thresholds, taxonomy settings). User preferences

## Component Rules
- All components use design tokens from @docs/design-system.md
- Glass panels: bg-surface + backdrop-blur-20 + border-subtle + rounded-xl
- KPI cards with AnimatedNumber, stagger delay (60ms per card)
- Charts: Recharts with custom glass tooltip, gradient fills, minimal grid
- NEVER use HTML <table> — CSS Grid for all tabular data
- NEVER hardcode colors — always use token constants

## Chart Types by Page
- Dashboard: Area (headcount trend), Bar (turnover by dept), Histogram (tenure)
- Workforce: Bar (by dimension), Pie (grade split), Treemap (org)
- Turnover: Line (monthly trend), Bar (by dept), Area (cumulative)
- Tenure: Histogram, Area (retention curve), Bar (by grade)
- Flight Risk: Scatter (risk vs tenure), Bar (by dept), Heatmap
- Careers: Sankey/flow (career paths), Bar (promotion velocity), Timeline
- Managers: Bar (span of control), Scatter (retention vs span), Radar (multi-dim score)
- Org: Treemap (department sizes), Line (growth), Tree (hierarchy)
