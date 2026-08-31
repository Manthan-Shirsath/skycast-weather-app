# AI Agent & WeatherGPT Pipeline Bugs Report

## Overview
This document details bugs within the WeatherGPT AI pipeline, LLM integration, Groq / Sarvam function calling loops, tool execution dispatchers, and multi-turn context tracking.

---

### [AI-01] Unclosed Reasoning Tag Leakage (`<think>`) in Final Output
* **Severity:** HIGH / AGENT PIPELINE
* **Location:** [`backend/app/services/agent/agent.py:319-325`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/agent.py#L319-L325) and [`backend/app/services/gemini_service.py:123`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/gemini_service.py#L123)
* **Root Cause:**
  `_clean_reply_text()` uses regular expression replacement to strip LLM reasoning blocks:
  ```python
  cleaned = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
  ```
  When the model output is truncated due to token limits (e.g. `max_tokens=600` or `900`), the closing tag `</think>` is missing from the stream. The non-greedy regex `r'<think>[\s\S]*?</think>'` fails to match an unclosed `<think>` tag, causing the entire internal chain-of-thought to leak directly into the user's chat UI bubble.
* **Impact:** Exposes internal system instructions, model thinking traces, and unformatted raw reasoning to end users.

---

### [AI-02] Invalid Tool ID Errors on Subsequent Function Calling Iterations
* **Severity:** HIGH / AGENT LOOP
* **Location:** [`backend/app/services/agent/agent.py:408-410`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/agent.py#L408-L410)
* **Root Cause:**
  `_run_llm_loop()` attempts to optimize tokens by omitting tools on subsequent iterations:
  ```python
  active_tools = tools if tool_calls_executed == 0 else None
  payload = self._build_openai_payload(messages, system_instruction, active_tools)
  ```
  When an OpenAI-compatible function calling API (Groq / Sarvam) requests a tool execution, sending the tool result back in a message with `role: "tool"` requires `tools` to remain in the API payload definition. Omitting `tools` on iteration 2 causes API providers to return HTTP 400 (`Invalid tool_call_id or tool choice provided without declared tools`).
* **Impact:** Multi-step reasoning loops fail on the second tool call, forcing the agent to abort and fall back to rule-based responses.

---

### [AI-03] Language Preference Override in Deterministic Rule Fallbacks
* **Severity:** MEDIUM / MULTILINGUAL
* **Location:** [`backend/app/services/agent/agent.py:698-750`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/agent.py#L698-L750)
* **Root Cause:**
  `_execute_deterministic_fallback()` relies on `language` parameter passed from request (`req.language`). If the user submits a query in Marathi or Hindi (e.g., "पुण्यात पाऊस पडणार का?") while the UI setting `language` is `"en"`, the fallback engine evaluates `language == "en"` and returns English text instead of detecting the script or honoring context language.
* **Impact:** Indian regional language users receive English fallback responses when API rate limits or fallback paths trigger.

---

### [AI-04] Activity Suitability Evaluation Window Overflow
* **Severity:** MEDIUM / AGENT LOGIC
* **Location:** [`backend/app/services/agent/context.py:180-220`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/context.py#L180-L220)
* **Root Cause:**
  When evaluating outdoor activity suitability for time ranges (e.g., "hiking in the evening"), `context.py` maps "evening" to hours 17-20. If `hourly_forecast` array returned from Open-Meteo starts at local hour 22:00 (late night), indexing hours 17-20 out-of-bounds yields an empty subset, causing the activity evaluator to return default `True` ("Good to go!") without inspecting actual rain or temperature metrics.
* **Impact:** False positive activity recommendations for past hours or unavailable forecast windows.
