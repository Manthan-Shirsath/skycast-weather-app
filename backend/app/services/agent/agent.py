"""
WeatherGPT AI Weather Agent
Orchestrates multi-turn conversation, persistent memory, Gemini function calling,
bounded tool execution loops, and structured response synthesis.
"""

import os
import re
import json
import uuid
import datetime
import logging
import asyncio
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv
from sqlalchemy import select

from backend.app.core.database import async_session_factory, is_db_available
from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.services.weather_hub import weather_hub
from backend.app.services.alert_service import alert_service
from backend.app.services.agent.schemas import (
    AgentResponse,
    CardItem,
    SourceItem,
    ToolExecutionResult
)
from backend.app.services.agent.executor import ToolExecutor
from backend.app.services.agent.prompts import (
    SYSTEM_INSTRUCTION,
    GEMINI_TOOLS_DECLARATION
)

load_dotenv("backend/.env")

logger = logging.getLogger("skycast.agent")

GEMINI_API_KEY = os.getenv("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_FALLBACK = os.getenv("gemini_api_key_fallback") or os.getenv("GEMINI_API_KEY_FALLBACK", "")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "gemini-flash-latest")
MAX_TOOL_CALLS = int(os.getenv("MAX_TOOL_CALLS", "8"))


class WeatherGPTAgent:
    """
    Intelligent AI Agent for WeatherGPT with Gemini Function Calling and Central Data Grounding.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tool_calls: int = MAX_TOOL_CALLS
    ):
        self.api_key = GEMINI_API_KEY if api_key is None else api_key
        self.api_key_fallback = GEMINI_API_KEY_FALLBACK
        self.model = DEFAULT_MODEL if model is None else model
        self.max_tool_calls = max_tool_calls
        logger.info(
            "🤖 [INIT] WeatherGPT Agent initialized with model: '%s' (max_tool_calls=%d, api_key_configured=%s)",
            self.model,
            self.max_tool_calls,
            bool(self.api_key and len(self.api_key) > 10)
        )

    async def run(
        self,
        message: str,
        session_id: Optional[str] = None,
        default_city: Optional[str] = None,
        language: str = "en"
    ) -> AgentResponse:
        """
        Executes the agent lifecycle for a user message.
        """
        user_text = (message or "").strip()
        if not user_text:
            return AgentResponse(
                reply="Please enter a question or location to check the weather.",
                city=default_city or "Pune",
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                session_id=session_id
            )

        # 1. Resolve or Create Persistent Chat Session
        session_id, location_context, history_turns = await self._load_session_context(
            session_id=session_id,
            default_city=default_city,
            language=language
        )

        active_city = location_context or default_city or "Pune"

        # Check if user mentioned an explicit new city
        extracted_city = self._detect_city_in_query(user_text)
        if extracted_city and extracted_city.lower() != active_city.lower():
            active_city = extracted_city
            # Update session location context in DB
            await self._update_session_location(session_id, active_city)

        # 2. Check for Gemini Availability
        if not self.api_key or len(self.api_key) < 20:
            logger.info("Gemini API key not configured; using deterministic centralized fallback.")
            return await self._execute_deterministic_fallback(
                user_text=user_text,
                city=active_city,
                session_id=session_id,
                history_turns=history_turns,
                language=language
            )

        # 3. Execute Gemini Function Calling Loop
        try:
            agent_response = await self._run_gemini_loop(
                user_text=user_text,
                session_id=session_id,
                active_city=active_city,
                history_turns=history_turns,
                language=language
            )
            return agent_response
        except Exception as exc:
            logger.warning("Gemini agent loop encountered error: %s; falling back to centralized rules", exc)
            return await self._execute_deterministic_fallback(
                user_text=user_text,
                city=active_city,
                session_id=session_id,
                history_turns=history_turns,
                language=language,
                degraded=True
            )

    @staticmethod
    def _detect_city_in_query(text: str) -> Optional[str]:
        """Simple extraction of common known city names if explicitly mentioned."""
        known = [
            "mumbai", "pune", "delhi", "new delhi", "bengaluru", "bangalore",
            "chennai", "hyderabad", "kolkata", "ahmedabad", "jaipur", "lucknow",
            "goa", "tokyo", "london", "paris", "new york", "singapore"
        ]
        t_lower = text.lower()
        for k in known:
            if re.search(r'\b' + re.escape(k) + r'\b', t_lower):
                return k.title()
        return None

    # Language code → display name for Gemini instruction
    _LANG_NAMES: Dict[str, str] = {
        "en": "English",
        "hi": "Hindi (हिन्दी)",
        "mr": "Marathi (मराठी)",
        "ta": "Tamil (தமிழ்)",
        "te": "Telugu (తెలుగు)",
        "bn": "Bengali (বাংলা)",
        "gu": "Gujarati (ગુજરાતી)",
        "kn": "Kannada (ಕನ್ನಡ)",
        "ml": "Malayalam (മലയാളം)",
        "pa": "Punjabi (ਪੰਜਾਬੀ)",
        "or": "Odia (ଓଡ଼ିଆ)",
    }

    def _build_system_instruction(self, language: str) -> str:
        """Prepend a response-language directive to the base system instruction."""
        lang_name = self._LANG_NAMES.get(language, "English")
        if language == "en":
            return SYSTEM_INSTRUCTION
        directive = (
            f"RESPONSE LANGUAGE DIRECTIVE (HIGHEST PRIORITY):\n"
            f"The user interface is set to {lang_name}. "
            f"You MUST respond entirely in {lang_name}. "
            f"All your narrative text, explanations, recommendations, and advisory paragraphs must be written in {lang_name}. "
            f"Keep all numeric values (temperatures in °C, wind speed in km/h, percentages) as-is. "
            f"Do NOT respond in English unless the user's message itself is in English.\n\n"
        )
        return directive + SYSTEM_INSTRUCTION

    async def _run_gemini_loop(
        self,
        user_text: str,
        session_id: str,
        active_city: str,
        history_turns: List[Dict[str, Any]],
        language: str = "en"
    ) -> AgentResponse:
        """
        Runs bounded multi-turn tool calling loop with Gemini.
        """
        contents: List[Dict[str, Any]] = []

        for h in history_turns[-6:]:
            role = "user" if h.get("role") in ["user", "human"] else "model"
            contents.append({
                "role": role,
                "parts": [{"text": h.get("content", "")}]
            })

        contents.append({
            "role": "user",
            "parts": [{"text": user_text}]
        })

        payload = {
            "system_instruction": {
                "parts": [{"text": self._build_system_instruction(language)}]
            },
            "contents": contents,
            "tools": [
                {
                    "function_declarations": GEMINI_TOOLS_DECLARATION
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 900,
                "topP": 0.95
            }
        }

        configured_model = os.getenv("LLM_MODEL") or self.model or "gemini-flash-latest"
        models_to_try = [configured_model, "gemini-flash-latest", "gemini-3.5-flash"]
        unique_models = []
        for m in models_to_try:
            if m and m not in unique_models:
                unique_models.append(m)

        tool_calls_executed = 0
        executed_cards: List[CardItem] = []
        sources: List[SourceItem] = [
            SourceItem(
                type="central_weather_data",
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                provider="open_meteo"
            )
        ]
        resolved_city = active_city

        async with httpx.AsyncClient(timeout=8.0) as client:
            for iteration in range(self.max_tool_calls + 1):
                response_data = None

                # Build ordered list of (api_key, model) pairs to attempt.
                # Primary key first; fallback key injected when primary hits 429.
                keys_to_try = [self.api_key]
                if self.api_key_fallback and self.api_key_fallback != self.api_key and len(self.api_key_fallback) > 20:
                    keys_to_try.append(self.api_key_fallback)

                for api_key in keys_to_try:
                    if response_data:
                        break
                    for model_name in unique_models:
                        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                        try:
                            res = await client.post(endpoint, json=payload, timeout=5.0)
                            if res.status_code == 200:
                                response_data = res.json()
                                if api_key == self.api_key_fallback:
                                    logger.info("[KEY ROTATION] Using fallback Gemini key (primary quota exhausted).")
                                break
                            elif res.status_code == 429:
                                logger.warning("[429] Quota exceeded on key ...%s model '%s' — trying next.", api_key[-6:], model_name)
                                continue  # try next model / next key
                            elif res.status_code == 404:
                                continue
                            else:
                                logger.warning("Gemini error (%d): %s", res.status_code, res.text[:200])
                        except Exception as req_err:
                            logger.warning("Request failed to Gemini model '%s': %s", model_name, req_err)

                if not response_data:
                    raise RuntimeError("Failed to communicate with any Gemini model endpoint.")

                candidates = response_data.get("candidates", [])
                if not candidates:
                    raise RuntimeError("Gemini returned empty candidates.")

                candidate_content = candidates[0].get("content", {})
                parts = candidate_content.get("parts", [])

                function_calls = [p.get("functionCall") for p in parts if "functionCall" in p]

                if not function_calls or tool_calls_executed >= self.max_tool_calls:
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    reply_text = "".join(text_parts).strip()
                    if not reply_text:
                        reply_text = "I have retrieved the centralized weather data for your request."

                    await self._save_message(session_id, "user", user_text)
                    await self._save_message(session_id, "model", reply_text)

                    return AgentResponse(
                        reply=reply_text,
                        city=resolved_city,
                        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        session_id=session_id,
                        cards=executed_cards,
                        sources=sources,
                        data_status="fresh"
                    )

                contents.append(candidate_content)

                tool_response_parts = []
                for fc in function_calls:
                    tool_name = fc.get("name")
                    tool_args = fc.get("args", {})
                    tool_calls_executed += 1

                    logger.info("Executing Tool [%d/%d]: %s(%s)", tool_calls_executed, self.max_tool_calls, tool_name, tool_args)

                    exec_res = await ToolExecutor.execute(tool_name, tool_args)

                    if tool_name in ["search_location", "get_current_weather", "get_forecast", "get_weather_risk"]:
                        if exec_res.success and isinstance(exec_res.data, dict) and "location" in exec_res.data:
                            resolved_city = exec_res.data["location"]
                        elif exec_res.success and isinstance(exec_res.data, dict) and "name" in exec_res.data:
                            resolved_city = exec_res.data["name"]

                    if exec_res.success and exec_res.data:
                        card_type = self._map_tool_to_card_type(tool_name)
                        if card_type:
                            executed_cards.append(CardItem(type=card_type, data=exec_res.data if isinstance(exec_res.data, dict) else {"result": exec_res.data}))

                    tool_response_parts.append({
                        "functionResponse": {
                            "name": tool_name,
                            "response": {
                                "success": exec_res.success,
                                "data": exec_res.data,
                                "error": exec_res.error
                            }
                        }
                    })

                contents.append({
                    "role": "user",
                    "parts": tool_response_parts
                })

                payload["contents"] = contents

        return await self._execute_deterministic_fallback(user_text, resolved_city, session_id, history_turns=history_turns, language=language)

    @staticmethod
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
            "get_weather_recommendations": "recommendation"
        }
        return mapping.get(tool_name)

    # -----------------------------------------------------------------------
    # Fallback multilingual phrase bank (used when Gemini quota is exhausted)
    # Keys: template IDs; Values: dict of lang_code → translated template
    # {city}, {temp}, {cond}, {humidity}, {wind}, {rain}, {alert}, {day},
    # {high}, {low}, {crop}, {spray}, {window} are replaced at render time.
    # -----------------------------------------------------------------------
    _FALLBACK_PHRASES: Dict[str, Dict[str, str]] = {
        "current": {
            "en": "In {city}, it is currently {temp}°C (feels like {feels}°C) with {cond}. Humidity is {humidity}% and wind is {wind} km/h.{alert}",
            "hi": "{city} में अभी {temp}°C (महसूस {feels}°C) तापमान है, मौसम {cond} है। आर्द्रता {humidity}% और हवा {wind} km/h है।{alert}",
            "mr": "{city} मध्ये सध्या {temp}°C (जाणवते {feels}°C) तापमान आहे, हवामान {cond} आहे। आर्द्रता {humidity}% व वारा {wind} km/h आहे।{alert}",
            "ta": "{city} இல் தற்போது {temp}°C ({feels}°C போல் உணர்கிறது), வானிலை {cond}. ஈரப்பதம் {humidity}%, காற்று {wind} km/h.{alert}",
            "te": "{city} లో ప్రస్తుతం {temp}°C ({feels}°C అనిపిస్తుంది), వాతావరణం {cond}. తేమ {humidity}%, గాలి {wind} km/h.{alert}",
            "bn": "{city}-তে এখন {temp}°C (অনুভব {feels}°C), আবহাওয়া {cond}। আর্দ্রতা {humidity}%, বায়ু {wind} km/h।{alert}",
            "gu": "{city}માં અત્યારે {temp}°C (અનુભવ {feels}°C), હવામાન {cond}. ભેજ {humidity}%, પવન {wind} km/h.{alert}",
            "kn": "{city} ನಲ್ಲಿ ಈಗ {temp}°C ({feels}°C ಅನ್ನಿಸುತ್ತಿದೆ), ಹವಾಮಾನ {cond}. ತೇವಾಂಶ {humidity}%, ಗಾಳಿ {wind} km/h.{alert}",
            "ml": "{city} ൽ ഇപ്പോൾ {temp}°C ({feels}°C തോന്നുന്നു), കാലാവസ്ഥ {cond}. ആർദ്രത {humidity}%, കാറ്റ് {wind} km/h.{alert}",
            "pa": "{city} ਵਿੱਚ ਹੁਣ {temp}°C (ਮਹਿਸੂਸ {feels}°C), ਮੌਸਮ {cond}। ਨਮੀ {humidity}%, ਹਵਾ {wind} km/h।{alert}",
            "or": "{city} ରେ ବର୍ତ୍ତମାନ {temp}°C ({feels}°C ଲାଗୁଛି), ଆବହାୱା {cond}। ଆର୍ଦ୍ରତା {humidity}%, ବାୟୁ {wind} km/h।{alert}",
        },
        "tomorrow": {
            "en": "Tomorrow ({day}) in {city}: expect {cond} with high {high}°C / low {low}°C. Rain probability: {rain}%.",
            "hi": "कल ({day}) {city} में: {cond} की संभावना, अधिकतम {high}°C / न्यूनतम {low}°C। वर्षा संभावना: {rain}%।",
            "mr": "उद्या ({day}) {city} मध्ये: {cond} अपेक्षित, कमाल {high}°C / किमान {low}°C। पाऊस संभावना: {rain}%।",
            "ta": "நாளை ({day}) {city} இல்: {cond} எதிர்பார்க்கப்படுகிறது, அதிக {high}°C / குறைந்த {low}°C. மழை நிகழ்தகவு: {rain}%.",
            "te": "రేపు ({day}) {city} లో: {cond} అంచనా, గరిష్ఠం {high}°C / కనిష్ఠం {low}°C. వర్షం అవకాశం: {rain}%.",
            "bn": "আগামীকাল ({day}) {city}-তে: {cond} আশা করা হচ্ছে, সর্বোচ্চ {high}°C / সর্বনিম্ন {low}°C। বৃষ্টির সম্ভাবনা: {rain}%।",
            "gu": "કાલ ({day}) {city} માં: {cond} અપેક્ષિત, મહત્તમ {high}°C / લઘુત્તમ {low}°C. વરસાદ સંભાવના: {rain}%.",
            "kn": "ನಾಳೆ ({day}) {city} ನಲ್ಲಿ: {cond} ನಿರೀಕ್ಷಿತ, ಗರಿಷ್ಠ {high}°C / ಕನಿಷ್ಠ {low}°C. ಮಳೆ ಸಾಧ್ಯತೆ: {rain}%.",
            "ml": "നാളെ ({day}) {city} ൽ: {cond} പ്രതീക്ഷിക്കുന്നു, ഉയർന്ന {high}°C / കുറഞ്ഞ {low}°C. മഴ സാധ്യത: {rain}%.",
            "pa": "ਕੱਲ੍ਹ ({day}) {city} ਵਿੱਚ: {cond} ਦੀ ਸੰਭਾਵਨਾ, ਵੱਧ ਤੋਂ ਵੱਧ {high}°C / ਘੱਟੋ-ਘੱਟ {low}°C। ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ: {rain}%।",
            "or": "ଆସନ୍ତାକାଲି ({day}) {city} ରେ: {cond} ଅପେକ୍ଷିତ, ସର୍ବୋଚ୍ଚ {high}°C / ସର୍ବନିମ୍ନ {low}°C। ବର୍ଷା ସମ୍ଭାବନା: {rain}%।",
        },
        "rain_yes": {
            "en": "Yes, {rain}% chance of rain in {city} — umbrella recommended.",
            "hi": "हाँ, {city} में {rain}% बारिश की संभावना है — छाता लेकर जाएं।",
            "mr": "होय, {city} मध्ये {rain}% पावसाची शक्यता — छत्री न्या।",
            "ta": "ஆம், {city} இல் {rain}% மழை வாய்ப்பு — குடை எடுத்துச் செல்லுங்கள்.",
            "te": "అవును, {city} లో {rain}% వర్షం అవకాశం — గొడుగు తీసుకోండి.",
            "bn": "হ্যাঁ, {city}-তে {rain}% বৃষ্টির সম্ভাবনা — ছাতা নিন।",
            "gu": "હા, {city} માં {rain}% વરસાદ સંભાવના — છત્રી લઈ જાઓ.",
            "kn": "ಹೌದು, {city} ನಲ್ಲಿ {rain}% ಮಳೆ ಸಾಧ್ಯತೆ — ಛತ್ರಿ ತೆಗೆದುಕೊಳ್ಳಿ.",
            "ml": "ഹ്യാ, {city} ൽ {rain}% മഴ സാധ്യത — കുട കൊണ്ടുപോകൂ.",
            "pa": "ਹਾਂ, {city} ਵਿੱਚ {rain}% ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ — ਛੱਤਰੀ ਲਓ।",
            "or": "ହଁ, {city} ରେ {rain}% ବର୍ଷା ସମ୍ଭାବନା — ଛତା ନିଅ।",
        },
        "rain_no": {
            "en": "Rain is unlikely in {city} today ({rain}% precipitation probability).",
            "hi": "{city} में आज बारिश की संभावना कम है ({rain}%)।",
            "mr": "{city} मध्ये आज पावसाची शक्यता कमी आहे ({rain}%)।",
            "ta": "{city} இல் இன்று மழை வாய்ப்பு இல்லை ({rain}%).",
            "te": "{city} లో ఈ రోజు వర్షం అవకాశం తక్కువ ({rain}%).",
            "bn": "{city}-তে আজ বৃষ্টির সম্ভাবনা কম ({rain}%)।",
            "gu": "{city} માં આજ વરસાદ ઓછો ({rain}%).",
            "kn": "{city} ನಲ್ಲಿ ಇಂದು ಮಳೆ ಸಾಧ್ಯತೆ ಕಡಿಮೆ ({rain}%).",
            "ml": "{city} ൽ ഇന്ന് മഴ സാധ്യത കുറവ് ({rain}%).",
            "pa": "{city} ਵਿੱਚ ਅੱਜ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ਘੱਟ ਹੈ ({rain}%)।",
            "or": "{city} ରେ ଆଜି ବର୍ଷା ସମ୍ଭାବନା କମ ({rain}%)।",
        },
        "agri": {
            "en": "Spraying suitability for {crop} in {city}: {spray}. {window} Rainfall chance: {rain}%.",
            "hi": "{city} में {crop} के लिए स्प्रे उपयुक्तता: {spray}। {window} वर्षा संभावना: {rain}%।",
            "mr": "{city} मधील {crop} साठी फवारणी योग्यता: {spray}। {window} पावसाची शक्यता: {rain}%।",
            "ta": "{city} இல் {crop} க்கு தெளிப்பு தகுதி: {spray}. {window} மழை வாய்ப்பு: {rain}%.",
            "te": "{city} లో {crop} కు పిచికారి అనుకూలత: {spray}. {window} వర్షం అవకాశం: {rain}%.",
            "bn": "{city}-তে {crop} এর জন্য স্প্রে উপযুক্ততা: {spray}। {window} বৃষ্টির সম্ভাবনা: {rain}%।",
            "gu": "{city} માં {crop} માટે સ્પ્રે યોગ્યતા: {spray}. {window} વરસાદ સંભાવના: {rain}%.",
            "kn": "{city} ನಲ್ಲಿ {crop} ಗೆ ಸ್ಪ್ರೇ ಸೂಕ್ತತೆ: {spray}. {window} ಮಳೆ ಸಾಧ್ಯತೆ: {rain}%.",
            "ml": "{city} ൽ {crop} ക്ക് സ്പ്രേ അനുയോജ്യത: {spray}. {window} മഴ സാധ്യത: {rain}%.",
            "pa": "{city} ਵਿੱਚ {crop} ਲਈ ਸਪ੍ਰੇ ਯੋਗਤਾ: {spray}। {window} ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ: {rain}%।",
            "or": "{city} ରେ {crop} ପାଇଁ ସ୍ପ୍ରେ ଉପଯୁକ୍ତତା: {spray}। {window} ବର୍ଷା ସମ୍ଭାବନା: {rain}%।",
        },
    }

    def _ft(self, phrase_id: str, language: str, **kwargs) -> str:
        """Look up a fallback translated phrase and interpolate values."""
        bank = self._FALLBACK_PHRASES.get(phrase_id, {})
        template = bank.get(language) or bank.get("en", "")
        try:
            return template.format(**kwargs)
        except KeyError:
            return bank.get("en", "").format(**kwargs)

    async def _execute_deterministic_fallback(
        self,
        user_text: str,
        city: str,
        session_id: Optional[str] = None,
        history_turns: Optional[List[Dict[str, Any]]] = None,
        language: str = "en",
        degraded: bool = False
    ) -> AgentResponse:
        """
        Deterministic, rule-based fallback answering from WeatherDataHub when LLM is unavailable.
        Provides multilingual replies for common queries using _FALLBACK_PHRASES.
        """
        q = user_text.lower()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()


        # Handle comparisons (e.g. "Compare it with Mumbai" or "Which city has higher chance of rain")
        secondary_city = None
        for k in ["mumbai", "pune", "delhi", "bengaluru", "chennai", "hyderabad", "kolkata"]:
            if k in q and k.lower() != city.lower():
                secondary_city = k.title()
                break

        weather_data = await weather_hub.get_weather_for_city(city)
        temp = weather_data.get("tempC", "--")
        feels = weather_data.get("feelsLikeC", temp)
        cond = weather_data.get("condition", "Partly Cloudy")
        humidity = weather_data.get("humidity", 60)
        wind = weather_data.get("windSpeedKmh", 10)
        insight = weather_data.get("insight", {})
        rain_chance = insight.get("rainChance", 0)

        alerts_data = await alert_service.get_alerts_for_city(city, weather_data)
        active_alerts = alerts_data.get("alerts", [])

        cards = [
            CardItem(
                type="current_weather",
                data={
                    "city": city,
                    "temperature": temp,
                    "feelsLike": feels,
                    "condition": cond,
                    "humidity": humidity,
                    "windSpeed": wind,
                    "rainChance": rain_chance
                }
            )
        ]

        if "spray" in q or "crop" in q or "cotton" in q or "farm" in q or "irrigation" in q or "sheti" in q:
            from backend.app.services.agriculture_service import AgricultureService
            crop = "Cotton"
            for c in ["Cotton", "Sugarcane", "Wheat", "Rice", "Soybean", "Tomato", "Onion", "Groundnut"]:
                if c.lower() in q:
                    crop = c
                    break
            agri_res = await AgricultureService.get_advisory(city, crop=crop, growth_stage="Flowering")
            spray_info = agri_res.get("spraying_advisory", {})
            reply = self._ft(
                "agri", language,
                city=city, crop=crop,
                spray=spray_info.get("status", "MODERATE"),
                window=spray_info.get("window", "Early Morning"),
                rain=rain_chance
            )
            cards.append(CardItem(type="agriculture", data=agri_res))

        elif "umbrella" in q or "jacket" in q or "run" in q or "picnic" in q or "event" in q or "travel" in q or "dry" in q:
            from backend.app.services.recommendation_service import RecommendationService
            act = "umbrella" if "umbrella" in q else "jacket" if "jacket" in q else "run" if "run" in q else "outdoor_event" if ("event" in q or "picnic" in q or "wedding" in q) else "travel" if "travel" in q else "drying_clothes"
            rec_res = await RecommendationService.get_recommendations(city, activity=act)
            rec_item = rec_res.get("recommendations", {})
            if isinstance(rec_item, list) and rec_item:
                rec_item = rec_item[0]
            reply = f"{rec_item.get('emoji', '💡')} {rec_item.get('title', 'Recommendation')}: {rec_item.get('action', '')} (Current temp: {temp}°C, rain chance: {rain_chance}%, wind: {wind} km/h)."
            cards.append(CardItem(type="recommendation", data=rec_res))

        elif "compare" in q or ("which" in q and ("rain" in q or "wetter" in q or "hotter" in q or "higher" in q or "better" in q)):
            comp_city = secondary_city or ("Mumbai" if city.lower() == "pune" else "Pune")
            comp_weather = await weather_hub.get_weather_for_city(comp_city)

            c_temp = comp_weather.get("tempC", "--")
            c_cond = comp_weather.get("condition", "Clear")
            c_daily = comp_weather.get("daily", [])
            p_daily = weather_data.get("daily", [])

            p_tmrw_rain = p_daily[1].get("rainChance", 0) if len(p_daily) > 1 else rain_chance
            c_tmrw_rain = c_daily[1].get("rainChance", 0) if len(c_daily) > 1 else comp_weather.get("insight", {}).get("rainChance", 0)

            if "tomorrow" in q and ("rain" in q or "higher" in q or "wetter" in q):
                if p_tmrw_rain > c_tmrw_rain:
                    reply = f"{city} has a higher chance of rain tomorrow ({p_tmrw_rain}%) compared to {comp_city} ({c_tmrw_rain}%)."
                elif c_tmrw_rain > p_tmrw_rain:
                    reply = f"{comp_city} has a higher chance of rain tomorrow ({c_tmrw_rain}%) compared to {city} ({p_tmrw_rain}%)."
                else:
                    reply = f"Both {city} and {comp_city} have an identical rain probability tomorrow ({p_tmrw_rain}%)."
            elif "better" in q and ("event" in q or "outdoor" in q):
                better = comp_city if c_tmrw_rain < p_tmrw_rain else city
                reply = f"{better} is more favorable for an outdoor event because it has a lower rain probability ({min(p_tmrw_rain, c_tmrw_rain)}% vs {max(p_tmrw_rain, c_tmrw_rain)}%)."
            else:
                reply = (
                    f"In {city}, it is currently {temp}°C with {cond.lower()} (Rain chance tomorrow: {p_tmrw_rain}%). "
                    f"In {comp_city}, it is {c_temp}°C with {c_cond.lower()} (Rain chance tomorrow: {c_tmrw_rain}%)."
                )

            cards.append(CardItem(type="comparison", data={"primary": city, "comparison": comp_city, "primaryTemp": temp, "compTemp": c_temp}))

        elif "official" in q or "imd" in q:
            if active_alerts:
                top = active_alerts[0]
                reply = (
                    f"We do not have an official IMD warning feed connected to Skycast right now. "
                    f"However, Skycast's automated assessment indicates a {top.get('skycastRiskColour', 'Yellow').upper()} "
                    f"({top.get('actionDirective', 'Be Prepared')}) Risk for {top.get('hazardClassification', '').replace('_', ' ').title()}. "
                    f"Forecast value is {top.get('measuredValue')} {top.get('unit')} (threshold: {top.get('threshold')} {top.get('unit')}). "
                    f"This is a Skycast-derived risk assessment based on published IMD criteria, not an official government warning."
                )
            else:
                reply = (
                    f"We do not have an official IMD warning feed connected to Skycast right now. "
                    f"Skycast's risk assessment based on published IMD criteria indicates normal (Green) conditions with no active weather risks for {city}."
                )
        elif "risk" in q or "warning" in q or "alert" in q or "safe" in q:
            if active_alerts:
                top = active_alerts[0]
                reply = (
                    f"Skycast Weather Risk assessment for {city}: {top.get('skycastRiskColour', 'Yellow').upper()} "
                    f"({top.get('actionDirective', 'Be Updated')}) for {top.get('hazardClassification', '').replace('_', ' ').title()}. "
                    f"{top.get('explanation', '')}. Note: This is an automated assessment based on IMD criteria, not an official government alert."
                )
                cards.append(CardItem(type="risk", data=top))
            else:
                reply = f"Skycast Weather Risk evaluation for {city} is Green (Normal Conditions) with no active hazards detected."
        elif "tomorrow" in q or "udya" in q or "kal" in q or "நாளை" in q or "రేపు" in q or "আগামীকাল" in q:
            daily = weather_data.get("daily", [])
            if len(daily) > 1:
                tmrw = daily[1]
                reply = self._ft(
                    "tomorrow", language,
                    day=tmrw.get("day", "Tomorrow"),
                    city=city,
                    cond=tmrw.get("condition", "partly cloudy"),
                    high=tmrw.get("highC", "--"),
                    low=tmrw.get("lowC", "--"),
                    rain=tmrw.get("rainChance", 0)
                )
                cards.append(CardItem(type="forecast", data=tmrw))
            else:
                reply = f"Forecast data for tomorrow in {city} is currently unavailable."
        elif "rain" in q or "paus" in q or "barish" in q or "baarish" in q or "மழை" in q or "వర్షం" in q or "বৃষ্টি" in q:
            if rain_chance >= 50:
                reply = self._ft("rain_yes", language, city=city, rain=rain_chance)
            elif rain_chance >= 20:
                reply = self._ft("rain_yes", language, city=city, rain=rain_chance)
            else:
                reply = self._ft("rain_no", language, city=city, rain=rain_chance)
        elif "why" in q and ("orange" in q or "yellow" in q or "red" in q):
            if active_alerts:
                top = active_alerts[0]
                reply = (
                    f"{city} has a {top.get('skycastRiskColour', 'Yellow').upper()} Skycast Weather Risk because "
                    f"{top.get('explanation', 'severe weather criteria met')}. "
                    f"This is a Skycast-derived assessment based on published IMD criteria, not an official IMD warning."
                )
                cards.append(CardItem(type="risk", data=top))
            else:
                reply = f"There are currently no active hazardous weather risks for {city}; conditions are evaluated as Green (Normal)."
        else:
            alert_part = ""
            if active_alerts:
                a = active_alerts[0]
                alert_part = f" [{a.get('hazardClassification','').replace('_',' ').title()} — {a.get('skycastRiskColour','').upper()}]"
            reply = self._ft(
                "current", language,
                city=city, temp=temp, feels=feels,
                cond=cond, humidity=humidity, wind=wind,
                alert=alert_part
            )
        if session_id:
            await self._save_message(session_id, "user", user_text)
            await self._save_message(session_id, "model", reply)

        return AgentResponse(
            reply=reply,
            city=city,
            timestamp=now_iso,
            session_id=session_id,
            cards=cards,
            sources=[SourceItem(type="central_weather_data", timestamp=now_iso, provider="open_meteo")],
            data_status="degraded" if degraded else "fresh"
        )

    async def _load_session_context(
        self,
        session_id: Optional[str],
        default_city: Optional[str],
        language: str = "en"
    ) -> (str, Optional[str], List[Dict[str, Any]]):
        """Loads session and message history from PostgreSQL."""
        sid = session_id or str(uuid.uuid4())
        location_ctx = default_city
        history = []

        if not is_db_available():
            return sid, location_ctx, history

        try:
            async with async_session_factory() as session:
                stmt = select(ChatSession).where(ChatSession.id == sid)
                res = await session.execute(stmt)
                db_session = res.scalar_one_or_none()

                if not db_session:
                    db_session = ChatSession(
                        id=sid,
                        location_context=default_city,
                        language=language
                    )
                    session.add(db_session)
                    await session.commit()
                else:
                    location_ctx = db_session.location_context or default_city

                msg_stmt = (
                    select(ChatMessage)
                    .where(ChatMessage.session_id == sid)
                    .order_by(ChatMessage.created_at.desc())
                    .limit(6)
                )
                msg_res = await session.execute(msg_stmt)
                messages = list(reversed(msg_res.scalars().all()))
                history = [{"role": m.role, "content": m.content} for m in messages]

        except Exception as exc:
            logger.warning("Error loading session context from DB: %s", exc)

        return sid, location_ctx, history

    async def _update_session_location(self, session_id: str, new_location: str):
        """Updates the active location context for the session."""
        if not is_db_available():
            return
        try:
            async with async_session_factory() as session:
                stmt = select(ChatSession).where(ChatSession.id == session_id)
                res = await session.execute(stmt)
                db_session = res.scalar_one_or_none()
                if db_session:
                    db_session.location_context = new_location
                    await session.commit()
        except Exception as exc:
            logger.warning("Failed updating session location: %s", exc)

    async def _save_message(self, session_id: str, role: str, content: str):
        """Persists a message to PostgreSQL."""
        if not is_db_available():
            return

        try:
            async with async_session_factory() as session:
                msg = ChatMessage(
                    session_id=session_id,
                    role=role,
                    content=content
                )
                session.add(msg)
                await session.commit()
        except Exception as exc:
            logger.warning("Failed saving chat message to DB: %s", exc)


weather_agent = WeatherGPTAgent()
