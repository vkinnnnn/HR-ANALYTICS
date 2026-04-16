"""Reports Router — Executive summaries, KPI exports, and downloadables."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from ..data_loader import get_employees, get_history, _data_cache, is_loaded
from ..services.report_generator import get_report_generator

router = APIRouter()

class ExportRequest(BaseModel):
    format: str = "json"  # json, csv, pdf
    report_type: str = "executive"  # executive, kpis, department, manager

@router.get("/summary")
async def get_executive_summary() -> Dict[str, str]:
    """Get executive summary narrative."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    summary = generator.generate_executive_summary()
    return {"summary": summary}

@router.get("/kpis")
async def get_kpis_export() -> Dict[str, Any]:
    """Export all KPIs as structured data."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    kpis = generator.get_kpi_export()
    return kpis

@router.get("/department/{department}")
async def get_department_report(department: str) -> Dict[str, Any]:
    """Get focused report for a specific department."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    report = generator.get_department_report(department)
    
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])
    
    return report

@router.get("/managers")
async def get_managers_report() -> Dict[str, Any]:
    """Get manager effectiveness report."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)
    report = generator.get_manager_report()
    return report

@router.post("/download")
async def download_report(request: ExportRequest) -> Dict[str, str]:
    """Generate downloadable report in requested format."""
    if not is_loaded():
        raise HTTPException(status_code=503, detail="Workforce data not loaded")

    generator = get_report_generator(_data_cache)

    if request.report_type == "executive":
        summary = generator.generate_executive_summary()
        return {"content": summary, "format": request.format, "filename": "executive_summary"}
    
    elif request.report_type == "kpis":
        import json
        kpis = generator.get_kpi_export()
        content = json.dumps(kpis, indent=2) if request.format == "json" else str(kpis)
        return {"content": content, "format": request.format, "filename": "kpis_export"}
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {request.report_type}")
