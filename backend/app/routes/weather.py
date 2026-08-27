from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.weather_hub import weather_hub

router = APIRouter(prefix="/api", tags=["Weather"])

@router.get("/weather")
async def get_weather(
    city: Optional[str] = Query(None, description="City name to search"),
    lat: Optional[float] = Query(None, description="Latitude coordinate"),
    lon: Optional[float] = Query(None, description="Longitude coordinate"),
    fresh: Optional[bool] = Query(False, description="Force refresh from upstream provider")
):
    """
    Unified weather endpoint backed by Central Weather Data Hub and Redis live state.
    Supports either city name or exact latitude/longitude coordinates.
    """
    # 1. Coordinate Point Weather
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        try:
            force = bool(fresh) if isinstance(fresh, bool) else False
            return await weather_hub.get_point_weather(float(lat), float(lon), force_refresh=force)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch coordinate weather: {str(exc)}")

    # 2. City Name Weather
    city_str = city if isinstance(city, str) else "Pune"
    city_clean = (city_str or "Pune").strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City name cannot be empty")

    try:
        force = bool(fresh) if isinstance(fresh, bool) else False
        data = await weather_hub.get_weather_for_city(city_clean, force_refresh=force)
        return data
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Weather service error: {str(exc)}")
