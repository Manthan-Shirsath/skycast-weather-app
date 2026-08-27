"""Create weather_snapshots table

Revision ID: 001_create_weather_snapshots
Revises: 
Create Date: 2026-08-25 22:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_create_weather_snapshots'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weather_snapshots',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('display_location', sa.String(length=255), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('temperature_c', sa.Float(), nullable=False),
        sa.Column('feels_like_c', sa.Float(), nullable=True),
        sa.Column('humidity_pct', sa.Float(), nullable=False),
        sa.Column('precipitation_mm', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('rain_probability_pct', sa.Float(), nullable=True),
        sa.Column('wind_speed_kmh', sa.Float(), nullable=False),
        sa.Column('wind_direction_deg', sa.Float(), nullable=True),
        sa.Column('wind_direction_label', sa.String(length=10), nullable=True),
        sa.Column('cloud_cover_pct', sa.Float(), nullable=True),
        sa.Column('pressure_hpa', sa.Float(), nullable=False),
        sa.Column('visibility_km', sa.Float(), nullable=True),
        sa.Column('weather_code', sa.Integer(), nullable=True),
        sa.Column('condition_text', sa.String(length=100), nullable=True),
        sa.Column('skycast_risk_level', sa.String(length=20), nullable=True),
        sa.Column('highest_risk', sa.String(length=100), nullable=True),
        sa.Column('active_hazards', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_weather_snapshots_city_timestamp', 'weather_snapshots', ['city', 'timestamp'], unique=False)
    op.create_index('idx_weather_snapshots_timestamp', 'weather_snapshots', ['timestamp'], unique=False)
    op.create_index(op.f('ix_weather_snapshots_city'), 'weather_snapshots', ['city'], unique=False)
    op.create_index(op.f('ix_weather_snapshots_timestamp'), 'weather_snapshots', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_weather_snapshots_timestamp'), table_name='weather_snapshots')
    op.drop_index(op.f('ix_weather_snapshots_city'), table_name='weather_snapshots')
    op.drop_index('idx_weather_snapshots_timestamp', table_name='weather_snapshots')
    op.drop_index('idx_weather_snapshots_city_timestamp', table_name='weather_snapshots')
    op.drop_table('weather_snapshots')
