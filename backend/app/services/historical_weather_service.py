import logging
import datetime
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from backend.app.core.database import async_session_factory
from backend.app.models.historical_coverage import HistoricalCoverage
from backend.app.models.weather_snapshot import WeatherSnapshot
from backend.app.services.providers.open_meteo import open_meteo_provider
import httpx

logger = logging.getLogger("skycast.historical_service")

class HistoricalWeatherService:
    """
    Orchestrates historical weather data caching. 
    Ensures that the requested date range is fully populated in PostgreSQL.
    """

    ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"

    @classmethod
    async def ensure_coverage(cls, city: str, start_date: datetime.date, end_date: datetime.date) -> None:
        """
        Database-first cache check. Fetches missing date ranges from Open-Meteo Archive API.
        """
        clean_city = city.strip().lower()
        if start_date > end_date:
            return

        # 1. Determine which dates are already cached
        async with async_session_factory() as session:
            stmt = select(HistoricalCoverage.coverage_date).where(
                HistoricalCoverage.city == clean_city,
                HistoricalCoverage.coverage_date >= start_date,
                HistoricalCoverage.coverage_date <= end_date
            )
            res = await session.execute(stmt)
            cached_dates = {row[0] for row in res.all()}

        # 2. Compute missing dates
        all_requested_dates = [start_date + datetime.timedelta(days=x) for x in range((end_date - start_date).days + 1)]
        missing_dates = sorted(list(set(all_requested_dates) - cached_dates))

        if not missing_dates:
            logger.info("✅ [HISTORICAL CACHE] Coverage is fully complete for '%s' from %s to %s.", city, start_date, end_date)
            return

        # 3. Group missing dates into contiguous ranges
        ranges = cls._group_into_ranges(missing_dates)
        logger.info("🔍 [HISTORICAL CACHE] Found %d missing date ranges for '%s'. Fetching...", len(ranges), city)

        # 4. Geocode city once if we have ranges to fetch
        coords = await open_meteo_provider.geocode_city(city)
        if not coords:
            logger.error("Failed to geocode '%s' for historical backfill.", city)
            return
        
        lat = coords.get("latitude", coords.get("lat"))
        lon = coords.get("longitude", coords.get("lon"))
        display_location = f"{coords.get('name', city)}, {coords.get('country', '')}".strip(', ')

        # 5. Fetch and store each range
        for r_start, r_end in ranges:
            await cls._fetch_and_store_range(clean_city, lat, lon, display_location, r_start, r_end)

    @staticmethod
    def _group_into_ranges(dates: List[datetime.date]) -> List[Tuple[datetime.date, datetime.date]]:
        if not dates:
            return []
        ranges = []
        range_start = dates[0]
        prev_date = dates[0]

        for current_date in dates[1:]:
            if (current_date - prev_date).days > 1:
                ranges.append((range_start, prev_date))
                range_start = current_date
            prev_date = current_date
            
        ranges.append((range_start, prev_date))
        return ranges

    @classmethod
    async def _fetch_and_store_range(
        cls, city: str, lat: float, lon: float, display_loc: str, start_date: datetime.date, end_date: datetime.date
    ):
        """
        Fetches data from Open-Meteo Archive API and safely upserts into the database.
        """
        logger.info("📡 [PROVIDER CALL] Fetching historical archive for '%s': %s to %s", city, start_date, end_date)
        
        # We explicitly request UTC timezone to align perfectly with backend architecture
        url = (
            f"{cls.ARCHIVE_API_URL}"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
            f"&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,visibility,weather_code"
            f"&timezone=UTC"
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(url)
                res.raise_for_status()
                data = res.json()
        except Exception as e:
            logger.error("Failed to fetch archive data for '%s' (%s to %s): %s", city, start_date, end_date, e)
            return

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        
        if not times:
            logger.warning("Provider returned empty hourly data for '%s' (%s to %s).", city, start_date, end_date)
            return

        # Map Provider Variables to WeatherSnapshot fields
        temps = hourly.get("temperature_2m", [])
        humidities = hourly.get("relative_humidity_2m", [])
        precips = hourly.get("precipitation", [])
        winds = hourly.get("wind_speed_10m", [])
        wind_dirs = hourly.get("wind_direction_10m", [])
        pressures = hourly.get("surface_pressure", [])
        clouds = hourly.get("cloud_cover", [])
        visibilities = hourly.get("visibility", [])
        codes = hourly.get("weather_code", [])

        # Process the times array to find which dates were *actually* returned
        returned_dates = set()
        snapshot_dicts = []

        for i, t_str in enumerate(times):
            # Parse ISO UTC string "YYYY-MM-DDTHH:MM" returned by Open-Meteo
            dt = datetime.datetime.fromisoformat(t_str).replace(tzinfo=datetime.timezone.utc)
            returned_dates.add(dt.date())

            # Skip if critical variables are null
            if temps[i] is None or humidities[i] is None:
                continue

            # Open-Meteo returns visibility in meters, convert to km
            vis_km = visibilities[i] / 1000.0 if visibilities[i] is not None else 10.0

            snapshot_dicts.append({
                "timestamp": dt,
                "city": city,
                "display_location": display_loc,
                "latitude": lat,
                "longitude": lon,
                "temperature_c": temps[i],
                "feels_like_c": temps[i], # Archive API doesn't usually provide feels_like reliably in this endpoint, fallback to temp
                "humidity_pct": humidities[i],
                "precipitation_mm": precips[i] if precips[i] is not None else 0.0,
                "wind_speed_kmh": winds[i] if winds[i] is not None else 0.0,
                "wind_direction_deg": wind_dirs[i] if wind_dirs[i] is not None else 0.0,
                "wind_direction_label": cls._deg_to_compass(wind_dirs[i]),
                "cloud_cover_pct": clouds[i] if clouds[i] is not None else 0.0,
                "pressure_hpa": pressures[i] if pressures[i] is not None else 1013.0,
                "visibility_km": vis_km,
                "weather_code": codes[i] if codes[i] is not None else 0,
                "condition_text": "Historical",
                "skycast_risk_level": "historical",
                "highest_risk": "historical_record",
                "active_hazards": ""
            })

        if not snapshot_dicts:
            logger.warning("No valid observations parsed from archive response for '%s'.", city)
            return

        # Persist to database using idempotent upsert
        async with async_session_factory() as session:
            # 1. Insert Snapshots
            stmt = pg_insert(WeatherSnapshot).values(snapshot_dicts)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=['city', 'timestamp']
            )
            await session.execute(stmt)

            # 2. Insert Coverage Records only for dates actually returned
            coverage_dicts = [
                {
                    "city": city,
                    "coverage_date": d,
                    "provider": "open_meteo_archive",
                    "fetched_at": datetime.datetime.now(datetime.timezone.utc)
                }
                for d in returned_dates
                if start_date <= d <= end_date  # Ensure we only mark requested dates
            ]
            
            if coverage_dicts:
                cov_stmt = pg_insert(HistoricalCoverage).values(coverage_dicts)
                cov_stmt = cov_stmt.on_conflict_do_nothing(
                    index_elements=['city', 'coverage_date']
                )
                await session.execute(cov_stmt)

            await session.commit()
            logger.info("💾 [HISTORICAL CACHE] Saved %d hourly records and marked %d dates as covered.", len(snapshot_dicts), len(coverage_dicts))

    @staticmethod
    def _deg_to_compass(d: float) -> str:
        if d is None:
            return "N"
        dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        ix = round(d / 45) % 8
        return dirs[ix]
