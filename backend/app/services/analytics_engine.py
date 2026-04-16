"""Analytics Engine — Compute KPIs on demand for the agent."""

import pandas as pd
import numpy as np
from typing import Any, Dict, Optional

class AnalyticsEngine:
    """Query interface for live KPI computation."""
    
    def __init__(self, data_cache: Dict[str, Any]):
        self.data_cache = data_cache
    
    def query(self, query_type: str, **params) -> Dict[str, Any]:
        """Execute analytics query and return structured data."""
        emp_df = self.data_cache.get("employees")
        if emp_df is None or len(emp_df) == 0:
            return {"error": "No workforce data loaded"}
        
        if query_type == "headcount_summary":
            active = emp_df["is_active"].sum()
            return {
                "total": len(emp_df),
                "active": int(active),
                "departed": int(len(emp_df) - active),
                "turnover_rate": round(100 * (len(emp_df) - active) / len(emp_df), 1)
            }
        
        if query_type == "headcount_by_dept":
            by_dept = emp_df[emp_df["is_active"]].groupby("department_name").size().sort_values(ascending=False)
            return {dept: int(count) for dept, count in by_dept.items()}
        
        if query_type == "headcount_by_grade":
            by_grade = emp_df[emp_df["is_active"]].groupby("grade_title").size().sort_values(ascending=False)
            return {grade: int(count) for grade, count in by_grade.head(15).items()}
        
        if query_type == "tenure_summary":
            active_emp = emp_df[emp_df["is_active"]]
            return {
                "avg_years": round(active_emp["tenure_years"].mean(), 2),
                "median_years": round(active_emp["tenure_years"].median(), 2),
                "min_years": round(active_emp["tenure_years"].min(), 2),
                "max_years": round(active_emp["tenure_years"].max(), 2),
            }
        
        if query_type == "tenure_cohorts":
            active_emp = emp_df[emp_df["is_active"]]
            tenure = active_emp["tenure_years"]
            return {
                "<1yr": int((tenure < 1).sum()),
                "1-2yr": int(((tenure >= 1) & (tenure < 2)).sum()),
                "2-5yr": int(((tenure >= 2) & (tenure < 5)).sum()),
                "5-10yr": int(((tenure >= 5) & (tenure < 10)).sum()),
                "10+yr": int((tenure >= 10).sum()),
            }
        
        if query_type == "promotion_stats":
            hist_df = self.data_cache.get("history", pd.DataFrame())
            if len(hist_df) == 0:
                return {}
            moves_per_person = hist_df.groupby("pk_user").size()
            return {
                "avg_role_changes": round(moves_per_person.mean(), 2),
                "employees_promoted": int((moves_per_person > 1).sum()),
                "promotion_rate_pct": round(100 * (moves_per_person > 1).sum() / len(moves_per_person), 1),
            }
        
        if query_type == "manager_span":
            span_df = self.data_cache.get("manager_span")
            if span_df is not None:
                return {
                    "avg_direct_reports": round(span_df["direct_reports"].mean(), 2),
                    "median_direct_reports": int(span_df["direct_reports"].median()),
                    "max_direct_reports": int(span_df["direct_reports"].max()),
                }
            return {}
        
        if query_type == "recognition_summary":
            rec_kpis = self.data_cache.get("recognition_kpis", {})
            return {
                "total_awards": rec_kpis.get("total_awards", 0),
                "unique_recipients": rec_kpis.get("unique_recipients", 0),
                "unique_nominators": rec_kpis.get("unique_nominators", 0),
                "avg_specificity": round(rec_kpis.get("avg_specificity", 0), 3),
            }
        
        return {"error": f"Unknown query type: {query_type}"}

_analytics_engine: Optional[AnalyticsEngine] = None

def get_analytics_engine(data_cache: Dict[str, Any]) -> AnalyticsEngine:
    global _analytics_engine
    if _analytics_engine is None:
        _analytics_engine = AnalyticsEngine(data_cache)
    return _analytics_engine
