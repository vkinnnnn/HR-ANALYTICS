"""
THE BRAIN — LangGraph agent that orchestrates all chatbot capabilities.

Every user interaction flows through this agent. It decides what to do,
calls the right tools, and composes the response.
"""

import json
import logging
import os
from typing import Any, Annotated

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage, BaseMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END, MessagesState

from ..config import settings

logger = logging.getLogger(__name__)


# ── Tool Definitions ─────────────────────────────────────────────────

@tool
def search_knowledge(query: str) -> str:
    """Search the ChromaDB knowledge base for workforce analytics facts,
    KPI definitions, industry benchmarks, and platform capabilities.
    Use when: user asks about metrics, definitions, benchmarks, or what a page shows."""
    from .knowledge_base import search
    results = search(query, n_results=5)
    if not results:
        return "No relevant knowledge found."
    return "\n\n".join(r["text"] for r in results)


@tool
def search_memory(user_id: str, query: str) -> str:
    """Retrieve user-specific memories from past sessions.
    Use when: personalizing responses or recalling past user context."""
    from .memory_manager import search_memory as _search
    memories = _search(user_id, query)
    if not memories:
        return "No relevant memories found for this user."
    return "User memories:\n" + "\n".join(f"- {m}" for m in memories)


@tool
def save_memory(user_id: str, fact: str) -> str:
    """Save a user fact for future sessions (preferences, role, department focus).
    Use when: user shares preferences, role, or important context."""
    from .memory_manager import save_memory as _save
    saved = _save(user_id, fact)
    return "Memory saved." if saved else "Memory already exists or failed to save."


@tool
def query_analytics(query_type: str, params: str = "{}") -> str:
    """Get live computed KPIs from the analytics engine. Returns structured data.
    query_types: summary, headcount, turnover, tenure, departments, grades,
    countries, business_units, careers, managers, flight_risk, gini, categories,
    specificity, flow_direction, fairness, nominators, compare, top_roles,
    award_types, cohort_retention.
    params: JSON string of additional parameters (e.g. '{"group_by":"department_name"}')."""
    from .analytics_engine import query_analytics as _query
    try:
        parsed_params = json.loads(params) if params else {}
    except json.JSONDecodeError:
        parsed_params = {}
    result = _query(query_type, parsed_params)
    return json.dumps(result, default=str)


@tool
def run_pipeline(file_path: str) -> str:
    """Execute the data pipeline on an uploaded file. Validates, loads, computes
    derived fields, and rebuilds the knowledge base.
    Use when: user uploads a new file or asks to re-process data."""
    import asyncio
    from .pipeline_orchestrator import run_full_pipeline

    async def _run():
        return await run_full_pipeline(file_path)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(asyncio.run, _run()).result()
        else:
            result = asyncio.run(_run())
        return result.summary
    except Exception as e:
        return f"Pipeline failed: {e}"


@tool
def process_file(filename: str, file_summary: str) -> str:
    """Process an uploaded file. The file_summary contains the parsed content.
    Use when: user attaches a file to their message."""
    return f"File '{filename}' processed:\n{file_summary}"


@tool
def generate_report(report_type: str, params: str = "{}") -> str:
    """Generate a structured executive report.
    report_types: executive_summary, turnover_report, recognition_audit, department_deep_dive.
    params: JSON string of parameters (e.g. '{"department":"Engineering"}')."""
    import asyncio
    from .report_generator import generate_report as _gen

    try:
        parsed_params = json.loads(params) if params else {}
    except json.JSONDecodeError:
        parsed_params = {}

    async def _run():
        return await _gen(report_type, parsed_params)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(asyncio.run, _run()).result()
        else:
            result = asyncio.run(_run())

        sections_text = "\n\n".join(
            f"## {s['title']}\n{s['content']}" for s in result.sections
        )
        return f"# {result.title}\n\n{sections_text}\n\nREPORT: {json.dumps({'title': result.title, 'sections': result.sections})}"
    except Exception as e:
        return f"Report generation failed: {e}"


@tool
def control_dashboard(action: str, target: str) -> str:
    """Control the dashboard UI navigation.
    action: 'navigate' | 'scroll_to' | 'highlight' | 'filter'
    target: page route (e.g. '/turnover', '/careers') or section ID.
    Use when: user says 'show me', 'take me to', 'navigate to'."""
    route_map = {
        "dashboard": "/", "overview": "/", "home": "/",
        "turnover": "/turnover", "attrition": "/turnover",
        "tenure": "/tenure",
        "flight risk": "/flight-risk", "risk": "/flight-risk",
        "careers": "/careers", "promotions": "/careers",
        "managers": "/managers",
        "org": "/org", "structure": "/org", "hierarchy": "/org",
        "workforce": "/workforce", "headcount": "/workforce",
        "categories": "/categories", "taxonomy": "/categories",
        "quality": "/quality", "specificity": "/quality",
        "flow": "/flow", "network": "/flow",
        "inequality": "/inequality", "gini": "/inequality",
        "upload": "/data-hub", "data": "/data-hub", "pipeline": "/data-hub",
        "settings": "/settings",
    }

    target_lower = target.lower()
    route = route_map.get(target_lower, target if target.startswith("/") else None)
    if route:
        return f"NAVIGATE: {route}"
    return f"Could not find a page matching '{target}'. Available: {', '.join(sorted(set(route_map.values())))}"


@tool
def predict_category(message: str) -> str:
    """Predict the taxonomy category for a recognition message using TF-IDF + LogReg.
    Use when: user asks 'what category would this message be?'."""
    try:
        from ..recognition_loader import get_recognition, is_recognition_loaded
        if not is_recognition_loaded():
            return "Recognition data not loaded — cannot predict categories."

        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression

        rdf = get_recognition()
        if "category_name" not in rdf.columns or len(rdf) < 10:
            return "Insufficient training data for category prediction."

        vectorizer = TfidfVectorizer(max_features=500, stop_words="english")
        X = vectorizer.fit_transform(rdf["message"].astype(str))
        y = rdf["category_name"]
        clf = LogisticRegression(max_iter=200, random_state=42)
        clf.fit(X, y)

        X_new = vectorizer.transform([message])
        pred = clf.predict(X_new)[0]
        proba = clf.predict_proba(X_new)[0]
        top_idx = proba.argsort()[-3:][::-1]
        top_cats = [(clf.classes_[i], round(float(proba[i]) * 100, 1)) for i in top_idx]

        return (
            f"Predicted category: **{pred}**\n"
            f"Confidence: {top_cats[0][1]}%\n"
            f"Top 3: {', '.join(f'{c} ({p}%)' for c, p in top_cats)}"
        )
    except Exception as e:
        return f"Category prediction failed: {e}"


# ── All tools ────────────────────────────────────────────────────────

ALL_TOOLS = [
    search_knowledge,
    search_memory,
    save_memory,
    query_analytics,
    run_pipeline,
    process_file,
    generate_report,
    control_dashboard,
    predict_category,
]

TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}


# ── System Prompt ────────────────────────────────────────────────────

BRAIN_SYSTEM_PROMPT = """You are the Workforce IQ AI — the intelligence engine of a workforce analytics platform.

## YOUR IDENTITY
You are a senior People Analytics & Recognition Intelligence consultant. You speak with authority and warmth. You lead with data, contextualize with benchmarks, and close with actionable recommendations.

## YOUR CAPABILITIES
You have tools to:
- **search_knowledge**: Query the knowledge base for metrics, definitions, benchmarks, platform capabilities
- **query_analytics**: Get live computed KPIs (turnover, tenure, headcount, careers, managers, recognition, etc.)
- **search_memory / save_memory**: Remember and recall user preferences across sessions
- **generate_report**: Create structured executive reports
- **control_dashboard**: Navigate the user to specific pages
- **predict_category**: Classify recognition messages into taxonomy categories

## HOW TO RESPOND

### For metric questions:
1. Use query_analytics to get the actual number
2. State it with **bold** emphasis
3. Contextualize vs benchmarks
4. Suggest a follow-up

### For comparison questions:
Use query_analytics with compare type. Present both sides with numbers.

### For "why" questions:
1. Get data via query_analytics
2. Search knowledge base for context
3. Identify 2-3 possible root causes
4. Recommend investigation paths

### For report requests:
Use generate_report tool. Structure as: Headline → Composition → Patterns → Risks → Recommendations.

### For navigation requests:
Use control_dashboard. Briefly explain what they'll see.

## RESPONSE FORMAT
- **Bold** key numbers and metric names
- Be concise — CHROs have 30 seconds. Lead with the headline.
- End every substantive response with follow-up suggestions

If you reference a dashboard page, include: NAVIGATE: /route
End with: SUGGESTIONS: question 1 | question 2 | question 3

## WHAT YOU MUST NEVER DO
- Never say "I don't have access to that data" — use your tools
- Never give generic HR advice without grounding it in the actual dataset
- Never present a number without context

{memory_context}
{dataset_context}
The user is currently on the {current_page} page."""


# ── Agent Graph ──────────────────────────────────────────────────────

def _get_llm() -> ChatOpenAI:
    """Create LLM client using configured provider."""
    provider = os.environ.get("LLM_PROVIDER", settings.LLM_PROVIDER)

    if provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY)
        base_url = os.environ.get("OPENROUTER_BASE_URL", settings.OPENROUTER_BASE_URL)
        model = os.environ.get("OPENROUTER_MODEL", settings.OPENROUTER_MODEL)
        if not api_key:
            raise ValueError("No OPENROUTER_API_KEY configured")
        return ChatOpenAI(
            api_key=api_key,
            base_url=base_url,
            model=model,
            temperature=0.7,
            max_tokens=1500,
            streaming=True,
        )

    api_key = os.environ.get("OPENAI_API_KEY", settings.OPENAI_API_KEY)
    model = os.environ.get("OPENAI_MODEL", settings.OPENAI_MODEL)
    if not api_key:
        raise ValueError("No OPENAI_API_KEY configured")
    return ChatOpenAI(
        api_key=api_key,
        model=model,
        temperature=0.7,
        max_tokens=1500,
        streaming=True,
    )


def _build_system_prompt(
    user_id: str = "anonymous",
    current_page: str = "/",
    memory_context: str = "",
    dataset_context: str = "",
) -> str:
    if not memory_context:
        from .memory_manager import search_memory
        memories = search_memory(user_id, "user preferences and context")
        if memories:
            memory_context = "What I remember about you:\n" + "\n".join(f"- {m}" for m in memories)
        else:
            memory_context = ""

    if not dataset_context:
        from ..data_loader import is_loaded, get_stats
        if is_loaded():
            stats = get_stats()
            dataset_context = f"Dataset: {stats.get('total_employees', 0)} employees, {stats.get('active', 0)} active, {stats.get('departed', 0)} departed."
        else:
            dataset_context = "Dataset: Not yet loaded."

    return BRAIN_SYSTEM_PROMPT.format(
        memory_context=memory_context,
        dataset_context=dataset_context,
        current_page=current_page,
    )


def create_brain_agent():
    """Compile the LangGraph agent graph."""
    llm = _get_llm()
    llm_with_tools = llm.bind_tools(ALL_TOOLS)

    def agent_node(state: MessagesState) -> dict:
        response = llm_with_tools.invoke(state["messages"])
        return {"messages": [response]}

    def tool_node(state: MessagesState) -> dict:
        last_msg = state["messages"][-1]
        results = []
        for tc in last_msg.tool_calls:
            tool_fn = TOOLS_BY_NAME.get(tc["name"])
            if tool_fn is None:
                results.append(ToolMessage(
                    content=f"Unknown tool: {tc['name']}",
                    tool_call_id=tc["id"],
                ))
                continue
            try:
                output = tool_fn.invoke(tc["args"])
                results.append(ToolMessage(content=str(output), tool_call_id=tc["id"]))
            except Exception as e:
                results.append(ToolMessage(content=f"Tool error: {e}", tool_call_id=tc["id"]))
        return {"messages": results}

    def should_continue(state: MessagesState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# ── Public API ───────────────────────────────────────────────────────

_agent = None


def get_agent():
    """Get or create the singleton brain agent."""
    global _agent
    if _agent is None:
        _agent = create_brain_agent()
    return _agent


async def process_message(
    message: str,
    user_id: str = "anonymous",
    current_page: str = "/",
    conversation_history: list[dict] | None = None,
    file_summaries: list[str] | None = None,
):
    """
    Process a user message through the brain agent.
    Yields (chunk_type, content) tuples for streaming:
      ("token", "text...")  — streaming text token
      ("done", {...})       — final metadata
    """
    system_prompt = _build_system_prompt(user_id, current_page)

    messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]

    if conversation_history:
        for msg in conversation_history[-8:]:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    user_content = message
    if file_summaries:
        user_content += "\n\nAttached files:\n" + "\n---\n".join(file_summaries)
    messages.append(HumanMessage(content=user_content))

    agent = get_agent()

    full_response = ""
    try:
        async for event in agent.astream(
            {"messages": messages},
            stream_mode="messages",
        ):
            msg, metadata = event
            if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
                full_response += msg.content
                yield ("token", msg.content)

    except Exception as e:
        logger.error(f"Brain agent error: {e}")
        fallback = _local_fallback(message)
        full_response = fallback
        yield ("token", fallback)

    suggestions = _extract_suggestions(full_response)
    navigation = _extract_navigation(full_response)
    chart_data = _extract_chart(full_response)

    yield ("done", {
        "suggestions": suggestions,
        "navigation": navigation,
        "chart_data": chart_data,
        "analysis_type": _detect_analysis_type(message),
    })

    # Post-response: consider saving to memory
    try:
        if len(full_response) > 100 and user_id != "anonymous":
            _consider_saving_memory(user_id, message, full_response)
    except Exception:
        pass


def _consider_saving_memory(user_id: str, question: str, answer: str) -> None:
    """Decide if anything from this exchange is worth remembering."""
    q_lower = question.lower()
    memory_triggers = ["i work in", "my department", "i'm a", "i am a", "my role",
                       "i prefer", "i like", "focus on", "my team", "my company"]
    for trigger in memory_triggers:
        if trigger in q_lower:
            from .memory_manager import save_memory
            save_memory(user_id, f"User said: {question}")
            break


def _extract_suggestions(text: str) -> list[str] | None:
    if "SUGGESTIONS:" not in text:
        return None
    parts = text.split("SUGGESTIONS:")
    suggestion_text = parts[-1].strip().split("\n")[0]
    return [s.strip() for s in suggestion_text.split("|") if s.strip()]


def _extract_navigation(text: str) -> dict | None:
    if "NAVIGATE:" not in text:
        return None
    parts = text.split("NAVIGATE:")
    nav_str = parts[-1].strip().split("\n")[0].strip()
    if "#" in nav_str:
        route, section = nav_str.split("#", 1)
        return {"action": "navigate", "route": route.strip(), "scroll_to": section.strip()}
    return {"action": "navigate", "route": nav_str.strip()}


def _extract_chart(text: str) -> dict | None:
    if "```json" not in text:
        return None
    try:
        start = text.index("```json") + 7
        end = text.index("```", start)
        return json.loads(text[start:end].strip())
    except (ValueError, json.JSONDecodeError):
        return None


def _detect_analysis_type(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["compare", "vs", "versus"]):
        return "comparative"
    if any(w in q for w in ["trend", "over time", "quarterly"]):
        return "trend"
    if any(w in q for w in ["why", "root cause", "reason"]):
        return "root_cause"
    if any(w in q for w in ["predict", "forecast"]):
        return "predictive"
    if any(w in q for w in ["risk", "flight", "danger"]):
        return "risk"
    if any(w in q for w in ["report", "summary", "executive"]):
        return "report"
    return "descriptive"


def _local_fallback(question: str) -> str:
    """Data-driven response without LLM."""
    try:
        from ..data_loader import get_employees, is_loaded
        if not is_loaded():
            return "Data not loaded yet. Please upload a dataset first."
        emp = get_employees()
        active = emp[emp["is_active"]]
        departed = emp[~emp["is_active"]]
        return (
            f"I have data on **{len(emp)} employees** ({len(active)} active, {len(departed)} departed). "
            f"Average tenure: **{round(float(emp['tenure_years'].mean()), 1)} years**. "
            f"Turnover rate: **{round(len(departed)/len(emp)*100, 1)}%**.\n\n"
            f"Ask me about turnover, tenure, headcount, careers, managers, flight risk, or recognition."
            f"\n\nSUGGESTIONS: What's our turnover rate? | Show me flight risks | Summarize workforce health"
        )
    except Exception:
        return "I'm having trouble connecting. Please try again.\n\nSUGGESTIONS: Retry | Check data status | Open settings"
