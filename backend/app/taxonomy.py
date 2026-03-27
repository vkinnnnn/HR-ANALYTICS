"""
Workforce Taxonomy Engine
=========================
Precise, data-driven classification of grades, job families, career levels,
and title transitions. Uses deterministic rules first (based on actual
Workhuman grade/title naming conventions), LLM only for ambiguous edge cases.

Designed for continuous operation — new data uploads trigger re-classification.
Results cached in memory and persisted to JSON for fast restart.
"""

import os
import re
import json
import logging
from collections import Counter

logger = logging.getLogger(__name__)

TAXONOMY_CACHE_PATH = os.environ.get("TAXONOMY_CACHE", "taxonomy_cache.json")

# ═══════════════════════════════════════════════════════════════════════════════
# 1. GRADE TAXONOMY — Based on actual Workhuman leveling framework
# ═══════════════════════════════════════════════════════════════════════════════

# The company uses 4 grade series + special categories:
#   P-series (Professional/IC): P1 (entry) → P6 (principal/fellow)
#   M-series (Management): M1 (team lead) → M6 (SVP)
#   S-series (Support/Specialist): S1 (entry) → S5 (senior specialist)
#   E-series (Executive): E1, E2
#   EXEC, C-Suite, CEO: top leadership

GRADE_HIERARCHY = {
    # Support/Specialist track
    "S1":  {"level": 1,  "track": "support",    "standard_level": "Support I",         "band": "Individual Contributor", "seniority_rank": 1},
    "S2":  {"level": 2,  "track": "support",    "standard_level": "Support II",        "band": "Individual Contributor", "seniority_rank": 2},
    "S3":  {"level": 3,  "track": "support",    "standard_level": "Support III",       "band": "Individual Contributor", "seniority_rank": 3},
    "S4":  {"level": 4,  "track": "support",    "standard_level": "Senior Specialist", "band": "Senior IC",              "seniority_rank": 4},
    "S5":  {"level": 5,  "track": "support",    "standard_level": "Lead Specialist",   "band": "Senior IC",              "seniority_rank": 5},
    # Professional/IC track
    "P1":  {"level": 1,  "track": "professional", "standard_level": "Associate",         "band": "Individual Contributor", "seniority_rank": 3},
    "P2":  {"level": 2,  "track": "professional", "standard_level": "Professional",      "band": "Individual Contributor", "seniority_rank": 4},
    "P3":  {"level": 3,  "track": "professional", "standard_level": "Senior",            "band": "Senior IC",              "seniority_rank": 5},
    "P4":  {"level": 4,  "track": "professional", "standard_level": "Staff / Lead",      "band": "Senior IC",              "seniority_rank": 6},
    "P5":  {"level": 5,  "track": "professional", "standard_level": "Principal",         "band": "Principal",              "seniority_rank": 7},
    "P6":  {"level": 6,  "track": "professional", "standard_level": "Distinguished",     "band": "Principal",              "seniority_rank": 8},
    # Management track
    "M1":  {"level": 1,  "track": "management", "standard_level": "Team Lead",          "band": "Management",             "seniority_rank": 5},
    "M2":  {"level": 2,  "track": "management", "standard_level": "Manager",            "band": "Management",             "seniority_rank": 6},
    "M3":  {"level": 3,  "track": "management", "standard_level": "Senior Manager",     "band": "Management",             "seniority_rank": 7},
    "M4":  {"level": 4,  "track": "management", "standard_level": "Director",           "band": "Director",               "seniority_rank": 8},
    "M5":  {"level": 5,  "track": "management", "standard_level": "Senior Director",    "band": "Director",               "seniority_rank": 9},
    "M6":  {"level": 6,  "track": "management", "standard_level": "Vice President",     "band": "VP",                     "seniority_rank": 10},
    # Executive track
    "E1":  {"level": 1,  "track": "executive",  "standard_level": "SVP",                "band": "Executive",              "seniority_rank": 11},
    "E2":  {"level": 2,  "track": "executive",  "standard_level": "EVP",                "band": "Executive",              "seniority_rank": 12},
    "EXEC":{"level": 3,  "track": "executive",  "standard_level": "Executive",          "band": "Executive",              "seniority_rank": 12},
    "C-Suite":{"level": 4, "track": "executive","standard_level": "C-Suite",            "band": "C-Suite",                "seniority_rank": 13},
    "CEO": {"level": 5,  "track": "executive",  "standard_level": "CEO",                "band": "C-Suite",                "seniority_rank": 14},
    # Non-standard
    "Hourly":     {"level": 0, "track": "hourly",     "standard_level": "Hourly",          "band": "Hourly/Temp",     "seniority_rank": 0},
    "Salary":     {"level": 0, "track": "salary",     "standard_level": "Salaried",        "band": "Ungraded",        "seniority_rank": 1},
    "Contingent Workers": {"level": 0, "track": "contingent", "standard_level": "Contractor", "band": "Contingent",    "seniority_rank": 0},
}

# ═══════════════════════════════════════════════════════════════════════════════
# 2. FUNCTION → DEPARTMENT FAMILY MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

# Group 151 unique function_titles into ~15 high-level families
FUNCTION_FAMILY_RULES = [
    # Engineering & Technology
    (r"(?i)(engineer|architecture|infrastructure|development|systems|infosec|information security)", "Engineering & Technology"),
    (r"(?i)(TC-|software|QA|devops|platform)", "Engineering & Technology"),
    # Product
    (r"(?i)(product management|product design|product strategy|PD-|product marketing)", "Product"),
    (r"(?i)(product owner|UX|user experience)", "Product"),
    # Sales
    (r"(?i)(sales|business development|enterprise sales|corporate sales|inside sales|outside sales|SL-|strategic accounts|strategic client)", "Sales"),
    (r"(?i)(VP.*sales|GTM)", "Sales"),
    # Marketing & Brand
    (r"(?i)(marketing|brand|creative|demand generation|field marketing|events|public relations|corporate communications|CM-|BM-|content)", "Marketing & Brand"),
    # Customer Success & Services
    (r"(?i)(customer success|customer service|client success|client consulting|client engagement|client strategy|CS-|launch|technical services|implementations)", "Customer Success & Services"),
    (r"(?i)(customer advocacy|customer education|customer experience|customer strategy)", "Customer Success & Services"),
    # Operations & Supply Chain
    (r"(?i)(operations|supply chain|fulfillment|procurement|purchasing|supplier|back office|OP-|merchandise|category management)", "Operations & Supply Chain"),
    (r"(?i)(e-commerce|EC-|retail media|rewards platform)", "Operations & Supply Chain"),
    # Data & Analytics
    (r"(?i)(analytics|business analytics|insight|WHiQ|workhuman.*iq|data|research)", "Data & Analytics"),
    # Finance & Legal
    (r"(?i)(finance|accounting|accounts payable|accounts receivable|tax|FP&A|FN-|financial|payroll|incentive comp|risk.*internal)", "Finance & Legal"),
    (r"(?i)(legal|compliance|LG-)", "Finance & Legal"),
    # Human Resources
    (r"(?i)(HR|human resource|people.*places|recruiting|learning.*development|workplace|ESG|corporate social)", "Human Resources"),
    (r"(?i)(human experience|HX|workhuman practice)", "Human Resources"),
    # Strategy & Consulting
    (r"(?i)(strategy.*consulting|consulting|strategic advisory|corporate strategy|chief of staff|workhuman practice)", "Strategy & Consulting"),
    # Executive / Leadership
    (r"(?i)(executive|leadership|CEO|president)", "Executive Leadership"),
]


def classify_function_family(function_title: str) -> str:
    """Classify a function_title into a high-level family using regex rules."""
    if not function_title or str(function_title) == "nan":
        return "Unknown"
    for pattern, family in FUNCTION_FAMILY_RULES:
        if re.search(pattern, str(function_title)):
            return family
    return "Other"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. JOB TITLE → ROLE LEVEL + JOB FAMILY
# ═══════════════════════════════════════════════════════════════════════════════

# Title prefix patterns that indicate seniority
TITLE_LEVEL_PATTERNS = [
    (r"(?i)^(chief|CEO|CTO|CFO|COO|CHRO|CIO|CPO|CMO|CLO)", "C-Suite"),
    (r"(?i)(senior vice president|SVP)", "SVP"),
    (r"(?i)(vice president|VP)", "VP"),
    (r"(?i)^senior director", "Senior Director"),
    (r"(?i)^director", "Director"),
    (r"(?i)^senior manager", "Senior Manager"),
    (r"(?i)^manager", "Manager"),
    (r"(?i)^(head of|lead )", "Lead"),
    (r"(?i)^principal", "Principal"),
    (r"(?i)^staff", "Staff"),
    (r"(?i)^(senior|sr\.?)\b", "Senior"),
    (r"(?i)(III|3)$", "Mid-Level III"),
    (r"(?i)(II|2)$", "Mid-Level II"),
    (r"(?i)(I|1)$", "Entry-Level I"),
    (r"(?i)^(junior|jr\.?)\b", "Junior"),
    (r"(?i)(intern|internship|co-op)$", "Intern"),
    (r"(?i)(associate)$", "Associate"),
    (r"(?i)(contractor|EPAM|agency|temp)", "Contractor"),
]

# Job family detection from title keywords
JOB_FAMILY_PATTERNS = [
    (r"(?i)(software engineer|developer|SRE|devops|architect|full.?stack)", "Software Engineering"),
    (r"(?i)(QA|quality|tester|test engineer|automation engineer)", "Quality Assurance"),
    (r"(?i)(data engineer|data scientist|data analyst|ML engineer|machine learning)", "Data Engineering & Science"),
    (r"(?i)(product manager|product owner)", "Product Management"),
    (r"(?i)(product design|UX|UI|interaction design)", "Product Design"),
    (r"(?i)(engineer|engineering)", "Engineering"),
    (r"(?i)(sales exec|business development|account exec|BDR|SDR|sales rep)", "Sales"),
    (r"(?i)(customer service|customer support|service exec)", "Customer Service"),
    (r"(?i)(customer success|client success|customer strategy)", "Customer Success"),
    (r"(?i)(consultant|consulting|advisory|strategy)", "Consulting & Strategy"),
    (r"(?i)(marketing|brand|demand gen|content|creative|copywriter|PR|communications)", "Marketing"),
    (r"(?i)(recruiter|recruiting|talent acquisition)", "Recruiting"),
    (r"(?i)(HR|human resources|people partner|people ops|HX|human experience)", "Human Resources"),
    (r"(?i)(finance|accounting|accountant|payable|receivable|tax|FP&A|controller)", "Finance"),
    (r"(?i)(legal|counsel|compliance|paralegal)", "Legal"),
    (r"(?i)(operations|supply chain|procurement|buyer|fulfillment|logistics)", "Operations"),
    (r"(?i)(infrastructure|sysadmin|network|cloud|security|infosec)", "Infrastructure & Security"),
    (r"(?i)(project manager|program manager|scrum|agile|delivery)", "Program Management"),
    (r"(?i)(executive assistant|admin|office manager|workplace)", "Administrative"),
    (r"(?i)(implementation|launch|onboarding)", "Implementation"),
    (r"(?i)(technical services|tech support|solutions)", "Technical Services"),
]


def classify_title_level(job_title: str) -> str:
    """Extract seniority level from job title."""
    if not job_title or str(job_title) == "nan":
        return "Unknown"
    for pattern, level in TITLE_LEVEL_PATTERNS:
        if re.search(pattern, str(job_title)):
            return level
    return "Mid-Level"


def classify_job_family(job_title: str) -> str:
    """Classify job title into a job family."""
    if not job_title or str(job_title) == "nan":
        return "Unknown"
    for pattern, family in JOB_FAMILY_PATTERNS:
        if re.search(pattern, str(job_title)):
            return family
    return "General"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CAREER MOVE CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def classify_career_move(from_title: str, to_title: str, from_grade: str = None, to_grade: str = None) -> dict:
    """
    Classify a career transition as promotion/lateral/demotion/restructure.
    Uses multiple signals: grade change, title level change, title similarity.
    """
    result = {
        "from_title": from_title,
        "to_title": to_title,
        "move_type": "lateral",
        "confidence": "medium",
        "signals": [],
    }

    if not from_title or not to_title or str(from_title) == "nan" or str(to_title) == "nan":
        result["move_type"] = "unknown"
        return result

    # Signal 1: Grade-based (strongest signal)
    if from_grade and to_grade and from_grade in GRADE_HIERARCHY and to_grade in GRADE_HIERARCHY:
        from_rank = GRADE_HIERARCHY[from_grade]["seniority_rank"]
        to_rank = GRADE_HIERARCHY[to_grade]["seniority_rank"]
        if to_rank > from_rank:
            result["signals"].append(f"grade_up:{from_grade}→{to_grade}")
            result["move_type"] = "promotion"
            result["confidence"] = "high"
        elif to_rank < from_rank:
            result["signals"].append(f"grade_down:{from_grade}→{to_grade}")
            result["move_type"] = "demotion"
            result["confidence"] = "high"
        else:
            result["signals"].append("grade_same")

    # Signal 2: Title level change
    from_level = classify_title_level(from_title)
    to_level = classify_title_level(to_title)
    level_rank = {
        "Intern": 0, "Junior": 1, "Entry-Level I": 2, "Associate": 2,
        "Mid-Level": 3, "Mid-Level II": 4, "Mid-Level III": 5,
        "Senior": 6, "Staff": 7, "Lead": 7, "Principal": 8,
        "Manager": 7, "Senior Manager": 8, "Director": 9,
        "Senior Director": 10, "VP": 11, "SVP": 12, "C-Suite": 13,
        "Contractor": 1, "Unknown": 3,
    }
    from_r = level_rank.get(from_level, 3)
    to_r = level_rank.get(to_level, 3)
    if to_r > from_r:
        result["signals"].append(f"title_level_up:{from_level}→{to_level}")
        if result["confidence"] != "high":
            result["move_type"] = "promotion"
            result["confidence"] = "medium"
    elif to_r < from_r:
        result["signals"].append(f"title_level_down:{from_level}→{to_level}")
        if result["confidence"] != "high":
            result["move_type"] = "demotion"
            result["confidence"] = "medium"

    # Signal 3: Job family change (lateral if family changes but level same)
    from_family = classify_job_family(from_title)
    to_family = classify_job_family(to_title)
    if from_family != to_family and from_family != "General" and to_family != "General":
        result["signals"].append(f"family_change:{from_family}→{to_family}")
        if result["move_type"] == "lateral":
            result["move_type"] = "lateral_transfer"

    # Signal 4: Restructure detection (title is very different but same level)
    from_words = set(str(from_title).lower().split())
    to_words = set(str(to_title).lower().split())
    overlap = len(from_words & to_words) / max(len(from_words | to_words), 1)
    if overlap < 0.2 and result["move_type"] == "lateral":
        result["signals"].append(f"low_title_overlap:{overlap:.2f}")
        result["move_type"] = "restructure"

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 5. FULL TAXONOMY RUNNER — Processes entire dataset
# ═══════════════════════════════════════════════════════════════════════════════

_taxonomy_results: dict = {}


def run_taxonomy(employees_df, history_df) -> dict:
    """
    Run full taxonomy on the dataset. Called after data_loader processes CSVs.
    Returns enriched classification results.
    """
    global _taxonomy_results
    import pandas as pd

    logger.info("Running taxonomy classification...")

    # 1. Grade classification (deterministic — no LLM needed)
    grade_map = {}
    for grade in employees_df["grade_title"].dropna().unique():
        grade_str = str(grade)
        if grade_str in GRADE_HIERARCHY:
            grade_map[grade_str] = GRADE_HIERARCHY[grade_str]
        else:
            grade_map[grade_str] = {
                "level": 0, "track": "unknown",
                "standard_level": grade_str, "band": "Unknown", "seniority_rank": 0,
            }
    logger.info(f"Classified {len(grade_map)} unique grades ({sum(1 for v in grade_map.values() if v['track'] != 'unknown')} known)")

    # 2. Function family classification (regex rules)
    function_map = {}
    for func in employees_df["function_title"].dropna().unique():
        function_map[str(func)] = classify_function_family(str(func))
    families = Counter(function_map.values())
    logger.info(f"Classified {len(function_map)} functions into {len(families)} families: {dict(families.most_common(10))}")

    # 3. Job title classification (seniority + family)
    title_map = {}
    all_titles = set()
    for col in ["job_title"]:
        if col in employees_df.columns:
            all_titles.update(employees_df[col].dropna().unique())
        if col in history_df.columns:
            all_titles.update(history_df[col].dropna().unique())

    for title in all_titles:
        title_str = str(title)
        title_map[title_str] = {
            "seniority_level": classify_title_level(title_str),
            "job_family": classify_job_family(title_str),
        }
    family_counts = Counter(t["job_family"] for t in title_map.values())
    level_counts = Counter(t["seniority_level"] for t in title_map.values())
    logger.info(f"Classified {len(title_map)} unique titles into {len(family_counts)} families, {len(level_counts)} levels")

    # 4. Career move classification
    move_results = []
    hist_sorted = history_df.sort_values(["pk_user", "effective_start_date"])
    prev_titles = hist_sorted.groupby("pk_user")["job_title"].shift(1)
    transitions = hist_sorted[hist_sorted["job_title"] != prev_titles].copy()
    transitions["prev_title"] = prev_titles[transitions.index]
    transitions = transitions.dropna(subset=["prev_title"])

    move_counts = Counter()
    for _, row in transitions.iterrows():
        move = classify_career_move(str(row["prev_title"]), str(row["job_title"]))
        move_counts[move["move_type"]] += 1
        move_results.append({
            "pk_user": row["pk_user"],
            "from_title": str(row["prev_title"]),
            "to_title": str(row["job_title"]),
            "date": str(row["effective_start_date"]),
            "move_type": move["move_type"],
            "confidence": move["confidence"],
            "signals": move["signals"],
        })

    logger.info(f"Classified {len(move_results)} career moves: {dict(move_counts)}")

    _taxonomy_results = {
        "grade_map": grade_map,
        "function_family_map": function_map,
        "title_map": title_map,
        "career_moves": move_results,
        "summary": {
            "unique_grades": len(grade_map),
            "known_grades": sum(1 for v in grade_map.values() if v["track"] != "unknown"),
            "unique_functions": len(function_map),
            "function_families": dict(families),
            "unique_titles": len(title_map),
            "job_families": dict(family_counts),
            "seniority_levels": dict(level_counts),
            "total_career_moves": len(move_results),
            "move_types": dict(move_counts),
        },
    }

    # Persist to disk for fast restart
    _save_cache()
    return _taxonomy_results


def get_taxonomy() -> dict:
    """Return cached taxonomy results."""
    if not _taxonomy_results:
        _load_cache()
    return _taxonomy_results


def _save_cache():
    """Save taxonomy to JSON file."""
    try:
        # Move results are too large for JSON — save summary + maps only
        cache = {
            "grade_map": _taxonomy_results.get("grade_map", {}),
            "function_family_map": _taxonomy_results.get("function_family_map", {}),
            "title_map": _taxonomy_results.get("title_map", {}),
            "summary": _taxonomy_results.get("summary", {}),
        }
        with open(TAXONOMY_CACHE_PATH, "w") as f:
            json.dump(cache, f, indent=2, default=str)
        logger.info(f"Taxonomy cached to {TAXONOMY_CACHE_PATH}")
    except Exception as e:
        logger.warning(f"Failed to save taxonomy cache: {e}")


def _load_cache():
    """Load taxonomy from JSON cache if available."""
    global _taxonomy_results
    if os.path.exists(TAXONOMY_CACHE_PATH):
        try:
            with open(TAXONOMY_CACHE_PATH) as f:
                _taxonomy_results = json.load(f)
            logger.info(f"Loaded taxonomy cache from {TAXONOMY_CACHE_PATH}")
        except Exception as e:
            logger.warning(f"Failed to load taxonomy cache: {e}")


def clear_taxonomy():
    """Clear taxonomy cache to force re-classification."""
    global _taxonomy_results
    _taxonomy_results = {}
    if os.path.exists(TAXONOMY_CACHE_PATH):
        os.remove(TAXONOMY_CACHE_PATH)
    logger.info("Taxonomy cache cleared")
