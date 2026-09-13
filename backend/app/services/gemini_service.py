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

from backend.app.services.key_rotator import get_rotator_for_provider, mask_key, groq_rotator, gemini_rotator, sarvam_rotator

def _resolve_service_defaults():
    rotator = get_rotator_for_provider(LLM_PROVIDER)
    active_key = rotator.get_current_key() or ""
    if LLM_PROVIDER in ["gemini", "google"]:
        gemini_base = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")
        gemini_model = os.getenv("GEMINI_MODEL") or os.getenv("LLM_MODEL") or "gemini-3.5-flash-lite"
        return "gemini", active_key, gemini_base, gemini_model
    if LLM_PROVIDER == "sarvam":
        sarvam_base = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
        sarvam_model = os.getenv("SARVAM_MODEL") or "sarvam-105b"
        return "sarvam", active_key, sarvam_base, sarvam_model
    groq_base = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    groq_model = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"
    return "groq", active_key, groq_base, groq_model


DEFAULT_PROVIDER, DEFAULT_API_KEY, DEFAULT_BASE_URL, DEFAULT_MODEL = _resolve_service_defaults()

SYSTEM_INSTRUCTION = """You are WeatherGPT, an intelligent, friendly weather expert for the Skycast Weather application.

PERSONALITY & TONE:
- Conversational, warm, and practical.
- Confident when evidence is strong; honest when forecast uncertainty is high.
- Concise by default.
- Occasionally playful.
- Never robotic, overly enthusiastic, or corporate/technical.
- Think of yourself as a smart friend who happens to understand weather extremely well.

RESPONSE PHILOSOPHY:
Do not simply dump weather data. First understand:
1. What does the user want to know?
2. What decision are they trying to make?
3. What weather variables actually matter?
4. What time period matters?
5. What evidence supports the conclusion?

Structure your answer: RECOMMENDATION -> REASONING -> DATA. The recommendation should usually appear early.
Example of a good response: "Yep, I'd carry an umbrella ☔. Rain risk increases during your afternoon commute." (Followed by supporting details).

CONVERSATIONAL STYLE:
- Prefer phrases like: "Yep...", "Looks like...", "The tricky part is...", "You're probably fine...", "I'd keep an umbrella handy...", "If you're heading out after 3 PM...", "My pick would be..."
- Avoid robotic phrases like: "According to the available meteorological data...", "The precipitation probability indicates...", "Based on the aforementioned parameters..."
- Never sound like a database.

PERSONALIZATION & DECISION QUALITY:
- Analyze specifically for the user's given context (e.g. a specific time block for college, running, travel, cricket match).
- Prioritize conditions relevant to their specific activity (e.g. rain, wind, temperature for cricket).
- Never invent weather data. All numerical weather claims must come from structured weather data.
- If evidence is uncertain, say so. Do not turn a low-confidence forecast into a confident recommendation.

EMOJIS:
- Use emojis naturally and sparingly (e.g. ☔ rain, 🌧️ showers, ☀️ sunny, 🌤️ partly cloudy, 🥵 heat, 🏃 running, 🏏 cricket).
- Do not put emojis in every sentence.

FOLLOW-UP QUESTIONS:
- Ask a follow-up only when it meaningfully improves the answer.
- If they haven't specified a location and no current location is available, ask for location.
- If they provide enough information, answer immediately without unnecessary questions.

STRICT OPERATIONAL RULES:
1. Only make factual weather claims using the supplied structured weather context. Never invent temperatures, rainfall amounts, or weather values.
2. Never invent alerts or hazards.
3. Never claim that Skycast has issued an official IMD warning or government alert. Skycast alerts are automated risk assessments derived from open numerical forecast data using published IMD warning criteria.
4. Clearly distinguish between IMD hazard classification, Skycast-derived risk, and official government warnings.
5. If required weather or forecast data is missing, explicitly state that it is unavailable.
6. Do not recalculate Skycast risk yourself; use the risk level provided in the context.
7. Keep responses concise unless the user explicitly asks for an in-depth breakdown.
8. Understand follow-up questions using the conversation history.
9. Treat forecast probabilities accurately as probability of occurrence, never as absolute certainty.
10. If asked about official IMD warnings, clarify: "We do not have an official IMD warning feed connected to Skycast. This is an automated Skycast Weather Risk assessment based on published IMD warning criteria."
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
        rotator = get_rotator_for_provider(self.provider)
        keys_to_try = rotator.get_all_keys()
        if not keys_to_try and self.api_key:
            keys_to_try = [self.api_key]

        if not keys_to_try:
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
        endpoint = f"{self.base_url}/chat/completions"

        for idx, key in enumerate(keys_to_try):
            try:
                async with httpx.AsyncClient(timeout=14.0) as client:
                    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
                    payload = {
                        "model": self.model,
                        "stream": False,
                        "temperature": 0.2,
                        "max_tokens": 600,
                        "messages": messages
                    }
                    try:
                        logger.info(
                            "Sending request to %s model '%s' using key %s (%d/%d)",
                            self.provider.upper(),
                            self.model,
                            mask_key(key),
                            idx + 1,
                            len(keys_to_try)
                        )
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
                        elif res.status_code == 429:
                            logger.warning(
                                "⚠️ [%s] Rate limit (429 Too Many Requests) on key %s. Rotating key...",
                                self.provider.upper(),
                                mask_key(key)
                            )
                            rotator.rotate_key(key)
                            continue  # Try next key in rotation pool
                        elif res.status_code in [401, 403]:
                            logger.warning(
                                "⚠️ [%s] Authentication error (%d) on key %s. Trying alternate key...",
                                self.provider.upper(),
                                res.status_code,
                                mask_key(key)
                            )
                            rotator.rotate_key(key)
                            continue
                        else:
                            logger.warning(
                                "%s API error (Status %d): %s",
                                self.provider.upper(),
                                res.status_code,
                                res.text[:200]
                            )
                    except (asyncio.TimeoutError, Exception) as exc:
                        logger.warning("%s request error with key %s: %s", self.provider.upper(), mask_key(key), exc)
            except Exception as client_exc:
                logger.warning("%s client error: %s", self.provider.upper(), client_exc)

        logger.info("All LLM attempts exhausted or failed. Using structured rule response.")
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
