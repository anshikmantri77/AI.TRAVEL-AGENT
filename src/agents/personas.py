"""Travel agent persona prompts for tailoring research and planning.

Each persona provides a ``research_prefix`` and ``planner_prefix`` that
are prepended to the respective agent's user message when a persona is
selected.  When no persona is given the existing system prompts are used
unchanged (zero-shot, default behavior).
"""

from __future__ import annotations

from typing import Any

PERSONA_PROMPTS: dict[str, dict[str, str]] = {
    "backpacker": {
        "research_prefix": (
            "Focus on budget hostels, free attractions, street food, "
            "local transport. Avoid luxury. Flag anything over $50/night."
        ),
        "planner_prefix": (
            "Prioritize cost-saving. Prefer walking/public transit. "
            "Include free activities. Keep accommodation under $30/night."
        ),
    },
    "luxury": {
        "research_prefix": (
            "Focus on 5-star hotels, fine dining, private tours, "
            "exclusive experiences. Ignore budget concerns."
        ),
        "planner_prefix": (
            "Prioritize premium experiences. Include spa, fine dining, "
            "private transfers. No budget constraints."
        ),
    },
    "family": {
        "research_prefix": (
            "Focus on family-friendly activities, child-safe areas, "
            "proximity of accommodation to attractions, kid-friendly restaurants."
        ),
        "planner_prefix": (
            "Include activities suitable for children. Avoid late nights. "
            "Build in rest time. Prefer hotel with pool."
        ),
    },
    "business": {
        "research_prefix": (
            "Focus on business districts, airport proximity, "
            "co-working spaces, networking venues, concierge hotels."
        ),
        "planner_prefix": (
            "Keep mornings free for meetings. Include business hotel. "
            "Add networking dinner slot each evening."
        ),
    },
}


def get_persona_prefix(persona: str | None, agent: str) -> str:
    """Return the persona prompt prefix for *agent* (``"research"`` or ``"planner"``).

    Returns an empty string when *persona* is ``None`` or unknown, which
    leaves the agent's existing system prompt as the sole instruction.
    """
    if persona is None or persona not in PERSONA_PROMPTS:
        return ""
    return PERSONA_PROMPTS[persona].get(f"{agent}_prefix", "")


TRIP_PURPOSE_PROMPTS: dict[str, dict[str, str]] = {
    "adventure": {
        "research_prefix": (
            "Focus on adventure activities: hiking, climbing, water sports, "
            "zip-lining, off-road tours, national parks. Highlight safety "
            "considerations and best seasons for outdoor activities."
        ),
        "planner_prefix": (
            "Prioritize high-energy activities each day. Include adventure "
            "sports, nature excursions, and physical challenges. Build in "
            "rest after intense activities."
        ),
    },
    "food": {
        "research_prefix": (
            "Focus on culinary experiences: cooking classes, food tours, "
            "local markets, street food scenes, Michelin-starred restaurants, "
            "regional specialties, wine regions."
        ),
        "planner_prefix": (
            "Structure itinerary around meals. Include cooking classes, food "
            "tours, market visits, and diverse dining experiences each day. "
            "Prioritize culinary neighborhoods."
        ),
    },
    "culture": {
        "research_prefix": (
            "Focus on museums, historical sites, architecture, galleries, "
            "cultural events, UNESCO sites, local traditions, festivals, "
            "and performing arts."
        ),
        "planner_prefix": (
            "Balance museum visits with walking tours. Include guided "
            "cultural experiences, gallery visits, and local cultural "
            "events. Allow time for exploration of historic districts."
        ),
    },
    "relax": {
        "research_prefix": (
            "Focus on spas, beaches, wellness retreats, peaceful gardens, "
            "yoga studios, quiet cafes, scenic viewpoints, and low-stress activities."
        ),
        "planner_prefix": (
            "Keep schedule light. Prioritize relaxation, spa treatments, "
            "beach time, and scenic leisure. Maximum 1-2 activities per "
            "day with plenty of free time."
        ),
    },
    "honeymoon": {
        "research_prefix": (
            "Focus on romantic experiences: sunset cruises, couple's spas, "
            "fine dining with views, private tours, secluded beaches, "
            "boutique hotels, photography spots."
        ),
        "planner_prefix": (
            "Create a romantic atmosphere. Include couple's activities, "
            "private dining, sunset experiences, and boutique accommodation. "
            "Ensure privacy and memorable moments."
        ),
    },
    "bachelor_party": {
        "research_prefix": (
            "Focus on nightlife, group activities, adventure sports, "
            "entertainment venues, bars and clubs, group dining options, "
            "and activities for large groups."
        ),
        "planner_prefix": (
            "Plan for group coordination. Include high-energy nightlife, "
            "group activities, and social dining. Balance party time with "
            "recovery time."
        ),
    },
}


def get_trip_purpose_prefix(purpose: str | None, agent: str) -> str:
    """Return the trip-purpose prompt prefix for *agent*.

    Returns an empty string when *purpose* is ``None`` or unknown.
    """
    if purpose is None or purpose not in TRIP_PURPOSE_PROMPTS:
        return ""
    return TRIP_PURPOSE_PROMPTS[purpose].get(f"{agent}_prefix", "")
