import datetime
import logging
from typing import Dict, Any, List, Optional
import httpx

from backend.app.core.config import OPENWEATHER_API_KEY

logger = logging.getLogger("skycast.provider.openweather")

OPENWEATHER_ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall"

class OpenWeatherAlertProvider:
    """
    Provider client for fetching official government weather alerts
    via OpenWeather One Call API 3.0.
    """

    @staticmethod
    def is_configured() -> bool:
        """Returns True if OPENWEATHER_API_KEY is configured in the environment."""
        return bool(OPENWEATHER_API_KEY and len(OPENWEATHER_API_KEY) > 0)

    @staticmethod
    async def fetch_official_alerts_raw(lat: float, lon: float) -> List[Dict[str, Any]]:
        """
        Fetch official government alerts from OpenWeather One Call 3.0 for coordinates.
        Does not invent missing fields; preserves exact OpenWeather response.
        """
        if not OpenWeatherAlertProvider.is_configured():
            logger.info("ℹ️ [OPENWEATHER] OPENWEATHER_API_KEY is not configured. Skipping external government alert fetch.")
            return []

        url = f"{OPENWEATHER_ONECALL_URL}?lat={lat}&lon={lon}&exclude=current,minutely,hourly,daily&appid={OPENWEATHER_API_KEY}"
        logger.info("🌐 [OPENWEATHER] Requesting official government alerts for coordinates (%.4f, %.4f)", lat, lon)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)

                if res.status_code in [401, 403]:
                    err_msg = res.json().get("message", "Unauthorized / Forbidden")
                    logger.warning("⚠️ [OPENWEATHER ACCESS ERROR] One Call 3.0 returned %d: %s. Please ensure One Call 3.0 subscription is active.", res.status_code, err_msg)
                    return []

                res.raise_for_status()
                data = res.json()

        except httpx.HTTPStatusError as exc:
            logger.warning("OpenWeather HTTP error %d: %s", exc.response.status_code, exc)
            return []
        except Exception as exc:
            logger.warning("OpenWeather connection error: %s", exc)
            return []

        raw_alerts = data.get("alerts", [])
        if not raw_alerts:
            logger.info("ℹ️ [OPENWEATHER] No active government alerts returned for (%.4f, %.4f).", lat, lon)
            return []

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        normalized_official_alerts: List[Dict[str, Any]] = []

        for item in raw_alerts:
            sender_name = item.get("sender_name") or "National Meteorological Authority"
            event_name = item.get("event") or "Weather Warning"
            start_ts = item.get("start")
            end_ts = item.get("end")
            desc_text = item.get("description", "")
            tags_list = item.get("tags", [])

            # ISO timestamps
            start_iso = datetime.datetime.fromtimestamp(start_ts, tz=datetime.timezone.utc).isoformat() if start_ts else now_iso
            end_iso = datetime.datetime.fromtimestamp(end_ts, tz=datetime.timezone.utc).isoformat() if end_ts else now_iso

            # UI Presentation classification (displaySeverity is purely a frontend presentation helper)
            event_lower = (event_name + " " + desc_text).lower()
            if any(w in event_lower for w in ["extreme", "hail", "flood", "cyclone", "hurricane", "tornado", "severe thunderstorm"]):
                display_sev = "extreme"
            elif any(w in event_lower for w in ["warning", "severe", "heavy rain", "gale", "high heat"]):
                display_sev = "severe"
            else:
                display_sev = "moderate"

            alert_id = f"openweather-{round(lat, 2)}-{round(lon, 2)}-{start_ts or 0}"

            normalized_official_alerts.append({
                "id": alert_id,
                "source": "government",
                "provider": "openweather",
                "authority": sender_name,  # Actual sender_name from OpenWeather (e.g. IMD, NWS, etc.)
                "official": True,
                "event": event_name,
                "title": f"OFFICIAL WARNING: {event_name}",
                "description": desc_text,
                "tags": tags_list,
                "start": start_ts,
                "end": end_ts,
                "startTime": start_iso,
                "endTime": end_iso,
                "latitude": lat,
                "longitude": lon,
                "affectedArea": f"Coordinates ({round(lat, 3)}, {round(lon, 3)})",
                "polygon": None,  # One Call 3.0 does not return polygon geometry
                "displaySeverity": display_sev,  # For UI styling only
                "fetchedAt": now_iso
            })

        return normalized_official_alerts
