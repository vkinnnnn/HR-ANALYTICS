"""
Brain Router — Single API surface for the AI chatbot.

Endpoints:
  POST /api/brain/chat     — SSE streaming chat
  POST /api/brain/upload   — File upload + pipeline trigger
  GET  /api/brain/memory   — Retrieve user memories
  DELETE /api/brain/memory  — Clear user memories (GDPR)
  GET  /api/brain/health   — Health check
"""

import json
import os
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class BrainChatRequest(BaseModel):
    message: str
    conversation_id: str = ""
    user_id: str = "anonymous"
    current_page: str = "/"
    conversation_history: list[dict] | None = None


class BrainHealthResponse(BaseModel):
    status: str
    knowledge_docs: int
    pipeline_ready: bool
    llm_connected: bool
    data_loaded: bool


# ── POST /chat ───────────────────────────────────────────────────────

@router.post("/chat")
async def brain_chat(request: BrainChatRequest):
    """Stream a chat response via SSE."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    async def event_stream():
        try:
            from ..services.brain import process_message
            async for chunk_type, content in process_message(
                message=request.message,
                user_id=request.user_id,
                current_page=request.current_page,
                conversation_history=request.conversation_history,
            ):
                if chunk_type == "token":
                    yield f"data: {json.dumps({'token': content})}\n\n"
                elif chunk_type == "done":
                    yield f"data: {json.dumps({'done': True, **content})}\n\n"
        except Exception as e:
            logger.error(f"Brain chat error: {e}")
            yield f"data: {json.dumps({'token': f'Sorry, I encountered an error: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'done': True, 'suggestions': ['Try again', 'Check settings', 'Open data hub']})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── POST /chat/sync ──────────────────────────────────────────────────

@router.post("/chat/sync")
async def brain_chat_sync(request: BrainChatRequest):
    """Non-streaming chat endpoint (fallback)."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    full_response = ""
    metadata = {}

    try:
        from ..services.brain import process_message
        async for chunk_type, content in process_message(
            message=request.message,
            user_id=request.user_id,
            current_page=request.current_page,
            conversation_history=request.conversation_history,
        ):
            if chunk_type == "token":
                full_response += content
            elif chunk_type == "done":
                metadata = content
    except Exception as e:
        logger.error(f"Brain chat sync error: {e}")
        full_response = f"Sorry, I encountered an error: {str(e)}"
        metadata = {"suggestions": ["Try again", "Check settings"]}

    # Clean response text (remove NAVIGATE/SUGGESTIONS markers for display)
    clean = full_response
    if "NAVIGATE:" in clean:
        clean = clean.split("NAVIGATE:")[0].strip()
    if "SUGGESTIONS:" in clean:
        clean = clean.split("SUGGESTIONS:")[0].strip()
    if "```json" in clean:
        try:
            json_start = clean.index("```json")
            json_end = clean.index("```", json_start + 7) + 3
            clean = clean[:json_start].strip()
        except ValueError:
            pass

    return {
        "answer": clean,
        "data": metadata.get("chart_data"),
        "suggestions": metadata.get("suggestions"),
        "navigation": metadata.get("navigation"),
        "analysis_type": metadata.get("analysis_type"),
    }


# ── POST /upload ─────────────────────────────────────────────────────

@router.post("/upload")
async def brain_upload(
    file: UploadFile = File(...),
    user_id: str = Form("anonymous"),
):
    """Upload a file, process it, and optionally trigger the pipeline."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    filename = file.filename

    data_dir = os.environ.get(
        "DATA_DIR",
        os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"),
    )
    os.makedirs(data_dir, exist_ok=True)
    save_path = os.path.join(data_dir, filename)

    with open(save_path, "wb") as f:
        f.write(content)

    async def upload_stream():
        from ..services.file_processor import process_file
        summary = await process_file(content, filename)
        yield f"data: {json.dumps({'stage': 'parsed', 'message': summary})}\n\n"

        if filename.endswith(".csv"):
            from ..services.pipeline_orchestrator import run_full_pipeline

            async def progress_cb(stage: str, message: str, pct: float):
                pass

            result = await run_full_pipeline(save_path, progress_cb)
            yield f"data: {json.dumps({'stage': 'pipeline_complete', 'message': result.summary, 'success': result.success})}\n\n"
        else:
            yield f"data: {json.dumps({'stage': 'file_saved', 'message': f'File saved to {save_path}'})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(upload_stream(), media_type="text/event-stream")


# ── GET /memory ──────────────────────────────────────────────────────

@router.get("/memory/{user_id}")
async def get_memories(user_id: str):
    """Retrieve all memories for a user."""
    from ..services.memory_manager import get_memories as _get
    memories = _get(user_id)
    return {"user_id": user_id, "memories": memories, "count": len(memories)}


# ── DELETE /memory ───────────────────────────────────────────────────

@router.delete("/memory/{user_id}")
async def clear_memories(user_id: str):
    """Clear all memories for a user (GDPR compliance)."""
    from ..services.memory_manager import clear_memories as _clear
    _clear(user_id)
    return {"user_id": user_id, "cleared": True}


# ── GET /health ──────────────────────────────────────────────────────

@router.get("/health", response_model=BrainHealthResponse)
async def brain_health():
    """Health check for the brain subsystem."""
    from ..services.knowledge_base import get_doc_count
    from ..data_loader import is_loaded
    from ..llm import is_llm_available

    return BrainHealthResponse(
        status="ok",
        knowledge_docs=get_doc_count(),
        pipeline_ready=True,
        llm_connected=is_llm_available(),
        data_loaded=is_loaded(),
    )
