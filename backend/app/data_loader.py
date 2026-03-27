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


def get_stats() -> dict:
    if not is_loaded():
        return {"loaded": False}
    emp = _data_cache["employees"]
    return {
        "loaded": True,
        "total_employees": len(emp),
        "active": int(emp["is_active"].sum()),
        "departed": int((~emp["is_active"]).sum()),
        "history_records": len(_data_cache.get("history", [])),
        "loaded_at": str(_data_cache.get("_loaded_at", "")),
    }
