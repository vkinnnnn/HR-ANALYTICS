"""
AI Chatbot Router — Natural language Q&A over workforce analytics data.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..data_loader import get_employees, is_loaded
from ..llm import llm_call as _llm_call_unified

router = APIRouter()


class ChatQuery(BaseModel):
    question: str
    current_page: str | None = None
    filters: dict | None = None


class ChatResponse(BaseModel):
    answer: str
    data: dict | None = None


async def _llm_call(system: str, user: str) -> str:
    return await _llm_call_unified(system, user)


def _build_workforce_context() -> str:
    """Build a rich summary-stats context string from the employee DataFrame."""
    df = get_employees()

    total = len(df)
    active_count = int(df["is_active"].sum())
    departed_count = total - active_count
    turnover_rate = round(departed_count / total * 100, 1) if total > 0 else 0.0

    # Tenure stats
    avg_tenure_years = round(float(df["tenure_years"].mean()), 1)
    median_tenure_years = round(float(df["tenure_years"].median()), 1)

    # Top departments by headcount
    dept_counts = (
        df[df["is_active"]]
        .groupby("department_name")
        .size()
        .sort_values(ascending=False)
        .head(10)
    )
    dept_lines = "\n".join(
        f"  - {dept}: {count} active employees"
        for dept, count in dept_counts.items()
    )

    # Top business units
    bu_counts = (
        df[df["is_active"]]
        .groupby("business_unit_name")
        .size()
        .sort_values(ascending=False)
        .head(10)
    )
    bu_lines = "\n".join(
        f"  - {bu}: {count} active employees"
        for bu, count in bu_counts.items()
    )

    # Grade distribution (active)
    if "grade_title" in df.columns:
        grade_counts = (
            df[df["is_active"]]
            .groupby("grade_title")
            .size()
            .sort_values(ascending=False)
            .head(10)
        )
        grade_lines = "\n".join(
            f"  - {grade}: {count}" for grade, count in grade_counts.items()
        )
    else:
        grade_lines = "  (grade data not available)"

    # Country distribution (active)
    if "country" in df.columns:
        country_counts = (
            df[df["is_active"]]
            .groupby("country")
            .size()
            .sort_values(ascending=False)
            .head(10)
        )
        country_lines = "\n".join(
            f"  - {country}: {count}" for country, count in country_counts.items()
        )
    else:
        country_lines = "  (country data not available)"

    # Function distribution (active)
    if "function_title" in df.columns:
        func_counts = (
            df[df["is_active"]]
            .groupby("function_title")
            .size()
            .sort_values(ascending=False)
            .head(10)
        )
        func_lines = "\n".join(
            f"  - {func}: {count}" for func, count in func_counts.items()
        )
    else:
        func_lines = "  (function data not available)"

    # Role change stats (active employees)
    active_df = df[df["is_active"]]
    avg_role_changes = round(float(active_df["num_role_changes"].mean()), 1)
    avg_manager_changes = round(float(active_df["num_manager_changes"].mean()), 1)
    avg_time_in_role = round(float(active_df["time_in_current_role_days"].mean()), 0)

    # Turnover by department (top departments with highest departure rate)
    dept_turnover = (
        df.groupby("department_name")
        .agg(total=("is_active", "count"), departed=("is_active", lambda x: int((~x).sum())))
        .assign(turnover_pct=lambda x: (x["departed"] / x["total"] * 100).round(1))
        .sort_values("turnover_pct", ascending=False)
        .head(10)
    )
    turnover_lines = "\n".join(
        f"  - {dept}: {row['turnover_pct']}% ({row['departed']}/{row['total']})"
        for dept, row in dept_turnover.iterrows()
    )

    context = f"""WORKFORCE ANALYTICS DATA SUMMARY
=================================
Total employees in dataset: {total}
Active employees: {active_count}
Departed employees: {departed_count}
Overall turnover rate: {turnover_rate}%

TENURE:
  Average tenure: {avg_tenure_years} years
  Median tenure: {median_tenure_years} years

CAREER MOBILITY (active employees):
  Average role changes: {avg_role_changes}
  Average manager changes: {avg_manager_changes}
  Average time in current role: {int(avg_time_in_role)} days

TOP DEPARTMENTS BY HEADCOUNT (active):
{dept_lines}

TOP BUSINESS UNITS (active):
{bu_lines}

GRADE DISTRIBUTION (active, top 10):
{grade_lines}

COUNTRY DISTRIBUTION (active, top 10):
{country_lines}

FUNCTION DISTRIBUTION (active, top 10):
{func_lines}

TURNOVER BY DEPARTMENT (highest turnover, top 10):
{turnover_lines}
"""
    return context


def _local_chat_response(question: str) -> str:
    """Generate a data-driven response without LLM by pattern-matching the question."""
    import re
    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    q = question.lower()

    # Turnover questions
    if any(w in q for w in ["turnover", "attrition", "leaving", "depart"]):
        total = len(df)
        dep = len(departed)
        rate = round(dep / total * 100, 1) if total > 0 else 0
        dept_turnover = (
            df.groupby("department_name")
            .agg(total=("is_active", "count"), dep=("is_active", lambda x: int((~x).sum())))
        )
        dept_turnover["pct"] = (dept_turnover["dep"] / dept_turnover["total"] * 100).round(1)
        worst = dept_turnover.sort_values("pct", ascending=False).head(5)
        lines = [f"**Overall turnover rate: {rate}%** ({dep} departed out of {total} total)\n", "**Highest turnover departments:**"]
        for dept, row in worst.iterrows():
            lines.append(f"- {dept}: {row['pct']}% ({int(row['dep'])}/{int(row['total'])})")
        return "\n".join(lines) + "\n\n```json\n" + _chart_json("bar", list(worst.index), [float(v) for v in worst["pct"]], "Turnover by Department (%)") + "\n```"

    # Tenure questions
    if any(w in q for w in ["tenure", "how long", "years of service"]):
        avg_t = round(float(active["tenure_years"].mean()), 1)
        med_t = round(float(active["tenure_years"].median()), 1)
        return f"**Average tenure:** {avg_t} years\n**Median tenure:** {med_t} years\n\nActive employees: {len(active)}"

    # Headcount / workforce questions
    if any(w in q for w in ["headcount", "how many", "employee count", "workforce"]):
        dept_counts = active.groupby("department_name").size().sort_values(ascending=False).head(10)
        lines = [f"**Total active employees: {len(active)}** (out of {len(df)} total)\n", "**Top departments:**"]
        for dept, count in dept_counts.items():
            lines.append(f"- {dept}: {count}")
        return "\n".join(lines)

    # Department-specific
    dept_match = None
    for dept in df["department_name"].unique():
        if dept.lower() in q:
            dept_match = dept
            break
    if dept_match:
        d = df[df["department_name"] == dept_match]
        act = int(d["is_active"].sum())
        dep_c = len(d) - act
        avg_t = round(float(d["tenure_years"].mean()), 1)
        return f"**{dept_match}:** {len(d)} total, {act} active, {dep_c} departed\n**Avg tenure:** {avg_t} years\n**Turnover:** {round(dep_c/len(d)*100,1)}%"

    # Risk questions
    if any(w in q for w in ["risk", "flight", "danger"]):
        return "Flight risk analysis requires the ML model to be trained. Visit the **Flight Risk** page and ensure the model has been trained. Key risk factors include: tenure, time in current role, manager changes, and grade stagnation."

    # Default
    return (
        f"I have data on **{len(df)} employees** ({len(active)} active, {len(departed)} departed). "
        f"I can answer questions about **turnover, tenure, headcount, departments, grades, and career mobility**. "
        f"Try asking: 'What is the turnover rate?' or 'Tell me about the Technology department'.\n\n"
        f"*Note: Set `OPENAI_API_KEY` for AI-powered natural language responses.*"
    )


def _chart_json(chart_type: str, labels: list, values: list, title: str) -> str:
    import json
    return json.dumps({"chart_type": chart_type, "labels": labels, "values": values, "title": title})


SYSTEM_PROMPT_TEMPLATE = """You are an HR Workforce Analytics assistant. You have access to summary statistics from an employee dataset covering hire/departure dates, job history, organizational structure, and career progression.

Use the following workforce data context to answer the user's question. Be specific with numbers when available. If the data doesn't contain enough information to answer precisely, say so and provide what you can.

Available metrics include:
- Headcount (total, active, departed) and turnover rates
- Tenure statistics (average, median, by department)
- Organizational breakdown: departments, business units, grades, functions, countries
- Career mobility: role changes, manager changes, time in current role
- Turnover analysis by department

When the user asks for chart-worthy data, include a "data" field in your mental model with labels and values suitable for visualization.

{context}
"""


@router.post("/query", response_model=ChatResponse)
async def chat_query(query: ChatQuery):
    """Answer a natural language question about the workforce data."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Data not loaded. Upload data first.")

    if not query.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    context = _build_workforce_context()
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
    system = SYSTEM_PROMPT_TEMPLATE.format(context=context) + page_hint

    # Append instruction to include chart data when relevant
    user_msg = query.question.strip()
    user_msg += (
        "\n\nIf this question would benefit from a chart or visualization, "
        "include a JSON block at the end of your response in this exact format:\n"
        '```json\n{"chart_type": "bar|pie|line", "labels": [...], "values": [...], "title": "..."}\n```'
    )

    try:
        answer = await _llm_call(system, user_msg)
    except ValueError:
        # No API key — return a helpful local response
        answer = _local_chat_response(query.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    # Try to extract chart data from the response
    chart_data = None
    if "```json" in answer:
        try:
            import json
            json_start = answer.index("```json") + 7
            json_end = answer.index("```", json_start)
            json_str = answer[json_start:json_end].strip()
            chart_data = json.loads(json_str)
            # Remove the JSON block from the text answer
            answer_text = answer[:answer.index("```json")].strip()
        except (ValueError, json.JSONDecodeError):
            answer_text = answer
    else:
        answer_text = answer

    return ChatResponse(answer=answer_text, data=chart_data)
