import logging
from typing import Dict, Any
import httpx

logger = logging.getLogger("skycast.provider.rainviewer")

RAINVIEWER_MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json"

async def fetch_radar_maps_raw() -> Dict[str, Any]:
    """Fetch raw RainViewer radar maps metadata."""
    logger.info("🌐 [PROVIDER CALL] RainViewer Radar maps API")
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(RAINVIEWER_MAPS_URL)
        res.raise_for_status()
        return res.json()
