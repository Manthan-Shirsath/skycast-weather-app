import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger("skycast.marine")

class MarineService:
    @staticmethod
    async def get_marine_forecast(lat: float, lon: float) -> Dict[str, Any]:
        """Fetch Marine forecast data from Open-Meteo Marine API"""
        url = (
            f"https://marine-api.open-meteo.com/v1/marine"
            f"?latitude={lat}&longitude={lon}"
            f"&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction"
            f"&timezone=auto"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(url)
                res.raise_for_status()
                data = res.json()
                
                hourly = data.get("hourly", {})
                times = hourly.get("time", [])
                
                if not times:
                    return {
                        "status": "unavailable",
                        "message": "No marine data available for these coordinates (may be too far inland)."
                    }
                
                # Just return the full payload; the LLM will parse what it needs
                return {
                    "status": "success",
                    "marine_data": {
                        "latitude": data.get("latitude"),
                        "longitude": data.get("longitude"),
                        "timezone": data.get("timezone"),
                        "hourly": hourly
                    }
                }
            except Exception as e:
                logger.error("Failed to fetch marine data: %s", e)
                return {"status": "error", "message": f"Failed to fetch marine forecast: {str(e)}"}
