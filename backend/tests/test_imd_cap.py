import pytest
import datetime
from backend.app.services.providers.imd_cap import ImdCapProvider

# Sample XML strings
VALID_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Heavy to very heavy with extremely heavy rainfall</title>
      <description>Heavy to Very heavy rainfall at few places very likely over Maharashtra and Goa.</description>
      <guid>1234</guid>
      <pubDate>Thu, 03 Sep 2026 07:21:21 +0000</pubDate>
    </item>
    <item>
      <title>Moderate Rain</title>
      <description>Moderate rainfall over Delhi.</description>
      <guid>5678</guid>
      <pubDate>Thu, 03 Sep 2026 07:21:21 +0000</pubDate>
    </item>
  </channel>
</rss>
"""

MALFORMED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Unclosed tag
    </item>
"""

def test_cap_xml_parsing_and_normalization():
    provider = ImdCapProvider()
    result = provider._parse_rss(VALID_XML)
    
    assert result["official_alerts_status"] == "ready"
    alerts = result["alerts"]
    assert len(alerts) == 2
    
    # First alert checks (extreme title -> extreme severity, states extracted)
    assert alerts[0]["title"] == "Heavy to very heavy with extremely heavy rainfall"
    assert alerts[0]["severity"] == "Extreme"
    assert "Maharashtra" in alerts[0]["areas"]
    assert "Goa" in alerts[0]["areas"]
    assert alerts[0]["id"] == "1234"
    assert alerts[0]["source"] == "IMD (WMO Alert Hub)"
    
    # Second alert checks (moderate title -> moderate severity, delhi extracted)
    assert alerts[1]["title"] == "Moderate Rain"
    assert alerts[1]["severity"] == "Moderate"
    assert "Delhi" in alerts[1]["areas"]

def test_malformed_xml():
    provider = ImdCapProvider()
    result = provider._parse_rss(MALFORMED_XML)
    
    assert result["official_alerts_status"] == "unavailable"
    assert result["reason"] == "xml_parse_error"

@pytest.mark.asyncio
async def test_provider_timeout_error(monkeypatch):
    import httpx
    
    async def mock_get(*args, **kwargs):
        raise httpx.TimeoutException("timeout")
        
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    provider = ImdCapProvider()
    
    result = await provider.fetch_official_alerts()
    assert result["official_alerts_status"] == "unavailable"
    assert result["reason"] == "timeout"
