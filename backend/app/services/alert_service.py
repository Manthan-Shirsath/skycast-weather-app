import datetime
import logging
from typing import Dict, Any, List, Optional

from backend.app.core.config import TTL_ALERTS
from backend.app.core.cache import cache
from backend.app.services.alert_engine import SkycastRiskEngine
from backend.app.services.weather_hub import weather_hub

logger = logging.getLogger("skycast.alert_service")

class AlertDetectionService:
    """
    Centralized Alert Aggregation & Routing Engine.
    Evaluates weather risks using the SkycastRiskEngine (based on published IMD warning criteria)
    strictly over data delivered by the Central Weather Data Hub.
    """

    async def get_alerts_for_location(
        self,
        lat: float,
        lon: float,
        city_name: str,
        weather_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Retrieves unified Skycast weather risks for a location.
        """
        clean_city = city_name.strip().lower()
        cache_key = f"alerts:city:{clean_city}"

        cached = await cache.get(cache_key)
        if cached is not None and isinstance(cached, dict) and "alerts" in cached:
            return cached

        if not weather_data:
            weather_data = await weather_hub.get_weather_for_city(city_name)

        result = SkycastRiskEngine.evaluate_all_risks(
            weather_data=weather_data,
            city_name=city_name,
            display_location=weather_data.get("displayLocation", city_name)
        )

        # Standardize outer response schema for REST & WebSocket consumers
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload = {
            "city": city_name,
            "displayLocation": result.get("displayLocation", city_name),
            "locationProfile": result.get("locationProfile", "normal"),
            "highestRiskColour": result.get("highestRiskColour", "green"),
            "highestRiskAction": result.get("highestRiskAction", "No Action"),
            "hasHazard": result.get("hasHazard", False),
            "hasOfficialAlert": False,  # Transparent: our risks are Skycast-derived, not official IMD warnings
            "officialAlerts": [],
            "alerts": result.get("alerts", []),
            "upcomingRisks": result.get("upcomingRisks", []),
            "count": len(result.get("alerts", [])),
            "updatedAt": now_iso,
            "source": "skycast",
            "official": False,
            "disclaimer": "Skycast weather risks are derived from open numerical weather data based on published IMD warning criteria. They are NOT official IMD warnings."
        }

        await cache.set(cache_key, payload, ttl=TTL_ALERTS)
        return payload

    @staticmethod
    def detect_alerts(
        weather_data: Dict[str, Any],
        city_name: str,
        display_loc: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Static helper returning evaluated Skycast risk alerts for weather normalization."""
        res = SkycastRiskEngine.evaluate_all_risks(weather_data, city_name, display_loc)
        return res.get("alerts", [])

    async def process_and_store_alerts(
        self,
        city_name: str,
        weather_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Processes and caches Skycast risk alerts during collector cycles."""
        lat = weather_data.get("latitude", 18.52)
        lon = weather_data.get("longitude", 73.85)
        return await self.get_alerts_for_location(lat, lon, city_name, weather_data)

    async def get_alerts_for_city(self, city_name: str, weather: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Fetches alerts for a city by checking cache or resolving weather data."""
        if not weather:
            weather = await weather_hub.get_weather_for_city(city_name)
        lat = weather.get("latitude", 18.52)
        lon = weather.get("longitude", 73.85)
        return await self.get_alerts_for_location(lat, lon, city_name, weather)

    async def get_all_active_alerts(self) -> Dict[str, Any]:
        """Fetches aggregated active alerts across primary cities from Redis."""
        cache_key = "alerts:all"
        cached = await cache.get(cache_key)
        if cached is not None and isinstance(cached, dict) and "alerts" in cached:
            return cached

        all_alerts: List[Dict[str, Any]] = []

        try:
            map_data = await weather_hub.get_map_weather_dataset()
            for city_obj in map_data.get("cities", []):
                c_name = city_obj["name"]
                c_lat = city_obj.get("latitude", 18.52)
                c_lon = city_obj.get("longitude", 73.85)
                res = await self.get_alerts_for_location(c_lat, c_lon, c_name, city_obj)
                # Keep active hazardous risks (Yellow, Orange, Red)
                active_only = [
                    a for a in res.get("alerts", [])
                    if a.get("riskColour") in ["yellow", "orange", "red"]
                ]
                all_alerts.extend(active_only)
        except Exception as exc:
            logger.warning("Error computing aggregated alerts: %s", exc)

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        result = {
            "alerts": all_alerts,
            "count": len(all_alerts),
            "updatedAt": now_iso,
            "stale": False,
            "source": "skycast",
            "official": False
        }

        await cache.set(cache_key, result, ttl=TTL_ALERTS)
        return result

alert_service = AlertDetectionService()
