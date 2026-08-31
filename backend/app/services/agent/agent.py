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
    ToolExecutionResult,
    ForecastArgs
)
from backend.app.services.agent.executor import ToolExecutor
from backend.app.services.agent.tools import get_forecast_tool
from backend.app.services.agent.context import (
    ConversationContext,
    conversation_context_tracker,
    format_marathi_weather_reply
)

from backend.app.services.agent.prompts import (
    SYSTEM_INSTRUCTION,
    GEMINI_TOOLS_DECLARATION,
    get_role_system_prompt_suffix,
    format_response_by_role
)


load_dotenv("backend/.env")

logger = logging.getLogger("skycast.agent")

# Provider settings
LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "groq").strip().lower()

# Groq Configuration (Default / Active)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_API_KEY_FALLBACK = os.getenv("GROQ_API_KEY_FALLBACK", "").strip()
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"

# Sarvam Configuration (Supported alternative)
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
SARVAM_API_KEY_FALLBACK = os.getenv("SARVAM_API_KEY_FALLBACK", "").strip()
SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
SARVAM_MODEL = os.getenv("SARVAM_MODEL") or "sarvam-105b"


def _resolve_provider_settings(provider: Optional[str] = None):
    """
    Resolve active provider, API key, base URL, model, and fallback key.
    Defaults to Groq with openai/gpt-oss-120b, while keeping Sarvam fully configurable.
    """
    p = (provider or LLM_PROVIDER or "groq").strip().lower()
    if p == "sarvam":
        api_key = SARVAM_API_KEY
        fallback_key = SARVAM_API_KEY_FALLBACK
        base_url = SARVAM_BASE_URL
        configured_model = os.getenv("SARVAM_MODEL") or os.getenv("LLM_MODEL") or "sarvam-105b"
        model = configured_model if "gemini" not in configured_model.lower() else "sarvam-105b"
    else:
        p = "groq"
        api_key = GROQ_API_KEY
        fallback_key = GROQ_API_KEY_FALLBACK
        base_url = GROQ_BASE_URL
        configured_model = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"
        if configured_model and ("gemini" in configured_model.lower() or "sarvam" in configured_model.lower()):
            model = "openai/gpt-oss-120b"
        else:
            model = configured_model or "openai/gpt-oss-120b"
    return p, api_key, base_url, model, fallback_key


DEFAULT_PROVIDER, DEFAULT_API_KEY, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_FALLBACK_KEY = _resolve_provider_settings()
MAX_TOOL_CALLS = int(os.getenv("MAX_TOOL_CALLS", "8"))


class WeatherGPTAgent:
    """
    Intelligent AI Agent for WeatherGPT with Groq / OpenAI-compatible Function Calling,
    Central Weather Hub Grounding, and Multi-turn Reasoning.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        provider: Optional[str] = None,
        max_tool_calls: int = MAX_TOOL_CALLS
    ):
        p, default_key, default_base, default_model, fallback_key = _resolve_provider_settings(provider)
        self.provider = provider or p
        self.api_key = default_key if api_key is None else api_key
        self.api_key_fallback = fallback_key
        self.base_url = default_base if base_url is None else base_url.rstrip("/")
        self.model = default_model if model is None else model
        self.max_tool_calls = max_tool_calls
        logger.info(
            "🤖 [INIT] WeatherGPT Agent initialized with provider='%s', model='%s' (max_tool_calls=%d, api_key_configured=%s)",
            self.provider,
            self.model,
            self.max_tool_calls,
            bool(self.api_key and len(self.api_key) > 5)
        )

    async def run(
        self,
        message: str,
        session_id: Optional[str] = None,
        default_city: Optional[str] = None,
        language: str = "en",
        user_role: str = "general_public",
        ui_context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Executes the agent lifecycle for a user message.
        Supports role-adaptive response formatting (general_public, farmer, disaster_manager, etc.).
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
            language=language,
            user_role=user_role
        )

        # 2. Deterministically resolve ConversationContext state
        context = conversation_context_tracker.resolve_context(
            session_id=session_id,
            user_text=user_text,
            default_city=location_context or default_city,
            language=language
        )

        active_city = context.location or location_context or default_city or "Pune"

        # Update session location context in DB
        if context.location and context.location != location_context:
            await self._update_session_location(session_id, context.location)

        # 3. Check for LLM availability - fallback smoothly if unconfigured
        if not self.api_key or len(self.api_key) < 5:
            logger.info("ℹ️ [%s] API key not configured. Using deterministic fallback.", self.provider.upper())
            return await self._execute_deterministic_fallback(
                user_text=user_text,
                city=active_city,
                session_id=session_id,
                history_turns=history_turns,
                language=language,
                user_role=user_role,
                context=context
            )

        # 4. Execute LLM Function Calling Loop
        try:
            agent_response = await self._run_llm_loop(
                user_text=user_text,
                session_id=session_id,
                active_city=active_city,
                history_turns=history_turns,
                language=language,
                user_role=user_role,
                context=context,
                ui_context=ui_context
            )
            return agent_response
        except Exception as exc:
            logger.warning("⚠️ [%s] Request or processing failed (%s). Gracefully falling back to deterministic response.", self.provider.upper(), exc)
            return await self._execute_deterministic_fallback(
                user_text=user_text,
                city=active_city,
                session_id=session_id,
                history_turns=history_turns,
                language=language,
                user_role=user_role,
                degraded=True,
                context=context
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

    def _build_system_instruction(
        self,
        language: str,
        user_role: str = "general_public",
        context: Optional[ConversationContext] = None,
        ui_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Construct complete system instruction with language directive, role-adaptive formatting,
        and deterministically resolved conversation context.
        """
        lang_name = self._LANG_NAMES.get(language, "English")

        # Start with base instruction
        system_text = SYSTEM_INSTRUCTION

        # Add UI context if available
        if ui_context:
            ui_directive = f"\n=== USER INTERFACE CONTEXT ===\n"
            ui_directive += f"The user is currently viewing the following in the UI:\n"
            for k, v in ui_context.items():
                ui_directive += f"- {k}: {v}\n"
            ui_directive += "Use this context to inform your response if the user's query is ambiguous or refers to 'this', 'here', or 'current page'.\n\n"
            system_text = ui_directive + system_text

        # Add structured conversation context if available
        if context and context.location:
            time_info = context.time or context.time_range or "full day"
            activity_info = f" (Activity: {context.activity})" if context.activity else ""
            ctx_directive = (
                f"\n=== STRUCTURED CONVERSATION STATE (DETERMINISTICALLY RESOLVED) ===\n"
                f"- Active Location: {context.location}\n"
                f"- Target Date: {context.date_expression} ({context.resolved_date})\n"
                f"- Target Time Window: {time_info}{activity_info}\n"
                f"- Inferred Intent: {context.weather_intent}\n\n"
                f"STRICT DIRECTIVES:\n"
                f"1. The user's query pertains to '{context.location}'. NEVER ask the user what city or location they mean; it is already resolved.\n"
                f"2. You MUST invoke the appropriate tool (e.g. get_forecast, get_weather_recommendations, or get_current_weather) for '{context.location}'.\n"
                f"3. For date '{context.date_expression}' (e.g. tomorrow, Saturday, evening, 5 PM), use 'get_forecast' to retrieve conditions.\n"
                f"4. If evaluating suitability for '{context.activity or 'an activity'}' at '{time_info}', synthesize the temperature, rain probability, wind, and sky condition for that time window to give an explicit recommendation.\n\n"
            )
            system_text = ctx_directive + system_text

        # Add language directive if not English
        if language != "en":
            directive = (
                f"RESPONSE LANGUAGE DIRECTIVE (HIGHEST PRIORITY):\n"
                f"The user interface is set to {lang_name}. "
                f"You MUST respond entirely in {lang_name}. "
                f"All your narrative text, explanations, recommendations, and advisory paragraphs must be written in {lang_name}. "
                f"Keep all numeric values (temperatures in °C, wind speed in km/h, percentages) as-is. "
                f"Do NOT respond in English unless the user's message itself is in English.\n\n"
            )
            system_text = directive + system_text

        # Add role-adaptive formatting suffix
        role_suffix = get_role_system_prompt_suffix(user_role)
        system_text = system_text + "\n" + role_suffix

        return system_text


    @staticmethod
    def _convert_tools_to_openai(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert the existing Gemini tool schema into the OpenAI-compatible format Sarvam expects."""
        converted: List[Dict[str, Any]] = []
        for tool in tools:
            if "function_declarations" in tool:
                for declaration in tool["function_declarations"]:
                    converted.append({
                        "type": "function",
                        "function": {
                            "name": declaration.get("name", ""),
                            "description": declaration.get("description", ""),
                            "parameters": declaration.get("parameters", {"type": "object", "properties": {}})
                        }
                    })
            elif tool.get("type") == "function" and "function" in tool:
                converted.append(tool)
        return converted

    @staticmethod
    def _clean_reply_text(content: Optional[str]) -> str:
        """Strip internal reasoning tags (e.g. <think>...</think>) and leading/trailing whitespace."""
        if not content:
            return ""
        # Remove <think>...</think> blocks including multi-line content
        cleaned = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
        return cleaned

    def _build_openai_payload(
        self,
        messages: List[Dict[str, Any]],
        system_instruction: str,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Construct OpenAI-compatible chat completion payload for Groq / Sarvam."""
        payload: Dict[str, Any] = {
            "model": self.model,
            "stream": False,
            "temperature": 0.2,
            "max_tokens": 900,
            "top_p": 0.95,
            "messages": [{"role": "system", "content": system_instruction}, *messages]
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        return payload

    def _build_sarvam_payload(
        self,
        messages: List[Dict[str, Any]],
        system_instruction: str,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Backward-compatible alias for _build_openai_payload."""
        return self._build_openai_payload(messages, system_instruction, tools)

    async def _run_llm_loop(
        self,
        user_text: str,
        session_id: str,
        active_city: str,
        history_turns: List[Dict[str, Any]],
        language: str = "en",
        user_role: str = "general_public",
        context: Optional[ConversationContext] = None,
        ui_context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Runs a bounded multi-turn tool calling loop against Groq / Sarvam's OpenAI-compatible chat completions API.
        Extracts clean content without exposing internal reasoning traces (<think>...</think> or reasoning_content).
        """
        messages: List[Dict[str, Any]] = []

        for h in history_turns[-6:]:
            role = "user" if h.get("role") in ["user", "human"] else "assistant"
            messages.append({
                "role": role,
                "content": h.get("content", "")
            })

        messages.append({
            "role": "user",
            "content": user_text
        })

        system_instruction = self._build_system_instruction(language, user_role, context=context, ui_context=ui_context)
        tools = self._convert_tools_to_openai([{"function_declarations": GEMINI_TOOLS_DECLARATION}])
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

        async with httpx.AsyncClient(timeout=14.0) as client:
            for iteration in range(self.max_tool_calls + 1):
                response_data = None
                keys_to_try = [self.api_key]
                if self.api_key_fallback and self.api_key_fallback != self.api_key and len(self.api_key_fallback) > 5:
                    keys_to_try.append(self.api_key_fallback)

                endpoint = f"{self.base_url}/chat/completions"
                # Token optimization: supply tools on initial turn (when tool_calls_executed == 0).
                # Once tool results are present, omit tools so the model synthesizes the final answer without consuming tool tokens.
                active_tools = tools if tool_calls_executed == 0 else None
                payload = self._build_openai_payload(messages, system_instruction, active_tools)


                for api_key in keys_to_try:
                    if response_data:
                        break
                    try:
                        logger.info("📡 [%s] Sending chat completion request (model='%s', iteration=%d)", self.provider.upper(), payload.get("model"), iteration)
                        res = await client.post(
                            endpoint,
                            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                            json=payload,
                            timeout=12.0
                        )
                        if res.status_code == 200:
                            response_data = res.json()
                            logger.info("✓ [%s] Response received successfully (200 OK)", self.provider.upper())
                            break
                        else:
                            logger.warning("⚠️ [%s] API error (Status %d): %s", self.provider.upper(), res.status_code, res.text[:300])
                    except Exception as req_err:
                        logger.warning("⚠️ [%s] Network/request error: %s", self.provider.upper(), req_err)

                if not response_data:
                    logger.warning("⚠️ [%s] Could not obtain valid LLM response. Invoking deterministic fallback.", self.provider.upper())
                    return await self._execute_deterministic_fallback(
                        user_text=user_text,
                        city=resolved_city,
                        session_id=session_id,
                        history_turns=history_turns,
                        language=language,
                        user_role=user_role,
                        degraded=True,
                        context=context
                    )

                choices = response_data.get("choices", [])
                if not choices:
                    logger.warning("⚠️ [%s] Empty choices returned. Invoking deterministic fallback.", self.provider.upper())
                    return await self._execute_deterministic_fallback(
                        user_text=user_text,
                        city=resolved_city,
                        session_id=session_id,
                        history_turns=history_turns,
                        language=language,
                        user_role=user_role,
                        degraded=True,
                        context=context
                    )


                message = choices[0].get("message", {})
                raw_content = message.get("content") or ""
                # Strip internal reasoning traces from content & never expose reasoning_content to frontend
                assistant_text = self._clean_reply_text(raw_content)
                tool_calls = message.get("tool_calls") or []

                if not tool_calls or tool_calls_executed >= self.max_tool_calls:
                    reply_text = assistant_text or "I have retrieved the centralized weather data for your request."
                    await self._save_message(session_id, "user", user_text)
                    await self._save_message(session_id, "model", reply_text)
                    return AgentResponse(
                        reply=reply_text,
                        city=resolved_city,
                        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        session_id=session_id,
                        cards=executed_cards,
                        sources=sources,
                        data_status="fresh",
                        conversation_context=context.to_summary_dict() if context else None
                    )


                messages.append({
                    "role": "assistant",
                    "content": raw_content,
                    "tool_calls": tool_calls
                })

                for tool_call in tool_calls:
                    tool_name = tool_call.get("function", {}).get("name")
                    tool_args_raw = tool_call.get("function", {}).get("arguments", "")
                    try:
                        tool_args = json.loads(tool_args_raw) if isinstance(tool_args_raw, str) else (tool_args_raw or {})
                    except json.JSONDecodeError as parse_err:
                        logger.warning("Tool call parsing error for %s: %s", tool_name, parse_err)
                        tool_args = {}

                    # Intercept and redirect current weather calls if context is for a future date / time range / activity
                    is_temporal_or_activity_context = context and (
                        context.date != "today" or
                        context.time_range is not None or
                        context.time is not None or
                        context.activity is not None or
                        context.weather_intent in ["forecast", "activity_suitability", "rain_check"]
                    )
                    user_explicit_current = any(w in user_text.lower() for w in ["right now", "currently", "now", "current weather", "सध्या", "आत्ता"])

                    if tool_name in ["get_current_weather", "get_weather_recommendations"] and is_temporal_or_activity_context and not user_explicit_current:
                        logger.info("🔄 [TOOL UPGRADE] Redirecting %s -> get_forecast with resolved context (date=%s, time_range=%s, activity=%s)",
                                    tool_name, context.resolved_date, context.time_range, context.activity)
                        tool_name = "get_forecast"
                        tool_args["location"] = tool_args.get("location") or context.location or active_city
                        tool_args["date"] = context.resolved_date
                        if context.time:
                            tool_args["time"] = context.time
                        if context.time_range:
                            tool_args["time_range"] = context.time_range
                        if context.activity:
                            tool_args["activity"] = context.activity

                    # Contextual argument enrichment for get_forecast
                    if tool_name == "get_forecast" and context:
                        if "location" not in tool_args or not tool_args["location"]:
                            tool_args["location"] = context.location or active_city
                        if context.resolved_date:
                            tool_args["date"] = context.resolved_date
                        if context.time:
                            tool_args["time"] = context.time
                        if context.time_range:
                            tool_args["time_range"] = context.time_range
                        if context.activity:
                            tool_args["activity"] = context.activity

                    tool_calls_executed += 1
                    logger.info("⚙️ Tool [%d/%d]: %s(%s)", tool_calls_executed, self.max_tool_calls, tool_name, tool_args)

                    exec_res = await ToolExecutor.execute(tool_name, tool_args)

                    if tool_name in ["search_location", "get_current_weather", "get_forecast", "get_weather_risk"]:
                        if exec_res.success and isinstance(exec_res.data, dict) and "location" in exec_res.data:
                            resolved_city = exec_res.data["location"]
                        elif exec_res.success and isinstance(exec_res.data, dict) and "name" in exec_res.data:
                            resolved_city = exec_res.data["name"]

                    if exec_res.success and exec_res.data:
                        if tool_name == "get_forecast" and isinstance(exec_res.data, dict):
                            target_p = exec_res.data.get("target_period")
                            act_eval = target_p.get("activity_suitability") if target_p else None
                            if act_eval:
                                executed_cards.append(CardItem(type="activity_suitability", data=act_eval))
                            elif target_p and (target_p.get("period_type") in ["time_range", "exact_hour"] or exec_res.data.get("hourly_forecast")):
                                executed_cards.append(CardItem(type="hourly_forecast", data=exec_res.data))
                            else:
                                executed_cards.append(CardItem(type="forecast", data=exec_res.data))
                        else:
                            card_type = self._map_tool_to_card_type(tool_name)
                            if card_type:
                                executed_cards.append(CardItem(type=card_type, data=exec_res.data if isinstance(exec_res.data, dict) else {"result": exec_res.data}))

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.get("id", str(uuid.uuid4())),
                        "name": tool_name,
                        "content": json.dumps({
                            "success": exec_res.success,
                            "data": exec_res.data,
                            "error": exec_res.error
                        })
                    })

        return await self._execute_deterministic_fallback(
            user_text=user_text,
            city=resolved_city,
            session_id=session_id,
            history_turns=history_turns,
            language=language,
            user_role=user_role
        )

    # Backwards-compatible alias for tests and existing callers
    _run_gemini_loop = _run_llm_loop


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
            "get_weather_recommendations": "recommendation",
            "show_visual_explanation": "visual_explanation",
            "compare_locations": "location_comparison",
            "compare_dates": "date_comparison",
            "show_weather_alert": "weather_alert",
            "analyze_rain": "rain_timeline"
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
        user_role: str = "general_public",
        degraded: bool = False,
        context: Optional[ConversationContext] = None
    ) -> AgentResponse:
        """
        Deterministic, rule-based fallback answering from WeatherDataHub when LLM is unavailable.
        Provides multilingual replies for common queries using _FALLBACK_PHRASES.
        Supports role-adaptive formatting through role parameter.
        """
        q = user_text.lower()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if not city:
            msg = "कृपया हवामानाची माहिती जाणून घेण्यासाठी शहर किंवा ठिकाणाचे नाव सांगा." if language == "mr" else "Please specify which city or location you would like to check the weather for."
            return AgentResponse(
                reply=msg,
                city="",
                timestamp=now_iso,
                session_id=session_id,
                cards=[],
                sources=[SourceItem(type="central_weather_data", timestamp=now_iso, provider="open_meteo")],
                data_status="degraded" if degraded else "fresh"
            )

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

        cards: List[CardItem] = []

        # Activity Suitability (Cricket / Outdoor Sports / 5 PM / Evening)
        is_cricket = (context and context.activity == "cricket") or "cricket" in q or "खेळायला" in q or "play" in q
        is_forecast_query = (
            is_cricket
            or "tomorrow" in q or "udya" in q or "kal" in q
            or (context and context.date != "today")
            or "evening" in q or "संध्याकाळ" in q or (context and context.time_range)
            or (context and context.time)
            or any(w in q for w in ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "शनिवार", "रविवार"])
        )
        
        is_rain_check = (context and context.weather_intent == "rain_check") or "rain" in q or "पाऊस" in q or "baarish" in q

        if is_rain_check:
            from backend.app.services.agent.schemas import AnalyzeRainArgs
            from backend.app.services.agent.tools import analyze_rain_tool
            rain_res = await analyze_rain_tool(AnalyzeRainArgs(
                location=city,
                date=context.resolved_date if context else None,
                time=context.time if context else None,
                time_range=context.time_range if context else None
            ))
            
            if language == "mr":
                reply = f"{city} मध्ये पावसाचा अंदाज: {rain_res.get('summary')} (कमाल शक्यता: {rain_res.get('overall_chance')}%)"
            else:
                reply = f"Rain analysis for {city}: {rain_res.get('summary')} (Max chance: {rain_res.get('overall_chance')}%)"
                
            cards.append(CardItem(type="rain_timeline", data=rain_res))
            
        elif is_forecast_query:
            forecast_res = await get_forecast_tool(ForecastArgs(
                location=city,
                date=context.resolved_date if context else None,
                time=context.time if context else None,
                time_range=context.time_range if context else None,
                activity=context.activity if context else ("cricket" if is_cricket else None)
            ))

            target_period = forecast_res.get("target_period")
            day_forecast = forecast_res.get("day_forecast", {})
            daily_forecast = forecast_res.get("daily_forecast", [])

            if target_period:
                p_temp = target_period.get("temperature_c") or target_period.get("avg_temperature_c") or temp
                p_rain = target_period.get("precipitation_probability", target_period.get("rain_chance_pct", rain_chance))
                p_cond = target_period.get("condition", cond)
                p_hour = target_period.get("hour") or target_period.get("time_range")
                act_eval = target_period.get("activity_suitability")

                if language == "mr":
                    reply = format_marathi_weather_reply(
                        city=city,
                        date_key=context.date if context else "tomorrow",
                        date_expr=context.date_expression if context else "उद्या",
                        time_val=context.time if context else None,
                        time_range=context.time_range if context else None,
                        high_c=p_temp,
                        low_c=day_forecast.get("low_c", 22) if day_forecast else 22,
                        condition=p_cond,
                        rain_chance=p_rain,
                        activity="cricket" if is_cricket else None
                    )
                elif is_cricket and act_eval:
                    reply = f"For cricket at {p_hour} ({context.date_expression if context else 'tomorrow'}) in {city}: {act_eval.get('reason')} {act_eval.get('recommendation')}"
                else:
                    reply = f"{context.date_expression.title() if context else 'Tomorrow'} ({p_hour}) in {city}: expect {p_cond} with temperature around {p_temp}°C. Rain probability: {p_rain}%."

                if act_eval:
                    cards.append(CardItem(type="activity_suitability", data=act_eval))
                elif target_period.get("period_type") in ["exact_hour", "time_range"]:
                    cards.append(CardItem(type="hourly_forecast", data=forecast_res))
                else:
                    cards.append(CardItem(type="forecast", data=forecast_res))

            elif day_forecast:
                d_high = day_forecast.get("high_c", temp)
                d_low = day_forecast.get("low_c", 22)
                d_cond = day_forecast.get("condition", cond)
                d_rain = day_forecast.get("daily_precipitation_probability", day_forecast.get("daily_rain_chance_pct", day_forecast.get("rainChance", rain_chance)))
                d_day = day_forecast.get("day", "Tomorrow")

                if language == "mr":
                    reply = format_marathi_weather_reply(
                        city=city,
                        date_key=context.date if context else "tomorrow",
                        date_expr=context.date_expression if context else "उद्या",
                        time_val=None,
                        time_range=None,
                        high_c=d_high,
                        low_c=d_low,
                        condition=d_cond,
                        rain_chance=d_rain
                    )
                else:
                    reply = f"{context.date_expression.title() if context else d_day} in {city}: expect {d_cond} with high {d_high}°C / low {d_low}°C. Rain probability: {d_rain}%."

                cards.append(CardItem(type="forecast", data=forecast_res))
            else:
                reply = f"Forecast data for {city} is currently unavailable."

        # Spraying / Crop Advisory
        elif "spray" in q or "crop" in q or "cotton" in q or "farm" in q or "irrigation" in q or "sheti" in q:
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

            p_tmrw_rain = p_daily[1].get("daily_precipitation_probability", p_daily[1].get("rainChance", 0)) if len(p_daily) > 1 else rain_chance
            c_tmrw_rain = c_daily[1].get("daily_precipitation_probability", c_daily[1].get("rainChance", 0)) if len(c_daily) > 1 else comp_weather.get("insight", {}).get("rainChance", 0)

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

        elif "tomorrow" in q or "udya" in q or "kal" in q or (context and context.date == "tomorrow") or "evening" in q or "संध्याकाळ" in q:
            daily = weather_data.get("daily", [])
            if len(daily) > 1:
                tmrw = daily[1]
                time_lbl = " (Evening)" if (context and context.time_range == "evening") or "evening" in q or "संध्याकाळ" in q else ""
                reply = self._ft(
                    "tomorrow", language,
                    day=f"{tmrw.get('day', 'Tomorrow')}{time_lbl}",
                    city=city,
                    cond=tmrw.get("condition", "partly cloudy"),
                    high=tmrw.get("highC", "--"),
                    low=tmrw.get("lowC", "--"),
                    rain=tmrw.get("daily_precipitation_probability", tmrw.get("rainChance", 0))
                )
                cards.append(CardItem(type="forecast", data=weather_data))
            else:
                reply = f"Forecast data for tomorrow in {city} is currently unavailable."
        elif any(w in q for w in ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "शनिवार", "रविवार"]) or (context and context.date in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]):
            daily = weather_data.get("daily", [])
            target_day_name = context.date if context else "Saturday"
            matched_day = next((d for d in daily if d.get("day", "").lower().startswith(target_day_name[:3].lower())), daily[-1] if daily else None)
            if matched_day:
                matched_rain = matched_day.get("daily_precipitation_probability", matched_day.get("rainChance", 0))
                reply = f"Forecast for {matched_day.get('day')} in {city}: {matched_day.get('condition')} with high {matched_day.get('highC')}°C / low {matched_day.get('lowC')}°C. Rain probability: {matched_rain}%."
                cards.append(CardItem(type="forecast", data=weather_data))
            else:
                reply = f"Extended forecast for {target_day_name} in {city} is currently unavailable."
        elif "rain" in q or "paus" in q or "barish" in q or "baarish" in q or "मழை" in q or "వర్షం" in q or "বৃষ্টি" in q:
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
            cards.append(CardItem(
                type="current_weather",
                data={
                    "city": city,
                    "temperature": temp,
                    "feelsLike": feels,
                    "condition": cond,
                    "humidity": humidity,
                    "windSpeed": wind,
                    "precipitation_probability": rain_chance,
                    "rainChance": rain_chance
                }
            ))
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
            data_status="degraded" if degraded else "fresh",
            conversation_context=context.to_summary_dict() if context else None
        )


    async def _load_session_context(
        self,
        session_id: Optional[str],
        default_city: Optional[str],
        language: str = "en",
        user_role: str = "general_public"
    ) -> (str, Optional[str], List[Dict[str, Any]]):
        """Loads session and message history from PostgreSQL, including user role."""
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
