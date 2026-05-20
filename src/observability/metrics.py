"""Prometheus metrics for the TripMind application.

Usage:
    from src.observability.metrics import record_plan_start, record_plan_complete

    start = record_plan_start()       # increments counter, returns timestamp
    ...
    record_plan_complete(start)       # records duration histogram
"""

from __future__ import annotations

import time

_HAS_PROMETHEUS: bool = False

try:
    from prometheus_client import Counter, Gauge, Histogram, generate_latest

    plan_requests_total = Counter("tripmind_plan_requests_total", "Total plan requests")
    plan_completions_total = Counter("tripmind_plan_completions_total", "Total approvals")
    plan_duration_seconds = Histogram(
        "tripmind_plan_duration_seconds",
        "Plan end-to-end duration in seconds",
        buckets=[5, 10, 30, 60, 120, 300],
    )
    active_sessions = Gauge("tripmind_active_sessions", "Currently active sessions")

    _HAS_PROMETHEUS = True
except ImportError:
    pass


def metrics_enabled() -> bool:
    """Return True if prometheus-client is installed."""
    return _HAS_PROMETHEUS


def record_plan_start() -> float:
    """Increment the requests counter and return the current monotonic time."""
    if _HAS_PROMETHEUS:
        plan_requests_total.inc()
        active_sessions.inc()
    return time.time()


def record_plan_complete(start_time: float) -> None:
    """Record the duration histogram and increment the completion counter."""
    duration = time.time() - start_time
    if _HAS_PROMETHEUS:
        plan_completions_total.inc()
        plan_duration_seconds.observe(duration)
        active_sessions.dec()
