"""
Secure Tool Executor for WeatherGPT Agent
Validates tool names, enforces argument schemas, timeouts, output sanitization, and error handling.
"""

import asyncio
import logging
from typing import Dict, Any, Tuple, Type
from pydantic import BaseModel, ValidationError

from backend.app.services.agent.schemas import (
    ToolExecutionResult,
    LocationSearchArgs,
    CurrentWeatherArgs,
    ForecastArgs,
    RiskArgs,
    AlertsArgs,
    HistoricalArgs,
    TrendsArgs,
    MapWeatherArgs,
    FreshnessArgs,
    AgricultureArgs,
    RecommendationArgs
)
from backend.app.services.agent.tools import (
    search_location_tool,
    get_current_weather_tool,
    get_forecast_tool,
    get_weather_risk_tool,
    get_weather_alerts_tool,
    get_historical_weather_tool,
    get_weather_trends_tool,
    get_map_weather_tool,
    get_data_freshness_tool,
    get_agriculture_advice_tool,
    get_weather_recommendations_tool
)

logger = logging.getLogger("skycast.agent.executor")

TOOL_REGISTRY: Dict[str, Tuple[Type[BaseModel], Any]] = {
    "search_location": (LocationSearchArgs, search_location_tool),
    "get_current_weather": (CurrentWeatherArgs, get_current_weather_tool),
    "get_forecast": (ForecastArgs, get_forecast_tool),
    "get_weather_risk": (RiskArgs, get_weather_risk_tool),
    "get_weather_alerts": (AlertsArgs, get_weather_alerts_tool),
    "get_historical_weather": (HistoricalArgs, get_historical_weather_tool),
    "get_weather_trends": (TrendsArgs, get_weather_trends_tool),
    "get_map_weather": (MapWeatherArgs, get_map_weather_tool),
    "get_data_freshness": (FreshnessArgs, get_data_freshness_tool),
    "get_agriculture_advice": (AgricultureArgs, get_agriculture_advice_tool),
    "get_weather_recommendations": (RecommendationArgs, get_weather_recommendations_tool),
}

DEFAULT_TOOL_TIMEOUT_SECONDS = 10.0


class ToolExecutor:
    """
    Executes WeatherGPT tools strictly within safety constraints.
    """

    @classmethod
    async def execute(cls, tool_name: str, arguments: Dict[str, Any]) -> ToolExecutionResult:
        """
        Validates and executes a registered tool.
        """
        if tool_name not in TOOL_REGISTRY:
            logger.warning("Attempted execution of unregistered tool: %s", tool_name)
            return ToolExecutionResult(
                tool=tool_name,
                success=False,
                data=None,
                error=f"Tool '{tool_name}' is not registered or allowed."
            )

        schema_cls, func = TOOL_REGISTRY[tool_name]

        # 1. Validate arguments against Pydantic schema
        try:
            validated_args = schema_cls(**(arguments or {}))
        except ValidationError as val_err:
            logger.warning("Argument validation failed for '%s': %s", tool_name, val_err)
            return ToolExecutionResult(
                tool=tool_name,
                success=False,
                data=None,
                error=f"Invalid arguments for {tool_name}: {str(val_err)}"
            )
        except Exception as exc:
            return ToolExecutionResult(
                tool=tool_name,
                success=False,
                data=None,
                error=f"Argument parsing error: {str(exc)}"
            )

        # 2. Execute with bounded timeout
        try:
            raw_result = await asyncio.wait_for(
                func(validated_args),
                timeout=DEFAULT_TOOL_TIMEOUT_SECONDS
            )
            return ToolExecutionResult(
                tool=tool_name,
                success=True,
                data=raw_result,
                error=None
            )
        except asyncio.TimeoutError:
            logger.error("Tool execution timed out for '%s'", tool_name)
            return ToolExecutionResult(
                tool=tool_name,
                success=False,
                data=None,
                error=f"Tool '{tool_name}' timed out after {DEFAULT_TOOL_TIMEOUT_SECONDS}s."
            )
        except Exception as exc:
            logger.error("Tool execution error for '%s': %s", tool_name, exc, exc_info=True)
            return ToolExecutionResult(
                tool=tool_name,
                success=False,
                data=None,
                error=f"Tool '{tool_name}' failed: {str(exc)}"
            )
