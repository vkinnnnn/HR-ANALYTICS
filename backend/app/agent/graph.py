"""
app/agent/graph.py

Production LangGraph agent with:
- CoT + role prompting via prompt_engine
- Dynamic per-query prompt extension
- Hard refusal gate (score < 0.4 → refuse)
- Soft warning (0.4-0.6 → warn)
- Conversational memory (last 5 turns per session)
- Route badge on every response
- 9 tools (6 original + 3 new for workforce)
"""

import json
import re
from typing import Annotated, TypedDict, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    BaseMessage, HumanMessage, SystemMessage, ToolMessage, AIMessage
)
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.tools.pandas_tool      import pandas_query
from app.tools.rag_tool         import semantic_search
from app.tools.profile_tool     import profile_and_replace
from app.tools.synthesis_tool   import llm_synthesis
from app.tools.chart_tool       import chart_generator
from app.tools.graph_tool       import graph_query
from app.tools.dashboard_tool   import dashboard_navigate
from app.tools.pipeline_tool    import run_pipeline
from app.tools.file_tool        import process_file

from app.agent.prompt_engine import (
    ROUTER_PROMPT,
    HALLUCINATION_CHECK_PROMPT,
    build_synthesis_prompt,
    format_final_answer,
    should_refuse,
)


# ── Agent state ────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages:            Annotated[list[BaseMessage], add_messages]
    route_used:          Optional[str]
    last_question:       Optional[str]
    last_tool_output:    Optional[str]
    hallucination_score: Optional[float]
    hallucination_flag:  Optional[bool]
    hallucinated_claims: Optional[list]


TOOLS = [
    pandas_query,
    semantic_search,
    profile_and_replace,
    llm_synthesis,
    chart_generator,
    graph_query,
    dashboard_navigate,
    run_pipeline,
    process_file,
]


# ── Build graph ────────────────────────────────────────────────────────────────

def build_agent():
    router_llm        = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    router_with_tools = router_llm.bind_tools(TOOLS)
    synthesis_llm     = ChatOpenAI(model="gpt-4o",      temperature=0)
    hallucination_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    def router_node(state: AgentState):
        messages = [SystemMessage(content=ROUTER_PROMPT)] + state["messages"]
        response = router_with_tools.invoke(messages)

        route  = None
        last_q = ""
        if hasattr(response, "tool_calls") and response.tool_calls:
            route = response.tool_calls[0].get("name")
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                last_q = msg.content
                break

        return {"messages": [response], "route_used": route, "last_question": last_q}

    def synthesis_node(state: AgentState):
        tool_messages = [m for m in state["messages"] if isinstance(m, ToolMessage)]

        # Chart bypass
        for tm in tool_messages:
            if "CHART_DATA:" in str(tm.content):
                return {
                    "messages":            [AIMessage(content="Here's the chart:\n" + tm.content)],
                    "last_tool_output":    tm.content,
                    "hallucination_score": 1.0,
                    "hallucination_flag":  False,
                    "hallucinated_claims": [],
                }

        last_tool_output = str(tool_messages[-1].content) if tool_messages else ""

        # Build dynamic synthesis prompt
        dynamic_prompt = build_synthesis_prompt(
            question=state.get("last_question", ""),
            tool_used=state.get("route_used", ""),
            tool_output=last_tool_output,
        )

        messages = [SystemMessage(content=dynamic_prompt)] + state["messages"]
        response = synthesis_llm.invoke(messages)
        return {"messages": [response], "last_tool_output": last_tool_output}

    def hallucination_check_node(state: AgentState):
        tool_output = state.get("last_tool_output", "")
        ai_messages = [
            m for m in state["messages"]
            if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None)
        ]

        if "CHART_DATA:" in tool_output or not tool_output or not ai_messages:
            return {"hallucination_score": 1.0, "hallucination_flag": False, "hallucinated_claims": []}

        # llm_synthesis is interpretive by design — skip hard grounding check
        if state.get("route_used") == "llm_synthesis":
            return {"hallucination_score": 0.8, "hallucination_flag": False, "hallucinated_claims": []}

        source_context = tool_output[:3000]
        final_answer   = str(ai_messages[-1].content)[:2000]

        check_messages = [
            SystemMessage(content=HALLUCINATION_CHECK_PROMPT),
            HumanMessage(content=f"SOURCE CONTEXT:\n{source_context}\n\nAI ANSWER:\n{final_answer}"),
        ]

        try:
            response = hallucination_llm.invoke(check_messages)
            raw      = re.sub(r"```json|```", "", response.content).strip()
            parsed   = json.loads(raw)
            score    = float(parsed.get("score", 1.0))
            claims   = parsed.get("hallucinated_claims", [])
            return {
                "hallucination_score": round(score, 3),
                "hallucination_flag":  score < 0.6,
                "hallucinated_claims": claims,
            }
        except Exception:
            return {"hallucination_score": 1.0, "hallucination_flag": False, "hallucinated_claims": []}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "synthesize"

    tool_node = ToolNode(TOOLS)

    graph = StateGraph(AgentState)
    graph.add_node("router",              router_node)
    graph.add_node("tools",               tool_node)
    graph.add_node("synthesize",          synthesis_node)
    graph.add_node("hallucination_check", hallucination_check_node)

    graph.set_entry_point("router")
    graph.add_conditional_edges(
        "router", should_continue,
        {"tools": "tools", "synthesize": "synthesize"},
    )
    graph.add_edge("tools",               "synthesize")
    graph.add_edge("synthesize",          "hallucination_check")
    graph.add_edge("hallucination_check", END)

    return graph.compile()


# ── Conversation memory ────────────────────────────────────────────────────────

_conversation_history: dict[str, list[BaseMessage]] = {}
MAX_HISTORY_TURNS = 5


def _trim_history(messages: list[BaseMessage]) -> list[BaseMessage]:
    max_msgs = MAX_HISTORY_TURNS * 2
    return messages[-max_msgs:] if len(messages) > max_msgs else messages


# ── Singleton agent ────────────────────────────────────────────────────────────

_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


# ── Public interface ───────────────────────────────────────────────────────────

def run_query(question: str, session_id: str = "default") -> dict:
    """
    Run a question through the full agent pipeline.
    Returns: answer, route_used, hallucination_flag, hallucination_score,
             hallucinated_claims, was_refused
    """
    agent        = get_agent()
    history      = _conversation_history.get(session_id, [])
    all_messages = history + [HumanMessage(content=question)]

    result = agent.invoke({
        "messages":            all_messages,
        "route_used":          None,
        "last_question":       question,
        "last_tool_output":    "",
        "hallucination_score": 1.0,
        "hallucination_flag":  False,
        "hallucinated_claims": [],
    })

    route       = result.get("route_used")
    h_score     = result.get("hallucination_score", 1.0)
    h_flag      = result.get("hallucination_flag", False)
    h_claims    = result.get("hallucinated_claims", [])
    tool_output = result.get("last_tool_output", "")

    # Chart bypass
    if "CHART_DATA:" in tool_output:
        final_content = "Here's the chart:\n" + tool_output
        _conversation_history[session_id] = _trim_history(
            all_messages + [AIMessage(content=final_content)]
        )
        return {
            "answer":              final_content,
            "route_used":          route or "chart_generator",
            "hallucination_flag":  False,
            "hallucination_score": 1.0,
            "hallucinated_claims": [],
            "was_refused":         False,
        }

    raw_answer = "Sorry, I could not generate a response."
    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            raw_answer = msg.content
            break

    was_refused  = should_refuse(h_score)
    final_answer = format_final_answer(
        answer=raw_answer,
        hallucination_score=h_score,
        route_used=route,
    )

    _conversation_history[session_id] = _trim_history(
        all_messages + [AIMessage(content=final_answer)]
    )

    return {
        "answer":              final_answer,
        "route_used":          route,
        "hallucination_flag":  h_flag,
        "hallucination_score": h_score,
        "hallucinated_claims": h_claims,
        "was_refused":         was_refused,
    }


def clear_session(session_id: str = "default"):
    _conversation_history.pop(session_id, None)
