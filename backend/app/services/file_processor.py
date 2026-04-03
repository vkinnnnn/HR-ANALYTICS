"""
File Processor — Parses uploaded files and returns text summaries.

Supports CSV, Excel, PDF, Word, images, and plain text.
"""

import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


async def process_file(content: bytes, filename: str) -> str:
    """Parse a file and return a human-readable summary."""
    ext = Path(filename).suffix.lower()

    processors = {
        ".csv": _process_csv,
        ".xlsx": _process_excel,
        ".xls": _process_excel,
        ".pdf": _process_pdf,
        ".docx": _process_docx,
        ".txt": _process_text,
        ".md": _process_text,
        ".json": _process_text,
        ".png": _process_image,
        ".jpg": _process_image,
        ".jpeg": _process_image,
    }

    processor = processors.get(ext)
    if processor is None:
        return f"Unsupported file type: {ext}. Supported: {', '.join(processors.keys())}"

    try:
        return await processor(content, filename)
    except Exception as e:
        logger.error(f"File processing failed for {filename}: {e}")
        return f"Error processing {filename}: {str(e)}"


async def _process_csv(content: bytes, filename: str) -> str:
    import pandas as pd
    df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    rows, cols = df.shape
    col_info = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        nulls = int(df[col].isna().sum())
        unique = int(df[col].nunique())
        col_info.append(f"  - {col} ({dtype}): {unique} unique, {nulls} nulls")

    sample = df.head(3).to_string(index=False)
    return (
        f"CSV file: {filename}\n"
        f"Rows: {rows}, Columns: {cols}\n\n"
        f"Columns:\n" + "\n".join(col_info) + "\n\n"
        f"Sample rows:\n{sample}"
    )


async def _process_excel(content: bytes, filename: str) -> str:
    import pandas as pd
    xls = pd.ExcelFile(io.BytesIO(content))
    sheets = xls.sheet_names
    parts = [f"Excel file: {filename}", f"Sheets: {', '.join(sheets)}"]
    for sheet in sheets[:5]:
        df = pd.read_excel(xls, sheet_name=sheet)
        parts.append(f"\nSheet '{sheet}': {df.shape[0]} rows x {df.shape[1]} cols")
        parts.append(f"Columns: {', '.join(str(c) for c in df.columns)}")
    return "\n".join(parts)


async def _process_pdf(content: bytes, filename: str) -> str:
    import fitz
    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []
    for page_num in range(min(doc.page_count, 10)):
        page = doc[page_num]
        text_parts.append(page.get_text())
    doc.close()
    full_text = "\n".join(text_parts).strip()
    if len(full_text) > 5000:
        full_text = full_text[:5000] + "\n... (truncated)"
    return f"PDF: {filename} ({doc.page_count} pages)\n\n{full_text}"


async def _process_docx(content: bytes, filename: str) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs)
    if len(full_text) > 5000:
        full_text = full_text[:5000] + "\n... (truncated)"
    return f"Word document: {filename} ({len(paragraphs)} paragraphs)\n\n{full_text}"


async def _process_text(content: bytes, filename: str) -> str:
    text = content.decode("utf-8", errors="replace")
    if len(text) > 5000:
        text = text[:5000] + "\n... (truncated)"
    return f"Text file: {filename} ({len(text)} chars)\n\n{text}"


async def _process_image(content: bytes, filename: str) -> str:
    from PIL import Image
    img = Image.open(io.BytesIO(content))
    return (
        f"Image: {filename}\n"
        f"Size: {img.width}x{img.height}\n"
        f"Format: {img.format}\n"
        f"Mode: {img.mode}\n\n"
        f"Note: For image content analysis, please describe what you'd like to know about the image."
    )
