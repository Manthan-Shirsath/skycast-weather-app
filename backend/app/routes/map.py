from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response, Path as FPath
from backend.app.services.weather_hub import weather_hub
from backend.app.core.config import OPENWEATHER_API_KEY
import httpx
import logging

logger = logging.getLogger("skycast.routes.map")

router = APIRouter(prefix="/api", tags=["Map"])

# Valid OWM tile layers (whitelist for security)
VALID_OWM_LAYERS = {
    "clouds_new",        # Cloud coverage
    "precipitation_new", # Precipitation intensity
    "pressure_new",      # Atmospheric pressure
    "wind_new",          # Wind speed
    "temp_new",          # Surface temperature
}

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

@router.get("/tiles/owm/{layer}/{z}/{x}/{y}.png", response_class=Response)
async def proxy_owm_tile(
    layer: str = FPath(..., description="OWM layer name"),
    z: int = FPath(..., description="Zoom level"),
    x: int = FPath(..., description="Tile X"),
    y: int = FPath(..., description="Tile Y"),
):
    """
    Proxy OpenWeatherMap weather tiles securely — API key stays server-side.
    Available layers: clouds_new, precipitation_new, pressure_new, wind_new, temp_new
    """
    if layer not in VALID_OWM_LAYERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid layer '{layer}'. Must be one of: {', '.join(VALID_OWM_LAYERS)}"
        )

    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=503, detail="OpenWeatherMap API key not configured on server.")

    owm_url = f"https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={OPENWEATHER_API_KEY}"
    logger.debug("🌐 [TILE PROXY] OWM %s tile z=%d x=%d y=%d", layer, z, x, y)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(owm_url)
            return Response(
                content=res.content,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=300",
                    "Access-Control-Allow-Origin": "*",
                }
            )
    except Exception as exc:
        logger.warning("OWM tile proxy failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Failed to fetch OWM tile: {str(exc)}")
