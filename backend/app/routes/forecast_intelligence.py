from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from backend.app.core.database import get_db_session
from backend.app.models.forecast import ForecastRun
from backend.app.core.model_registry import MODEL_REGISTRY
import datetime
import logging

logger = logging.getLogger("skycast.forecast_intelligence")

router = APIRouter(
    prefix="/api/forecast-intelligence",
    tags=["Forecast Intelligence"]
)

async def _fetch_runs_for_location(location: str, db: AsyncSession) -> Dict[str, ForecastRun]:
    runs = {}
    loc_clean = location.strip().lower()
    operational_ids = [m for m, meta in MODEL_REGISTRY.items() if meta.get("availability") == "operational"]
    try:
        stmt = select(ForecastRun).where(
            ForecastRun.model_id.in_(operational_ids),
            func.lower(ForecastRun.location_name) == loc_clean,
            ForecastRun.status == "success"
        ).order_by(ForecastRun.run_time.desc()).options(selectinload(ForecastRun.values))
        
        result = await db.execute(stmt)
        all_runs = result.scalars().all()
        for run in all_runs:
            if run.model_id not in runs:
                runs[run.model_id] = run
    except Exception as exc:
        logger.warning("⚠️ Error querying forecast runs from database (%s). Returning available models.", exc)
    return runs

@router.get("/{location}")
async def get_forecast_intelligence(location: str, db: AsyncSession = Depends(get_db_session)) -> Dict[str, Any]:
    """
    Retrieve the latest Multi-Model Forecast Data for a specific location.
    If no data exists in PostgreSQL, automatically triggers on-demand ingestion.
    """
    from backend.app.services.forecast_analytics import ForecastAnalytics
    
    runs_map = await _fetch_runs_for_location(location, db)
    
    # On-demand ingestion fallback if any operational model is missing from DB for this location
    operational_models = [m for m, meta in MODEL_REGISTRY.items() if meta.get("availability") == "operational"]
    missing_models = [m for m in operational_models if m not in runs_map]
    
    if missing_models:
        logger.info("ℹ️ Missing forecast models in DB for '%s' (%s). Ingesting on-demand...", location, missing_models)
        from backend.app.services.forecast_ingestion import forecast_ingestion_service
        await forecast_ingestion_service.ingest_location(location)
        runs_map = await _fetch_runs_for_location(location, db)
    
    response_models = []
    valid_runs = []
    
    for model_id, meta in MODEL_REGISTRY.items():
        if meta.get("availability") != "operational":
            continue
            
        run = runs_map.get(model_id)
        
        if not run:
            response_models.append({
                "id": meta["id"],
                "name": meta["name"],
                "methodology": meta.get("methodology"),
                "forecast_type": meta.get("forecast_type"),
                "how_it_forecasts": meta.get("how_it_forecasts"),
                "status": "unavailable",
                "forecast": []
            })
            continue
            
        valid_runs.append(run)
        
        # Calculate freshness
        now = datetime.datetime.now(datetime.timezone.utc)
        age_minutes = int((now - run.fetched_at).total_seconds() / 60)
        
        is_stale = age_minutes > (meta.get("update_cadence_hours", 6) * 60 + 120) 
        
        # Format forecast values
        formatted_forecast = []
        for val in run.values:
            formatted_forecast.append({
                "valid_time": val.valid_time.isoformat(),
                "lead_hours": val.lead_hours,
                "variable": val.variable,
                "representation": getattr(val, "representation", "deterministic"),
                "value": val.value,
                "unit": val.unit
            })
            
        response_models.append({
            "id": meta["id"],
            "name": meta["name"],
            "methodology": meta.get("methodology"),
            "forecast_type": meta.get("forecast_type"),
            "how_it_forecasts": meta.get("how_it_forecasts"),
            "run_time": run.run_time.isoformat(),
            "fetched_at": run.fetched_at.isoformat(),
            "age_minutes": age_minutes,
            "status": "stale" if is_stale else "fresh",
            "forecast": formatted_forecast
        })

    # Generate deterministic analytics
    analytics_data = {}
    if valid_runs:
        analytics_data = ForecastAnalytics.analyze(valid_runs)

    return {
        "location": location,
        "horizon_days": 7,
        "models": response_models,
        "analytics": analytics_data
    }


@router.get("/{location}/analysis")
async def get_forecast_ai_analysis(location: str, db: AsyncSession = Depends(get_db_session)) -> Dict[str, Any]:
    """
    Decoupled endpoint for AI analysis. Runs asynchronously from the main forecast data fetch.
    """
    from backend.app.services.forecast_analytics import ForecastAnalytics
    from backend.app.services.forecast_ai_service import forecast_ai_service
    
    runs_map = await _fetch_runs_for_location(location, db)
    if not runs_map:
        from backend.app.services.forecast_ingestion import forecast_ingestion_service
        await forecast_ingestion_service.ingest_location(location)
        runs_map = await _fetch_runs_for_location(location, db)
            
    valid_runs = list(runs_map.values())
    if not valid_runs:
        return {"analysis": "Insufficient data for analysis."}
        
    analytics_data = ForecastAnalytics.analyze(valid_runs)
    
    # Get cached or generated AI summary
    summary = await forecast_ai_service.get_analysis(location, analytics_data)
    
    return {"analysis": summary}

