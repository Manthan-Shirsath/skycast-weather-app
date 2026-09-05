import logging
import datetime
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("skycast.imd_cap")

class ImdCapProvider:
    """
    Fetches and normalizes official IMD alerts from the WMO Alert Hub RSS feed.
    """
    
    FEED_URL = "https://cap-sources.s3.amazonaws.com/in-imd-en/rss.xml"
    
    # Simple dictionary to normalize states from IMD descriptions
    KNOWN_STATES = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Chattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
        "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
        "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
        "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Jammu and Kashmir",
        "Ladakh"
    ]

    async def fetch_official_alerts(self) -> Dict[str, Any]:
        """Fetches the CAP feed and normalizes it."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(self.FEED_URL)
                resp.raise_for_status()
                
            xml_data = resp.text
            return self._parse_rss(xml_data)
        except httpx.TimeoutException:
            logger.error("IMD CAP feed timeout")
            return {"official_alerts_status": "unavailable", "reason": "timeout"}
        except httpx.HTTPError as e:
            logger.error(f"IMD CAP feed HTTP error: {e}")
            return {"official_alerts_status": "unavailable", "reason": "http_error"}
        except Exception as e:
            logger.error(f"IMD CAP feed error: {e}")
            return {"official_alerts_status": "unavailable", "reason": "parse_error"}

    def _parse_rss(self, xml_string: str) -> Dict[str, Any]:
        try:
            root = ET.fromstring(xml_string)
            channel = root.find("channel")
            if channel is None:
                return {"official_alerts_status": "unavailable", "reason": "invalid_schema"}
            
            alerts = []
            
            for item in channel.findall("item"):
                title = item.findtext("title", "")
                link = item.findtext("link", "")
                desc = item.findtext("description", "")
                category = item.findtext("category", "")
                pub_date = item.findtext("pubDate", "")
                guid = item.findtext("guid", "")
                
                # Normalize areas
                areas = self._extract_areas(desc)
                
                # Default severity to High if "extreme" or "heavy" is in title
                severity = "Moderate"
                lower_title = title.lower()
                if "extremely" in lower_title or "red" in lower_title:
                    severity = "Extreme"
                elif "very heavy" in lower_title or "orange" in lower_title:
                    severity = "Severe"
                elif "heavy" in lower_title or "yellow" in lower_title:
                    severity = "Moderate"
                    
                alert_obj = {
                    "source": "IMD (WMO Alert Hub)",
                    "title": title,
                    "severity": severity,
                    "description": desc,
                    "published_at": pub_date,
                    "expires_at": "", # RSS doesn't give expiry, we rely on pubDate
                    "areas": areas,
                    "url": link,
                    "id": guid
                }
                alerts.append(alert_obj)
                
            return {
                "official_alerts_status": "ready",
                "alerts": alerts,
                "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
        except ET.ParseError:
            logger.error("Failed to parse XML from IMD CAP feed")
            return {"official_alerts_status": "unavailable", "reason": "xml_parse_error"}

    def _extract_areas(self, description: str) -> List[str]:
        """Extracts known geographic regions from the free-text description."""
        found = []
        desc_lower = description.lower()
        for state in self.KNOWN_STATES:
            if state.lower() in desc_lower:
                found.append(state)
        return found

imd_cap_provider = ImdCapProvider()
