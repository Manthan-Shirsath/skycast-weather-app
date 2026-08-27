from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from backend.app.services.history_service import HistoryService

router = APIRouter(prefix="/api", tags=["trends"])

@router.get("/trends")
async def get_weather_trends(
    city: str = Query("Pune", description="City name to fetch historical trends for"),
    range: str = Query("24h", description="Time window for trends: '24h', '7d', or '30d'"),
    compareWith: Optional[str] = Query(None, description="Optional secondary city for side-by-side comparison")
):
    """
    Retrieve real weather observation analytics and Skycast risk history from PostgreSQL.
    Supports 24 hours, 7 days, and 30 days ranges, plus multi-city comparison.
    """
    clean_range = range.strip().lower()
    if clean_range not in ["24h", "7d", "30d"]:
        clean_range = "24h"

    clean_city = city.strip()
    if not clean_city:
        raise HTTPException(status_code=400, detail="Parameter 'city' is required.")

    clean_compare = compareWith.strip() if compareWith else None

    trends_data = await HistoryService.get_trends(
        city_name=clean_city,
        range_str=clean_range,
        compare_city=clean_compare
    )

    return trends_data
