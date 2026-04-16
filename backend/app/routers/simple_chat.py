"""Simple, reliable chat endpoint - no async complexity."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import logging

from ..services.analytics_engine import get_analytics_engine
from ..data_loader import is_loaded, get_employees, _data_cache

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    conversation_id: Optional[str] = None
    current_page: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    suggestions: list = []

@router.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    """Simple chat endpoint - returns analytics based on user question."""

    if not request.message or len(request.message.strip()) == 0:
        return ChatResponse(
            response="Please ask me about your workforce. Try: 'How many employees?' or 'What's our turnover rate?'",
            suggestions=["How many employees?", "What's our turnover?", "Show me by department"]
        )

    if not is_loaded():
        return ChatResponse(
            response="Workforce data not loaded. Please upload CSV files first.",
            suggestions=[]
        )

    try:
        # Initialize analytics engine
        analytics = get_analytics_engine({
            "employees": get_employees(),
            "history": _data_cache.get("history"),
            "manager_span": _data_cache.get("manager_span"),
        })

        msg = request.message.lower()

        # Route to appropriate query
        if "headcount" in msg or "how many" in msg or "total" in msg:
            result = analytics.query("headcount_summary")
            response = f"**Workforce Headcount**\n\n"
            response += f"• Total: {result.get('total', 0):,}\n"
            response += f"• Active: {result.get('active', 0):,}\n"
            response += f"• Departed: {result.get('departed', 0):,}\n"
            response += f"• Turnover Rate: {result.get('turnover_rate', 0):.1f}%"

        elif "department" in msg or "by dept" in msg:
            result = analytics.query("headcount_by_dept")
            response = "**Headcount by Department**\n\n"
            for dept, count in sorted(result.items(), key=lambda x: x[1], reverse=True)[:5]:
                response += f"• {dept}: {count:,}\n"
            response += "\nTop 5 departments shown."

        elif "turnover" in msg or "attrition" in msg:
            result = analytics.query("headcount_summary")
            response = f"**Turnover Analysis**\n\n"
            response += f"• Turnover Rate: {result.get('turnover_rate', 0):.1f}%\n"
            response += f"• Departed Employees: {result.get('departed', 0):,}\n"
            response += f"• Active Employees: {result.get('active', 0):,}"

        elif "tenure" in msg:
            result = analytics.query("tenure_summary")
            response = "**Tenure Analysis**\n\n"
            response += f"• Average: {result.get('avg_years', 0):.1f} years\n"
            response += f"• Median: {result.get('median_years', 0):.1f} years\n"
            response += f"• Min: {result.get('min_years', 0):.1f} years\n"
            response += f"• Max: {result.get('max_years', 0):.1f} years"

        elif "promotion" in msg or "career" in msg:
            result = analytics.query("promotion_stats")
            response = "**Career Progression**\n\n"
            response += f"• Employees Promoted: {result.get('employees_promoted', 0):,}\n"
            response += f"• Promotion Rate: {result.get('promotion_rate_pct', 0):.1f}%\n"
            response += f"• Avg Role Changes: {result.get('avg_role_changes', 0):.2f}"

        elif "manager" in msg or "span" in msg:
            result = analytics.query("manager_span")
            response = "**Manager Analytics**\n\n"
            response += f"• Avg Direct Reports: {result.get('avg_direct_reports', 0):.1f}\n"
            response += f"• Median Direct Reports: {result.get('median_direct_reports', 0)}\n"
            response += f"• Max Direct Reports: {result.get('max_direct_reports', 0)}"

        else:
            # Default: show summary
            result = analytics.query("headcount_summary")
            response = f"**Workforce Summary**\n\n"
            response += f"Total Employees: {result.get('total', 0):,}\n"
            response += f"Active: {result.get('active', 0):,}\n"
            response += f"Turnover Rate: {result.get('turnover_rate', 0):.1f}%\n\n"
            response += "Ask me about: headcount, departments, turnover, tenure, promotions, or managers."

        suggestions = [
            "How many employees?",
            "What's our turnover?",
            "Show me by department",
            "Tell me about tenure"
        ]

        logger.info(f"Chat response for {request.user_id}: {len(response)} chars")
        return ChatResponse(response=response, suggestions=suggestions)

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            response=f"Error processing request: {str(e)}",
            suggestions=[]
        )
