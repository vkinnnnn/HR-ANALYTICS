"""
Analytics Engine — Computes KPIs on demand from cached DataFrames.

Direct Python interface for the LangGraph agent. Returns structured data
the LLM can reason about: raw numbers, interpretation, and benchmarks.
"""

import logging
from typing import Any

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def _get_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame | None]:
    """Get employees, active, and departed DataFrames."""
    from ..data_loader import get_employees, is_loaded
    if not is_loaded():
        raise ValueError("Workforce data not loaded")
    emp = get_employees()
    active = emp[emp["is_active"]]
    departed = emp[~emp["is_active"]]
    return emp, active, departed


def _get_recognition() -> pd.DataFrame | None:
    try:
        from ..recognition_loader import get_recognition, is_recognition_loaded
        if is_recognition_loaded():
            rdf = get_recognition()
            return rdf if not rdf.empty else None
    except Exception:
        pass
    return None


def query_analytics(query_type: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Central query interface. Returns { data, interpretation, benchmark? }.
    """
    params = params or {}
    handlers: dict[str, Any] = {
        "summary": _summary,
        "headcount": _headcount,
        "turnover": _turnover,
        "tenure": _tenure,
        "departments": _departments,
        "grades": _grades,
        "countries": _countries,
        "business_units": _business_units,
        "careers": _careers,
        "managers": _managers,
        "flight_risk": _flight_risk,
        "gini": _gini,
        "categories": _categories,
        "specificity": _specificity,
        "flow_direction": _flow_direction,
        "fairness": _fairness,
        "nominators": _nominators,
        "compare": _compare,
        "top_roles": _top_roles,
        "award_types": _award_types,
        "cohort_retention": _cohort_retention,
    }

    handler = handlers.get(query_type)
    if handler is None:
        return {
            "data": None,
            "interpretation": f"Unknown query type '{query_type}'. Available: {', '.join(sorted(handlers.keys()))}",
        }

    try:
        return handler(params)
    except Exception as e:
        logger.error(f"Analytics query failed ({query_type}): {e}")
        return {"data": None, "interpretation": f"Error computing {query_type}: {str(e)}"}


def _summary(_: dict) -> dict:
    emp, active, departed = _get_data()
    total = len(emp)
    active_n = len(active)
    dep_n = len(departed)
    rate = round(dep_n / total * 100, 1) if total else 0
    avg_t = round(float(emp["tenure_years"].mean()), 1)

    result = {
        "total_employees": total,
        "active": active_n,
        "departed": dep_n,
        "turnover_rate": rate,
        "avg_tenure_years": avg_t,
        "departments": int(emp["department_name"].nunique()),
        "countries": int(emp["country"].nunique()) if "country" in emp.columns else 0,
    }

    rdf = _get_recognition()
    if rdf is not None:
        from ..recognition_loader import compute_gini
        rcounts = rdf["recipient_title"].value_counts()
        result["recognition_awards"] = len(rdf)
        result["gini_coefficient"] = round(compute_gini(rcounts.values.tolist()), 3)
        result["avg_specificity"] = round(float(rdf["specificity"].mean()), 3)

    return {
        "data": result,
        "interpretation": (
            f"Workforce of {total} employees: {active_n} active, {dep_n} departed ({rate}% turnover). "
            f"Average tenure {avg_t} years."
        ),
        "benchmark": "Industry average turnover: 15-20%. Average tenure: 4.1 years.",
    }


def _headcount(params: dict) -> dict:
    emp, active, _ = _get_data()
    group_by = params.get("group_by", "department_name")
    if group_by not in emp.columns:
        group_by = "department_name"
    dist = active.groupby(group_by).size().sort_values(ascending=False)
    data = {str(k): int(v) for k, v in dist.items()}
    return {
        "data": data,
        "interpretation": f"Headcount by {group_by}: largest is {dist.index[0]} with {int(dist.iloc[0])} employees.",
    }


def _turnover(params: dict) -> dict:
    emp, _, departed = _get_data()
    group_by = params.get("group_by")
    total = len(emp)
    if group_by and group_by in emp.columns:
        stats = emp.groupby(group_by).agg(
            total=("is_active", "count"),
            departed=("is_active", lambda x: int((~x).sum())),
        )
        stats["rate"] = (stats["departed"] / stats["total"] * 100).round(1)
        data = {str(k): {"total": int(r["total"]), "departed": int(r["departed"]), "rate": float(r["rate"])}
                for k, r in stats.iterrows()}
        worst = stats.sort_values("rate", ascending=False).head(3)
        interp = "Highest turnover: " + ", ".join(
            f"{k} ({r['rate']}%)" for k, r in worst.iterrows()
        )
    else:
        dep_n = len(departed)
        rate = round(dep_n / total * 100, 1) if total else 0
        data = {"overall_rate": rate, "departed": dep_n, "total": total}
        interp = f"Overall turnover rate: {rate}% ({dep_n} of {total})"

    return {"data": data, "interpretation": interp, "benchmark": "Industry avg: 15-20%"}


def _tenure(params: dict) -> dict:
    emp, active, departed = _get_data()
    data = {
        "avg_all": round(float(emp["tenure_years"].mean()), 1),
        "median_all": round(float(emp["tenure_years"].median()), 1),
        "avg_active": round(float(active["tenure_years"].mean()), 1),
        "avg_departed": round(float(departed["tenure_years"].mean()), 1) if len(departed) else 0,
    }
    return {
        "data": data,
        "interpretation": f"Average tenure: {data['avg_all']} years (active: {data['avg_active']}, departed: {data['avg_departed']}).",
        "benchmark": "US median tenure: 4.1 years (BLS).",
    }


def _departments(params: dict) -> dict:
    emp, active, departed = _get_data()
    stats = emp.groupby("department_name").agg(
        total=("is_active", "count"),
        active=("is_active", "sum"),
        avg_tenure=("tenure_years", "mean"),
    ).round(1).sort_values("total", ascending=False)
    stats["turnover_pct"] = ((stats["total"] - stats["active"]) / stats["total"] * 100).round(1)
    data = {str(k): {"total": int(r["total"]), "active": int(r["active"]),
                      "avg_tenure": float(r["avg_tenure"]), "turnover_pct": float(r["turnover_pct"])}
            for k, r in stats.iterrows()}
    return {"data": data, "interpretation": f"{len(stats)} departments. Largest: {stats.index[0]} ({int(stats.iloc[0]['total'])})."}


def _grades(params: dict) -> dict:
    emp, active, _ = _get_data()
    col = "grade_band" if "grade_band" in active.columns else "grade_title"
    if col not in active.columns:
        return {"data": {}, "interpretation": "Grade data not available."}
    dist = active.groupby(col).size().sort_values(ascending=False)
    data = {str(k): int(v) for k, v in dist.items()}
    return {"data": data, "interpretation": f"Grade distribution: {dist.index[0]} is largest ({int(dist.iloc[0])})."}


def _countries(params: dict) -> dict:
    _, active, _ = _get_data()
    if "country" not in active.columns:
        return {"data": {}, "interpretation": "Country data not available."}
    dist = active.groupby("country").size().sort_values(ascending=False)
    data = {str(k): int(v) for k, v in dist.items()}
    return {"data": data, "interpretation": f"Active across {len(dist)} countries. Top: {dist.index[0]} ({int(dist.iloc[0])})."}


def _business_units(params: dict) -> dict:
    _, active, _ = _get_data()
    dist = active.groupby("business_unit_name").size().sort_values(ascending=False)
    data = {str(k): int(v) for k, v in dist.items()}
    return {"data": data, "interpretation": f"{len(dist)} business units. Largest: {dist.index[0]} ({int(dist.iloc[0])})."}


def _careers(params: dict) -> dict:
    _, active, _ = _get_data()
    data = {
        "avg_role_changes": round(float(active["num_role_changes"].mean()), 1),
        "avg_time_in_role_days": int(active["time_in_current_role_days"].mean()),
        "stuck_3yr": int((active["time_in_current_role_days"] > 1095).sum()),
        "stuck_5yr": int((active["time_in_current_role_days"] > 1825).sum()),
    }
    if "num_actual_title_changes" in active.columns:
        promoted = active[active["num_actual_title_changes"] > 0]
        data["promoted_count"] = len(promoted)
        data["promoted_pct"] = round(len(promoted) / len(active) * 100, 1)
    return {
        "data": data,
        "interpretation": f"Avg {data['avg_role_changes']} role changes. {data['stuck_3yr']} stuck 3+ years.",
        "benchmark": "Typical promotion velocity: 2-3 years per level.",
    }


def _managers(params: dict) -> dict:
    from ..data_loader import get_manager_span
    span = get_manager_span()
    data = {
        "total_managers": len(span),
        "avg_span": round(float(span["direct_reports"].mean()), 1),
        "max_span": int(span["direct_reports"].max()),
        "single_report": int((span["direct_reports"] == 1).sum()),
        "overloaded_10plus": int((span["direct_reports"] >= 10).sum()),
    }
    return {
        "data": data,
        "interpretation": f"{data['total_managers']} managers, avg span {data['avg_span']}.",
        "benchmark": "Optimal span of control: 5-8 direct reports.",
    }


def _flight_risk(params: dict) -> dict:
    try:
        from ..routers.predictions import compute_flight_risk_sync
        top_n = params.get("top_n", 10)
        risks = compute_flight_risk_sync(top_n=top_n)
        return {
            "data": risks[:top_n] if risks else [],
            "interpretation": f"Top {top_n} flight risks computed via ML model.",
        }
    except Exception as e:
        return {"data": [], "interpretation": f"Flight risk unavailable: {e}"}


def _gini(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None:
        return {"data": None, "interpretation": "Recognition data not loaded."}
    from ..recognition_loader import compute_gini
    rcounts = rdf["recipient_title"].value_counts()
    gini = round(compute_gini(rcounts.values.tolist()), 3)
    return {
        "data": {"gini_coefficient": gini},
        "interpretation": f"Gini coefficient: {gini}. {'Healthy' if gini < 0.3 else 'Moderate inequality' if gini < 0.5 else 'High concentration'}.",
        "benchmark": "Below 0.3 = healthy. 0.3-0.5 = moderate. Above 0.5 = concentrated.",
    }


def _categories(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None or "category_name" not in rdf.columns:
        return {"data": {}, "interpretation": "Category data not available."}
    cats = rdf["category_name"].value_counts()
    total = len(rdf)
    data = {str(k): {"count": int(v), "pct": round(v / total * 100, 1)} for k, v in cats.items()}
    return {"data": data, "interpretation": f"{len(cats)} categories. Largest: {cats.index[0]} ({round(cats.iloc[0]/total*100,1)}%)."}


def _specificity(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None:
        return {"data": None, "interpretation": "Recognition data not loaded."}
    data = {
        "avg": round(float(rdf["specificity"].mean()), 3),
        "median": round(float(rdf["specificity"].median()), 3),
    }
    if "specificity_band" in rdf.columns:
        band_dist = rdf["specificity_band"].value_counts()
        data["bands"] = {str(k): int(v) for k, v in band_dist.items()}
    return {
        "data": data,
        "interpretation": f"Avg specificity: {data['avg']}/1.0. {'Low - mostly vague praise' if data['avg'] < 0.3 else 'Moderate' if data['avg'] < 0.5 else 'Good specificity'}.",
    }


def _flow_direction(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None or "direction" not in rdf.columns:
        return {"data": {}, "interpretation": "Direction data not available."}
    total = len(rdf)
    direction = rdf["direction"].value_counts()
    data = {str(k): {"count": int(v), "pct": round(v / total * 100, 1)} for k, v in direction.items()}
    cross = round(float((~rdf.get("same_function", pd.Series(True))).mean() * 100), 1) if "same_function" in rdf.columns else 0
    data["cross_function_pct"] = cross
    return {"data": data, "interpretation": f"Recognition flow: {', '.join(f'{k} {v}' for k, v in direction.items())}. Cross-function: {cross}%."}


def _fairness(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None:
        return {"data": None, "interpretation": "Recognition data not loaded."}
    result = {}
    if "recipient_function" in rdf.columns:
        func_counts = rdf["recipient_function"].value_counts()
        result["by_function"] = {str(k): int(v) for k, v in func_counts.items()}
    if "recipient_seniority" in rdf.columns:
        sen_counts = rdf["recipient_seniority"].value_counts()
        result["by_seniority"] = {str(k): int(v) for k, v in sen_counts.items()}
    return {"data": result, "interpretation": "Fairness breakdown by function and seniority."}


def _nominators(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None:
        return {"data": [], "interpretation": "Recognition data not loaded."}
    limit = params.get("limit", 10)
    nom_counts = rdf["nominator_title"].value_counts().head(limit)
    data = [{"role": str(k), "awards_given": int(v)} for k, v in nom_counts.items()]
    return {"data": data, "interpretation": f"Top {limit} nominators by volume."}


def _compare(params: dict) -> dict:
    groups = params.get("groups", [])
    group_by = params.get("group_by", "department_name")
    emp, active, _ = _get_data()
    if not groups or group_by not in emp.columns:
        return {"data": {}, "interpretation": "Specify groups and group_by for comparison."}

    result = {}
    for g in groups:
        subset = emp[emp[group_by] == g]
        if subset.empty:
            result[g] = {"error": "not found"}
            continue
        result[g] = {
            "total": len(subset),
            "active": int(subset["is_active"].sum()),
            "turnover_pct": round((~subset["is_active"]).mean() * 100, 1),
            "avg_tenure": round(float(subset["tenure_years"].mean()), 1),
        }
    return {"data": result, "interpretation": f"Comparison of {', '.join(groups)} by {group_by}."}


def _top_roles(params: dict) -> dict:
    _, active, _ = _get_data()
    col = "current_job_title" if "current_job_title" in active.columns else "job_title"
    if col not in active.columns:
        return {"data": {}, "interpretation": "Job title data not available."}
    limit = params.get("limit", 10)
    top = active[col].value_counts().head(limit)
    data = {str(k): int(v) for k, v in top.items()}
    return {"data": data, "interpretation": f"Top {limit} roles by headcount."}


def _award_types(params: dict) -> dict:
    rdf = _get_recognition()
    if rdf is None or "award_type" not in rdf.columns:
        return {"data": {}, "interpretation": "Award type data not available."}
    dist = rdf["award_type"].value_counts()
    data = {str(k): int(v) for k, v in dist.items()}
    return {"data": data, "interpretation": f"{len(dist)} award types. Most common: {dist.index[0]} ({int(dist.iloc[0])})."}


def _cohort_retention(params: dict) -> dict:
    emp, _, _ = _get_data()
    if "hire_year" not in emp.columns:
        return {"data": {}, "interpretation": "Hire year data not available."}
    years = sorted(emp["hire_year"].dropna().unique())[-5:]
    data = {}
    for year in years:
        cohort = emp[emp["hire_year"] == year]
        ct = len(cohort)
        retained = int(cohort["is_active"].sum())
        data[str(int(year))] = {"hired": ct, "retained": retained, "retention_pct": round(retained / ct * 100, 1) if ct else 0}
    return {"data": data, "interpretation": "Cohort retention for last 5 hire years."}
