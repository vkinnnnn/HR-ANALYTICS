from fastapi import APIRouter, Query
import pandas as pd
from ..data_loader import get_employees

router = APIRouter()


@router.get("/summary")
def workforce_summary():
    df = get_employees()
    active = df[df["is_active"]]
    departed = df[~df["is_active"]]
    today = pd.Timestamp.now()
    this_quarter_start = today - pd.offsets.QuarterBegin(startingMonth=1)
    new_hires_qtr = int(active[active["Hire"] >= this_quarter_start].shape[0]) if "Hire" in df.columns else 0
    departures_qtr = int(departed[departed["Expire"] >= this_quarter_start].shape[0]) if departed["Expire"].notna().any() else 0
    return {
        "total_headcount": len(df),
        "active": int(active.shape[0]),
        "departed": int(departed.shape[0]),
        "turnover_rate": round(len(departed) / len(df) * 100, 1) if len(df) > 0 else 0,
        "avg_tenure_years": round(float(active["tenure_years"].mean()), 1) if len(active) > 0 else 0,
        "new_hires_this_quarter": new_hires_qtr,
        "departures_this_quarter": departures_qtr,
        "unique_departments": int(df["department_name"].nunique()),
        "unique_locations": int(df["country"].nunique()) if "country" in df.columns else 0,
    }


@router.get("/by-department")
def by_department():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["department_name"].value_counts().reset_index()
    counts.columns = ["department", "headcount"]
    return {"data": counts.to_dict(orient="records")}


@router.get("/by-business-unit")
def by_business_unit():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["business_unit_name"].value_counts().reset_index()
    counts.columns = ["business_unit", "headcount"]
    return {"data": counts.to_dict(orient="records")}


@router.get("/by-function")
def by_function():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["function_title"].value_counts().reset_index()
    counts.columns = ["function", "headcount"]
    return {"data": counts.to_dict(orient="records")}


@router.get("/by-grade")
def by_grade():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["grade_title"].value_counts().reset_index()
    counts.columns = ["grade", "headcount"]
    return {"data": counts.to_dict(orient="records")}


@router.get("/by-location")
def by_location():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["country"].value_counts().reset_index()
    counts.columns = ["country", "headcount"]
    return {"data": counts.to_dict(orient="records")}


@router.get("/by-country")
def by_country():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active.groupby("country").agg(
        headcount=("PK_PERSON", "count"),
        departments=("department_name", "nunique"),
    ).reset_index().sort_values("headcount", ascending=False)
    return {"data": counts.to_dict(orient="records")}


@router.get("/grade-pyramid")
def grade_pyramid():
    df = get_employees()
    active = df[df["is_active"]]
    counts = active["grade_title"].value_counts().reset_index()
    counts.columns = ["grade", "count"]
    total = counts["count"].sum()
    counts["percentage"] = (counts["count"] / total * 100).round(1)
    return {"data": counts.to_dict(orient="records"), "total": int(total)}


@router.get("/headcount-trend")
def headcount_trend():
    df = get_employees()
    # Build monthly headcount from hire/expire dates
    months = pd.date_range(
        start=df["Hire"].min(),
        end=pd.Timestamp.now(),
        freq="ME"
    )
    trend = []
    for month_end in months:
        hired_by = df[df["Hire"] <= month_end]
        still_active = hired_by[hired_by["Expire"].isna() | (hired_by["Expire"] > month_end)]
        trend.append({
            "month": month_end.strftime("%Y-%m"),
            "headcount": len(still_active),
        })
    return {"data": trend}


@router.get("/active-vs-departed")
def active_vs_departed():
    df = get_employees()
    return {
        "active": int(df["is_active"].sum()),
        "departed": int((~df["is_active"]).sum()),
    }
