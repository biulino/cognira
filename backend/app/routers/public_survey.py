"""8A.4 — Public QR survey: no-auth form fill + QR code generation."""

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.questionnaire import Questionario, SubmissaoQuestionario
from app.models.study import Estudo
from app.models.user import Utilizador

settings = get_settings()

router = APIRouter()

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _sign_estudo(estudo_id: int) -> str:
    """Generate a deterministic HMAC token for a study's public survey URL."""
    secret = settings.jwt_secret.encode()
    msg = f"survey:{estudo_id}".encode()
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()[:32]


def _verify_token(estudo_id: int, token: str) -> bool:
    expected = _sign_estudo(estudo_id)
    return hmac.compare_digest(expected, token)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/token/{estudo_id}")
async def get_survey_token(
    estudo_id: int,
    _user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the signed token for a study's public survey (authenticated staff only)."""
    estudo = (await db.execute(select(Estudo).where(Estudo.id == estudo_id))).scalar_one_or_none()
    if not estudo:
        raise HTTPException(status_code=404, detail="Estudo não encontrado")
    token = _sign_estudo(estudo_id)
    return {"estudo_id": estudo_id, "token": token}


class PublicSurveyField(BaseModel):
    id: int
    label: str
    tipo: str
    obrigatorio: bool = False
    opcoes: Optional[list] = None


class PublicSurveyOut(BaseModel):
    questionario_id: int
    nome: str
    estudo_nome: str
    campos: list[PublicSurveyField]


@router.get("/{estudo_id}/{token}")
async def get_public_survey(
    estudo_id: int,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Return the active questionnaire for a study (public — no auth required)."""
    if not _verify_token(estudo_id, token):
        raise HTTPException(status_code=403, detail="Token inválido")

    estudo = (await db.execute(select(Estudo).where(Estudo.id == estudo_id))).scalar_one_or_none()
    if not estudo:
        raise HTTPException(status_code=404, detail="Estudo não encontrado")

    q = (await db.execute(
        select(Questionario)
        .where(Questionario.estudo_id == estudo_id, Questionario.activo.is_(True))
        .order_by(Questionario.id.desc())
    )).scalar_one_or_none()

    if not q:
        raise HTTPException(status_code=404, detail="Sem questionário activo para este estudo")

    estrutura = q.json_estrutura or {}
    campos_raw = estrutura.get("campos", [])

    campos = [
        PublicSurveyField(
            id=c.get("id", i),
            label=c.get("label", f"Campo {i+1}"),
            tipo=c.get("tipo", "texto"),
            obrigatorio=c.get("obrigatorio", False),
            opcoes=c.get("opcoes"),
        )
        for i, c in enumerate(campos_raw)
    ]

    return PublicSurveyOut(
        questionario_id=q.id,
        nome=q.nome,
        estudo_nome=estudo.nome,
        campos=campos,
    )


class PublicSubmissaoCreate(BaseModel):
    respostas: dict


@router.post("/{estudo_id}/{token}")
async def submit_public_survey(
    estudo_id: int,
    token: str,
    body: PublicSubmissaoCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Accept a public survey submission (no auth — rate-limited via nginx)."""
    if not _verify_token(estudo_id, token):
        raise HTTPException(status_code=403, detail="Token inválido")

    q = (await db.execute(
        select(Questionario)
        .where(Questionario.estudo_id == estudo_id, Questionario.activo.is_(True))
        .order_by(Questionario.id.desc())
    )).scalar_one_or_none()

    if not q:
        raise HTTPException(status_code=404, detail="Sem questionário activo")

    # Public submissions don't belong to a specific visit — we use visita_id=0 as sentinel.
    # In production you'd create a "public" visita or separate table; this keeps it simple.
    sub = SubmissaoQuestionario(
        questionario_id=q.id,
        visita_id=0,  # sentinel for public/QR submissions
        json_respostas={
            **body.respostas,
            "_source": "qr_public",
            "_ip": request.client.host if request.client else "unknown",
            "_at": datetime.now(timezone.utc).isoformat(),
        },
        submetido_em=datetime.now(timezone.utc),
    )
    db.add(sub)
    await db.commit()
    return {"ok": True, "submissao_id": sub.id}
