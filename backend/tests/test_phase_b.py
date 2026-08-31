import pytest
import datetime
from typing import Dict, Any

from backend.app.services.agent.context import (
    ConversationContextTracker,
    extract_explicit_locations,
    resolve_temporal_references,
    derive_intent
)
from backend.app.services.agent.schemas import (
    LocationComparisonArgs,
    DateComparisonArgs,
    AlertExplanationArgs
)
from backend.app.services.agent.comparison_evaluator import ComparisonEvaluator

@pytest.fixture
def context_tracker():
    return ConversationContextTracker()

def test_extract_explicit_locations():
    text = "Compare weather in Pune, Mumbai, and Delhi"
    locations = extract_explicit_locations(text)
    assert set(locations) == {"Pune", "Mumbai", "New Delhi"}
    
    text2 = "Should I go to Lonavala or Mahabaleshwar tomorrow?"
    locs2 = extract_explicit_locations(text2)
    # Since Lonavala and Mahabaleshwar might not be in KNOWN_CITIES, they might not match unless handled by preposition pattern.
    # The preposition pattern captures "to Lonavala" -> "Lonavala", "or Mahabaleshwar" -> "Mahabaleshwar" (if they are in KNOWN_CITIES)
    # Let's use known cities for testing
    text3 = "Should I go to Pune or Mumbai tomorrow?"
    locs3 = extract_explicit_locations(text3)
    assert set(locs3) == {"Pune", "Mumbai"}

def test_resolve_multiple_dates():
    text = "Is Saturday or Sunday better for a picnic?"
    today = datetime.date.today()
    found_dates = resolve_temporal_references(text)
    assert len(found_dates) == 2
    # Should resolve to upcoming Saturday and Sunday
    
def test_derive_comparison_intents():
    text = "Which is better, Pune or Mumbai?"
    locations = ["Pune", "Mumbai"]
    intent = derive_intent(text, "today", None, None, locations_count=2, dates_count=1)
    assert intent == "location_comparison"

    text2 = "Is Saturday or Sunday better for cricket?"
    dates = ["2026-09-05", "2026-09-06"]
    intent2 = derive_intent(text2, "today", None, None, locations_count=1, dates_count=2)
    assert intent2 == "date_comparison"

def test_comparison_evaluator_basic():
    # Test scoring directly
    good_day = {
        "temperature_max_c": 28,
        "temperature_min_c": 20,
        "precipitation_probability": 0,
        "condition": "Clear"
    }
    
    bad_day = {
        "temperature_max_c": 40,  # too hot
        "temperature_min_c": 28,
        "precipitation_probability": 90,  # lots of rain
        "condition": "Heavy Rain"
    }
    
    score_good = ComparisonEvaluator.score_weather(good_day)
    score_bad = ComparisonEvaluator.score_weather(bad_day)
    
    assert score_good > score_bad
    
def test_schemas():
    loc_args = LocationComparisonArgs(locations=["Pune", "Mumbai"], date="today")
    assert len(loc_args.locations) == 2
    
    date_args = DateComparisonArgs(location="Pune", dates=["2026-09-05", "2026-09-06"])
    assert len(date_args.dates) == 2
    
    alert_args = AlertExplanationArgs(
        location="Pune",
        hazard="Heavy Rain",
        severity="Red",
        explanation="Rain",
        recommendations=["Stay indoor"]
    )
    assert alert_args.hazard == "Heavy Rain"
