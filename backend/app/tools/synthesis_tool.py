"""
app/tools/synthesis_tool.py

Cultural insight synthesis over the recognition dataset.
Stratified sampling + dynamic category keyword matching + multi-call for broad questions.
"""

import pandas as pd
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from app.data_loader import get_recognition_data
from app.agent.prompt_engine import SYNTHESIS_TOOL_PROMPT


def _load_df() -> pd.DataFrame:
    return get_recognition_data()


def _get_all_keywords(df: pd.DataFrame) -> list[str]:
    """Build keyword list dynamically from actual CSV category/subcategory values."""
    keywords = set()
    for val in list(df["category_name"].dropna().unique()) + list(df["subcategory_name"].dropna().unique()):
        for word in val.lower().replace("&", "").replace("-", " ").split():
            if len(word) > 3:
                keywords.add(word)
    return list(keywords)


def _sample_messages(df: pd.DataFrame, n: int = 300) -> str:
    """Stratified sample across categories."""
    sampled = df.groupby("category_name", group_keys=False).apply(
        lambda x: x.sample(
            min(len(x), max(5, int(n * len(x) / len(df)))),
            random_state=None
        )
    )
    lines = []
    for _, row in sampled.iterrows():
        lines.append(
            f"[{row['category_name']} > {row['subcategory_name']}] "
            f"From: {row['nominator_title']} To: {row['recipient_title']}\n"
            f"{str(row['message'])[:300]}"
        )
    return "\n\n---\n\n".join(lines)


def _messages_for_category(df: pd.DataFrame, category: str) -> str:
    """All messages matching a category keyword — no cap."""
    filtered = df[
        df["category_name"].str.lower().str.contains(category.lower(), na=False) |
        df["subcategory_name"].str.lower().str.contains(category.lower(), na=False)
    ]
    lines = []
    for _, row in filtered.iterrows():
        lines.append(
            f"[{row['subcategory_name']}] {row['nominator_title']} → {row['recipient_title']}:\n"
            f"{str(row['message'])[:300]}"
        )
    return "\n\n---\n\n".join(lines)


def _multi_call_synthesis(df: pd.DataFrame, question: str, llm) -> str:
    """Per-category synthesis then combine for broad questions."""
    summaries = []
    for cat in df["category_name"].unique():
        cat_msgs = _messages_for_category(df, cat)
        if not cat_msgs:
            continue
        resp = llm.invoke([HumanMessage(content=(
            f"You are analyzing the '{cat}' recognition category.\n\n"
            f"Data:\n{cat_msgs}\n\n"
            f"Summarize in 2-3 sentences: what themes, behaviors, and patterns appear? "
            f"Only state what the data shows."
        ))])
        summaries.append(f"**{cat}:**\n{resp.content}")

    combined = "\n\n".join(summaries)
    resp = llm.invoke([HumanMessage(content=(
        f"{SYNTHESIS_TOOL_PROMPT}\n\n"
        f"Per-category insights:\n{combined}\n\n"
        f"Question: {question}\n\n"
        f"Using the category insights above, answer the question comprehensively."
    ))])
    return resp.content


@tool
def llm_synthesis(question: str) -> str:
    """
    Use this tool for open-ended insight questions that require understanding
    patterns, themes, culture, or making comparisons across the dataset.

    Examples:
    - What does this organization value most?
    - What themes appear in leadership recognitions?
    - How do senior leaders write differently from peers?
    - What cultural patterns exist in this dataset?
    - Compare how Engineering vs Marketing recognitions differ
    - What behaviors are most celebrated in this company?
    """
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    df  = _load_df()
    q_lower = question.lower()

    # Dynamic keyword matching from actual CSV values
    all_keywords   = _get_all_keywords(df)
    target_category = None
    for kw in all_keywords:
        if kw in q_lower:
            target_category = kw
            break

    broad_triggers = ["overall", "organization", "company", "everything",
                      "all categories", "whole", "general", "across"]
    is_broad = any(t in q_lower for t in broad_triggers) or target_category is None

    if is_broad:
        return _multi_call_synthesis(df, question, llm)

    messages_text = _messages_for_category(df, target_category)
    if not messages_text:
        messages_text = _sample_messages(df, n=300)

    prompt = (
        f"{SYNTHESIS_TOOL_PROMPT}\n\n"
        f"Recognition data:\n{messages_text}\n\n"
        f"Question: {question}"
    )
    return llm.invoke([HumanMessage(content=prompt)]).content
