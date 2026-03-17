from typing import Optional
import uuid

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance import AuditLog


async def log_action(
    db: AsyncSession,
    *,
    utilizador_id: Optional[uuid.UUID],
    entidade: str,
    entidade_id: Optional[str],
    acao: str,
    dados_anteriores: Optional[dict] = None,
    dados_novos: Optional[dict] = None,
    ip: Optional[str] = None,
) -> None:
    entry = AuditLog(
        utilizador_id=utilizador_id,
        entidade=entidade,
        entidade_id=entidade_id,
        acao=acao,
        dados_anteriores=dados_anteriores,
        dados_novos=dados_novos,
        ip=ip,
    )
    db.add(entry)
