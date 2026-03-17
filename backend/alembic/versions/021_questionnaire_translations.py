"""021_questionnaire_translations.py — Multi-language support for questionnaires (Wave 8.9)"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "021_questionnaire_translations"
down_revision = "020_planogram"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "questionarios",
        sa.Column("translations_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column("questionarios", "translations_json")
