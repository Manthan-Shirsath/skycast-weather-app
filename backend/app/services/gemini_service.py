"""
Groq & Sarvam-compatible Weather Assistant Service.
Keeps the same structured weather prompt behavior while routing through an OpenAI-compatible chat API.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv("backend/.env")

logger = logging.getLogger("skycast.llm_service")

LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "groq").strip().lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
SARVAM_MODEL = os.getenv("SARVAM_MODEL") or "sarvam-105b"


def _resolve_service_defaults():
    if LLM_PROVIDER == "sarvam":
        return "sarvam", SARVAM_API_KEY, SARVAM_BASE_URL, SARVAM_MODEL
    return "groq", GROQ_API_KEY, GROQ_BASE_URL, GROQ_MODEL


DEFAULT_PROVIDER, DEFAULT_API_KEY, DEFAULT_BASE_URL, DEFAULT_MODEL = _resolve_service_defaults()

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
    Back-compat wrapper; the app uses the Groq / Sarvam OpenAI-compatible backend path while preserving
    the existing service name to avoid broader code churn.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = DEFAULT_API_KEY if api_key is None else api_key
        self.base_url = DEFAULT_BASE_URL if base_url is None else base_url.rstrip("/")
        self.model = DEFAULT_MODEL if model is None else model
        self.provider = DEFAULT_PROVIDER

    async def generate_chat_response(
        self,
        user_message: str,
        weather_context: Dict[str, Any],
        history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Sends structured weather context and user message to Groq / Sarvam.
        Falls back gracefully to local rule-based response if API key is missing or network fails.
        """
        if not self.api_key:
            logger.warning("[%s] API key missing; falling back to structured rule-based response.", self.provider.upper())
            return self._fallback_rule_response(user_message, weather_context)

        messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]

        if history:
            for turn in history[-6:]:
                role = "user" if turn.get("sender") in ["user", "human"] else "assistant"
                messages.append({
                    "role": role,
                    "content": turn.get("text", "")
                })

        context_str = json.dumps(weather_context, indent=2)
        current_turn_prompt = (
            f"=== CURRENT WEATHER CONTEXT ===\n{context_str}\n\n"
            f"=== USER QUERY ===\n{user_message}"
        )
        messages.append({
            "role": "user",
            "content": current_turn_prompt
        })

        import asyncio
        try:
            async with httpx.AsyncClient(timeout=14.0) as client:
                endpoint = f"{self.base_url}/chat/completions"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": self.model,
                    "stream": False,
                    "temperature": 0.2,
                    "max_tokens": 600,
                    "messages": messages
                }
                try:
                    logger.info("Sending request to %s model: '%s'", self.provider.upper(), self.model)
                    res = await asyncio.wait_for(
                        client.post(endpoint, headers=headers, json=payload),
                        timeout=12.0
                    )
                    if res.status_code == 200:
                        data = res.json()
                        choices = data.get("choices", [])
                        if choices:
                            raw_reply = choices[0].get("message", {}).get("content") or ""
                            reply_text = re.sub(r'<think>[\s\S]*?</think>', '', raw_reply).strip()
                            if reply_text:
                                return reply_text
                    else:
                        logger.warning("%s API error (Status %d): %s", self.provider.upper(), res.status_code, res.text[:200])
                except (asyncio.TimeoutError, Exception) as exc:
                    logger.warning("%s request error: %s", self.provider.upper(), exc)
        except Exception as client_exc:
            logger.warning("%s client error: %s", self.provider.upper(), client_exc)

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
