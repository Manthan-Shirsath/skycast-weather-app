import logging
from typing import Dict, Any, List, Optional
from agents import RunHooks
from backend.app.services.agent.schemas import CardItem

logger = logging.getLogger("skycast.agent.hooks")

def _map_tool_to_card_type(tool_name: str) -> Optional[str]:
    mapping = {
        "get_current_weather": "current_weather",
        "get_forecast": "forecast",
        "get_weather_risk": "risk",
        "get_weather_alerts": "alert",
        "get_historical_weather": "historical",
        "get_weather_trends": "historical",
        "search_location": "location",
        "get_data_freshness": "data_status",
        "get_agriculture_advice": "agriculture",
        "get_weather_recommendations": "recommendation",
        "show_visual_explanation": "visual_explanation",
        "compare_locations": "location_comparison",
        "compare_dates": "date_comparison",
        "show_weather_alert": "weather_alert",
        "analyze_rain": "rain_timeline"
    }
    return mapping.get(tool_name)


class UICardCollectorHook(RunHooks):
    """
    Agents SDK Lifecycle Hook to extract UI cards and state variables
    without polluting the tool business logic or intercepting tool execution.
    """
    def __init__(self, executed_cards: List[CardItem], state_callback):
        self.executed_cards = executed_cards
        self.state_callback = state_callback

    async def on_tool_end(self, context, agent, tool, result: object) -> None:
        if not isinstance(result, dict) or "error" in result:
            return

        t_name = getattr(tool, "name", "")
        if not t_name:
            return

        # City resolution callback
        if t_name in ["search_location", "get_current_weather", "get_forecast", "get_weather_risk"]:
            if "location" in result and self.state_callback:
                self.state_callback(result["location"])
            elif "name" in result and self.state_callback:
                self.state_callback(result["name"])

        # Card extraction logic
        if t_name == "get_forecast":
            target_p = result.get("target_period")
            act_eval = target_p.get("activity_suitability") if target_p else None
            if act_eval:
                self.executed_cards.append(CardItem(type="activity_suitability", data=act_eval))
            elif target_p and (target_p.get("period_type") in ["time_range", "exact_hour"] or result.get("hourly_forecast")):
                self.executed_cards.append(CardItem(type="hourly_forecast", data=result))
            else:
                self.executed_cards.append(CardItem(type="forecast", data=result))
        else:
            card_type = _map_tool_to_card_type(t_name)
            if card_type:
                self.executed_cards.append(CardItem(type=card_type, data=result))
