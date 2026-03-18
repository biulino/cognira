"""
/api/rag — RAG (Retrieval-Augmented Generation) endpoints.

POST /api/rag/ingest          — ingest a text chunk + generate embedding (admin/coordenador)
POST /api/rag/search          — semantic search (top-k by cosine similarity)
GET  /api/rag/documentos      — list ingested chunks for a study
DELETE /api/rag/documentos/{id} — delete a chunk (admin/coordenador)
"""
import os
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.edition import require_pro
from app.models.user import Utilizador

router = APIRouter()

# ---------------------------------------------------------------------------
# Helper — OpenAI embedding
# ---------------------------------------------------------------------------

_openai_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
        _openai_client = AsyncOpenAI(api_key=api_key)
    return _openai_client


async def _embed(texts: list[str], db: AsyncSession | None = None) -> list[list[float]]:
    """Return embeddings for a list of texts.

    Uses the provider routing config when db is supplied;
    falls back to the module-level singleton otherwise.
    """
    if db is not None:
        from app.ai.provider_factory import get_client_for_task
        client, model_override = await get_client_for_task("embeddings", db)
        if client is None:
            raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
        model = model_override or "text-embedding-3-small"
    else:
        client = _get_openai_client()
        model = "text-embedding-3-small"

    response = await client.embeddings.create(model=model, input=texts)
    return [item.embedding for item in response.data]


def _vec_to_pg(vec: list[float]) -> str:
    """Convert list[float] to postgres vector literal '[f1,f2,...]'."""
    return "[" + ",".join(str(x) for x in vec) + "]"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    estudo_id: int
    titulo: str
    conteudo: str


class SearchRequest(BaseModel):
    query: str
    estudo_id: Optional[int] = None
    top_k: int = 5


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/ingest", dependencies=[Depends(require_role("admin", "coordenador"))], status_code=201)
async def rag_ingest(
    body: IngestRequest,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest a text chunk: generate embedding via OpenAI and persist to DB."""
    require_pro("ai_agents")
    if not body.conteudo.strip():
        raise HTTPException(status_code=422, detail="conteudo cannot be empty")

    # Verify the study belongs to the user's tenant before ingesting
    tid = tenant_filter(user)
    if tid is not None:
        from app.models.study import Estudo
        from app.models.client import Cliente
        from sqlalchemy import select as _sel
        check = (
            await db.execute(
                _sel(Estudo.id)
                .join(Cliente, Estudo.cliente_id == Cliente.id)
                .where(Estudo.id == body.estudo_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if check is None:
            raise HTTPException(status_code=404, detail="Estudo não encontrado")

    [embedding] = await _embed([body.conteudo], db)
    pg_vec = _vec_to_pg(embedding)

    await db.execute(
        text(
            "INSERT INTO briefing_embeddings (estudo_id, titulo, conteudo, embedding, criado_em) "
            "VALUES (:estudo_id, :titulo, :conteudo, CAST(:embedding AS vector), :criado_em)"
        ),
        {
            "estudo_id": body.estudo_id,
            "titulo": body.titulo,
            "conteudo": body.conteudo,
            "embedding": pg_vec,
            "criado_em": datetime.now(timezone.utc),
        },
    )
    await db.commit()
    return {"status": "ok", "message": "Chunk ingested successfully"}


@router.post("/search")
async def rag_search(
    body: SearchRequest,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search: embed query and return top-k most similar chunks."""
    require_pro("ai_agents")
    if not body.query.strip():
        raise HTTPException(status_code=422, detail="query cannot be empty")

    top_k = min(max(1, body.top_k), 20)
    tid = tenant_filter(user)

    [query_vec] = await _embed([body.query], db)
    pg_vec = _vec_to_pg(query_vec)

    tenant_clause = "AND (:tenant_id IS NULL OR c.tenant_id = :tenant_id)" if True else ""
    estudo_clause = "AND be.estudo_id = :estudo_id" if body.estudo_id else ""
    params: dict = {"vec": pg_vec, "top_k": top_k, "tenant_id": tid}
    if body.estudo_id:
        params["estudo_id"] = body.estudo_id

    rows = (
        await db.execute(
            text(
                f"SELECT be.id, be.estudo_id, be.titulo, be.conteudo, be.criado_em, "
                f"1 - (be.embedding <=> CAST(:vec AS vector)) AS similarity "
                f"FROM briefing_embeddings be "
                f"JOIN estudos e ON e.id = be.estudo_id "
                f"JOIN clientes c ON c.id = e.cliente_id "
                f"WHERE 1=1 {estudo_clause} {tenant_clause} "
                f"ORDER BY be.embedding <=> CAST(:vec AS vector) "
                f"LIMIT :top_k"
            ),
            params,
        )
    ).fetchall()

    return [
        {
            "id": r.id,
            "estudo_id": r.estudo_id,
            "titulo": r.titulo,
            "conteudo": r.conteudo,
            "similarity": round(float(r.similarity), 4),
            "criado_em": r.criado_em.isoformat() if r.criado_em else None,
        }
        for r in rows
    ]


@router.get("/documentos")
async def rag_list(
    estudo_id: Optional[int] = None,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List ingested chunks (without embedding vectors)."""
    tid = tenant_filter(user)
    estudo_clause = "AND be.estudo_id = :estudo_id" if estudo_id else ""
    tenant_clause = "AND (:tenant_id IS NULL OR c.tenant_id = :tenant_id)"
    params: dict = {"tenant_id": tid}
    if estudo_id:
        params["estudo_id"] = estudo_id

    rows = (
        await db.execute(
            text(
                f"SELECT be.id, be.estudo_id, be.titulo, LENGTH(be.conteudo) AS chars, be.criado_em "
                f"FROM briefing_embeddings be "
                f"JOIN estudos e ON e.id = be.estudo_id "
                f"JOIN clientes c ON c.id = e.cliente_id "
                f"WHERE 1=1 {estudo_clause} {tenant_clause} "
                f"ORDER BY be.criado_em DESC LIMIT 200"
            ),
            params,
        )
    ).fetchall()

    return [
        {
            "id": r.id,
            "estudo_id": r.estudo_id,
            "titulo": r.titulo,
            "chars": r.chars,
            "criado_em": r.criado_em.isoformat() if r.criado_em else None,
        }
        for r in rows
    ]


@router.delete("/documentos/{doc_id}", dependencies=[Depends(require_role("admin", "coordenador"))], status_code=204)
async def rag_delete(
    doc_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an ingested chunk by ID (tenant-scoped)."""
    tid = tenant_filter(user)
    if tid is not None:
        result = await db.execute(
            text(
                "DELETE FROM briefing_embeddings be "
                "USING estudos e, clientes c "
                "WHERE be.id = :id AND be.estudo_id = e.id "
                "AND e.cliente_id = c.id AND c.tenant_id = :tenant_id "
                "RETURNING be.id"
            ),
            {"id": doc_id, "tenant_id": tid},
        )
    else:
        result = await db.execute(
            text("DELETE FROM briefing_embeddings WHERE id = :id RETURNING id"),
            {"id": doc_id},
        )
    await db.commit()
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Documento não encontrado")
