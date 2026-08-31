import json
import hashlib
import logging
import asyncio
import httpx
from typing import Dict, Any, Optional
from backend.app.services.gemini_service import DEFAULT_API_KEY, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PROVIDER

logger = logging.getLogger("skycast.forecast_ai")

_AI_CACHE: Dict[str, str] = {}

SYSTEM_INSTRUCTION = """You are SkyCast Forecast Intelligence AI.
You receive structured deterministic analytics about multi-model weather forecasts (spread, consensus, min, max, agreement categories).
Your task is to interpret this data into a short, clear, non-alarmist summary for the user.

STRICT RULES:
1. ONLY use the provided structured data. DO NOT invent forecast values, dates, or models.
2. DO NOT calculate probabilities or certainty percentages that are not in the data.
3. Keep the summary under 3-4 sentences.
4. Focus on where models agree (e.g., "High agreement on temperature dropping Monday") and where they disagree (e.g., "High uncertainty regarding precipitation amount on Wednesday").
5. Do not rank models or claim one is more accurate.
6. Use the terms "Model Consensus" and "Model Spread".
"""

class ForecastAIService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = DEFAULT_API_KEY if api_key is None else api_key
        self.base_url = DEFAULT_BASE_URL if base_url is None else base_url.rstrip("/")
        self.model = DEFAULT_MODEL if model is None else model
        self.provider = DEFAULT_PROVIDER

    def _generate_cache_key(self, location: str, analytics_data: Dict[str, Any]) -> str:
        # Create a canonical representation of the input
        canonical_str = json.dumps({"location": location, "analytics": analytics_data}, sort_keys=True)
        return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    async def get_analysis(self, location: str, analytics_data: Dict[str, Any]) -> str:
        """
        Retrieves AI analysis for the given analytics data, using a cache to avoid redundant calls.
        """
        cache_key = self._generate_cache_key(location, analytics_data)
        if cache_key in _AI_CACHE:
            logger.info("ForecastAIService: Cache hit for %s", location)
            return _AI_CACHE[cache_key]

        if not self.api_key:
            logger.warning("ForecastAIService: API key missing, returning fallback.")
            return "AI Analysis is currently unavailable due to missing API configuration."

        messages = [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {
                "role": "user", 
                "content": f"Location: {location}\n\nAnalytics Data:\n{json.dumps(analytics_data, indent=2)}\n\nPlease provide a brief analysis."
            }
        ]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                endpoint = f"{self.base_url}/chat/completions"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": self.model,
                    "stream": False,
                    "temperature": 0.2,
                    "max_tokens": 200,
                    "messages": messages
                }
                
                logger.info("ForecastAIService: Generating analysis for %s using %s", location, self.model)
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        raw_reply = choices[0].get("message", {}).get("content") or ""
                        # Simple cleanup if any <think> tags leak
                        import re
                        reply_text = re.sub(r'<think>[\s\S]*?</think>', '', raw_reply).strip()
                        if reply_text:
                            _AI_CACHE[cache_key] = reply_text
                            return reply_text
                else:
                    logger.error("ForecastAIService API error: Status %d %s", res.status_code, res.text[:200])
        except Exception as exc:
            logger.error("ForecastAIService request failed: %s", exc)

        return "SkyCast analysis unavailable at this moment."

forecast_ai_service = ForecastAIService()
