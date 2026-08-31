import asyncio
import datetime
from backend.app.services.agent.agent import WeatherGPTAgent

async def test_e2e_pipeline():
    agent = WeatherGPTAgent()
    session_id = "test-session-e2e-123"
    
    print("\n--- TURN 1 ---")
    req1 = "Will it rain tomorrow in Pune?"
    print("User:", req1)
    res1 = await agent.run(req1, session_id=session_id)
    print("Agent:", res1.reply.encode('ascii', 'ignore').decode())
    print("Agent Data Context:", res1.conversation_context)
    print("Cards:", [c.type for c in res1.cards])

    print("\n--- TURN 2 ---")
    req2 = "What about the evening?"
    print("User:", req2)
    res2 = await agent.run(req2, session_id=session_id)
    print("Agent:", res2.reply.encode('ascii', 'ignore').decode())
    print("Agent Data Context:", res2.conversation_context)
    print("Cards:", [c.type for c in res2.cards])
    
    print("\n--- TURN 3 ---")
    req3 = "Is that good for cricket?"
    print("User:", req3)
    res3 = await agent.run(req3, session_id=session_id)
    print("Agent:", res3.reply.encode('ascii', 'ignore').decode())
    print("Agent Data Context:", res3.conversation_context)
    print("Cards:", [c.type for c in res3.cards])
    if res3.cards:
        for c in res3.cards:
            if c.type == "activity_suitability":
                print("Activity Suitability:", c.data)

if __name__ == "__main__":
    asyncio.run(test_e2e_pipeline())
