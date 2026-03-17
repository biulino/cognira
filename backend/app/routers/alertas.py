"""
/api/alertas — Configurable score alerts.

GET  /api/alertas/score                               — list establishments below score threshold
GET  /api/alertas/config                              — read alert configuration
PUT  /api/alertas/config                              — update alert configuration (admin)
POST /api/alertas/{estabelecimento_id}/acao-corretiva — AI corrective action plan (8E.6)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func as safunc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.study import Estudo
from app.models.user import Utilizador
from app.models.settings import ConfiguracaoSistema

router = APIRouter()

_CONFIG_KEY = "alertas_score"
_DEFAULT_THRESHOLD = 70.0


async def _get_threshold(db: AsyncSession, tid: Optional[int] = None) -> float:
    """Read score threshold from configuracoes_sistema (tenant-scoped with global fallback)."""
    import json
    keys = ([f"{_CONFIG_KEY}_{tid}", _CONFIG_KEY] if tid else [_CONFIG_KEY])
    for key in keys:
        row = (
            await db.execute(
                select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == key)
            )
        ).scalar_one_or_none()
        if row:
            try:
                cfg = json.loads(row.valor) if isinstance(row.valor, str) else row.valor
                return float(cfg.get("threshold", _DEFAULT_THRESHOLD))
            except Exception:
                pass
    return _DEFAULT_THRESHOLD


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AlertaConfig(BaseModel):
    threshold: float = _DEFAULT_THRESHOLD


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_alerta_config(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current score alert configuration."""
    tid = tenant_filter(user)
    threshold = await _get_threshold(db, tid)
    return {"threshold": threshold, "chave": _CONFIG_KEY}


@router.put("/config")
async def update_alerta_config(
    body: AlertaConfig,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update score alert threshold (admin only, tenant-scoped)."""
    import json
    from datetime import datetime, timezone

    tid = tenant_filter(user)
    chave = f"{_CONFIG_KEY}_{tid}" if tid else _CONFIG_KEY
    valor = json.dumps({"threshold": body.threshold})
    existing = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == chave)
        )
    ).scalar_one_or_none()

    if existing:
        existing.valor = valor
        existing.atualizado_em = datetime.now(timezone.utc)
    else:
        db.add(
            ConfiguracaoSistema(
                chave=chave,
                valor=valor,
                descricao="Threshold de score para alertas configuráveis",
                atualizado_em=datetime.now(timezone.utc),
            )
        )
    await db.flush()
    return {"status": "ok", "threshold": body.threshold}


@router.get("/score")
async def alertas_score(
    estudo_id: Optional[int] = None,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return establishments whose average score is below the configured threshold."""
    from app.models.visit import Visita
    from app.models.establishment import Estabelecimento

    tid = tenant_filter(user)
    threshold = await _get_threshold(db, tid)

    # Aggregate avg score per estabelecimento — scoped to the user's tenant
    q = (
        select(
            Visita.estabelecimento_id,
            safunc.avg(Visita.pontuacao).label("avg_score"),
            safunc.count(Visita.id).label("total_visitas"),
        )
        .where(
            Visita.pontuacao.is_not(None),
            Visita.pontuacao_estado == "calculada",
        )
        .group_by(Visita.estabelecimento_id)
        .having(safunc.avg(Visita.pontuacao) < threshold)
        .order_by(safunc.avg(Visita.pontuacao).asc())
    )
    if tid is not None:
        q = (
            q.join(Estudo, Visita.estudo_id == Estudo.id)
            .join(Cliente, Estudo.cliente_id == Cliente.id)
            .where(Cliente.tenant_id == tid)
        )
    if estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)

    rows = (await db.execute(q)).all()
    if not rows:
        return {"threshold": threshold, "total": 0, "alertas": []}

    estab_ids = [r.estabelecimento_id for r in rows]
    estabs = (
        await db.execute(
            select(Estabelecimento).where(Estabelecimento.id.in_(estab_ids))
        )
    ).scalars().all()
    estab_map = {e.id: e.nome for e in estabs}

    alertas = []
    for r in rows:
        score = round(float(r.avg_score), 1)
        delta = round(score - threshold, 1)
        severity = (
            "critico" if score < threshold * 0.75
            else "alto" if score < threshold * 0.90
            else "medio"
        )
        alertas.append({
            "estabelecimento_id": r.estabelecimento_id,
            "estabelecimento": estab_map.get(r.estabelecimento_id, "?"),
            "avg_score": score,
            "threshold": threshold,
            "delta": delta,
            "total_visitas": r.total_visitas,
            "severity": severity,
        })

    return {"threshold": threshold, "total": len(alertas), "alertas": alertas}


# ---------------------------------------------------------------------------
# 8E.6 — AI Corrective Action Plan
# ---------------------------------------------------------------------------

@router.post("/{estabelecimento_id}/acao-corretiva")
async def acao_corretiva(
    estabelecimento_id: int,
    estudo_id: Optional[int] = None,
    _: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI closed-loop corrective action plan for an establishment (8E.6)."""
    from app.ai.intelligence import acao_corretiva_estabelecimento
    result = await acao_corretiva_estabelecimento(estabelecimento_id, db, estudo_id)
    if "erro" in result:
        raise HTTPException(status_code=422, detail=result["erro"])
    return result
