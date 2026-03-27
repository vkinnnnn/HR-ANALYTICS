from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
from ..data_loader import get_employees

router = APIRouter()


@router.get("/summary")
def turnover_summary():
    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    total = len(df)
    turnover_rate = round(len(departed) / total * 100, 1) if total > 0 else 0
    avg_tenure_at_departure = round(float(departed["tenure_years"].mean()), 1) if len(departed) > 0 else 0
    median_tenure_at_departure = round(float(departed["tenure_years"].median()), 1) if len(departed) > 0 else 0
    return {
        "total_employees": total,
        "active": int(active.shape[0]),
        "departed": int(departed.shape[0]),
        "turnover_rate": turnover_rate,
        "avg_tenure_at_departure_years": avg_tenure_at_departure,
        "median_tenure_at_departure_years": median_tenure_at_departure,
    }


@router.get("/by-department")
def turnover_by_department():
    df = get_employees()
    results = []
    for dept, group in df.groupby("department_name"):
        total = len(group)
        departed = int((~group["is_active"]).sum())
        active = int(group["is_active"].sum())
        rate = round(departed / total * 100, 1) if total > 0 else 0
        departed_df = group[~group["is_active"]]
        avg_tenure = round(float(departed_df["tenure_years"].mean()), 1) if len(departed_df) > 0 else 0
        results.append({
            "department": dept,
            "total": total,
            "active": active,
            "departed": departed,
            "turnover_rate": rate,
            "avg_tenure_at_departure": avg_tenure,
        })
    results.sort(key=lambda x: x["turnover_rate"], reverse=True)
    return {"data": results}


@router.get("/by-grade")
def turnover_by_grade():
    df = get_employees()
    results = []
    for grade, group in df.groupby("grade_title"):
        total = len(group)
        departed = int((~group["is_active"]).sum())
        active = int(group["is_active"].sum())
        rate = round(departed / total * 100, 1) if total > 0 else 0
        results.append({
            "grade": grade,
            "total": total,
            "active": active,
            "departed": departed,
            "turnover_rate": rate,
        })
    results.sort(key=lambda x: x["turnover_rate"], reverse=True)
    return {"data": results}


@router.get("/by-location")
def turnover_by_location():
    df = get_employees()
    results = []
    for country, group in df.groupby("country"):
        total = len(group)
        departed = int((~group["is_active"]).sum())
        active = int(group["is_active"].sum())
        rate = round(departed / total * 100, 1) if total > 0 else 0
        results.append({
            "country": country,
            "total": total,
            "active": active,
            "departed": departed,
            "turnover_rate": rate,
        })
    results.sort(key=lambda x: x["turnover_rate"], reverse=True)
    return {"data": results}


@router.get("/by-function")
def turnover_by_function():
    df = get_employees()
    results = []
    for func, group in df.groupby("function_title"):
        total = len(group)
        departed = int((~group["is_active"]).sum())
        active = int(group["is_active"].sum())
        rate = round(departed / total * 100, 1) if total > 0 else 0
        results.append({
            "function": func,
            "total": total,
            "active": active,
            "departed": departed,
            "turnover_rate": rate,
        })
    results.sort(key=lambda x: x["turnover_rate"], reverse=True)
    return {"data": results}


@router.get("/trend")
def turnover_trend():
    df = get_employees()
    departed = df[~df["is_active"]].copy()
    departed = departed[departed["Expire"].notna()]
    if len(departed) == 0:
        return {"data": []}
    departed["expire_month_dt"] = departed["Expire"].dt.to_period("M")
    monthly = departed.groupby("expire_month_dt").size().reset_index(name="departures")
    monthly["month"] = monthly["expire_month_dt"].astype(str)
    monthly = monthly.sort_values("month")
    return {"data": monthly[["month", "departures"]].to_dict(orient="records")}


@router.get("/tenure-at-departure")
def tenure_at_departure():
    df = get_employees()
    departed = df[~df["is_active"]].copy()
    if len(departed) == 0:
        return {"data": [], "total_departed": 0}
    bins = [0, 1, 2, 3, 5, 10, float("inf")]
    labels = ["0-1", "1-2", "2-3", "3-5", "5-10", "10+"]
    departed["tenure_bin"] = pd.cut(
        departed["tenure_years"], bins=bins, labels=labels, right=False
    )
    counts = departed["tenure_bin"].value_counts().reindex(labels, fill_value=0)
    result = [{"bin": label, "count": int(counts[label])} for label in labels]
    return {"data": result, "total_departed": int(len(departed))}


@router.get("/danger-zones")
def danger_zones():
    df = get_employees()
    total = len(df)
    overall_departed = int((~df["is_active"]).sum())
    company_turnover_rate = overall_departed / total * 100 if total > 0 else 0
    threshold = company_turnover_rate * 1.5
    danger = []
    for dept, group in df.groupby("department_name"):
        dept_total = len(group)
        dept_departed = int((~group["is_active"]).sum())
        dept_rate = dept_departed / dept_total * 100 if dept_total > 0 else 0
        if dept_rate > threshold:
            danger.append({
                "department": dept,
                "total": dept_total,
                "departed": dept_departed,
                "turnover_rate": round(dept_rate, 1),
                "company_avg": round(company_turnover_rate, 1),
                "excess_pct": round(dept_rate - company_turnover_rate, 1),
            })
    danger.sort(key=lambda x: x["turnover_rate"], reverse=True)
    return {
        "company_turnover_rate": round(company_turnover_rate, 1),
        "threshold": round(threshold, 1),
        "danger_zones": danger,
    }
