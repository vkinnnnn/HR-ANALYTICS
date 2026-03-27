"""
Organizational Structure & Restructuring Analytics Router
"""

from fastapi import APIRouter, Query
import pandas as pd
import numpy as np

from ..data_loader import get_employees, get_history, get_manager_span, get_current_managers

router = APIRouter()


@router.get("/summary")
async def org_summary():
    """Total departments, business units, functions, avg/max dept size."""
    emp = get_employees()
    active = emp[emp["is_active"]]

    total_departments = int(active["department_name"].nunique())
    total_business_units = int(active["business_unit_name"].nunique())
    total_functions = int(active["function_title"].nunique())

    dept_sizes = active.groupby("department_name").size()
    avg_dept_size = round(dept_sizes.mean(), 1) if len(dept_sizes) > 0 else 0.0
    max_dept_size = int(dept_sizes.max()) if len(dept_sizes) > 0 else 0
    max_dept_name = dept_sizes.idxmax() if len(dept_sizes) > 0 else ""

    return {
        "total_departments": total_departments,
        "total_business_units": total_business_units,
        "total_functions": total_functions,
        "avg_department_size": avg_dept_size,
        "max_department_size": max_dept_size,
        "largest_department": max_dept_name,
        "total_active_employees": len(active),
    }


@router.get("/department-sizes")
async def department_sizes():
    """Headcount per department for active employees, sorted descending."""
    emp = get_employees()
    active = emp[emp["is_active"]]

    sizes = (
        active.groupby("department_name")
        .size()
        .reset_index(name="headcount")
        .rename(columns={"department_name": "department"})
        .sort_values("headcount", ascending=False)
    )

    return {
        "total_departments": len(sizes),
        "departments": sizes.to_dict(orient="records"),
    }


@router.get("/department-growth")
async def department_growth():
    """For each department, headcount at each year (from hire dates), show growth timeline."""
    emp = get_employees()

    emp_with_year = emp.dropna(subset=["Hire"]).copy()
    emp_with_year["hire_year"] = emp_with_year["Hire"].dt.year.astype(int)

    if emp_with_year.empty:
        return {"departments": []}

    min_year = int(emp_with_year["hire_year"].min())
    max_year = int(emp_with_year["hire_year"].max())
    all_years = list(range(min_year, max_year + 1))

    departments = emp_with_year["department_name"].dropna().unique().tolist()

    result = []
    for dept in sorted(departments):
        dept_emp = emp_with_year[emp_with_year["department_name"] == dept]
        timeline = []

        for year in all_years:
            # Headcount at end of year: hired on or before year-end AND
            # (not expired OR expired after year-end)
            year_end = pd.Timestamp(year, 12, 31)
            active_at_year = dept_emp[
                (dept_emp["Hire"] <= year_end)
                & (dept_emp["Expire"].isna() | (dept_emp["Expire"] > year_end))
            ]
            timeline.append({"year": year, "headcount": len(active_at_year)})

        result.append({
            "department": dept,
            "timeline": timeline,
        })

    return {"departments": result}


@router.get("/restructuring")
async def restructuring():
    """Detect months with unusually high role changes (>2 std dev above mean)."""
    hist = get_history()

    hist_dated = hist.dropna(subset=["effective_start_date"]).copy()
    hist_dated["month"] = hist_dated["effective_start_date"].dt.to_period("M")

    monthly_counts = hist_dated.groupby("month").size().reset_index(name="role_changes")
    monthly_counts["month_str"] = monthly_counts["month"].astype(str)

    if monthly_counts.empty:
        return {"anomalous_months": [], "mean": 0, "std": 0, "threshold": 0}

    mean_changes = float(monthly_counts["role_changes"].mean())
    std_changes = float(monthly_counts["role_changes"].std())
    threshold = mean_changes + 2 * std_changes

    anomalous = monthly_counts[monthly_counts["role_changes"] > threshold].copy()
    anomalous = anomalous.sort_values("role_changes", ascending=False)

    anomalous_list = []
    for _, row in anomalous.iterrows():
        anomalous_list.append({
            "month": row["month_str"],
            "role_changes": int(row["role_changes"]),
            "z_score": round((row["role_changes"] - mean_changes) / std_changes, 2) if std_changes > 0 else 0.0,
        })

    return {
        "anomalous_months": anomalous_list,
        "mean_monthly_changes": round(mean_changes, 1),
        "std_monthly_changes": round(std_changes, 1),
        "threshold": round(threshold, 1),
        "total_months_analyzed": len(monthly_counts),
    }


@router.get("/hierarchy")
async def hierarchy():
    """Hierarchy depth estimation via iterative manager chain lookup."""
    current_mgr = get_current_managers()

    # Build a lookup: employee -> manager
    mgr_map = dict(zip(current_mgr["pk_user"], current_mgr["fk_direct_manager"]))

    depths = {}
    for employee in mgr_map:
        depth = 0
        current = employee
        visited = set()
        while current in mgr_map and current not in visited:
            visited.add(current)
            current = mgr_map[current]
            depth += 1
            if depth > 50:  # safety limit
                break
        depths[employee] = depth

    if not depths:
        return {"depth_distribution": [], "max_depth": 0, "avg_depth": 0}

    depth_series = pd.Series(depths)
    distribution = (
        depth_series.value_counts()
        .sort_index()
        .reset_index()
    )
    distribution.columns = ["depth", "count"]

    return {
        "depth_distribution": distribution.to_dict(orient="records"),
        "max_depth": int(depth_series.max()),
        "avg_depth": round(float(depth_series.mean()), 2),
        "median_depth": round(float(depth_series.median()), 1),
        "total_employees": len(depths),
    }


@router.get("/layers")
async def layers():
    """Business unit -> department -> function breakdown with counts."""
    emp = get_employees()
    active = emp[emp["is_active"]]

    breakdown = (
        active.groupby(["business_unit_name", "department_name", "function_title"])
        .size()
        .reset_index(name="headcount")
    )

    # Build nested structure
    tree = {}
    for _, row in breakdown.iterrows():
        bu = row["business_unit_name"] if pd.notna(row["business_unit_name"]) else "Unknown"
        dept = row["department_name"] if pd.notna(row["department_name"]) else "Unknown"
        func = row["function_title"] if pd.notna(row["function_title"]) else "Unknown"
        count = int(row["headcount"])

        if bu not in tree:
            tree[bu] = {"headcount": 0, "departments": {}}
        tree[bu]["headcount"] += count

        if dept not in tree[bu]["departments"]:
            tree[bu]["departments"][dept] = {"headcount": 0, "functions": {}}
        tree[bu]["departments"][dept]["headcount"] += count

        tree[bu]["departments"][dept]["functions"][func] = count

    # Convert to list format
    layers_list = []
    for bu_name, bu_data in sorted(tree.items(), key=lambda x: -x[1]["headcount"]):
        dept_list = []
        for dept_name, dept_data in sorted(bu_data["departments"].items(), key=lambda x: -x[1]["headcount"]):
            func_list = [
                {"function": fn, "headcount": hc}
                for fn, hc in sorted(dept_data["functions"].items(), key=lambda x: -x[1])
            ]
            dept_list.append({
                "department": dept_name,
                "headcount": dept_data["headcount"],
                "functions": func_list,
            })
        layers_list.append({
            "business_unit": bu_name,
            "headcount": bu_data["headcount"],
            "departments": dept_list,
        })

    return {
        "total_business_units": len(tree),
        "layers": layers_list,
    }
