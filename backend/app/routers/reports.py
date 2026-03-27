"""
Reports Router — Executive summaries and data export.
"""

import io
import os
import zipfile
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from ..data_loader import get_employees, get_history, is_loaded

router = APIRouter()


async def _llm_call(system: str, user: str) -> str:
    import httpx
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    try:
        client = AsyncOpenAI(api_key=api_key, http_client=httpx.AsyncClient())
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.7, max_tokens=1024,
        )
        return response.choices[0].message.content
    except TypeError:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.7, max_tokens=1024,
        )
        return response.choices[0].message.content


def _build_report_context() -> str:
    """Build a detailed context string for the executive summary."""
    df = get_employees()

    total = len(df)
    active_count = int(df["is_active"].sum())
    departed_count = total - active_count
    turnover_rate = round(departed_count / total * 100, 1) if total > 0 else 0.0

    avg_tenure = round(float(df["tenure_years"].mean()), 1)
    median_tenure = round(float(df["tenure_years"].median()), 1)

    active_df = df[df["is_active"]]

    # Department breakdown
    dept_stats = (
        df.groupby("department_name")
        .agg(
            total=("is_active", "count"),
            active=("is_active", "sum"),
            departed=("is_active", lambda x: int((~x).sum())),
            avg_tenure=("tenure_years", "mean"),
        )
        .sort_values("total", ascending=False)
    )
    dept_stats["turnover_pct"] = (dept_stats["departed"] / dept_stats["total"] * 100).round(1)
    dept_lines = []
    for dept, row in dept_stats.head(15).iterrows():
        dept_lines.append(
            f"  {dept}: {int(row['active'])} active / {int(row['departed'])} departed "
            f"(turnover {row['turnover_pct']}%, avg tenure {row['avg_tenure']:.1f}yr)"
        )

    # Grade distribution
    grade_lines = []
    if "grade_title" in df.columns:
        grade_counts = active_df.groupby("grade_title").size().sort_values(ascending=False)
        for grade, count in grade_counts.head(10).items():
            grade_lines.append(f"  {grade}: {count}")

    # Country distribution
    country_lines = []
    if "country" in df.columns:
        country_counts = active_df.groupby("country").size().sort_values(ascending=False)
        for country, count in country_counts.head(10).items():
            country_lines.append(f"  {country}: {count}")

    # Mobility stats
    avg_role_changes = round(float(active_df["num_role_changes"].mean()), 1)
    avg_manager_changes = round(float(active_df["num_manager_changes"].mean()), 1)
    avg_time_in_role = int(active_df["time_in_current_role_days"].mean())

    # Tenure distribution
    if "tenure_cohort" in df.columns:
        tenure_dist = active_df["tenure_cohort"].value_counts().to_dict()
        tenure_lines = [f"  {k}: {v}" for k, v in tenure_dist.items()]
    else:
        tenure_lines = []

    context = f"""WORKFORCE DATA FOR EXECUTIVE REPORT
Total employees: {total}
Active: {active_count} | Departed: {departed_count}
Overall turnover rate: {turnover_rate}%
Average tenure: {avg_tenure} years | Median: {median_tenure} years

Career Mobility (active):
  Avg role changes: {avg_role_changes}
  Avg manager changes: {avg_manager_changes}
  Avg time in current role: {avg_time_in_role} days

Tenure Distribution (active):
{chr(10).join(tenure_lines) if tenure_lines else '  (not available)'}

Department Breakdown (top 15):
{chr(10).join(dept_lines)}

Grade Distribution (active, top 10):
{chr(10).join(grade_lines) if grade_lines else '  (not available)'}

Country Distribution (active, top 10):
{chr(10).join(country_lines) if country_lines else '  (not available)'}
"""
    return context


@router.post("/executive-summary")
async def executive_summary():
    """Generate an LLM-powered executive summary of workforce health."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    context = _build_report_context()

    system = (
        "You are a senior HR analytics consultant writing an executive summary for the CHRO. "
        "Write a professional, data-driven executive summary covering:\n"
        "1. Overall Workforce Health (headcount, turnover, tenure)\n"
        "2. Key Risk Areas (high-turnover departments, tenure concerns)\n"
        "3. Career Mobility & Development (role changes, time in role)\n"
        "4. Geographic & Organizational Distribution\n"
        "5. Recommendations (3-5 actionable items)\n\n"
        "Use specific numbers from the data. Keep it concise but insightful. "
        "Use markdown formatting with headers."
    )

    user_msg = f"Generate an executive workforce summary based on this data:\n\n{context}"

    try:
        summary = await _llm_call(system, user_msg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    # Also compute key metrics to return alongside the narrative
    df = get_employees()
    total = len(df)
    active = int(df["is_active"].sum())
    departed = total - active

    metrics = {
        "total_employees": total,
        "active_employees": active,
        "departed_employees": departed,
        "turnover_rate": round(departed / total * 100, 1) if total > 0 else 0.0,
        "avg_tenure_years": round(float(df["tenure_years"].mean()), 1),
        "median_tenure_years": round(float(df["tenure_years"].median()), 1),
        "generated_at": datetime.now().isoformat(),
    }

    return {"summary": summary, "metrics": metrics}


@router.get("/export")
async def export_data():
    """Export all processed data as a ZIP file containing CSVs and a README."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    df = get_employees()
    hist_df = get_history()

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Employees CSV
        emp_csv = io.StringIO()
        df.to_csv(emp_csv, index=False)
        zf.writestr("employees.csv", emp_csv.getvalue())

        # History CSV
        hist_csv = io.StringIO()
        hist_df.to_csv(hist_csv, index=False)
        zf.writestr("history.csv", hist_csv.getvalue())

        # Active employees only
        active_csv = io.StringIO()
        df[df["is_active"]].to_csv(active_csv, index=False)
        zf.writestr("active_employees.csv", active_csv.getvalue())

        # Departed employees only
        departed_csv = io.StringIO()
        df[~df["is_active"]].to_csv(departed_csv, index=False)
        zf.writestr("departed_employees.csv", departed_csv.getvalue())

        # Department summary
        dept_summary = (
            df.groupby("department_name")
            .agg(
                total_employees=("is_active", "count"),
                active_employees=("is_active", "sum"),
                departed_employees=("is_active", lambda x: int((~x).sum())),
                avg_tenure_years=("tenure_years", "mean"),
                avg_role_changes=("num_role_changes", "mean"),
                avg_manager_changes=("num_manager_changes", "mean"),
            )
            .round(2)
            .reset_index()
        )
        dept_csv = io.StringIO()
        dept_summary.to_csv(dept_csv, index=False)
        zf.writestr("department_summary.csv", dept_csv.getvalue())

        # README with metrics
        total = len(df)
        active_count = int(df["is_active"].sum())
        departed_count = total - active_count
        turnover = round(departed_count / total * 100, 1) if total > 0 else 0.0

        readme = f"""HR Workforce Analytics — Data Export
=====================================
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

KEY METRICS
-----------
Total Employees:   {total}
Active Employees:  {active_count}
Departed Employees:{departed_count}
Turnover Rate:     {turnover}%
Avg Tenure:        {round(float(df['tenure_years'].mean()), 1)} years
Median Tenure:     {round(float(df['tenure_years'].median()), 1)} years

FILES INCLUDED
--------------
- employees.csv          All employees with enriched fields ({total} rows)
- history.csv            Full job change history ({len(hist_df)} rows)
- active_employees.csv   Active employees only ({active_count} rows)
- departed_employees.csv Departed employees only ({departed_count} rows)
- department_summary.csv Aggregated department-level metrics ({len(dept_summary)} departments)

COLUMN REFERENCE (employees.csv)
---------------------------------
PK_PERSON                 Unique employee identifier
Hire                      Hire date
Expire                    Departure date (NaT if still active)
job_title                 Current job title
grade_title               Grade/level
function_title            Function area
business_unit_name        Business unit
department_name           Department
country                   Country
is_active                 Whether the employee is currently active
tenure_days               Total tenure in days
tenure_years              Total tenure in years
num_role_changes          Number of job history records
num_manager_changes       Number of distinct managers
num_actual_title_changes  Number of actual title changes
time_in_current_role_days Days in current role
"""
        zf.writestr("README.txt", readme)

    buffer.seek(0)

    filename = f"workforce_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
