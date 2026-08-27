from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.alert_service import alert_service

router = APIRouter(prefix="/api", tags=["Alerts"])

@router.get("/alerts")
async def get_weather_alerts(
    city: Optional[str] = Query(None, description="City name to fetch active alerts for")
):
    """
    Retrieve active meteorological weather alerts and safety warnings.
    If 'city' is provided, returns alerts for that specific city.
    If 'city' is omitted, returns aggregated active alerts across all monitored cities.
    Reads from Redis cache.
    """
    try:
        if isinstance(city, str) and city.strip():
            city_clean = city.strip()
            return await alert_service.get_alerts_for_city(city_clean)
        else:
            return await alert_service.get_all_active_alerts()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Alerts retrieval failed: {str(exc)}")
