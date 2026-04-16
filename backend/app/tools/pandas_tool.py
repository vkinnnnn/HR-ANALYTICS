"""
app/tools/pandas_tool.py

Analytical queries over the recognition DataFrame.
Hardcoded rules for common questions + CoT LLM fallback for anything else.
"""

import pandas as pd
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.data_loader import get_recognition_data
from app.agent.prompt_engine import PANDAS_FALLBACK_PROMPT


def _llm_pandas_fallback(question: str, df: pd.DataFrame) -> str:
    llm     = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    cols    = df.columns.tolist()
    samples = {col: df[col].dropna().unique()[:5].tolist() for col in cols}

    prompt = PANDAS_FALLBACK_PROMPT.format(columns=cols, sample_values=samples)
    prompt += f"\n\nQuestion: {question}"

    response = llm.invoke([HumanMessage(content=prompt)])
    code     = response.content.strip().replace("```python", "").replace("```", "").strip()

    try:
        local_vars = {"df": df}
        exec(code, {}, local_vars)
        result = local_vars.get("result", "Code executed but no result found.")
        return str(result)
    except Exception as e:
        return (
            f"CANNOT_ANSWER: Could not compute an answer for this question. "
            f"The dataset has columns: {', '.join(cols)}. "
            f"Please try a different analytical question."
        )


@tool
def pandas_query(question: str) -> str:
    """
    Use this tool for ANY question involving counts, numbers, statistics,
    rankings, distributions, or filtering the recognition dataset.

    Examples:
    - How many awards are in each category?
    - Which job title gets recognized the most?
    - How many total recognitions are there?
    - What percentage of awards are in Leadership?
    - Which subcategory has the fewest recognitions?
    """
    df = get_recognition_data()
    q  = question.lower()

    if any(w in q for w in ["how many total", "total number", "total rows", "how many records", "total awards", "total recognitions"]):
        return f"There are {len(df)} total recognitions in the dataset."

    if "category" in q and any(w in q for w in ["how many", "count", "distribution", "breakdown", "each"]):
        counts = df["category_name"].value_counts()
        result = "Recognition count by category:\n"
        for cat, count in counts.items():
            pct = round(count / len(df) * 100, 1)
            result += f"  - {cat}: {count} ({pct}%)\n"
        return result

    if "subcategory" in q and any(w in q for w in ["how many", "count", "distribution", "breakdown", "each", "list"]):
        counts = df["subcategory_name"].value_counts()
        result = "Recognition count by subcategory:\n"
        for sub, count in counts.items():
            result += f"  - {sub}: {count}\n"
        return result

    if any(w in q for w in ["most recognized", "top recognized", "recognized most", "most awards received"]):
        counts = df["recipient_title"].value_counts().head(10)
        result = "Top 10 most recognized job titles:\n"
        for title, count in counts.items():
            result += f"  - {title}: {count}\n"
        return result

    if any(w in q for w in ["most nominator", "who nominates", "gives most awards", "top nominator"]):
        counts = df["nominator_title"].value_counts().head(10)
        result = "Top 10 job titles that nominate others most:\n"
        for title, count in counts.items():
            result += f"  - {title}: {count}\n"
        return result

    for cat in df["category_name"].unique():
        if cat.lower() in q and any(w in q for w in ["how many", "count", "awards in", "recognitions in"]):
            count = len(df[df["category_name"] == cat])
            pct   = round(count / len(df) * 100, 1)
            return f"There are {count} recognitions ({pct}% of total) in the '{cat}' category."

    for sub in df["subcategory_name"].unique():
        if sub.lower() in q and any(w in q for w in ["how many", "count", "awards in", "recognitions in"]):
            count = len(df[df["subcategory_name"] == sub])
            return f"There are {count} recognitions in the '{sub}' subcategory."

    if "unique" in q or "distinct" in q:
        if "award" in q:       return f"There are {df['award_title'].nunique()} unique award titles."
        if "recipient" in q or "role" in q or "job title" in q:
            return f"There are {df['recipient_title'].nunique()} unique recipient job titles."
        if "nominator" in q:   return f"There are {df['nominator_title'].nunique()} unique nominator job titles."
        if "subcategor" in q:  return f"There are {df['subcategory_name'].nunique()} unique subcategories."
        if "categor" in q:     return f"There are {df['category_name'].nunique()} unique categories."

    if "categor" in q and "subcategor" in q:
        return (f"There are {df['category_name'].nunique()} categories and "
                f"{df['subcategory_name'].nunique()} subcategories in the dataset.")
    if any(w in q for w in ["how many categor", "number of categor", "total categor"]):
        cats = df["category_name"].unique().tolist()
        return f"There are {df['category_name'].nunique()} categories: {', '.join(cats)}."
    if any(w in q for w in ["how many subcategor", "number of subcategor", "total subcategor"]):
        return f"There are {df['subcategory_name'].nunique()} subcategories."

    return _llm_pandas_fallback(question, df)
