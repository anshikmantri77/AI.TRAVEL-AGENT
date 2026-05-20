"""OpenTelemetry tracing setup and node-level decorator for LangGraph workflows.

Usage:
    from src.observability.tracing import setup_tracing, trace_node

    # On app startup:
    setup_tracing(app)

    # On any async state-graph node:
    @trace_node("node_name")
    async def my_node(state):
        ...
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

_HAS_OTEL: bool = False

try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

    _HAS_OTEL = True
except ImportError:
    logger.info("OpenTelemetry not installed — tracing is a no-op.")


def setup_tracing(app, service_name: str = "tripmind"):
    """Configure OpenTelemetry tracing for the FastAPI application.

    If ``OTEL_ENDPOINT`` is set, spans are exported via OTLP to that URL.
    Otherwise spans are printed to stdout via ``ConsoleSpanExporter``.

    Gracefully degrades when ``opentelemetry`` packages are not installed.
    """
    if not _HAS_OTEL:
        logger.debug("OpenTelemetry packages missing — skipping setup_tracing.")
        return

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    import os

    endpoint = os.getenv("OTEL_ENDPOINT", "").strip()
    if endpoint:
        exporter = OTLPSpanExporter(endpoint=endpoint)
        logger.info("OTLP trace exporter configured for %s", endpoint)
    else:
        exporter = ConsoleSpanExporter()
        logger.debug("ConsoleSpanExporter active — set OTEL_ENDPOINT for remote export.")

    processor = SimpleSpanProcessor(exporter)
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    logger.info("OpenTelemetry tracing initialised (service=%s).", service_name)


def trace_node(name: str) -> Callable:
    """Decorator that wraps an async LangGraph node function in an OTel span.

    The span is automatically named ``f"langgraph.node.{name}"`` and receives
    a ``session_id`` attribute extracted from the first positional argument
    (which should be the ``PlannerState`` dict).

    Usage::

        @trace_node("research")
        async def research(state: PlannerState) -> dict[str, Any]:
            ...

    When OpenTelemetry is not installed the decorator is a transparent
    pass-through — no-op overhead is a single ``isinstance`` check.
    """
    if not _HAS_OTEL:

        def passthrough(fn: Callable) -> Callable:
            return fn

        return passthrough

    tracer = trace.get_tracer("tripmind")

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            session_id: str | None = None
            if args and isinstance(args[0], dict):
                session_id = args[0].get("session_id") or args[0].get("state", {}).get("session_id")
            if not session_id and "state" in kwargs:
                session_id = kwargs["state"].get("session_id")

            with tracer.start_as_current_span(f"langgraph.node.{name}") as span:
                span.set_attribute("node.name", name)
                if session_id:
                    span.set_attribute("session_id", session_id)
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    span.record_exception(exc)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(exc)))
                    raise

        return wrapper

    return decorator
