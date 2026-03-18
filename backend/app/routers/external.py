"""
/api/external — Public REST API authenticated via X-Api-Key header.

All endpoints here require a valid API key (see POST /api/webhooks/api-keys).
Rate limiting is enforced automatically per key based on rate_limit_rpm.

Endpoints:
  GET  /api/external/me              — info about the API key / client
  GET  /api/external/visitas         — list visits for the key's client
  GET  /api/external/estabelecimentos — list establishments for the key's client
  GET  /api/external/estudos          — list studies for the key's client
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_api_key
from app.models.webhook import ApiKey
from app.models.client import Cliente
from app.models.establishment import Estabelecimento
from app.models.visit import Visita
from app.edition import require_pro
from app.models.study import Estudo

router = APIRouter(prefix="/external", tags=["external-api"])


@router.get("/me", summary="Info sobre a API key e o cliente associado")
async def get_key_info(
    key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Returns metadata about the calling API key and its associated client."""
    require_pro("api_keys")
    cliente = (
        await db.execute(select(Cliente).where(Cliente.id == key.cliente_id))
    ).scalar_one_or_none()
    return {
        "api_key": {
            "id": str(key.id),
            "nome": key.nome,
            "prefix": key.key_prefix,
            "scopes": key.scopes,
            "rate_limit_rpm": key.rate_limit_rpm,
            "ultimo_uso": key.ultimo_uso,
        },
        "cliente": {
            "id": cliente.id if cliente else None,
            "nome": cliente.nome if cliente else None,
            "tenant_id": cliente.tenant_id if cliente else None,
        },
    }


@router.get("/visitas", summary="Lista visitas do cliente (paginada)")
async def list_visitas(
    key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: validada)"),
):
    """Returns visits scoped to the API key's client."""
    q = select(Visita).where(Visita.cliente_id == key.cliente_id).offset(skip).limit(limit)
    if estado:
        q = q.where(Visita.estado == estado)
    rows = (await db.execute(q.order_by(Visita.data_visita.desc()))).scalars().all()
    return [
        {
            "id": v.id,
            "estado": v.estado,
            "data_visita": v.data_visita,
            "estabelecimento_id": v.estabelecimento_id,
            "analista_id": v.analista_id,
            "score_geral": getattr(v, "score_geral", None),
        }
        for v in rows
    ]


@router.get("/estabelecimentos", summary="Lista estabelecimentos do cliente")
async def list_estabelecimentos(
    key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Returns establishments scoped to the API key's client."""
    rows = (
        await db.execute(
            select(Estabelecimento)
            .where(Estabelecimento.cliente_id == key.cliente_id)
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": e.id,
            "nome": e.nome,
            "morada": getattr(e, "morada", None),
            "cidade": getattr(e, "cidade", None),
            "activo": e.activo,
        }
        for e in rows
    ]


@router.get("/estudos", summary="Lista estudos do cliente")
async def list_estudos(
    key: ApiKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Returns studies scoped to the API key's client."""
    rows = (
        await db.execute(
            select(Estudo)
            .where(Estudo.cliente_id == key.cliente_id)
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": e.id,
            "nome": e.nome,
            "estado": getattr(e, "estado", None),
            "criado_em": getattr(e, "criado_em", None),
        }
        for e in rows
    ]
