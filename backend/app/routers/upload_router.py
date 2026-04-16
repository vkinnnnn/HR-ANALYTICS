"""Upload Router — Handle file uploads and trigger pipeline."""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
import os

from ..services.file_processor import process_file
from ..services.pipeline_orchestrator import pipeline_orchestrator
from ..services.knowledge_base import rebuild_knowledge_base
from ..data_loader import load_and_process, load_recognition, _data_cache

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process a CSV file."""
    try:
        content = await file.read()
        
        # Determine file type
        filetype = file.filename.split(".")[-1].lower() if file.filename else "unknown"
        
        # Process file
        result = await process_file(content, file.filename, filetype)
        
        if result.get("status") != "success":
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to process file"))
        
        # Save file
        upload_dir = "wh_Dataset"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return {
            "status": "uploaded",
            "filename": file.filename,
            "path": file_path,
            "file_info": result,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pipeline/run")
async def run_pipeline(file_path: str, stages: Optional[list] = None):
    """Run the taxonomy + annotation pipeline."""
    try:
        result = await pipeline_orchestrator.run_full_pipeline(
            file_path,
            progress_callback=None,
        )
        
        if result.get("status") == "success":
            # Rebuild knowledge base
            load_and_process("wh_Dataset")
            load_recognition("wh_Dataset")
            rebuild_knowledge_base(_data_cache)
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pipeline/status")
async def pipeline_status():
    """Check pipeline status."""
    return {
        "status": "ready",
        "last_run": None,
        "next_available": "now",
    }
