"""Chat streaming endpoint with SSE support."""

import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator

from ..services.brain import get_brain_agent
from ..data_loader import _data_cache, is_loaded, get_employees, get_recognition

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    conversation_id: Optional[str] = None
    current_page: Optional[str] = None

async def stream_response(user_id: str, message: str, current_page: Optional[str]) -> AsyncGenerator[str, None]:
    """Stream chat response as server-sent events."""
    try:
        if not is_loaded():
            yield f"data: {json.dumps({'error': 'Data not loaded'})}\n\n"
            return
        
        # Initialize brain agent
        brain = get_brain_agent({
            "employees": get_employees(),
            "recognition": get_recognition(),
            "history": _data_cache.get("history"),
            "manager_span": _data_cache.get("manager_span"),
            "recognition_kpis": _data_cache.get("recognition_kpis", {})
        })
        
        # Process message
        response = brain.process_message(
            user_id=user_id,
            message=message,
            current_page=current_page
        )
        
        # Stream response token-by-token with SSE format
        buffer = ""
        for char in response:
            buffer += char
            # Send every 10 characters (configurable batching)
            if len(buffer) >= 10 or char in ['.', '!', '?', '\n']:
                yield f"data: {json.dumps({'token': buffer})}\n\n"
                buffer = ""
                await asyncio.sleep(0.01)  # Small delay between tokens
        
        # Send remaining buffer
        if buffer:
            yield f"data: {json.dumps({'token': buffer})}\n\n"
        
        # Send completion signal
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Stream chat response using Server-Sent Events."""
    return StreamingResponse(
        stream_response(request.user_id, request.message, request.current_page),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
