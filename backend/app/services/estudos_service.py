"""Business logic for study (estudo) operations.

Extracted from routers/estudos.py to keep the HTTP layer thin and these
functions independently testable.
"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import tenant_filter
from app.models.client import Cliente
from app.models.study import Estudo
from app.models.user import Utilizador


async def estudo_or_404(db: AsyncSession, estudo_id: int, user: Utilizador) -> Estudo:
    """Fetch an Estudo by ID, enforcing tenant isolation via the parent Cliente."""
    q = (
        select(Estudo)
        .join(Cliente, Estudo.cliente_id == Cliente.id)
        .where(Estudo.id == estudo_id)
    )
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    estudo = (await db.execute(q)).scalar_one_or_none()
    if not estudo:
        raise HTTPException(status_code=404, detail="Estudo não encontrado")
    return estudo


async def check_estudo_access(estudo_id: int, user: Utilizador, db: AsyncSession) -> Estudo:
    """Return the Estudo if the user may access it, raise 403 otherwise."""
    estudo = (await db.execute(select(Estudo).where(Estudo.id == estudo_id))).scalar_one_or_none()
    if not estudo:
        raise HTTPException(status_code=404, detail="Estudo não encontrado")
    if user.role_global not in ("admin", "coordenador", "superadmin"):
        allowed = {p.estudo_id for p in (user.permissoes or [])}
        if estudo_id not in allowed:
            raise HTTPException(status_code=403, detail="Sem acesso a este estudo")
    tid = tenant_filter(user)
    if tid is not None:
        cliente = (await db.execute(select(Cliente).where(Cliente.id == estudo.cliente_id))).scalar_one_or_none()
        if not cliente or cliente.tenant_id != tid:
            raise HTTPException(status_code=403, detail="Sem acesso a este estudo")
    return estudo


def has_study_access(user: Utilizador, estudo_id: int, permissoes_sync) -> bool:
    """Synchronous helper: returns True if user has access to *estudo_id*."""
    return any(p.estudo_id == estudo_id for p in (permissoes_sync or []))


def parse_campos(tipo_car: Optional[dict]) -> list[dict]:
    """Convert any stored format to List[CampoConfig-dict]."""
    if not tipo_car:
        return []
    if "v2" in tipo_car:
        return tipo_car["v2"]
    # Old format: {"0": "label", "1": "label", ...}
    return [
        {"chave": label.lower().replace(" ", "_").replace("(", "").replace(")", ""),
         "label": label, "tipo": "text", "opcoes": [], "obrigatorio": False}
        for _, label in sorted(tipo_car.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 9999)
    ]


async def compute_benchmarking(db: AsyncSession, user: Utilizador) -> list[dict]:
    """Return anonymised per-study KPIs for benchmarking.

    Admins see real study names; others see them masked (Estudo #hash).
    Non-staff users only see studies they have permission for.
    """
    is_staff = user.role_global in ("admin", "coordenador")
    tid = tenant_filter(user)

    allowed_ids: Optional[list[int]] = None
    if not is_staff:
        allowed_ids = [p.estudo_id for p in (user.permissoes or [])]
        if not allowed_ids:
            return []

    sql = text("""
        SELECT
            e.id                                                          AS estudo_id,
            e.nome                                                        AS nome,
            e.estado                                                      AS estado,
            COUNT(v.id)                                                   AS total_visitas,
            ROUND(AVG(v.pontuacao)::numeric, 1)                          AS avg_pontuacao,
            ROUND(
                100.0 * SUM(CASE WHEN v.estado IN ('validada','fechada') THEN 1 ELSE 0 END)
                / NULLIF(COUNT(v.id), 0)
            , 1)                                                          AS taxa_aprovacao,
            ROUND(
                AVG(
                    EXTRACT(EPOCH FROM (v.realizada_fim - v.realizada_inicio)) / 60
                )::numeric, 1
            )                                                             AS duracao_media_min,
            COUNT(DISTINCT v.analista_id)                                 AS num_analistas
        FROM estudos e
        JOIN clientes c ON c.id = e.cliente_id
        LEFT JOIN visitas v ON v.estudo_id = e.id AND v.activo = true
        WHERE (:all_studies OR e.id = ANY(:study_ids))
          AND (:tenant_id IS NULL OR c.tenant_id = :tenant_id)
        GROUP BY e.id, e.nome, e.estado
        ORDER BY avg_pontuacao DESC NULLS LAST
    """)
    rows = (await db.execute(sql, {
        "all_studies": is_staff,
        "study_ids": allowed_ids or [],
        "tenant_id": tid,
    })).fetchall()
    is_admin = user.role_global == "admin"

    result = []
    for r in rows:
        nome = r.nome if is_admin else f"Estudo #{abs(hash(r.nome)) % 9999:04d}"
        result.append({
            "estudo_id": r.estudo_id if is_admin else None,
            "nome": nome,
            "estado": r.estado,
            "total_visitas": r.total_visitas or 0,
            "avg_pontuacao": float(r.avg_pontuacao) if r.avg_pontuacao is not None else None,
            "taxa_aprovacao": float(r.taxa_aprovacao) if r.taxa_aprovacao is not None else None,
            "duracao_media_min": float(r.duracao_media_min) if r.duracao_media_min is not None else None,
            "num_analistas": r.num_analistas or 0,
        })
    return result
