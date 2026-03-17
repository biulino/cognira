"""Cognira Intelligence — AI-powered analytics engine.

Modules:
  1. Relatório Narrativo por Onda   (gerar_relatorio_narrativo)
       Generates a professional narrative report for a study/wave using GPT-4.1.
       Gathers stats (completion rate, scores, top/bottom stores) then asks the LLM
       to produce a formal executive-style narrative.
       Returns: {relatorio, estudo_nome, onda_label, estatisticas, gerado_em}

  3. Análise de Fotos IA            (analisar_foto_ia)
       Sends a visit photo (downloaded from MinIO) to GPT-4o Vision for authenticity
       and quality checking.
       Returns: {veredicto: aprovada|rejeitada|inconclusiva, confianca, motivo}
       Persists veredicto on FotoVisita row when save_to_db=True.

  4. Anomaly Detection              (analisar_anomalias_analistas)
       Statistical outlier detection across analysts for a study window.
       Flags analysts whose average score deviates ≥2 std-devs from the population mean.
       Flags: alto (suspiciously high), baixo (consistent underperformer), normal.
       Returns: {anomalias: [...], populacao: {media, desvio_padrao, n_analistas}, periodo_dias}

  5. Insights Semanais / On-Demand  (gerar_insights)
       Compares last-30-days metrics vs previous 30 days and sends to GPT-4.1 for
       actionable insights.
       Returns JSON: {resumo, insights: [{tipo, titulo, detalhe}], proximas_acoes, gerado_em}

  6. Validation Assistant           (validar_visita_assistido)
       AI-assisted visit validation: feeds visit responses, score and messages to GPT-4.1
       and recommends aprovar / corrigir / rever.
       Returns: {recomendacao, confianca, motivos, mensagem_sugerida, alertas}

  7. Chat Sugestões Proativas       (gerar_sugestoes_chat)
       Given the last 6 conversation turns, generates 3 contextual follow-up questions
       grounded in the specific topics discussed.
       Returns: list[str] (3 questions, max 12 words each)

  8. Planeamento Automático         (planear_visitas_automatico)
       Given an onda, fetches unassigned establishments and available analysts, then uses
       GPT-4.1 to suggest an optimal workload-balanced assignment plan.
       Returns: {plano: [{analista_id, analista_nome, estabelecimentos, score_medio, visitas_mes}],
                 observacoes, total_visitas_planeadas, estudo_id, onda_id, gerado_em}

All functions are async (FastAPI/SQLAlchemy).  If OPENAI_API_KEY is not set,
every function returns immediately with {"erro": "Serviço de IA não configurado."}.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from app.services import pii

from openai import AsyncOpenAI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

settings = get_settings()
client: Optional[AsyncOpenAI] = (
    AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
)


async def _ai_client(task: str, db: AsyncSession) -> Optional[AsyncOpenAI]:
    """Return the best available client for the task via provider routing.

    Falls back to the module-level singleton if no routing is configured.
    """
    from app.ai.provider_factory import get_client_for_task
    routed, _ = await get_client_for_task(task, db)
    return routed or client

# ---------------------------------------------------------------------------
# Module 1 — Relatório Narrativo por Onda
# ---------------------------------------------------------------------------

RELATORIO_SYSTEM = """És um especialista em mystery shopping e auditorias de qualidade em Portugal.
Vais receber estatísticas estruturadas de um estudo/onda e deves produzir um relatório
narrativo profissional em português de Portugal.

O relatório deve incluir:
1. Resumo executivo (2–3 frases)
2. Principais indicadores (taxa de conclusão, pontuação média, distribuição por estado)
3. Análise por canal/tipo de visita (presencial, drive-through, telefónica, etc.) — SE existirem múltiplos canais, compara-os
4. Pontos positivos identificados
5. Áreas de melhoria / alertas
6. Recomendações accionáveis (pelo menos 3)

Usa linguagem formal, concisa e orientada para o negócio.
Não inventes dados — baseia-te APENAS nas estatísticas fornecidas.
Se o estudo tem apenas um tipo de visita, omite a secção comparativa de canais."""


async def gerar_relatorio_narrativo(
    estudo_id: int,
    onda_id: Optional[int],
    db: AsyncSession,
) -> dict:
    """Generates a narrative AI report for a study/wave and returns the text."""
    if not client:
        return {"erro": "Serviço de IA não configurado."}

    # --- Gather statistics --------------------------------------------------
    onda_filter = "AND v.onda_id = :onda_id" if onda_id else ""

    stats_sql = text(f"""
        SELECT
            COUNT(*) AS total_visitas,
            COUNT(*) FILTER (WHERE v.estado IN ('validada','fechada')) AS concluidas,
            COUNT(*) FILTER (WHERE v.estado = 'anulada') AS anuladas,
            COUNT(*) FILTER (WHERE v.estado IN ('nova','planeada')) AS pendentes,
            COUNT(*) FILTER (WHERE v.estado IN ('inserida','corrigir','corrigida')) AS em_revisao,
            ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 1) AS pontuacao_media,
            MIN(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada') AS pontuacao_min,
            MAX(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada') AS pontuacao_max,
            COUNT(DISTINCT v.estabelecimento_id) AS lojas_distintas,
            COUNT(DISTINCT v.analista_id) AS analistas_distintos
        FROM visitas v
        WHERE v.estudo_id = :estudo_id AND v.activo = true
        {onda_filter}
    """)

    params: dict = {"estudo_id": estudo_id}
    if onda_id:
        params["onda_id"] = onda_id

    stats_row = (await db.execute(stats_sql, params)).mappings().first()

    # Per tipo_visita breakdown
    tipo_sql = text(f"""
        SELECT
            v.tipo_visita,
            g.nome AS grelha_nome,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE v.estado IN ('validada','fechada')) AS concluidas,
            ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 1) AS media,
            ROUND(STDDEV(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 2) AS desvio
        FROM visitas v
        LEFT JOIN grelhas g ON g.id = v.grelha_id
        WHERE v.estudo_id = :estudo_id AND v.activo = true
        {onda_filter}
        GROUP BY v.tipo_visita, g.nome
        ORDER BY total DESC
    """)
    tipo_rows = (await db.execute(tipo_sql, params)).mappings().all()

    # Top/bottom stores by score
    lojas_sql = text(f"""
        SELECT e.nome AS loja, o.label AS onda,
               ROUND(AVG(v.pontuacao), 1) AS media,
               COUNT(*) AS visitas
        FROM visitas v
        JOIN estabelecimentos e ON e.id = v.estabelecimento_id
        LEFT JOIN ondas o ON o.id = v.onda_id
        WHERE v.estudo_id = :estudo_id AND v.activo = true
          AND v.pontuacao_estado = 'calculada'
          {onda_filter}
        GROUP BY e.nome, o.label
        ORDER BY media DESC
        LIMIT 10
    """)
    top_lojas = (await db.execute(lojas_sql, params)).mappings().all()

    bottom_sql = text(f"""
        SELECT e.nome AS loja,
               ROUND(AVG(v.pontuacao), 1) AS media,
               COUNT(*) AS visitas
        FROM visitas v
        JOIN estabelecimentos e ON e.id = v.estabelecimento_id
        WHERE v.estudo_id = :estudo_id AND v.activo = true
          AND v.pontuacao_estado = 'calculada'
          {onda_filter}
        GROUP BY e.nome
        ORDER BY media ASC
        LIMIT 5
    """)
    bottom_lojas = (await db.execute(bottom_sql, params)).mappings().all()

    # Onda label
    onda_label = "Estudo completo"
    if onda_id:
        r = await db.execute(
            text("SELECT label FROM ondas WHERE id = :id"), {"id": onda_id}
        )
        row = r.first()
        onda_label = row[0] if row else f"Onda {onda_id}"

    # Estudo nome
    r2 = await db.execute(
        text("SELECT nome FROM estudos WHERE id = :id"), {"id": estudo_id}
    )
    row2 = r2.first()
    estudo_nome = row2[0] if row2 else f"Estudo {estudo_id}"

    # --- Build prompt --------------------------------------------------------
    s = dict(stats_row) if stats_row else {}
    total = s.get("total_visitas", 0) or 0
    concluidas = s.get("concluidas", 0) or 0
    taxa = round((concluidas / total * 100), 1) if total else 0

    top_txt = "\n".join(
        f"  {i+1}. {r['loja']}: {r['media']}% ({r['visitas']} visitas)"
        for i, r in enumerate(top_lojas)
    )
    bottom_txt = "\n".join(
        f"  {i+1}. {r['loja']}: {r['media']}% ({r['visitas']} visitas)"
        for i, r in enumerate(bottom_lojas)
    )
    tipo_txt = "\n".join(
        f"  - {r['tipo_visita'] or 'sem tipo'} ({r['grelha_nome'] or 'sem grelha'}): "
        f"{r['total']} visitas, {r['concluidas']} concluídas, média={r['media'] or '-'}%, desvio={r['desvio'] or '-'}"
        for r in tipo_rows
    ) if tipo_rows else "  (sem dados por tipo de visita)"

    user_prompt = f"""Estudo: {estudo_nome}
Âmbito: {onda_label}
Data de geração: {datetime.now().strftime('%d/%m/%Y %H:%M')}

ESTATÍSTICAS GLOBAIS:
- Total de visitas: {total}
- Concluídas (validadas/fechadas): {concluidas} ({taxa}%)
- Anuladas: {s.get('anuladas', 0)}
- Pendentes (nova/planeada): {s.get('pendentes', 0)}
- Em revisão (inserida/corrigir): {s.get('em_revisao', 0)}
- Pontuação média: {s.get('pontuacao_media') or '-'}%
- Pontuação mínima: {s.get('pontuacao_min') or '-'}%
- Pontuação máxima: {s.get('pontuacao_max') or '-'}%
- Lojas avaliadas: {s.get('lojas_distintas', 0)}
- Analistas envolvidos: {s.get('analistas_distintos', 0)}

DISTRIBUIÇÃO POR TIPO DE VISITA / CANAL:
{tipo_txt}

TOP 10 LOJAS (maior pontuação):
{top_txt or '  (sem dados de pontuação disponíveis)'}

5 LOJAS COM MENOR PONTUAÇÃO:
{bottom_txt or '  (sem dados de pontuação disponíveis)'}

Por favor, redige o relatório narrativo profissional. Se existem múltiplos tipos de visita (canais), inclui uma análise comparativa entre canais."""

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": RELATORIO_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )
    relatorio = response.choices[0].message.content or ""
    return {
        "relatorio": relatorio,
        "estudo_nome": estudo_nome,
        "onda_label": onda_label,
        "estatisticas": s,
        "gerado_em": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Module 5 — Insights Semanais / On-Demand
# ---------------------------------------------------------------------------

INSIGHTS_SYSTEM = """És um analista de mystery shopping em Portugal.
Vais receber métricas recentes de um estudo e deves gerar insights concisos e accionáveis.

Formato obrigatório (responde APENAS com este JSON, sem markdown):
{
  "resumo": "1-2 frases de resumo executivo",
  "insights": [
    {"tipo": "alerta|positivo|neutro", "titulo": "...", "detalhe": "..."},
    ...
  ],
  "proximas_acoes": ["acção 1", "acção 2", "acção 3"]
}

Gera entre 3 e 6 insights. Usa português de Portugal. Sê directo e orientado para o negócio."""


async def gerar_insights(
    estudo_id: int,
    db: AsyncSession,
) -> dict:
    """Generates real-time data insights for a study."""
    if not client:
        return {"erro": "Serviço de IA não configurado."}

    now = datetime.now()
    cutoff_30 = now - timedelta(days=30)
    cutoff_7 = now - timedelta(days=7)
    cutoff_prev30 = now - timedelta(days=60)

    # Current 30-day window
    cur_sql = text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE estado IN ('validada','fechada')) AS concluidas,
            COUNT(*) FILTER (WHERE estado = 'anulada') AS anuladas,
            COUNT(*) FILTER (WHERE estado IN ('nova','planeada')) AS pendentes,
            ROUND(AVG(pontuacao) FILTER (WHERE pontuacao_estado='calculada'), 1) AS media_score,
            COUNT(*) FILTER (WHERE inserida_em >= :cutoff_7) AS inseridas_7d
        FROM visitas
        WHERE estudo_id = :estudo_id AND activo = true
          AND inserida_em >= :cutoff_30
    """)
    cur = (
        await db.execute(cur_sql, {"estudo_id": estudo_id, "cutoff_30": cutoff_30, "cutoff_7": cutoff_7})
    ).mappings().first()

    # Previous 30-day window (for comparison)
    prev_sql = text("""
        SELECT
            COUNT(*) AS total,
            ROUND(AVG(pontuacao) FILTER (WHERE pontuacao_estado='calculada'), 1) AS media_score
        FROM visitas
        WHERE estudo_id = :estudo_id AND activo = true
          AND inserida_em BETWEEN :cutoff_prev AND :cutoff_30
    """)
    prev = (
        await db.execute(prev_sql, {"estudo_id": estudo_id, "cutoff_prev": cutoff_prev30, "cutoff_30": cutoff_30})
    ).mappings().first()

    # Stores with most issues
    problem_sql = text("""
        SELECT e.nome AS loja, COUNT(*) AS anuladas
        FROM visitas v JOIN estabelecimentos e ON e.id = v.estabelecimento_id
        WHERE v.estudo_id = :estudo_id AND v.activo = true
          AND v.estado = 'anulada' AND v.inserida_em >= :cutoff_30
        GROUP BY e.nome ORDER BY anuladas DESC LIMIT 5
    """)
    problem_stores = (
        await db.execute(problem_sql, {"estudo_id": estudo_id, "cutoff_30": cutoff_30})
    ).mappings().all()

    # Analistas performance
    analista_sql = text("""
        SELECT a.nome,
               COUNT(*) AS visitas,
               COUNT(*) FILTER (WHERE v.estado = 'anulada') AS anuladas,
               ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado='calculada'), 1) AS media
        FROM visitas v
        JOIN analistas a ON a.id = v.analista_id
        WHERE v.estudo_id = :estudo_id AND v.activo = true
          AND v.inserida_em >= :cutoff_30
        GROUP BY a.nome
        ORDER BY visitas DESC LIMIT 8
    """)
    analistas = (
        await db.execute(analista_sql, {"estudo_id": estudo_id, "cutoff_30": cutoff_30})
    ).mappings().all()

    # Per tipo_visita breakdown (last 30 days)
    tipo_insight_sql = text("""
        SELECT v.tipo_visita,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE v.estado IN ('validada','fechada')) AS concluidas,
               COUNT(*) FILTER (WHERE v.estado = 'anulada') AS anuladas,
               ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado='calculada'), 1) AS media
        FROM visitas v
        WHERE v.estudo_id = :estudo_id AND v.activo = true
          AND v.inserida_em >= :cutoff_30
          AND v.tipo_visita IS NOT NULL
        GROUP BY v.tipo_visita ORDER BY total DESC
    """)
    tipo_insights = (
        await db.execute(tipo_insight_sql, {"estudo_id": estudo_id, "cutoff_30": cutoff_30})
    ).mappings().all()

    estudo_nome_r = await db.execute(
        text("SELECT nome FROM estudos WHERE id = :id"), {"id": estudo_id}
    )
    estudo_nome = (estudo_nome_r.first() or [f"Estudo {estudo_id}"])[0]

    c = dict(cur) if cur else {}
    p = dict(prev) if prev else {}

    total_c = c.get("total", 0) or 0
    total_p = p.get("total", 0) or 0
    media_c = c.get("media_score")
    media_p = p.get("media_score")
    score_trend = ""
    if media_c and media_p:
        diff = float(media_c) - float(media_p)
        score_trend = f"(variação vs período anterior: {'+' if diff >= 0 else ''}{diff:.1f}pp)"

    problem_txt = ", ".join(f"{r['loja']}({r['anuladas']} anuladas)" for r in problem_stores)
    analistas_txt = "\n".join(
        f"  {pii.decrypt(r['nome']) if isinstance(r['nome'], (bytes, bytearray)) else r['nome']}: {r['visitas']} visitas, {r['anuladas']} anuladas, média {r['media'] or '-'}%"
        for r in analistas
    )
    tipo_txt = "\n".join(
        f"  - {r['tipo_visita']}: {r['total']} visitas, {r['concluidas']} concluídas, {r['anuladas']} anuladas, média={r['media'] or '-'}%"
        for r in tipo_insights
    ) if tipo_insights else "  (sem dados por tipo de visita)"

    user_prompt = f"""Estudo: {estudo_nome}
Período: últimos 30 dias (até {now.strftime('%d/%m/%Y')})

MÉTRICAS GLOBAIS (últimos 30 dias):
- Total visitas: {total_c}
- Concluídas: {c.get('concluidas', 0)}
- Anuladas: {c.get('anuladas', 0)}
- Pendentes: {c.get('pendentes', 0)}
- Inseridas nos últimos 7 dias: {c.get('inseridas_7d', 0)}
- Pontuação média: {media_c or '-'}% {score_trend}

DISTRIBUIÇÃO POR TIPO DE VISITA (30d):
{tipo_txt}

PERÍODO ANTERIOR (31-60 dias atrás):
- Total visitas: {total_p}
- Pontuação média: {media_p or '-'}%

LOJAS COM MAIS ANULAÇÕES (30d):
{problem_txt or '(nenhuma)'}

PERFORMANCE DOS ANALISTAS (30d):
{analistas_txt or '(sem dados)'}

Gera os insights em JSON conforme o formato definido. Se existem múltiplos canais/tipos, inclui insights específicos por canal."""

    import json

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": INSIGHTS_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except Exception:
        data = {"resumo": raw, "insights": [], "proximas_acoes": []}

    data["gerado_em"] = now.isoformat()
    data["periodo"] = "Últimos 30 dias"
    data["estudo_nome"] = estudo_nome
    return data


# ---------------------------------------------------------------------------
# Module 7 — Chat: Suggested follow-up questions
# ---------------------------------------------------------------------------

SUGESTOES_SYSTEM = """És um assistente de mystery shopping. Dada a conversa abaixo,
SUGERE EXACTAMENTE 3 perguntas de seguimento em português de Portugal que o utilizador
pode querer fazer A SEGUIR sobre os dados de mystery shopping (visitas, analistas, estudos,
pagamentos, pontuações, estabelecimentos).
As perguntas devem ser MUITO específicas ao contexto da conversa fornecida — NUNCA genéricas.
Se a conversa é sobre visitas por estado, sugere perguntas sobre estados concretos.
Se é sobre pontuações, sugere aprofundamentos de pontuação.
Se é sobre analistas, sugere perguntas sobre esses analistas específicos.
As sugestões devem ser perguntas de seguimento naturais que façam sentido como próximo passo.
NUNCA sugiras perguntas sobre tópicos que não apareceram na conversa.
NUNCA uses linguagem genérica como "mais dados" ou "outra informação".
MÁX. 12 palavras cada pergunta.
Responde APENAS com JSON: {"sugestoes": ["pergunta 1", "pergunta 2", "pergunta 3"]}"""


async def gerar_sugestoes_chat(
    mensagem_user: str,
    resposta_ai: str,
    estudo_id: Optional[int],
    historico: list[dict] | None = None,
) -> list[str]:
    """Returns 3 suggested follow-up questions grounded in the full conversation thread."""
    if not client:
        return []

    contexto = f"Estudo ID: {estudo_id}" if estudo_id else "Sem estudo específico"

    # Build a short readable transcript of the last 6 turns for context
    transcript_parts = []
    if historico:
        for msg in historico[-6:]:
            role = msg.get("role", "")
            content = (msg.get("content") or "")[:300]
            if role == "user":
                transcript_parts.append(f"Utilizador: {content}")
            elif role == "assistant":
                transcript_parts.append(f"Assistente: {content}")
    transcript_parts.append(f"Utilizador: {mensagem_user}")
    transcript_parts.append(f"Assistente: {resposta_ai[:500]}")

    prompt = f"{contexto}\n\nConversa:\n" + "\n".join(transcript_parts)

    import json

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": SUGESTOES_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        return data.get("sugestoes", [])[:3]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Module 3 — Fotos IA (GPT-4o Vision)
# ---------------------------------------------------------------------------

async def analisar_foto_ia(foto_id: int, db: AsyncSession, contexto: str | None = None) -> dict:
    """Analyse a visit photo with GPT-4o Vision.

    Downloads the photo from MinIO, sends to GPT-4o Vision for analysis,
    and persists the veredicto on the FotoVisita record.
    Returns dict with veredicto, confianca, motivo.
    """
    from app.models.photo import FotoVisita
    from app.services import storage
    from sqlalchemy import select as _sel
    import base64 as _b64
    from datetime import datetime as _dt

    BUCKET = "fotos-visita"

    # Load foto record
    result = await db.execute(
        _sel(FotoVisita).where(FotoVisita.id == foto_id)
    )
    foto = result.scalar_one_or_none()
    if foto is None:
        return {"erro": True, "mensagem": "Foto não encontrada"}

    # Download image bytes from MinIO
    try:
        img_bytes = storage.download_bytes(BUCKET, foto.url_minio)
    except Exception as exc:
        return {"erro": True, "mensagem": f"Erro ao descarregar foto: {exc}"}

    mime = foto.mime_type or "image/jpeg"
    b64_img = _b64.b64encode(img_bytes).decode("utf-8")

    system_prompt = (
        "És um auditor visual de Mystery Shopping. Analisa a foto de uma visita a um estabelecimento. "
        "Avalia: 1) se a foto parece autêntica e tirada no local; 2) se mostra o interior/exterior de um estabelecimento comercial; "
        "3) qualidade da imagem (desfocada, escura, cortada). "
        "Responde SEMPRE em JSON com: {\"veredicto\": \"aprovada\"|\"rejeitada\"|\"inconclusiva\", \"confianca\": 0-100, \"motivo\": \"explicação curta\"}"
    )
    user_content: list[dict] = [
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_img}", "detail": "low"}},
    ]
    if contexto:
        user_content.insert(0, {"type": "text", "text": f"Contexto: {contexto}"})

    api_key = get_settings().openai_api_key
    if not api_key:
        return {"erro": True, "mensagem": "OPENAI_API_KEY não configurada"}

    try:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            max_tokens=300,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as exc:
        return {"erro": True, "mensagem": f"Erro OpenAI Vision: {exc}"}

    veredicto = data.get("veredicto", "inconclusiva")
    confianca = data.get("confianca", 0)
    motivo = data.get("motivo", "")

    # Persist on foto record
    foto.ia_veredicto = veredicto
    foto.ia_resultado = json.dumps(data, ensure_ascii=False)
    foto.ia_critica_em = _dt.utcnow()
    db.add(foto)
    await db.flush()

    return {
        "foto_id": foto_id,
        "veredicto": veredicto,
        "confianca": confianca,
        "motivo": motivo,
    }


# ---------------------------------------------------------------------------
# Module 4 — Anomaly Detection (analistas outliers)
# ---------------------------------------------------------------------------

async def analisar_anomalias_analistas(
    estudo_id: int,
    db: AsyncSession,
    dias: int = 90,
) -> dict:
    """Detects analista outliers (score significantly above or below the population mean).

    Returns a list of analistas flagged as 'alto' (suspicious), 'baixo' (underperformer),
    or 'normal', together with population stats.
    """
    import json as _json
    from math import sqrt

    cutoff = datetime.now() - timedelta(days=dias)

    sql = text("""
        SELECT
            a.id          AS analista_id,
            a.nome        AS nome_bytes,
            a.codigo_externo,
            COUNT(v.id)   AS total_visitas,
            COUNT(v.id) FILTER (WHERE v.estado = 'anulada')   AS anuladas,
            COUNT(v.id) FILTER (WHERE v.estado IN ('validada','fechada')) AS concluidas,
            ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 2) AS score_medio,
            STDDEV(v.pontuacao)  FILTER (WHERE v.pontuacao_estado = 'calculada') AS score_stddev
        FROM analistas a
        JOIN visitas v ON v.analista_id = a.id
        WHERE v.estudo_id = :estudo_id
          AND v.activo = true
          AND v.inserida_em >= :cutoff
        GROUP BY a.id, a.nome, a.codigo_externo
        HAVING COUNT(v.id) >= 3
        ORDER BY score_medio DESC NULLS LAST
    """)
    rows = (await db.execute(sql, {"estudo_id": estudo_id, "cutoff": cutoff})).mappings().all()

    if not rows:
        return {"anomalias": [], "populacao": {}, "periodo_dias": dias}

    # population stats
    scores = [float(r["score_medio"]) for r in rows if r["score_medio"] is not None]
    if not scores:
        return {"anomalias": [], "populacao": {}, "periodo_dias": dias}

    pop_mean = sum(scores) / len(scores)
    pop_var = sum((s - pop_mean) ** 2 for s in scores) / len(scores)
    pop_std = sqrt(pop_var) if pop_var > 0 else 0

    resultado = []
    for r in rows:
        nome_raw = r["nome_bytes"]
        try:
            nome = pii.decrypt(nome_raw) if isinstance(nome_raw, (bytes, bytearray)) else str(nome_raw)
        except Exception:
            nome = str(nome_raw)

        score = float(r["score_medio"]) if r["score_medio"] is not None else None
        if score is None:
            flag = "sem_dados"
            desvio_std = None
        else:
            desvio_std = round((score - pop_mean) / pop_std, 2) if pop_std > 0 else 0.0
            if desvio_std >= 2.0:
                flag = "alto"        # suspiciously high — potential fraud / easy stores
            elif desvio_std <= -2.0:
                flag = "baixo"       # consistent underperformer
            else:
                flag = "normal"

        resultado.append({
            "analista_id": r["analista_id"],
            "nome": nome,
            "codigo_externo": r["codigo_externo"],
            "total_visitas": r["total_visitas"],
            "concluidas": r["concluidas"],
            "anuladas": r["anuladas"],
            "score_medio": score,
            "desvio_std": desvio_std,
            "flag": flag,
        })

    return {
        "anomalias": resultado,
        "populacao": {
            "media": round(pop_mean, 2),
            "desvio_padrao": round(pop_std, 2),
            "n_analistas": len(scores),
        },
        "periodo_dias": dias,
        "gerado_em": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Module 6 — Validation Assistant
# ---------------------------------------------------------------------------

VALIDACAO_SYSTEM = """És um especialista em controle de qualidade de mystery shopping em Portugal.
Vais receber os dados de uma visita de mistério (respostas a critérios de avaliação, pontuação, observações).
A tua função é identificar possíveis inconsistências ou irregularidades e sugerir se a visita deve ser aprovada, enviada para correcção, ou sinalizada para revisão especial.

Responde APENAS com este JSON (sem markdown):
{
  "recomendacao": "aprovar" | "corrigir" | "rever",
  "confianca": 0.0-1.0,
  "motivos": ["motivo 1", "motivo 2"],
  "mensagem_sugerida": "texto curto para enviar ao analista (máx. 2 frases, em português de Portugal)",
  "alertas": ["alerta 1"]
}

"aprovar" → tudo consistente, pontuação justificada.
"corrigir" → há inconsistências menores, o analista deve rever.
"rever" → irregularidades graves, requer atenção do coordenador.

Baseia-te APENAS nos dados fornecidos. Nunca inventes informação."""


async def validar_visita_assistido(
    visita_id: int,
    db: AsyncSession,
    save_to_db: bool = False,
) -> dict:
    """AI-assisted validation of a visit. Analyses responses and flags inconsistencies.

    If save_to_db=True, persists ia_veredicto / ia_mensagem / ia_critica_em on the Visita row.
    """
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    # Fetch visita details
    visita_sql = text("""
        SELECT
            v.id, v.estado, v.pontuacao, v.pontuacao_estado,
            v.inserida_em, v.motivo_anulacao,
            a.nome AS analista_nome_bytes,
            e.nome AS estab_nome,
            est.nome AS estudo_nome
        FROM visitas v
        LEFT JOIN analistas a ON a.id = v.analista_id
        LEFT JOIN estabelecimentos e ON e.id = v.estabelecimento_id
        LEFT JOIN estudos est ON est.id = v.estudo_id
        WHERE v.id = :visita_id
    """)
    row = (await db.execute(visita_sql, {"visita_id": visita_id})).mappings().first()
    if not row:
        return {"erro": "Visita não encontrada."}

    # Decode analista name
    nome_raw = row["analista_nome_bytes"]
    try:
        analista_nome = pii.decrypt(nome_raw) if isinstance(nome_raw, (bytes, bytearray)) else str(nome_raw)
    except Exception:
        analista_nome = "—"

    # Fetch respostas (criterios)
    respostas_sql = text("""
        SELECT c.label AS criterio, c.peso, r.valor
        FROM respostas_visita r
        JOIN criterios_grelha c ON c.id = r.criterio_id
        WHERE r.visita_id = :visita_id
        ORDER BY c.id
    """)
    respostas = (await db.execute(respostas_sql, {"visita_id": visita_id})).mappings().all()

    # Fetch messages/observations
    msgs_sql = text("""
        SELECT conteudo, criado_em
        FROM mensagens_visita
        WHERE visita_id = :visita_id
        ORDER BY criado_em DESC
        LIMIT 5
    """)
    msgs = (await db.execute(msgs_sql, {"visita_id": visita_id})).mappings().all()

    # Build prompt
    respostas_txt = "\n".join(
        f"  [{i+1}] {r['criterio']} (peso {r['peso']}) → {r['valor']}"
        for i, r in enumerate(respostas)
    ) or "  (sem respostas registadas)"

    msgs_txt = "\n".join(f"  '{m['conteudo'][:200]}'" for m in msgs) or "  (sem mensagens)"

    user_prompt = f"""Visita #{visita_id}
Estudo: {row['estudo_nome']}
Estabelecimento: {row['estab_nome']}
Analista: {analista_nome}
Estado: {row['estado']}
Pontuação calculada: {row['pontuacao']}% ({row['pontuacao_estado']})
Inserida em: {row['inserida_em']}

RESPOSTAS AOS CRITÉRIOS:
{respostas_txt}

MENSAGENS RECENTES:
{msgs_txt}

Analisa esta visita e devolve o JSON de recomendação."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": VALIDACAO_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["visita_id"] = visita_id
    data["gerado_em"] = datetime.now().isoformat()

    # Persist result on the visit row if requested (called from state machine)
    if save_to_db and "recomendacao" in data:
        try:
            from sqlalchemy import update as _sa_update
            from app.models.visit import Visita as _Visita
            await db.execute(
                _sa_update(_Visita)
                .where(_Visita.id == visita_id)
                .values(
                    ia_veredicto=data.get("recomendacao"),
                    ia_mensagem=data.get("mensagem_sugerida"),
                    ia_critica_em=datetime.now(),
                )
            )
            await db.commit()
        except Exception:
            pass  # IA persistence must never break the flow

    return data


# ═══════════════════════════════════════════════════════════════════════════════
# Cognira Module 7 — Score Preditivo por Analista
# ═══════════════════════════════════════════════════════════════════════════════

async def score_preditivo_analista(analista_id: int, db: AsyncSession) -> dict:
    """
    Cognira Module 7 — Predictive quality score.
    Analyses the analista's last 30 visits (scores, estados, timing) and
    predicts their expected performance, trend, and suitability for future studies.
    Returns JSON with: score_previsto, intervalo, tendencia, confianca, fatores, recomendacao.
    """
    from sqlalchemy import text as _text

    rows = (await db.execute(_text("""
        SELECT
            v.id, v.pontuacao, v.estado,
            COALESCE(v.realizada_inicio, v.planeada_em) AS data_visita,
            e.nome AS estudo_nome
        FROM visitas v
        JOIN estudos e ON e.id = v.estudo_id
        WHERE v.analista_id = :aid
          AND v.pontuacao IS NOT NULL
          AND v.pontuacao_estado = 'calculada'
        ORDER BY COALESCE(v.realizada_inicio, v.planeada_em) DESC NULLS LAST
        LIMIT 30
    """), {"aid": analista_id})).fetchall()

    if not rows:
        return {
            "erro": "Sem visitas com pontuação suficiente para análise preditiva.",
            "analista_id": analista_id,
        }

    visitas_summary = "\n".join(
        f"- Visita {r.id} | Estudo: {r.estudo_nome} | Data: {r.data_visita} | Pontuação: {r.pontuacao}% | Estado: {r.estado}"
        for r in rows
    )

    system_prompt = (
        "És o Cognira Intelligence, especialista em mystery shopping e análise preditiva de desempenho de campo. "
        "Analisa o histórico de visitas do analista e devolve APENAS JSON válido com estas chaves exatas: "
        "score_previsto (number 0-100), intervalo (array [min, max]), tendencia (string: 'melhoria'|'declínio'|'estável'), "
        "confianca (number 0-1), fatores (array de strings com factores observados), "
        "recomendacao (string: conselho curto para coordenador). "
        "Devolve somente JSON, sem markdown."
    )

    user_prompt = f"""Analisa este histórico de visitas de um analista de mystery shopping:

{visitas_summary}

Com base nestes dados:
1. Calcula o score previsto para a próxima visita (média ponderada com peso maior nas recentes)
2. Define o intervalo de confiança [min, max]
3. Identifica a tendência (últimas 5 vs anteriores)
4. Lista os factores principais que influenciam a previsão
5. Dá uma recomendação prática para o coordenador

Responde APENAS com JSON."""

    try:
        import json as _json
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["analista_id"] = analista_id
    data["gerado_em"] = datetime.now().isoformat()
    data["total_visitas_analisadas"] = len(rows)
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# Cognira Module 8 — Planeamento Automático de Visitas
# ═══════════════════════════════════════════════════════════════════════════════

async def planear_visitas_automatico(estudo_id: int, onda_id: int, db: AsyncSession) -> dict:
    """
    Cognira Module 8 — Automatic visit planning.
    Given an onda, fetches unassigned establishments and available analysts,
    then uses AI to suggest an optimal assignment balancing workload and performance.
    Returns JSON: plano (list of assignments), observacoes, total_visitas_planeadas.
    """
    from sqlalchemy import text as _text

    # Analysts available for this study (with their stats)
    analistas_rows = (await db.execute(_text("""
        SELECT
            a.id, a.nome,
            COUNT(v.id) FILTER (WHERE COALESCE(v.realizada_inicio, v.planeada_em) >= NOW() - INTERVAL '30 days') AS visitas_mes,
            ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 1) AS score_medio
        FROM analistas a
        LEFT JOIN visitas v ON v.analista_id = a.id
        WHERE a.activo = TRUE
        GROUP BY a.id, a.nome
        ORDER BY a.nome
    """))).fetchall()

    # Establishments that need visiting in this onda (no visit yet or pending)
    estabs_rows = (await db.execute(_text("""
        SELECT DISTINCT
            est.id, est.nome, est.morada
        FROM estabelecimentos est
        WHERE est.activo = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM visitas v2
              WHERE v2.onda_id = :oid
                AND v2.estado NOT IN ('cancelada', 'anulada')
                AND v2.estabelecimento_id = est.id
          )
        LIMIT 50
    """), {"oid": onda_id})).fetchall()

    if not analistas_rows:
        return {"erro": "Sem analistas activos disponíveis."}
    if not estabs_rows:
        return {
            "observacoes": "Todos os estabelecimentos já têm visitas atribuídas para esta onda.",
            "plano": [],
            "total_visitas_planeadas": 0,
        }

    analistas_summary = "\n".join(
        f"- Analista ID {r.id}: {r.nome.decode('utf-8', errors='replace') if isinstance(r.nome, bytes) else r.nome} | Visitas neste mês: {r.visitas_mes or 0} | Score médio: {r.score_medio or 'N/D'}%"
        for r in analistas_rows
    )
    estabs_summary = "\n".join(
        f"- Estabelecimento ID {r.id}: {r.nome} | Morada: {r.morada or 'N/D'}"
        for r in estabs_rows
    )

    system_prompt = (
        "És o Cognira Intelligence, especialista em mystery shopping e planeamento operacional. "
        "Distribui os estabelecimentos pelos analistas de forma equilibrada, considerando a carga de trabalho actual e o score médio. "
        "Devolve APENAS JSON válido com estas chaves: "
        "plano (array de {analista_id: int, analista_nome: str, estabelecimentos: [{id: int, nome: str}]}), "
        "observacoes (string com notas sobre a distribuição), "
        "total_visitas_planeadas (int). "
        "Devolve somente JSON, sem markdown."
    )

    user_prompt = f"""Planeia a distribuição de visitas para a onda {onda_id} do estudo {estudo_id}.

ANALISTAS DISPONÍVEIS:
{analistas_summary}

ESTABELECIMENTOS SEM VISITA ATRIBUÍDA:
{estabs_summary}

Critérios:
1. Distribui de forma equilibrada (número similar de visitas por analista)
2. Analistas com score mais alto devem receber estabelecimentos mais complexos (se houver diferença de score > 10pp)
3. Respeita a carga actual (analistas com muitas visitas neste mês devem receber menos)
4. Explica a lógica nas observações

Responde APENAS com JSON."""

    try:
        import json as _json
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            return {"erro": "Resposta vazia da IA"}
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    # Enrich each plan item with score_medio and visitas_mes from the DB query
    analista_stats = {
        r.id: {"score_medio": float(r.score_medio) if r.score_medio is not None else None,
               "visitas_mes": int(r.visitas_mes) if r.visitas_mes is not None else 0}
        for r in analistas_rows
    }
    for item in data.get("plano", []):
        aid = item.get("analista_id")
        stats = analista_stats.get(aid, {})
        item["score_medio"] = stats.get("score_medio")
        item["visitas_mes"] = stats.get("visitas_mes", 0)

    data["estudo_id"] = estudo_id
    data["onda_id"] = onda_id
    data["gerado_em"] = datetime.now().isoformat()

    # ── Geo enrichment: zone-clustered route optimisation per analyst ──────
    estab_geo = await _load_estab_coordinates(db, estudo_id)
    for item in data.get("plano", []):
        estabs = item.get("estabelecimentos", [])
        coords = [(e["id"], estab_geo.get(e["id"])) for e in estabs]
        if all(c[1] is not None for c in coords) and len(coords) > 1:
            ordered = _route_by_zones(coords)
            total_km = 0.0
            geo_rota = []
            current_zone = 0
            zone_km = 0.0
            for idx, (eid, coord) in enumerate(ordered):
                step_km = (
                    _haversine_km(ordered[idx - 1][1], coord)
                    if idx > 0 else 0.0
                )
                # Detect zone boundary (large jump = new zone)
                if step_km > 15.0 and idx > 0:
                    current_zone += 1
                    zone_km = 0.0
                total_km += step_km
                zone_km += step_km
                geo_rota.append({
                    "ordem": idx + 1,
                    "estabelecimento_id": eid,
                    "nome": next(
                        (e["nome"] for e in estabs if e["id"] == eid), ""
                    ),
                    "lat": coord[0],
                    "lng": coord[1],
                    "km_desde_anterior": round(step_km, 2),
                    "zona": current_zone + 1,
                })
            item["geo_rota"] = geo_rota
            item["distancia_total_km"] = round(total_km, 2)
            item["num_zonas"] = current_zone + 1
            # reorder estabelecimentos list to match optimised sequence
            item["estabelecimentos"] = [
                {"id": r["estabelecimento_id"], "nome": r["nome"]}
                for r in geo_rota
            ]
        else:
            item["geo_rota"] = None
            item["distancia_total_km"] = None

    data["geo_disponivel"] = any(
        item.get("geo_rota") is not None for item in data.get("plano", [])
    )

    return data


# ---------------------------------------------------------------------------
# Geo helpers (used by planear_visitas_automatico)
# ---------------------------------------------------------------------------

import math as _math


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Return great-circle distance in km between two (lat, lng) points."""
    R = 6371.0
    lat1, lon1 = _math.radians(a[0]), _math.radians(a[1])
    lat2, lon2 = _math.radians(b[0]), _math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = _math.sin(dlat / 2) ** 2 + _math.cos(lat1) * _math.cos(lat2) * _math.sin(dlon / 2) ** 2
    return R * 2 * _math.asin(_math.sqrt(h))


async def _load_estab_coordinates(
    db: AsyncSession, estudo_id: int
) -> dict[int, tuple[float, float] | None]:
    """Return {estabelecimento_id: (lat, lng)} for all active estabs in a study."""
    from sqlalchemy import text as _text2
    rows = (await db.execute(_text2("""
        SELECT DISTINCT est.id, est.latitude, est.longitude
        FROM estabelecimentos est
        JOIN visitas v ON v.estabelecimento_id = est.id
        WHERE v.estudo_id = :eid
          AND est.latitude IS NOT NULL AND est.longitude IS NOT NULL
    """), {"eid": estudo_id})).fetchall()
    # also grab estabs without visits already associated (for unassigned ones)
    rows2 = (await db.execute(_text2("""
        SELECT id, latitude, longitude
        FROM estabelecimentos
        WHERE activo = TRUE
          AND latitude IS NOT NULL AND longitude IS NOT NULL
    """))).fetchall()
    result: dict[int, tuple[float, float]] = {}
    for r in [*rows2, *rows]:
        if r[1] is not None and r[2] is not None:
            result[r[0]] = (float(r[1]), float(r[2]))
    return result


def _nearest_neighbor_route(
    coords: list[tuple[int, tuple[float, float] | None]],
) -> list[tuple[int, tuple[float, float]]]:
    """Greedy nearest-neighbor TSP approximation.

    coords: list of (estab_id, (lat, lng))
    Returns ordered list starting from the first point (index 0).
    """
    valid = [(eid, c) for eid, c in coords if c is not None]
    if not valid:
        return []
    unvisited = list(valid[1:])
    route = [valid[0]]
    while unvisited:
        last = route[-1][1]
        nearest_idx = min(
            range(len(unvisited)),
            key=lambda i: _haversine_km(last, unvisited[i][1]),
        )
        route.append(unvisited.pop(nearest_idx))
    return route


def _cluster_by_zone(
    coords: list[tuple[int, tuple[float, float]]],
    max_zone_radius_km: float = 15.0,
) -> list[list[tuple[int, tuple[float, float]]]]:
    """Simple greedy geographic clustering.

    Groups points into zones where every point is within max_zone_radius_km
    of the zone centroid. Returns list of clusters (each cluster is a list
    of (estab_id, (lat, lng))).
    """
    if not coords:
        return []

    remaining = list(coords)
    clusters: list[list[tuple[int, tuple[float, float]]]] = []

    while remaining:
        # Pick a seed (first remaining point)
        seed = remaining.pop(0)
        cluster = [seed]
        centroid = seed[1]

        # Greedily absorb nearby points
        still_remaining = []
        for point in remaining:
            if _haversine_km(centroid, point[1]) <= max_zone_radius_km:
                cluster.append(point)
                # Update centroid as running average
                n = len(cluster)
                centroid = (
                    (centroid[0] * (n - 1) + point[1][0]) / n,
                    (centroid[1] * (n - 1) + point[1][1]) / n,
                )
            else:
                still_remaining.append(point)
        remaining = still_remaining
        clusters.append(cluster)

    return clusters


def _route_by_zones(
    coords: list[tuple[int, tuple[float, float] | None]],
    max_zone_radius_km: float = 15.0,
) -> list[tuple[int, tuple[float, float]]]:
    """Cluster establishments into zones, TSP within each zone,
    then order zones by nearest-centroid to form a full route."""
    valid = [(eid, c) for eid, c in coords if c is not None]
    if len(valid) <= 2:
        return _nearest_neighbor_route(coords)

    clusters = _cluster_by_zone(valid, max_zone_radius_km)
    if len(clusters) <= 1:
        return _nearest_neighbor_route(coords)

    # Compute centroid for each cluster
    centroids = []
    for cl in clusters:
        avg_lat = sum(p[1][0] for p in cl) / len(cl)
        avg_lng = sum(p[1][1] for p in cl) / len(cl)
        centroids.append((avg_lat, avg_lng))

    # Order clusters by nearest-neighbor on centroids
    ordered_indices = [0]
    remaining_indices = list(range(1, len(clusters)))
    while remaining_indices:
        last_centroid = centroids[ordered_indices[-1]]
        nearest = min(remaining_indices, key=lambda i: _haversine_km(last_centroid, centroids[i]))
        ordered_indices.append(nearest)
        remaining_indices.remove(nearest)

    # TSP within each cluster, concatenate
    full_route: list[tuple[int, tuple[float, float]]] = []
    for ci in ordered_indices:
        cluster_route = _nearest_neighbor_route(clusters[ci])
        full_route.extend(cluster_route)

    return full_route


# ---------------------------------------------------------------------------
# Cognira Module 3 — Fotos IA (GPT-4 Vision)
# ---------------------------------------------------------------------------

FOTOS_IA_SYSTEM = """És um especialista em mystery shopping em Portugal.
Vais receber uma foto tirada por um analista durante uma visita de avaliação.
Analisa a foto e determina:
1. Se é uma foto válida de um estabelecimento comercial (agência bancária, loja, etc.)
2. Se a foto tem qualidade suficiente (não desfocada, não cortada, boa iluminação)
3. Se existe algum elemento suspeito ou irregular

Responde APENAS em JSON com exactamente este formato:
{
  "veredicto": "aprovada" | "rejeitada" | "inconclusiva",
  "confianca": 0.0-1.0,
  "motivo": "breve explicação em português",
  "problemas": ["lista de problemas detectados, ou lista vazia se nenhum"],
  "sugestao": "o que o analista deve fazer para melhorar (se aplicável)"
}"""


async def analisar_foto_ia(
    *,
    foto_id: int,
    db: AsyncSession,
    contexto: Optional[str] = None,
) -> dict:
    """Cognira Module 3 — Analyse a visit photo with GPT-4o Vision.

    Args:
        foto_id: ID of the FotoVisita to analyse.
        db: Async database session.
        contexto: Optional context string (e.g., establishment/study name) to help the LLM.

    Returns:
        Dict with 'veredicto', 'confianca', 'motivo', 'problemas', 'sugestao'.
    """
    import json as _json
    from sqlalchemy import select as _select

    from app.models.photo import FotoVisita
    from app.services import storage

    if not client:
        return {"erro": "Serviço de IA não configurado. Configure OPENAI_API_KEY."}

    # Fetch foto record
    result = await db.execute(_select(FotoVisita).where(FotoVisita.id == foto_id))
    foto = result.scalar_one_or_none()
    if foto is None:
        return {"erro": "Foto não encontrada."}

    # Get binary content from MinIO
    try:
        content = storage.download_bytes("fotos-visita", foto.url_minio)
    except Exception as exc:
        return {"erro": f"Erro ao carregar foto do armazenamento: {exc}"}

    # Encode as base64 data URI for Vision API
    import base64 as _b64
    mime = foto.mime_type or "image/jpeg"
    img_b64 = _b64.b64encode(content).decode("ascii")
    data_url = f"data:{mime};base64,{img_b64}"

    user_text = "Analisa esta foto de visita de mystery shopping."
    if contexto:
        user_text += f" Contexto: {contexto}"

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": FOTOS_IA_SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
                    ],
                },
            ],
            max_tokens=500,
            temperature=0,
        )
    except Exception as exc:
        return {"erro": f"Erro na API de IA: {exc}"}

    raw = (response.choices[0].message.content or "").strip()
    # Extract JSON block if wrapped in markdown
    if "```" in raw:
        import re as _re
        m = _re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, _re.DOTALL)
        if m:
            raw = m.group(1)

    try:
        resultado = _json.loads(raw)
    except Exception:
        resultado = {"veredicto": "inconclusiva", "confianca": 0.0, "motivo": raw, "problemas": [], "sugestao": ""}

    # Persist result
    from datetime import timezone as _tz
    foto.ia_veredicto = resultado.get("veredicto", "inconclusiva")
    foto.ia_resultado = _json.dumps(resultado, ensure_ascii=False)
    foto.ia_critica_em = datetime.now(_tz.utc)
    db.add(foto)
    await db.commit()

    return resultado


# ---------------------------------------------------------------------------
# Cognira Module 10 — Word Cloud (8E.2)
# Extract keyword frequencies from open-text visit responses for a study
# ---------------------------------------------------------------------------

_STOPWORDS_PT = {
    "a", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo", "as",
    "até", "com", "como", "da", "das", "de", "dela", "delas", "dele", "deles",
    "depois", "do", "dos", "e", "ela", "elas", "ele", "eles", "em", "entre",
    "era", "essa", "essas", "esse", "esses", "esta", "estão", "estas", "este",
    "estes", "eu", "foi", "fomos", "foram", "for", "forma", "havia", "isso",
    "isto", "já", "lhe", "lhes", "mais", "mas", "me", "mesmo", "meu", "minha",
    "muito", "na", "não", "nas", "nem", "no", "nos", "nossa", "nossas", "nosso",
    "nossos", "num", "numa", "o", "os", "ou", "para", "pela", "pelas", "pelo",
    "pelos", "por", "qual", "quando", "que", "se", "sem", "seu", "seus", "sua",
    "suas", "também", "te", "tem", "tendo", "teu", "teus", "tua", "tuas", "tudo",
    "um", "uma", "umas", "uns", "vai", "vos", "à", "às", "é", "ê", "ser",
    "sim", "não", "via", "bem", "foi", "ser", "ver", "ter", "há",
}


async def gerar_word_cloud(estudo_id: int, db: AsyncSession, onda_id: int | None = None) -> dict:
    """Extract keyword frequencies from open-text visit responses.

    Returns: {palavras: [{palavra, count, score}], total_respostas, estudo_id}
    """
    import re as _re
    import math as _math2
    from collections import Counter as _Counter

    base_query = """
        SELECT rv.valor
        FROM respostas_visita rv
        JOIN criterios_grelha cg ON cg.id = rv.criterio_id
        JOIN grelhas g ON g.id = cg.grelha_id
        JOIN visitas v ON v.id = rv.visita_id
        WHERE g.estudo_id = :estudo_id
          AND cg.tipo = 'texto'
          AND rv.valor IS NOT NULL
          AND length(trim(rv.valor)) > 3
    """
    params: dict = {"estudo_id": estudo_id}
    if onda_id:
        base_query += " AND v.onda_id = :onda_id"
        params["onda_id"] = onda_id

    rows = (await db.execute(text(base_query), params)).fetchall()
    textos = [r[0] for r in rows if r[0]]

    # Also include questionnaire open responses
    quest_query = """
        SELECT sq.json_respostas
        FROM submissoes_questionario sq
        JOIN visitas v ON v.estudo_id = :estudo_id
        WHERE sq.visita_id = v.id
    """
    quest_rows = (await db.execute(text(quest_query), {"estudo_id": estudo_id})).fetchall()
    for row in quest_rows:
        if row[0] and isinstance(row[0], dict):
            for val in row[0].values():
                if isinstance(val, str) and len(val.strip()) > 3:
                    textos.append(val)

    if not textos:
        return {"palavras": [], "total_respostas": 0, "estudo_id": estudo_id}

    # Tokenize and count
    counter: _Counter = _Counter()
    for texto in textos:
        tokens = _re.findall(r"\b[a-záàâãéèêíóôõúüçñ]{3,}\b", texto.lower())
        for token in tokens:
            if token not in _STOPWORDS_PT:
                counter[token] += 1

    # TF-IDF-like scoring: boost rare-ish words
    total = len(textos)
    palavra_docs: _Counter = _Counter()
    for texto in textos:
        tokens = set(_re.findall(r"\b[a-záàâãéèêíóôõúüçñ]{3,}\b", texto.lower()))
        for t in tokens:
            if t not in _STOPWORDS_PT:
                palavra_docs[t] += 1

    palavras = []
    for palavra, count in counter.most_common(80):
        df = palavra_docs.get(palavra, 1)
        idf = _math2.log((total + 1) / (df + 1)) + 1
        score = round(count * idf, 2)
        palavras.append({"palavra": palavra, "count": count, "score": score})

    palavras.sort(key=lambda x: x["score"], reverse=True)

    return {
        "palavras": palavras[:60],
        "total_respostas": len(textos),
        "estudo_id": estudo_id,
    }


# ---------------------------------------------------------------------------
# Cognira Module 11 — Comparativo Temporal AI (8E.5)
# "Este mês vs mês anterior" with automatic narrative explanation
# ---------------------------------------------------------------------------

COMPARATIVO_SYSTEM = """És um analista de dados especializado em mystery shopping em Portugal.
Vais receber métricas de dois períodos consecutivos de um estudo e deves produzir
uma análise comparativa narrativa clara e accionável.

Responde em JSON:
{
  "resumo": "1-2 frases executivas sobre a evolução geral",
  "tendencia": "positiva" | "negativa" | "estavel",
  "variacao_score": float,
  "destaques": [
    {"tipo": "melhoria" | "declinio" | "destaque", "titulo": str, "detalhe": str}
  ],
  "recomendacoes": ["acção concreta 1", "acção concreta 2"],
  "gerado_em": "ISO datetime"
}"""


async def comparativo_temporal(
    estudo_id: int,
    db: AsyncSession,
    periodo_dias: int = 30,
) -> dict:
    """Compare current period vs previous period for a study.

    Returns an AI-generated narrative comparison.
    """
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    now = datetime.now()
    fim_atual = now
    inicio_atual = now - timedelta(days=periodo_dias)
    inicio_anterior = inicio_atual - timedelta(days=periodo_dias)
    fim_anterior = inicio_atual

    def _period_query(inicio, fim):
        return text("""
            SELECT
                COUNT(*) FILTER (WHERE estado = 'validada') AS validadas,
                COUNT(*) FILTER (WHERE estado = 'fechada') AS fechadas,
                COUNT(*) AS total,
                ROUND(AVG(pontuacao)::numeric, 2) AS score_medio,
                COUNT(*) FILTER (WHERE estado = 'anulada') AS anuladas
            FROM visitas
            WHERE estudo_id = :eid
              AND inserida_em >= :inicio
              AND inserida_em < :fim
        """)

    r_atual = (await db.execute(
        _period_query(inicio_atual, fim_atual),
        {"eid": estudo_id, "inicio": inicio_atual, "fim": fim_atual},
    )).fetchone()

    r_anterior = (await db.execute(
        _period_query(inicio_anterior, fim_anterior),
        {"eid": estudo_id, "inicio": inicio_anterior, "fim": fim_anterior},
    )).fetchone()

    def _row_to_dict(r):
        if not r:
            return {"validadas": 0, "fechadas": 0, "total": 0, "score_medio": None, "anuladas": 0}
        return {
            "validadas": r[0] or 0,
            "fechadas": r[1] or 0,
            "total": r[2] or 0,
            "score_medio": float(r[3]) if r[3] is not None else None,
            "anuladas": r[4] or 0,
        }

    atual = _row_to_dict(r_atual)
    anterior = _row_to_dict(r_anterior)

    prompt = f"""Análise comparativa — Estudo #{estudo_id}

Período actual ({inicio_atual.strftime('%d/%m')}–{fim_atual.strftime('%d/%m/%Y')}):
{_json.dumps(atual, ensure_ascii=False)}

Período anterior ({inicio_anterior.strftime('%d/%m')}–{fim_anterior.strftime('%d/%m/%Y')}):
{_json.dumps(anterior, ensure_ascii=False)}

Produz a análise comparativa em JSON conforme o formato especificado."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": COMPARATIVO_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["periodo_atual"] = {"inicio": inicio_atual.isoformat(), "fim": fim_atual.isoformat(), **atual}
    data["periodo_anterior"] = {"inicio": inicio_anterior.isoformat(), "fim": fim_anterior.isoformat(), **anterior}
    data["estudo_id"] = estudo_id
    return data


# ---------------------------------------------------------------------------
# Cognira Module 12 — Sentiment Analysis (8E.1)
# NLP sentiment scoring on open-text responses
# ---------------------------------------------------------------------------

SENTIMENT_SYSTEM = """És um especialista em análise de sentiment em português de Portugal.
Analisa um conjunto de respostas abertas de um estudo de mystery shopping e determina:

1. Sentimento geral (positivo/negativo/neutro) com score -1.0 a +1.0
2. Principais temas detectados
3. Palavras-chave de sentimento positivo e negativo

Responde em JSON:
{
  "sentimento_global": "positivo" | "negativo" | "neutro",
  "score": float -1.0 a 1.0,
  "confianca": 0.0-1.0,
  "temas": [{"tema": str, "sentimento": str, "mencoes": int}],
  "palavras_positivas": [str],
  "palavras_negativas": [str],
  "resumo": "1-2 frases sobre o sentiment geral",
  "total_respostas_analisadas": int
}"""


async def analisar_sentimento(
    estudo_id: int,
    db: AsyncSession,
    onda_id: int | None = None,
) -> dict:
    """Run NLP sentiment analysis on open-text responses for a study/wave."""
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    query = text("""
        SELECT rv.valor
        FROM respostas_visita rv
        JOIN criterios_grelha cg ON cg.id = rv.criterio_id
        JOIN grelhas g ON g.id = cg.grelha_id
        JOIN visitas v ON v.id = rv.visita_id
        WHERE g.estudo_id = :estudo_id
          AND cg.tipo = 'texto'
          AND rv.valor IS NOT NULL
          AND length(trim(rv.valor)) > 5
        ORDER BY rv.id DESC
        LIMIT 200
    """)
    params: dict = {"estudo_id": estudo_id}
    if onda_id:
        query = text(str(query.text).replace("ORDER BY", "AND v.onda_id = :onda_id ORDER BY"))
        params["onda_id"] = onda_id

    rows = (await db.execute(query, params)).fetchall()
    textos = [r[0] for r in rows if r[0]]

    if not textos:
        return {"erro": "Sem respostas de texto para analisar", "estudo_id": estudo_id}

    # Sample up to 100 for the prompt to keep tokens manageable
    sample = textos[:100]
    prompt = f"""Estudo #{estudo_id} — {len(textos)} respostas abertas (amostra de {len(sample)})

Respostas:
{chr(10).join(f'- {t}' for t in sample)}

Analisa o sentiment destas respostas."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": SENTIMENT_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["total_respostas_analisadas"] = len(textos)
    data["estudo_id"] = estudo_id
    return data


# ---------------------------------------------------------------------------
# Cognira Module 13 — AI Auto-QC (8E.3)
# Automatic quality control flagging of visit responses
# ---------------------------------------------------------------------------

AUTO_QC_SYSTEM = """És um especialista em controlo de qualidade de mystery shopping.
Vais receber as respostas de uma visita e deves identificar inconsistências,
respostas suspeitas ou problemas de qualidade.

Responde em JSON:
{
  "veredicto": "aprovado" | "suspeito" | "rejeitado",
  "confianca": 0.0-1.0,
  "flags": [
    {"tipo": "inconsistencia" | "resposta_padrao" | "tempo_suspeito" | "gps_ausente" | "outro",
     "descricao": str,
     "severidade": "baixa" | "media" | "alta"}
  ],
  "recomendacao": str,
  "necessita_revisao_humana": bool
}"""


async def auto_qc_visita(visita_id: int, db: AsyncSession) -> dict:
    """Automatic quality control check for a visit's responses.

    Flags inconsistencies and suspicious patterns before human review.
    """
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    from app.models.visit import Visita, CampoVisita
    from app.models.evaluation import RespostaVisita, CriterioGrelha

    visita = (await db.execute(
        text("SELECT id, pontuacao, duracao_minutos, estado, analista_id FROM visitas WHERE id = :vid"),
        {"vid": visita_id}
    )).fetchone()

    if not visita:
        return {"erro": "Visita não encontrada"}

    respostas = (await db.execute(
        text("""
            SELECT cg.label, cg.tipo, rv.valor
            FROM respostas_visita rv
            JOIN criterios_grelha cg ON cg.id = rv.criterio_id
            WHERE rv.visita_id = :vid
            LIMIT 50
        """),
        {"vid": visita_id}
    )).fetchall()

    campos = (await db.execute(
        text("SELECT chave, valor FROM campos_visita WHERE visita_id = :vid LIMIT 20"),
        {"vid": visita_id}
    )).fetchall()

    context = {
        "visita_id": visita_id,
        "pontuacao_total": float(visita[1]) if visita[1] else None,        "duracao_minutos": visita[2],
        "estado": visita[3],
        "num_respostas": len(respostas),
        "respostas": [{"label": r[0], "tipo": r[1], "valor": r[2]} for r in respostas],
        "campos_extra": {c[0]: c[1] for c in campos},
    }

    prompt = f"""Verifica a qualidade desta visita de mystery shopping:

{_json.dumps(context, ensure_ascii=False, indent=2)}

Identifica problemas e responde em JSON."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": AUTO_QC_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["visita_id"] = visita_id
    return data


# ---------------------------------------------------------------------------
# Cognira Module 14 — AI Coaching para Analistas (8E.4)
# Personalised performance coaching based on visit metrics
# ---------------------------------------------------------------------------

COACHING_SYSTEM = """És um coach especializado em mystery shopping em Portugal.
Analisa as métricas de desempenho de um analista e fornece coaching personalizado
com base nos dados concretos dos últimos 90 dias.

Responde em JSON:
{
  "score_geral": "excelente" | "bom" | "medio" | "precisa_melhoria",
  "pontos_fortes": ["ponto 1", "ponto 2"],
  "areas_melhoria": [
    {"area": str, "impacto": "alto" | "medio" | "baixo", "sugestao": str}
  ],
  "recomendacoes": ["acção concreta 1", "acção concreta 2"],
  "resumo": "2-3 frases de coaching personalizado e motivacional",
  "prioridade_foco": "o aspecto mais importante a melhorar agora"
}"""


async def coaching_analista(analista_id: int, db: AsyncSession) -> dict:
    """AI personalised coaching for an analyst based on their 90-day metrics."""
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    row = (await db.execute(
        text("""
            SELECT
                COUNT(*)                                                        AS total_visitas,
                ROUND(AVG(pontuacao)::numeric, 2)                               AS score_medio,
                COUNT(*) FILTER (WHERE estado = 'anulada')                      AS anuladas,
                COUNT(*) FILTER (WHERE estado = 'validada')                     AS validadas,
                ROUND(AVG(duracao_minutos)::numeric, 1)                         AS duracao_media,
                MIN(inserida_em)                                                AS primeira_visita,
                MAX(inserida_em)                                                AS ultima_visita
            FROM visitas
            WHERE analista_id = :aid
              AND inserida_em >= NOW() - INTERVAL '90 days'
        """),
        {"aid": analista_id},
    )).fetchone()

    if not row or row[0] == 0:
        return {"erro": "O analista não tem visitas suficientes nos últimos 90 dias", "analista_id": analista_id}

    total = row[0]
    metricas = {
        "total_visitas": total,
        "score_medio": float(row[1]) if row[1] else None,
        "visitas_anuladas": row[2],
        "visitas_validadas": row[3],
        "taxa_anulacao_pct": round(row[2] / total * 100, 1) if total > 0 else 0,
        "duracao_media_minutos": float(row[4]) if row[4] else None,
        "primeira_visita": str(row[5])[:10] if row[5] else None,
        "ultima_visita": str(row[6])[:10] if row[6] else None,
    }

    # IA QC flags breakdown (last 90 days)
    qc_rows = (await db.execute(
        text("""
            SELECT ia_veredicto, COUNT(*) AS n
            FROM visitas
            WHERE analista_id = :aid
              AND ia_veredicto IS NOT NULL
              AND inserida_em >= NOW() - INTERVAL '90 days'
            GROUP BY ia_veredicto
        """),
        {"aid": analista_id},
    )).fetchall()
    if qc_rows:
        metricas["ia_flags"] = {r[0]: r[1] for r in qc_rows}

    prompt = f"""Analista #{analista_id} — Métricas dos últimos 90 dias:
{_json.dumps(metricas, ensure_ascii=False, indent=2)}

Fornece coaching personalizado, honesto e accionável baseado nestas métricas."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": COACHING_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=1200,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["metricas"] = metricas
    data["analista_id"] = analista_id
    return data


# ---------------------------------------------------------------------------
# Module 10 — AI Closed-Loop Corrective Actions  (8E.6)
# ---------------------------------------------------------------------------

ACAO_SYSTEM = """És um especialista em gestão da qualidade e melhoria contínua para operações CX.
Vais receber dados de um estabelecimento com score abaixo do threshold e historial de visitas.
Deves produzir um plano de acção correctivo estruturado em JSON.

O plano deve ser PRÁTICO, ESPECÍFICO e PRIORITIZADO.
Nunca inventes dados — baseia-te APENAS nas métricas fornecidas.

Formato de resposta JSON:
{
  "problema_principal": "descrição em 1 frase do problema central",
  "causas_previstas": ["causa1", "causa2", "causa3"],
  "prioridade": "critica|alta|media",
  "acoes_imediatas": [
    {"acao": "...", "responsavel": "gestor|analista|director", "prazo_dias": 7}
  ],
  "acoes_medio_prazo": [
    {"acao": "...", "responsavel": "...", "prazo_dias": 30}
  ],
  "kpis_acompanhamento": ["..."],
  "impacto_estimado": "descrição do impacto esperado na qualidade CX",
  "mensagem_gestor": "mensagem breve e motivadora para enviar ao gestor da unidade"
}"""


async def acao_corretiva_estabelecimento(
    estabelecimento_id: int,
    db: AsyncSession,
    estudo_id: int | None = None,
) -> dict:
    """Generate an AI corrective action plan for an establishment below score threshold (8E.6).

    Returns structured JSON with root causes, prioritised actions, KPIs and
    an optional manager message.
    """
    if not client:
        return {"erro": "Serviço de IA não configurado."}

    # Gather visit stats for this establishment
    study_filter = "AND v.estudo_id = :estudo_id" if estudo_id else ""
    params: dict = {"estabelecimento_id": estabelecimento_id}
    if estudo_id:
        params["estudo_id"] = estudo_id

    stats_sql = text(f"""
        SELECT
            e.nome AS estab_nome,
            COUNT(v.id) AS total_visitas,
            ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada'), 1) AS avg_score,
            MIN(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada') AS min_score,
            MAX(v.pontuacao) FILTER (WHERE v.pontuacao_estado = 'calculada') AS max_score,
            COUNT(*) FILTER (WHERE v.estado = 'corrigir') AS revisoes,
            COUNT(*) FILTER (WHERE v.estado = 'anulada') AS anuladas
        FROM visitas v
        JOIN estabelecimentos e ON e.id = v.estabelecimento_id
        WHERE v.estabelecimento_id = :estabelecimento_id
          AND v.activo = true
          {study_filter}
    """)
    stats_row = (await db.execute(stats_sql, params)).mappings().first()
    if not stats_row or not stats_row["avg_score"]:
        return {"erro": "Dados insuficientes para gerar plano de acção."}

    # Last 5 AI flags from auto-QC for context
    flags_sql = text("""
        SELECT v.id, v.ia_flags
        FROM visitas v
        WHERE v.estabelecimento_id = :estabelecimento_id
          AND v.ia_flags IS NOT NULL
          AND v.activo = true
        ORDER BY v.id DESC
        LIMIT 5
    """)
    flags_rows = (await db.execute(flags_sql, {"estabelecimento_id": estabelecimento_id})).all()
    recent_flags: list[str] = []
    for row in flags_rows:
        if row.ia_flags:
            try:
                flags = _json.loads(row.ia_flags) if isinstance(row.ia_flags, str) else row.ia_flags
                if isinstance(flags, list):
                    recent_flags.extend(flags[:3])
                elif isinstance(flags, dict):
                    recent_flags.extend(list(flags.values())[:3])
            except Exception:
                pass

    metricas = {
        "estabelecimento": stats_row["estab_nome"],
        "total_visitas": stats_row["total_visitas"],
        "score_medio": float(stats_row["avg_score"]),
        "score_minimo": float(stats_row["min_score"]) if stats_row["min_score"] else None,
        "score_maximo": float(stats_row["max_score"]) if stats_row["max_score"] else None,
        "visitas_em_revisao": stats_row["revisoes"],
        "visitas_anuladas": stats_row["anuladas"],
        "flags_ia_recentes": list(dict.fromkeys(recent_flags))[:8],  # deduplicated
    }

    prompt = f"""Estabelecimento: {metricas['estabelecimento']} — Score médio: {metricas['score_medio']}

Dados completos:
{_json.dumps(metricas, ensure_ascii=False, indent=2)}

Gera o plano de acção correctivo."""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": ACAO_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        data = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    data["metricas"] = metricas
    data["estabelecimento_id"] = estabelecimento_id
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# Wave 5.5 — Shelf Audit AI Compliance Analysis
# ═══════════════════════════════════════════════════════════════════════════════

_SHELF_AUDIT_SYSTEM = """És um especialista em auditoria de retalho e gestão de lineares.
Recebes dados de conformidade de uma auditoria de prateleira e deves produzir:
1. Resumo executivo (2-3 frases sobre o estado geral de compliance)
2. Lista de itens críticos (não conformes, out-of-stock, desvios de preço relevantes)
3. Tendências e padrões observados
4. Recomendações prioritárias (máximo 3 acções concretas)
5. Score de risco geral: baixo / médio / alto

Responde EXCLUSIVAMENTE em JSON com as chaves:
  resumo (string), itens_criticos (array de strings), tendencias (string),
  recomendacoes (array de strings), risco (string: baixo|médio|alto).
Usa português de Portugal."""


async def analisar_shelf_audit(visita_id: int, db: "AsyncSession") -> dict:
    """Wave 5.5 — AI compliance analysis for a shelf-audit visit.

    Fetches all ShelfAuditItem rows for the visit, builds a compact summary,
    calls GPT, persists the result to visitas.shelf_ia_analise / shelf_ia_em,
    and returns the parsed dict enriched with raw metrics.
    """
    import json as _json
    from datetime import datetime, timezone
    from sqlalchemy import select as _sel

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    from app.models.shelf_audit import ShelfAuditItem
    from app.models.visit import Visita

    items = (
        await db.execute(_sel(ShelfAuditItem).where(ShelfAuditItem.visita_id == visita_id))
    ).scalars().all()

    if not items:
        return {"erro": "Sem itens registados para esta visita."}

    total = len(items)
    conformes = sum(1 for i in items if i.conforme)
    out_of_stock = sum(1 for i in items if i.quantidade_real == 0)

    desvios_preco = [
        {
            "produto": i.produto_nome,
            "esperado": float(i.preco_esperado),
            "real": float(i.preco_real),
            "delta": round(float(i.preco_real) - float(i.preco_esperado), 2),
        }
        for i in items
        if i.preco_esperado and i.preco_real
        and abs(float(i.preco_real) - float(i.preco_esperado)) > 0.01
    ]

    nao_conformes_lista = [
        {"produto": i.produto_nome, "ean": i.ean or "", "notas": i.notas or ""}
        for i in items
        if not i.conforme
    ]

    dados = {
        "total_itens": total,
        "conformes": conformes,
        "nao_conformes": total - conformes,
        "compliance_rate_pct": round(conformes / total * 100, 1),
        "out_of_stock": out_of_stock,
        "desvios_preco": desvios_preco,
        "nao_conformes_lista": nao_conformes_lista,
    }

    prompt = (
        f"Dados da auditoria de prateleira (visita {visita_id}):\n"
        + _json.dumps(dados, ensure_ascii=False, indent=2)
        + "\n\nGera a análise."
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": _SHELF_AUDIT_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=900,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        result = _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

    # Persist to visita row
    visita = (
        await db.execute(_sel(Visita).where(Visita.id == visita_id))
    ).scalar_one_or_none()
    if visita:
        visita.shelf_ia_analise = _json.dumps(result, ensure_ascii=False)
        visita.shelf_ia_em = datetime.now(timezone.utc)
        await db.commit()

    result["dados"] = dados
    return result


# ---------------------------------------------------------------------------
# Module 10 — AI Study Wizard
# ---------------------------------------------------------------------------

_WIZARD_SYSTEM = """És um especialista em mystery shopping, auditorias de qualidade e design de estudos de mercado em Portugal.
O utilizador vai fornecer um briefing sobre o que pretende avaliar, o sector de actividade e o tipo de estudo.
Deves sugerir uma configuração completa e profissional para o estudo, incluindo:
1. Campos de caracterização (dados recolhidos em cada visita)
2. Uma grelha de avaliação com secções e critérios ponderados (soma dos pesos = 1.0 por secção)
3. Módulos do sistema que devem ser activados para este tipo de estudo
4. Uma justificação resumida das tuas escolhas

Tipos de campos disponíveis: text, number, select, boolean
Tipos de critério disponíveis: boolean (sim/não), escala (0–5), texto (resposta livre)

Responde EXCLUSIVAMENTE em JSON com a seguinte estrutura:
{
  "nome_estudo": "string — nome sugerido para o estudo",
  "campos": [
    {"chave": "string", "label": "string", "tipo": "text|number|select|boolean", "opcoes": ["string"] ou [], "obrigatorio": true|false}
  ],
  "grelha": {
    "nome": "string",
    "tipo_visita": "presencial|telefonica|drive-through|online",
    "secoes": [
      {
        "nome": "string",
        "ordem": 1,
        "peso_secao": 0.0,
        "criterios": [
          {"label": "string", "peso": 0.0, "tipo": "boolean|escala|texto", "ordem": 1}
        ]
      }
    ]
  },
  "modulos_sugeridos": ["string"],
  "justificacao": "string"
}

Regras:
- A soma de peso_secao de todas as secções deve ser 1.0
- Dentro de cada secção, a soma dos pesos dos critérios deve ser 1.0
- Sugere entre 3 e 8 campos de caracterização
- Sugere entre 2 e 6 secções na grelha, cada uma com 2 a 8 critérios
- Modulos disponíveis: callcenter, chat_interno, formacoes, questionarios, shelf_audit, rag, webhooks, push_notifications
- Usa português de Portugal correcto e formal"""


async def wizard_estudo(
    briefing: str,
    sector: str,
    tipo_estudo: str,
) -> dict:
    """Wave 7 — AI Study Wizard.

    Given a free-text briefing, a sector name and a study type, returns a
    complete study configuration suggestion: campos, grelha with weighted
    sections/criteria, recommended modules and a justification.
    """
    import json as _json

    if not client:
        return {"erro": "Serviço de IA não configurado."}

    prompt = (
        f"Sector: {sector}\n"
        f"Tipo de estudo: {tipo_estudo}\n\n"
        f"Briefing:\n{briefing}\n\n"
        "Gera a configuração completa do estudo."
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": _WIZARD_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=2500,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return _json.loads(raw)
    except Exception as exc:
        return {"erro": f"Erro na IA: {exc}"}

