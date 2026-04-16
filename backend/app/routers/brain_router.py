"""
app/routers/brain_router.py - SSE-streaming LangGraph agent integration.
"""
import json
import time
import asyncio
import re
from typing import Optional, List
from fastapi import APIRouter, Form, File, UploadFile
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from app.agent.graph import run_query, clear_session

router = APIRouter(tags=["brain"])


class ChatResponse(BaseModel):
    answer: str
    route_used: Optional[str] = None
    hallucination_score: Optional[float] = None
    hallucination_flag: Optional[bool] = None
    was_refused: Optional[bool] = None
    time_taken_seconds: float = 0.0


def generate_suggestions(question: str, route: Optional[str]) -> List[str]:
    """Generate follow-up question suggestions based on query and route."""
    suggestions = []

    q_lower = question.lower()

    # Generic workforce suggestions
    if "headcount" in q_lower:
        suggestions.extend([
            "What's the department distribution?",
            "Show headcount trends",
        ])
    elif "turnover" in q_lower or "attrition" in q_lower:
        suggestions.extend([
            "Which departments have high attrition?",
            "Show tenure at departure",
        ])
    elif "flight risk" in q_lower or "retention" in q_lower:
        suggestions.extend([
            "Who are the top at-risk employees?",
            "What drives retention?",
        ])
    elif "promotion" in q_lower or "career" in q_lower:
        suggestions.extend([
            "Show promotion velocity by department",
            "Who's stuck in the same role?",
        ])
    elif "manager" in q_lower or "span of control" in q_lower:
        suggestions.extend([
            "Which managers have high turnover?",
            "Show span of control distribution",
        ])
    else:
        # Default suggestions
        suggestions = [
            "What's our overall headcount?",
            "Show turnover trends",
            "Who's at flight risk?",
        ]

    return suggestions[:3]  # Return top 3


@router.post("/chat")
async def chat_sse(
    message: str = Form(...),
    session_id: str = Form("default"),
    user_id: str = Form("anonymous"),
    current_page: str = Form("/"),
    files: Optional[List[UploadFile]] = File(None),
):
    """SSE streaming chat endpoint."""

    async def event_generator():
        start = time.time()
        try:
            result = run_query(message, session_id=session_id)
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)})}
            return

        elapsed = time.time() - start
        answer = result.get("answer", "")
        navigation = None
        route = result.get("route_used")
        suggestions = generate_suggestions(message, route)

        if "NAVIGATE:" in answer:
            nav_match = re.search(r"NAVIGATE:(/\S+)", answer)
            if nav_match:
                navigation = nav_match.group(1)
                answer = re.sub(r"NAVIGATE:/\S+", "", answer).strip()

        # Stream answer in chunks
        words = answer.split()
        buffer = ""
        for i, word in enumerate(words):
            buffer += word + " "
            if i % 3 == 2 or i == len(words) - 1:
                yield {"event": "token", "data": json.dumps({"text": buffer})}
                buffer = ""
                await asyncio.sleep(0.01)

        # Send metadata
        yield {
            "event": "done",
            "data": json.dumps({
                "route_used": route,
                "hallucination_score": result.get("hallucination_score"),
                "hallucination_flag": result.get("hallucination_flag"),
                "was_refused": result.get("was_refused"),
                "navigation": navigation,
                "suggestions": suggestions,
                "time_taken": round(elapsed, 2),
            })
        }

    return EventSourceResponse(event_generator())


@router.post("/chat/sync", response_model=ChatResponse)
async def chat_sync(
    message: str = Form(...),
    session_id: str = Form("default"),
):
    """Non-streaming chat endpoint."""
    start = time.time()
    result = run_query(message, session_id=session_id)
    elapsed = time.time() - start

    return ChatResponse(
        answer=result["answer"],
        route_used=result.get("route_used"),
        hallucination_score=result.get("hallucination_score"),
        hallucination_flag=result.get("hallucination_flag"),
        was_refused=result.get("was_refused"),
        time_taken_seconds=round(elapsed, 2),
    )


@router.post("/session/clear")
async def session_clear(session_id: str = "default"):
    """Clear session history."""
    clear_session(session_id)
    return {"status": "ok"}


@router.get("/health")
async def health():
    """Health check."""
    try:
        from app.tools.graph_tool import _get_driver
        neo4j_ok = _get_driver() is not None
    except:
        neo4j_ok = False

    try:
        from app.tools.rag_tool import _get_collection
        chroma_count = _get_collection().count()
    except:
        chroma_count = 0

    return {
        "status": "ok",
        "neo4j": "connected" if neo4j_ok else "fallback",
        "chroma_records": chroma_count,
        "tools": 9,
    }
