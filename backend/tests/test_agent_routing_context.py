import pytest
import datetime
from backend.app.services.agent.context import conversation_context_tracker

@pytest.mark.asyncio
async def test_agent_mode_context_isolation():
    session_id = "test_mode_isolation_session"
    conversation_context_tracker.clear_context(session_id)
    
    # Turn 1: Auto Mode, ask about cricket
    ctx1 = conversation_context_tracker.resolve_context(
        session_id=session_id,
        user_text="I have an outdoor cricket match in Pune at 6 PM today. Should I play?",
        default_city="Pune",
        language="en",
        agent_mode="auto"
    )
    assert ctx1.activity == "cricket"
    assert ctx1.location == "Pune"
    
    # Turn 2: Agriculture Mode, ask about pesticides
    ctx2 = conversation_context_tracker.resolve_context(
        session_id=session_id,
        user_text="Can I spray pesticides on my farm in Pune this evening?",
        default_city="Pune",
        language="en",
        agent_mode="agriculture"
    )
    # The mode changed, so activity should NOT be inherited
    assert ctx2.activity != "cricket"
    assert ctx2.location == "Pune"
    
    # Turn 3: Disaster Mode, ask about risk
    ctx3 = conversation_context_tracker.resolve_context(
        session_id=session_id,
        user_text="Is there any weather risk in Pune tonight?",
        default_city="Pune",
        language="en",
        agent_mode="disaster"
    )
    assert ctx3.activity != "cricket"
    
    conversation_context_tracker.clear_context(session_id)
