"""
app/tools/dashboard_tool.py

Navigation tool — directs user to specific dashboard pages/sections.
"""

from langchain_core.tools import tool


@tool
def dashboard_navigate(instruction: str) -> str:
    """
    Use this tool when the user wants to view a specific dashboard page, chart, or section.
    Returns a navigation command the frontend will execute.

    Examples:
    - Show me the flight risk dashboard
    - Take me to the career progression page
    - Navigate to manager analytics
    - Go to the org structure view
    """
    route_map = {
        'dashboard': '/', 'home': '/', 'overview': '/',
        'workforce': '/workforce', 'composition': '/workforce', 'headcount': '/workforce',
        'turnover': '/turnover', 'attrition': '/turnover', 'departure': '/turnover',
        'tenure': '/tenure', 'retention': '/tenure',
        'flight': '/flight-risk', 'risk': '/flight-risk', 'prediction': '/flight-risk',
        'career': '/careers', 'career': '/careers', 'progression': '/careers', 'promotion': '/careers',
        'manager': '/managers', 'span': '/managers', 'manager': '/managers',
        'org': '/org', 'organization': '/org', 'hierarchy': '/org', 'structure': '/org',
        'chat': '/chat', 'chatbot': '/chat', 'ai': '/chat',
        'report': '/reports', 'export': '/reports', 'download': '/reports',
        'upload': '/upload', 'data': '/upload', 'pipeline': '/upload',
        'setting': '/settings', 'config': '/settings',
    }

    q = instruction.lower()
    for keyword, route in route_map.items():
        if keyword in q:
            return f"NAVIGATE:{route}"

    # Default to dashboard if no match
    return "NAVIGATE:/"
