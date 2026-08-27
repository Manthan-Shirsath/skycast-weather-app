from fastapi import APIRouter, Query, HTTPException
from backend.app.services.agriculture_service import AgricultureService

router = APIRouter(prefix="/api/agriculture", tags=["agriculture"])

@router.get("")
async def get_agriculture_advisory(
    city: str = Query(..., description="Target city or district name"),
    crop: str = Query("Cotton", description="Crop name (e.g. Cotton, Sugarcane, Wheat, Rice, Soybean, Tomato, Onion)"),
    stage: str = Query("Flowering", description="Growth stage (e.g. Sowing, Vegetative, Flowering, Fruiting, Harvesting)")
):
    """
    Returns structured agricultural and agrometeorological advisory grounded in Central Weather Hub observations.
    """
    if not city.strip():
        raise HTTPException(status_code=400, detail="City parameter is required")
    
    result = await AgricultureService.get_advisory(
        city_name=city,
        crop=crop,
        growth_stage=stage
    )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result.get("message", "Weather data not found"))
        
    return result
