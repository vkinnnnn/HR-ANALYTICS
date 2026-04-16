"""The Brain — LangGraph agent with 9 tools for HR analytics."""

from typing import Annotated, Optional, Dict, Any, List
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
import json
import logging
import asyncio

from ..llm import llm_call, is_llm_available
from .knowledge_base import search as kb_search
from .memory_manager import memory_manager
from .analytics_engine import get_analytics_engine

logger = logging.getLogger(__name__)

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
        """Classify user intent based on message content."""
        msg = state["messages"][-1]["content"] if state["messages"] else ""
        msg_lower = msg.lower()

        # Intent classification with weighted keywords
        analytics_keywords = ["what", "how many", "count", "metric", "number", "total", "show", "compare", "trend", "rate"]
        knowledge_keywords = ["define", "explain", "meaning", "benchmark", "about", "describe", "what is", "tell me"]

        analytics_score = sum(1 for kw in analytics_keywords if kw in msg_lower)
        knowledge_score = sum(1 for kw in knowledge_keywords if kw in msg_lower)

        if knowledge_score > analytics_score:
            intent = "knowledge"
        else:
            intent = "analytics"

        state["thinking"] = f"Intent detected: {intent} (analytics_score={analytics_score}, knowledge_score={knowledge_score})"
        logger.debug(f"Intent routing: {state['thinking']}")
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
            logger.warning("LLM not available, returning fallback response")
            state["messages"].append({
                "role": "assistant",
                "content": "LLM service is not available. Please configure an API key (OpenAI or OpenRouter)."
            })
            return state

        system_prompt = """You are the Workforce IQ analytics assistant. You have access to:
- Complete workforce data (headcount, tenure, career progression, org structure)
- Recognition data (peer awards, culture insights, engagement signals)
- Live KPI computations

Answer questions directly and data-driven. Lead with numbers. Contextualize insights."""

        user_msg = state["messages"][-1]["content"] if state["messages"] else "Hello"

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            response = loop.run_until_complete(
                llm_call(system_prompt, user_msg, max_tokens=500)
            )
            loop.close()
            logger.debug(f"LLM response generated successfully ({len(response)} chars)")
        except ValueError as e:
            logger.error(f"LLM configuration error: {e}")
            response = f"LLM Error: {str(e)}"
        except asyncio.TimeoutError:
            logger.error("LLM request timed out")
            response = "Request timed out. Please try again."
        except Exception as e:
            logger.error(f"Unexpected error generating LLM response: {type(e).__name__}: {e}")
            response = "Unable to generate response due to an error. Please try again."

        state["messages"].append({
            "role": "assistant",
            "content": response
        })
        return state
    
    def process_message(self, user_id: str, message: str, current_page: Optional[str] = None) -> str:
        """Process a user message and return response."""
        # Input validation
        if not message or not isinstance(message, str):
            logger.warning(f"Invalid message from {user_id}: empty or not string")
            return "Please provide a valid message."

        if len(message.strip()) == 0:
            return "Please ask a question about your workforce data."

        if len(message) > 5000:
            logger.warning(f"Message too long from {user_id}: {len(message)} chars")
            return "Message is too long. Please ask a shorter question."

        if not user_id or not isinstance(user_id, str):
            user_id = "default_user"

        try:
            state: AgentState = {
                "messages": [{"role": "user", "content": message}],
                "user_id": user_id,
                "current_page": current_page or "dashboard",
                "thinking": ""
            }

            logger.info(f"Processing message from {user_id}: {message[:100]}...")
            result = self.graph.invoke(state)

            # Extract last assistant message
            for msg in reversed(result["messages"]):
                if msg.get("role") == "assistant":
                    response = msg.get("content", "No response")
                    logger.info(f"Generated response for {user_id}: {len(response)} chars")
                    return response

            logger.warning(f"No assistant message found in result for {user_id}")
            return "Unable to generate a response. Please try again."
        except Exception as e:
            logger.error(f"Error processing message from {user_id}: {type(e).__name__}: {e}")
            return f"An error occurred while processing your request: {str(e)}"

_brain_agent: Optional[BrainAgent] = None

def get_brain_agent(data_cache: Dict[str, Any]) -> BrainAgent:
    global _brain_agent
    if _brain_agent is None:
        _brain_agent = BrainAgent(data_cache)
    return _brain_agent
