"""8F.1 — Audit log: complete history of all actions."""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.compliance import AuditLog
from app.models.user import Utilizador

router = APIRouter()


def _log_out(entry: AuditLog) -> dict:
    return {
        "id": entry.id,
        "utilizador_id": str(entry.utilizador_id) if entry.utilizador_id else None,
        "entidade": entry.entidade,
        "entidade_id": entry.entidade_id,
        "acao": entry.acao,
        "dados_anteriores": entry.dados_anteriores,
        "dados_novos": entry.dados_novos,
        "ip": entry.ip,
        "criado_em": entry.criado_em.isoformat() if entry.criado_em else None,
    }


@router.get("/")
async def list_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entidade: Optional[str] = None,
    acao: Optional[str] = None,
    utilizador_id: Optional[str] = None,
    data_ini: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
    _user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit log — admin/coordenador only."""
    stmt = select(AuditLog).order_by(desc(AuditLog.criado_em))

    tid = tenant_filter(_user)
    if tid is not None:
        # Scope to users in the same tenant (including system actions with no user)
        tenant_user_ids = select(Utilizador.id).where(Utilizador.tenant_id == tid)
        stmt = stmt.where(
            (AuditLog.utilizador_id.is_(None)) | (AuditLog.utilizador_id.in_(tenant_user_ids))
        )

    if entidade:
        stmt = stmt.where(AuditLog.entidade == entidade)
    if acao:
        stmt = stmt.where(AuditLog.acao == acao)
    if utilizador_id:
        stmt = stmt.where(AuditLog.utilizador_id == utilizador_id)
    if data_ini:
        stmt = stmt.where(AuditLog.criado_em >= data_ini)
    if data_fim:
        stmt = stmt.where(AuditLog.criado_em <= data_fim)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_log_out(r) for r in rows],
    }


@router.get("/entidades")
async def list_entidades(
    _user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Return distinct entity types present in the log."""
    stmt = select(AuditLog.entidade, func.count(AuditLog.id).label("n"))
    tid = tenant_filter(_user)
    if tid is not None:
        tenant_user_ids = select(Utilizador.id).where(Utilizador.tenant_id == tid)
        stmt = stmt.where(
            (AuditLog.utilizador_id.is_(None)) | (AuditLog.utilizador_id.in_(tenant_user_ids))
        )
    rows = (
        await db.execute(stmt.group_by(AuditLog.entidade).order_by(desc("n")))
    ).all()
    return [{"entidade": r.entidade, "total": r.n} for r in rows]


@router.get("/acoes")
async def list_acoes(
    _user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Return distinct action types present in the log."""
    stmt = select(AuditLog.acao, func.count(AuditLog.id).label("n"))
    tid = tenant_filter(_user)
    if tid is not None:
        tenant_user_ids = select(Utilizador.id).where(Utilizador.tenant_id == tid)
        stmt = stmt.where(
            (AuditLog.utilizador_id.is_(None)) | (AuditLog.utilizador_id.in_(tenant_user_ids))
        )
    rows = (
        await db.execute(stmt.group_by(AuditLog.acao).order_by(desc("n")))
    ).all()
    return [{"acao": r.acao, "total": r.n} for r in rows]
