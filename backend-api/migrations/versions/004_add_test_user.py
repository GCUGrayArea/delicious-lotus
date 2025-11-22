"""add test user

Revision ID: 004
Revises: 003
Create Date: 2025-11-21

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add test user for development/testing."""
    op.execute(
        "INSERT INTO users (id, created_at, updated_at) "
        "VALUES ('00000000-0000-0000-0000-000000000001', NOW(), NOW()) "
        "ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    """Remove test user."""
    op.execute(
        "DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001'"
    )
