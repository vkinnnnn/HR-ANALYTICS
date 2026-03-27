"""
LLM-based Taxonomy Generator
Classifies job titles, grades, and career moves using OpenAI.
"""

import json
import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

_taxonomy_cache: dict[str, dict] = {
    "job_families": {},    # job_title -> family name
    "grade_levels": {},    # grade_title -> standard level
    "move_types": {},      # (from_title, to_title) -> move type
}

BATCH_SIZE = 50

JOB_FAMILY_PROMPT = (
    "Classify each job title into exactly one of these job families: "
    "Engineering, Product, Sales, Marketing, Support, Operations, Finance, "
    "HR, Legal, Data/Analytics, Design, Executive, Other.\n\n"
    "Return ONLY valid JSON: a single object mapping each job title (exactly "
    "as provided) to its job family. Example: {\"Software Engineer I\": \"Engineering\"}.\n\n"
    "Job titles to classify:\n"
)

GRADE_LEVEL_PROMPT = (
    "Classify each grade/level title into exactly one of these standard levels: "
    "IC1, IC2, IC3, IC4, IC5, IC, Manager, Senior Manager, Director, VP, SVP, "
    "C-Suite, Other.\n\n"
    "Return ONLY valid JSON: a single object mapping each grade title (exactly "
    "as provided) to its standard level. Example: {\"P1\": \"IC1\", \"M5\": \"Director\"}.\n\n"
    "Grade titles to classify:\n"
)

MOVE_TYPE_PROMPT = (
    "For each job title transition (from -> to), classify the move as exactly one of: "
    "promotion, lateral, demotion, or restructure.\n\n"
    "Return ONLY valid JSON: an array of objects, each with \"from\", \"to\", and \"type\" keys, "
    "in the same order as the input. Example: "
    "[{\"from\": \"Software Engineer I\", \"to\": \"Software Engineer II\", \"type\": \"promotion\"}].\n\n"
    "Transitions to classify:\n"
)


def get_client() -> OpenAI:
    """Create and return an OpenAI client."""
    return OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def _get_model() -> str:
    """Return the configured OpenAI model name."""
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


def _has_api_key() -> bool:
    """Check whether an OpenAI API key is configured."""
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def _call_llm(prompt: str) -> str | None:
    """Send a prompt to the OpenAI chat completions API.

    Returns the assistant message content, or None on failure.
    """
    try:
        client = get_client()
        response = client.chat.completions.create(
            model=_get_model(),
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise classification assistant for HR data. "
                        "Always respond with valid JSON only, no markdown fences or extra text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content
    except Exception:
        logger.exception("OpenAI API call failed")
        return None


def _parse_json(raw: str | None) -> Any:
    """Attempt to parse a JSON string, stripping markdown fences if present."""
    if raw is None:
        return None
    text = raw.strip()
    # Strip markdown code fences that models sometimes add
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first and last fence lines
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON response: %.200s", text)
        return None


# ---------------------------------------------------------------------------
# Public classifiers
# ---------------------------------------------------------------------------

def classify_job_families(job_titles: list[str]) -> dict[str, str]:
    """Classify unique job titles into job families. Processes in batches of 50.

    Returns a dict mapping every provided job title to its family name.
    Already-cached titles are not re-sent to the API.
    """
    cache = _taxonomy_cache["job_families"]
    result: dict[str, str] = {}

    # Separate cached from uncached
    uncached: list[str] = []
    for title in job_titles:
        if title in cache:
            result[title] = cache[title]
        else:
            uncached.append(title)

    if not uncached:
        logger.info("All %d job titles already cached", len(job_titles))
        return result

    if not _has_api_key():
        logger.warning(
            "OPENAI_API_KEY not set — returning 'Unclassified' for %d job titles",
            len(uncached),
        )
        for title in uncached:
            result[title] = "Unclassified"
            cache[title] = "Unclassified"
        return result

    classified_count = 0
    failed_count = 0

    for i in range(0, len(uncached), BATCH_SIZE):
        batch = uncached[i : i + BATCH_SIZE]
        numbered = "\n".join(f"- {t}" for t in batch)
        prompt = JOB_FAMILY_PROMPT + numbered

        raw = _call_llm(prompt)
        parsed = _parse_json(raw)

        if isinstance(parsed, dict):
            for title in batch:
                family = parsed.get(title, "Unclassified")
                if not isinstance(family, str):
                    family = "Unclassified"
                result[title] = family
                cache[title] = family
                if family != "Unclassified":
                    classified_count += 1
                else:
                    failed_count += 1
        else:
            logger.warning(
                "Batch %d–%d: invalid response, marking as Unclassified",
                i,
                i + len(batch),
            )
            for title in batch:
                result[title] = "Unclassified"
                cache[title] = "Unclassified"
                failed_count += 1

    logger.info(
        "Job family classification: %d classified, %d failed out of %d new titles",
        classified_count,
        failed_count,
        len(uncached),
    )
    return result


def classify_grade_levels(grade_titles: list[str]) -> dict[str, str]:
    """Classify grade titles into standard levels. Processes in batches of 50.

    Returns a dict mapping every provided grade title to its standard level.
    """
    cache = _taxonomy_cache["grade_levels"]
    result: dict[str, str] = {}

    uncached: list[str] = []
    for title in grade_titles:
        if title in cache:
            result[title] = cache[title]
        else:
            uncached.append(title)

    if not uncached:
        logger.info("All %d grade titles already cached", len(grade_titles))
        return result

    if not _has_api_key():
        logger.warning(
            "OPENAI_API_KEY not set — returning 'Unclassified' for %d grade titles",
            len(uncached),
        )
        for title in uncached:
            result[title] = "Unclassified"
            cache[title] = "Unclassified"
        return result

    classified_count = 0
    failed_count = 0

    for i in range(0, len(uncached), BATCH_SIZE):
        batch = uncached[i : i + BATCH_SIZE]
        numbered = "\n".join(f"- {g}" for g in batch)
        prompt = GRADE_LEVEL_PROMPT + numbered

        raw = _call_llm(prompt)
        parsed = _parse_json(raw)

        if isinstance(parsed, dict):
            for title in batch:
                level = parsed.get(title, "Unclassified")
                if not isinstance(level, str):
                    level = "Unclassified"
                result[title] = level
                cache[title] = level
                if level != "Unclassified":
                    classified_count += 1
                else:
                    failed_count += 1
        else:
            logger.warning(
                "Batch %d–%d: invalid response, marking as Unclassified",
                i,
                i + len(batch),
            )
            for title in batch:
                result[title] = "Unclassified"
                cache[title] = "Unclassified"
                failed_count += 1

    logger.info(
        "Grade level classification: %d classified, %d failed out of %d new grades",
        classified_count,
        failed_count,
        len(uncached),
    )
    return result


def classify_move_types(
    transitions: list[tuple[str, str]],
) -> dict[tuple[str, str], str]:
    """Classify title transitions as promotion/lateral/demotion/restructure.

    Returns a dict mapping each (from_title, to_title) tuple to a move type.
    """
    cache = _taxonomy_cache["move_types"]
    result: dict[tuple[str, str], str] = {}

    uncached: list[tuple[str, str]] = []
    for pair in transitions:
        key = tuple(pair)
        if key in cache:
            result[key] = cache[key]
        else:
            uncached.append(key)

    if not uncached:
        logger.info("All %d transitions already cached", len(transitions))
        return result

    if not _has_api_key():
        logger.warning(
            "OPENAI_API_KEY not set — returning 'Unclassified' for %d transitions",
            len(uncached),
        )
        for pair in uncached:
            result[pair] = "Unclassified"
            cache[pair] = "Unclassified"
        return result

    classified_count = 0
    failed_count = 0

    for i in range(0, len(uncached), BATCH_SIZE):
        batch = uncached[i : i + BATCH_SIZE]
        lines = "\n".join(f"- \"{frm}\" -> \"{to}\"" for frm, to in batch)
        prompt = MOVE_TYPE_PROMPT + lines

        raw = _call_llm(prompt)
        parsed = _parse_json(raw)

        if isinstance(parsed, list) and len(parsed) == len(batch):
            for idx, (frm, to) in enumerate(batch):
                entry = parsed[idx]
                move_type = "Unclassified"
                if isinstance(entry, dict):
                    mt = entry.get("type", "Unclassified")
                    if isinstance(mt, str) and mt in {
                        "promotion",
                        "lateral",
                        "demotion",
                        "restructure",
                    }:
                        move_type = mt
                result[(frm, to)] = move_type
                cache[(frm, to)] = move_type
                if move_type != "Unclassified":
                    classified_count += 1
                else:
                    failed_count += 1
        else:
            # Try to salvage if parsed is a list but length mismatch or dict
            salvaged = False
            if isinstance(parsed, list):
                lookup: dict[tuple[str, str], str] = {}
                for entry in parsed:
                    if isinstance(entry, dict):
                        f = entry.get("from", "")
                        t = entry.get("to", "")
                        mt = entry.get("type", "Unclassified")
                        if isinstance(mt, str) and mt in {
                            "promotion",
                            "lateral",
                            "demotion",
                            "restructure",
                        }:
                            lookup[(f, t)] = mt
                if lookup:
                    salvaged = True
                    for frm, to in batch:
                        move_type = lookup.get((frm, to), "Unclassified")
                        result[(frm, to)] = move_type
                        cache[(frm, to)] = move_type
                        if move_type != "Unclassified":
                            classified_count += 1
                        else:
                            failed_count += 1

            if not salvaged:
                logger.warning(
                    "Batch %d–%d: invalid response, marking as Unclassified",
                    i,
                    i + len(batch),
                )
                for frm, to in batch:
                    result[(frm, to)] = "Unclassified"
                    cache[(frm, to)] = "Unclassified"
                    failed_count += 1

    logger.info(
        "Move type classification: %d classified, %d failed out of %d new transitions",
        classified_count,
        failed_count,
        len(uncached),
    )
    return result


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_full_taxonomy(employees_df, history_df) -> dict:
    """Run all classifications on the dataset.

    Called from data_loader after loading/processing employee and history data.

    Parameters
    ----------
    employees_df : pandas.DataFrame
        Must contain at least a ``job_title`` column and optionally a ``grade`` column.
    history_df : pandas.DataFrame
        Must contain ``from_title`` and ``to_title`` columns for transition records.

    Returns
    -------
    dict
        Combined taxonomy results with keys ``job_families``, ``grade_levels``,
        and ``move_types``.
    """
    results: dict[str, dict] = {
        "job_families": {},
        "grade_levels": {},
        "move_types": {},
    }

    # --- Job families ---
    if "job_title" in employees_df.columns:
        unique_titles = (
            employees_df["job_title"].dropna().unique().tolist()
        )
        logger.info("Classifying %d unique job titles", len(unique_titles))
        results["job_families"] = classify_job_families(unique_titles)
    else:
        logger.warning("No 'job_title' column found — skipping job family classification")

    # --- Grade levels ---
    if "grade" in employees_df.columns:
        unique_grades = (
            employees_df["grade"].dropna().unique().tolist()
        )
        logger.info("Classifying %d unique grade titles", len(unique_grades))
        results["grade_levels"] = classify_grade_levels(unique_grades)
    else:
        logger.warning("No 'grade' column found — skipping grade level classification")

    # --- Move types ---
    if {"from_title", "to_title"}.issubset(history_df.columns):
        transitions_df = history_df[["from_title", "to_title"]].dropna().drop_duplicates()
        unique_transitions = list(
            transitions_df.itertuples(index=False, name=None)
        )
        logger.info("Classifying %d unique title transitions", len(unique_transitions))
        results["move_types"] = classify_move_types(unique_transitions)
    else:
        logger.warning(
            "History DataFrame missing 'from_title'/'to_title' — skipping move type classification"
        )

    return results


def get_cached_taxonomy() -> dict:
    """Return current taxonomy cache."""
    return _taxonomy_cache


def clear_cache():
    """Clear taxonomy cache to force re-classification."""
    for key in _taxonomy_cache:
        _taxonomy_cache[key] = {}
    logger.info("Taxonomy cache cleared")
