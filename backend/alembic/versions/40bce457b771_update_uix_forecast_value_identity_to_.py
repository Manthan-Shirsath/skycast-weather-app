"""update uix_forecast_value_identity to include representation

Revision ID: 40bce457b771
Revises: 66622be3fc38
Create Date: 2026-08-31 19:32:40.801871

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '40bce457b771'
down_revision: Union[str, None] = '66622be3fc38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old constraint and create the new one
    op.drop_constraint(op.f('uix_forecast_value_identity'), 'forecast_values', type_='unique')
    op.create_unique_constraint('uix_forecast_value_identity', 'forecast_values', ['forecast_run_id', 'valid_time', 'lead_hours', 'variable', 'representation'])


def downgrade() -> None:
    # Revert back to the old constraint
    op.drop_constraint('uix_forecast_value_identity', 'forecast_values', type_='unique')
    op.create_unique_constraint(op.f('uix_forecast_value_identity'), 'forecast_values', ['forecast_run_id', 'valid_time', 'lead_hours', 'variable'])
