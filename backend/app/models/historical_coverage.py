import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    UniqueConstraint,
    Index
)
from backend.app.models.weather_snapshot import Base

class HistoricalCoverage(Base):
    """
    Tracks which dates have been fully backfilled for a specific city 
    from a historical weather provider to prevent redundant API calls.
    """
    __tablename__ = "historical_coverage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city = Column(String(100), nullable=False, index=True)
    coverage_date = Column(Date, nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    __table_args__ = (
        UniqueConstraint("city", "coverage_date", name="uq_historical_coverage_city_date"),
    )
