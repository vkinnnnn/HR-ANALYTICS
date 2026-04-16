"""Report Generator — Executive summaries and data exports."""

import pandas as pd
import json
from typing import Dict, Any, Optional
from datetime import datetime
from ..utils import serialize_numpy

class ReportGenerator:
    """Generate executive reports and export bundles."""

    def __init__(self, data_cache: Dict[str, Any]):
        self.data_cache = data_cache
        self.emp_df = data_cache.get("employees")
        self.hist_df = data_cache.get("history")
        self.recognition_kpis = data_cache.get("recognition_kpis", {})

    def generate_executive_summary(self) -> str:
        """Generate a narrative executive summary of workforce health."""
        if self.emp_df is None or len(self.emp_df) == 0:
            return "No workforce data available."

        active = self.emp_df["is_active"].sum()
        departed = len(self.emp_df) - active
        turnover_rate = 100 * departed / len(self.emp_df)
        avg_tenure = self.emp_df[self.emp_df["is_active"]]["tenure_years"].mean()

        summary = f"""
WORKFORCE INTELLIGENCE EXECUTIVE SUMMARY
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

HEADCOUNT OVERVIEW
Total Employees: {len(self.emp_df)}
Active: {int(active)}
Departed: {int(departed)}
Turnover Rate: {turnover_rate:.1f}%

TENURE ANALYSIS
Average Tenure (Active): {avg_tenure:.1f} years
Departments: {self.emp_df["department_name"].nunique()}
Grade Levels: {self.emp_df["grade_title"].nunique()}
Locations: {self.emp_df["location_title"].nunique()}

KEY INSIGHTS
- {int(active)} active employees across {self.emp_df["department_name"].nunique()} departments
- Turnover affecting {int(departed)} employee separations ({turnover_rate:.1f}% of workforce)
- Average employee tenure: {avg_tenure:.1f} years
- Career progression opportunities: {self.hist_df["pk_user"].nunique()} employees with recorded history

RECOGNITION ENGAGEMENT (If Applicable)
Total Recognition Awards: {self.recognition_kpis.get('total_awards', 0)}
Unique Recipients: {self.recognition_kpis.get('unique_recipients', 0)}
Unique Nominators: {self.recognition_kpis.get('unique_nominators', 0)}
Average Message Specificity: {self.recognition_kpis.get('avg_specificity', 0):.2f}
"""
        return summary.strip()

    def get_kpi_export(self) -> Dict[str, Any]:
        """Export all computed KPIs as structured data."""
        if self.emp_df is None or len(self.emp_df) == 0:
            return {"error": "No workforce data loaded"}

        active = self.emp_df["is_active"].sum()
        active_emp = self.emp_df[self.emp_df["is_active"]]
        tenure_years = active_emp["tenure_years"]

        result = {
            "export_timestamp": datetime.now().isoformat(),
            "headcount": {
                "total": int(len(self.emp_df)),
                "active": int(active),
                "departed": int(len(self.emp_df) - active),
                "turnover_rate_percent": round(100 * (len(self.emp_df) - active) / len(self.emp_df), 2),
            },
            "tenure": {
                "avg_years": round(active_emp["tenure_years"].mean(), 2),
                "median_years": round(active_emp["tenure_years"].median(), 2),
                "min_years": round(active_emp["tenure_years"].min(), 2),
                "max_years": round(active_emp["tenure_years"].max(), 2),
            },
            "tenure_cohorts": {
                "<1yr": int((tenure_years < 1).sum()),
                "1-3yr": int(((tenure_years >= 1) & (tenure_years < 3)).sum()),
                "3-5yr": int(((tenure_years >= 3) & (tenure_years < 5)).sum()),
                "5-10yr": int(((tenure_years >= 5) & (tenure_years < 10)).sum()),
                "10yr+": int((tenure_years >= 10).sum()),
            },
            "departments": dict(active_emp["department_name"].value_counts()),
            "grades": dict(active_emp["grade_title"].value_counts().head(15)),
            "functions": dict(active_emp["function_title"].value_counts()),
            "locations": dict(active_emp["location_title"].value_counts()),
            "countries": dict(active_emp["country"].value_counts()),
            "career_metrics": {
                "employees_with_promotions": int((self.hist_df.groupby("pk_user").size() > 1).sum()),
                "avg_role_changes": round(self.hist_df.groupby("pk_user").size().mean(), 2),
                "max_role_changes": int(self.hist_df.groupby("pk_user").size().max()),
            },
            "recognition": self.recognition_kpis,
        }
        return serialize_numpy(result)

    def get_department_report(self, department: str) -> Dict[str, Any]:
        """Generate a focused report for a specific department."""
        dept_emp = self.emp_df[self.emp_df["department_name"] == department]
        if len(dept_emp) == 0:
            return {"error": f"Department '{department}' not found"}

        active = dept_emp["is_active"].sum()
        return {
            "department": department,
            "total_employees": int(len(dept_emp)),
            "active": int(active),
            "departed": int(len(dept_emp) - active),
            "turnover_rate": round(100 * (len(dept_emp) - active) / len(dept_emp), 2),
            "avg_tenure": round(dept_emp[dept_emp["is_active"]]["tenure_years"].mean(), 2),
            "grades": dict(dept_emp["grade_title"].value_counts()),
            "functions": dict(dept_emp["function_title"].value_counts()),
            "locations": dict(dept_emp["location_title"].value_counts()),
        }

    def get_manager_report(self, manager_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate a manager effectiveness report."""
        reports = {}
        for mgr_id in [manager_id] if manager_id else self.emp_df["PK_PERSON"].unique():
            reports_to_mgr = self.emp_df[self.emp_df["current_manager_id"] == mgr_id]
            if len(reports_to_mgr) == 0:
                continue

            mgr_name = self.emp_df[self.emp_df["PK_PERSON"] == mgr_id]["job_title"].iloc[0] if len(self.emp_df[self.emp_df["PK_PERSON"] == mgr_id]) > 0 else "Unknown"
            departed_reports = (~reports_to_mgr["is_active"]).sum()

            reports[str(mgr_id)] = {
                "manager_name": str(mgr_name),
                "direct_reports": int(len(reports_to_mgr)),
                "departed_reports": int(departed_reports),
                "retention_rate": round(100 * (1 - departed_reports / len(reports_to_mgr)) if len(reports_to_mgr) > 0 else 0, 2),
                "avg_report_tenure": round(reports_to_mgr[reports_to_mgr["is_active"]]["tenure_years"].mean() if len(reports_to_mgr[reports_to_mgr["is_active"]]) > 0 else 0, 2),
            }

        return {"managers": reports} if reports else {"error": "No manager data found"}


def get_report_generator(data_cache: Dict[str, Any]) -> ReportGenerator:
    """Factory function to create a report generator."""
    return ReportGenerator(data_cache)
