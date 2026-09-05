"""
Climate & Historical Weather Research Service.
Fetches REAL historical data from the Open-Meteo Archive API.
Computes descriptive statistics (min, max, mean, total, trend) from observed data.
Does NOT fabricate or hardcode any historical values.
"""
import datetime
import logging
import httpx
from typing import Dict, Any, List, Optional, Tuple

from backend.app.services.providers.open_meteo import open_meteo_provider

logger = logging.getLogger("skycast.climate")

ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"
ARCHIVE_TIMEOUT_SECONDS = 20.0


def _safe_mean(values: List[float]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


def _safe_min(values: List[float]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return round(min(vals), 2) if vals else None


def _safe_max(values: List[float]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return round(max(vals), 2) if vals else None


def _safe_sum(values: List[float]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return round(sum(vals), 2) if vals else None


def _anomaly(value: Optional[float], baseline: Optional[float]) -> Optional[float]:
    if value is None or baseline is None:
        return None
    return round(value - baseline, 2)


class ClimateService:
    """
    Climate analysis service providing real historical data,
    descriptive statistics, comparisons, and trend summaries.
    Data source: Open-Meteo Archive API (ERA5 reanalysis, ~5-day lag).
    """

    @classmethod
    async def _geocode(cls, city: str) -> Optional[Dict[str, Any]]:
        return await open_meteo_provider.geocode_city(city)

    @classmethod
    async def _fetch_archive(
        cls,
        lat: float,
        lon: float,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch daily historical data from Open-Meteo Archive API.
        Uses ERA5 reanalysis (global, ~5-day data lag, no API key required).
        Returns raw JSON or None on failure.
        """
        # Archive API has a ~5-day lag; clamp end_date to 5 days ago
        cutoff = datetime.date.today() - datetime.timedelta(days=5)
        if end_date >= cutoff:
            end_date = cutoff
        if start_date > end_date:
            return None

        url = (
            f"{ARCHIVE_API_URL}"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
            f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,"
            f"precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean"
            f"&timezone=UTC"
        )
        try:
            async with httpx.AsyncClient(timeout=ARCHIVE_TIMEOUT_SECONDS) as client:
                res = await client.get(url)
                res.raise_for_status()
                return res.json()
        except Exception as exc:
            logger.error("Archive API fetch failed for (%s, %s): %s", lat, lon, exc)
            return None

    @classmethod
    async def _compute_stats(
        cls,
        raw: Dict[str, Any],
        metric: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compute descriptive statistics over a daily archive response."""
        daily = raw.get("daily", {})
        dates = daily.get("time", [])
        t_max = daily.get("temperature_2m_max", [])
        t_min = daily.get("temperature_2m_min", [])
        t_mean = daily.get("temperature_2m_mean", [])
        precip = daily.get("precipitation_sum", [])
        wind = daily.get("wind_speed_10m_max", [])
        humidity = daily.get("relative_humidity_2m_mean", [])

        # Pair dates with values for argmin/argmax
        def argmax_date(vals, dts):
            if not vals or not dts:
                return None
            paired = [(v, d) for v, d in zip(vals, dts) if v is not None]
            return max(paired, key=lambda x: x[0])[1] if paired else None

        def argmin_date(vals, dts):
            if not vals or not dts:
                return None
            paired = [(v, d) for v, d in zip(vals, dts) if v is not None]
            return min(paired, key=lambda x: x[0])[1] if paired else None

        result: Dict[str, Any] = {
            "days_covered": len(dates),
            "start_date": dates[0] if dates else None,
            "end_date": dates[-1] if dates else None,
            "data_source": "Open-Meteo Archive API (ERA5 reanalysis)",
            "data_type": "observed_historical",
        }

        if metric is None or metric == "temperature":
            result["temperature"] = {
                "avg_max_c": _safe_mean(t_max),
                "avg_min_c": _safe_mean(t_min),
                "avg_mean_c": _safe_mean(t_mean),
                "overall_max_c": _safe_max(t_max),
                "overall_max_date": argmax_date(t_max, dates),
                "overall_min_c": _safe_min(t_min),
                "overall_min_date": argmin_date(t_min, dates),
            }

        if metric is None or metric == "precipitation":
            rainy_days = sum(1 for v in precip if v is not None and v >= 1.0)
            result["precipitation"] = {
                "total_mm": _safe_sum(precip),
                "avg_daily_mm": _safe_mean(precip),
                "max_daily_mm": _safe_max(precip),
                "max_daily_date": argmax_date(precip, dates),
                "rainy_days": rainy_days,
                "rainy_day_pct": round(rainy_days / len(dates) * 100, 1) if dates else None,
            }

        if metric is None or metric == "wind":
            result["wind"] = {
                "avg_max_kmh": _safe_mean(wind),
                "overall_max_kmh": _safe_max(wind),
                "overall_max_date": argmax_date(wind, dates),
            }

        if metric is None or metric == "humidity":
            result["humidity"] = {
                "avg_pct": _safe_mean(humidity),
                "max_pct": _safe_max(humidity),
                "min_pct": _safe_min(humidity),
            }

        return result

    @classmethod
    async def get_historical_summary(
        cls,
        city: str,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
        metric: Optional[str] = None,
        compare_start: Optional[datetime.date] = None,
        compare_end: Optional[datetime.date] = None,
    ) -> Dict[str, Any]:
        """
        Fetch and compute descriptive statistics for a real historical period.
        Optionally compare to a prior period.
        """
        today = datetime.date.today()
        if end_date is None:
            end_date = today - datetime.timedelta(days=6)
        if start_date is None:
            start_date = end_date - datetime.timedelta(days=29)

        coords = await cls._geocode(city)
        if not coords:
            return {
                "error": f"Could not geocode location '{city}'.",
                "city": city,
                "data_type": "error",
            }

        lat = coords.get("latitude") or coords.get("lat")
        lon = coords.get("longitude") or coords.get("lon")
        display_name = f"{coords.get('name', city)}, {coords.get('country', '')}".strip(", ")

        raw = await cls._fetch_archive(lat, lon, start_date, end_date)
        if not raw:
            return {
                "error": "Historical archive data is currently unavailable. The Open-Meteo Archive API may be temporarily unreachable.",
                "city": display_name,
                "data_type": "error",
                "data_source": "Open-Meteo Archive API (ERA5 reanalysis)",
            }

        stats = await cls._compute_stats(raw, metric)
        result = {
            "city": display_name,
            "requested_period": f"{start_date.isoformat()} to {end_date.isoformat()}",
            **stats,
        }

        # Optional comparison period
        if compare_start and compare_end:
            raw_cmp = await cls._fetch_archive(lat, lon, compare_start, compare_end)
            if raw_cmp:
                cmp_stats = await cls._compute_stats(raw_cmp, metric)
                result["comparison_period"] = f"{compare_start.isoformat()} to {compare_end.isoformat()}"
                result["comparison"] = cmp_stats

                # Compute anomalies for temperature and precipitation
                if "temperature" in stats and "temperature" in cmp_stats:
                    result["anomaly_temperature_mean_c"] = _anomaly(
                        stats["temperature"]["avg_mean_c"],
                        cmp_stats["temperature"]["avg_mean_c"]
                    )
                if "precipitation" in stats and "precipitation" in cmp_stats:
                    result["anomaly_precipitation_total_mm"] = _anomaly(
                        stats["precipitation"]["total_mm"],
                        cmp_stats["precipitation"]["total_mm"]
                    )

        return result

    # -----------------------------------------------------------------------
    # Legacy methods preserved for existing REST endpoints and CSV export.
    # These also now call real archive data (30-day default).
    # -----------------------------------------------------------------------

    @classmethod
    async def get_summary(cls, city: str, range_str: str = "12m") -> Dict[str, Any]:
        today = datetime.date.today()
        r = range_str.lower()
        if r == "24h":
            # Archive has a 5-day lag; can't serve 24h - use 7d instead
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=6)
        elif r == "7d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=6)
        elif r == "30d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=29)
        else:  # 12m
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=364)

        result = await cls.get_historical_summary(city, start_date, end_date)
        result["range"] = r
        return result

    @classmethod
    async def get_temperature_trend(cls, city: str, range_str: str = "12m") -> List[Dict[str, Any]]:
        today = datetime.date.today()
        r = range_str.lower()
        if r == "7d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=6)
        elif r == "30d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=29)
        else:
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=364)

        coords = await cls._geocode(city)
        if not coords:
            return []
        lat = coords.get("latitude") or coords.get("lat")
        lon = coords.get("longitude") or coords.get("lon")
        raw = await cls._fetch_archive(lat, lon, start_date, end_date)
        if not raw:
            return []

        daily = raw.get("daily", {})
        dates = daily.get("time", [])
        t_max = daily.get("temperature_2m_max", [])
        t_min = daily.get("temperature_2m_min", [])
        t_mean = daily.get("temperature_2m_mean", [])

        trend = []
        for i, d in enumerate(dates):
            trend.append({
                "label": d,
                "avgHigh": t_max[i] if i < len(t_max) else None,
                "avgLow": t_min[i] if i < len(t_min) else None,
                "feelsLike": t_mean[i] if i < len(t_mean) else None,
            })
        return trend

    @classmethod
    async def get_rainfall_trend(cls, city: str, range_str: str = "12m") -> List[Dict[str, Any]]:
        today = datetime.date.today()
        r = range_str.lower()
        if r == "7d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=6)
        elif r == "30d":
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=29)
        else:
            end_date = today - datetime.timedelta(days=6)
            start_date = end_date - datetime.timedelta(days=364)

        coords = await cls._geocode(city)
        if not coords:
            return []
        lat = coords.get("latitude") or coords.get("lat")
        lon = coords.get("longitude") or coords.get("lon")
        raw = await cls._fetch_archive(lat, lon, start_date, end_date)
        if not raw:
            return []

        daily = raw.get("daily", {})
        dates = daily.get("time", [])
        precip = daily.get("precipitation_sum", [])
        return [
            {"label": d, "rainfall": precip[i] if i < len(precip) else None}
            for i, d in enumerate(dates)
        ]

    @classmethod
    async def get_distribution(cls, city: str, range_str: str = "12m") -> Dict[str, Any]:
        """Compute real temperature and rainfall distribution buckets."""
        today = datetime.date.today()
        end_date = today - datetime.timedelta(days=6)
        start_date = end_date - datetime.timedelta(days=364 if range_str == "12m" else 29)

        coords = await cls._geocode(city)
        if not coords:
            return {"city": city, "range": range_str, "temperature": [], "rainfall": [], "error": "Geocoding failed"}
        lat = coords.get("latitude") or coords.get("lat")
        lon = coords.get("longitude") or coords.get("lon")
        raw = await cls._fetch_archive(lat, lon, start_date, end_date)
        if not raw:
            return {"city": city, "range": range_str, "temperature": [], "rainfall": [], "error": "Archive unavailable"}

        daily = raw.get("daily", {})
        t_mean = [v for v in daily.get("temperature_2m_mean", []) if v is not None]
        precip = [v for v in daily.get("precipitation_sum", []) if v is not None]
        total = len(t_mean) or 1

        temp_buckets = [
            ("> 35°C", "#EF4444", lambda v: v > 35),
            ("30°C - 35°C", "#F97316", lambda v: 30 <= v <= 35),
            ("25°C - 30°C", "#FBBF24", lambda v: 25 <= v < 30),
            ("20°C - 25°C", "#3B82F6", lambda v: 20 <= v < 25),
            ("< 20°C", "#8B5CF6", lambda v: v < 20),
        ]
        temp_dist = [{"name": n, "value": round(sum(1 for v in t_mean if f(v)) / total * 100, 1), "color": c}
                     for n, c, f in temp_buckets]

        total_r = len(precip) or 1
        rain_buckets = [
            ("Very Heavy (>150mm)", "#6366F1", lambda v: v > 150),
            ("Heavy (64-150mm)", "#3B82F6", lambda v: 64 <= v <= 150),
            ("Moderate (16-63mm)", "#06B6D4", lambda v: 16 <= v < 64),
            ("Light (1-15mm)", "#10B981", lambda v: 1 <= v < 16),
            ("No Rain", "#94A3B8", lambda v: v < 1),
        ]
        rain_dist = [{"name": n, "value": round(sum(1 for v in precip if f(v)) / total_r * 100, 1), "color": c}
                     for n, c, f in rain_buckets]

        return {"city": city, "range": range_str, "temperature": temp_dist, "rainfall": rain_dist,
                "data_source": "Open-Meteo Archive API (ERA5)", "data_type": "observed_historical"}

    @classmethod
    async def get_insights(cls, city: str, range_str: str = "12m") -> Dict[str, Any]:
        """Generate descriptive insights from real archive data."""
        summary = await cls.get_summary(city, range_str)
        insights = []

        if "temperature" in summary:
            temp = summary["temperature"]
            avg = temp.get("avg_mean_c")
            if avg is not None:
                insights.append({
                    "type": "temp",
                    "icon": "thermometer",
                    "headline": f"Average temperature in {city}: {avg}°C (observed).",
                    "detail": f"Max recorded: {temp.get('overall_max_c')}°C on {temp.get('overall_max_date')}. "
                              f"Min: {temp.get('overall_min_c')}°C on {temp.get('overall_min_date')}.",
                })

        if "precipitation" in summary:
            rain = summary["precipitation"]
            total = rain.get("total_mm")
            rainy = rain.get("rainy_days")
            if total is not None:
                insights.append({
                    "type": "rain",
                    "icon": "cloud-rain",
                    "headline": f"Total rainfall: {total}mm over {rainy} rainy day(s).",
                    "detail": f"Peak rainfall: {rain.get('max_daily_mm')}mm on {rain.get('max_daily_date')}.",
                })

        if "error" in summary:
            insights.append({
                "type": "error",
                "icon": "warning",
                "headline": "Historical data unavailable.",
                "detail": summary["error"],
            })

        return {
            "city": city,
            "range": range_str,
            "insights": insights,
            "disclaimer": (
                "Statistics are computed from ERA5 reanalysis data via Open-Meteo Archive API. "
                "These are observed/modelled historical values, NOT official government records."
            ),
        }

    @classmethod
    async def get_comparison(cls, cities: List[str], range_str: str = "12m") -> Dict[str, Any]:
        today = datetime.date.today()
        end_date = today - datetime.timedelta(days=6)
        start_date = end_date - datetime.timedelta(days=364 if range_str == "12m" else 29)

        results = []
        for city in cities[:4]:
            coords = await cls._geocode(city)
            if not coords:
                continue
            lat = coords.get("latitude") or coords.get("lat")
            lon = coords.get("longitude") or coords.get("lon")
            raw = await cls._fetch_archive(lat, lon, start_date, end_date)
            if not raw:
                continue
            stats = await cls._compute_stats(raw, "temperature")
            results.append({
                "city": city,
                "avg_mean_c": stats.get("temperature", {}).get("avg_mean_c"),
                "avg_max_c": stats.get("temperature", {}).get("avg_max_c"),
                "avg_min_c": stats.get("temperature", {}).get("avg_min_c"),
            })

        return {
            "cities": cities,
            "range": range_str,
            "comparison": results,
            "data_source": "Open-Meteo Archive API (ERA5)",
            "data_type": "observed_historical",
        }

    @classmethod
    async def generate_csv_export(cls, city: str, range_str: str = "12m") -> str:
        temps = await cls.get_temperature_trend(city, range_str)
        rains = await cls.get_rainfall_trend(city, range_str)

        lines = ["Period,Avg High (°C),Avg Low (°C),Feels Like (°C),Rainfall (mm)"]
        for i, t in enumerate(temps):
            label = t["label"]
            h = t.get("avgHigh", "")
            l = t.get("avgLow", "")
            fl = t.get("feelsLike", "")
            r = rains[i]["rainfall"] if i < len(rains) else ""
            lines.append(f"{label},{h},{l},{fl},{r}")

        return "\n".join(lines)
