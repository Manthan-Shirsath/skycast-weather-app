"""
Phase 4 Alert Monitoring API Routes

Endpoints:
  POST /api/v1/alerts/monitor       — create a monitored context (explicit user opt-in)
  DELETE /api/v1/alerts/monitor/{id} — disable a monitor
  GET  /api/v1/alerts/monitors       — list monitors for a session
  POST /api/v1/alerts/trigger_check  — manually run the monitoring engine
  GET  /api/v1/alerts/history        — retrieve alert history for a session

Session isolation: all endpoints require session_id. Alerts are scoped strictly
to that session. One session cannot read another session's alerts.
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from backend.app.services.forecast_monitor import (
    create_monitor,
    get_monitor,
    get_monitors_for_session,
    disable_monitor,
    run_monitor_check,
    get_alert_history,
)

logger = logging.getLogger("skycast.routes.monitoring")

router = APIRouter(prefix="/api/v1/alerts", tags=["Monitoring"])


# ── Request / Response Models ─────────────────────────────────────────────────

class CreateMonitorRequest(BaseModel):
    session_id: str = Field(..., description="Session ID of the requesting user")
    location: str = Field(..., description="Location to monitor, e.g. 'Pune'")
    activity: Optional[str] = Field(None, description="Activity context, e.g. 'cricket'")
    target_date: Optional[str] = Field(None, description="ISO date string, e.g. '2026-09-07'")
    target_hour: Optional[int] = Field(None, description="Target hour (0-23)")
    time_label: Optional[str] = Field(None, description="Time label: morning/afternoon/evening/night")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TriggerCheckRequest(BaseModel):
    session_id: str = Field(..., description="Session ID")
    monitor_id: Optional[str] = Field(None, description="Specific monitor ID. If omitted, checks all monitors for the session.")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/monitor", summary="Create a monitored weather context (explicit user opt-in)")
async def create_weather_monitor(req: CreateMonitorRequest = Body(...)):
    """
    Explicit user action to start monitoring a location/activity/time.
    This is NOT called automatically on every forecast query.
    """
    if not req.session_id or not req.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    if not req.location or not req.location.strip():
        raise HTTPException(status_code=400, detail="location is required")

    try:
        monitor = await create_monitor(
            session_id=req.session_id.strip(),
            location=req.location.strip(),
            activity=req.activity,
            target_date=req.target_date,
            target_hour=req.target_hour,
            time_label=req.time_label,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        return {
            "success": True,
            "monitor": monitor,
            "message": f"Now monitoring {req.location}" + (f" for {req.activity}" if req.activity else ""),
        }
    except Exception as exc:
        logger.exception("Error creating monitor")
        raise HTTPException(status_code=500, detail=f"Failed to create monitor: {exc}")


@router.delete("/monitor/{monitor_id}", summary="Disable a weather monitor")
async def delete_weather_monitor(monitor_id: str, session_id: str = Query(...)):
    """Disable (soft-delete) a monitor. Requires session_id for ownership check."""
    monitor = await get_monitor(monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    if monitor.get("session_id") != session_id:
        raise HTTPException(status_code=403, detail="Access denied: monitor belongs to a different session")

    success = await disable_monitor(monitor_id)
    return {"success": success, "monitor_id": monitor_id}


@router.get("/monitors", summary="List active monitors for a session")
async def list_monitors(session_id: str = Query(...)):
    """Returns all active monitors for the given session."""
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    monitors = await get_monitors_for_session(session_id.strip())
    return {"session_id": session_id, "monitors": monitors, "count": len(monitors)}


@router.post("/trigger_check", summary="Manually trigger the forecast monitoring engine")
async def trigger_monitor_check(req: TriggerCheckRequest = Body(...)):
    """
    Manually trigger the monitoring engine for one or all session monitors.

    This endpoint is the primary mechanism for Phase 4 MVP.
    It can be called by:
    - Developer / testing
    - Future scheduler integration
    - Frontend 'Refresh' button

    Returns detailed results per monitor checked.
    """
    if not req.session_id or not req.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")

    session_id = req.session_id.strip()
    results: List[Dict[str, Any]] = []

    if req.monitor_id:
        # Check ownership
        monitor = await get_monitor(req.monitor_id)
        if not monitor:
            raise HTTPException(status_code=404, detail="Monitor not found")
        if monitor.get("session_id") != session_id:
            raise HTTPException(status_code=403, detail="Access denied")
        result = await run_monitor_check(req.monitor_id)
        results.append(result)
    else:
        monitors = await get_monitors_for_session(session_id)
        if not monitors:
            return {
                "checked": False,
                "session_id": session_id,
                "reason": "no_active_monitors",
                "results": [],
            }
        for m in monitors:
            result = await run_monitor_check(m["monitor_id"])
            results.append(result)

    any_alert = any(r.get("alert_created") for r in results)
    alerts = [r.get("alert") for r in results if r.get("alert_created") and r.get("alert")]

    return {
        "checked": True,
        "session_id": session_id,
        "monitors_checked": len(results),
        "alerts_created": len(alerts),
        "results": results,
        "alerts": alerts,
    }


@router.get("/history", summary="Retrieve alert history for a session")
async def get_history(session_id: str = Query(...)):
    """
    Returns recent alert history for the given session.
    Scoped strictly to the provided session_id — one session cannot read another's alerts.
    """
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")
    alerts = await get_alert_history(session_id.strip())
    return {
        "session_id": session_id,
        "count": len(alerts),
        "alerts": alerts,
    }
