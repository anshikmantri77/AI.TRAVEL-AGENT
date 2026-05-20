"""Research Agent — gathers destination intelligence.

Uses two tools:
  1. web_search – Serper API for attractions, safety, tips
  2. weather   – Open-Meteo for 7-day forecast

Produces structured JSON research output consumed by the Planner Agent.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from src.agents.personas import get_persona_prefix, get_trip_purpose_prefix
from src.config import get_settings
from src.tools.web_search import web_search_tool
from src.tools.weather import weather_tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LangChain @tool wrappers (needed for .bind_tools on the LLM)
# ---------------------------------------------------------------------------

@tool
def search_web(query: str) -> str:
    """Search the web for travel-related information about a destination.

    Args:
        query: The search query string.
    """
    return web_search_tool(query)


@tool
def get_weather(city: str) -> str:
    """Get a 7-day weather forecast for a destination city.

    Args:
        city: City or destination name (e.g. 'Barcelona').
    """
    return weather_tool(city)


@tool
def query_knowledge_base(query: str) -> str:
    """Query the local travel knowledge base for destination-specific tips and guides.

    Args:
        query: Search query about the destination (e.g. "hidden gems in Paris").
    """
    from src.rag.retriever import retrieve_context

    result = retrieve_context(query)
    return result if result else "No local knowledge base results found."


@tool
def geocode_location(name: str, city: str | None = None) -> str:
    """Get geographic coordinates (latitude, longitude) for a place or activity.

    Args:
        name: Name of the place to geocode (e.g. 'Eiffel Tower').
        city: Optional city context (e.g. 'Paris').
    """
    from src.tools.geocoding import geocode_place  # noqa: PLC0415

    result = geocode_place(name, city)
    return json.dumps(result)


RESEARCH_TOOLS = [search_web, get_weather, query_knowledge_base, geocode_location]


def _get_llm():
    """Instantiate the configured LLM with research tools bound."""
    settings = get_settings()
    if settings.LLM_PROVIDER == "groq":
        from langchain_groq import ChatGroq
        llm = ChatGroq(model=settings.LLM_MODEL, temperature=0.3, api_key=settings.GROQ_API_KEY)
    elif settings.LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model=settings.LLM_MODEL, temperature=0.3, api_key=settings.OPENAI_API_KEY)
    else:
        from langchain_anthropic import ChatAnthropic
        llm = ChatAnthropic(model=settings.LLM_MODEL, temperature=0.3, api_key=settings.ANTHROPIC_API_KEY)
    return llm.bind_tools(RESEARCH_TOOLS)


RESEARCH_SYSTEM_PROMPT = """You are a travel research specialist focused on the INDIAN market. \
Given a destination and travel context, use your tools to gather comprehensive information.

IMPORTANT: All prices must be in Indian Rupees (INR, ₹).

You MUST call the search_web tool at least twice (once for attractions/tips, once for safety) \
and call get_weather once for the destination city.

After gathering information, produce a JSON object with EXACTLY these keys:
- destination_overview: string (2-3 sentence overview)
- top_attractions: list of strings (5-10 attractions with brief description)
- local_tips: list of strings (3-5 practical tips)
- safety_notes: string (safety information)
- weather_summary: string (summary of forecast)
- best_areas_to_stay: list of strings (2-4 neighbourhoods with approximate hotel price range in ₹)
- cuisine_highlights: list of strings (3-5 local dishes or food experiences)
- recommended_restaurants: list of objects with name, cuisine_type, approximate_cost_per_person (in ₹)
- local_transport_options: list of strings (cab fares, metro passes, bus routes with ₹ prices)
- estimated_daily_cost_per_person: number (estimated daily spend in ₹ for a mid-range traveler)

Return ONLY the JSON object, no markdown fences or extra text."""


async def run_research_agent(travel_request: dict[str, Any]) -> dict[str, Any]:
    """Execute the research agent for *travel_request*.

    Runs an agentic loop: the LLM may issue tool calls which are
    executed and fed back until the LLM produces a final text answer.
    """
    destination = travel_request.get("destination", "unknown destination")
    origin = travel_request.get("origin", "")
    interests = travel_request.get("interests", [])
    start_date = travel_request.get("start_date", "")
    end_date = travel_request.get("end_date", "")
    num_travelers = travel_request.get("num_travelers", 1)

    persona_prefix = get_persona_prefix(travel_request.get("agent_persona"), "research")
    purpose_prefix = get_trip_purpose_prefix(travel_request.get("trip_purpose"), "research")

    user_prompt = (
        f"Research the destination: {destination}\n"
        f"Travel dates: {start_date} to {end_date}\n"
        f"Number of travelers: {num_travelers}\n"
        f"Interests: {', '.join(interests)}\n\n"
        "Use your tools to gather comprehensive information, then produce the JSON output."
    )
    if origin:
        user_prompt = f"Travelers departing from: {origin}\n" + user_prompt

    if persona_prefix:
        user_prompt = f"[Style Guidance] {persona_prefix}\n\n{user_prompt}"
    if purpose_prefix:
        user_prompt = f"[Trip Purpose] {purpose_prefix}\n\n{user_prompt}"

    llm = _get_llm()
    tool_map = {t.name: t for t in RESEARCH_TOOLS}

    messages: list[Any] = [
        SystemMessage(content=RESEARCH_SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    # Agentic loop — max 10 iterations to prevent runaway
    for _ in range(10):
        response = await llm.ainvoke(messages)
        messages.append(response)

        # If there are tool calls, execute them
        if response.tool_calls:
            from langchain_core.messages import ToolMessage
            for tc in response.tool_calls:
                tool_fn = tool_map.get(tc["name"])
                if tool_fn:
                    try:
                        result = tool_fn.invoke(tc["args"])
                    except Exception as exc:
                        result = json.dumps({"error": str(exc)})
                else:
                    result = json.dumps({"error": f"Unknown tool: {tc['name']}"})
                messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))
            continue

        # No tool calls → parse the final text output
        text = response.content if isinstance(response.content, str) else str(response.content)
        return _parse_research_output(text)

    # Fallback if loop exhausted
    return _default_research_output(destination)


def _parse_research_output(text: str) -> dict[str, Any]:
    """Try to parse LLM text as JSON; fall back to wrapping it."""
    # Strip markdown fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Could not parse research output as JSON, wrapping raw text.")
        return {
            "destination_overview": cleaned[:500],
            "top_attractions": [],
            "local_tips": [],
            "safety_notes": "",
            "weather_summary": "",
            "best_areas_to_stay": [],
            "cuisine_highlights": [],
        }


def _default_research_output(destination: str) -> dict[str, Any]:
    return {
        "destination_overview": f"Research for {destination} could not be completed. Please try again.",
        "top_attractions": [],
        "local_tips": [],
        "safety_notes": "No data available.",
        "weather_summary": "No data available.",
        "best_areas_to_stay": [],
        "cuisine_highlights": [],
    }
