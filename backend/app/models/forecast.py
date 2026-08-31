import datetime
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Float,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index
)
from sqlalchemy.orm import relationship
from backend.app.models.weather_snapshot import Base

class ForecastRun(Base):
    """
    Tracks a specific execution of a forecast model fetching routine.
    """
    __tablename__ = "forecast_runs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    model_id = Column(String(50), nullable=False, index=True)
    location_name = Column(String(100), nullable=False, index=True)
    run_time = Column(DateTime(timezone=True), nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    status = Column(String(20), nullable=False, default="success")

    values = relationship("ForecastValue", back_populates="run", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("model_id", "location_name", "run_time", name="uix_forecast_run_identity"),
        Index("idx_forecast_runs_lookup", "location_name", "model_id", "run_time"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "model_id": self.model_id,
            "location_name": self.location_name,
            "run_time": self.run_time.isoformat() if self.run_time else None,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "status": self.status
        }


class ForecastValue(Base):
    """
    Stores individual forecast parameter values preserving model, location, run_time, valid_time, and lead_time.
    """
    __tablename__ = "forecast_values"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    forecast_run_id = Column(BigInteger, ForeignKey("forecast_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    valid_time = Column(DateTime(timezone=True), nullable=False, index=True)
    lead_hours = Column(Integer, nullable=False)
    variable = Column(String(50), nullable=False)
    representation = Column(String(50), nullable=False, server_default="deterministic")
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)

    run = relationship("ForecastRun", back_populates="values")

    __table_args__ = (
        UniqueConstraint("forecast_run_id", "valid_time", "lead_hours", "variable", "representation", name="uix_forecast_value_identity"),
        Index("idx_forecast_values_query", "forecast_run_id", "variable", "valid_time"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "forecast_run_id": self.forecast_run_id,
            "valid_time": self.valid_time.isoformat() if self.valid_time else None,
            "lead_hours": self.lead_hours,
            "variable": self.variable,
            "representation": self.representation,
            "value": self.value,
            "unit": self.unit
        }
