"""
app/tools/profile_tool.py

Person/role skill profiles + succession planning.
Uses CoT prompt from prompt_engine + persistent JSON cache.
"""

import os
import re
import json
import pandas as pd
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from functools import lru_cache

from app.config import settings
from app.data_loader import get_recognition_data
from app.agent.prompt_engine import PROFILE_EXTRACTION_PROMPT

PROFILE_CACHE_PATH = settings.profile_cache_path

_profile_cache: dict = {}
_cache_loaded:  bool = False


def _load_cache():
    global _profile_cache, _cache_loaded
    if _cache_loaded:
        return
    if os.path.exists(PROFILE_CACHE_PATH):
        try:
            with open(PROFILE_CACHE_PATH, "r") as f:
                _profile_cache = json.load(f)
        except Exception:
            _profile_cache = {}
    _cache_loaded = True


def _save_cache():
    os.makedirs(os.path.dirname(os.path.abspath(PROFILE_CACHE_PATH)), exist_ok=True)
    with open(PROFILE_CACHE_PATH, "w") as f:
        json.dump(_profile_cache, f, indent=2)


@lru_cache(maxsize=1)
def _load_df():
    return get_recognition_data()


def _get_messages_for_person(name: str) -> list[str]:
    df = _load_df()
    return [
        msg for msg in df["message"].dropna()
        if re.search(rf'\b{re.escape(name.lower())}\b', msg.lower())
    ]


def _get_messages_for_role(role: str) -> list[str]:
    df = _load_df()
    return df[
        df["recipient_title"].str.lower().str.contains(role.lower(), na=False)
    ]["message"].dropna().tolist()


def _build_profile(name: str, messages: list[str]) -> dict:
    _load_cache()
    if name in _profile_cache:
        return _profile_cache[name]

    llm           = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    messages_text = "\n\n---\n\n".join(messages[:15])

    prompt = PROFILE_EXTRACTION_PROMPT.format() + f'\n\nRecognition messages mentioning "{name}":\n\n{messages_text}'
    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        raw     = re.sub(r"```json|```", "", response.content).strip()
        profile = json.loads(raw)
    except Exception:
        profile = {
            "name":              name,
            "message_count":     len(messages),
            "top_skills":        ["Could not parse profile"],
            "categories":        [],
            "impact_areas":      [],
            "seniority_signals": [],
            "key_themes":        f"Found {len(messages)} messages mentioning {name} but could not parse profile."
        }

    _profile_cache[name] = profile
    _save_cache()
    return profile


@tool
def profile_and_replace(query: str) -> str:
    """
    Use this tool when the user asks about a specific person's contributions,
    skills, or impact — OR asks who could replace someone, succeed them,
    or fill a similar role.

    Also handles role-based substitution queries like "who can replace a Director of Engineering".

    Examples:
    - What has Sarah contributed?
    - Who can replace Matt?
    - If Emma left, who would be the best replacement?
    - Who could replace a Senior Director?
    - What are Kaleigh's key strengths?
    """
    df = _load_df()

    skip = {
        "who", "what", "when", "where", "how", "replace", "replaced", "replacement",
        "left", "leaves", "similar", "skills", "best", "can", "could", "would",
        "the", "a", "an", "is", "are", "has", "have", "if", "and", "or", "for",
        "tell", "me", "about", "find", "show", "give"
    }

    words           = query.replace("?", "").replace(",", "").split()
    candidate_names = [w for w in words if w[0].isupper() and w.lower() not in skip and len(w) > 2]

    is_replacement = any(kw in query.lower() for kw in
                         ["replace", "replacement", "succeed", "successor", "left", "leaves", "similar to", "like"])

    # Role-based substitution (e.g. "who could replace a Director of Engineering")
    role_patterns = [
        r"replace\s+(?:a|an|the)?\s*([A-Za-z ,&/]+?)(?:\?|$|\.)",
        r"if\s+(?:a|an|the)?\s*([A-Za-z ,&/]+?)\s+(?:left|quit|resigned)",
        r"similar to\s+(?:a|an|the)?\s*([A-Za-z ,&/]+?)(?:\?|$|\.)",
        r"backup\s+(?:for\s+)?(?:a|an|the)?\s*([A-Za-z ,&/]+?)(?:\?|$|\.)",
    ]

    if is_replacement and not candidate_names:
        for pattern in role_patterns:
            m = re.search(pattern, query, re.IGNORECASE)
            if m:
                role_name = m.group(1).strip()
                role_msgs = _get_messages_for_role(role_name)
                if role_msgs:
                    # Use role-based substitution from tools.py logic
                    from tools.rag_tool import _get_collection, _get_embedder
                    import numpy as np
                    embedder   = _get_embedder()
                    collection = _get_collection()
                    role_df    = df[df["recipient_title"].str.lower().str.contains(role_name.lower(), na=False)]
                    profile_text = " | ".join(
                        f"{row['category_name']}: {row['message'][:100]}"
                        for _, row in role_df.iterrows()
                    )[:2000]
                    profile_vec = embedder.encode([profile_text])[0].tolist()
                    results = collection.query(
                        query_embeddings=[profile_vec],
                        n_results=50,
                        include=["metadatas", "distances"],
                    )
                    role_scores: dict = {}
                    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
                        r = meta.get("recipient_title", "")
                        if r and role_name.lower() not in r.lower():
                            role_scores.setdefault(r, []).append(1 - dist)
                    ranked = sorted(
                        [(r, round(float(np.mean(s)) * 100, 1)) for r, s in role_scores.items()],
                        key=lambda x: x[1], reverse=True
                    )[:10]
                    lines = [
                        f"=== Roles Most Similar to '{role_name}' ===",
                        f"Based on {len(role_df)} recognition records\n",
                    ]
                    for i, (r, score) in enumerate(ranked, 1):
                        lines.append(f"  {i}. {r} — {score}% similarity")
                    return "\n".join(lines)

    if not candidate_names:
        return "CANNOT_ANSWER: Could not identify a person's name or role in the query. Please include a first name (e.g. 'What has Sarah contributed?') or a role title (e.g. 'Who can replace a Director of Engineering?')."

    target_name = candidate_names[0]
    messages    = _get_messages_for_person(target_name)

    if not messages:
        # Show who IS in the dataset so the user can try a valid name
        df2 = _load_df()
        import re as _re
        all_names = set()
        pat = _re.compile(r'(?:^|\n)([A-Z][a-z]{2,12})(?:\s*,|\s+and\s+[A-Z])', _re.MULTILINE)
        for msg in df2["message"].dropna():
            for m in pat.findall(msg):
                all_names.add(m.strip())
        non = {"Team","Hi","Dear","Thanks","Thank","Hello","Hey","All","Folks","Guys",
               "Gents","Girls","Ladies","Lads","Monday","Tuesday","Wednesday","Thursday",
               "Friday","January","February","March","April","May","June","July",
               "August","September","October","November","December","Well"}
        counts = {n: sum(1 for msg in df2["message"].dropna()
                         if _re.search(rf'\b{n.lower()}\b', msg.lower()))
                  for n in all_names - non}
        top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:15]
        names_str = ", ".join(f"{n} ({c})" for n, c in top)
        return (
            f"CANNOT_ANSWER: No recognition messages found mentioning '{target_name}'. "
            f"They may not appear in this dataset.\n\n"
            f"People with the most recognition data: {names_str}"
        )

    MIN_MESSAGES = 3
    if len(messages) < MIN_MESSAGES:
        return (
            f"CANNOT_ANSWER: Only {len(messages)} recognition message(s) mention '{target_name}' — "
            f"not enough data to build a reliable profile (minimum {MIN_MESSAGES} required). "
            f"Try someone with more recognition history."
        )

    target_profile = _build_profile(target_name, messages)

    if not is_replacement:
        result  = f"Profile for {target_name} (based on {target_profile.get('message_count', len(messages))} recognition messages):\n\n"
        result += f"Key themes: {target_profile.get('key_themes', 'N/A')}\n\n"
        result += f"Top skills: {', '.join(target_profile.get('top_skills', []))}\n"
        result += f"Work categories: {', '.join(target_profile.get('categories', []))}\n"
        result += f"Impact areas: {', '.join(target_profile.get('impact_areas', []))}\n"
        result += f"Seniority signals: {', '.join(target_profile.get('seniority_signals', []))}\n"
        return result

    # Build candidate profiles
    all_names      = set()
    direct_address = re.compile(r'(?:^|\n)([A-Z][a-z]{2,12})(?:\s*,|\s+and\s+[A-Z])', re.MULTILINE)
    for msg in df["message"].dropna():
        for match in direct_address.findall(msg):
            all_names.add(match.strip())

    non_names = {"Team", "Hi", "Dear", "Thanks", "Thank", "Hello", "Hey", "All", "Folks",
                 "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                 "January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"}
    all_names = {n for n in all_names if n not in non_names and n != target_name}

    counts     = [(n, len(_get_messages_for_person(n))) for n in all_names]
    top_cands  = [n for n, c in sorted(counts, key=lambda x: x[1], reverse=True)[:12] if c >= 2]
    cand_profs = [_build_profile(n, _get_messages_for_person(n)) for n in top_cands]

    llm          = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    target_text  = json.dumps(target_profile, indent=2)
    cands_text   = json.dumps(cand_profs, indent=2)

    rank_prompt = (
        f"You are a senior HR analyst. A person named {target_name} may be leaving.\n\n"
        f"CHAIN OF THOUGHT:\n"
        f"Step 1 — Review {target_name}'s profile. List their core skills and impact areas.\n"
        f"Step 2 — For each candidate, identify skill overlap with {target_name}.\n"
        f"Step 3 — Rank top 3 by skill coverage. Identify specific gaps.\n"
        f"Step 4 — Assign fit scores only after completing Steps 1-3.\n\n"
        f"{target_name}'s profile:\n{target_text}\n\n"
        f"Candidates:\n{cands_text}\n\n"
        f"Present top 3 replacement candidates. For each: name, specific skill overlaps, gaps, fit score /10.\n"
        f"Only reference skills that appear in the profiles — do not invent attributes."
    )

    response = llm.invoke([HumanMessage(content=rank_prompt)])
    result   = f"Replacement analysis for {target_name}:\n\n"
    result  += f"{target_name}'s summary: {target_profile.get('key_themes', '')}\n\n"
    result  += "--- Top Replacement Candidates ---\n\n"
    result  += response.content
    return result
