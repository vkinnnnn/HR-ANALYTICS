"""
Reports Router — Executive summaries and data export.
"""

import io
import os
import zipfile
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..data_loader import get_employees, get_history, get_manager_span, is_loaded
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


@router.post("/generate")
async def generate_structured_report():
    """Generate a structured interactive report with embedded chart data."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded.")

    import pandas as pd

    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    total = len(df)
    active_count = len(active)
    departed_count = len(departed)
    turnover = round(departed_count / total * 100, 1) if total > 0 else 0
    avg_tenure = round(float(df["tenure_years"].mean()), 1)
    median_tenure = round(float(df["tenure_years"].median()), 1)
    active_avg_tenure = round(float(active["tenure_years"].mean()), 1)
    departed_avg_tenure = round(float(departed["tenure_years"].mean()), 1) if departed_count > 0 else 0

    # Department stats
    dept_stats = df.groupby("department_name").agg(
        total=("is_active", "count"),
        active=("is_active", "sum"),
        departed=("is_active", lambda x: int((~x).sum())),
        avg_tenure=("tenure_years", "mean"),
    ).round(1)
    dept_stats["turnover_pct"] = (dept_stats["departed"] / dept_stats["total"] * 100).round(1)
    dept_stats = dept_stats.sort_values("total", ascending=False)

    # Build sections
    sections = []

    # ── Section 1: Workforce Composition ──
    dept_chart = dept_stats.head(10)
    top_2_depts = dept_stats.head(2)
    top_dept_names = [f"{d} ({int(r['active'])})" for d, r in top_2_depts.iterrows()]
    composition_insights = []
    if "country" in df.columns:
        top_country = active["country"].value_counts().head(1)
        if len(top_country) > 0:
            pct = round(top_country.iloc[0] / active_count * 100, 1)
            composition_insights.append(f"{pct}% of active employees are in {top_country.index[0]} — geographic concentration risk")
    small_depts = dept_stats[dept_stats["active"] <= 3]
    if len(small_depts) > 3:
        composition_insights.append(f"{len(small_depts)} departments have 3 or fewer active employees — potential restructuring candidates")

    sections.append({
        "title": "Workforce Composition",
        "narrative": f"The organization has {active_count:,} active employees across {df['department_name'].nunique()} departments and {df['country'].nunique() if 'country' in df.columns else 'N/A'} countries. The largest departments are {' and '.join(top_dept_names)}. The active-to-total ratio is {round(active_count/total*100,1)}%, meaning {round(departed_count/total*100,1)}% of all recorded employees have departed.",
        "chart": {
            "type": "bar",
            "data": [{"name": str(d), "value": int(r["active"])} for d, r in dept_chart.iterrows()],
        },
        "key_metrics": [
            {"label": "Active Headcount", "value": f"{active_count:,}"},
            {"label": "Departments", "value": str(df["department_name"].nunique())},
            {"label": "Countries", "value": str(df["country"].nunique()) if "country" in df.columns else "N/A"},
            {"label": "Business Units", "value": str(df["business_unit_name"].nunique())},
        ],
        "insights": composition_insights,
    })

    # ── Section 2: Turnover & Attrition ──
    worst_depts = dept_stats.sort_values("turnover_pct", ascending=False).head(8)
    best_depts = dept_stats[dept_stats["total"] >= 10].sort_values("turnover_pct").head(3)
    turnover_insights = []
    full_churn = dept_stats[dept_stats["turnover_pct"] >= 100]
    if len(full_churn) > 0:
        turnover_insights.append(f"{len(full_churn)} departments have 100% turnover — complete team loss: {', '.join(str(d) for d in full_churn.index[:3])}")
    early_dep = departed[departed["tenure_years"] < 1]
    if departed_count > 0 and len(early_dep) > 0:
        turnover_insights.append(f"{len(early_dep)} employees ({round(len(early_dep)/departed_count*100,1)}%) departed within their first year — onboarding effectiveness concern")
    above_benchmark = dept_stats[dept_stats["turnover_pct"] > 20]
    if len(above_benchmark) > 0:
        turnover_insights.append(f"{len(above_benchmark)} of {len(dept_stats)} departments exceed the 20% industry benchmark")

    benchmark_note = "above" if turnover > 20 else "within"
    sections.append({
        "title": "Turnover & Attrition",
        "narrative": f"Overall turnover is {turnover}%, {benchmark_note} the industry benchmark of 15-20% (BLS). The organization has lost {departed_count:,} employees with an average tenure at departure of {departed_avg_tenure}yr. The lowest-turnover departments (10+ employees) are {', '.join(str(d) for d in best_depts.index[:3])} — study their retention practices.",
        "chart": {
            "type": "horizontal_bar",
            "data": [{"name": str(d), "value": float(r["turnover_pct"])} for d, r in worst_depts.iterrows()],
        },
        "key_metrics": [
            {"label": "Turnover Rate", "value": f"{turnover}%", "change": f"Benchmark: 15-20%"},
            {"label": "Total Departed", "value": f"{departed_count:,}"},
            {"label": "Avg Tenure at Exit", "value": f"{departed_avg_tenure}yr" if departed_count > 0 else "N/A"},
            {"label": "First-Year Exits", "value": f"{len(early_dep):,}"},
        ],
        "insights": turnover_insights,
    })

    # ── Section 3: Tenure Analysis ──
    tenure_bins = [0, 0.5, 1, 2, 3, 5, 10, float("inf")]
    tenure_labels = ["0-6mo", "6-12mo", "1-2yr", "2-3yr", "3-5yr", "5-10yr", "10yr+"]
    tenure_dist = pd.cut(df["tenure_years"], bins=tenure_bins, labels=tenure_labels, right=False).value_counts().reindex(tenure_labels)
    under_1yr = int(tenure_dist.get("0-6mo", 0)) + int(tenure_dist.get("6-12mo", 0))
    long_tenured = int((active["tenure_years"] >= 10).sum())

    tenure_insights = []
    if under_1yr > total * 0.15:
        tenure_insights.append(f"{under_1yr} employees ({round(under_1yr/total*100,1)}%) have under 1 year tenure — high early-attrition risk cohort")
    if long_tenured > 0:
        tenure_insights.append(f"{long_tenured} employees with 10+ years — institutional knowledge holders requiring succession plans")

    sections.append({
        "title": "Tenure Analysis",
        "narrative": f"Average tenure is {avg_tenure} years (median: {median_tenure} years). Active employees average {active_avg_tenure}yr while departed employees averaged {departed_avg_tenure}yr at exit. The BLS industry average is 4.1 years — this organization is {'above' if avg_tenure > 4.1 else 'below'} benchmark.",
        "chart": {
            "type": "bar",
            "data": [{"name": label, "value": int(count)} for label, count in tenure_dist.items()],
        },
        "key_metrics": [
            {"label": "Avg Tenure", "value": f"{avg_tenure}yr"},
            {"label": "Median Tenure", "value": f"{median_tenure}yr"},
            {"label": "Active Avg", "value": f"{active_avg_tenure}yr"},
            {"label": "10yr+ Employees", "value": str(long_tenured)},
        ],
        "insights": tenure_insights,
    })

    # ── Section 4: Career Mobility ──
    avg_role_changes = round(float(active["num_role_changes"].mean()), 1)
    avg_manager_changes = round(float(active["num_manager_changes"].mean()), 1)
    avg_time_in_role = int(active["time_in_current_role_days"].mean())
    stuck_3yr = int((active["time_in_current_role_days"] > 1095).sum())
    stuck_5yr = int((active["time_in_current_role_days"] > 1825).sum())

    mobility_insights = []
    if stuck_3yr > active_count * 0.1:
        mobility_insights.append(f"{stuck_3yr} employees ({round(stuck_3yr/active_count*100,1)}%) stuck in same role 3+ years — career development intervention needed")
    if stuck_5yr > 0:
        mobility_insights.append(f"{stuck_5yr} employees in same role for 5+ years — high flight risk due to stagnation")
    # Correlation: manager changes → departures
    if "num_manager_changes" in df.columns:
        high_mgr_chg = df[df["num_manager_changes"] >= 3]
        if len(high_mgr_chg) > 0:
            high_dep = round((~high_mgr_chg["is_active"]).mean() * 100, 1)
            low_dep = round((~df[df["num_manager_changes"] < 3]["is_active"]).mean() * 100, 1)
            if high_dep > low_dep * 1.2:
                mobility_insights.append(f"Employees with 3+ manager changes have {high_dep}% departure rate vs {low_dep}% for others — manager stability matters")

    sections.append({
        "title": "Career Mobility",
        "narrative": f"Active employees average {avg_role_changes} role changes and {avg_manager_changes} manager changes. Average time in current role is {avg_time_in_role} days ({round(avg_time_in_role/365,1)} years). {stuck_3yr} employees ({round(stuck_3yr/active_count*100,1)}%) have been in the same role for 3+ years.",
        "chart": None,
        "key_metrics": [
            {"label": "Avg Role Changes", "value": str(avg_role_changes)},
            {"label": "Avg Manager Changes", "value": str(avg_manager_changes)},
            {"label": "Stuck 3yr+", "value": str(stuck_3yr)},
            {"label": "Avg Time in Role", "value": f"{round(avg_time_in_role/365,1)}yr"},
        ],
        "insights": mobility_insights,
    })

    # ── Section 5: Manager Effectiveness ──
    try:
        span = get_manager_span()
        total_managers = len(span)
        avg_span = round(float(span["direct_reports"].mean()), 1)
        max_span = int(span["direct_reports"].max())
        overhead = int((span["direct_reports"] == 1).sum())
        overloaded = int((span["direct_reports"] >= 10).sum())
        healthy_span = int(((span["direct_reports"] >= 5) & (span["direct_reports"] <= 8)).sum())

        mgr_insights = []
        if overhead > total_managers * 0.2:
            mgr_insights.append(f"{overhead} managers ({round(overhead/total_managers*100,1)}%) have only 1 report — potential organizational overhead")
        if overloaded > 0:
            mgr_insights.append(f"{overloaded} managers have 10+ direct reports — risk of burnout and reduced engagement")
        if avg_span < 5:
            mgr_insights.append(f"Average span of {avg_span} is below the healthy range (5-8) — organization may be over-layered")

        span_dist = [
            {"name": "1 report", "value": int((span["direct_reports"] == 1).sum())},
            {"name": "2-4", "value": int(((span["direct_reports"] >= 2) & (span["direct_reports"] <= 4)).sum())},
            {"name": "5-8", "value": healthy_span},
            {"name": "9-12", "value": int(((span["direct_reports"] >= 9) & (span["direct_reports"] <= 12)).sum())},
            {"name": "13+", "value": int((span["direct_reports"] >= 13).sum())},
        ]

        sections.append({
            "title": "Manager Effectiveness",
            "narrative": f"The organization has {total_managers} managers with an average span of control of {avg_span} direct reports (healthy range: 5-8). {healthy_span} managers ({round(healthy_span/total_managers*100,1)}%) fall within the ideal span. Maximum span is {max_span} reports.",
            "chart": {
                "type": "bar",
                "data": span_dist,
            },
            "key_metrics": [
                {"label": "Total Managers", "value": str(total_managers)},
                {"label": "Avg Span", "value": str(avg_span), "change": "Benchmark: 5-8"},
                {"label": "Overhead (1 report)", "value": str(overhead)},
                {"label": "Overloaded (10+)", "value": str(overloaded)},
            ],
            "insights": mgr_insights,
        })
    except Exception:
        pass

    # ── Section 6: Flight Risk Overview ──
    try:
        from .predictions import compute_flight_risk_sync
        risk_data = compute_flight_risk_sync(top_n=10)
        if risk_data:
            risk_insights = []
            high_risk = [r for r in risk_data if r["risk_score"] >= 0.7]
            if high_risk:
                risk_depts = list(set(r["department"] for r in high_risk))
                risk_insights.append(f"{len(high_risk)} employees in critical flight risk zone (70%+) across {', '.join(risk_depts[:3])}")

            sections.append({
                "title": "Flight Risk Analysis",
                "narrative": f"ML-based flight risk scoring identifies the top 10 employees most likely to depart based on tenure, time in role, manager changes, and title stagnation. {len(high_risk)} employees score above 70% risk.",
                "chart": {
                    "type": "horizontal_bar",
                    "data": [{"name": f"{r['department'][:15]} ({r['job_title'][:20]})", "value": round(r["risk_score"] * 100, 1)} for r in risk_data[:8]],
                },
                "key_metrics": [
                    {"label": "High Risk (70%+)", "value": str(len(high_risk))},
                    {"label": "Top Risk Score", "value": f"{round(risk_data[0]['risk_score']*100,1)}%"},
                    {"label": "Avg Risk (Top 10)", "value": f"{round(sum(r['risk_score'] for r in risk_data)/len(risk_data)*100,1)}%"},
                ],
                "insights": risk_insights,
            })
    except Exception:
        pass

    # ── Recommendations (data-driven, prioritized) ──
    recommendations = []
    if len(full_churn) > 0:
        recommendations.append({"priority": "critical", "title": f"Investigate {len(full_churn)} departments with 100% turnover", "detail": f"Departments: {', '.join(str(d) for d in full_churn.index[:3])}. Conduct exit interview analysis and compare to peer departments."})
    if departed_count > 0 and len(early_dep) > departed_count * 0.3:
        recommendations.append({"priority": "critical", "title": "Redesign onboarding program", "detail": f"{round(len(early_dep)/departed_count*100,1)}% of departures happen within the first year. Implement 30-60-90 day check-ins and buddy system."})
    if stuck_3yr > active_count * 0.1:
        recommendations.append({"priority": "high", "title": "Launch career development initiative", "detail": f"{stuck_3yr} employees stuck in same role 3+ years. Create individual development plans and cross-functional rotation opportunities."})
    if turnover > 20:
        recommendations.append({"priority": "high", "title": "Conduct stay interviews in high-turnover departments", "detail": f"Overall turnover at {turnover}% exceeds the 20% benchmark. Focus on departments above 50% turnover."})
    try:
        span = get_manager_span()
        overhead = int((span["direct_reports"] == 1).sum())
        if overhead > len(span) * 0.2:
            recommendations.append({"priority": "medium", "title": "Review manager overhead", "detail": f"{overhead} managers have only 1 direct report — consider consolidating reporting lines to reduce management overhead."})
    except Exception:
        pass
    if long_tenured > 20:
        recommendations.append({"priority": "medium", "title": "Succession planning for institutional knowledge", "detail": f"{long_tenured} employees with 10+ years tenure. Identify critical knowledge holders and create documentation/mentoring programs."})
    recommendations.append({"priority": "medium", "title": "Manager effectiveness review", "detail": "Correlate manager retention rates with team turnover to identify coaching opportunities and best practices."})

    # ── LLM executive summary (rich prompt) ──
    exec_summary = ""
    try:
        context = _build_report_context()
        exec_summary = await _llm_call(
            "You are a senior People Analytics consultant writing an executive intelligence briefing for the CHRO. "
            "Write a compelling 3-paragraph executive summary that:\n"
            "- Paragraph 1: State the organization's workforce health — headline KPIs compared to industry benchmarks "
            "(turnover benchmark: 15-20%, avg tenure benchmark: 4.1yr per BLS, healthy span: 5-8)\n"
            "- Paragraph 2: Identify the top 2-3 risk areas with specific numbers and root cause analysis. "
            "Don't just report symptoms — explain WHY (e.g., 'high turnover in X may be driven by Y')\n"
            "- Paragraph 3: Recommend 3 prioritized actions with expected impact\n\n"
            "Be data-specific (use exact numbers), concise, and write for a C-suite audience. "
            "Avoid generic platitudes — every sentence should contain a specific data point or insight.",
            context
        )
    except Exception:
        # Rich local fallback
        worst_dept = dept_stats.sort_values("turnover_pct", ascending=False).head(1)
        worst_dept_name = worst_dept.index[0] if len(worst_dept) > 0 else "Unknown"
        worst_dept_pct = float(worst_dept.iloc[0]["turnover_pct"]) if len(worst_dept) > 0 else 0

        exec_summary = (
            f"The organization has {active_count:,} active employees out of {total:,} total, "
            f"with an overall turnover rate of {turnover}% — "
            f"{'significantly above' if turnover > 20 else 'within'} the industry benchmark of 15-20%. "
            f"Average tenure is {avg_tenure} years (median: {median_tenure}yr), "
            f"{'above' if avg_tenure > 4.1 else 'below'} the BLS national average of 4.1 years.\n\n"
            f"Key risk areas: {worst_dept_name} leads with {worst_dept_pct}% turnover. "
            f"{len(early_dep)} employees ({round(len(early_dep)/max(departed_count,1)*100,1)}% of all departures) "
            f"left within their first year, pointing to onboarding gaps. "
            f"{stuck_3yr} active employees ({round(stuck_3yr/max(active_count,1)*100,1)}%) have been "
            f"in the same role for 3+ years, creating a stagnation-driven flight risk.\n\n"
            f"Priority actions: (1) Investigate high-turnover departments with targeted stay interviews, "
            f"(2) Redesign the first-year experience with 30-60-90 day check-ins, "
            f"(3) Launch career development programs for the {stuck_3yr} employees in stagnant roles."
        )

    return {
        "title": "Workforce Intelligence Report",
        "generated_at": datetime.now().isoformat(),
        "executive_summary": exec_summary,
        "sections": sections,
        "recommendations": recommendations,
        "metrics_snapshot": {
            "total_employees": total,
            "active_employees": active_count,
            "departed_employees": departed_count,
            "turnover_rate": turnover,
            "avg_tenure_years": avg_tenure,
            "median_tenure_years": median_tenure,
        },
    }
