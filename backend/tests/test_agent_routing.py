import pytest
import os
from unittest.mock import patch, MagicMock
from backend.app.services.agent.registry import AgentMode, AgentRegistry
from backend.app.services.agent.agent import WeatherGPTAgent

@pytest.fixture
def agent():
    # Use a dummy provider
    return WeatherGPTAgent(api_key="dummy", provider="openai", model="test-model")

@pytest.mark.asyncio
async def test_agent_routing_auto_mode(agent):
    """Test that 'auto' mode falls back to multi_agent.get_agents (TriageAgent)."""
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        mock_get_agents.return_value = MagicMock()
        
        # We need to mock Runner.run to prevent it from actually running
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Success")
            
            # Use mock to avoid DB dependencies during test
            with patch.object(agent, "_load_session_context", return_value=("session_1", "Pune", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context", return_value=MagicMock(location="Pune", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("test message", agent_mode="auto")
        
        # Verify get_agents was called (meaning TriageAgent was instantiated)
        mock_get_agents.assert_called_once()

@pytest.mark.asyncio
async def test_agent_routing_explicit_mode(agent):
    """Test that explicit mode fetches from registry and bypasses get_agents."""
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        # Mock Runner.run
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Agriculture response")
            
            with patch.object(agent, "_load_session_context", return_value=("session_1", "Pune", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context", return_value=MagicMock(location="Pune", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("test agriculture message", agent_mode=AgentMode.AGRICULTURE)
        
        # TriageAgent should NOT be called
        mock_get_agents.assert_not_called()
        
        # The runner should have been called with the Agriculture Agent
        args, kwargs = mock_runner.call_args
        root_agent = args[0]
        assert root_agent.name == "Agriculture Agent"
        # Check that tool access is limited based on registry definition
        ag_def = AgentRegistry.get_agent(AgentMode.AGRICULTURE)
        assert len(root_agent.tools) == len(ag_def.allowed_tools)

@pytest.mark.asyncio
async def test_agent_routing_coming_soon_limitations(agent):
    """Test that a COMING_SOON agent has restricted tools and the correct system prompt."""
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Aviation response")
            
            with patch.object(agent, "_load_session_context", return_value=("session_1", "Pune", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context", return_value=MagicMock(location="Pune", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("test aviation message", agent_mode=AgentMode.AVIATION)
        
        args, kwargs = mock_runner.call_args
        root_agent = args[0]
        
        assert root_agent.name == "Aviation Agent"
        # Aviation agent shouldn't have any specific aviation tools yet
        av_def = AgentRegistry.get_agent(AgentMode.AVIATION)
        assert len(root_agent.tools) == len(av_def.allowed_tools)
        
        # System prompt should contain METAR/TAF rules
        assert "METAR" in root_agent.instructions

@pytest.mark.asyncio
async def test_agent_routing_disaster_mode(agent):
    """Test that the Disaster Agent receives the correct tools and prompt, bypassing triage."""
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Disaster response")
            
            with patch.object(agent, "_load_session_context", return_value=("session_1", "Mumbai", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context", return_value=MagicMock(location="Mumbai", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("test disaster message", agent_mode=AgentMode.DISASTER)
        
        mock_get_agents.assert_not_called()
        
        args, kwargs = mock_runner.call_args
        root_agent = args[0]
        
        assert root_agent.name == "Disaster & Risk Agent"
        disaster_def = AgentRegistry.get_agent(AgentMode.DISASTER)
        assert len(root_agent.tools) == len(disaster_def.allowed_tools)
        
        # Verify the safety prompt rules are injected
        assert "Distinguish between official warnings and SkyCast-derived risk" in root_agent.instructions

@pytest.mark.asyncio
async def test_agent_routing_urban_mode(agent):
    """Test that the Urban Agent receives the correct tools and prompt, bypassing triage."""
    with patch("backend.app.services.agent.multi_agent.get_agents") as mock_get_agents:
        with patch("agents.Runner.run") as mock_runner:
            mock_runner.return_value = MagicMock(final_output="Urban response")
            
            with patch.object(agent, "_load_session_context", return_value=("session_1", "Delhi", [])):
                with patch("backend.app.services.agent.agent.conversation_context_tracker.resolve_context", return_value=MagicMock(location="Delhi", to_summary_dict=lambda: {})):
                    with patch.object(agent, "_save_message"):
                        await agent.run("test urban message", agent_mode=AgentMode.URBAN)
        
        mock_get_agents.assert_not_called()
        
        args, kwargs = mock_runner.call_args
        root_agent = args[0]
        
        assert root_agent.name == "Urban Agent"
        urban_def = AgentRegistry.get_agent(AgentMode.URBAN)
        assert len(root_agent.tools) == len(urban_def.allowed_tools)
        
        # Verify the urban-specific prompt limitations are injected
        assert "Air Quality (AQI), real-time traffic conditions, urban heat-island" in root_agent.instructions
        
        # Verify specific tools are allowed
        tool_names = [t.name for t in root_agent.tools]
        assert "get_weather_risk" in tool_names
        assert "get_weather_alerts" in tool_names
        assert "analyze_rain" in tool_names
        
        # Verify agriculture tool is NOT in disaster tools
        assert "get_agriculture_advice" not in tool_names
