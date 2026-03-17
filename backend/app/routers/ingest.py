import io

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_role
from app.models.user import Utilizador
from app.schemas import IngestPreview
from app.ingest.csv_parser import parse_csv_and_preview, confirm_ingest

router = APIRouter()


@router.post("/csv/preview", response_model=IngestPreview)
async def preview_csv(
    estudo_id: int,
    file: UploadFile = File(...),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Ficheiro deve ser .csv")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="Ficheiro demasiado grande (max 50MB)")
    return await parse_csv_and_preview(content, estudo_id, db)


@router.post("/csv/confirm")
async def confirm_csv(
    estudo_id: int,
    file: UploadFile = File(...),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Ficheiro deve ser .csv")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ficheiro demasiado grande (max 50MB)")
    result = await confirm_ingest(content, estudo_id, db)
    return {"detail": f"Importadas {result} visitas"}
