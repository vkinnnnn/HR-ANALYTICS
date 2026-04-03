"""
Report Generator — Produces structured executive reports from analytics data.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ReportSection:
    title: str
    content: str
    priority: str = "medium"


@dataclass
class ReportResult:
    title: str
    report_type: str
    sections: list[dict[str, str]] = field(default_factory=list)
    summary: str = ""


async def generate_report(
    report_type: str, params: dict[str, Any] | None = None
) -> ReportResult:
    """Generate a structured report."""
    params = params or {}
    generators = {
        "executive_summary": _executive_summary,
        "turnover_report": _turnover_report,
        "recognition_audit": _recognition_audit,
        "department_deep_dive": _department_deep_dive,
    }

    gen = generators.get(report_type, _executive_summary)
    return await gen(params)


async def _executive_summary(params: dict) -> ReportResult:
    from .analytics_engine import query_analytics

    summary = query_analytics("summary")
    tenure = query_analytics("tenure")
    careers = query_analytics("careers")
    managers = query_analytics("managers")

    data = summary.get("data", {})
    t_data = tenure.get("data", {})
    c_data = careers.get("data", {})
    m_data = managers.get("data", {})

    sections = [
        {
            "title": "Headline",
            "content": (
                f"Workforce of **{data.get('total_employees', 0)}** employees with "
                f"**{data.get('turnover_rate', 0)}%** turnover rate. "
                f"Average tenure **{t_data.get('avg_all', 0)}** years."
            ),
            "priority": "critical",
        },
        {
            "title": "Workforce Composition",
            "content": (
                f"Active: {data.get('active', 0)} | Departed: {data.get('departed', 0)}. "
                f"Across {data.get('departments', 0)} departments and {data.get('countries', 0)} countries."
            ),
            "priority": "high",
        },
        {
            "title": "Career Mobility",
            "content": (
                f"Average {c_data.get('avg_role_changes', 0)} role changes per employee. "
                f"{c_data.get('stuck_3yr', 0)} employees stuck 3+ years in same role."
            ),
            "priority": "high",
        },
        {
            "title": "Manager Effectiveness",
            "content": (
                f"{m_data.get('total_managers', 0)} managers with average span of "
                f"{m_data.get('avg_span', 0)} direct reports."
            ),
            "priority": "medium",
        },
    ]

    # Add recognition section if available
    if data.get("gini_coefficient") is not None:
        sections.append({
            "title": "Recognition Health",
            "content": (
                f"Gini coefficient: **{data.get('gini_coefficient', 'N/A')}**. "
                f"Average message specificity: {data.get('avg_specificity', 'N/A')}/1.0."
            ),
            "priority": "high",
        })

    sections.append({
        "title": "Recommendations",
        "content": _generate_recommendations(data, c_data, m_data),
        "priority": "critical",
    })

    return ReportResult(
        title="Executive Workforce Summary",
        report_type="executive_summary",
        sections=sections,
        summary=f"Workforce health report covering {data.get('total_employees', 0)} employees.",
    )


async def _turnover_report(params: dict) -> ReportResult:
    from .analytics_engine import query_analytics

    turnover = query_analytics("turnover", {"group_by": "department_name"})
    cohort = query_analytics("cohort_retention")

    sections = [
        {"title": "Overall Turnover", "content": turnover.get("interpretation", ""), "priority": "critical"},
        {"title": "Department Breakdown", "content": json.dumps(turnover.get("data", {}), indent=2), "priority": "high"},
        {"title": "Cohort Retention", "content": cohort.get("interpretation", ""), "priority": "high"},
    ]

    return ReportResult(
        title="Turnover Analysis Report",
        report_type="turnover_report",
        sections=sections,
        summary="Detailed turnover analysis by department and cohort.",
    )


async def _recognition_audit(params: dict) -> ReportResult:
    from .analytics_engine import query_analytics

    gini = query_analytics("gini")
    cats = query_analytics("categories")
    spec = query_analytics("specificity")
    flow = query_analytics("flow_direction")

    sections = [
        {"title": "Recognition Equality", "content": gini.get("interpretation", ""), "priority": "critical"},
        {"title": "Category Distribution", "content": cats.get("interpretation", ""), "priority": "high"},
        {"title": "Message Quality", "content": spec.get("interpretation", ""), "priority": "high"},
        {"title": "Recognition Flow", "content": flow.get("interpretation", ""), "priority": "medium"},
    ]

    return ReportResult(
        title="Recognition Audit Report",
        report_type="recognition_audit",
        sections=sections,
        summary="Recognition program health audit.",
    )


async def _department_deep_dive(params: dict) -> ReportResult:
    department = params.get("department", "")
    from .analytics_engine import query_analytics

    compare = query_analytics("compare", {"groups": [department], "group_by": "department_name"})

    sections = [
        {"title": f"{department} Overview", "content": json.dumps(compare.get("data", {}), indent=2), "priority": "high"},
    ]

    return ReportResult(
        title=f"Department Deep Dive: {department}",
        report_type="department_deep_dive",
        sections=sections,
        summary=f"Detailed analysis of {department}.",
    )


def _generate_recommendations(summary: dict, careers: dict, managers: dict) -> str:
    recs = []
    tr = summary.get("turnover_rate", 0)
    if tr > 20:
        recs.append("**[Critical]** Turnover rate significantly exceeds industry benchmark (15-20%). Conduct exit interview analysis and retention program review.")
    elif tr > 15:
        recs.append("**[High]** Turnover approaching industry ceiling. Investigate department-level drivers.")

    stuck = careers.get("stuck_3yr", 0)
    if stuck > 50:
        recs.append(f"**[High]** {stuck} employees stuck 3+ years — implement career pathing and development conversations.")

    overloaded = managers.get("overloaded_10plus", 0)
    if overloaded > 0:
        recs.append(f"**[Medium]** {overloaded} managers with 10+ direct reports — evaluate team restructuring.")

    if not recs:
        recs.append("No critical risks detected. Continue monitoring key metrics quarterly.")

    return "\n".join(f"- {r}" for r in recs)
