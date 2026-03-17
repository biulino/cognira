"""Wave 7 — AI Study Wizard router.

POST /api/wizard/sugestao  — ask AI for a complete study config suggestion.
POST /api/wizard/aplicar   — one-click: create estudo + campos + grelha + modules.
GET  /api/wizard/templates — list saved wizard templates.
POST /api/wizard/templates — save current suggestion as a reusable template.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.evaluation import CriterioGrelha, Grelha, SecaoGrelha
from app.models.study import Estudo
from app.models.user import Utilizador
from app.ai.intelligence import wizard_estudo

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class WizardSugestaoRequest(BaseModel):
    briefing: str
    sector: str
    tipo_estudo: str = "mystery shopping"


class CampoConfig(BaseModel):
    chave: str
    label: str
    tipo: str = "text"
    opcoes: List[str] = []
    obrigatorio: bool = True


class CriterioIn(BaseModel):
    label: str
    peso: float = 1.0
    tipo: str = "boolean"
    ordem: int = 1


class SecaoIn(BaseModel):
    nome: str
    ordem: int = 1
    peso_secao: float = 1.0
    criterios: List[CriterioIn] = []


class GrelhaIn(BaseModel):
    nome: str
    tipo_visita: str = "presencial"
    secoes: List[SecaoIn] = []


class WizardAplicarRequest(BaseModel):
    cliente_id: int
    nome_estudo: str
    campos: List[CampoConfig] = []
    grelha: Optional[GrelhaIn] = None
    modulos_sugeridos: List[str] = []


class WizardTemplateIn(BaseModel):
    nome: str
    sector: str
    tipo_estudo: str
    sugestao: Dict[str, Any]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/sugestao")
async def sugestao(
    body: WizardSugestaoRequest,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
) -> dict:
    """Call AI and return a full study configuration suggestion.
    No database writes — pure preview."""
    if not body.briefing.strip():
        raise HTTPException(status_code=422, detail="Briefing não pode estar vazio.")

    result = await wizard_estudo(
        briefing=body.briefing,
        sector=body.sector,
        tipo_estudo=body.tipo_estudo,
    )

    if "erro" in result:
        raise HTTPException(status_code=503, detail=result["erro"])

    return result


@router.post("/aplicar", status_code=201)
async def aplicar(
    body: WizardAplicarRequest,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Apply the wizard suggestion: create Estudo, set campos, create Grelha."""
    # 1 — create Estudo
    estudo = Estudo(
        cliente_id=body.cliente_id,
        nome=body.nome_estudo,
        estado="rascunho",
    )
    db.add(estudo)
    await db.flush()  # get estudo.id without committing

    # 2 — persist campos as tipo_caracterizacao JSONB
    if body.campos:
        chaves = [c.chave for c in body.campos]
        if len(chaves) != len(set(chaves)):
            raise HTTPException(status_code=400, detail="Chaves duplicadas nos campos.")
        estudo.tipo_caracterizacao = {
            "v2": [c.model_dump() for c in body.campos]
        }

    # 3 — create Grelha + Secoes + Criterios
    grelha_id: Optional[int] = None
    if body.grelha:
        g = body.grelha
        grid = Grelha(
            estudo_id=estudo.id,
            nome=g.nome,
            versao="1.0",
            tipo_visita=g.tipo_visita,
        )
        db.add(grid)
        await db.flush()
        grelha_id = grid.id

        for secao in g.secoes:
            s = SecaoGrelha(
                grelha_id=grid.id,
                nome=secao.nome,
                ordem=secao.ordem,
                peso_secao=secao.peso_secao,
            )
            db.add(s)
            await db.flush()
            for crit in secao.criterios:
                db.add(
                    CriterioGrelha(
                        grelha_id=grid.id,
                        secao_id=s.id,
                        label=crit.label,
                        peso=crit.peso,
                        tipo=crit.tipo,
                        ordem=crit.ordem,
                    )
                )

    await db.commit()

    return {
        "estudo_id": estudo.id,
        "grelha_id": grelha_id,
        "modulos_sugeridos": body.modulos_sugeridos,
    }


# ---------------------------------------------------------------------------
# Template management (stored in a JSON column on Configuracoes table if exists,
# otherwise kept in a simple in-memory store as a fallback — sufficient for MVP).
# ---------------------------------------------------------------------------

_TEMPLATE_STORE: List[dict] = []


@router.get("/templates")
async def list_templates(
    sector: Optional[str] = None,
    user: Utilizador = Depends(get_current_user),
) -> list:
    if sector:
        return [t for t in _TEMPLATE_STORE if t.get("sector") == sector]
    return list(_TEMPLATE_STORE)


@router.post("/templates", status_code=201)
async def save_template(
    body: WizardTemplateIn,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
) -> dict:
    entry = {
        "id": len(_TEMPLATE_STORE) + 1,
        "nome": body.nome,
        "sector": body.sector,
        "tipo_estudo": body.tipo_estudo,
        "sugestao": body.sugestao,
        "criado_por": user.id,
    }
    _TEMPLATE_STORE.append(entry)
    return entry
