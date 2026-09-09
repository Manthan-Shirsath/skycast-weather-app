import abc
from typing import List, Dict, Any, Optional
import httpx
import datetime

class ForecastProvider(abc.ABC):
    """
    Abstract base class for all Forecast Intelligence models.
    """
    
    @property
    @abc.abstractmethod
    def model_id(self) -> str:
        """The internal canonical ID of the model (e.g., ecmwf_ifs)."""
        pass

    @property
    @abc.abstractmethod
    def model_name(self) -> str:
        """The display name of the model (e.g., ECMWF IFS)."""
        pass

    @abc.abstractmethod
    async def fetch_forecast(self, location_name: str, lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetch forecast data for a given location.
        Returns raw API response which will be passed to normalize().
        """
        pass

    @abc.abstractmethod
    def normalize(self, raw_data: Dict[str, Any], location_name: str) -> List[Dict[str, Any]]:
        """
        Convert raw provider data into a standardized format.
        Expected output format: list of dicts representing ForecastValue entries.
        [
            {
                "valid_time": datetime,
                "lead_hours": int,
                "variable": str,
                "value": float,
                "unit": str
            }, ...
        ]
        """
        pass


class OpenMeteoEnsembleBase(ForecastProvider):
    """
    Base class for models fetched via Open-Meteo Ensemble API.
    Since open-meteo exposes multiple models via the same API shape, we can share the fetching and normalization logic.
    """
    
    # Needs to match open-meteo's `models` query parameter
    _upstream_model_name: str = ""
    
    async def fetch_forecast(self, location_name: str, lat: float, lon: float) -> Dict[str, Any]:
        url = "https://api.open-meteo.com/v1/forecast"
        
        # Request temperature, precipitation, cloud cover, and wind speed
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "models": self._upstream_model_name,
            "timezone": "UTC"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    def normalize(self, raw_data: Dict[str, Any], location_name: str) -> List[Dict[str, Any]]:
        results = []
        
        if "hourly" not in raw_data:
            return results
            
        hourly = raw_data["hourly"]
        times = hourly.get("time", [])
        
        # Because we only requested one model, the suffix is the model name e.g. "temperature_2m_icon_seamless"
        # However open-meteo appends the model to the variable, or sometimes it's just the variable if one model is passed.
        # Let's inspect the keys to find the exact variables.
        temp_key = f"temperature_2m_{self._upstream_model_name}"
        precip_key = f"precipitation_{self._upstream_model_name}"
        wind_key = f"wind_speed_10m_{self._upstream_model_name}"
        
        # Fallbacks if open-meteo strips the model suffix (it sometimes does if only 1 model is specified)
        if temp_key not in hourly and "temperature_2m" in hourly:
            temp_key = "temperature_2m"
            precip_key = "precipitation"
            wind_key = "wind_speed_10m"

        temps = hourly.get(temp_key, [])
        precips = hourly.get(precip_key, [])
        winds = hourly.get(wind_key, [])
        
        if not temps or not times:
            return results
            
        from backend.app.utils.timezone import parse_to_utc
        run_time = parse_to_utc(times[0]) # Approximation for base run time
        
        for i, t_str in enumerate(times):
            dt = parse_to_utc(t_str)
            lead_hours = int((dt - run_time).total_seconds() / 3600)
            
            if i < len(temps) and temps[i] is not None:
                results.append({
                    "valid_time": dt,
                    "lead_hours": lead_hours,
                    "variable": "temperature",
                    "value": temps[i],
                    "unit": "C"
                })
                
            if i < len(precips) and precips[i] is not None:
                results.append({
                    "valid_time": dt,
                    "lead_hours": lead_hours,
                    "variable": "precipitation",
                    "value": precips[i],
                    "unit": "mm"
                })
                
            if i < len(winds) and winds[i] is not None:
                results.append({
                    "valid_time": dt,
                    "lead_hours": lead_hours,
                    "variable": "wind_speed",
                    "value": winds[i],
                    "unit": "kmh"
                })
                
        return results


class EcmwfIfsProvider(OpenMeteoEnsembleBase):
    @property
    def model_id(self) -> str:
        return "ecmwf_ifs"
        
    @property
    def model_name(self) -> str:
        return "ECMWF IFS"
        
    _upstream_model_name = "ecmwf_ifs025"


class EcmwfAifsProvider(OpenMeteoEnsembleBase):
    @property
    def model_id(self) -> str:
        return "ecmwf_aifs"
        
    @property
    def model_name(self) -> str:
        return "ECMWF AIFS"
        
    _upstream_model_name = "ecmwf_aifs025"


class NoaaGfsProvider(OpenMeteoEnsembleBase):
    @property
    def model_id(self) -> str:
        return "noaa_gfs"
        
    @property
    def model_name(self) -> str:
        return "NOAA GFS"
        
    _upstream_model_name = "gfs_seamless"


class DwdIconProvider(OpenMeteoEnsembleBase):
    @property
    def model_id(self) -> str:
        return "dwd_icon"
        
    @property
    def model_name(self) -> str:
        return "DWD ICON"
        
    _upstream_model_name = "icon_seamless"


import math

class WeatherNext2Provider(ForecastProvider):
    @property
    def model_id(self) -> str:
        return "google_weathernext2"
        
    @property
    def model_name(self) -> str:
        return "Google WeatherNext 2"

    async def fetch_forecast(self, location_name: str, lat: float, lon: float) -> Dict[str, Any]:
        url = "https://ensemble-api.open-meteo.com/v1/ensemble"
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,precipitation,wind_speed_10m",
            "models": "google_weathernext2_ensemble",
            "timezone": "UTC"
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    def _compute_stats(self, values: List[float]) -> tuple[float, float]:
        """Compute mean and standard deviation from a list of values."""
        valid_vals = [v for v in values if v is not None]
        if not valid_vals:
            return None, None
        
        mean = sum(valid_vals) / len(valid_vals)
        if len(valid_vals) < 2:
            return mean, 0.0
            
        variance = sum((v - mean) ** 2 for v in valid_vals) / (len(valid_vals) - 1)
        stddev = math.sqrt(variance)
        return mean, stddev

    def normalize(self, raw_data: Dict[str, Any], location_name: str) -> List[Dict[str, Any]]:
        results = []
        
        if "hourly" not in raw_data:
            return results
            
        hourly = raw_data["hourly"]
        times = hourly.get("time", [])
        if not times:
            return results
            
        keys = list(hourly.keys())
        
        # Discover members dynamically
        temp_keys = [k for k in keys if k.startswith("temperature_2m_member") or k == "temperature_2m"]
        precip_keys = [k for k in keys if k.startswith("precipitation_member") or k == "precipitation"]
        wind_keys = [k for k in keys if k.startswith("wind_speed_10m_member") or k == "wind_speed_10m"]
        
        from backend.app.utils.timezone import parse_to_utc
        run_time = parse_to_utc(times[0])
        
        for i, t_str in enumerate(times):
            dt = parse_to_utc(t_str)
            lead_hours = int((dt - run_time).total_seconds() / 3600)
            
            # Temperature
            temp_vals = [hourly[k][i] for k in temp_keys if i < len(hourly[k])]
            t_mean, t_std = self._compute_stats(temp_vals)
            if t_mean is not None:
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "temperature",
                    "value": t_mean, "unit": "C", "representation": "ensemble_mean"
                })
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "temperature",
                    "value": t_std, "unit": "C", "representation": "ensemble_spread"
                })
                
            # Precipitation
            precip_vals = [hourly[k][i] for k in precip_keys if i < len(hourly[k])]
            p_mean, p_std = self._compute_stats(precip_vals)
            if p_mean is not None:
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "precipitation",
                    "value": p_mean, "unit": "mm", "representation": "ensemble_mean"
                })
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "precipitation",
                    "value": p_std, "unit": "mm", "representation": "ensemble_spread"
                })
                
            # Wind
            wind_vals = [hourly[k][i] for k in wind_keys if i < len(hourly[k])]
            w_mean, w_std = self._compute_stats(wind_vals)
            if w_mean is not None:
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "wind_speed",
                    "value": w_mean, "unit": "kmh", "representation": "ensemble_mean"
                })
                results.append({
                    "valid_time": dt, "lead_hours": lead_hours, "variable": "wind_speed",
                    "value": w_std, "unit": "kmh", "representation": "ensemble_spread"
                })

        return results

