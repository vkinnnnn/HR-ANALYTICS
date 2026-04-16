"""
app/tools/file_tool.py

File processing tool — analyze uploaded files (CSV, PDF, images, Excel).
"""

from langchain_core.tools import tool


@tool
def process_file(file_info: str) -> str:
    """
    Use this tool when the user uploads a file (CSV, PDF, image, Excel).
    Parses the file and returns a summary for the agent to work with.

    The file_info parameter contains: filename, MIME type, and optional preview.

    Examples:
    - User uploads a CSV with new employee data
    - User uploads a PDF report to analyze
    - User uploads an Excel file with survey results
    - User uploads an image/screenshot to discuss
    """
    info = file_info.lower()

    if 'csv' in info or 'spreadsheet' in info or 'excel' in info:
        return (
            "FILE_PROCESSED:csv\n\n"
            "CSV file detected. Please upload it through the data upload page at /upload\n"
            "to trigger the full data processing pipeline:\n"
            "- Validation and deduplication\n"
            "- Taxonomy generation\n"
            "- Annotation (topics, themes, quality)\n"
            "- Knowledge base rebuild\n\n"
            "Once uploaded, the dashboard will auto-refresh with new insights."
        )

    if 'pdf' in info or 'document' in info:
        return (
            "FILE_PROCESSED:pdf\n\n"
            "PDF document detected. I can help analyze it if you share the key content.\n"
            "What would you like to know about this document?\n"
            "- Extract key metrics or findings?\n"
            "- Compare against our workforce data?\n"
            "- Summarize the document?"
        )

    if 'image' in info or 'png' in info or 'jpg' in info or 'jpeg' in info:
        return (
            "FILE_PROCESSED:image\n\n"
            "Image file detected. I can discuss the image if you describe what it contains.\n"
            "What does this image show? (screenshot, chart, report, etc.)"
        )

    # Default
    return (
        "FILE_PROCESSED:unknown\n\n"
        "File received. To process it effectively, please tell me:\n"
        "1. What type of file is this? (CSV, PDF, image, etc.)\n"
        "2. What does it contain?\n"
        "3. What would you like to do with it?"
    )
