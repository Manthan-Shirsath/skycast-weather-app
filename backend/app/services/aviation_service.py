import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger("skycast.aviation")

class AviationService:
    @staticmethod
    async def get_aviation_reports(lat: float, lon: float) -> Dict[str, Any]:
        """Fetch METAR and TAF for nearest airport using AWC API bbox around lat/lon"""
        # Create a bounding box (+/- 1 degree is roughly 111km)
        bbox = f"{lat-1.0},{lon-1.0},{lat+1.0},{lon+1.0}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # Fetch METAR
                metar_url = f"https://aviationweather.gov/api/data/metar?bbox={bbox}&format=json"
                metar_res = await client.get(metar_url)
                metars = metar_res.json() if metar_res.status_code == 200 else []
                
                # Fetch TAF
                taf_url = f"https://aviationweather.gov/api/data/taf?bbox={bbox}&format=json"
                taf_res = await client.get(taf_url)
                tafs = taf_res.json() if taf_res.status_code == 200 else []
                
                closest_metar = metars[0] if isinstance(metars, list) and len(metars) > 0 else {}
                closest_taf = tafs[0] if isinstance(tafs, list) and len(tafs) > 0 else {}
                
                station_id = closest_metar.get("icaoId") or closest_taf.get("icaoId") or "UNKNOWN"
                
                if station_id == "UNKNOWN":
                    return {
                        "status": "unavailable",
                        "message": "No aviation weather stations found within the bounding box."
                    }
                
                return {
                    "status": "success",
                    "station_id": station_id,
                    "metar": closest_metar,
                    "taf": closest_taf,
                    "observation_time": closest_metar.get("obsTime"),
                    "raw_ob": closest_metar.get("rawOb"),
                    "temp": closest_metar.get("temp"),
                    "dewp": closest_metar.get("dewp"),
                    "wdir": closest_metar.get("wdir"),
                    "wspd": closest_metar.get("wspd"),
                    "visib": closest_metar.get("visib"),
                    "flight_category": closest_metar.get("fltcat")
                }
            except Exception as e:
                logger.error("Failed to fetch aviation data: %s", e)
                return {"status": "error", "message": f"Failed to fetch aviation reports: {str(e)}"}
