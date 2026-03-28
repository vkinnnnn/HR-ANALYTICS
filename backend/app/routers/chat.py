"""
AI Chatbot Router — Deep workforce analytics Q&A with multi-turn context,
drill-down analysis, comparative insights, and follow-up suggestions.
"""

import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..data_loader import get_employees, get_history, get_manager_span, is_loaded
from ..llm import llm_call as _llm_call_raw

router = APIRouter()


class ChatQuery(BaseModel):
    question: str
    current_page: str | None = None
    filters: dict | None = None
    conversation_history: list[dict] | None = None  # Multi-turn support


class NavigationCommand(BaseModel):
    action: str = "navigate"
    route: str
    scroll_to: str | None = None
    highlight: str | None = None


class ChatResponse(BaseModel):
    answer: str
    data: dict | None = None
    suggestions: list[str] | None = None
    analysis_type: str | None = None
    navigation: NavigationCommand | None = None


# ─── Deep Context Builder ───────────────────────────────────────────

def _build_deep_context(current_page: str | None = None, filters: dict | None = None) -> str:
    """Build comprehensive data context with page-specific deep analytics."""
    df = get_employees()
    hist = get_history()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]

    total = len(df)
    active_count = len(active)
    departed_count = len(departed)
    turnover_rate = round(departed_count / total * 100, 1) if total > 0 else 0

    avg_tenure = round(float(df["tenure_years"].mean()), 1)
    median_tenure = round(float(df["tenure_years"].median()), 1)
    active_avg_tenure = round(float(active["tenure_years"].mean()), 1)
    departed_avg_tenure = round(float(departed["tenure_years"].mean()), 1) if len(departed) > 0 else 0

    sections = []

    # ── Core metrics ──
    sections.append(f"""WORKFORCE OVERVIEW
Total: {total} | Active: {active_count} | Departed: {departed_count}
Turnover rate: {turnover_rate}%
Avg tenure: {avg_tenure}yr (active: {active_avg_tenure}yr, departed at exit: {departed_avg_tenure}yr)
Median tenure: {median_tenure}yr
Departments: {df['department_name'].nunique()} | Countries: {df['country'].nunique() if 'country' in df.columns else 'N/A'}
""")

    # ── Department deep dive ──
    dept_stats = df.groupby("department_name").agg(
        total=("is_active", "count"),
        active=("is_active", "sum"),
        departed=("is_active", lambda x: int((~x).sum())),
        avg_tenure=("tenure_years", "mean"),
        avg_role_changes=("num_role_changes", "mean"),
        avg_time_in_role=("time_in_current_role_days", "mean"),
    ).round(1)
    dept_stats["turnover_pct"] = (dept_stats["departed"] / dept_stats["total"] * 100).round(1)
    dept_stats = dept_stats.sort_values("total", ascending=False)

    dept_lines = []
    for dept, row in dept_stats.head(15).iterrows():
        dept_lines.append(
            f"  {dept}: {int(row['active'])}active/{int(row['departed'])}dep "
            f"(turnover {row['turnover_pct']}%, avg tenure {row['avg_tenure']}yr, "
            f"avg {row['avg_role_changes']:.1f} role changes, "
            f"avg {int(row['avg_time_in_role'])}d in current role)"
        )
    sections.append("DEPARTMENTS (top 15):\n" + "\n".join(dept_lines))

    # ── Flight risk data ──
    try:
        from ..routers.predictions import _compute_flight_risk
        risk_data = _compute_flight_risk(top_n=10)
        if risk_data:
            risk_lines = []
            for emp in risk_data[:10]:
                title = emp.get("job_title", "Unknown")
                if title == "nan" or not title:
                    title = "Untitled Role"
                risk_lines.append(
                    f"  {title} ({emp.get('department','?')}) — "
                    f"risk: {emp.get('risk_score',0)*100:.0f}%, "
                    f"tenure: {emp.get('tenure_years',0):.1f}yr, "
                    f"time in role: {emp.get('time_in_current_role_days',0)}d"
                )
            sections.append("TOP FLIGHT RISKS:\n" + "\n".join(risk_lines))
    except Exception:
        pass

    # ── Manager analytics ──
    try:
        span = get_manager_span()
        avg_span = round(float(span["direct_reports"].mean()), 1)
        max_span = int(span["direct_reports"].max())
        total_managers = len(span)
        sections.append(f"""MANAGER METRICS:
  Total managers: {total_managers}
  Avg span of control: {avg_span} direct reports
  Max span: {max_span} direct reports
  Managers with 1 report (potential overhead): {int((span['direct_reports']==1).sum())}
  Managers with 10+ reports (potential overload): {int((span['direct_reports']>=10).sum())}""")
    except Exception:
        pass

    # ── Career mobility ──
    avg_role_changes = round(float(active["num_role_changes"].mean()), 1)
    avg_manager_changes = round(float(active["num_manager_changes"].mean()), 1)
    avg_title_changes = round(float(active["num_actual_title_changes"].mean()), 1) if "num_actual_title_changes" in active.columns else 0
    avg_time_in_role = int(active["time_in_current_role_days"].mean())
    stuck_3yr = int((active["time_in_current_role_days"] > 1095).sum())
    stuck_5yr = int((active["time_in_current_role_days"] > 1825).sum())

    sections.append(f"""CAREER MOBILITY (active employees):
  Avg role changes: {avg_role_changes} | Avg title changes: {avg_title_changes}
  Avg manager changes: {avg_manager_changes}
  Avg time in current role: {avg_time_in_role} days ({round(avg_time_in_role/365,1)}yr)
  Employees stuck 3+ years in same role: {stuck_3yr} ({round(stuck_3yr/active_count*100,1)}%)
  Employees stuck 5+ years in same role: {stuck_5yr} ({round(stuck_5yr/active_count*100,1)}%)""")

    # ── Grade distribution ──
    if "grade_band" in df.columns:
        grade_dist = active.groupby("grade_band").size().sort_values(ascending=False)
        grade_lines = [f"  {band}: {count}" for band, count in grade_dist.items()]
        sections.append("GRADE BANDS (active):\n" + "\n".join(grade_lines))

    if "grade_title" in df.columns:
        grade_counts = active.groupby("grade_title").size().sort_values(ascending=False).head(10)
        grade_lines = [f"  {g}: {c}" for g, c in grade_counts.items()]
        sections.append("TOP GRADES (active):\n" + "\n".join(grade_lines))

    # ── Tenure distribution ──
    import pandas as pd
    tenure_bins = [0, 0.5, 1, 2, 3, 5, 10, float("inf")]
    tenure_labels = ["0-6mo", "6-12mo", "1-2yr", "2-3yr", "3-5yr", "5-10yr", "10yr+"]
    tenure_dist = pd.cut(df["tenure_years"], bins=tenure_bins, labels=tenure_labels, right=False).value_counts().reindex(tenure_labels)
    tenure_lines = [f"  {label}: {int(count)}" for label, count in tenure_dist.items()]
    sections.append("TENURE DISTRIBUTION:\n" + "\n".join(tenure_lines))

    # ── Country breakdown ──
    if "country" in df.columns:
        country_stats = active.groupby("country").size().sort_values(ascending=False).head(10)
        country_lines = [f"  {c}: {n}" for c, n in country_stats.items()]
        sections.append("COUNTRY (active, top 10):\n" + "\n".join(country_lines))

    # ── Function families ──
    if "function_family" in df.columns:
        func_stats = active.groupby("function_family").size().sort_values(ascending=False).head(10)
        func_lines = [f"  {f}: {n}" for f, n in func_stats.items()]
        sections.append("FUNCTION FAMILIES (active):\n" + "\n".join(func_lines))

    # ── Business units ──
    bu_stats = active.groupby("business_unit_name").size().sort_values(ascending=False).head(10)
    bu_lines = [f"  {bu}: {n}" for bu, n in bu_stats.items()]
    sections.append("BUSINESS UNITS (active, top 10):\n" + "\n".join(bu_lines))

    # ── Cohort analysis (hire year retention) ──
    if "hire_year" in df.columns:
        cohort_lines = []
        for year in sorted(df["hire_year"].dropna().unique())[-5:]:
            cohort = df[df["hire_year"] == year]
            ct = len(cohort)
            still_active = int(cohort["is_active"].sum())
            retention = round(still_active / ct * 100, 1) if ct > 0 else 0
            cohort_lines.append(f"  {int(year)} cohort: {ct} hired, {still_active} remain ({retention}% retention)")
        if cohort_lines:
            sections.append("HIRE COHORT RETENTION (last 5 years):\n" + "\n".join(cohort_lines))

    # ── Manager deep dive (top/bottom by retention) ──
    try:
        mgr_df = get_current_managers()
        span = get_manager_span()
        # Managers with 3+ reports for meaningful analysis
        big_mgrs = span[span["direct_reports"] >= 3]
        if len(big_mgrs) > 0:
            mgr_retention = []
            for _, mrow in big_mgrs.iterrows():
                mid = mrow["manager_id"]
                reports = mgr_df[mgr_df["fk_direct_manager"] == mid]["pk_user"].values
                report_emps = df[df["PK_PERSON"].isin(reports)]
                if len(report_emps) > 0:
                    ret_rate = round(report_emps["is_active"].mean() * 100, 1)
                    mgr_retention.append({"manager_id": mid, "reports": int(mrow["direct_reports"]), "retention": ret_rate})
            if mgr_retention:
                mgr_retention.sort(key=lambda x: x["retention"])
                worst_mgrs = mgr_retention[:3]
                best_mgrs = sorted(mgr_retention, key=lambda x: -x["retention"])[:3]
                mgr_lines = ["  LOWEST RETENTION MANAGERS (possible revolving doors):"]
                for m in worst_mgrs:
                    mgr_lines.append(f"    Manager {m['manager_id']}: {m['reports']} reports, {m['retention']}% retention")
                mgr_lines.append("  HIGHEST RETENTION MANAGERS:")
                for m in best_mgrs:
                    mgr_lines.append(f"    Manager {m['manager_id']}: {m['reports']} reports, {m['retention']}% retention")
                sections.append("MANAGER RETENTION ANALYSIS:\n" + "\n".join(mgr_lines))
    except Exception:
        pass

    # ── Cross-metric correlations ──
    correlations = []
    # High manager changes → higher departure?
    if "num_manager_changes" in active.columns:
        high_mgr_chg = df[df["num_manager_changes"] >= 3]
        low_mgr_chg = df[df["num_manager_changes"] < 3]
        if len(high_mgr_chg) > 0 and len(low_mgr_chg) > 0:
            high_dep_rate = round((~high_mgr_chg["is_active"]).mean() * 100, 1)
            low_dep_rate = round((~low_mgr_chg["is_active"]).mean() * 100, 1)
            if high_dep_rate > low_dep_rate * 1.2:
                correlations.append(f"Employees with 3+ manager changes have {high_dep_rate}% departure rate vs {low_dep_rate}% for those with fewer changes")
    # Stuck employees → higher departure?
    if "time_in_current_role_days" in df.columns:
        stuck = df[df["time_in_current_role_days"] > 1095]
        not_stuck = df[df["time_in_current_role_days"] <= 1095]
        if len(stuck) > 0 and len(not_stuck) > 0:
            stuck_dep = round((~stuck["is_active"]).mean() * 100, 1)
            not_stuck_dep = round((~not_stuck["is_active"]).mean() * 100, 1)
            if stuck_dep != not_stuck_dep:
                correlations.append(f"Employees 3+ years in same role: {stuck_dep}% departed vs {not_stuck_dep}% for others")
    # Title changes → retention?
    if "num_actual_title_changes" in df.columns:
        promoted = df[df["num_actual_title_changes"] > 0]
        not_promoted = df[df["num_actual_title_changes"] == 0]
        if len(promoted) > 0 and len(not_promoted) > 0:
            p_ret = round(promoted["is_active"].mean() * 100, 1)
            np_ret = round(not_promoted["is_active"].mean() * 100, 1)
            correlations.append(f"Employees with title changes: {p_ret}% still active vs {np_ret}% for those without")
    if correlations:
        sections.append("CROSS-METRIC CORRELATIONS:\n" + "\n".join(f"  📊 {c}" for c in correlations))

    # ── Org structure depth ──
    try:
        hist = get_history()
        # Approximate hierarchy depth from manager chains
        unique_managers = hist["fk_direct_manager"].nunique()
        unique_employees = hist["pk_user"].nunique()
        mgr_to_emp_ratio = round(unique_managers / unique_employees * 100, 1) if unique_employees > 0 else 0
        sections.append(f"ORG STRUCTURE:\n  Unique managers in hierarchy: {unique_managers}\n  Manager-to-employee ratio: {mgr_to_emp_ratio}%\n  Departments: {df['department_name'].nunique()}\n  Business units: {df['business_unit_name'].nunique()}")
    except Exception:
        pass

    # ── Anomalies / alerts ──
    anomalies = []
    full_churn = dept_stats[dept_stats["turnover_pct"] >= 100]
    if len(full_churn) > 0:
        anomalies.append(f"{len(full_churn)} departments have 100% turnover: {', '.join(str(d) for d in full_churn.index[:5])}")
    early_dep = departed[departed["tenure_years"] < 1]
    if len(early_dep) > 0:
        anomalies.append(f"{len(early_dep)} employees departed within first year ({round(len(early_dep)/departed_count*100,1)}% of all departures)")
    recent_hires = df[df["Hire"] >= (pd.Timestamp.now() - pd.Timedelta(days=90))]
    if len(recent_hires) == 0:
        anomalies.append("No new hires in the last 90 days")
    if anomalies:
        sections.append("ANOMALIES DETECTED:\n" + "\n".join(f"  ⚠ {a}" for a in anomalies))

    # ── Page-specific deep context ──
    if current_page:
        page_context = _get_page_specific_context(current_page, df, active, departed, hist, filters)
        if page_context:
            sections.append(f"PAGE-SPECIFIC CONTEXT ({current_page}):\n{page_context}")

    return "\n\n".join(sections)


def _get_page_specific_context(page: str, df, active, departed, hist, filters) -> str:
    """Extra deep context based on which page the user is viewing."""
    if page in ("/turnover", "/turnover/"):
        # Turnover trend by quarter
        if departed["Expire"].notna().any():
            qtr_dep = departed.groupby(departed["Expire"].dt.to_period("Q")).size().tail(8)
            lines = [f"  {str(q)}: {c} departures" for q, c in qtr_dep.items()]
            return "QUARTERLY DEPARTURES (last 8):\n" + "\n".join(lines)

    elif page in ("/careers", "/careers/"):
        # Promotion data
        if "num_actual_title_changes" in active.columns:
            promoted = active[active["num_actual_title_changes"] > 0]
            return f"Promoted employees: {len(promoted)} ({round(len(promoted)/len(active)*100,1)}%)\nAvg title changes: {round(float(promoted['num_actual_title_changes'].mean()),1)}"

    elif page in ("/managers", "/managers/"):
        try:
            span = get_manager_span()
            top_mgrs = span.sort_values("direct_reports", ascending=False).head(5)
            lines = [f"  Manager {row['manager_id']}: {row['direct_reports']} reports" for _, row in top_mgrs.iterrows()]
            return "TOP MANAGERS BY SPAN:\n" + "\n".join(lines)
        except Exception:
            pass

    elif page in ("/tenure", "/tenure/"):
        long_tenured = active[active["tenure_years"] >= 10]
        short_dep = departed[departed["tenure_years"] < 1]
        return f"Long-tenured (10yr+): {len(long_tenured)} employees\nShort-tenure departures (<1yr): {len(short_dep)}"

    return ""


# ─── System Prompt ──────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Workforce AI — a senior People Analytics consultant embedded in Workforce IQ, an HR intelligence platform.

You have comprehensive workforce data. Provide deep, actionable analysis — identify patterns, root causes, and recommend actions.

ANALYSIS PRINCIPLES:
1. Lead with the specific number, then explain what it means
2. Compare to benchmarks (industry avg turnover: 15-20%, avg tenure: 4.1yr per BLS, healthy span of control: 5-8)
3. Identify root causes, not symptoms (high turnover → check tenure at departure, manager changes, grade stagnation)
4. Provide actionable recommendations with expected impact
5. Flag anomalies and risks proactively
6. Normalize by headcount when comparing groups
7. Reference departments/roles not individual names

METRIC DEFINITIONS (use when asked "how is this calculated?"):
- Turnover rate = departed / total employees × 100 (all-time, unless time period specified)
- Tenure = (today or departure date) − hire date
- Span of control = count of direct reports per manager (from fk_direct_manager)
- Flight risk = ML model (LogisticRegression) using: tenure, time_in_role, manager_changes, title_changes
- Promotion = actual job title change between consecutive history records
- Stuck employee = active employee with 3+ years in same role (time_in_current_role_days > 1095)

COHORT ANALYSIS: When asked to compare groups, build cohorts by hire year, department, grade, or tenure band and compare retention rates, promotion velocity, and mobility metrics.

AMBIGUITY: If a question is ambiguous, make your best interpretation based on the page context, but note your assumption. Example: "Interpreting 'turnover' as all departures (not just voluntary). If you meant voluntary only, that breakdown isn't available in the current dataset."

DATA STORYTELLING: For executive questions (health, summary, overview), structure as:
1. Headline metric with benchmark comparison
2. What changed or what's notable
3. Top 2-3 risk areas with specific numbers
4. 2-3 recommended actions

RESPONSE FORMAT:
- **Bold** key numbers and findings
- Bullet points for lists, tables for comparisons
- Be concise but thorough — CHROs read this
- One chart per response when it adds value

CHART FORMAT (include EXACTLY ONE when relevant):
```json
{{"chart_type": "bar|pie|line|area", "labels": [...], "values": [...], "title": "...", "highlight": "optional_label"}}
```

NAVIGATION (when user asks to "show me", "take me to", "where can I see"):
Include a navigation command line: NAVIGATE: /route#section_id
Available pages:
- / (Dashboard): sections: kpi-cards, insight-banner, headcount-chart, turnover-chart, tenure-chart, flight-risk-table
- /turnover: turnover rates, trends, danger zones. sections: turnover-summary, turnover-trend, danger-zones
- /tenure: cohorts, retention curves. sections: tenure-summary, tenure-distribution
- /flight-risk: ML scores, features. sections: risk-table, feature-importance
- /careers: promotion velocity, stuck employees. sections: career-summary, stuck-employees
- /managers: span of control, retention. sections: manager-leaderboard, span-of-control
- /org: hierarchy, dept sizes. sections: org-summary, dept-sizes
- /insights: taxonomy results
- /reports: executive summary, export
- /settings: LLM config
- /upload: CSV upload
Example: User asks "Show me turnover" → respond with analysis AND add: NAVIGATE: /turnover#turnover-summary

FOLLOW-UP SUGGESTIONS (ALWAYS include):
End with: SUGGESTIONS: question 1 | question 2 | question 3

{context}
"""


# ─── Response Parser ────────────────────────────────────────────────

def _parse_response(raw: str) -> tuple[str, dict | None, list[str] | None, dict | None]:
    """Parse LLM response to extract text, chart_data, suggestions, and navigation."""
    answer = raw
    chart_data = None
    suggestions = None
    navigation = None

    # Extract navigation command
    if "NAVIGATE:" in answer:
        nav_parts = answer.split("NAVIGATE:")
        answer = nav_parts[0].strip()
        nav_str = nav_parts[1].strip().split("\n")[0].strip()
        # Parse /route#section format
        if "#" in nav_str:
            route, section = nav_str.split("#", 1)
            navigation = {"action": "navigate", "route": route.strip(), "scroll_to": section.strip(), "highlight": section.strip()}
        else:
            navigation = {"action": "navigate", "route": nav_str.strip()}

    # Extract suggestions
    if "SUGGESTIONS:" in answer:
        parts = answer.split("SUGGESTIONS:")
        answer = parts[0].strip()
        suggestion_text = parts[1].strip()
        suggestions = [s.strip() for s in suggestion_text.split("|") if s.strip()]

    # Extract chart data
    if "```json" in answer:
        try:
            json_start = answer.index("```json") + 7
            json_end = answer.index("```", json_start)
            json_str = answer[json_start:json_end].strip()
            chart_data = json.loads(json_str)
            answer = answer[:answer.index("```json")].strip()
        except (ValueError, json.JSONDecodeError):
            pass

    return answer, chart_data, suggestions, navigation


# ─── Local Fallback ─────────────────────────────────────────────────

def _local_chat_response(question: str) -> tuple[str, dict | None, list[str] | None]:
    """Data-driven response without LLM."""
    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    q = question.lower()

    if any(w in q for w in ["turnover", "attrition", "leaving", "depart"]):
        total = len(df)
        dep = len(departed)
        rate = round(dep / total * 100, 1) if total > 0 else 0
        dept_turnover = df.groupby("department_name").agg(
            total=("is_active", "count"), dep=("is_active", lambda x: int((~x).sum()))
        )
        dept_turnover["pct"] = (dept_turnover["dep"] / dept_turnover["total"] * 100).round(1)
        worst = dept_turnover.sort_values("pct", ascending=False).head(5)
        lines = [f"**Overall turnover rate: {rate}%** ({dep} departed out of {total} total)\n", "**Highest turnover departments:**"]
        for dept, row in worst.iterrows():
            lines.append(f"- {dept}: {row['pct']}% ({int(row['dep'])}/{int(row['total'])})")
        chart = {"chart_type": "bar", "labels": list(worst.index), "values": [float(v) for v in worst["pct"]], "title": "Turnover by Department (%)"}
        suggestions = ["Why is turnover so high in these departments?", "What's the avg tenure of departed employees?", "Which grades have highest attrition?"]
        return "\n".join(lines), chart, suggestions

    if any(w in q for w in ["tenure", "how long", "years of service"]):
        avg_t = round(float(active["tenure_years"].mean()), 1)
        med_t = round(float(active["tenure_years"].median()), 1)
        text = f"**Active employee tenure:** avg {avg_t}yr, median {med_t}yr\n**Total active:** {len(active)}"
        return text, None, ["Who has the longest tenure?", "Show tenure by department", "Early departure patterns"]

    if any(w in q for w in ["headcount", "how many", "employee", "workforce", "health", "summary", "overview"]):
        dept_counts = active.groupby("department_name").size().sort_values(ascending=False).head(8)
        lines = [f"**Total active employees: {len(active)}** (out of {len(df)} total)\n", "**Top departments:**"]
        for dept, count in dept_counts.items():
            lines.append(f"- {dept}: {count}")
        chart = {"chart_type": "bar", "labels": list(dept_counts.index), "values": [int(v) for v in dept_counts.values], "title": "Headcount by Department"}
        return "\n".join(lines), chart, ["What's our turnover rate?", "Show me flight risks", "Tenure distribution"]

    if any(w in q for w in ["risk", "flight", "danger", "leaving soon"]):
        text = (
            f"**{len(active)} active employees** are scored for flight risk.\n"
            f"Key risk factors: time in current role, tenure, manager changes, grade stagnation.\n"
            f"Visit the **Flight Risk** page for the full scored list."
        )
        return text, None, ["Who are the top 10 highest risk?", "Risk breakdown by department", "What drives flight risk?"]

    if any(w in q for w in ["stuck", "stagnant", "same role"]):
        stuck = active[active["time_in_current_role_days"] > 1095]
        text = f"**{len(stuck)} employees** have been in the same role for 3+ years ({round(len(stuck)/len(active)*100,1)}% of active workforce)."
        return text, None, ["Show stuck employees by department", "What's the avg time in role?", "Promotion velocity analysis"]

    # Department-specific
    for dept in df["department_name"].unique():
        if str(dept).lower() in q:
            d = df[df["department_name"] == dept]
            act = int(d["is_active"].sum())
            dep_c = len(d) - act
            avg_t = round(float(d["tenure_years"].mean()), 1)
            text = f"**{dept}:** {len(d)} total, {act} active, {dep_c} departed\n**Turnover:** {round(dep_c/len(d)*100,1)}%\n**Avg tenure:** {avg_t}yr"
            return text, None, [f"Who's at risk in {dept}?", f"Compare {dept} to company avg", f"Show {dept} tenure distribution"]

    text = (
        f"I have data on **{len(df)} employees** ({len(active)} active, {len(departed)} departed).\n"
        f"I can analyze **turnover, tenure, headcount, departments, grades, career mobility, flight risk, and manager effectiveness**."
    )
    return text, None, ["Summarize workforce health", "What's our turnover rate?", "Show flight risks"]


# ─── Main Endpoint ──────────────────────────────────────────────────

@router.post("/query", response_model=ChatResponse)
async def chat_query(query: ChatQuery):
    """Answer a workforce analytics question with deep analysis."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    if not query.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    context = _build_deep_context(query.current_page, query.filters)

    # Build page hint
    page_hint = ""
    if query.current_page:
        page_map = {
            "/": "dashboard overview",
            "/turnover": "turnover & attrition analysis",
            "/tenure": "tenure analysis",
            "/careers": "career progression",
            "/managers": "manager analytics",
            "/org": "organizational structure",
            "/flight-risk": "flight risk predictions",
            "/workforce": "workforce composition",
        }
        page_label = page_map.get(query.current_page, query.current_page)
        page_hint = f"\nThe user is currently viewing the {page_label} page. Tailor your answer to that context."
    if query.filters:
        page_hint += f"\nActive filters: {query.filters}"

    system = SYSTEM_PROMPT.format(context=context) + page_hint

    # Build messages for multi-turn conversation
    messages = [{"role": "system", "content": system}]

    # Add conversation history (last 6 turns max to fit context)
    if query.conversation_history:
        for msg in query.conversation_history[-6:]:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                messages.append({"role": msg["role"], "content": msg["content"]})

    # Add current question with chart instruction
    user_msg = query.question.strip()
    user_msg += (
        "\n\nIf this question would benefit from a chart, include EXACTLY ONE JSON block in this format:\n"
        '```json\n{"chart_type": "bar|pie|line|area", "labels": [...], "values": [...], "title": "...", "highlight": "optional_label"}\n```\n'
        "At the end, add: SUGGESTIONS: follow-up question 1 | follow-up question 2 | follow-up question 3"
    )
    messages.append({"role": "user", "content": user_msg})

    try:
        from ..llm import _get_client_and_model
        client, model = _get_client_and_model()
        if client is None:
            raise ValueError("No LLM key")
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1500,
        )
        raw_answer = response.choices[0].message.content
        answer, chart_data, suggestions, navigation = _parse_response(raw_answer)
        # If LLM didn't include navigation but user clearly wants to navigate, add it
        if not navigation:
            navigation = _detect_navigation(query.question)
    except ValueError:
        answer, chart_data, suggestions = _local_chat_response(query.question)
        navigation = _detect_navigation(query.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    return ChatResponse(
        answer=answer,
        data=chart_data,
        suggestions=suggestions,
        analysis_type=_detect_analysis_type(query.question),
        navigation=NavigationCommand(**navigation) if navigation else None,
    )


def _detect_navigation(question: str) -> dict | None:
    """Detect if user wants to navigate to a page."""
    q = question.lower()
    nav_map = {
        "turnover": ("/turnover", "turnover-summary"),
        "attrition": ("/turnover", "turnover-summary"),
        "tenure": ("/tenure", "tenure-summary"),
        "flight risk": ("/flight-risk", "risk-table"),
        "risk": ("/flight-risk", "risk-table"),
        "career": ("/careers", "career-summary"),
        "promotion": ("/careers", "career-summary"),
        "manager": ("/managers", "manager-leaderboard"),
        "org": ("/org", "org-summary"),
        "structure": ("/org", "org-summary"),
        "upload": ("/upload", None),
        "report": ("/reports", None),
        "setting": ("/settings", None),
        "dashboard": ("/", "kpi-cards"),
    }
    if any(w in q for w in ["show me", "take me", "navigate", "go to", "where", "open"]):
        for keyword, (route, section) in nav_map.items():
            if keyword in q:
                return {"action": "navigate", "route": route, "scroll_to": section, "highlight": section}
    return None


def _detect_analysis_type(question: str) -> str:
    """Classify the type of analysis being requested."""
    q = question.lower()
    if any(w in q for w in ["compare", "vs", "versus", "difference"]):
        return "comparative"
    if any(w in q for w in ["trend", "over time", "quarterly", "monthly"]):
        return "trend"
    if any(w in q for w in ["why", "root cause", "reason", "explain"]):
        return "root_cause"
    if any(w in q for w in ["predict", "forecast", "next quarter"]):
        return "predictive"
    if any(w in q for w in ["risk", "flight", "danger"]):
        return "risk"
    if any(w in q for w in ["recommend", "action", "should", "improve"]):
        return "recommendation"
    return "descriptive"
