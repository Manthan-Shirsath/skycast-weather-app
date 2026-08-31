"""add representation to forecastvalue

Revision ID: 66622be3fc38
Revises: 003_add_historical_coverage
Create Date: 2026-08-31 19:08:44.918625

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '66622be3fc38'
down_revision: Union[str, None] = '003_add_historical_coverage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('forecast_values', sa.Column('representation', sa.String(length=50), server_default='deterministic', nullable=False))


def downgrade() -> None:
    op.drop_column('forecast_values', 'representation')
