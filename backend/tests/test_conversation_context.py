"""
Comprehensive Unit & Integration Test Suite for ConversationContext & WeatherGPT State Resolution
Tests conversational reference inheritance, date/time resolution, location changes,
multilingual context (English & Marathi), tool selection, and multi-session isolation.
"""

import pytest
import datetime
from unittest.mock import AsyncMock, patch

from backend.app.services.agent.context import (
    ConversationContext,
    ConversationContextTracker,
    extract_explicit_location,
    resolve_temporal_reference,
    extract_time_reference,
    extract_activity_reference,
    derive_intent
)
from backend.app.services.agent.agent import WeatherGPTAgent


# Fixed base date for deterministic testing: 2026-08-29 (Saturday)
FIXED_BASE_DATE = datetime.date(2026, 8, 29)


# ==============================================================================
# 1. Unit Tests for Entity Extractors & Resolvers
# ==============================================================================

def test_extract_explicit_location_english():
    assert extract_explicit_location("What is the weather in Pune tomorrow?") == "Pune"
    assert extract_explicit_location("Compare Mumbai with Delhi") == "Mumbai"
    assert extract_explicit_location("Will it rain in Bengaluru?") == "Bengaluru"
    assert extract_explicit_location("What about the evening?") is None


def test_extract_explicit_location_marathi():
    assert extract_explicit_location("उद्या पुण्यात हवामान कसे असेल?") == "Pune"
    assert extract_explicit_location("मुंबईत पाऊस पडेल का?") == "Mumbai"
    assert extract_explicit_location("नागपूरचे तापमान किती आहे?") == "Nagpur"
    assert extract_explicit_location("संध्याकाळी काय परिस्थिती असेल?") is None


def test_resolve_temporal_reference():
    # Today
    key, expr, res = resolve_temporal_reference("What is the weather today?", base_date=FIXED_BASE_DATE)
    assert key == "today"
    assert res == "2026-08-29"

    # Tomorrow (Aug 30, 2026)
    key, expr, res = resolve_temporal_reference("Weather in Pune tomorrow", base_date=FIXED_BASE_DATE)
    assert key == "tomorrow"
    assert res == "2026-08-30"

    # Marathi Tomorrow (उद्या)
    key, expr, res = resolve_temporal_reference("उद्या पाऊस पडेल का?", base_date=FIXED_BASE_DATE)
    assert key == "tomorrow"
    assert res == "2026-08-30"

    # Saturday
    key, expr, res = resolve_temporal_reference("What about Saturday?", base_date=FIXED_BASE_DATE)
    assert key == "Saturday"
    assert res == "2026-08-29"

    # Sunday (Next day)
    key, expr, res = resolve_temporal_reference("What about Sunday?", base_date=FIXED_BASE_DATE)
    assert key == "Sunday"
    assert res == "2026-08-30"


def test_extract_time_reference():
    time_val, time_range, time_span = extract_time_reference("Would 5 PM be a good time to play cricket?")
    assert time_val == "17:00"
    assert time_range == "evening"

    time_val, time_range, time_span = extract_time_reference("What about the evening?")
    assert time_val is None
    assert time_range == "evening"

    time_val, time_range, time_span = extract_time_reference("संध्याकाळी ५ वाजता")
    assert time_val == "17:00"
    assert time_range == "evening"


def test_extract_activity_reference():
    assert extract_activity_reference("Would 5 PM be a good time to play cricket?") == "cricket"
    assert extract_activity_reference("मग क्रिकेट खेळायला योग्य वेळ कोणता?") == "cricket"
    assert extract_activity_reference("Can we go hiking?") == "hiking"
    assert extract_activity_reference("What is the temperature?") is None


# ==============================================================================
# 2. State Resolution & Multi-Turn Tests (Tracker Layer)
# ==============================================================================

def test_multi_turn_pune_to_evening():
    """Scenario 1: Pune -> 'the evening' inherits Pune and updates time_range."""
    tracker = ConversationContextTracker()
    sid = "test-session-1"

    # Turn 1: Pune tomorrow
    ctx1 = tracker.resolve_context(sid, "What is the weather in Pune tomorrow?", base_date=FIXED_BASE_DATE)
    assert ctx1.location == "Pune"
    assert ctx1.date == "tomorrow"
    assert ctx1.resolved_date == "2026-08-30"

    # Turn 2: the evening (inherits Pune & tomorrow, sets time_range to evening)
    ctx2 = tracker.resolve_context(sid, "What about the evening?", base_date=FIXED_BASE_DATE)
    assert ctx2.location == "Pune"
    assert ctx2.date == "tomorrow"
    assert ctx2.resolved_date == "2026-08-30"
    assert ctx2.time_range == "evening"


def test_multi_turn_pune_tomorrow_to_5pm_cricket():
    """Scenario 2: Pune tomorrow -> 'Would 5 PM be a good time to play cricket?'"""
    tracker = ConversationContextTracker()
    sid = "test-session-2"

    tracker.resolve_context(sid, "What is the weather in Pune tomorrow?", base_date=FIXED_BASE_DATE)
    ctx2 = tracker.resolve_context(sid, "Would 5 PM be a good time to play cricket?", base_date=FIXED_BASE_DATE)

    assert ctx2.location == "Pune"
    assert ctx2.date == "tomorrow"
    assert ctx2.resolved_date == "2026-08-30"
    assert ctx2.time == "17:00"
    assert ctx2.time_range == "evening"
    assert ctx2.activity == "cricket"
    assert ctx2.weather_intent == "activity_suitability"


def test_multi_turn_pune_tomorrow_to_saturday():
    """Scenario 3: Pune tomorrow -> 'What about Saturday?' updates date to Saturday, inherits Pune."""
    tracker = ConversationContextTracker()
    sid = "test-session-3"

    tracker.resolve_context(sid, "What is the weather in Pune tomorrow?", base_date=FIXED_BASE_DATE)
    ctx2 = tracker.resolve_context(sid, "What about Saturday?", base_date=FIXED_BASE_DATE)

    assert ctx2.location == "Pune"
    assert ctx2.date == "Saturday"
    # When previous context was tomorrow (Aug 30, Sunday), 'What about Saturday?' correctly resolves to next Saturday (Sep 05)
    assert ctx2.resolved_date == "2026-09-05"



def test_marathi_multi_turn_flow():
    """Scenario 5: Full Marathi multi-turn conversational flow."""
    tracker = ConversationContextTracker()
    sid = "test-session-mr"

    # Turn 1: उद्या पुण्यात हवामान कसे असेल?
    ctx1 = tracker.resolve_context(sid, "उद्या पुण्यात हवामान कसे असेल?", language="mr", base_date=FIXED_BASE_DATE)
    assert ctx1.location == "Pune"
    assert ctx1.date == "tomorrow"
    assert ctx1.resolved_date == "2026-08-30"

    # Turn 2: संध्याकाळी काय परिस्थिती असेल?
    ctx2 = tracker.resolve_context(sid, "संध्याकाळी काय परिस्थिती असेल?", language="mr", base_date=FIXED_BASE_DATE)
    assert ctx2.location == "Pune"
    assert ctx2.date == "tomorrow"
    assert ctx2.time_range == "evening"

    # Turn 3: मग क्रिकेट खेळायला योग्य वेळ कोणता?
    ctx3 = tracker.resolve_context(sid, "मग क्रिकेट खेळायला योग्य वेळ कोणता?", language="mr", base_date=FIXED_BASE_DATE)
    assert ctx3.location == "Pune"
    assert ctx3.date == "tomorrow"
    assert ctx3.activity == "cricket"
    assert ctx3.weather_intent == "activity_suitability"


def test_location_change():
    """Scenario 6: Location change from Mumbai to Pune."""
    tracker = ConversationContextTracker()
    sid = "test-session-loc"

    ctx1 = tracker.resolve_context(sid, "What is the weather in Mumbai?", base_date=FIXED_BASE_DATE)
    assert ctx1.location == "Mumbai"

    ctx2 = tracker.resolve_context(sid, "What about Pune?", base_date=FIXED_BASE_DATE)
    assert ctx2.location == "Pune"


def test_date_change():
    """Scenario 7: Date change across turns."""
    tracker = ConversationContextTracker()
    sid = "test-session-date"

    tracker.resolve_context(sid, "Weather in Pune today", base_date=FIXED_BASE_DATE)
    ctx2 = tracker.resolve_context(sid, "What about tomorrow?", base_date=FIXED_BASE_DATE)
    assert ctx2.date == "tomorrow"
    assert ctx2.resolved_date == "2026-08-30"

    ctx3 = tracker.resolve_context(sid, "What about Sunday?", base_date=FIXED_BASE_DATE)
    assert ctx3.date == "Sunday"
    assert ctx3.resolved_date == "2026-08-30"


def test_ambiguous_location_no_prior_state():
    """Scenario 8: Query with no known location and no prior state returns None."""
    tracker = ConversationContextTracker()
    sid = "test-session-ambig"

    ctx = tracker.resolve_context(sid, "What is the weather tomorrow?", base_date=FIXED_BASE_DATE)
    assert ctx.location is None
    assert ctx.date == "tomorrow"


def test_session_isolation():
    """Scenario 11: Two concurrent user sessions do not bleed state into each other."""
    tracker = ConversationContextTracker()
    sid_user_a = "user-a-session"
    sid_user_b = "user-b-session"

    # User A asks for Mumbai
    ctx_a1 = tracker.resolve_context(sid_user_a, "What is the weather in Mumbai?", base_date=FIXED_BASE_DATE)
    assert ctx_a1.location == "Mumbai"

    # User B asks for Delhi
    ctx_b1 = tracker.resolve_context(sid_user_b, "What is the weather in Delhi?", base_date=FIXED_BASE_DATE)
    assert ctx_b1.location == "New Delhi"

    # User A asks follow-up "What about tomorrow?" -> must still be Mumbai
    ctx_a2 = tracker.resolve_context(sid_user_a, "What about tomorrow?", base_date=FIXED_BASE_DATE)
    assert ctx_a2.location == "Mumbai"

    # User B asks follow-up "What about the evening?" -> must still be Delhi
    ctx_b2 = tracker.resolve_context(sid_user_b, "What about the evening?", base_date=FIXED_BASE_DATE)
    assert ctx_b2.location == "New Delhi"


# ==============================================================================
# 3. Agent Integration & Fallback Grounding Tests
# ==============================================================================

@pytest.mark.anyio
async def test_agent_tomorrow_selects_forecast_card():
    """Scenario 9: 'tomorrow' selects forecast card rather than only current weather."""
    agent = WeatherGPTAgent(api_key="")  # deterministic fallback
    res = await agent.run("What is the weather in Pune tomorrow?", session_id="test-agent-tmrw")

    assert res.city == "Pune"
    card_types = [c.type for c in res.cards]
    assert "forecast" in card_types
    assert "Tomorrow" in res.reply or "Sun" in res.reply or "28°C" in res.reply


@pytest.mark.anyio
async def test_agent_multi_turn_cricket_fallback_grounding():
    """Scenario 10: Multi-turn persistence across requests for cricket recommendation."""
    agent = WeatherGPTAgent(api_key="")
    sid = "test-agent-cricket"

    # Turn 1: Pune tomorrow
    await agent.run("What is the weather in Pune tomorrow?", session_id=sid)

    # Turn 2: Cricket at 5 PM (inherits Pune and tomorrow)
    res2 = await agent.run("Would 5 PM be a good time to play cricket?", session_id=sid)
    assert res2.city == "Pune"
    assert "cricket" in res2.reply.lower() or "5 pm" in res2.reply.lower() or "rain" in res2.reply.lower()
    card_types = [c.type for c in res2.cards]
    assert "activity_suitability" in card_types or "forecast" in card_types or "hourly_forecast" in card_types

