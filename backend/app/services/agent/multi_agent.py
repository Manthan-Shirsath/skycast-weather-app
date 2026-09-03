"""
WeatherGPT Multi-Agent Architecture
Defines the Triage, Weather, Agriculture, and Climate agents.
"""

from agents import Agent
from backend.app.services.agent.executor import ToolExecutor
from backend.app.services.agent.guardrails import safety_input_guardrail, severe_weather_output_guardrail

def get_agents(model: str = None, dynamic_instruction: str = None) -> Agent:
    """
    Instantiates the multi-agent architecture and returns the entry point (TriageAgent).
    
    The agents share the request-scoped LLM client context managed by `agent.py`.
    Injects dynamic temporal, language, and conversation context into all agents.
    """
    
    # Define tool subsets based on classification
    weather_tool_names = [
        "search_location",
        "get_current_weather", 
        "get_forecast", 
        "get_weather_risk", 
        "get_weather_alerts", 
        "show_weather_alert", 
        "analyze_rain", 
        "get_weather_recommendations",
        "get_map_weather", 
        "get_data_freshness", 
        "compare_locations", 
        "show_visual_explanation"
    ]
    
    ag_tool_names = [
        "get_agriculture_advice", 
        "get_current_weather", 
        "get_forecast", 
        "analyze_rain"
    ]
    
    climate_tool_names = [
        "search_location",
        "get_historical_weather", 
        "get_weather_trends", 
        "compare_dates", 
        "get_data_freshness",
        "show_visual_explanation"
    ]
    
    # Initialize the specific tools
    weather_tools = ToolExecutor.get_openai_tools(weather_tool_names)
    ag_tools = ToolExecutor.get_openai_tools(ag_tool_names)
    climate_tools = ToolExecutor.get_openai_tools(climate_tool_names)
    
    dynamic_suffix = f"\n\n{dynamic_instruction}" if dynamic_instruction else ""
    
    # Define Specialist Agents
    weather_agent = Agent(
        name="WeatherAgent",
        instructions=f"""You are a specialized meteorological agent. 
You handle general weather forecasts, current conditions, severe weather alerts, and radar maps.
Always use the tools provided to fetch accurate weather data before responding.
Format your response based on the conversation context and user role.

GROUNDING RULES:
1. Base all weather observations, temperatures, conditions, and forecasts strictly on data returned by tools.
2. If a tool fails, returns an error, is blocked by guardrails, or indicates data is unavailable, clearly state that live weather data is unavailable.
3. NEVER fabricate, estimate, or invent weather numbers, temperatures, or forecasts when data cannot be retrieved.
4. NEVER claim that a weather observation was 'inferred from surrounding hours', interpolated, or calculated unless that exact provenance is explicitly present in the tool output.{dynamic_suffix}""",
        tools=weather_tools,
        output_guardrails=[severe_weather_output_guardrail],
        model=model
    )
    
    agriculture_agent = Agent(
        name="AgricultureAgent",
        instructions=f"""You are a specialized agricultural weather agent. 
You provide advice to farmers regarding irrigation, crop spraying, and weather-related crop risks.
Use the tools provided to assess weather conditions specifically for agricultural planning.

GROUNDING RULES:
1. Base all agricultural advice and weather data strictly on actual tool outputs.
2. If agricultural data or weather observations cannot be retrieved, clearly state that data is unavailable.
3. Do NOT invent or guess weather conditions or spray/irrigation windows without data.
4. NEVER assert ungrounded provenance claims such as values being 'inferred from surrounding hours'.{dynamic_suffix}""",
        tools=ag_tools,
        output_guardrails=[severe_weather_output_guardrail],
        model=model
    )
    
    climate_agent = Agent(
        name="ClimateAgent",
        instructions=f"""You are a specialized climate and historical weather agent.
You handle queries about historical weather data, long-term trends, and comparisons across different dates.
Focus on statistical patterns and recorded observational data.

GROUNDING RULES:
1. Base all historical observations and trend analytics strictly on recorded tool data.
2. If historical records or trends are insufficient or unavailable, inform the user clearly.
3. NEVER fabricate historical temperatures or past records.
4. NEVER assert ungrounded provenance claims such as values being 'inferred from surrounding hours'.{dynamic_suffix}""",
        tools=climate_tools,
        output_guardrails=[severe_weather_output_guardrail],
        model=model
    )
    
    # Define Triage Agent
    triage_agent = Agent(
        name="TriageAgent",
        instructions=f"""You are the triage agent. Your job is to determine the user's intent and immediately hand off to the appropriate specialist agent.
- If the user asks about current weather, forecasts, general weather alerts, or radar, transfer to WeatherAgent.
- If the user asks about farming, crops, irrigation, or agricultural advice, transfer to AgricultureAgent.
- If the user asks about historical weather, long-term trends, or compares past dates, transfer to ClimateAgent.

Do not answer specialist weather, agriculture, or climate questions yourself. Immediately execute the handoff to the appropriate specialist.
Once handed off, the specialist agent will become the active agent and take over the conversation.{dynamic_suffix}""",
        handoffs=[weather_agent, agriculture_agent, climate_agent],
        input_guardrails=[safety_input_guardrail],
        model=model
    )
    
    return triage_agent
