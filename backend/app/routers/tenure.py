from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from ..data_loader import get_employees

router = APIRouter()


@router.get("/summary")
def tenure_summary():
    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    return {
        "overall_avg_tenure_years": round(float(df["tenure_years"].mean()), 1) if len(df) > 0 else 0,
        "overall_median_tenure_years": round(float(df["tenure_years"].median()), 1) if len(df) > 0 else 0,
        "active_avg_tenure_years": round(float(active["tenure_years"].mean()), 1) if len(active) > 0 else 0,
        "active_median_tenure_years": round(float(active["tenure_years"].median()), 1) if len(active) > 0 else 0,
        "departed_avg_tenure_years": round(float(departed["tenure_years"].mean()), 1) if len(departed) > 0 else 0,
        "departed_median_tenure_years": round(float(departed["tenure_years"].median()), 1) if len(departed) > 0 else 0,
        "total_employees": len(df),
        "active_count": int(active.shape[0]),
        "departed_count": int(departed.shape[0]),
    }


@router.get("/by-department")
def tenure_by_department():
    df = get_employees()
    active = df[df["is_active"]]
    results = []
    for dept, group in active.groupby("department_name"):
        results.append({
            "department": dept,
            "avg_tenure_years": round(float(group["tenure_years"].mean()), 1),
            "median_tenure_years": round(float(group["tenure_years"].median()), 1),
            "min_tenure_years": round(float(group["tenure_years"].min()), 1),
            "max_tenure_years": round(float(group["tenure_years"].max()), 1),
            "headcount": len(group),
        })
    results.sort(key=lambda x: x["avg_tenure_years"], reverse=True)
    return {"data": results}


@router.get("/by-grade")
def tenure_by_grade():
    df = get_employees()
    active = df[df["is_active"]]
    results = []
    for grade, group in active.groupby("grade_title"):
        results.append({
            "grade": grade,
            "avg_tenure_years": round(float(group["tenure_years"].mean()), 1),
            "median_tenure_years": round(float(group["tenure_years"].median()), 1),
            "headcount": len(group),
        })
    results.sort(key=lambda x: x["avg_tenure_years"], reverse=True)
    return {"data": results}


@router.get("/cohorts")
def tenure_cohorts():
    df = get_employees()
    bins = [0, 1, 3, 5, 10, float("inf")]
    labels = ["0-1yr", "1-3yr", "3-5yr", "5-10yr", "10yr+"]
    df["cohort"] = pd.cut(df["tenure_years"], bins=bins, labels=labels, right=False)
    results = []
    for label in labels:
        cohort_df = df[df["cohort"] == label]
        active_count = int(cohort_df["is_active"].sum())
        departed_count = int((~cohort_df["is_active"]).sum())
        results.append({
            "cohort": label,
            "total": len(cohort_df),
            "active": active_count,
            "departed": departed_count,
        })
    return {"data": results}


@router.get("/distribution")
def tenure_distribution():
    df = get_employees()
    if len(df) == 0:
        return {"data": [], "total": 0, "median_tenure_years": 0}
    # Meaningful HR bins: early-attrition visible + career stages
    bins = [0, 0.5, 1, 2, 3, 5, 10, float("inf")]
    labels = ["0-6mo", "6-12mo", "1-2yr", "2-3yr", "3-5yr", "5-10yr", "10yr+"]
    df["tenure_bin"] = pd.cut(df["tenure_years"], bins=bins, labels=labels, right=False)
    counts = df["tenure_bin"].value_counts().reindex(labels, fill_value=0)
    result = [{"bin": label, "count": int(counts[label])} for label in labels]
    median_tenure = round(float(df["tenure_years"].median()), 1)
    return {"data": result, "total": len(df), "median_tenure_years": median_tenure}


@router.get("/long-tenured")
def long_tenured():
    df = get_employees()
    active = df[df["is_active"]]
    long = active[active["tenure_years"] >= 10].copy()
    long = long.sort_values("tenure_years", ascending=False)
    records = long[["PK_PERSON", "job_title", "department_name", "tenure_years"]].copy()
    records.columns = ["pk_person", "job_title", "department", "tenure_years"]
    records["tenure_years"] = records["tenure_years"].round(1)
    return {
        "count": len(records),
        "data": records.to_dict(orient="records"),
    }


@router.get("/short-departures")
def short_departures():
    df = get_employees()
    departed = df[~df["is_active"]]
    short = departed[departed["tenure_years"] < 1].copy()
    short = short.sort_values("tenure_years", ascending=True)
    records = short[["PK_PERSON", "job_title", "department_name", "tenure_years", "Hire", "Expire"]].copy()
    records.columns = ["pk_person", "job_title", "department", "tenure_years", "hire_date", "expire_date"]
    records["tenure_years"] = records["tenure_years"].round(2)
    records["hire_date"] = records["hire_date"].dt.strftime("%Y-%m-%d")
    records["expire_date"] = records["expire_date"].dt.strftime("%Y-%m-%d")
    return {
        "count": len(records),
        "data": records.to_dict(orient="records"),
    }


@router.get("/retention-curve")
def retention_curve():
    df = get_employees()
    if len(df) == 0:
        return {"data": []}
    total_hired = len(df)
    results = []
    for year in range(0, 16):
        # Employees who have tenure >= year means they survived at least that many years
        survived = int((df["tenure_years"] >= year).sum())
        retention_pct = round(survived / total_hired * 100, 1)
        results.append({
            "year": year,
            "survived": survived,
            "retention_pct": retention_pct,
        })
    return {"data": results, "total_hired": total_hired}
