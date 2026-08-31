"""
Bhashini Translation Provider Stub
Interface for India's government open-source language AI (Bhashini) initiative.

CURRENT STATE: STUBBED FOR ARCHITECTURE DEMONSTRATION
- Provides clean interface seam for future Bhashini integration
- Can be swapped for real Bhashini API calls without changing consumer code
- Demonstrates how non-LLM translation would work in the system

FUTURE INTEGRATION:
To enable real Bhashini translation:
1. Obtain API credentials from https://bhashini.gov.in/
2. Set BHASHINI_API_KEY and BHASHINI_URL in backend/.env
3. Uncomment real API calls in translate() method
"""

import os
import logging
from typing import Optional, Dict, Any
from enum import Enum

logger = logging.getLogger("skycast.translation.bhashini")

# Configuration from environment
USE_BHASHINI = os.getenv("USE_BHASHINI", "false").lower() == "true"
BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "").strip()
BHASHINI_URL = os.getenv("BHASHINI_URL", "https://api.bhashini.gov.in/translate").strip()


class Language(str, Enum):
    """Supported Indian languages."""
    ENGLISH = "en"
    HINDI = "hi"
    MARATHI = "mr"
    TAMIL = "ta"
    TELUGU = "te"
    BENGALI = "bn"
    GUJARATI = "gu"
    KANNADA = "kn"
    MALAYALAM = "ml"
    PUNJABI = "pa"
    ODIA = "or"


class BhashiniTranslator:
    """
    Bhashini Translation Service Adapter
    Provides deterministic fallback + Bhashini API placeholder.

    DEMONSTRATION NOTE: Currently returns deterministic translations.
    In production, this would call real Bhashini API for high-quality translation.
    """

    def __init__(self):
        self.enabled = USE_BHASHINI and bool(BHASHINI_API_KEY)
        self.api_key = BHASHINI_API_KEY
        self.api_url = BHASHINI_URL
        self._initialize_mode()

    def _initialize_mode(self):
        """Log initialization state clearly."""
        if self.enabled:
            logger.info("🌐 [BHASHINI] Initialized in LIVE MODE (api_key configured)")
        else:
            logger.info("🌐 [BHASHINI] Initialized in STUB MODE (for architecture demonstration). To enable real translation: set USE_BHASHINI=true + BHASHINI_API_KEY in .env")

    def _fallback_translations(self) -> Dict[str, str]:
        """
        Fallback translation phrases for common weather responses.
        Maps English → regional language templates.
        """
        return {
            "en": {
                "weather_now": "Current weather in {city}:",
                "temperature": "Temperature: {temp}°C (feels like {feels_like}°C)",
                "condition": "Condition: {condition}",
                "humidity": "Humidity: {humidity}%",
                "wind": "Wind: {wind} km/h {direction}",
                "rain_chance": "Rain chance: {chance}%",
                "forecast": "Forecast for {city}:",
                "alert": "Weather Alert",
                "risk_green": "Green: Normal conditions",
                "risk_yellow": "Yellow: Be Updated",
                "risk_orange": "Orange: Be Prepared",
                "risk_red": "Red: Take Action",
            },
            "hi": {
                "weather_now": "{city} में वर्तमान मौसम:",
                "temperature": "तापमान: {temp}°C (प्रतीत होता है {feels_like}°C)",
                "condition": "स्थिति: {condition}",
                "humidity": "आर्द्रता: {humidity}%",
                "wind": "हवा: {wind} किमी/घंटा {direction}",
                "rain_chance": "बारिश की संभावना: {chance}%",
                "forecast": "{city} का पूर्वानुमान:",
                "alert": "मौसम सचेतावनी",
                "risk_green": "हरा: सामान्य स्थितियां",
                "risk_yellow": "पीला: अपडेट रहें",
                "risk_orange": "नारंगी: तैयारी करें",
                "risk_red": "लाल: कार्रवाई करें",
            },
            "mr": {
                "weather_now": "{city} मध्ये वर्तमान हवामान:",
                "temperature": "तापमान: {temp}°C (असे वाटते {feels_like}°C)",
                "condition": "स्थिति: {condition}",
                "humidity": "आर्द्रता: {humidity}%",
                "wind": "वारा: {wind} किमी/तास {direction}",
                "rain_chance": "पावसाची शक्यता: {chance}%",
                "forecast": "{city} साठी अंदाजे:",
                "alert": "हवामान सतर्कता",
                "risk_green": "हिरवा: सामान्य परिस्थिती",
                "risk_yellow": "पिवळा: अपडेट व्हा",
                "risk_orange": "केशरी: तयारी करा",
                "risk_red": "लाल: कार्यवाही करा",
            },
            "ta": {
                "weather_now": "{city} இல் தற்போதைய வானிலை:",
                "temperature": "வெப்பநிலை: {temp}°C ({feels_like}°C போல் தோன்றுகிறது)",
                "condition": "நிலை: {condition}",
                "humidity": "ஈரப்பதம்: {humidity}%",
                "wind": "காற்று: {wind} கிமீ/மணி {direction}",
                "rain_chance": "மழையின் வாய்ப்பு: {chance}%",
                "forecast": "{city} க்கான முன்னறிவிப்பு:",
                "alert": "வானிலை எச்சரிக்கை",
                "risk_green": "பச்சை: சாதாரண நிலைமைகள்",
                "risk_yellow": "மஞ்சள்: புதுப்பிக்கப்பட்டிருக்கவும்",
                "risk_orange": "ஆரஞ்சு: தயாரான இருக்கவும்",
                "risk_red": "சிவப்பு: நடவடிக்கை எடுக்கவும்",
            },
            "te": {
                "weather_now": "{city} లో ప్రస్తుత వాతావరణం:",
                "temperature": "ఉష్ణోగ్రత: {temp}°C ({feels_like}°C లా ఉంది)",
                "condition": "స్థితి: {condition}",
                "humidity": "ఆర్ద్రత: {humidity}%",
                "wind": "గాలి: {wind} కిమీ/గం {direction}",
                "rain_chance": "వర్షం సంభావ్యత: {chance}%",
                "forecast": "{city} కోసం సూచన:",
                "alert": "వాతావరణ హెచ్చరిక",
                "risk_green": "ఆకుపచ్చ: సాధారణ పరిస్థితులు",
                "risk_yellow": "పసుపు: నవీకరించండి",
                "risk_orange": "ఆరెంజ్: సిద్ధమయ్యారు",
                "risk_red": "ఎరుపు: చర్య తీసుకోండి",
            },
            "bn": {
                "weather_now": "{city} এ বর্তমান আবহাওয়া:",
                "temperature": "তাপমাত্রা: {temp}°C ({feels_like}°C এর মতো মনে হয়)",
                "condition": "অবস্থা: {condition}",
                "humidity": "আর্দ্রতা: {humidity}%",
                "wind": "বাতাস: {wind} কিমি/ঘন্টা {direction}",
                "rain_chance": "বৃষ্টির সম্ভাবনা: {chance}%",
                "forecast": "{city} এর জন্য পূর্বাভাস:",
                "alert": "আবহাওয়া সতর্কতা",
                "risk_green": "সবুজ: সাধারণ অবস্থা",
                "risk_yellow": "হলুদ: আপডেট থাকুন",
                "risk_orange": "কমলা: প্রস্তুত থাকুন",
                "risk_red": "লাল: ব্যবস্থা নিন",
            },
        }

    async def translate(self, text: str, source_lang: str = "en", target_lang: str = "en") -> str:
        """
        Translate text from source to target language.

        In STUB MODE: returns deterministic fallback translations.
        In LIVE MODE (with real Bhashini credentials): calls actual Bhashini API.

        Args:
            text: Text to translate
            source_lang: Source language code (en, hi, ta, etc.)
            target_lang: Target language code

        Returns:
            Translated text (or original if translation not available)
        """
        if source_lang == target_lang:
            return text

        # If live mode enabled, would call real Bhashini API here
        if self.enabled:
            try:
                logger.info("🌐 [BHASHINI LIVE] Translating %d chars from %s → %s", len(text), source_lang, target_lang)
                # PLACEHOLDER: Real Bhashini API call would go here
                # import httpx
                # async with httpx.AsyncClient() as client:
                #     response = await client.post(
                #         self.api_url,
                #         json={"text": text, "from": source_lang, "to": target_lang},
                #         headers={"Authorization": f"Bearer {self.api_key}"}
                #     )
                #     return response.json().get("translated_text", text)
                logger.info("✓ [BHASHINI LIVE] Placeholder (real API not implemented in stub)")
                return text
            except Exception as e:
                logger.error("Bhashini translation failed: %s; falling back to text pass-through", e)
                return text

        # STUB MODE: Return text as-is or try simple dictionary lookup
        return text

    def get_localized_phrase(self, key: str, language: str = "en", **format_kwargs) -> str:
        """
        Get a pre-translated phrase from fallback dictionary.

        Args:
            key: Phrase key (e.g., "weather_now", "alert")
            language: Language code (en, hi, ta, etc.)
            **format_kwargs: Keyword arguments for string formatting

        Returns:
            Localized phrase (or English fallback if not found)
        """
        fallbacks = self._fallback_translations()
        lang_dict = fallbacks.get(language, fallbacks.get("en", {}))
        phrase = lang_dict.get(key, fallbacks["en"].get(key, key))

        try:
            return phrase.format(**format_kwargs)
        except KeyError as e:
            logger.warning("Missing format key in phrase: %s (key: %s)", phrase, e)
            return phrase


# Singleton instance
bhashini_translator = BhashiniTranslator()
