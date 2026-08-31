import asyncio
import logging
import datetime
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from backend.app.core.database import async_session_factory
from backend.app.core.model_registry import MODEL_REGISTRY
from backend.app.services.providers.forecast_providers import (
    ForecastProvider,
    EcmwfIfsProvider,
    EcmwfAifsProvider,
    NoaaGfsProvider,
    DwdIconProvider,
    WeatherNext2Provider
)
from backend.app.models.forecast import ForecastRun, ForecastValue

logger = logging.getLogger("skycast.forecast_ingestion")

# V1: Configurable list of locations (matches live collector for now, but independent)
# Future: Read from DB Locations
INGESTION_LOCATIONS = [
    {"name": "Pune", "lat": 18.5204, "lon": 73.8567},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "New Delhi", "lat": 28.6139, "lon": 77.2090},
    {"name": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
    {"name": "Chennai", "lat": 13.0827, "lon": 80.2707},
]

INGESTION_INTERVAL_SECONDS = 3600 * 2  # Run every 2 hours

class ForecastIngestionService:
    def __init__(self):
        self.providers: List[ForecastProvider] = [
            EcmwfIfsProvider(),
            EcmwfAifsProvider(),
            NoaaGfsProvider(),
            DwdIconProvider(),
            WeatherNext2Provider()
        ]

    async def run_ingestion_cycle(self):
        logger.info("Starting forecast ingestion cycle...")
        start_time = datetime.datetime.now(datetime.timezone.utc)
        
        # Determine operational providers from the registry
        operational_providers = [
            p for p in self.providers 
            if MODEL_REGISTRY.get(p.model_id, {}).get("availability") == "operational"
        ]
        
        # Parallelize fetching across locations and providers
        tasks = []
        for loc in INGESTION_LOCATIONS:
            for provider in operational_providers:
                tasks.append(self._fetch_and_store(provider, loc))
                
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Logging Observability
        success_count = 0
        failure_count = 0
        for r in results:
            if isinstance(r, Exception):
                logger.error("⚠️ [ForecastIngestion] Unhandled exception: %s", r)
                failure_count += 1
            elif r is True:
                success_count += 1
            else:
                failure_count += 1
                
        duration = (datetime.datetime.now(datetime.timezone.utc) - start_time).total_seconds()
        logger.info(f"✅ [ForecastIngestion] Completed in {duration:.1f}s. Success: {success_count}, Failed: {failure_count}")

    async def _fetch_and_store(self, provider: ForecastProvider, loc: dict) -> bool:
        loc_name = loc["name"]
        model_id = provider.model_id
        
        try:
            raw_data = await provider.fetch_forecast(loc_name, loc["lat"], loc["lon"])
        except Exception as e:
            logger.error("❌ [ForecastIngestion] %s failed to fetch for %s: %s", model_id, loc_name, e)
            await self._record_failure(model_id, loc_name, str(e))
            return False

        try:
            normalized_data = provider.normalize(raw_data, loc_name)
            if not normalized_data:
                logger.warning("⚠️ [ForecastIngestion] %s returned no data for %s", model_id, loc_name)
                return False
                
            # Use the valid_time of the first item as an approximation of the run_time if not provided explicitly by API
            # Ideally upstream provides explicit run_time, but for OpenMeteo ensemble, it's roughly the first valid_time 
            # for the current update cycle.
            # We truncate to nearest 6 hours for run_time stability.
            first_dt = normalized_data[0]["valid_time"]
            run_time = first_dt.replace(hour=(first_dt.hour // 6) * 6, minute=0, second=0, microsecond=0)
            
            await self._persist_forecast(model_id, loc_name, run_time, normalized_data)
            logger.info("✓ [ForecastIngestion] %s for %s persisted (%d values)", model_id, loc_name, len(normalized_data))
            return True
        except Exception as e:
            logger.error("❌ [ForecastIngestion] %s failed to process for %s: %s", model_id, loc_name, e)
            await self._record_failure(model_id, loc_name, str(e))
            return False

    async def _persist_forecast(self, model_id: str, loc_name: str, run_time: datetime.datetime, values: list):
        async with async_session_factory() as session:
            try:
                # 1. Check if ForecastRun already exists (idempotency)
                stmt = select(ForecastRun).where(
                    ForecastRun.model_id == model_id,
                    ForecastRun.location_name == loc_name,
                    ForecastRun.run_time == run_time
                )
                result = await session.execute(stmt)
                existing_run = result.scalar_one_or_none()
                
                if existing_run:
                    logger.debug("⏭️ [ForecastIngestion] %s for %s at %s already exists. Skipping.", model_id, loc_name, run_time)
                    return
                
                # 2. Create ForecastRun
                run = ForecastRun(
                    model_id=model_id,
                    location_name=loc_name,
                    run_time=run_time,
                    status="success"
                )
                session.add(run)
                await session.flush() # Get run.id
                
                # 3. Bulk insert ForecastValues
                db_values = [
                    ForecastValue(
                        forecast_run_id=run.id,
                        valid_time=v["valid_time"],
                        lead_hours=v["lead_hours"],
                        variable=v["variable"],
                        representation=v.get("representation", "deterministic"),
                        value=v["value"],
                        unit=v["unit"]
                    )
                    for v in values
                ]
                
                session.add_all(db_values)
                await session.commit()
            except IntegrityError as e:
                await session.rollback()
                logger.warning("⚠️ [ForecastIngestion] Integrity error (duplicate?) for %s %s: %s", model_id, loc_name, str(e.__cause__))
            except Exception as e:
                await session.rollback()
                raise e

    async def _record_failure(self, model_id: str, loc_name: str, error_msg: str):
        # We can record the failure in the DB as a ForecastRun with status="failed" 
        # to ensure we don't infinitely retry immediately, and have observability.
        run_time = datetime.datetime.now(datetime.timezone.utc)
        run_time = run_time.replace(minute=0, second=0, microsecond=0)
        
        async with async_session_factory() as session:
            try:
                # Check if we already recorded a failure for this hour
                stmt = select(ForecastRun).where(
                    ForecastRun.model_id == model_id,
                    ForecastRun.location_name == loc_name,
                    ForecastRun.run_time == run_time
                )
                result = await session.execute(stmt)
                if result.scalar_one_or_none():
                    return
                    
                run = ForecastRun(
                    model_id=model_id,
                    location_name=loc_name,
                    run_time=run_time,
                    status="failed"
                )
                session.add(run)
                await session.commit()
            except Exception:
                await session.rollback()


class ForecastIngestionWorker:
    """
    Autonomous background worker for Forecast Intelligence, decoupled from live collector.
    """
    def __init__(self):
        self._is_running = False
        self._task = None
        self.service = ForecastIngestionService()

    def start(self):
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info("⚙️ [ForecastIngestionWorker] Started (interval: %ds).", INGESTION_INTERVAL_SECONDS)

    def stop(self):
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            logger.info("⚙️ [ForecastIngestionWorker] Stopped.")

    async def _run_loop(self):
        await asyncio.sleep(5) # Delay start to not compete with main startup
        
        while self._is_running:
            try:
                await self.service.run_ingestion_cycle()
                await asyncio.sleep(INGESTION_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("⚠️ [ForecastIngestionWorker] Fatal error in loop: %s", exc)
                await asyncio.sleep(60) # Backoff

forecast_ingestion_worker = ForecastIngestionWorker()
