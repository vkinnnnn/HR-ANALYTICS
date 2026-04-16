# Workforce IQ API Endpoints

Complete API reference for Workforce IQ. All endpoints return JSON. Base URL: `http://localhost:8119/api`

---

## Workforce Data

### GET `/workforce/summary`
Executive workforce snapshot — total headcount, active vs departed, new hires this quarter.

**Response:**
```json
{
  "total_active": 2400,
  "total_departed": 66,
  "new_hires_this_quarter": 120,
  "departures_this_quarter": 15,
  "departments": 8,
  "countries": 3
}
```

### GET `/workforce/headcount-trend`
Monthly headcount trend over time (for area charts).

**Response:**
```json
{
  "trend": [
    { "month": "2024-01", "headcount": 2350 },
    { "month": "2024-02", "headcount": 2365 },
    { "month": "2024-03", "headcount": 2400 }
  ]
}
```

### GET `/workforce/by-dimension?dimension=department|grade|location|function|business_unit`
Headcount breakdown by any workforce dimension.

**Query Parameters:**
- `dimension` — `department`, `grade`, `location`, `function`, `business_unit`

**Response:**
```json
{
  "by_dimension": [
    { "name": "Engineering", "count": 800, "active": 780, "departed": 20 },
    { "name": "Sales", "count": 420, "active": 410, "departed": 10 }
  ]
}
```

---

## Turnover & Attrition

### GET `/turnover/summary`
Company-wide turnover KPIs.

**Response:**
```json
{
  "turnover_rate": 2.7,
  "departures_this_quarter": 15,
  "avg_tenure_days": 1850
}
```

### GET `/turnover/by-department`
Turnover rate sliced by department (top 8 for dashboard).

**Response:**
```json
{
  "by_department": [
    { "department_name": "Engineering", "turnover_rate": 2.1, "headcount": 800 },
    { "department_name": "Sales", "turnover_rate": 4.8, "headcount": 420 }
  ]
}
```

### GET `/turnover/danger-zones`
Departments with elevated turnover (>20% annual rate).

**Response:**
```json
{
  "danger_zones": [
    { "department": "Customer Service", "turnover_rate": 28.5, "company_avg": 2.7 }
  ]
}
```

---

## Tenure Analysis

### GET `/tenure/summary`
Tenure KPIs — average, median, distribution.

**Response:**
```json
{
  "avg_tenure_years": 5.2,
  "median_tenure_years": 3.8,
  "long_tenured_10yr": 340
}
```

### GET `/tenure/distribution`
Histogram of employees by tenure band.

**Response:**
```json
{
  "distribution": [
    { "band": "0-1yr", "count": 280 },
    { "band": "1-3yr", "count": 650 },
    { "band": "3-5yr", "count": 420 },
    { "band": "5-10yr", "count": 710 },
    { "band": "10yr+", "count": 340 }
  ]
}
```

---

## Flight Risk

### GET `/predictions/flight-risk?top_n=50`
ML-scored flight risk employees (LogisticRegression on tenure, role changes, manager churn).

**Query Parameters:**
- `top_n` — return top N at-risk employees (default: 50)

**Response:**
```json
{
  "flight_risk": [
    {
      "pk_user": "EMP1234",
      "job_title": "Senior Engineer",
      "department_name": "Engineering",
      "tenure_years": 2.1,
      "time_in_current_role_days": 180,
      "manager_changes": 2,
      "risk_score": 0.87
    }
  ]
}
```

---

## Career Progression

### GET `/careers/promotion-velocity`
Average days between promotions by department/grade.

**Response:**
```json
{
  "by_department": [
    { "department": "Engineering", "avg_days_between_promotions": 840 }
  ],
  "promoted_employees": 580,
  "promotion_rate": 24.2
}
```

### GET `/careers/stuck-employees`
Employees in same role for 3+ years.

**Response:**
```json
{
  "stuck_count": 240,
  "by_department": [
    { "department": "Finance", "stuck": 45, "total": 180 }
  ]
}
```

---

## Manager Analytics

### GET `/managers/span-of-control`
Distribution of direct reports per manager.

**Response:**
```json
{
  "avg_span": 6.2,
  "distribution": [
    { "span_bucket": "1-3", "manager_count": 120 },
    { "span_bucket": "4-8", "manager_count": 280 }
  ]
}
```

### GET `/managers/retention-score`
Manager effectiveness based on team retention rates.

**Response:**
```json
{
  "top_retainers": [
    { "manager_id": "MGR456", "reports": 8, "retention_rate": 100, "tenure_years": 8.5 }
  ]
}
```

---

## Org Structure

### GET `/org/hierarchy-depth`
Organization tree depth metrics — layers, width, pyramidality.

**Response:**
```json
{
  "max_depth": 8,
  "avg_span_by_level": [14, 6.2, 4.1, 3.8, 2.1],
  "c_suite": 5,
  "directors": 28,
  "managers": 210
}
```

---

## Chat & AI

### POST `/chat`
Natural language query about workforce data.

**Request:**
```json
{
  "message": "How many employees do we have?",
  "user_id": "user_123",
  "conversation_id": "conv_456",
  "current_page": "/app/dashboard"
}
```

**Response:**
```json
{
  "response": "You have 2,400 active employees across 8 departments...",
  "suggestions": ["Show me by department", "What's our turnover rate?"]
}
```

### GET `/brain/health`
Health check for AI chatbot service.

**Response:**
```json
{
  "status": "ok",
  "workforce_loaded": true,
  "employees_count": 2400
}
```

---

## Data Upload & Settings

### POST `/upload/csv`
Upload workforce CSV files (function_wh.csv, wh_history_full.csv).

**Form Data:**
- `file` — CSV file

**Response:**
```json
{
  "status": "processing",
  "job_id": "job_789",
  "message": "File uploaded. Processing taxonomy..."
}
```

### GET `/settings`
Retrieve platform configuration.

**Response:**
```json
{
  "data_dir": "/data/wh_Dataset",
  "last_loaded": "2024-04-15T10:30:00Z",
  "llm_model": "gpt-4o-mini"
}
```

### POST `/settings`
Update platform settings.

**Request:**
```json
{
  "data_dir": "/new/path",
  "llm_temperature": 0.7
}
```

---

## Reports & Export

### GET `/reports/summary`
Generate executive summary report (LLM-synthesized).

**Response:**
```json
{
  "title": "Q1 2024 Workforce Summary",
  "generated_at": "2024-04-15T10:30:00Z",
  "executive_summary": "...",
  "sections": [ ... ],
  "recommendations": [ ... ]
}
```

### GET `/reports/download`
Download workforce data bundle as ZIP (CSV + JSON).

---

## Error Responses

All errors return HTTP status code + JSON detail:

```json
{
  "detail": "Workforce data not loaded. Please upload CSV first."
}
```

**Common Status Codes:**
- `200` — Success
- `400` — Bad request (invalid parameter)
- `404` — Resource not found
- `503` — Service unavailable (data not loaded, LLM down, etc.)

---

## Rate Limiting

No rate limits in development. In production, add:
- 100 requests/minute per API key
- 10 requests/second per IP for `/chat`

---

## Authentication

Currently no authentication (local development). For production, add API keys:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8119/api/workforce/summary
```
