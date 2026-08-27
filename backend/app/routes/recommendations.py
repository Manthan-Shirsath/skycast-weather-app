from fastapi import APIRouter, Query, HTTPException
from backend.app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

@router.get("")
async def get_weather_recommendations(
    city: str = Query(..., description="Target city name"),
    activity: str = Query("all", description="Activity name ('all', 'umbrella', 'jacket', 'run', 'outdoor_event', 'travel', 'drying_clothes')")
):
    """
    Returns practical consumer recommendations grounded in Central Weather Hub observations.
    """
    if not city.strip():
        raise HTTPException(status_code=400, detail="City parameter is required")
        
    result = await RecommendationService.get_recommendations(
        city_name=city,
        activity=activity
    )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message", "Weather data not found"))
        
    return result
