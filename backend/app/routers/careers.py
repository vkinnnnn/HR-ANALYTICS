"""
Career Progression & Promotion Analytics Router
"""

from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from collections import Counter

from ..data_loader import get_employees, get_history, get_manager_span, get_current_managers

router = APIRouter()


def _promotion_velocity_per_employee(hist: pd.DataFrame) -> pd.DataFrame:
    """For each employee with title changes, compute avg days between title changes."""
    changed = hist[hist["title_changed"]].copy()
    if changed.empty:
        return pd.DataFrame(columns=["pk_user", "avg_days_between_changes"])

    changed = changed.sort_values(["pk_user", "effective_start_date"])

    results = []
    for pk_user, grp in changed.groupby("pk_user"):
        dates = grp["effective_start_date"].dropna().sort_values()
        if len(dates) < 2:
            continue
        diffs = dates.diff().dropna().dt.days
        avg_days = diffs.mean()
        results.append({"pk_user": pk_user, "avg_days_between_changes": avg_days})

    if not results:
        return pd.DataFrame(columns=["pk_user", "avg_days_between_changes"])
    return pd.DataFrame(results)


@router.get("/summary")
async def career_summary():
    """Avg promotion velocity, total promotions detected, % employees with title changes."""
    emp = get_employees()
    hist = get_history()

    total_employees = len(emp)
    employees_with_changes = int((emp["num_actual_title_changes"] > 0).sum())
    pct_with_changes = round(employees_with_changes / total_employees * 100, 2) if total_employees > 0 else 0.0

    total_promotions = int(hist["title_changed"].sum())

    velocity = _promotion_velocity_per_employee(hist)
    avg_velocity = round(velocity["avg_days_between_changes"].mean(), 1) if not velocity.empty else 0.0

    return {
        "avg_promotion_velocity_days": avg_velocity,
        "total_promotions_detected": total_promotions,
        "employees_with_title_changes": employees_with_changes,
        "pct_employees_with_title_changes": pct_with_changes,
        "total_employees": total_employees,
    }


@router.get("/promotion-velocity")
async def promotion_velocity():
    """Avg days between title changes by department and grade."""
    emp = get_employees()
    hist = get_history()

    velocity = _promotion_velocity_per_employee(hist)
    if velocity.empty:
        return {"by_department": [], "by_grade": []}

    merged = velocity.merge(
        emp[["PK_PERSON", "department_name", "grade_title"]],
        left_on="pk_user",
        right_on="PK_PERSON",
        how="left",
    )

    by_dept = (
        merged.groupby("department_name")["avg_days_between_changes"]
        .mean()
        .round(1)
        .reset_index()
        .rename(columns={"department_name": "department", "avg_days_between_changes": "avg_velocity_days"})
        .sort_values("avg_velocity_days")
    )

    by_grade = (
        merged.groupby("grade_title")["avg_days_between_changes"]
        .mean()
        .round(1)
        .reset_index()
        .rename(columns={"grade_title": "grade", "avg_days_between_changes": "avg_velocity_days"})
        .sort_values("avg_velocity_days")
    )

    return {
        "by_department": by_dept.to_dict(orient="records"),
        "by_grade": by_grade.to_dict(orient="records"),
    }


@router.get("/stuck-employees")
async def stuck_employees():
    """Active employees in the same role for >= 3 years (1095 days)."""
    emp = get_employees()
    threshold = 3 * 365  # 1095 days

    stuck = emp[(emp["is_active"]) & (emp["time_in_current_role_days"] >= threshold)].copy()
    stuck = stuck.sort_values("time_in_current_role_days", ascending=False)

    records = []
    for _, row in stuck.iterrows():
        records.append({
            "PK_PERSON": int(row["PK_PERSON"]) if pd.notna(row["PK_PERSON"]) else None,
            "job_title": row.get("current_job_title", row.get("job_title", "")),
            "department": row.get("department_name", ""),
            "time_in_current_role_days": int(row["time_in_current_role_days"]),
            "grade": row.get("grade_title", ""),
        })

    return {
        "threshold_days": threshold,
        "count": len(records),
        "employees": records,
    }


@router.get("/career-paths")
async def career_paths(top_n: int = Query(default=20, ge=1, le=100)):
    """Most common job title sequences: 2-step and 3-step paths."""
    hist = get_history()

    # Build ordered title list per employee (only where title actually changed)
    hist_sorted = hist.sort_values(["pk_user", "effective_start_date"])

    two_step = Counter()
    three_step = Counter()

    for pk_user, grp in hist_sorted.groupby("pk_user"):
        titles = grp["job_title"].dropna().tolist()
        # Deduplicate consecutive duplicates
        deduped = [titles[0]] if titles else []
        for t in titles[1:]:
            if t != deduped[-1]:
                deduped.append(t)

        if len(deduped) < 2:
            continue

        for i in range(len(deduped) - 1):
            two_step[(deduped[i], deduped[i + 1])] += 1

        for i in range(len(deduped) - 2):
            three_step[(deduped[i], deduped[i + 1], deduped[i + 2])] += 1

    two_step_list = [
        {"path": list(path), "count": count}
        for path, count in two_step.most_common(top_n)
    ]

    three_step_list = [
        {"path": list(path), "count": count}
        for path, count in three_step.most_common(top_n)
    ]

    return {
        "two_step_paths": two_step_list,
        "three_step_paths": three_step_list,
    }


@router.get("/title-changes")
async def title_changes(limit: int = Query(default=500, ge=1, le=5000)):
    """For each employee with title changes, list from_title -> to_title transitions with dates."""
    hist = get_history()

    changed = hist[hist["title_changed"]].copy()
    changed = changed.sort_values(["pk_user", "effective_start_date"])

    records = []
    for _, row in changed.iterrows():
        records.append({
            "pk_user": int(row["pk_user"]) if pd.notna(row["pk_user"]) else None,
            "from_title": row["prev_title"],
            "to_title": row["job_title"],
            "effective_date": str(row["effective_start_date"].date()) if pd.notna(row["effective_start_date"]) else None,
        })
        if len(records) >= limit:
            break

    # Count unique employees
    unique_employees = len(set(r["pk_user"] for r in records if r["pk_user"] is not None))

    return {
        "total_transitions": len(records),
        "unique_employees": unique_employees,
        "transitions": records,
    }


@router.get("/by-department")
async def by_department():
    """Number of title changes per department, avg promotion velocity per dept."""
    emp = get_employees()
    hist = get_history()

    # Title changes per department
    merged = hist.merge(
        emp[["PK_PERSON", "department_name"]],
        left_on="pk_user",
        right_on="PK_PERSON",
        how="left",
    )

    dept_changes = (
        merged[merged["title_changed"]]
        .groupby("department_name")
        .size()
        .reset_index(name="title_change_count")
        .rename(columns={"department_name": "department"})
        .sort_values("title_change_count", ascending=False)
    )

    # Avg promotion velocity per department
    velocity = _promotion_velocity_per_employee(hist)
    if not velocity.empty:
        vel_merged = velocity.merge(
            emp[["PK_PERSON", "department_name"]],
            left_on="pk_user",
            right_on="PK_PERSON",
            how="left",
        )
        dept_velocity = (
            vel_merged.groupby("department_name")["avg_days_between_changes"]
            .mean()
            .round(1)
            .reset_index()
            .rename(columns={"department_name": "department", "avg_days_between_changes": "avg_velocity_days"})
        )
    else:
        dept_velocity = pd.DataFrame(columns=["department", "avg_velocity_days"])

    # Merge both metrics
    result = dept_changes.merge(dept_velocity, on="department", how="outer").fillna(0)
    result["title_change_count"] = result["title_change_count"].astype(int)
    result = result.sort_values("title_change_count", ascending=False)

    return {
        "departments": result.to_dict(orient="records"),
    }
