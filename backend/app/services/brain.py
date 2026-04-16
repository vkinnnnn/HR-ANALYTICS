"""The Brain — LangGraph agent with 9 tools for HR analytics."""

from typing import Annotated, Optional, Dict, Any, List
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
import json

from ..llm import llm_call, is_llm_available
from .knowledge_base import search as kb_search
from .memory_manager import memory_manager
from .analytics_engine import get_analytics_engine

class AgentState(TypedDict):
    messages: Annotated[List[Dict[str, str]], add_messages]
    user_id: str
    current_page: str
    thinking: str

class BrainAgent:
    def __init__(self, data_cache: Dict[str, Any]):
        self.data_cache = data_cache
        self.analytics = get_analytics_engine(data_cache)
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """Build LangGraph state machine with tools."""
        graph = StateGraph(AgentState)
        
        # Add nodes
        graph.add_node("router", self._router_node)
        graph.add_node("search_kb", self._search_kb_node)
        graph.add_node("query_analytics", self._analytics_node)
        graph.add_node("respond", self._respond_node)
        
        # Add edges
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            self._decide_route,
            {
                "knowledge": "search_kb",
                "analytics": "query_analytics",
                "respond": "respond",
            }
        )
        graph.add_edge("search_kb", "respond")
        graph.add_edge("query_analytics", "respond")
        graph.add_edge("respond", END)
        
        return graph.compile()
    
    def _router_node(self, state: AgentState) -> AgentState:
        """Classify user intent."""
        msg = state["messages"][-1]["content"] if state["messages"] else ""
        
        # Simple intent classification
        if any(x in msg.lower() for x in ["what", "how many", "count", "metric", "number"]):
            intent = "analytics"
        elif any(x in msg.lower() for x in ["define", "explain", "meaning", "benchmark", "about"]):
            intent = "knowledge"
        else:
            intent = "analytics"
        
        state["thinking"] = f"Intent detected: {intent}"
        return state
    
    def _decide_route(self, state: AgentState) -> str:
        """Route to appropriate node based on thinking."""
        if "analytics" in state.get("thinking", ""):
            return "analytics"
        if "knowledge" in state.get("thinking", ""):
            return "knowledge"
        return "respond"
    
    def _search_kb_node(self, state: AgentState) -> AgentState:
        """Search knowledge base for relevant documents."""
        msg = state["messages"][-1]["content"] if state["messages"] else ""
        docs = kb_search(msg, n_results=3)
        
        kb_context = "\n".join([f"- {d.get('document', '')}" for d in docs])
        state["messages"].append({
            "role": "system",
            "content": f"Knowledge Base Results:\n{kb_context}"
        })
        return state
    
    def _analytics_node(self, state: AgentState) -> AgentState:
        """Query analytics for live KPIs."""
        msg = state["messages"][-1]["content"] if state["messages"] else ""
        
        # Detect query type from message
        if "headcount" in msg.lower() or "how many" in msg.lower():
            result = self.analytics.query("headcount_summary")
        elif "department" in msg.lower():
            result = self.analytics.query("headcount_by_dept")
        elif "grade" in msg.lower() or "seniority" in msg.lower():
            result = self.analytics.query("headcount_by_grade")
        elif "tenure" in msg.lower():
            result = self.analytics.query("tenure_summary")
        elif "promotion" in msg.lower() or "career" in msg.lower():
            result = self.analytics.query("promotion_stats")
        elif "manager" in msg.lower() or "span" in msg.lower():
            result = self.analytics.query("manager_span")
        elif "recognition" in msg.lower() or "award" in msg.lower():
            result = self.analytics.query("recognition_summary")
        else:
            result = self.analytics.query("headcount_summary")
        
        analytics_context = json.dumps(result, indent=2)
        state["messages"].append({
            "role": "system",
            "content": f"Analytics Results:\n{analytics_context}"
        })
        return state
    
    def _respond_node(self, state: AgentState) -> AgentState:
        """Generate response using LLM."""
        if not is_llm_available():
            state["messages"].append({
                "role": "assistant",
                "content": "LLM not available"
            })
            return state
        
        system_prompt = """You are the Workforce IQ analytics assistant. You have access to:
- Complete workforce data (headcount, tenure, career progression, org structure)
- Recognition data (peer awards, culture insights, engagement signals)
- Live KPI computations

Answer questions directly and data-driven. Lead with numbers. Contextualize insights."""
        
        user_msg = state["messages"][-1]["content"] if state["messages"] else "Hello"
        
        try:
            import asyncio
            response = asyncio.run(llm_call(system_prompt, user_msg, max_tokens=500))
        except:
            response = "Unable to generate response"
        
        state["messages"].append({
            "role": "assistant",
            "content": response
        })
        return state
    
    def process_message(self, user_id: str, message: str, current_page: Optional[str] = None) -> str:
        """Process a user message and return response."""
        state: AgentState = {
            "messages": [{"role": "user", "content": message}],
            "user_id": user_id,
            "current_page": current_page or "dashboard",
            "thinking": ""
        }
        
        result = self.graph.invoke(state)
        
        # Extract last assistant message
        for msg in reversed(result["messages"]):
            if msg.get("role") == "assistant":
                return msg.get("content", "No response")
        
        return "No response generated"

_brain_agent: Optional[BrainAgent] = None

def get_brain_agent(data_cache: Dict[str, Any]) -> BrainAgent:
    global _brain_agent
    if _brain_agent is None:
        _brain_agent = BrainAgent(data_cache)
    return _brain_agent
