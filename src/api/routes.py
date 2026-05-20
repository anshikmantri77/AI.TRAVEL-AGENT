"""FastAPI route handlers for the Travel Planner API."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from langgraph.types import Command

from src.auth.dependencies import get_optional_user
from src.api.streaming import streaming_manager
from src.observability.metrics import metrics_enabled, record_plan_complete, record_plan_start, plan_requests_total, plan_completions_total, plan_duration_seconds, active_sessions
from src.tools.export import generate_pdf, generate_ical

from src.api.models import (
    ErrorResponse,
    FinalPlanResponse,
    HealthResponse,
    PlanCreatedResponse,
    PlanStatusResponse,
    PricingResponse,
    ReviewRequestBody,
    ReviewResponse,
    TravelRequestBody,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _graph(request: Request):
    """Retrieve the compiled graph from app state."""
    return request.app.state.graph


def _sessions(request: Request):
    """Retrieve the session store from app state."""
    return request.app.state.sessions


# ---------------------------------------------------------------------------
# Helper to extract state snapshot from LangGraph
# ---------------------------------------------------------------------------

async def _get_graph_state(graph, thread_id: str) -> dict[str, Any]:
    """Get the current state snapshot from the LangGraph checkpointer."""
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = await graph.aget_state(config)
    return dict(snapshot.values) if snapshot and snapshot.values else {}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """Simple health check."""
    return HealthResponse()


@router.post(
    "/plan",
    response_model=PlanCreatedResponse,
    responses={422: {"model": ErrorResponse}},
    tags=["planning"],
)
async def create_plan(body: TravelRequestBody, request: Request, user: dict | None = Depends(get_optional_user)):
    """Submit a new travel planning request.

    Starts the LangGraph workflow which runs until the HITL interrupt,
    then returns the session ID and draft itinerary for review.
    """
    graph = _graph(request)
    sessions = _sessions(request)

    session_id = await sessions.create()

    start_time = record_plan_start()
    await sessions.update(session_id, plan_started_at=start_time)

    # Build initial state
    initial_state = {
        "session_id": session_id,
        "travel_request": {
            "destination": body.destination,
            "origin": body.origin,
            "start_date": body.start_date.isoformat(),
            "end_date": body.end_date.isoformat(),
            "budget_min": body.budget_min,
            "budget_max": body.budget_max,
            "interests": body.interests,
            "num_travelers": body.num_travelers,
            "agent_persona": body.agent_persona,
            "trip_purpose": body.trip_purpose,
        },
        "destinations": body.destinations,
        "agent_persona": body.agent_persona,
        "trip_purpose": body.trip_purpose,
        "current_destination_index": 0,
        "hitl_status": "pending",
        "hitl_feedback": "",
        "hitl_modifications": {},
        "revision_count": 0,
        "error": None,
        "workflow_stage": "started",
        # Attach authenticated user when a valid Bearer token was provided.
        # None for anonymous requests — all /plan/* endpoints remain open.
        "user_id": user["sub"] if user else None,
    }

    config = {"configurable": {"thread_id": session_id}}

    try:
        # This runs until the interrupt() in hitl_checkpoint
        await graph.ainvoke(initial_state, config=config)
    except Exception as exc:
        logger.exception("Graph execution failed for session %s", session_id)
        await sessions.update(session_id, status="error", workflow_stage="error")
        raise HTTPException(status_code=500, detail=f"Planning workflow error: {exc}")

    # Read state after interrupt
    state = await _get_graph_state(graph, session_id)
    error = state.get("error")
    if error:
        await sessions.update(session_id, status="error", workflow_stage="error")
        raise HTTPException(status_code=400, detail=error)

    stage = state.get("workflow_stage", "awaiting_review")
    draft = state.get("draft_itinerary")
    await sessions.update(session_id, status="awaiting_review", workflow_stage=stage)

    return PlanCreatedResponse(
        session_id=session_id,
        status="awaiting_review",
        draft_itinerary=draft,
        message="Draft itinerary ready for review. Use POST /plan/{id}/review to approve, reject, or modify.",
    )


@router.get(
    "/plan/{session_id}",
    response_model=PlanStatusResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["planning"],
)
async def get_plan_status(session_id: str, request: Request):
    """Get the current plan status and draft itinerary."""
    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    graph = _graph(request)
    state = await _get_graph_state(graph, session_id)

    return PlanStatusResponse(
        session_id=session_id,
        status=session.get("status", "unknown"),
        workflow_stage=state.get("workflow_stage", session.get("workflow_stage", "unknown")),
        hitl_status=state.get("hitl_status"),
        draft_itinerary=state.get("draft_itinerary"),
        error=state.get("error"),
        revision_count=state.get("revision_count", 0),
    )


@router.post(
    "/plan/{session_id}/review",
    response_model=ReviewResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["planning"],
)
async def submit_review(session_id: str, body: ReviewRequestBody, request: Request):
    """Submit HITL feedback to resume the workflow."""
    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    graph = _graph(request)
    config = {"configurable": {"thread_id": session_id}}

    # Verify the graph is actually waiting at the interrupt
    snapshot = await graph.aget_state(config)
    if not snapshot or not snapshot.next:
        raise HTTPException(
            status_code=409,
            detail="Plan is not currently awaiting review. Check status with GET /plan/{id}.",
        )

    # Resume the graph with the user's feedback via Command(resume=...)
    resume_payload = {
        "action": body.action,
        "feedback": body.feedback or "",
        "modifications": body.modifications or {},
    }

    try:
        await graph.ainvoke(Command(resume=resume_payload), config=config)
    except Exception as exc:
        logger.exception("Graph resume failed for session %s", session_id)
        raise HTTPException(status_code=500, detail=f"Resume failed: {exc}")

    # Read updated state
    state = await _get_graph_state(graph, session_id)
    stage = state.get("workflow_stage", "unknown")
    status = "completed" if stage == "completed" else "in_progress"

    await sessions.update(session_id, status=status, workflow_stage=stage)

    # If the workflow is still running (rejected/modified → loops back to HITL),
    # we need to check if it paused at interrupt again
    snapshot = await graph.aget_state(config)
    if snapshot and snapshot.next:
        status = "awaiting_review"
        stage = state.get("workflow_stage", "awaiting_review")
        await sessions.update(session_id, status=status, workflow_stage=stage)

    return ReviewResponse(
        session_id=session_id,
        status=status,
        workflow_stage=stage,
        hitl_status=state.get("hitl_status"),
        draft_itinerary=state.get("draft_itinerary"),
        final_plan=state.get("final_plan") if stage == "completed" else None,
        message="Plan approved and finalized." if stage == "completed" else "Feedback processed, draft updated.",
    )


@router.get(
    "/plan/{session_id}/stream",
    tags=["planning"],
    summary="Stream real-time workflow progress via Server-Sent Events",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"text/event-stream": {}}},
        404: {"model": ErrorResponse},
    },
)
async def stream_plan_events(session_id: str, request: Request):
    """Open an SSE stream for *session_id*.

    The response stays open and emits ``event: <stage>\\ndata: {...}\\n\\n``
    lines as the LangGraph workflow progresses through nodes.  A keepalive
    ping comment (``": ping\\n\\n"``) is sent every 15 seconds when idle.

    The stream closes automatically after the ``done`` or ``error`` event.

    No authentication required — the session ID itself acts as a bearer
    (only the creator knows it).
    """
    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    return StreamingResponse(
        streaming_manager.subscribe(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get(
    "/plan/{session_id}/final",
    response_model=FinalPlanResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["planning"],
)
async def get_final_plan(session_id: str, request: Request):
    """Retrieve the finalized plan (only available after approval)."""
    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    graph = _graph(request)
    state = await _get_graph_state(graph, session_id)
    final = state.get("final_plan")

    if final:
        session = await sessions.get(session_id)
        if session:
            start_time = session.get("plan_started_at")
            if start_time:
                record_plan_complete(start_time)

    if not final:
        current_stage = state.get("workflow_stage", "unknown")
        raise HTTPException(
            status_code=409,
            detail=f"Plan not yet finalized. Current stage: {current_stage}",
        )

    return FinalPlanResponse(
        session_id=session_id,
        status="completed",
        final_plan=final,
    )


@router.get(
    "/plan/{session_id}/pricing",
    response_model=PricingResponse,
    responses={404: {"model": ErrorResponse}},
    tags=["planning"],
)
async def get_plan_pricing(session_id: str, request: Request):
    """Return cached live pricing data for the plan, if available."""
    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    graph = _graph(request)
    state = await _get_graph_state(graph, session_id)
    pricing = state.get("pricing_data", {})
    return PricingResponse(
        flights=pricing.get("flights", []),
        hotels=pricing.get("hotels", []),
        available=bool(pricing),
    )


@router.get(
    "/plan/{session_id}/export",
    tags=["planning"],
    summary="Export the finalized plan as PDF or iCal",
    responses={
        200: {
            "content": {
                "application/pdf": {},
                "text/calendar": {},
            },
            "description": "Binary or text export file.",
        },
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        501: {"model": ErrorResponse},
    },
)
async def export_plan(
    session_id: str,
    request: Request,
    format: str = "pdf",
):
    """Export the finalized travel plan as a downloadable file.

    Query parameters
    ----------------
    format : str
        ``"pdf"`` (default) — renders the plan as a styled PDF via WeasyPrint.
        ``"ical"`` — produces a ``.ics`` calendar file with one event per day.

    The endpoint is public (no auth required); the session ID acts as a
    bearer token since only the plan creator knows it.

    Returns HTTP 409 if the plan has not yet been approved/finalized.
    Returns HTTP 501 if the required export library is not installed.
    """
    if format not in ("pdf", "ical"):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported format '{format}'. Choose 'pdf' or 'ical'.",
        )

    sessions = _sessions(request)
    session = await sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Verify the plan is actually finalized
    graph = _graph(request)
    state = await _get_graph_state(graph, session_id)
    workflow_stage = state.get("workflow_stage", "")

    if workflow_stage != "completed":
        raise HTTPException(
            status_code=409,
            detail="Plan not yet finalized. Approve the plan first.",
        )

    final_plan = state.get("final_plan")
    if not final_plan:
        raise HTTPException(
            status_code=409,
            detail="Plan not yet finalized. Approve the plan first.",
        )

    if format == "pdf":
        try:
            pdf_bytes = generate_pdf(final_plan)
        except ImportError as exc:
            raise HTTPException(status_code=501, detail=str(exc))
        except Exception as exc:
            logger.exception("PDF generation failed for session %s", session_id)
            raise HTTPException(status_code=500, detail=f"PDF generation error: {exc}")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=trip-{session_id}.pdf",
            },
        )

    # format == "ical"
    try:
        ics_str = generate_ical(final_plan)
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("iCal generation failed for session %s", session_id)
        raise HTTPException(status_code=500, detail=f"iCal generation error: {exc}")

    return Response(
        content=ics_str,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=trip-{session_id}.ics",
        },
    )


@router.get("/metrics", tags=["system"])
async def metrics():
    """Prometheus metrics endpoint — returns all registered metrics in text format."""
    if not metrics_enabled():
        raise HTTPException(status_code=501, detail="prometheus-client not installed")
    from prometheus_client import generate_latest
    return Response(
        content=generate_latest(),
        media_type="text/plain; version=0.0.4",
    )
