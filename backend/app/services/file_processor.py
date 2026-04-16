"""File Processor — Parse CSV/PDF/Image uploads for pipeline."""

import pandas as pd
import json
from pathlib import Path
from typing import Any, Dict, Tuple

async def process_csv(file_content: bytes, filename: str) -> Dict[str, Any]:
    """Parse CSV and return summary."""
    try:
        df = pd.read_csv(pd.io.common.BytesIO(file_content))
        return {
            "status": "success",
            "filename": filename,
            "type": "csv",
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns),
            "preview": df.head(3).to_dict('records'),
            "size_mb": len(file_content) / 1024 / 1024,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "filename": filename,
        }

async def process_file(file_content: bytes, filename: str, filetype: str) -> Dict[str, Any]:
    """Route file processing based on type."""
    if filetype == "csv" or filename.endswith(".csv"):
        return await process_csv(file_content, filename)
    
    if filetype == "pdf" or filename.endswith(".pdf"):
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_content, filetype="pdf")
            text = "\n".join([page.get_text() for page in doc])
            return {
                "status": "success",
                "filename": filename,
                "type": "pdf",
                "pages": len(doc),
                "text_length": len(text),
                "preview": text[:500],
            }
        except Exception as e:
            return {"status": "error", "error": str(e), "filename": filename}
    
    if filetype in ["jpg", "png", "jpeg"] or any(filename.endswith(ext) for ext in [".jpg", ".png", ".jpeg"]):
        return {
            "status": "success",
            "filename": filename,
            "type": "image",
            "note": "Image uploaded. Ready for vision analysis.",
        }
    
    return {
        "status": "unsupported",
        "filename": filename,
        "supported_types": ["csv", "pdf", "jpg", "png", "xlsx"],
    }
