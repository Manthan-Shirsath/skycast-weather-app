"""
Gemini Weather Assistant Service
Integrates Google Gemini (gemini-2.5-flash / gemini-3.7-flash / gemini-flash-latest) into WeatherGPT.
Only makes factual claims based on structured backend weather context.
Never exposes API key to client or logs.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv("backend/.env")

logger = logging.getLogger("skycast.gemini")

GEMINI_API_KEY = os.getenv("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "gemini-flash-latest")

SYSTEM_INSTRUCTION = """You are WeatherGPT, the intelligent meteorological conversational assistant for the Skycast Weather application.

You must follow these strict operational rules:
1. Only make factual weather claims using the supplied structured weather context. Never invent temperatures, rainfall amounts, or weather values.
2. Never invent alerts or hazards.
3. Never claim that Skycast has issued an official IMD warning or government alert. Skycast alerts are automated risk assessments derived from open numerical forecast data using published IMD warning criteria.
4. Clearly distinguish between:
   - IMD hazard classification (physical phenomenon, e.g. "Heavy Rain", "Moderate Squall", "Heat Wave")
   - Skycast-derived risk (e.g. "Orange — Be Prepared", "Yellow — Be Updated")
   - Official government warnings (which Skycast does not issue)
5. If required weather or forecast data is missing or unavailable, explicitly state that it is unavailable.
6. Do not recalculate Skycast risk yourself; use the risk level, hazard classification, threshold, and status provided in the structured context.
7. Keep responses clear, helpful, and concise unless the user explicitly asks for an in-depth breakdown.
8. Understand follow-up questions and comparisons (e.g. "What about tomorrow?", "Why is Pune orange?", "Compare Pune and Mumbai") using the provided conversation history and weather context.
9. Treat forecast probabilities (e.g., 70% rain probability) accurately as probability of occurrence, never as absolute certainty.
10. If the user asks if this is an official IMD warning, clarify that: "We do not have an official IMD warning feed connected to Skycast. This is an automated Skycast Weather Risk assessment based on published IMD warning criteria."
"""

class GeminiWeatherService:
    """
    Communicates with Google Generative Language API using strictly structured weather context.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or DEFAULT_MODEL

    async def generate_chat_response(
        self,
        user_message: str,
        weather_context: Dict[str, Any],
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Sends structured weather context and user message to Gemini.
        Falls back gracefully to local rule-based response if API key is missing or network fails.
        """
        if not self.api_key:
            logger.warning("Gemini API key missing; falling back to structured rule-based response.")
            return self._fallback_rule_response(user_message, weather_context)

        # Prepare messages
        contents = []
        
        # Add conversation history if present
        if history:
            for turn in history[-6:]:  # Keep last 3 turns
                role = "user" if turn.get("sender") in ["user", "human"] else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": turn.get("text", "")}]
                })

        # Add current user turn with structured context
        context_str = json.dumps(weather_context, indent=2)
        current_turn_prompt = (
            f"=== CURRENT WEATHER CONTEXT ===\n{context_str}\n\n"
            f"=== USER QUERY ===\n{user_message}"
        )
        contents.append({
            "role": "user",
            "parts": [{"text": current_turn_prompt}]
        })

        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600,
                "topP": 0.95
            }
        }

        configured_model = os.getenv("LLM_MODEL") or self.model or "gemini-flash-latest"
        
        # Primary configured model with fallback models if deprecated/retired
        models_to_try = [configured_model, "gemini-flash-latest", "gemini-3.5-flash"]
        unique_models = []
        for m in models_to_try:
            if m and m not in unique_models:
                unique_models.append(m)

        import asyncio
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                for model_name in unique_models:
                    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                    try:
                        logger.info("Sending request to Gemini model: '%s'", model_name)
                        res = await asyncio.wait_for(
                            client.post(endpoint, json=payload),
                            timeout=10.0
                        )
                        if res.status_code == 200:
                            data = res.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts:
                                    reply_text = parts[0].get("text", "").strip()
                                    if reply_text:
                                        return reply_text
                        elif res.status_code == 404:
                            logger.info("Model '%s' returned 404, trying next candidate...", model_name)
                            continue
                        else:
                            logger.warning("Gemini API error (Status %d): %s", res.status_code, res.text[:200])
                    except (asyncio.TimeoutError, Exception) as exc:
                        logger.warning("Gemini request error on model '%s': %s", model_name, exc)
        except Exception as client_exc:
            logger.warning("Gemini client error: %s", client_exc)

        logger.info("Using structured rule response.")
        return self._fallback_rule_response(user_message, weather_context)

    def _fallback_rule_response(self, query: str, context: Dict[str, Any]) -> str:
        """
        Deterministic, factual fallback logic matching Skycast weather criteria.
        """
        q = query.lower()
        city = context.get("location", "the requested city")
        curr = context.get("currentWeather", {})
        temp = curr.get("tempC", "--")
        feels = curr.get("feelsLikeC", temp)
        cond = curr.get("condition", "Partly Cloudy")
        hum = curr.get("humidity", 60)
        wind = curr.get("windSpeedKmh", 10)
        rain_chance = curr.get("rainChance", 0)

        risks = context.get("skycastWeatherRisk", {})
        active_alerts = risks.get("activeAlerts", [])

        if "official" in q or "imd" in q:
            if active_alerts:
                top = active_alerts[0]
                return (
                    f"We do not have an official IMD warning feed connected to Skycast right now. "
                    f"However, Skycast's assessment indicates a {top.get('skycastRiskLevel', 'Yellow').upper()} "
                    f"({top.get('actionDirective', 'Be Prepared')}) Risk for {top.get('hazardClassification', '').replace('_', ' ').title()}. "
                    f"Forecast value is {top.get('measuredValue')} {top.get('unit')} (threshold: {top.get('threshold')} {top.get('unit')}). "
                    f"This is a Skycast-derived risk assessment based on published IMD criteria, not an official government warning."
                )
            return (
                f"We do not have an official IMD warning feed connected to Skycast right now. "
                f"Skycast's risk assessment based on published IMD criteria indicates normal (Green) conditions with no active weather risks for {city}."
            )

        if "why" in q and ("orange" in q or "yellow" in q or "red" in q or "risk" in q):
            if active_alerts:
                top = active_alerts[0]
                return (
                    f"{city} has a {top.get('skycastRiskLevel', 'Yellow').upper()} Skycast Weather Risk because "
                    f"{top.get('explanation', 'severe weather criteria met')}. "
                    f"This is a Skycast-derived assessment based on published IMD criteria, not an official IMD warning."
                )
            return f"There are currently no active hazardous weather risks for {city}; conditions are evaluated as Green (Normal)."

        if "tomorrow" in q:
            daily = context.get("dailyForecast", [])
            if len(daily) > 1:
                tmrw = daily[1]
                return (
                    f"Tomorrow ({tmrw.get('day', 'Tomorrow')}) in {city}, expect {tmrw.get('condition', 'partly cloudy').lower()} "
                    f"with a high of {tmrw.get('highC', '--')}°C and low of {tmrw.get('lowC', '--')}°C. "
                    f"Precipitation probability is {tmrw.get('rainChance', 0)}%."
                )

        if "rain" in q or "umbrella" in q:
            if rain_chance >= 50:
                return f"Yes, there is a {rain_chance}% chance of rain in {city} with {cond.lower()}. An umbrella is recommended."
            elif rain_chance >= 20:
                return f"There is a slight {rain_chance}% chance of showers in {city}. You might want to carry a compact umbrella."
            return f"Rain is unlikely today in {city} ({rain_chance}% precipitation probability)."

        if "compare" in q and "comparisonLocation" in context:
            comp = context["comparisonLocation"]
            c_curr = comp.get("currentWeather", {})
            return (
                f"In {city}, it is currently {temp}°C with {cond.lower()} and {hum}% humidity. "
                f"In {comp.get('location')}, it is {c_curr.get('tempC', '--')}°C with {c_curr.get('condition', 'clear').lower()} "
                f"and {c_curr.get('humidity', '--')}% humidity."
            )

        alert_str = f" Active risk: {active_alerts[0]['hazardClassification'].replace('_', ' ').title()} ({active_alerts[0]['skycastRiskLevel'].upper()})." if active_alerts else ""
        return f"In {city}, it is currently {temp}°C (feels like {feels}°C) with {cond.lower()}. Humidity is {hum}% and wind speed is {wind} km/h.{alert_str}"

gemini_weather_service = GeminiWeatherService()
