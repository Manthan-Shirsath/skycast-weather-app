import pytest
from backend.app.services.agriculture_service import AgricultureService
from backend.app.services.recommendation_service import RecommendationService
from backend.app.services.agent.executor import ToolExecutor


@pytest.mark.anyio
async def test_agriculture_service_advisory():
    res = await AgricultureService.get_advisory(city_name="Pune", crop="Cotton", growth_stage="Flowering")
    assert res["status"] == "ready"
    assert res["crop"] == "Cotton"
    assert "spraying_advisory" in res
    assert "status" in res["spraying_advisory"]
    assert "irrigation_advisory" in res
    assert "crop_weather_risk" in res
    assert "disclaimer" in res
    assert res["data_status"]["source"] == "central_weather_hub"


@pytest.mark.anyio
async def test_agriculture_service_unsupported_crop():
    res = await AgricultureService.get_advisory(city_name="Pune", crop="Dragonfruit", growth_stage="Flowering")
    assert res["status"] == "unsupported_crop"
    assert "not currently supported" in res["message"]


@pytest.mark.anyio
async def test_agriculture_service_case_insensitive_crop():
    res1 = await AgricultureService.get_advisory(city_name="Pune", crop="WHEAT", growth_stage="Flowering")
    assert res1["status"] == "ready"
    assert res1["crop"] == "Wheat"
    
    res2 = await AgricultureService.get_advisory(city_name="Pune", crop="sUgArCaNe", growth_stage="Flowering")
    assert res2["status"] == "ready"
    assert res2["crop"] == "Sugarcane"


@pytest.mark.anyio
async def test_recommendations_service():
    res = await RecommendationService.get_recommendations(city_name="Pune", activity="all")
    assert res["status"] == "ready"
    assert "weather_context" in res
    assert "recommendations" in res
    assert len(res["recommendations"]) >= 5


@pytest.mark.anyio
async def test_agent_tool_executor_agriculture_and_recommendations():
    agri_res = await ToolExecutor.execute("get_agriculture_advice", {"location": "Pune", "crop": "Wheat", "growth_stage": "Flowering"})
    assert agri_res.success is True
    assert agri_res.data["crop"] == "Wheat"

    rec_res = await ToolExecutor.execute("get_weather_recommendations", {"location": "Pune", "activity": "umbrella"})
    assert rec_res.success is True
    assert rec_res.data["status"] == "ready"

@pytest.mark.anyio
async def test_agent_tool_executor_unsupported_crop():
    agri_res = await ToolExecutor.execute("get_agriculture_advice", {"location": "Pune", "crop": "MagicBeans", "growth_stage": "Flowering"})
    assert agri_res.success is True
    assert agri_res.data["status"] == "unsupported_crop"
