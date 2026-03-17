import csv
import io
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study import Estudo
from app.models.visit import Visita, CampoVisita, CaracterizacaoCache
from app.models.establishment import Estabelecimento
from app.models.study import Onda
from app.schemas import IngestPreview


async def parse_csv_and_preview(
    content: bytes, estudo_id: int, db: AsyncSession
) -> IngestPreview:
    """Parse CSV and return preview stats without committing."""
    result = await db.execute(select(Estudo).where(Estudo.id == estudo_id))
    estudo = result.scalar_one_or_none()
    if not estudo:
        return IngestPreview(linhas_novas=0, linhas_actualizadas=0, erros=["Estudo não encontrado"])

    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")

    linhas_novas = 0
    erros: list[str] = []

    for i, row in enumerate(reader, start=2):
        try:
            # Basic validation
            if not row.get("Estabelecimento"):
                erros.append(f"Linha {i}: Estabelecimento em falta")
                continue
            linhas_novas += 1
        except Exception as e:
            erros.append(f"Linha {i}: {str(e)}")

    return IngestPreview(linhas_novas=linhas_novas, linhas_actualizadas=0, erros=erros[:50])


async def confirm_ingest(content: bytes, estudo_id: int, db: AsyncSession) -> int:
    """Parse CSV and insert/update visits."""
    result = await db.execute(select(Estudo).where(Estudo.id == estudo_id))
    estudo = result.scalar_one_or_none()
    if not estudo:
        raise ValueError("Estudo não encontrado")

    tipo_car = estudo.tipo_caracterizacao or {}
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    count = 0

    for row in reader:
        estab_nome = row.get("Estabelecimento", "").strip()
        if not estab_nome:
            continue

        # Find or create establishment
        res = await db.execute(
            select(Estabelecimento).where(
                Estabelecimento.nome == estab_nome,
                Estabelecimento.cliente_id == estudo.cliente_id,
            )
        )
        estab = res.scalar_one_or_none()
        if not estab:
            estab = Estabelecimento(
                cliente_id=estudo.cliente_id,
                nome=estab_nome,
                tipo_canal=row.get("Tipo Canal", row.get("Tipo_Canal")),
                regiao=row.get("Região", row.get("Regiao")),
            )
            db.add(estab)
            await db.flush()

        # Find or create wave
        onda_label = row.get("Onda", row.get("Wave", "")).strip()
        onda_id = None
        if onda_label:
            res = await db.execute(
                select(Onda).where(Onda.estudo_id == estudo_id, Onda.label == onda_label)
            )
            onda = res.scalar_one_or_none()
            if not onda:
                onda = Onda(estudo_id=estudo_id, label=onda_label)
                db.add(onda)
                await db.flush()
            onda_id = onda.id

        # Create visit
        visita = Visita(
            estudo_id=estudo_id,
            estabelecimento_id=estab.id,
            onda_id=onda_id,
            estado=row.get("Estado", "inserida").lower().strip(),
            tipo_visita=row.get("Tipo Visita", "normal").lower().strip(),
        )

        # Score
        pontuacao_raw = row.get("Pontuação", row.get("Score", "")).strip()
        if pontuacao_raw and pontuacao_raw not in ("-", "N/A", ""):
            try:
                pontuacao_raw = pontuacao_raw.replace("%", "").replace(",", ".")
                visita.pontuacao = float(pontuacao_raw)
                visita.pontuacao_estado = "calculada"
            except ValueError:
                visita.pontuacao_estado = "nao_avaliada"
        else:
            visita.pontuacao_estado = "nao_avaliada"

        db.add(visita)
        await db.flush()

        # Auto-assign grelha from tipo_visita
        if visita.tipo_visita and visita.tipo_visita not in ("normal", "extra"):
            from app.models.evaluation import Grelha
            grid = (await db.execute(
                select(Grelha).where(
                    Grelha.estudo_id == estudo_id,
                    Grelha.tipo_visita == visita.tipo_visita,
                )
            )).scalar_one_or_none()
            if grid:
                visita.grelha_id = grid.id
                await db.flush()

        # Insert dynamic campos_visita based on tipo_caracterizacao mapping
        for header, value in row.items():
            if header and value and header.strip():
                campo = CampoVisita(visita_id=visita.id, chave=header.strip(), valor=value.strip())
                db.add(campo)

        # Build caracterizacao_cache
        cache_data = {}
        for pos, campo_nome in (tipo_car or {}).items():
            cache_data[campo_nome] = row.get(campo_nome, "")
        cache = CaracterizacaoCache(visita_id=visita.id, dados=cache_data if cache_data else None)
        db.add(cache)

        count += 1

    return count
