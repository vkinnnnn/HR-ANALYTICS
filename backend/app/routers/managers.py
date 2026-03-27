"""
Manager Analytics & Span of Control Router
"""

from fastapi import APIRouter, Query
import pandas as pd
import numpy as np

from ..data_loader import get_employees, get_history, get_manager_span, get_current_managers

router = APIRouter()


@router.get("/summary")
async def manager_summary():
    """Total managers, avg/max/median span of control."""
    span = get_manager_span()
    current_mgr = get_current_managers()

    # Total unique managers = unique fk_direct_manager values
    total_managers = int(current_mgr["fk_direct_manager"].nunique())

    if span.empty:
        return {
            "total_managers": total_managers,
            "avg_span_of_control": 0.0,
            "max_span_of_control": 0,
            "median_span_of_control": 0.0,
        }

    return {
        "total_managers": total_managers,
        "avg_span_of_control": round(float(span["direct_reports"].mean()), 2),
        "max_span_of_control": int(span["direct_reports"].max()),
        "median_span_of_control": round(float(span["direct_reports"].median()), 1),
        "min_span_of_control": int(span["direct_reports"].min()),
        "total_direct_report_relationships": int(span["direct_reports"].sum()),
    }


@router.get("/span-distribution")
async def span_distribution():
    """Histogram of direct_reports counts in buckets."""
    span = get_manager_span()

    if span.empty:
        return {"buckets": [], "total_managers": 0}

    bins = [0, 3, 6, 10, 15, 20, float("inf")]
    labels = ["1-3", "4-6", "7-10", "11-15", "16-20", "20+"]

    span["bucket"] = pd.cut(span["direct_reports"], bins=bins, labels=labels, right=True)
    dist = span["bucket"].value_counts().reindex(labels, fill_value=0)

    buckets = [{"range": label, "count": int(count)} for label, count in dist.items()]

    return {
        "buckets": buckets,
        "total_managers": len(span),
    }


@router.get("/leaderboard")
async def leaderboard(top_n: int = Query(default=25, ge=1, le=200)):
    """Top managers by span of control with employee details."""
    span = get_manager_span()
    emp = get_employees()

    if span.empty:
        return {"managers": []}

    top = span.nlargest(top_n, "direct_reports").copy()

    # Join with employee data to get manager's own details
    top_merged = top.merge(
        emp[["PK_PERSON", "job_title", "department_name", "grade_title", "business_unit_name"]],
        left_on="manager_id",
        right_on="PK_PERSON",
        how="left",
    )

    records = []
    for _, row in top_merged.iterrows():
        records.append({
            "manager_id": int(row["manager_id"]) if pd.notna(row["manager_id"]) else None,
            "direct_reports": int(row["direct_reports"]),
            "job_title": row.get("job_title", "") if pd.notna(row.get("job_title", np.nan)) else "",
            "department": row.get("department_name", "") if pd.notna(row.get("department_name", np.nan)) else "",
            "grade": row.get("grade_title", "") if pd.notna(row.get("grade_title", np.nan)) else "",
            "business_unit": row.get("business_unit_name", "") if pd.notna(row.get("business_unit_name", np.nan)) else "",
        })

    return {"managers": records}


@router.get("/retention")
async def retention():
    """Per-manager retention rate. Flag 'revolving door' if retention < 60%."""
    current_mgr = get_current_managers()
    emp = get_employees()

    # Map each report to their manager and active status
    reports = current_mgr.merge(
        emp[["PK_PERSON", "is_active"]],
        left_on="pk_user",
        right_on="PK_PERSON",
        how="left",
    )

    if reports.empty:
        return {"managers": [], "revolving_door_count": 0}

    mgr_stats = reports.groupby("fk_direct_manager").agg(
        total_reports=("pk_user", "count"),
        departed=("is_active", lambda x: int((~x).sum())),
    ).reset_index()

    mgr_stats["retained"] = mgr_stats["total_reports"] - mgr_stats["departed"]
    mgr_stats["retention_rate"] = (
        (mgr_stats["retained"] / mgr_stats["total_reports"] * 100).round(1)
    )
    mgr_stats["revolving_door"] = mgr_stats["retention_rate"] < 60.0

    # Join with employee data for manager details
    mgr_stats = mgr_stats.merge(
        emp[["PK_PERSON", "job_title", "department_name"]],
        left_on="fk_direct_manager",
        right_on="PK_PERSON",
        how="left",
    )

    mgr_stats = mgr_stats.sort_values("retention_rate", ascending=True)

    records = []
    for _, row in mgr_stats.iterrows():
        records.append({
            "manager_id": int(row["fk_direct_manager"]) if pd.notna(row["fk_direct_manager"]) else None,
            "job_title": row.get("job_title", "") if pd.notna(row.get("job_title", np.nan)) else "",
            "department": row.get("department_name", "") if pd.notna(row.get("department_name", np.nan)) else "",
            "total_reports": int(row["total_reports"]),
            "departed": int(row["departed"]),
            "retained": int(row["retained"]),
            "retention_rate": float(row["retention_rate"]),
            "revolving_door": bool(row["revolving_door"]),
        })

    revolving_door_count = int(mgr_stats["revolving_door"].sum())

    return {
        "managers": records,
        "total_managers": len(records),
        "revolving_door_count": revolving_door_count,
    }


@router.get("/ratio-by-department")
async def ratio_by_department():
    """Manager-to-employee ratio per department."""
    emp = get_employees()
    span = get_manager_span()

    active = emp[emp["is_active"]].copy()

    # Managers are those with direct_reports > 0 in span table
    manager_ids = set(span[span["direct_reports"] > 0]["manager_id"].tolist())

    # Tag active employees as manager or not
    active["is_manager"] = active["PK_PERSON"].isin(manager_ids)

    dept_stats = active.groupby("department_name").agg(
        total_employees=("PK_PERSON", "count"),
        managers=("is_manager", "sum"),
    ).reset_index()

    dept_stats["individual_contributors"] = dept_stats["total_employees"] - dept_stats["managers"]
    dept_stats["manager_to_employee_ratio"] = np.where(
        dept_stats["total_employees"] > 0,
        (dept_stats["managers"] / dept_stats["total_employees"] * 100).round(2),
        0.0,
    )
    dept_stats["avg_span"] = np.where(
        dept_stats["managers"] > 0,
        (dept_stats["individual_contributors"] / dept_stats["managers"]).round(1),
        0.0,
    )

    dept_stats = dept_stats.sort_values("manager_to_employee_ratio", ascending=False)
    dept_stats = dept_stats.rename(columns={"department_name": "department"})

    return {
        "departments": dept_stats.to_dict(orient="records"),
    }


@router.get("/churn")
async def churn(threshold: int = Query(default=4, ge=2, le=20)):
    """Employees who changed managers frequently (num_manager_changes >= threshold)."""
    emp = get_employees()

    churners = emp[emp["num_manager_changes"] >= threshold].copy()
    churners = churners.sort_values("num_manager_changes", ascending=False)

    records = []
    for _, row in churners.iterrows():
        records.append({
            "PK_PERSON": int(row["PK_PERSON"]) if pd.notna(row["PK_PERSON"]) else None,
            "job_title": row.get("current_job_title", row.get("job_title", "")),
            "department": row.get("department_name", ""),
            "num_manager_changes": int(row["num_manager_changes"]),
            "tenure_years": float(row["tenure_years"]) if pd.notna(row["tenure_years"]) else 0.0,
            "is_active": bool(row["is_active"]),
        })

    return {
        "threshold": threshold,
        "count": len(records),
        "employees": records,
    }
