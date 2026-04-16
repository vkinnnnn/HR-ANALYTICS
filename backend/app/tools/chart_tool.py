import json
import pandas as pd
from langchain_core.tools import tool
from functools import lru_cache

from app.data_loader import get_recognition_data


@lru_cache(maxsize=1)
def _load_df():
    return get_recognition_data()


def _chart_json(chart_type: str, title: str, x_label: str, y_label: str, data: list) -> str:
    """Returns a JSON string the frontend can detect and render as a chart."""
    return "CHART_DATA:" + json.dumps({
        "chart_type": chart_type,
        "title": title,
        "x_label": x_label,
        "y_label": y_label,
        "data": data
    })


@tool
def chart_generator(question: str) -> str:
    """
    Use this tool when the user asks to VISUALIZE, PLOT, CHART, or SHOW A GRAPH of data.
    Returns structured chart data that gets rendered as an interactive chart.

    Examples:
    - Show me a bar chart of awards by category
    - Plot the distribution of subcategories
    - Visualize which job titles get recognized most
    - Graph the breakdown of categories
    - Chart how many awards each subcategory has
    - Show me a pie chart of categories
    - Plot the top 10 recognized job titles
    - Visualize nominator job titles
    """
    df = _load_df()
    q = question.lower()

    # ── Pie / donut chart for categories ─────────────────────────────────────
    if "pie" in q and "categor" in q:
        counts = df["category_name"].value_counts()
        data = [{"label": k, "value": int(v)} for k, v in counts.items()]
        return _chart_json(
            chart_type="pie",
            title="Recognition distribution by category",
            x_label="Category",
            y_label="Count",
            data=data
        )

    # ── Category bar chart ────────────────────────────────────────────────────
    if "categor" in q and any(w in q for w in ["bar", "chart", "plot", "graph", "visual", "show", "breakdown", "distribution"]):
        counts = df["category_name"].value_counts()
        data = [{"label": k, "value": int(v)} for k, v in counts.items()]
        return _chart_json(
            chart_type="bar",
            title="Recognition count by category",
            x_label="Category",
            y_label="Number of recognitions",
            data=data
        )

    # ── Subcategory bar chart ─────────────────────────────────────────────────
    if "subcategor" in q and any(w in q for w in ["bar", "chart", "plot", "graph", "visual", "show", "breakdown", "distribution", "how many"]):
        counts = df["subcategory_name"].value_counts()
        data = [{"label": k, "value": int(v)} for k, v in counts.items()]
        return _chart_json(
            chart_type="horizontal_bar",
            title="Recognition count by subcategory",
            x_label="Number of recognitions",
            y_label="Subcategory",
            data=data
        )

    # ── Top recipient job titles ───────────────────────────────────────────────
    if any(w in q for w in ["recipient", "recognized", "received"]) and any(w in q for w in ["bar", "chart", "plot", "graph", "visual", "top", "show"]):
        counts = df["recipient_title"].value_counts().head(10)
        data = [{"label": k, "value": int(v)} for k, v in counts.items()]
        return _chart_json(
            chart_type="horizontal_bar",
            title="Top 10 most recognized job titles",
            x_label="Number of recognitions",
            y_label="Job title",
            data=data
        )

    # ── Top nominator job titles ───────────────────────────────────────────────
    if any(w in q for w in ["nominator", "gives", "nominates", "who gives"]) and any(w in q for w in ["bar", "chart", "plot", "graph", "visual", "top", "show"]):
        counts = df["nominator_title"].value_counts().head(10)
        data = [{"label": k, "value": int(v)} for k, v in counts.items()]
        return _chart_json(
            chart_type="horizontal_bar",
            title="Top 10 job titles that give most recognitions",
            x_label="Number of recognitions",
            y_label="Job title",
            data=data
        )

    # ── Generic fallback: category bar chart ─────────────────────────────────
    counts = df["category_name"].value_counts()
    data = [{"label": k, "value": int(v)} for k, v in counts.items()]
    return _chart_json(
        chart_type="bar",
        title="Recognition count by category",
        x_label="Category",
        y_label="Number of recognitions",
        data=data
    )