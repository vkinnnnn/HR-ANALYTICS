"""
Reports Router — Executive summaries and data export.
"""

import io
import os
import zipfile
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..data_loader import get_employees, get_history, is_loaded
from ..llm import llm_call_premium as _llm_call_premium, is_llm_available

router = APIRouter()


async def _llm_call(system: str, user: str) -> str:
    return await _llm_call_premium(system, user, temperature=0.3, max_tokens=2048)


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


def _generate_local_summary() -> str:
    """Generate a data-driven executive summary without LLM when no API key is available."""
    df = get_employees()
    total = len(df)
    active = int(df["is_active"].sum())
    departed = total - active
    turnover = round(departed / total * 100, 1) if total > 0 else 0.0
    avg_tenure = round(float(df["tenure_years"].mean()), 1)
    median_tenure = round(float(df["tenure_years"].median()), 1)
    active_df = df[df["is_active"]]

    # Worst departments
    dept_stats = (
        df.groupby("department_name")
        .agg(total=("is_active", "count"), departed=("is_active", lambda x: int((~x).sum())))
    )
    dept_stats["turnover_pct"] = (dept_stats["departed"] / dept_stats["total"] * 100).round(1)
    worst_depts = dept_stats.sort_values("turnover_pct", ascending=False).head(5)

    # Best departments
    best_depts = dept_stats[dept_stats["total"] >= 10].sort_values("turnover_pct").head(3)

    # Tenure at-risk
    short_tenure = int((active_df["tenure_years"] < 1).sum())
    long_tenure = int((active_df["tenure_years"] > 10).sum())

    # Mobility
    avg_role_changes = round(float(active_df["num_role_changes"].mean()), 1)
    avg_time_in_role = int(active_df["time_in_current_role_days"].mean())

    # Country
    top_countries = active_df["country"].value_counts().head(3) if "country" in active_df.columns else None

    lines = [
        "## Executive Workforce Summary",
        "",
        f"**Generated:** {datetime.now().strftime('%B %d, %Y')}",
        "",
        "### 1. Workforce Health Overview",
        "",
        f"The organization has **{total:,} total employees** — **{active:,} active** and **{departed:,} departed**.",
        f"The overall turnover rate stands at **{turnover}%**.",
        f"Average employee tenure is **{avg_tenure} years** (median: {median_tenure} years).",
        "",
        "### 2. Key Risk Areas",
        "",
        "**Highest turnover departments:**",
    ]
    for dept, row in worst_depts.iterrows():
        lines.append(f"- **{dept}**: {row['turnover_pct']}% turnover ({int(row['departed'])} of {int(row['total'])} departed)")

    lines += [
        "",
        f"**Early attrition risk:** {short_tenure} active employees have less than 1 year tenure.",
        f"**Institutional knowledge risk:** {long_tenure} employees have 10+ years tenure — succession planning recommended.",
        "",
        "### 3. Career Mobility & Development",
        "",
        f"- Average role changes per employee: **{avg_role_changes}**",
        f"- Average time in current role: **{avg_time_in_role} days** ({round(avg_time_in_role/365, 1)} years)",
    ]

    if avg_time_in_role > 1095:
        lines.append("- ⚠ Average time in role exceeds 3 years — potential stagnation concern")

    lines += ["", "### 4. Geographic Distribution", ""]
    if top_countries is not None:
        for country, count in top_countries.items():
            lines.append(f"- **{country}**: {count} active employees")

    lines += [
        "",
        "### 5. Recommendations",
        "",
        f"1. **Investigate high-turnover departments** — {worst_depts.index[0]} at {worst_depts.iloc[0]['turnover_pct']}% needs immediate attention",
        "2. **Strengthen onboarding** — reduce early attrition for employees under 1 year",
        "3. **Career development programs** — address role stagnation for employees 3+ years in same position",
        "4. **Succession planning** — identify and document institutional knowledge from long-tenured employees",
        "5. **Manager effectiveness review** — correlate manager retention rates with team turnover",
    ]

    if len(best_depts) > 0:
        lines.append(f"6. **Learn from success** — {best_depts.index[0]} has the lowest turnover — study their practices")

    return "\n".join(lines)


@router.post("/executive-summary")
async def executive_summary():
    """Generate an executive summary of workforce health. Uses LLM if API key is set, otherwise generates locally."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    use_llm = is_llm_available()

    if use_llm:
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
            # Fallback to local generation
            summary = _generate_local_summary()
    else:
        summary = _generate_local_summary()

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
        "source": "llm" if use_llm else "local",
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
