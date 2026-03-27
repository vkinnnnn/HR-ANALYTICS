"""
AI Chatbot Router — Natural language Q&A over workforce analytics data.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openai import AsyncOpenAI

from ..data_loader import get_employees, is_loaded

router = APIRouter()


class ChatQuery(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    data: dict | None = None


async def _llm_call(system: str, user: str) -> str:
    client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    response = await client.chat.completions.create(
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
        max_tokens=1024,
    )
    return response.choices[0].message.content


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
    system = SYSTEM_PROMPT_TEMPLATE.format(context=context)

    # Append instruction to include chart data when relevant
    user_msg = query.question.strip()
    user_msg += (
        "\n\nIf this question would benefit from a chart or visualization, "
        "include a JSON block at the end of your response in this exact format:\n"
        '```json\n{"chart_type": "bar|pie|line", "labels": [...], "values": [...], "title": "..."}\n```'
    )

    try:
        answer = await _llm_call(system, user_msg)
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
