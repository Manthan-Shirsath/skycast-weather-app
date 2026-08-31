"""Add historical coverage and unique constraint

Revision ID: 003_add_historical_coverage
Revises: 002_create_chat_tables
Create Date: 2026-08-31 17:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_add_historical_coverage'
down_revision: Union[str, None] = '002_create_chat_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create historical_coverage table
    op.create_table(
        'historical_coverage',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('coverage_date', sa.Date(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('city', 'coverage_date', name='uq_historical_coverage_city_date')
    )
    op.create_index(op.f('ix_historical_coverage_city'), 'historical_coverage', ['city'], unique=False)
    op.create_index(op.f('ix_historical_coverage_coverage_date'), 'historical_coverage', ['coverage_date'], unique=False)

    # 2. Add UniqueConstraint to weather_snapshots
    # Note: deduplication was already run manually before this migration
    op.create_unique_constraint('uq_weather_snapshots_city_timestamp', 'weather_snapshots', ['city', 'timestamp'])


def downgrade() -> None:
    # 1. Remove UniqueConstraint from weather_snapshots
    op.drop_constraint('uq_weather_snapshots_city_timestamp', 'weather_snapshots', type_='unique')
    
    # 2. Drop historical_coverage table
    op.drop_index(op.f('ix_historical_coverage_coverage_date'), table_name='historical_coverage')
    op.drop_index(op.f('ix_historical_coverage_city'), table_name='historical_coverage')
    op.drop_table('historical_coverage')
