"""
System Health & Metrics Endpoint
Exposes cache hit rate, latency metrics, and WebSocket connection counts.
"""

from fastapi import APIRouter, HTTPException
from backend.app.services.metrics import metrics_collector

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/system/metrics")
async def get_system_metrics():
    """
    Return comprehensive system metrics for monitoring and admin dashboards.

    Response includes:
    - Cache hit rate and counts
    - Request latency (average, P95, P99)
    - Active WebSocket connections
    - Uptime
    - Per-endpoint statistics

    This endpoint can be polled periodically or embedded in an admin dashboard
    to visualize real-time system performance.
    """
    try:
        metrics = metrics_collector.get_metrics_summary()
        return {
            "status": "ok",
            "metrics": metrics
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Metrics collection failed: {str(exc)}")


@router.get("/system/health")
async def get_system_health():
    """
    Simple health check endpoint for load balancers and monitoring systems.
    """
    try:
        metrics = metrics_collector.get_metrics_summary()

        # Determine overall health based on metrics
        cache_hit_rate = metrics["cache"]["hit_rate_pct"]
        avg_latency = metrics["requests"]["average_latency_ms"]

        # Simple heuristics for health status
        if cache_hit_rate < 20 or avg_latency > 5000:
            status = "degraded"
        else:
            status = "healthy"

        return {
            "status": status,
            "uptime_seconds": metrics["uptime_seconds"],
            "cache_hit_rate_pct": cache_hit_rate,
            "average_latency_ms": avg_latency,
            "active_connections": metrics["websockets"]["active_connections"]
        }
    except Exception as exc:
        return {
            "status": "error",
            "detail": str(exc)
        }
