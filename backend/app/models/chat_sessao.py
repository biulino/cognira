import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ChatSessao(Base):
    """Persistent AI chat session — stores full conversation history in JSONB.

    Each message is: {"role": "user"|"assistant", "content": str, "ts": ISO8601}
    """

    __tablename__ = "chat_sessoes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("utilizadores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mensagens: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
