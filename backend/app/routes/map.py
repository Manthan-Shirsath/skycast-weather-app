from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.weather_hub import weather_hub

router = APIRouter(prefix="/api", tags=["Map"])

@router.get("/map/weather")
@router.get("/map/cities")
async def get_map_weather(fresh: Optional[bool] = Query(False, description="Force refresh")):
    """
    Retrieve centralized normalized weather dataset for map cities
    containing Temperature, Rain, Wind, Clouds, Pressure, Humidity, and Visibility.
    """
    try:
        force = bool(fresh) if isinstance(fresh, bool) else False
        return await weather_hub.get_map_weather_dataset(force_refresh=force)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch map weather dataset: {str(exc)}")

@router.get("/radar")
async def get_radar_metadata(fresh: Optional[bool] = Query(False, description="Force refresh")):
    """Retrieve RainViewer radar tile metadata and timestamps."""
    try:
        force = bool(fresh) if isinstance(fresh, bool) else False
        return await weather_hub.get_radar_metadata(force_refresh=force)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch radar metadata: {str(exc)}")

@router.get("/map/point")
async def get_map_point(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    fresh: Optional[bool] = Query(False, description="Force refresh")
):
    """Retrieve point weather for map clicks."""
    try:
        force = bool(fresh) if isinstance(fresh, bool) else False
        return await weather_hub.get_point_weather(float(lat), float(lon), force_refresh=force)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch point weather: {str(exc)}")
