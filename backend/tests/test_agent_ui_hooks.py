import pytest
from backend.app.services.agent.hooks import _map_tool_to_card_type, UICardCollectorHook
from backend.app.services.agent.schemas import CardItem
import asyncio

def test_map_tool_to_card_type():
    assert _map_tool_to_card_type("get_current_weather") == "weather_summary"
    assert _map_tool_to_card_type("get_forecast") == "forecast_timeline"
    assert _map_tool_to_card_type("get_weather_risk") == "decision"
    assert _map_tool_to_card_type("compare_dates") == "date_comparison"

@pytest.mark.asyncio
async def test_ui_card_collector_hook_forecast():
    executed_cards = []
    
    def state_cb(v):
        pass

    hook = UICardCollectorHook(executed_cards, state_cb)
    
    class FakeTool:
        name = "get_forecast"

    # Activity suitability
    await hook.on_tool_end({}, None, FakeTool(), {"target_period": {"activity_suitability": {"is_suitable": True}}})
    assert len(executed_cards) == 1
    assert executed_cards[-1].type == "decision"
    
    # Hourly forecast
    await hook.on_tool_end({}, None, FakeTool(), {"hourly_forecast": []})
    assert len(executed_cards) == 2
    assert executed_cards[-1].type == "forecast_timeline"
