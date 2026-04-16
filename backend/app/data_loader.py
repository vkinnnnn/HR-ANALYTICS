"""
Data Loader — Loads, joins, and enriches the 3 workforce CSVs.
Caches processed DataFrames in memory for fast API queries.
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime

_data_cache: dict[str, pd.DataFrame] = {}

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"))


def load_and_process(data_dir: str | None = None) -> dict[str, pd.DataFrame]:
    """Load all CSVs, join, compute derived fields, cache in memory."""
    global _data_cache
    data_dir = data_dir or DATA_DIR

    # ── Load raw CSVs ──
    emp_df = pd.read_csv(os.path.join(data_dir, "function_wh.csv"), index_col=0)
    hist_df = pd.read_csv(os.path.join(data_dir, "wh_history_full.csv"))
    hist_v2_df = pd.read_csv(os.path.join(data_dir, "wh_user_history_v2.csv"))

    # ── Parse dates ──
    emp_df["Hire"] = pd.to_datetime(emp_df["Hire"], errors="coerce")
    emp_df["Expire"] = pd.to_datetime(emp_df["Expire"], errors="coerce")
    emp_df["CREATED"] = pd.to_datetime(emp_df["CREATED"], errors="coerce")
    hist_df["effective_start_date"] = pd.to_datetime(hist_df["effective_start_date"], errors="coerce")
    hist_df["effective_end_date"] = pd.to_datetime(hist_df["effective_end_date"], errors="coerce")
    hist_v2_df["effective_start_date"] = pd.to_datetime(hist_v2_df["effective_start_date"], errors="coerce")
    hist_v2_df["effective_end_date"] = pd.to_datetime(hist_v2_df["effective_end_date"], errors="coerce")

    today = pd.Timestamp.now().normalize()

    # ── Enrich employee master ──
    emp_df["is_active"] = emp_df["Expire"].isna() | (emp_df["Expire"] > today)
    emp_df["tenure_days"] = (emp_df["Expire"].fillna(today) - emp_df["Hire"]).dt.days
    emp_df["tenure_years"] = (emp_df["tenure_days"] / 365.25).round(1)
    emp_df["tenure_cohort"] = pd.cut(
        emp_df["tenure_years"],
        bins=[-1, 1, 3, 5, 10, 100],
        labels=["0-1yr", "1-3yr", "3-5yr", "5-10yr", "10yr+"],
    )
    emp_df["hire_year"] = emp_df["Hire"].dt.year
    emp_df["hire_quarter"] = emp_df["Hire"].dt.to_period("Q").astype(str)
    emp_df["hire_month"] = emp_df["Hire"].dt.to_period("M").astype(str)
    if emp_df["Expire"].notna().any():
        emp_df["expire_year"] = emp_df["Expire"].dt.year
        emp_df["expire_quarter"] = emp_df["Expire"].dt.to_period("Q").astype(str)
        emp_df["expire_month"] = emp_df["Expire"].dt.to_period("M").astype(str)
    else:
        emp_df["expire_year"] = np.nan
        emp_df["expire_quarter"] = np.nan
        emp_df["expire_month"] = np.nan

    # ── Process job history ──
    hist_df = hist_df.sort_values(["pk_user", "effective_start_date"])

    # Current role (latest record per user)
    latest_roles = hist_df.groupby("pk_user").last().reset_index()
    latest_roles = latest_roles.rename(columns={
        "job_title": "current_job_title",
        "fk_direct_manager": "current_manager_id",
        "effective_start_date": "current_role_start",
    })[["pk_user", "current_job_title", "current_manager_id", "current_role_start"]]

    # Aggregate per-user history stats
    user_stats = hist_df.groupby("pk_user").agg(
        num_role_changes=("job_title", "count"),
        num_manager_changes=("fk_direct_manager", "nunique"),
        num_title_changes=("job_title", "nunique"),
        first_record=("effective_start_date", "min"),
        last_record=("effective_start_date", "max"),
    ).reset_index()

    # Detect title changes (promotions/laterals) per user
    hist_df["prev_title"] = hist_df.groupby("pk_user")["job_title"].shift(1)
    hist_df["title_changed"] = (hist_df["job_title"] != hist_df["prev_title"]) & hist_df["prev_title"].notna()
    title_changes = hist_df.groupby("pk_user")["title_changed"].sum().reset_index()
    title_changes.columns = ["pk_user", "num_actual_title_changes"]

    # Time in current role
    latest_roles["time_in_current_role_days"] = (today - latest_roles["current_role_start"]).dt.days

    # ── Merge everything into employee master ──
    emp_df = emp_df.merge(latest_roles, left_on="PK_PERSON", right_on="pk_user", how="left")
    emp_df = emp_df.merge(user_stats, left_on="PK_PERSON", right_on="pk_user", how="left", suffixes=("", "_stats"))
    emp_df = emp_df.merge(title_changes, left_on="PK_PERSON", right_on="pk_user", how="left", suffixes=("", "_tc"))

    # Fill NaN for employees with no history records
    for col in ["num_role_changes", "num_manager_changes", "num_title_changes", "num_actual_title_changes", "time_in_current_role_days"]:
        if col in emp_df.columns:
            emp_df[col] = emp_df[col].fillna(0).astype(int)

    # Clean up duplicate pk_user columns
    pk_user_cols = [c for c in emp_df.columns if c.startswith("pk_user")]
    emp_df = emp_df.drop(columns=pk_user_cols, errors="ignore")

    # ── Build manager span of control from history ──
    current_mgr = hist_df.drop_duplicates(subset=["pk_user"], keep="last")[["pk_user", "fk_direct_manager"]]
    span = current_mgr.groupby("fk_direct_manager").size().reset_index(name="direct_reports")
    span.columns = ["manager_id", "direct_reports"]

    # ── Run taxonomy classification ──
    from .taxonomy import run_taxonomy, classify_function_family, classify_title_level, classify_job_family, GRADE_HIERARCHY
    try:
        taxonomy = run_taxonomy(emp_df, hist_df)

        # Enrich employee DataFrame with taxonomy columns
        emp_df["grade_band"] = emp_df["grade_title"].map(
            lambda g: GRADE_HIERARCHY.get(str(g), {}).get("band", "Unknown") if pd.notna(g) else "Unknown"
        )
        emp_df["grade_standard_level"] = emp_df["grade_title"].map(
            lambda g: GRADE_HIERARCHY.get(str(g), {}).get("standard_level", str(g)) if pd.notna(g) else "Unknown"
        )
        emp_df["grade_track"] = emp_df["grade_title"].map(
            lambda g: GRADE_HIERARCHY.get(str(g), {}).get("track", "unknown") if pd.notna(g) else "unknown"
        )
        emp_df["seniority_rank"] = emp_df["grade_title"].map(
            lambda g: GRADE_HIERARCHY.get(str(g), {}).get("seniority_rank", 0) if pd.notna(g) else 0
        )
        emp_df["function_family"] = emp_df["function_title"].map(
            lambda f: classify_function_family(str(f)) if pd.notna(f) else "Unknown"
        )
        emp_df["title_seniority"] = emp_df["job_title"].map(
            lambda t: classify_title_level(str(t)) if pd.notna(t) else "Unknown"
        )
        emp_df["job_family"] = emp_df["job_title"].map(
            lambda t: classify_job_family(str(t)) if pd.notna(t) else "Unknown"
        )
        _data_cache["taxonomy"] = taxonomy
        print(f"Taxonomy: {taxonomy.get('summary', {}).get('total_career_moves', 0)} career moves classified")
    except Exception as e:
        print(f"Warning: Taxonomy classification failed: {e}")

    # ── Cache everything ──
    _data_cache["employees"] = emp_df
    _data_cache["history"] = hist_df
    _data_cache["history_v2"] = hist_v2_df
    _data_cache["manager_span"] = span
    _data_cache["current_managers"] = current_mgr
    _data_cache["_loaded_at"] = pd.Timestamp.now()

    return _data_cache


def get_employees() -> pd.DataFrame:
    if "employees" not in _data_cache:
        load_and_process()
    return _data_cache["employees"]


def get_history() -> pd.DataFrame:
    if "history" not in _data_cache:
        load_and_process()
    return _data_cache["history"]


def get_manager_span() -> pd.DataFrame:
    if "manager_span" not in _data_cache:
        load_and_process()
    return _data_cache["manager_span"]


def get_current_managers() -> pd.DataFrame:
    if "current_managers" not in _data_cache:
        load_and_process()
    return _data_cache["current_managers"]


def is_loaded() -> bool:
    return "employees" in _data_cache


def load_recognition(data_dir: str | None = None) -> dict[str, pd.DataFrame]:
    """Load recognition data and compute derived fields for knowledge base."""
    global _data_cache
    data_dir = data_dir or DATA_DIR
    rec_path = os.path.join(data_dir, "annotated_results.csv")

    if not os.path.exists(rec_path):
        print(f"Warning: Recognition data not found at {rec_path}")
        return _data_cache

    try:
        rec_df = pd.read_csv(rec_path)

        # ── Compute derived fields for recognition data ──
        # Seniority extraction from titles
        def extract_seniority(title):
            if pd.isna(title): return 'Unknown'
            t = str(title).lower()
            if any(x in t for x in ['vp','vice president','chief','ceo','cto','cfo']): return 'Executive'
            if 'senior director' in t: return 'Sr Director'
            if 'director' in t: return 'Director'
            if 'senior manager' in t: return 'Sr Manager'
            if any(x in t for x in ['team leader','team lead']): return 'Team Lead'
            if 'manager' in t and 'associate' not in t: return 'Manager'
            if any(x in t for x in ['principal','staff']): return 'Principal/Staff'
            if any(x in t for x in ['senior ','sr.','sr ']): return 'Senior IC'
            if any(x in t for x in ['junior','jr.','intern','associate']): return 'Entry'
            return 'IC'

        # Function inference from titles
        def infer_function(title):
            if pd.isna(title): return 'Other'
            t = str(title).lower()
            if any(x in t for x in ['engineer','software','developer','qa','sre','devops','infrastructure','cloud','helpdesk']): return 'Engineering'
            if any(x in t for x in ['customer service','customer success','support']): return 'Customer Service'
            if any(x in t for x in ['product manager','product design','ux','ui','designer']): return 'Product & Design'
            if any(x in t for x in ['finance','accounting','payroll','buyer','procurement']): return 'Finance & Ops'
            if any(x in t for x in ['marketing','brand','content','copywriter','creative','media']): return 'Marketing'
            if any(x in t for x in ['data','analyst','analytics','insight']): return 'Data & Analytics'
            if any(x in t for x in ['people','hr ','human','talent','recruiting']): return 'People & HR'
            if any(x in t for x in ['sales','business development','account exec','revenue']): return 'Sales'
            if any(x in t for x in ['legal','compliance','risk','security']): return 'Legal & Compliance'
            return 'Other'

        # Specificity scoring (NLP-based)
        ACTION_VERBS = ['delivered','built','led','automated','reduced','increased','designed',
            'implemented','launched','created','resolved','developed','achieved','completed',
            'managed','optimized','improved','streamlined','negotiated','spearheaded',
            'coordinated','facilitated','transformed','pioneered','executed','established']

        def compute_specificity(msg):
            import re
            if pd.isna(msg): return 0.0
            words = str(msg).lower().split()
            s = 0.0
            if re.search(r'\d+', str(msg).lower()): s += 0.3
            av = sum(1 for v in ACTION_VERBS if v in str(msg).lower())
            s += min(av, 2) * 0.15
            if len(words) > 40: s += 0.1
            if len(words) > 80: s += 0.1
            trait_ct = sum(1 for t in ['amazing','great','awesome','wonderful','fantastic'] if t in str(msg).lower())
            if trait_ct > 0 and av == 0: s -= 0.15
            return round(min(max(s, 0), 1.0), 3)

        # Compute all derived fields
        rec_df['rec_seniority'] = rec_df['recipient_title'].apply(extract_seniority)
        rec_df['nom_seniority'] = rec_df['nominator_title'].apply(extract_seniority)
        rec_df['rec_function'] = rec_df['recipient_title'].apply(infer_function)
        rec_df['nom_function'] = rec_df['nominator_title'].apply(infer_function)
        rec_df['specificity'] = rec_df['message'].apply(compute_specificity)
        rec_df['word_count'] = rec_df['message'].str.split().str.len()
        rec_df['action_verb_count'] = rec_df['message'].apply(lambda m: sum(1 for v in ACTION_VERBS if v in str(m).lower()))

        # Recognition direction
        mgr_levels = {'Executive','Sr Director','Director','Sr Manager','Manager','Team Lead'}
        ic_levels = {'Principal/Staff','Senior IC','IC','Entry'}
        def get_direction(nom, rec):
            if nom in mgr_levels and rec in ic_levels: return 'Downward'
            if nom in ic_levels and rec in mgr_levels: return 'Upward'
            return 'Lateral'
        rec_df['direction'] = rec_df.apply(lambda r: get_direction(r['nom_seniority'], r['rec_seniority']), axis=1)

        # ── Compute aggregate KPIs for knowledge base ──
        kpis = {
            'total_awards': len(rec_df),
            'unique_recipients': rec_df['recipient_title'].nunique(),
            'unique_nominators': rec_df['nominator_title'].nunique(),
            'avg_specificity': rec_df['specificity'].mean(),
            'median_specificity': rec_df['specificity'].median(),
            'categories': rec_df['category_name'].nunique() if 'category_name' in rec_df.columns else 0,
            'top_categories': rec_df['category_name'].value_counts().head(5).to_dict() if 'category_name' in rec_df.columns else {},
            'top_recipients': rec_df['recipient_title'].value_counts().head(10).to_dict(),
            'top_nominators': rec_df['nominator_title'].value_counts().head(10).to_dict(),
            'direction_split': rec_df['direction'].value_counts().to_dict(),
            'avg_word_count': rec_df['word_count'].mean(),
        }

        _data_cache["recognition"] = rec_df
        _data_cache["recognition_kpis"] = kpis
        print(f"Recognition data loaded: {kpis['total_awards']} awards, avg specificity: {kpis['avg_specificity']:.3f}")
        return _data_cache
    except Exception as e:
        print(f"Warning: Could not load recognition data: {e}")
        return _data_cache


def get_recognition() -> pd.DataFrame | None:
    if "recognition" not in _data_cache:
        return None
    return _data_cache["recognition"]


def is_recognition_loaded() -> bool:
    return "recognition" in _data_cache and len(_data_cache["recognition"]) > 0


def get_stats() -> dict:
    if not is_loaded():
        return {"loaded": False}
    emp = _data_cache["employees"]
    stats = {
        "loaded": True,
        "total_employees": len(emp),
        "active": int(emp["is_active"].sum()),
        "departed": int((~emp["is_active"]).sum()),
        "history_records": len(_data_cache.get("history", [])),
        "loaded_at": str(_data_cache.get("_loaded_at", "")),
    }
    if is_recognition_loaded():
        kpis = _data_cache.get("recognition_kpis", {})
        stats["recognition_awards"] = kpis.get('total_awards', 0)
        stats["recognition_recipients"] = kpis.get('unique_recipients', 0)
    return stats
