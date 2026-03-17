"""Self-service portal endpoints for users with *cliente* study permissions."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import cast, func, select
from sqlalchemy import Date as SADate
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.establishment import Estabelecimento
from app.models.study import Estudo
from app.models.user import Utilizador, PermissaoEstudo
from app.models.visit import Visita

router = APIRouter()


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_cliente_study_ids(user: Utilizador, db: AsyncSession) -> list[int]:
    """Return the IDs of studies the user has 'cliente' (or higher) access to."""
    # Admins/coordenadores see everything; clients only their explicitly assigned studies
    if user.role_global in ("admin", "coordenador", "validador"):
        row = await db.execute(select(Estudo.id))
        return [r for r in row.scalars().all()]
    # Find studies via PermissaoEstudo
    rows = await db.execute(
        select(PermissaoEstudo.estudo_id).where(
            PermissaoEstudo.utilizador_id == user.id,
            PermissaoEstudo.role.in_(["cliente", "coordenador", "validador"]),
        )
    )
    return list(rows.scalars().all())


async def _require_study_access(estudo_id: int, user: Utilizador, db: AsyncSession) -> None:
    """Raise 403 if the user cannot access the given study."""
    if user.role_global in ("admin", "coordenador"):
        return
    allowed = await _get_cliente_study_ids(user, db)
    if estudo_id not in allowed:
        raise HTTPException(403, "Sem acesso a este estudo")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def portal_dashboard(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client portal home: summary of all accessible studies."""
    study_ids = await _get_cliente_study_ids(user, db)
    if not study_ids:
        return {"estudos": []}

    estudos = (
        await db.execute(select(Estudo).where(Estudo.id.in_(study_ids)))
    ).scalars().all()

    results = []
    for est in estudos:
        stats_q = await db.execute(
            select(
                func.count(Visita.id).label("total"),
                func.avg(Visita.pontuacao).label("media"),
            ).where(Visita.estudo_id == est.id)
        )
        row = stats_q.one()
        total = row.total or 0
        media = round(float(row.media), 1) if row.media else None

        por_estado_q = await db.execute(
            select(Visita.estado, func.count(Visita.id).label("cnt"))
            .where(Visita.estudo_id == est.id)
            .group_by(Visita.estado)
        )
        por_estado = {r.estado: r.cnt for r in por_estado_q.all()}

        por_tipo_q = await db.execute(
            select(Visita.tipo_visita, func.count(Visita.id).label("cnt"), func.avg(Visita.pontuacao).label("media"))
            .where(Visita.estudo_id == est.id)
            .group_by(Visita.tipo_visita)
        )
        por_tipo_visita = {
            r.tipo_visita: {"total": r.cnt, "media": round(float(r.media), 1) if r.media else None}
            for r in por_tipo_q.all()
        }

        results.append(
            {
                "id": est.id,
                "nome": est.nome,
                "estado": est.estado,
                "total_visitas": total,
                "pontuacao_media": media,
                "por_estado": por_estado,
                "por_tipo_visita": por_tipo_visita,
            }
        )

    return {"estudos": results}


@router.get("/tendencias/{estudo_id}")
async def portal_tendencias(
    estudo_id: int,
    days: int = Query(30, ge=7, le=365),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily visit counts and score trend for the given study."""
    await _require_study_access(estudo_id, user, db)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Daily submission counts
    timeline_q = await db.execute(
        select(
            cast(Visita.inserida_em, SADate).label("dia"),
            func.count(Visita.id).label("total"),
            func.avg(Visita.pontuacao).label("media_pontuacao"),
        )
        .where(Visita.estudo_id == estudo_id, Visita.inserida_em >= cutoff)
        .group_by(cast(Visita.inserida_em, SADate))
        .order_by(cast(Visita.inserida_em, SADate))
    )

    return [
        {
            "dia": str(row.dia),
            "total": row.total,
            "media_pontuacao": round(float(row.media_pontuacao), 1) if row.media_pontuacao else None,
        }
        for row in timeline_q
    ]


@router.get("/mapa/{estudo_id}")
async def portal_mapa(
    estudo_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Establishment coordinates and average visit scores for the map view."""
    await _require_study_access(estudo_id, user, db)

    rows = await db.execute(
        select(
            Estabelecimento.id,
            Estabelecimento.nome,
            Estabelecimento.latitude,
            Estabelecimento.longitude,
            func.count(Visita.id).label("total_visitas"),
            func.avg(Visita.pontuacao).label("pontuacao_media"),
        )
        .join(Visita, Visita.estabelecimento_id == Estabelecimento.id, isouter=True)
        .where(Visita.estudo_id == estudo_id)
        .group_by(
            Estabelecimento.id,
            Estabelecimento.nome,
            Estabelecimento.latitude,
            Estabelecimento.longitude,
        )
        .having(Estabelecimento.latitude.isnot(None), Estabelecimento.longitude.isnot(None))
    )

    return [
        {
            "id": r.id,
            "nome": r.nome,
            "lat": float(r.latitude),
            "lng": float(r.longitude),
            "total_visitas": r.total_visitas or 0,
            "pontuacao_media": round(float(r.pontuacao_media), 1) if r.pontuacao_media else None,
        }
        for r in rows
    ]


@router.get("/relatorio/{estudo_id}")
async def portal_relatorio(
    estudo_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """High-level narrative summary for the study (top/bottom performing stores)."""
    await _require_study_access(estudo_id, user, db)

    # Top 5 by score
    top = (
        await db.execute(
            select(Visita, Estabelecimento)
            .join(Estabelecimento, Visita.estabelecimento_id == Estabelecimento.id)
            .where(Visita.estudo_id == estudo_id, Visita.pontuacao.isnot(None))
            .order_by(Visita.pontuacao.desc())
            .limit(5)
        )
    ).all()

    bottom = (
        await db.execute(
            select(Visita, Estabelecimento)
            .join(Estabelecimento, Visita.estabelecimento_id == Estabelecimento.id)
            .where(Visita.estudo_id == estudo_id, Visita.pontuacao.isnot(None))
            .order_by(Visita.pontuacao.asc())
            .limit(5)
        )
    ).all()

    def _fmt(pairs: list) -> list[dict]:
        return [
            {"visita_id": v.id, "estabelecimento": e.nome, "pontuacao": float(v.pontuacao)}
            for v, e in pairs
        ]

    return {
        "top5": _fmt(top),
        "bottom5": _fmt(bottom),
    }


# ── AI Study Summary ──────────────────────────────────────────────────────────

@router.get("/resumo-ia/{estudo_id}")
async def portal_resumo_ia(
    estudo_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a narrative AI summary for the study using gpt-4.1-nano."""
    import json as _json
    from openai import AsyncOpenAI
    from app.config import get_settings

    await _require_study_access(estudo_id, user, db)

    estudo = (await db.execute(select(Estudo).where(Estudo.id == estudo_id))).scalar_one_or_none()
    if not estudo:
        raise HTTPException(404, "Estudo não encontrado")

    # Aggregate stats
    total_row = await db.execute(
        select(func.count(Visita.id), func.avg(Visita.pontuacao))
        .where(Visita.estudo_id == estudo_id)
    )
    total_count, avg_score = total_row.one()

    estado_rows = await db.execute(
        select(Visita.estado, func.count(Visita.id))
        .where(Visita.estudo_id == estudo_id)
        .group_by(Visita.estado)
    )
    estados = {row[0]: row[1] for row in estado_rows}

    # Top 5 / bottom 5
    top = (await db.execute(
        select(Visita, Estabelecimento)
        .join(Estabelecimento, Visita.estabelecimento_id == Estabelecimento.id)
        .where(Visita.estudo_id == estudo_id, Visita.pontuacao.isnot(None))
        .order_by(Visita.pontuacao.desc())
        .limit(5)
    )).all()

    bottom = (await db.execute(
        select(Visita, Estabelecimento)
        .join(Estabelecimento, Visita.estabelecimento_id == Estabelecimento.id)
        .where(Visita.estudo_id == estudo_id, Visita.pontuacao.isnot(None))
        .order_by(Visita.pontuacao.asc())
        .limit(5)
    )).all()

    top_list = [{"loja": e.nome, "pontuacao": float(v.pontuacao)} for v, e in top]
    bottom_list = [{"loja": e.nome, "pontuacao": float(v.pontuacao)} for v, e in bottom]

    data = {
        "estudo": estudo.nome,
        "total_visitas": total_count,
        "pontuacao_media": round(float(avg_score), 1) if avg_score else None,
        "estados": estados,
        "top5": top_list,
        "bottom5": bottom_list,
    }

    prompt = (
        "És um analista sénior de mystery shopping. Com base nos dados abaixo, "
        "escreve um resumo executivo em português europeu (5-8 frases). "
        "Destaca pontos fortes, fracos e recomendações accionáveis.\n\n"
        f"```json\n{_json.dumps(data, ensure_ascii=False, indent=2)}\n```"
    )

    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    response = await client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=600,
        temperature=0.6,
    )
    text = response.choices[0].message.content or ""
    return {"estudo_id": estudo_id, "resumo": text.strip()}

