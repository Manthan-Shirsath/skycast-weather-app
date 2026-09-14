import asyncio
import logging
import datetime
from typing import Dict, Any, List, Optional
import httpx
from backend.app.services.providers.base import BaseWeatherProvider
from backend.app.core.config import OPENWEATHER_API_KEY

logger = logging.getLogger("skycast.provider.open_weather_map")

OWM_GEOCODE_URL = "http://api.openweathermap.org/geo/1.0/direct"
OWM_CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

def map_owm_to_wmo(owm_id: int) -> int:
    """Map OpenWeatherMap condition IDs to WMO weather codes used by Open-Meteo."""
    if 200 <= owm_id <= 232: return 95
    if 300 <= owm_id <= 301: return 51
    if 302 <= owm_id <= 311: return 53
    if 312 <= owm_id <= 321: return 55
    if owm_id == 500: return 61
    if owm_id == 501: return 63
    if 502 <= owm_id <= 504: return 65
    if owm_id == 511: return 66
    if 520 <= owm_id <= 531: return 80
    if owm_id == 600: return 71
    if owm_id == 601: return 73
    if owm_id == 602: return 75
    if owm_id == 611: return 77
    if 612 <= owm_id <= 622: return 85
    if 700 <= owm_id <= 781: return 45
    if owm_id == 800: return 0
    if owm_id == 801: return 1
    if owm_id == 802: return 2
    if owm_id >= 803: return 3
    return 0

class OpenWeatherMapProvider(BaseWeatherProvider):
    """OpenWeatherMap Provider mapped to Open-Meteo canonical JSON structure."""

    @property
    def provider_name(self) -> str:
        return "open_weather_map"

    async def _get_with_retry(self, url: str, timeout: float = 12.0) -> httpx.Response:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.get(url)
            res.raise_for_status()
            return res

    async def geocode_city(self, city_name: str) -> Optional[Dict[str, Any]]:
        logger.info("🌐 [PROVIDER CALL] OpenWeatherMap Geocode for '%s'", city_name)
        if not OPENWEATHER_API_KEY:
            logger.error("❌ OPENWEATHER_API_KEY is missing!")
            return None
            
        url = f"{OWM_GEOCODE_URL}?q={city_name}&limit=1&appid={OPENWEATHER_API_KEY}"
        try:
            res = await self._get_with_retry(url)
            data = res.json()
            if data and len(data) > 0:
                item = data[0]
                return {
                    "name": item.get("name", city_name),
                    "latitude": float(item.get("lat", 0)),
                    "longitude": float(item.get("lon", 0)),
                    "admin1": item.get("state", ""),
                    "country": item.get("country", "")
                }
        except Exception as e:
            logger.warning("⚠️ OWM geocoding failed for '%s': %s", city_name, e)

        # Fallback to Nominatim
        nominatim_url = f"https://nominatim.openstreetmap.org/search?q={city_name}&format=json&limit=1"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    nominatim_url,
                    headers={"User-Agent": "SkyCastWeatherApp/1.0"}
                )
                res.raise_for_status()
                data = res.json()
                if data and len(data) > 0:
                    item = data[0]
                    return {
                        "name": item.get("name", city_name),
                        "latitude": float(item.get("lat", 0)),
                        "longitude": float(item.get("lon", 0)),
                        "country": ""
                    }
        except Exception as e:
            logger.error("❌ Nominatim geocoding failed: %s", e)
        return None

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetch Current and 5-Day/3-Hour Forecast, then interpolate to Open-Meteo's hourly schema."""
        if not OPENWEATHER_API_KEY:
            raise RuntimeError("OPENWEATHER_API_KEY is not configured")

        curr_url = f"{OWM_CURRENT_URL}?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        fore_url = f"{OWM_FORECAST_URL}?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"

        async with httpx.AsyncClient(timeout=12.0) as client:
            curr_res, fore_res = await asyncio.gather(
                client.get(curr_url),
                client.get(fore_url)
            )
            curr_res.raise_for_status()
            fore_res.raise_for_status()
            curr_data = curr_res.json()
            fore_data = fore_res.json()

        # Parse Current Data
        curr_weather_id = curr_data.get("weather", [{}])[0].get("id", 800)
        curr_wmo = map_owm_to_wmo(curr_weather_id)
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now_utc.strftime("%Y-%m-%dT%H:00")
        
        current_mapped = {
            "time": now_iso,
            "temperature_2m": curr_data["main"].get("temp", 0),
            "apparent_temperature": curr_data["main"].get("feels_like", 0),
            "relative_humidity_2m": curr_data["main"].get("humidity", 0),
            "weather_code": curr_wmo,
            "wind_speed_10m": curr_data["wind"].get("speed", 0) * 3.6, # m/s to km/h
            "wind_direction_10m": curr_data["wind"].get("deg", 0),
            "wind_gusts_10m": curr_data["wind"].get("gust", 0) * 3.6,
            "pressure_msl": curr_data["main"].get("pressure", 1013),
            "cloud_cover": curr_data["clouds"].get("all", 0),
            "precipitation": curr_data.get("rain", {}).get("1h", 0.0),
            "rain": curr_data.get("rain", {}).get("1h", 0.0)
        }

        # Parse and Interpolate 3-Hour Forecast to Hourly Arrays
        hourly_times = []
        hourly_temps = []
        hourly_feels = []
        hourly_hums = []
        hourly_codes = []
        hourly_pops = []
        hourly_precips = []
        hourly_winds = []
        hourly_clouds = []
        hourly_pressures = []

        daily_agg = {}

        last_dt = now_utc.replace(minute=0, second=0, microsecond=0)
        last_item = curr_data

        for item in fore_data.get("list", []):
            target_dt = datetime.datetime.fromtimestamp(item["dt"], tz=datetime.timezone.utc)
            
            # Interpolate missing hours between last_dt and target_dt
            hours_diff = int((target_dt - last_dt).total_seconds() / 3600)
            if hours_diff > 0:
                for i in range(1, hours_diff + 1):
                    interp_dt = last_dt + datetime.timedelta(hours=i)
                    ratio = i / hours_diff
                    
                    # Safe fallbacks if last_item missing keys
                    prev_temp = last_item.get("main", {}).get("temp", 20)
                    next_temp = item.get("main", {}).get("temp", 20)
                    interp_temp = prev_temp + (next_temp - prev_temp) * ratio
                    
                    prev_feels = last_item.get("main", {}).get("feels_like", 20)
                    next_feels = item.get("main", {}).get("feels_like", 20)
                    interp_feels = prev_feels + (next_feels - prev_feels) * ratio
                    
                    prev_hum = last_item.get("main", {}).get("humidity", 50)
                    next_hum = item.get("main", {}).get("humidity", 50)
                    interp_hum = prev_hum + (next_hum - prev_hum) * ratio
                    
                    # For discrete values, use nearest neighbor (closest to target)
                    wmo_code = map_owm_to_wmo(item["weather"][0]["id"]) if item.get("weather") else 0
                    pop = item.get("pop", 0) * 100
                    precip = item.get("rain", {}).get("3h", 0) / 3.0 # Distribute 3h rain to 1h
                    wind = item.get("wind", {}).get("speed", 0) * 3.6
                    clouds = item.get("clouds", {}).get("all", 0)
                    pressure = item.get("main", {}).get("pressure", 1013)

                    hourly_times.append(interp_dt.strftime("%Y-%m-%dT%H:00"))
                    hourly_temps.append(round(interp_temp, 1))
                    hourly_feels.append(round(interp_feels, 1))
                    hourly_hums.append(round(interp_hum))
                    hourly_codes.append(wmo_code)
                    hourly_pops.append(round(pop))
                    hourly_precips.append(round(precip, 2))
                    hourly_winds.append(round(wind, 1))
                    hourly_clouds.append(clouds)
                    hourly_pressures.append(pressure)

            # Daily Aggregation
            date_str = target_dt.strftime("%Y-%m-%d")
            if date_str not in daily_agg:
                daily_agg[date_str] = {
                    "codes": [], "tmax": -999, "tmin": 999, "pop": 0,
                    "precip_sum": 0, "wind_max": 0
                }
            
            d_ag = daily_agg[date_str]
            wmo_c = map_owm_to_wmo(item["weather"][0]["id"]) if item.get("weather") else 0
            d_ag["codes"].append(wmo_c)
            d_ag["tmax"] = max(d_ag["tmax"], item["main"].get("temp_max", -999))
            d_ag["tmin"] = min(d_ag["tmin"], item["main"].get("temp_min", 999))
            d_ag["pop"] = max(d_ag["pop"], item.get("pop", 0) * 100)
            d_ag["precip_sum"] += item.get("rain", {}).get("3h", 0)
            d_ag["wind_max"] = max(d_ag["wind_max"], item.get("wind", {}).get("speed", 0) * 3.6)

            last_dt = target_dt
            last_item = item

        # Build Daily Arrays
        daily_times = []
        daily_codes = []
        daily_tmax = []
        daily_tmin = []
        daily_pops = []
        daily_precip_sums = []
        daily_wind_max = []

        for d_str, d_ag in sorted(daily_agg.items()):
            daily_times.append(d_str)
            # Most frequent weather code for the day
            if d_ag["codes"]:
                most_freq_code = max(set(d_ag["codes"]), key=d_ag["codes"].count)
            else:
                most_freq_code = 0
            daily_codes.append(most_freq_code)
            daily_tmax.append(round(d_ag["tmax"], 1) if d_ag["tmax"] != -999 else current_mapped["temperature_2m"])
            daily_tmin.append(round(d_ag["tmin"], 1) if d_ag["tmin"] != 999 else current_mapped["temperature_2m"])
            daily_pops.append(round(d_ag["pop"]))
            daily_precip_sums.append(round(d_ag["precip_sum"], 2))
            daily_wind_max.append(round(d_ag["wind_max"], 1))

        return {
            "current": current_mapped,
            "hourly": {
                "time": hourly_times,
                "temperature_2m": hourly_temps,
                "apparent_temperature": hourly_feels,
                "relative_humidity_2m": hourly_hums,
                "weather_code": hourly_codes,
                "precipitation_probability": hourly_pops,
                "precipitation": hourly_precips,
                "wind_speed_10m": hourly_winds,
                "cloud_cover": hourly_clouds,
                "pressure_msl": hourly_pressures
            },
            "daily": {
                "time": daily_times,
                "weather_code": daily_codes,
                "temperature_2m_max": daily_tmax,
                "temperature_2m_min": daily_tmin,
                "precipitation_probability_max": daily_pops,
                "precipitation_sum": daily_precip_sums,
                "wind_speed_10m_max": daily_wind_max
            }
        }

    async def fetch_batch_forecast(self, coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # OWM doesn't have a free batch endpoint for 16-day forecast.
        # We will map over the coordinates concurrently.
        results = await asyncio.gather(
            *[self.fetch_forecast(c["lat"], c["lon"]) for c in coords],
            return_exceptions=True
        )
        # Filter out exceptions and return valid forecasts
        return [r for r in results if not isinstance(r, Exception)]

open_weather_map_provider = OpenWeatherMapProvider()

async def geocode_city_raw(city_name: str) -> Optional[Dict[str, Any]]:
    return await open_weather_map_provider.geocode_city(city_name)

async def fetch_forecast_raw(lat: float, lon: float) -> Dict[str, Any]:
    return await open_weather_map_provider.fetch_forecast(lat, lon)

async def fetch_batch_forecast_raw(coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return await open_weather_map_provider.fetch_batch_forecast(coords)
