"""Fotos de visita — upload, lista, URL presigned e remoção."""
import os
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.photo import FotoVisita
from app.models.study import Estudo
from app.models.user import Utilizador
from app.models.visit import Visita
from app.services import storage
from app.edition import require_pro
from app.services.antivirus import scan_bytes

router = APIRouter()

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_BYTES = 20 * 1024 * 1024  # 20 MB
BUCKET = "fotos-visita"


def _safe_filename(name: str) -> str:
    """Sanitize filename to prevent path traversal in MinIO object names."""
    basename = os.path.basename(name.replace("\\", "/"))
    return re.sub(r'[^\w.\-]', '_', basename)[:200] or "file"


# ── Schemas ───────────────────────────────────────────────────────────────────

class FotoOut(BaseModel):
    id: int
    visita_id: int
    nome_ficheiro: str
    tamanho: Optional[int]
    mime_type: Optional[str]
    url: str  # presigned 1-hour URL
    ia_veredicto: Optional[str] = None
    ia_resultado: Optional[str] = None  # JSON string
    ia_critica_em: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_mime(content: bytes) -> Optional[str]:
    """Detect image MIME type from magic bytes."""
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[8:12] == b"WEBP":  # RIFF container with WEBP marker at offset 8
        return "image/webp"
    # HEIC/HEIF — ftyp box
    if len(content) > 12 and content[4:8] == b"ftyp":
        return "image/heic"
    return None


async def _get_visita_or_404(visita_id: int, user: Utilizador, db: AsyncSession) -> Visita:
    tid = tenant_filter(user)
    q = select(Visita).where(Visita.id == visita_id)
    if tid is not None:
        q = (
            q.join(Estudo, Visita.estudo_id == Estudo.id)
            .join(Cliente, Estudo.cliente_id == Cliente.id)
            .where(Cliente.tenant_id == tid)
        )
    v = (await db.execute(q)).scalar_one_or_none()
    if v is None:
        raise HTTPException(status_code=404, detail="Visita não encontrada")
    return v


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{visita_id}/fotos", response_model=FotoOut, status_code=201)
async def upload_foto(
    visita_id: int,
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_visita_or_404(visita_id, user, db)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Ficheiro vazio")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ficheiro demasiado grande (máx 20 MB)")

    detected_mime = _detect_mime(content)
    if detected_mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Formato não suportado. Use JPEG, PNG, WebP ou HEIC.",
        )

    # Antivirus scan
    is_clean, threat = scan_bytes(content)
    if not is_clean:
        raise HTTPException(
            status_code=422,
            detail=f"Ficheiro rejeitado pelo antivirus: {threat}",
        )

    object_name = f"{visita_id}/{uuid.uuid4()}/{_safe_filename(file.filename or 'foto')}"
    try:
        storage.upload_bytes(BUCKET, object_name, content, detected_mime)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao guardar foto: {exc}")

    foto = FotoVisita(
        visita_id=visita_id,
        url_minio=object_name,
        nome_ficheiro=file.filename or "foto",
        tamanho=len(content),
        mime_type=detected_mime,
        latitude_exif=latitude,
        longitude_exif=longitude,
    )
    db.add(foto)
    await db.commit()
    await db.refresh(foto)

    url = storage.presigned_get_url(BUCKET, object_name, expires_seconds=3600)
    return FotoOut(
        id=foto.id,
        visita_id=foto.visita_id,
        nome_ficheiro=foto.nome_ficheiro,
        tamanho=foto.tamanho,
        mime_type=foto.mime_type,
        url=url,
        ia_veredicto=foto.ia_veredicto,
        ia_resultado=foto.ia_resultado,
        ia_critica_em=foto.ia_critica_em.isoformat() if foto.ia_critica_em else None,
    )


@router.get("/{visita_id}/fotos", response_model=list[FotoOut])
async def list_fotos(
    visita_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_visita_or_404(visita_id, user, db)

    result = await db.execute(
        select(FotoVisita).where(FotoVisita.visita_id == visita_id).order_by(FotoVisita.id)
    )
    fotos = result.scalars().all()

    out = []
    for f in fotos:
        url = storage.presigned_get_url(BUCKET, f.url_minio, expires_seconds=3600)
        out.append(
            FotoOut(
                id=f.id,
                visita_id=f.visita_id,
                nome_ficheiro=f.nome_ficheiro,
                tamanho=f.tamanho,
                mime_type=f.mime_type,
                url=url,
                ia_veredicto=f.ia_veredicto,
                ia_resultado=f.ia_resultado,
                ia_critica_em=f.ia_critica_em.isoformat() if f.ia_critica_em else None,
            )
        )
    return out


@router.delete("/{visita_id}/fotos/{foto_id}", status_code=204)
async def delete_foto(
    visita_id: int,
    foto_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FotoVisita).where(
            FotoVisita.id == foto_id, FotoVisita.visita_id == visita_id
        )
    )
    foto = result.scalar_one_or_none()
    if foto is None:
        raise HTTPException(status_code=404, detail="Foto não encontrada")

    # Only admin/coordenador or the uploader can delete
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(status_code=403, detail="Permissão insuficiente")

    storage.delete_object(BUCKET, foto.url_minio)
    await db.delete(foto)
    await db.commit()


@router.post("/{visita_id}/fotos/{foto_id}/analisar")
async def analisar_foto(
    visita_id: int,
    foto_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador", "validador")),
    db: AsyncSession = Depends(get_db),
):
    """Cognira Module 3 — Analyse a visit photo with GPT-4o Vision.
    Returns the AI analysis result and persists veredicto on the foto record."""
    require_pro("ai_photo_analysis")
    from app.ai.intelligence import analisar_foto_ia

    await _get_visita_or_404(visita_id, user, db)

    # Verify foto exists and belongs to this visita
    foto_result = await db.execute(
        select(FotoVisita).where(FotoVisita.id == foto_id, FotoVisita.visita_id == visita_id)
    )
    if foto_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Foto não encontrada nesta visita")

    # Get context (establishment name) for better LLM analysis
    from sqlalchemy import text as _t
    ctx_row = (
        await db.execute(
            _t("""
                SELECT est.nome AS estabelecimento, e.nome AS estudo
                FROM visitas v
                JOIN estabelecimentos est ON est.id = v.estabelecimento_id
                JOIN estudos e ON e.id = v.estudo_id
                WHERE v.id = :vid
            """),
            {"vid": visita_id},
        )
    ).mappings().first()
    contexto = None
    if ctx_row:
        contexto = f"Estabelecimento: {ctx_row['estabelecimento']}, Estudo: {ctx_row['estudo']}"

    resultado = await analisar_foto_ia(foto_id=foto_id, db=db, contexto=contexto)
    return resultado

