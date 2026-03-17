"""Planogram compliance — Wave 8.4.

Manages reference planogram images per study and AI-driven compliance comparison
between planogram and actual shelf photos from visits.
"""
from __future__ import annotations

import base64
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.photo import FotoVisita
from app.models.planogram import Planogram, PlanogramComparacao
from app.models.study import Estudo
from app.models.user import Utilizador
from app.models.visit import Visita
from app.services import storage
from app.services.antivirus import scan_bytes
from app.config import get_settings

settings = get_settings()
router = APIRouter()

BUCKET = "planogramas"
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB


def _safe_filename(name: str) -> str:
    basename = os.path.basename(name.replace("\\", "/"))
    return re.sub(r"[^\w.\-]", "_", basename)[:200] or "file"


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanogramOut(BaseModel):
    id: int
    estudo_id: int
    nome: str
    descricao: Optional[str]
    categoria: Optional[str]
    imagem_url: Optional[str]
    criado_em: datetime

    model_config = {"from_attributes": True}


class ComparacaoOut(BaseModel):
    id: int
    planogram_id: int
    visita_id: int
    foto_id: Optional[int]
    score_compliance: Optional[float]
    ia_analise: Optional[str]
    ia_items_corretos: Optional[list]
    ia_items_errados: Optional[list]
    ia_items_faltando: Optional[list]
    ia_recomendacoes: Optional[str]
    analisado_em: Optional[datetime]
    criado_em: datetime

    model_config = {"from_attributes": True}


# ── CRUD planograms ───────────────────────────────────────────────────────────

@router.get("/", response_model=list[PlanogramOut])
async def list_planogramas(
    estudo_id: int = Query(...),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tid = tenant_filter(user)
    if tid is not None:
        estudo = (
            await db.execute(
                select(Estudo)
                .join(Cliente, Cliente.id == Estudo.cliente_id)
                .where(Estudo.id == estudo_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if not estudo:
            raise HTTPException(status_code=404, detail="Estudo não encontrado.")
    rows = (
        await db.execute(
            select(Planogram)
            .where(Planogram.estudo_id == estudo_id)
            .order_by(Planogram.criado_em.desc())
        )
    ).scalars().all()

    result = []
    for p in rows:
        url = None
        if p.imagem_minio_key:
            try:
                url = storage.presigned_get_url(BUCKET, p.imagem_minio_key, expires_seconds=3600)
            except Exception:
                url = p.imagem_url
        else:
            url = p.imagem_url
        po = PlanogramOut(
            id=p.id,
            estudo_id=p.estudo_id,
            nome=p.nome,
            descricao=p.descricao,
            categoria=p.categoria,
            imagem_url=url,
            criado_em=p.criado_em,
        )
        result.append(po)
    return result


@router.post("/", response_model=PlanogramOut, status_code=status.HTTP_201_CREATED)
async def create_planograma(
    estudo_id: int = Form(...),
    nome: str = Form(...),
    descricao: Optional[str] = Form(None),
    categoria: Optional[str] = Form(None),
    imagem: Optional[UploadFile] = File(None),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    # Verify study exists and belongs to tenant
    estudo_stmt = select(Estudo).where(Estudo.id == estudo_id)
    tid = tenant_filter(user)
    if tid is not None:
        estudo_stmt = (
            estudo_stmt
            .join(Cliente, Cliente.id == Estudo.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    estudo = (await db.execute(estudo_stmt)).scalar_one_or_none()
    if not estudo:
        raise HTTPException(status_code=404, detail="Estudo não encontrado.")

    minio_key = None
    url = None

    if imagem:
        if imagem.content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use JPEG, PNG ou WebP.")
        data = await imagem.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=400, detail="Imagem demasiado grande (máx 20 MB).")

        is_clean, threat = scan_bytes(data)  # ClamAV scan
        if not is_clean:
            raise HTTPException(status_code=400, detail=f"Ficheiro rejeitado (antivírus): {threat}")

        safe_name = _safe_filename(imagem.filename or "planogram.jpg")
        minio_key = f"estudo_{estudo_id}/{uuid.uuid4().hex}_{safe_name}"
        storage.upload_bytes(BUCKET, minio_key, data, imagem.content_type)
        url = storage.presigned_get_url(BUCKET, minio_key, expires_seconds=3600)

    p = Planogram(
        estudo_id=estudo_id,
        criado_por=user.id,
        nome=nome.strip(),
        descricao=descricao,
        categoria=categoria,
        imagem_minio_key=minio_key,
        imagem_url=url,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return PlanogramOut(
        id=p.id, estudo_id=p.estudo_id, nome=p.nome, descricao=p.descricao,
        categoria=p.categoria, imagem_url=url, criado_em=p.criado_em,
    )


@router.get("/{planogram_id}", response_model=PlanogramOut)
async def get_planograma(
    planogram_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_planogram_or_404(db, planogram_id, user)
    url = None
    if p.imagem_minio_key:
        try:
            url = storage.presigned_get_url(BUCKET, p.imagem_minio_key, expires_seconds=3600)
        except Exception:
            url = p.imagem_url
    else:
        url = p.imagem_url
    return PlanogramOut(
        id=p.id, estudo_id=p.estudo_id, nome=p.nome, descricao=p.descricao,
        categoria=p.categoria, imagem_url=url, criado_em=p.criado_em,
    )


@router.delete("/{planogram_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_planograma(
    planogram_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_planogram_or_404(db, planogram_id, user)
    if p.imagem_minio_key:
        storage.delete_object(BUCKET, p.imagem_minio_key)
    await db.delete(p)
    await db.commit()


# ── AI comparison ─────────────────────────────────────────────────────────────

class ComparacaoIn(BaseModel):
    visita_id: int
    foto_id: int


@router.post("/{planogram_id}/comparar", response_model=ComparacaoOut)
async def comparar_planograma(
    planogram_id: int,
    body: ComparacaoIn,
    user: Utilizador = Depends(require_role("admin", "coordenador", "validador")),
    db: AsyncSession = Depends(get_db),
):
    """Compare reference planogram against a visit photo using GPT-4o Vision."""
    p = await _get_planogram_or_404(db, planogram_id, user)
    if not p.imagem_minio_key:
        raise HTTPException(status_code=400, detail="Planograma sem imagem de referência.")

    foto = await db.get(FotoVisita, body.foto_id)
    if not foto or foto.visita_id != body.visita_id:
        raise HTTPException(status_code=404, detail="Foto não encontrada nesta visita.")
    if not foto.url_minio:
        raise HTTPException(status_code=400, detail="Foto sem ficheiro associado.")

    # Download both images
    try:
        ref_bytes = storage.download_bytes(BUCKET, p.imagem_minio_key)
        foto_bytes = storage.download_bytes("fotos-visita", foto.url_minio)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar imagens: {exc}")

    # Encode as base64 for Vision API
    ref_b64 = base64.b64encode(ref_bytes).decode()
    foto_b64 = base64.b64encode(foto_bytes).decode()
    ref_mime = "image/jpeg"
    foto_mime = getattr(foto, "mime_type", "image/jpeg") or "image/jpeg"

    # Call GPT-4o Vision
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1500,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a retail shelf compliance expert. "
                        "You will receive two images: the first is the REFERENCE PLANOGRAM (ideal shelf layout), "
                        "the second is the ACTUAL SHELF PHOTO from a store visit. "
                        "Compare them and return a JSON object with these exact keys: "
                        '"score" (integer 0-100, compliance percentage), '
                        '"analise" (string, 2-3 sentence narrative in Portuguese), '
                        '"items_corretos" (array of strings, correctly placed items/aspects), '
                        '"items_errados" (array of strings, incorrectly placed items), '
                        '"items_faltando" (array of strings, missing items from planogram), '
                        '"recomendacoes" (string, 1-2 action items in Portuguese). '
                        "Return ONLY valid JSON, no markdown."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analisa a conformidade desta prateleira com o planograma de referência."},
                        {"type": "image_url", "image_url": {"url": f"data:{ref_mime};base64,{ref_b64}", "detail": "high"}},
                        {"type": "image_url", "image_url": {"url": f"data:{foto_mime};base64,{foto_b64}", "detail": "high"}},
                    ],
                },
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro na análise IA: {exc}")

    raw = response.choices[0].message.content or "{}"
    try:
        # Strip markdown code fences if model wrapped in them
        raw_clean = re.sub(r"```(?:json)?|```", "", raw).strip()
        parsed = json.loads(raw_clean)
    except json.JSONDecodeError:
        parsed = {}

    score = float(parsed.get("score", 0))
    analise = parsed.get("analise", "")
    corretos = parsed.get("items_corretos", [])
    errados = parsed.get("items_errados", [])
    faltando = parsed.get("items_faltando", [])
    recomendacoes = parsed.get("recomendacoes", "")

    # Upsert — check if comparison already exists for this planogram+visita+foto
    existing = (
        await db.execute(
            select(PlanogramComparacao).where(
                PlanogramComparacao.planogram_id == planogram_id,
                PlanogramComparacao.visita_id == body.visita_id,
                PlanogramComparacao.foto_id == body.foto_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        comp = existing
    else:
        comp = PlanogramComparacao(planogram_id=planogram_id, visita_id=body.visita_id, foto_id=body.foto_id)
        db.add(comp)

    comp.score_compliance = score
    comp.ia_analise = analise
    comp.ia_items_corretos = corretos
    comp.ia_items_errados = errados
    comp.ia_items_faltando = faltando
    comp.ia_recomendacoes = recomendacoes
    comp.analisado_em = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(comp)
    return comp


# ── List comparisons for a visit ──────────────────────────────────────────────

@router.get("/visita/{visita_id}", response_model=list[ComparacaoOut])
async def comparacoes_por_visita(
    visita_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PlanogramComparacao)
            .where(PlanogramComparacao.visita_id == visita_id)
            .order_by(PlanogramComparacao.criado_em.desc())
        )
    ).scalars().all()
    return list(rows)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_planogram_or_404(
    db: AsyncSession,
    planogram_id: int,
    user: Utilizador,
) -> Planogram:
    stmt = select(Planogram).where(Planogram.id == planogram_id)
    tid = tenant_filter(user)
    if tid is not None:
        stmt = (
            stmt
            .join(Estudo, Estudo.id == Planogram.estudo_id)
            .join(Cliente, Cliente.id == Estudo.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    p = (await db.execute(stmt)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Planograma não encontrado.")
    return p
