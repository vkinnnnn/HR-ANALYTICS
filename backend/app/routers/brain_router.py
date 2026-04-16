"""Brain Router — Chat API powered by LangGraph agent."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..services.brain import get_brain_agent
from ..services.knowledge_base import rebuild_knowledge_base, search
from ..services.memory_manager import memory_manager
from ..services.report_generator import get_report_generator
from ..data_loader import get_employees, get_recognition, _data_cache, is_loaded, is_recognition_loaded

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    conversation_id: Optional[str] = None
    current_page: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    suggestions: List[str] = []
    data: Optional[Dict[str, Any]] = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Main chat endpoint."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded. Upload a CSV first.")
    
    brain = get_brain_agent({
        "employees": get_employees(),
        "recognition": get_recognition(),
        "history": _data_cache.get("history"),
        "manager_span": _data_cache.get("manager_span"),
        "recognition_kpis": _data_cache.get("recognition_kpis", {})
    })
    
    try:
        response = brain.process_message(
            user_id=request.user_id,
            message=request.message,
            current_page=request.current_page
        )
        
        suggestions = ["Show me headcount by department", "What's our turnover rate?", "Who's at flight risk?"]
        
        return ChatResponse(response=response, suggestions=suggestions[:2])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health() -> Dict[str, Any]:
    """Health check."""
    return {
        "status": "ok",
        "workforce_loaded": is_loaded(),
        "recognition_loaded": is_recognition_loaded(),
        "employees_count": len(get_employees()) if is_loaded() else 0,
    }

@router.get("/memory/{user_id}")
async def get_memory(user_id: str) -> Dict[str, Any]:
    """Retrieve user memories."""
    return {
        "user_id": user_id,
        "memories": memory_manager.get_all(user_id)
    }

@router.delete("/memory/{user_id}")
async def clear_memory(user_id: str) -> Dict[str, str]:
    """Clear user memories (GDPR)."""
    memory_manager.clear(user_id)
    return {"status": "cleared"}

@router.post("/knowledge/rebuild")
async def rebuild_knowledge() -> Dict[str, Any]:
    """Manually rebuild knowledge base."""
    try:
        doc_count = rebuild_knowledge_base(_data_cache)
        return {"status": "rebuilt", "documents_embedded": doc_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report/summary")
async def get_summary_report() -> Dict[str, str]:
    """Get executive summary for chat context."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    summary = generator.generate_executive_summary()
    return {"summary": summary}

@router.get("/report/kpis")
async def get_kpis_report() -> Dict[str, Any]:
    """Get KPIs for chat context and export."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    kpis = generator.get_kpi_export()
    return kpis
