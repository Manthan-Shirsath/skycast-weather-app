import pytest
import datetime
from backend.app.services.providers.forecast_providers import EcmwfIfsProvider
from backend.app.services.forecast_ingestion import ForecastIngestionService
from backend.app.core.model_registry import MODEL_REGISTRY

def test_ecmwf_ifs_normalization():
    """Test that OpenMeteo raw data is properly normalized into ForecastValues."""
    provider = EcmwfIfsProvider()
    
    # Mock OpenMeteo response
    raw_data = {
        "hourly": {
            "time": ["2026-08-31T00:00", "2026-08-31T01:00"],
            "temperature_2m_ecmwf_ifs025": [25.5, 26.1],
            "precipitation_ecmwf_ifs025": [0.0, 1.2],
            "wind_speed_10m_ecmwf_ifs025": [15.5, 12.0]
        }
    }
    
    normalized = provider.normalize(raw_data, "Pune")
    
    assert len(normalized) == 6 # 3 variables * 2 hours
    
    # Check first temp value
    temp1 = next(v for v in normalized if v["variable"] == "temperature" and v["lead_hours"] == 0)
    assert temp1["value"] == 25.5
    assert temp1["unit"] == "C"
    
    # Check second precip value
    precip2 = next(v for v in normalized if v["variable"] == "precipitation" and v["lead_hours"] == 1)
    assert precip2["value"] == 1.2
    assert precip2["unit"] == "mm"

def test_fallback_normalization_no_suffix():
    """Test that normalization handles open-meteo stripping the model suffix."""
    provider = EcmwfIfsProvider()
    
    # Mock OpenMeteo response without suffix
    raw_data = {
        "hourly": {
            "time": ["2026-08-31T00:00"],
            "temperature_2m": [25.5],
            "precipitation": [0.0],
            "wind_speed_10m": [15.5]
        }
    }
    
    normalized = provider.normalize(raw_data, "Pune")
    assert len(normalized) == 3
    assert normalized[0]["variable"] == "temperature"
    assert normalized[0]["value"] == 25.5

def test_model_registry_validity():
    """Test that MODEL_REGISTRY has all required fields."""
    for model_id, meta in MODEL_REGISTRY.items():
        assert "id" in meta
        assert "name" in meta
        assert "category" in meta
        assert "description" in meta
        assert "enabled" in meta
        assert "provider" in meta
        assert "forecast_horizon_days" in meta
        assert "update_cadence_hours" in meta

import asyncio
from unittest.mock import patch

def test_ingestion_partial_failure():
    """Test that one failing provider doesn't crash the whole ingestion cycle."""
    service = ForecastIngestionService()
    
    # Mock fetch_forecast to succeed for one and fail for another
    async def mock_fetch_forecast(self, loc_name, lat, lon):
        if self.model_id == "ecmwf_ifs":
            return {"hourly": {"time": ["2026-08-31T00:00"], "temperature_2m": [25.5]}}
        raise Exception("Simulated provider failure")
        
    with patch("backend.app.services.providers.forecast_providers.ForecastProvider.fetch_forecast", new=mock_fetch_forecast):
        with patch("backend.app.services.forecast_ingestion.ForecastIngestionService._persist_forecast", return_value=None):
            with patch("backend.app.services.forecast_ingestion.ForecastIngestionService._record_failure", return_value=None):
                
                # Run cycle (should not raise)
                asyncio.run(service.run_ingestion_cycle())
