"""
Tests for Research Agent: ClimateService, get_climate_summary_tool, and agent routing.
"""
import pytest
import datetime
from unittest.mock import AsyncMock, MagicMock, patch

# Pre-load agent module to prevent circular import
import backend.app.services.agent  # noqa: F401

from backend.app.services.climate_service import ClimateService, _safe_mean, _safe_min, _safe_max, _safe_sum, _anomaly
from backend.app.services.agent.registry import AgentMode, AgentRegistry
from backend.app.services.agent.agent import WeatherGPTAgent


# -----------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------

MOCK_ARCHIVE_RESPONSE = {
    "daily": {
        "time": ["2026-08-01", "2026-08-02", "2026-08-03"],
        "temperature_2m_max": [34.0, 36.5, 33.0],
        "temperature_2m_min": [24.0, 25.5, 23.0],
        "temperature_2m_mean": [29.0, 31.0, 28.0],
        "precipitation_sum": [0.0, 15.2, 0.0],
        "wind_speed_10m_max": [18.0, 22.0, 14.0],
        "relative_humidity_2m_mean": [72.0, 85.0, 65.0],
    }
}

MOCK_GEO = {
    "latitude": 18.52,
    "longitude": 73.85,
    "name": "Pune",
    "country": "India",
}


@pytest.fixture
def mock_geocode():
    with patch.object(ClimateService, "_geocode", new_callable=AsyncMock, return_value=MOCK_GEO):
        yield


@pytest.fixture
def mock_archive_success():
    with patch.object(ClimateService, "_fetch_archive", new_callable=AsyncMock, return_value=MOCK_ARCHIVE_RESPONSE):
        yield


@pytest.fixture
def mock_archive_failure():
    with patch.object(ClimateService, "_fetch_archive", new_callable=AsyncMock, return_value=None):
        yield


# -----------------------------------------------------------------------
# Unit: Statistics helpers
# -----------------------------------------------------------------------

def test_safe_mean_normal():
    assert _safe_mean([10.0, 20.0, 30.0]) == 20.0


def test_safe_mean_with_nones():
    assert _safe_mean([10.0, None, 30.0]) == 20.0


def test_safe_mean_empty():
    assert _safe_mean([]) is None


def test_safe_min_max_sum():
    vals = [5.0, 10.0, 3.0]
    assert _safe_min(vals) == 3.0
    assert _safe_max(vals) == 10.0
    assert _safe_sum(vals) == 18.0


def test_anomaly():
    assert _anomaly(32.0, 30.0) == 2.0
    assert _anomaly(None, 30.0) is None
    assert _anomaly(32.0, None) is None


# -----------------------------------------------------------------------
# ClimateService: historical data retrieval
# -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_historical_summary_returns_real_stats(mock_geocode, mock_archive_success):
    result = await ClimateService.get_historical_summary(
        city="Pune",
        start_date=datetime.date(2026, 8, 1),
        end_date=datetime.date(2026, 8, 3),
    )
    assert result["city"] == "Pune, India"
    assert result["data_type"] == "observed_historical"
    assert result["data_source"] == "Open-Meteo Archive API (ERA5 reanalysis)"
    assert result["days_covered"] == 3

    temp = result["temperature"]
    assert temp["avg_max_c"] == round((34.0 + 36.5 + 33.0) / 3, 2)
    assert temp["overall_max_c"] == 36.5
    assert temp["overall_max_date"] == "2026-08-02"
    assert temp["overall_min_c"] == 23.0

    rain = result["precipitation"]
    assert rain["total_mm"] == 15.2
    assert rain["rainy_days"] == 1


@pytest.mark.asyncio
async def test_no_hardcoded_values_in_result(mock_geocode, mock_archive_success):
    """Ensure that the summary does NOT contain known legacy hardcoded values."""
    result = await ClimateService.get_historical_summary("Pune")
    # The old hardcoded values should never appear
    assert result.get("averageTemp") is None, "Legacy hardcoded field 'averageTemp' must not exist"
    assert result.get("tempVsLastYear") is None, "Legacy hardcoded field 'tempVsLastYear' must not exist"
    assert result.get("totalRainfall") is None, "Legacy hardcoded field 'totalRainfall' must not exist"


# -----------------------------------------------------------------------
# ClimateService: comparison
# -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_historical_summary_with_comparison(mock_geocode):
    cmp_archive = {
        "daily": {
            "time": ["2026-07-01", "2026-07-02", "2026-07-03"],
            "temperature_2m_max": [31.0, 32.0, 30.0],
            "temperature_2m_min": [22.0, 23.0, 21.0],
            "temperature_2m_mean": [26.5, 27.5, 25.5],
            "precipitation_sum": [10.0, 5.0, 0.0],
            "wind_speed_10m_max": [15.0, 16.0, 12.0],
            "relative_humidity_2m_mean": [70.0, 72.0, 68.0],
        }
    }
    side_effects = [MOCK_ARCHIVE_RESPONSE, cmp_archive]
    with patch.object(ClimateService, "_fetch_archive", new_callable=AsyncMock, side_effect=side_effects):
        result = await ClimateService.get_historical_summary(
            city="Pune",
            start_date=datetime.date(2026, 8, 1),
            end_date=datetime.date(2026, 8, 3),
            compare_start=datetime.date(2026, 7, 1),
            compare_end=datetime.date(2026, 7, 3),
        )

    assert "comparison" in result
    assert "anomaly_temperature_mean_c" in result
    # Current period avg mean = (29+31+28)/3 = 29.33, baseline = (26.5+27.5+25.5)/3 = 26.5
    anomaly = result["anomaly_temperature_mean_c"]
    assert anomaly is not None
    assert anomaly > 0  # Current period is warmer


# -----------------------------------------------------------------------
# ClimateService: API failure handling
# -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_historical_summary_api_failure(mock_geocode, mock_archive_failure):
    result = await ClimateService.get_historical_summary("Pune")
    assert "error" in result
    assert result["data_type"] == "error"
    assert "unavailable" in result["error"].lower()


@pytest.mark.asyncio
async def test_get_historical_summary_geocode_failure():
    with patch.object(ClimateService, "_geocode", new_callable=AsyncMock, return_value=None):
        result = await ClimateService.get_historical_summary("NonexistentCity123")
    assert "error" in result
    assert "geocode" in result["error"].lower()


# -----------------------------------------------------------------------
# Research Agent routing
# -----------------------------------------------------------------------

@pytest.fixture
def agent():
    return WeatherGPTAgent(api_key="dummy", provider="openai", model="test-model")


@pytest.mark.asyncio
async def test_research_agent_routing_bypasses_triage(agent):
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Research response")

            with patch.object(agent, "_load_session_context", return_value=("s1", "Mumbai", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context",
                           return_value=MagicMock(location="Mumbai", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("historical temperature in Mumbai", agent_mode=AgentMode.RESEARCH)

    mock_get_agents.assert_not_called()

    args, _ = mock_runner.call_args
    root_agent = args[0]
    assert root_agent.name == "Research & Climate Agent"


@pytest.mark.asyncio
async def test_research_agent_has_correct_tools(agent):
    with patch("agents.Runner.run") as mock_runner:
        mock_runner.return_value = MagicMock(final_output="Research response")

        with patch.object(agent, "_load_session_context", return_value=("s1", "Delhi", [])):
            with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context",
                       return_value=MagicMock(location="Delhi", to_summary_dict=lambda: {})):
                with patch.object(agent, "_save_message"):
                    await agent.run("climate analysis", agent_mode=AgentMode.RESEARCH)

    research_def = AgentRegistry.get_agent(AgentMode.RESEARCH)
    args, _ = mock_runner.call_args
    root_agent = args[0]

    assert len(root_agent.tools) == len(research_def.allowed_tools)
    tool_names = [t.name for t in root_agent.tools]
    assert "get_climate_summary" in tool_names
    assert "search_location" in tool_names


@pytest.mark.asyncio
async def test_research_agent_prompt_requires_tool_grounding(agent):
    with patch("agents.Runner.run") as mock_runner:
        mock_runner.return_value = MagicMock(final_output="Research response")

        with patch.object(agent, "_load_session_context", return_value=("s1", "Chennai", [])):
            with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context",
                       return_value=MagicMock(location="Chennai", to_summary_dict=lambda: {})):
                with patch.object(agent, "_save_message"):
                    await agent.run("compare temperatures", agent_mode=AgentMode.RESEARCH)

    args, _ = mock_runner.call_args
    root_agent = args[0]
    assert "NEVER invent or estimate" in root_agent.instructions
    assert "OBSERVED HISTORICAL DATA" in root_agent.instructions
