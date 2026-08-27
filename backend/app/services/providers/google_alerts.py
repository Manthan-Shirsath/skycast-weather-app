import datetime
import logging
from typing import Dict, Any, List, Optional
import httpx

from backend.app.core.config import GOOGLE_WEATHER_API_KEY

logger = logging.getLogger("skycast.provider.google_alerts")

GOOGLE_PUBLIC_ALERTS_URL = "https://weather.googleapis.com/v1/publicAlerts:lookup"

class GooglePublicAlertProvider:
    """
    Provider client for Google's Weather API Public Alerts (publicAlerts:lookup).
    Primary official government weather alert provider.
    """

    @staticmethod
    def is_configured() -> bool:
        """Returns True if GOOGLE_WEATHER_API_KEY is configured."""
        return bool(GOOGLE_WEATHER_API_KEY and len(GOOGLE_WEATHER_API_KEY.strip()) > 0)

    @staticmethod
    async def fetch_official_alerts_raw(lat: float, lon: float, language_code: str = "en") -> List[Dict[str, Any]]:
        """
        Fetch official public weather alerts from Google Weather API for coordinates.
        Preserves exact publishing authority, eventType, severity, urgency, certainty, and polygon boundaries.
        """
        if not GooglePublicAlertProvider.is_configured():
            logger.info("ℹ️ [GOOGLE ALERTS] GOOGLE_WEATHER_API_KEY is not configured. Skipping Google Public Alerts lookup.")
            return []

        params = {
            "key": GOOGLE_WEATHER_API_KEY,
            "location.latitude": lat,
            "location.longitude": lon,
            "languageCode": language_code
        }

        logger.info("🌐 [GOOGLE ALERTS] Querying publicAlerts:lookup for coordinates (%.4f, %.4f)", lat, lon)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(GOOGLE_PUBLIC_ALERTS_URL, params=params)

                if res.status_code == 404:
                    logger.info("ℹ️ [GOOGLE ALERTS] Google Public Alerts are not available for coordinates (%.4f, %.4f).", lat, lon)
                    return []

                if res.status_code in [401, 403]:
                    err_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                    err_msg = err_json.get("error", {}).get("message", "Permission Denied / Service Disabled")
                    logger.warning("⚠️ [GOOGLE ALERTS ACCESS ERROR] %d: %s", res.status_code, err_msg)
                    return []

                res.raise_for_status()
                data = res.json()

        except httpx.HTTPStatusError as exc:
            logger.warning("Google Public Alerts HTTP error %d: %s", exc.response.status_code, exc)
            return []
        except Exception as exc:
            logger.warning("Google Public Alerts network error: %s", exc)
            return []

        raw_alerts = data.get("weatherAlerts", [])
        if not raw_alerts:
            logger.info("ℹ️ [GOOGLE ALERTS] No active public weather alerts returned for (%.4f, %.4f).", lat, lon)
            return []

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        normalized_alerts: List[Dict[str, Any]] = []

        for item in raw_alerts:
            alert_id = item.get("alertId") or f"google-{round(lat, 2)}-{round(lon, 2)}-{len(normalized_alerts)}"
            
            # Extract localized title
            title_obj = item.get("alertTitle")
            title_str = title_obj.get("text") if isinstance(title_obj, dict) else (title_obj or "Official Weather Alert")

            event_type = item.get("eventType") or "WEATHER_ALERT"

            # Publishing Authority - preserve exact returned string or dict
            pub_auth = item.get("publishingAuthority")
            authority_str = pub_auth.get("name") if isinstance(pub_auth, dict) else (pub_auth or "Official Meteorological Agency")

            # Geographic Area & Polygon
            area_name_obj = item.get("areaName")
            area_name_str = area_name_obj.get("text") if isinstance(area_name_obj, dict) else (area_name_obj or f"Coordinates ({round(lat, 3)}, {round(lon, 3)})")
            
            # Google Polygon structure: list of {latitude, longitude}
            raw_polygon = item.get("polygon", [])
            polygon_coords = None
            if isinstance(raw_polygon, list) and raw_polygon:
                # Normalize to [[lat, lon], [lat, lon], ...] for Leaflet GeoJSON/Polygon compatibility
                polygon_coords = [
                    [pt.get("latitude"), pt.get("longitude")]
                    for pt in raw_polygon
                    if isinstance(pt, dict) and "latitude" in pt and "longitude" in pt
                ]

            # Google Severity / Certainty / Urgency
            severity_str = item.get("severity", "UNKNOWN")
            certainty_str = item.get("certainty", "UNKNOWN")
            urgency_str = item.get("urgency", "UNKNOWN")

            # Description & Instructions
            desc_obj = item.get("description")
            desc_str = desc_obj.get("text") if isinstance(desc_obj, dict) else (desc_obj or "")
            instructions_str = item.get("instructions") or item.get("instruction") or ""
            safety_recs = item.get("safetyRecommendations") or []

            # Timing
            start_time = item.get("startTime") or now_iso
            end_time = item.get("endTime") or now_iso

            # Helper display severity for UI color schemes
            sev_upper = str(severity_str).upper()
            if "EXTREME" in sev_upper:
                display_sev = "extreme"
            elif "SEVERE" in sev_upper:
                display_sev = "severe"
            elif "MODERATE" in sev_upper:
                display_sev = "moderate"
            else:
                display_sev = "moderate"

            normalized_alerts.append({
                "id": alert_id,
                "source": "government",
                "provider": "google_public_alerts",
                "official": True,
                "authority": authority_str,
                "title": title_str,
                "event": event_type,
                "eventType": event_type,
                "areaName": area_name_str,
                "polygon": polygon_coords,
                "severity": severity_str,
                "certainty": certainty_str,
                "urgency": urgency_str,
                "description": desc_str,
                "instructions": instructions_str,
                "safetyRecommendations": safety_recs,
                "startTime": start_time,
                "endTime": end_time,
                "latitude": lat,
                "longitude": lon,
                "affectedArea": area_name_str,
                "displaySeverity": display_sev,
                "fetchedAt": now_iso
            })

        return normalized_alerts
