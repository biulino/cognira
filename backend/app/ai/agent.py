"""Cognira AI Chat Agent — conversational interface over the mystery shopping database.

Entry points:
  run_chat(mensagem, estudo_id, user, db, historico)
      Main chat handler. Accepts a user message and returns a ChatResponse with:
      - resposta: natural-language answer in pt-PT (no markdown)
      - sugestoes: 3 contextual follow-up questions
      - logistica_preview: populated when the user requests a visit reassignment

      Internally runs an OpenAI function-calling loop with up to 5 chained tool calls:
        - buscar_dados      → executes a SELECT and returns results for the LLM to narrate
        - reatribuir_visitas → reassigns specific visit IDs (admin/coordenador only)
        - reatribuir_analista_bulk → reassigns all visits from one analyst to another
      Pre-fetches any visit IDs found in the message before the first LLM call.
      Write operations (reatribuir_*) return a preview that must be confirmed by the frontend.

  run_logistica_preview(mensagem, db)
      Parses a free-text reassignment command and returns a preview dict
      (analista_origem, analista_destino, visitas_count, sample).  Used by
      the legacy /chat/logistica endpoint.

  run_logistica_execute(origem_id, destino_id, estudo_id, db, visita_ids)
      Executes a parameterised visit reassignment and returns {alteradas: n}.

Permissions:
  role_global 'admin' or 'coordenador' → read + write tools available.
  All other roles → read-only (buscar_dados only).

Models used:
  gpt-4.1-nano — chat loop and logistics parsing (fast, low cost)
"""
import re
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import Utilizador
from app.schemas import ChatResponse
from app.services import pii

settings = get_settings()
# Module-level fallback client (used when provider routing is not configured)
client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


async def _ai_client(db: AsyncSession) -> Optional[AsyncOpenAI]:
    """Return the appropriate AsyncOpenAI client for chat tasks.

    Uses provider routing config from DB when available; falls back to env key.
    """
    from app.ai.provider_factory import get_client_for_task
    routed, _ = await get_client_for_task("chat", db)
    return routed or client

# ---------------------------------------------------------------------------
# OpenAI Function Calling Tools
# ---------------------------------------------------------------------------

_TOOLS_READ = [
    {
        "type": "function",
        "function": {
            "name": "buscar_dados",
            "description": (
                "Executa uma query SELECT na base de dados. OBRIGATÓRIO usar para qualquer questão "
                "sobre dados, estatísticas, análises, visitas, analistas, pontuações, variações, etc. "
                "NUNCA respondas sobre dados sem chamar esta ferramenta primeiro. "
                "Para mensagens puramente conversacionais sem dados (saudações, agradecimentos), "
                "usa SELECT 1::int AS ok e responde de forma natural. "
                "Interpreta os resultados em linguagem natural — NUNCA mostres SQL ao utilizador."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": (
                            "Query SELECT válida. ATENÇÃO: colunas nome e email em analistas "
                            "são bytea — NUNCA usar ILIKE directo, usar "
                            "convert_from(nome,'UTF8') ILIKE '%%valor%%'. "
                            "Para saber o analista de uma visita: "
                            "SELECT convert_from(a.nome,'UTF8') AS analista FROM visitas v "
                            "JOIN analistas a ON a.id=v.analista_id WHERE v.id=<ID>"
                        ),
                    }
                },
                "required": ["sql"],
            },
        },
    },
]

_TOOLS_WRITE = [
    {
        "type": "function",
        "function": {
            "name": "reatribuir_visitas",
            "description": (
                "Reatribui visitas específicas (lista de IDs) para outro analista. "
                "Requer o ID numérico do analista destino — se só tens o nome, usa "
                "primeiro buscar_dados para obter o id. Executa directamente sem confirmação."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "visita_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Lista de IDs das visitas a reatribuir",
                    },
                    "destino_analista_id": {
                        "type": "integer",
                        "description": "ID do analista que vai receber as visitas",
                    },
                },
                "required": ["visita_ids", "destino_analista_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reatribuir_analista_bulk",
            "description": (
                "Reatribui TODAS as visitas activas de um analista para outro (operação em massa). "
                "Requer IDs numéricos — usa buscar_dados primeiro se só tens nomes. "
                "Devolve um preview para o utilizador confirmar antes de executar."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "origem_analista_id": {"type": "integer"},
                    "destino_analista_id": {"type": "integer"},
                    "estudo_id": {
                        "type": "integer",
                        "description": "Opcional — limitar a um estudo específico",
                    },
                },
                "required": ["origem_analista_id", "destino_analista_id"],
            },
        },
    },
]


SYSTEM_PROMPT = """És o assistente inteligente do sistema Cognira de mystery shopping em Portugal.
Tens acesso a uma base de dados PostgreSQL e podes usar ferramentas para responder e executar operações.

Schema da base de dados:
- clientes(id, nome, activo)
- estudos(id, cliente_id, nome, estado, tipo_caracterizacao, criado_em)
- analistas(id, nome, codigo_externo, email, activo)
- estabelecimentos(id, cliente_id, id_loja_externo, nome, tipo_canal, regiao, responsavel)
- ondas(id, estudo_id, label)
- visitas(id, estudo_id, analista_id, estabelecimento_id, onda_id, grelha_id, estado, motivo_anulacao, tipo_visita, planeada_em, realizada_inicio, realizada_fim, inserida_em, validada_em, pontuacao, pontuacao_estado, activo)
- grelhas(id, estudo_id, nome, versao, tipo_visita)
- secoes_grelha(id, grelha_id, nome, ordem, peso_secao)
- criterios_grelha(id, grelha_id, secao_id, label, peso, tipo, ordem)
- respostas_visita(id, visita_id, criterio_id, valor)
- campos_visita(id, visita_id, chave, valor)
- fotos_visita(id, visita_id, url_minio, validada_gps, validada)
- pagamentos_visita(id, visita_id, analista_id, valor_base, valor_despesas, valor_total, estado)

MULTI-GRELHA (Wave 4):
- Um estudo pode ter N grelhas, uma por tipo_visita (presencial, drive_through, telefonica, auditoria, digital)
- visitas.grelha_id → FK para grelhas.id (qual grelha foi usada nesta visita)
- visitas.tipo_visita → o tipo de canal da visita (VARCHAR(30))
- grelhas.tipo_visita → o canal a que esta grelha se aplica
- secoes_grelha = grupos temáticos dentro de uma grelha (ex: "Atendimento", "Produto")
- criterios_grelha = critérios individuais dentro de uma secção
- respostas_visita = respostas do analista a cada critério de uma visita
- Para comparar scores entre tipos de visita, normaliza por grelha (as pontuações já são 0–100)
- NUNCA mistures critérios de grelhas diferentes numa mesma query de scoring

TIPOS DE DADOS IMPORTANTES:
- analistas.nome e analistas.email são colunas bytea (encriptadas). SEMPRE usar convert_from(nome,'UTF8') ILIKE '%%valor%%' para filtrar analistas por nome. NUNCA usar = ou ILIKE directamente em colunas bytea.
- estudos.nome, estabelecimentos.nome, clientes.nome são TEXT simples — usar ILIKE '%%valor%%' directamente SEM convert_from().
- NUNCA usa correspondência exacta (=) para pesquisar nomes de estudos. O nome real pode ser longo: e.g. "Mystery Shopping Agências Novo Banco 2024". USA SEMPRE ILIKE '%%palavra%%'.

Glossário: DCN=Norte, DCS=Sul, LVI=Visita Interior, LVD=Visita Domicílio, Onda=período de avaliação
Estados visita (coluna estado): nova, planeada, inserida, corrigir, validada, fechada, anulada
Estado da pontuação (coluna pontuacao_estado): calculada, nao_avaliada, nao_aplicavel
- pontuacao_estado "nao_avaliada" = não avaliada ainda, mostrar "-", NÃO é 0%
- pontuacao_estado "calculada" = visita tem pontuação numérica válida na coluna pontuacao
- pontuacao_estado "nao_aplicavel" = visita isenta de avaliação
Tipos de visita (coluna tipo_visita): presencial, drive_through, telefonica, auditoria, digital

REGRAS CRÍTICAS:
1. Responde SEMPRE em português de Portugal, de forma CONVERSACIONAL e humanizada.
2. NUNCA mostres SQL, IDs técnicos internos ou dados em bruto ao utilizador.
3. NUNCA faças perguntas desnecessárias — quando o utilizador menciona números como "1191" ou "1192", são IDs de visitas (coluna visitas.id). Pesquisa IMEDIATAMENTE na BD.
4. Quando o utilizador diz "o analista da visita X" → faz SELECT com JOIN a analistas para obter o nome.
5. Quando o utilizador menciona apenas um número solto → assume que é um ID de visita e pesquisa.
6. Usa buscar_dados ANTES de pedir mais informação — só pergunta se mesmo assim não encontrares nada.
7. Para reatribuir visitas específicas (por ID): usa reatribuir_visitas (mostra preview para confirmar).
8. Para reatribuir todas as visitas de um analista: usa reatribuir_analista_bulk.
9. Se precisas do ID de um analista e só tens o nome, usa buscar_dados para o encontrar.
10. NUNCA uses asteriscos, negrito, itálico ou qualquer formatação Markdown. Escreve texto simples e limpo.
11. Podes usar listas com hífen (-) ou números, mas SEM **, *, __, etc.
12. Tom: profissional mas próximo. Usa o nome do utilizador ocasionalmente (1 vez em cada 3-4 respostas), não em todas. Nunca forçado.
13. NUNCA JAMAIS digas "não tenho acesso directo" ou "não posso consultar valores individuais" ou qualquer variante. TENS ACESSO COMPLETO a toda a base de dados via buscar_dados. Se precisas de dados, consulta-os.
14. Para questões sobre variação, dispersão, desvio → usa STDDEV(pontuacao). Para min/max → usa MIN/MAX. Para percentis → usa PERCENTILE_CONT. Não assumas nada sem consultar.
15. Quando a questão é analítica ou estatística, executa SEMPRE a query mais completa possível com GROUP BY, ORDER BY, funções de agregação — e apresenta os resultados de forma clara.
16. Tens acesso a TODA a informação: visitas individuais, campos_visita (respostas), fotos, pagamentos, analistas, estabelecimentos, clientes, estudos, ondas, grelhas, secções, critérios. Nunca digas que não tens acesso a algo.
17. Quando a pergunta envolve tipos de visita (presencial, drive-through, telefónica...), filtra SEMPRE por tipo_visita E relaciona com a grelha correspondente via visitas.grelha_id.
18. Para comparar scores entre tipos de canal → agrupa por tipo_visita e apresenta separados, nunca numa média global.
19. Ao mencionar "drive-through" ou "drive_through" — na BD a coluna é tipo_visita='drive_through' (com underscore).

EXEMPLOS DE SQL CORRECTO:
- "analistas do Novo Banco" → WHERE e.nome ILIKE '%%Novo Banco%%'  (texto simples, não bytea)
- "quem é o analista da 1192?" → SELECT convert_from(a.nome,'UTF8') AS analista, v.id, v.estado, v.tipo_visita FROM visitas v JOIN analistas a ON a.id=v.analista_id WHERE v.id=1192
- "quantas visitas tem o João?" → WHERE convert_from(a.nome,'UTF8') ILIKE '%%João%%'
- "distribuição por tipo de visita" → SELECT tipo_visita, COUNT(*) as total, ROUND(AVG(pontuacao) FILTER (WHERE pontuacao_estado='calculada')::numeric,1) as media FROM visitas WHERE estudo_id=X GROUP BY tipo_visita ORDER BY total DESC
- "pontuação por canal / grelha" → SELECT g.nome as grelha, g.tipo_visita, COUNT(v.id) as visitas, ROUND(AVG(v.pontuacao) FILTER (WHERE v.pontuacao_estado='calculada')::numeric,1) as media FROM visitas v JOIN grelhas g ON g.id=v.grelha_id WHERE v.estudo_id=X GROUP BY g.id, g.nome, g.tipo_visita ORDER BY media DESC
- "secções e critérios de uma grelha" → SELECT s.nome as secao, s.peso_secao, c.label as criterio, c.peso FROM secoes_grelha s JOIN criterios_grelha c ON c.secao_id=s.id WHERE s.grelha_id=X ORDER BY s.ordem, c.ordem
- "respostas aos critérios de uma visita com secção" → SELECT s.nome as secao, c.label as criterio, r.valor FROM respostas_visita r JOIN criterios_grelha c ON c.id=r.criterio_id LEFT JOIN secoes_grelha s ON s.id=c.secao_id WHERE r.visita_id=V ORDER BY s.ordem, c.ordem
- "grelhas disponíveis neste estudo" → SELECT id, nome, tipo_visita, versao FROM grelhas WHERE estudo_id=X ORDER BY tipo_visita
- "distribuição pontuações por estado" → SELECT pontuacao_estado, COUNT(*) as total, ROUND(AVG(pontuacao)::numeric,1) as media FROM visitas v JOIN estudos e ON e.id=v.estudo_id WHERE e.nome ILIKE '%%NomeEstudo%%' GROUP BY pontuacao_estado
- "variação/desvio por estado" → SELECT estado, COUNT(*) as total, ROUND(STDDEV(pontuacao)::numeric,2) as desvio_padrao, ROUND(AVG(pontuacao)::numeric,1) as media, MIN(pontuacao) as minimo, MAX(pontuacao) as maximo FROM visitas WHERE pontuacao_estado='calculada' GROUP BY estado ORDER BY desvio_padrao DESC NULLS LAST
- "ranking analistas por pontuação" → SELECT convert_from(a.nome,'UTF8') AS analista, COUNT(v.id) as visitas, ROUND(AVG(v.pontuacao)::numeric,1) as media FROM visitas v JOIN analistas a ON a.id=v.analista_id WHERE v.pontuacao_estado='calculada' GROUP BY a.id, a.nome ORDER BY media DESC
- "quantas grelhas tem o estudo?" → SELECT COUNT(*) as total_grelhas, STRING_AGG(tipo_visita, ', ' ORDER BY tipo_visita) as tipos FROM grelhas WHERE estudo_id=X
"""


async def _prefetch_study_stats(estudo_id: int, db: AsyncSession) -> str:
    """Pre-fetch comprehensive stats for the active study and return as a context string."""
    import json as _json
    try:
        rows = (await db.execute(text("""
            SELECT
                e.nome                                                                AS estudo_nome,
                COUNT(v.id)                                                           AS total_visitas,
                COUNT(CASE WHEN v.pontuacao_estado='calculada' THEN 1 END)            AS com_pontuacao,
                ROUND(AVG(CASE WHEN v.pontuacao_estado='calculada' THEN v.pontuacao END)::numeric,1) AS media_pontuacao,
                ROUND(STDDEV(CASE WHEN v.pontuacao_estado='calculada' THEN v.pontuacao END)::numeric,2) AS desvio_global,
                MIN(CASE WHEN v.pontuacao_estado='calculada' THEN v.pontuacao END)    AS min_pontuacao,
                MAX(CASE WHEN v.pontuacao_estado='calculada' THEN v.pontuacao END)    AS max_pontuacao,
                COUNT(DISTINCT v.analista_id)                                         AS num_analistas,
                COUNT(DISTINCT v.estabelecimento_id)                                  AS num_estabelecimentos
            FROM estudos e
            LEFT JOIN visitas v ON v.estudo_id = e.id
            WHERE e.id = :eid
            GROUP BY e.id, e.nome
        """), {"eid": estudo_id})).mappings().first()
        if not rows:
            return ""
        estado_rows = (await db.execute(text("""
            SELECT estado,
                   COUNT(*) as total,
                   ROUND(AVG(CASE WHEN pontuacao_estado='calculada' THEN pontuacao END)::numeric,1) as media,
                   ROUND(STDDEV(CASE WHEN pontuacao_estado='calculada' THEN pontuacao END)::numeric,2) as desvio
            FROM visitas WHERE estudo_id = :eid
            GROUP BY estado ORDER BY total DESC
        """), {"eid": estudo_id})).mappings().all()
        estados_str = "; ".join(
            f"{r['estado']}={r['total']} (média={r['media']}, desvio={r['desvio']})"
            for r in estado_rows
        )
        # Per tipo_visita stats
        tipo_rows = (await db.execute(text("""
            SELECT tipo_visita, COUNT(*) as total,
                   ROUND(AVG(CASE WHEN pontuacao_estado='calculada' THEN pontuacao END)::numeric,1) as media
            FROM visitas WHERE estudo_id = :eid AND tipo_visita IS NOT NULL
            GROUP BY tipo_visita ORDER BY total DESC
        """), {"eid": estudo_id})).mappings().all()
        tipos_str = "; ".join(
            f"{r['tipo_visita']}={r['total']} (média={r['media']})"
            for r in tipo_rows
        ) if tipo_rows else "n/d"
        # Grelhas configured for this study
        grelha_rows = (await db.execute(text("""
            SELECT g.id, g.nome, g.tipo_visita,
                   COUNT(DISTINCT s.id) as num_secoes,
                   COUNT(DISTINCT c.id) as num_criterios
            FROM grelhas g
            LEFT JOIN secoes_grelha s ON s.grelha_id = g.id
            LEFT JOIN criterios_grelha c ON c.grelha_id = g.id
            WHERE g.estudo_id = :eid
            GROUP BY g.id, g.nome, g.tipo_visita
            ORDER BY g.tipo_visita
        """), {"eid": estudo_id})).mappings().all()
        grelhas_str = "; ".join(
            f"id={r['id']} '{r['nome']}' ({r['tipo_visita']}, {r['num_secoes']} sec, {r['num_criterios']} crit)"
            for r in grelha_rows
        ) if grelha_rows else "nenhuma"
        return (
            f"\n\nCONTEXTO DO ESTUDO (id={estudo_id}, nome='{rows['estudo_nome']}'):\n"
            f"- Total visitas: {rows['total_visitas']} | Com pontuação: {rows['com_pontuacao']}\n"
            f"- Pontuação global: média={rows['media_pontuacao']}, desvio={rows['desvio_global']}, min={rows['min_pontuacao']}, max={rows['max_pontuacao']}\n"
            f"- Analistas: {rows['num_analistas']} | Estabelecimentos: {rows['num_estabelecimentos']}\n"
            f"- Por estado: {estados_str}\n"
            f"- Por tipo de visita (canal): {tipos_str}\n"
            f"- Grelhas de avaliação: {grelhas_str}\n"
            f"Usa buscar_dados para qualquer consulta mais detalhada dentro deste contexto."
        )
    except Exception:
        return ""


async def _prefetch_visit_ids(mensagem: str, db: AsyncSession) -> str | None:
    """Detect visit IDs in message, query DB and return JSON string of results.
    Returns None if no IDs found or no rows returned."""
    import json as _json
    ids_str = re.findall(r'\b(\d{3,6})\b', mensagem)
    if not ids_str:
        return None
    ids_int = list({int(i) for i in ids_str})
    id_list = ",".join(str(i) for i in ids_int)
    try:
        placeholders = ",".join(f":id{i}" for i in range(len(ids_int)))
        params = {f"id{i}": v for i, v in enumerate(ids_int)}
        result = await db.execute(text(
            f"SELECT v.id, v.estado, v.analista_id, "
            f"convert_from(a.nome,'UTF8') AS analista_nome, "
            f"convert_from(e.nome,'UTF8') AS estabelecimento_nome, "
            f"v.estudo_id, v.planeada_em, v.realizada_inicio "
            f"FROM visitas v "
            f"LEFT JOIN analistas a ON a.id=v.analista_id "
            f"LEFT JOIN estabelecimentos e ON e.id=v.estabelecimento_id "
            f"WHERE v.id IN ({placeholders})"
        ), params)
        rows = result.mappings().all()
        if rows:
            data = [{k: str(v) if not isinstance(v, (int, float, bool, type(None), str)) else v
                     for k, v in dict(r).items()} for r in rows]
            return _json.dumps(data, ensure_ascii=False)
    except Exception:
        pass
    return None


async def run_chat(
    mensagem: str,
    estudo_id: Optional[int],
    user: Utilizador,
    db: AsyncSession,
    historico: list[dict] | None = None,
) -> ChatResponse:
    """Run the Cognira conversational AI agent for a single user turn.

    Args:
        mensagem:   The user's current message in plain Portuguese.
        estudo_id:  Optional study filter — injected into the system context so the LLM
                    knows which study the user is navigating.
        user:       The authenticated Utilizador — used for permission gating (write tools
                    are only available to admin/coordenador) and name personalisation.
        db:         Async SQLAlchemy session — all SQL tool calls run through this.
        historico:  Optional list of {role, content} dicts from the current session
                    (last 12 turns are passed to the LLM as conversation history).

    Returns:
        ChatResponse with:
          - resposta:           the AI's answer, plain text, no markdown
          - sugestoes:          3 contextual follow-up question suggestions
          - logistica_preview:  populated (non-None) when a reassignment was requested;
                                the frontend should render a confirm card and POST to
                                /chat/logistica/executa to actually execute.
          - sql_executado:      not set here (only populated in legacy endpoints)

    Flow:
        1. Pre-fetch any visit IDs found in the message (avoids a round-trip tool call).
        2. Build system prompt: schema + glossary + user context + permission note.
        3. If IDs were pre-fetched → inject as a fake completed tool call so the LLM
           can narrate the results directly without another tool call.
        4. Otherwise run a tool-calling loop (max 5 iterations):
           - buscar_dados loop: chains up to 5 SELECT queries
           - write tools (reatribuir_visitas / reatribuir_analista_bulk) build and
             return a preview dict — no DB writes happen inside run_chat itself.
        5. After producing the final answer, calls _get_sugestoes to generate follow-ups.
    """
    if not client:
        return ChatResponse(resposta="Serviço de IA não configurado. Configure OPENAI_API_KEY.")

    ai_client = await _ai_client(db)

    is_privileged = user.role_global in ("admin", "coordenador")
    available_tools = _TOOLS_READ + (_TOOLS_WRITE if is_privileged else [])

    context_parts = [SYSTEM_PROMPT]

    # Personalisation: inject user's display name so LLM can use it occasionally
    context_parts.append(f"\nUtilizador actual: {user.username} (role: {user.role_global}).")

    if estudo_id:
        study_ctx = await _prefetch_study_stats(estudo_id, db)
        context_parts.append(f"Contexto: o utilizador está a ver o estudo_id={estudo_id}.{study_ctx}")
    if not is_privileged:
        context_parts.append("Nota: este utilizador não tem permissão para reatribuir visitas (apenas leitura).")

    import json as _json

    messages: list[dict] = [
        {"role": "system", "content": "\n".join(context_parts)},
    ]

    # Inject conversation history (last 12 turns, plain dicts)
    if historico:
        for item in historico[-12:]:
            role = item.get("role") if isinstance(item, dict) else getattr(item, "role", None)
            content = item.get("content") if isinstance(item, dict) else getattr(item, "content", "")
            if role in ("user", "assistant") and (content or "").strip():
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": mensagem})

    # ── Pre-fetch visit IDs ── inject as a completed tool call so LLM interprets naturally
    prefetch_json = await _prefetch_visit_ids(mensagem, db)
    if prefetch_json:
        fake_id = "call_prefetch_0"
        fake_sql = f"SELECT ... WHERE v.id IN (...) -- auto-prefetch"
        messages += [
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": fake_id,
                    "type": "function",
                    "function": {"name": "buscar_dados", "arguments": _json.dumps({"sql": fake_sql})},
                }],
            },
            {"role": "tool", "tool_call_id": fake_id, "content": prefetch_json},
        ]
        # LLM just needs to interpret the pre-fetched results — no more tool calls needed
        interpret = await ai_client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=messages,
            temperature=0,
        )
        final = interpret.choices[0].message.content or ""
        sugestoes = await _get_sugestoes(mensagem, final, estudo_id, historico)
        return ChatResponse(resposta=_clean(final), sugestoes=sugestoes)

    # ── 1st call (no pre-fetched data) ───────────────────────────────────
    # Always force at least one tool call so the LLM always consults the DB
    # before answering. For pure greetings, the LLM will call SELECT 1 and answer normally.
    _is_conversational = len(mensagem.strip()) < 25 and not any(
        kw in mensagem.lower() for kw in (
            "visit", "analista", "estudo", "pontuac", "estado", "estabelecimento",
            "variação", "variacao", "média", "media", "total", "quant", "list",
            "mostra", "qual", "quais", "como", "onde", "quando", "result", "dados",
        )
    )
    _tool_choice = "auto" if _is_conversational else "required"

    response = await ai_client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=messages,
        tools=available_tools,
        tool_choice=_tool_choice,
        temperature=0,
    )

    msg = response.choices[0].message

    # No tool call → direct conversational reply
    if not msg.tool_calls:
        sugestoes = await _get_sugestoes(mensagem, msg.content or "", estudo_id, historico)
        return ChatResponse(resposta=_clean(msg.content or ""), sugestoes=sugestoes)

    tool_call = msg.tool_calls[0]
    tool_name = tool_call.function.name
    tool_args = _json.loads(tool_call.function.arguments)

    # ── buscar_dados loop — allows chaining multiple lookups then write tools ──
    if tool_name == "buscar_dados":
        loop_messages = list(messages)
        current_tc = tool_call
        current_args = tool_args

        for _iter in range(5):  # max 5 chained tool calls
            sql = current_args.get("sql", "")
            _sql_upper = sql.strip().upper()
            _destructive = any(kw in _sql_upper for kw in ("DELETE ", "UPDATE ", "INSERT ", "DROP ", "TRUNCATE ", "ALTER ", "CREATE ", "GRANT ", "REVOKE "))
            if not _sql_upper.startswith("SELECT") or _destructive:
                tool_result = "Apenas queries SELECT são permitidas nesta ferramenta."
            else:
                try:
                    result = await db.execute(text(sql))
                    rows = result.mappings().all()[:100]
                    if rows:
                        tool_result = _json.dumps(
                            [{k: _decode_bytes(v) if isinstance(v, (bytes, bytearray)) else v for k, v in dict(r).items()} for r in rows],
                            ensure_ascii=False,
                            default=str,
                        )
                    else:
                        tool_result = "[]"
                except Exception as e:
                    tool_result = f"Erro na query: {str(e)}"

            # Append this tool call + result to history
            loop_messages += [
                {"role": "assistant", "content": None, "tool_calls": [current_tc.model_dump()]},
                {"role": "tool", "tool_call_id": current_tc.id, "content": tool_result},
            ]

            # Ask LLM what to do next — WITH tools so it can chain lookups or trigger write tools
            next_resp = await ai_client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=loop_messages,
                tools=available_tools,
                tool_choice="auto",
                temperature=0,
            )
            next_msg = next_resp.choices[0].message

            # No tool call → LLM gave a final conversational answer
            if not next_msg.tool_calls:
                final = next_msg.content or ""
                sugestoes = await _get_sugestoes(mensagem, final, estudo_id, historico)
                return ChatResponse(resposta=_clean(final), sugestoes=sugestoes)

            next_tc = next_msg.tool_calls[0]
            next_name = next_tc.function.name
            next_args = _json.loads(next_tc.function.arguments)

            if next_name == "buscar_dados":
                # Another lookup needed — continue loop
                current_tc = next_tc
                current_args = next_args
                continue
            else:
                # Write tool (reatribuir_visitas / reatribuir_analista_bulk) — fall through
                tool_call = next_tc
                tool_name = next_name
                tool_args = next_args
                break
        else:
            # Loop exhausted 5 iterations — return last tool result conversationally
            final = next_msg.content or tool_result
            sugestoes = await _get_sugestoes(mensagem, final, estudo_id, historico)
            return ChatResponse(resposta=_clean(final), sugestoes=sugestoes)

    # ── reatribuir_visitas (specific IDs) → mostra preview, não executa ──
    if tool_name == "reatribuir_visitas":
        if not is_privileged:
            return ChatResponse(resposta="Não tens permissão para reatribuir visitas.")
        visita_ids: list[int] = [int(i) for i in tool_args.get("visita_ids", [])]
        destino_id: int = int(tool_args["destino_analista_id"])

        if not visita_ids:
            return ChatResponse(resposta="Não foram especificadas visitas para reatribuir.")

        # Fetch destino analyst name
        dest_row = (
            await db.execute(
                text("SELECT convert_from(nome,'UTF8') AS nome FROM analistas WHERE id = :id"),
                {"id": destino_id},
            )
        ).mappings().first()
        dest_nome = dest_row["nome"] if dest_row else f"analista {destino_id}"

        # Fetch info about the visits to show in preview
        from sqlalchemy.sql import bindparam as bp
        sample_rows = (
            await db.execute(
                text(
                    "SELECT v.id, v.estado, e.nome AS estudo, est.nome AS estabelecimento, "
                    "convert_from(a.nome,'UTF8') AS analista_atual "
                    "FROM visitas v "
                    "JOIN estudos e ON e.id = v.estudo_id "
                    "JOIN estabelecimentos est ON est.id = v.estabelecimento_id "
                    "LEFT JOIN analistas a ON a.id = v.analista_id "
                    "WHERE v.id IN :ids"
                ).bindparams(bp("ids", expanding=True)),
                {"ids": tuple(visita_ids)},
            )
        ).mappings().all()

        # Derive the "origem" from the first visit's current analyst
        first = sample_rows[0] if sample_rows else None
        origem_nome = first["analista_atual"] if first else "analista actual"

        # Find origem analyst id (may differ per visit, use first)
        orig_row = (
            await db.execute(
                text(
                    "SELECT analista_id FROM visitas WHERE id = :vid LIMIT 1"
                ),
                {"vid": visita_ids[0]},
            )
        ).mappings().first()
        origem_id = int(orig_row["analista_id"]) if orig_row and orig_row["analista_id"] else 0

        preview = {
            "acao": f"Reatribuir {len(visita_ids)} visita(s)",
            "analista_origem_id": origem_id,
            "analista_origem_nome": origem_nome,
            "analista_destino_id": destino_id,
            "analista_destino_nome": dest_nome,
            "estudo_id": None,
            "visitas_count": len(visita_ids),
            "visita_ids": visita_ids,  # para o frontend passar ao /executa
            "visitas_sample": [
                {k: str(v) if isinstance(v, (bytes, bytearray)) else v for k, v in dict(r).items()}
                for r in sample_rows
            ],
        }

        resposta = (
            f"Vou reatribuir as {len(visita_ids)} visita(s) para {dest_nome}.\n\n"
            f"Confirma a operação abaixo para executar."
        )
        return ChatResponse(resposta=resposta, logistica_preview=preview)

    # ── reatribuir_analista_bulk → preview for frontend confirm card ──────
    if tool_name == "reatribuir_analista_bulk":
        if not is_privileged:
            return ChatResponse(resposta="Não tens permissão para reatribuir visitas.")
        origem_id = int(tool_args["origem_analista_id"])
        destino_id = int(tool_args["destino_analista_id"])
        opt_estudo = tool_args.get("estudo_id")

        preview = await _build_bulk_preview(origem_id, destino_id, opt_estudo, db)
        if "erro" in preview:
            return ChatResponse(resposta=f"Não consegui processar: {preview['erro']}")

        count = preview["visitas_count"]
        origem_nome = preview["analista_origem_nome"]
        destino_nome = preview["analista_destino_nome"]
        resposta = (
            f"Encontrei {count} visita(s) activa(s) do analista {origem_nome} "
            f"para reatribuir ao analista {destino_nome}.\n\n"
            f"Confirma a operação abaixo para executar."
        )
        return ChatResponse(resposta=resposta, logistica_preview=preview)

    # Fallback — unknown tool
    return ChatResponse(resposta="Não consegui processar o pedido.")


async def _get_sugestoes(mensagem: str, resposta: str, estudo_id: Optional[int], historico: list[dict] | None = None) -> list[str]:
    """Module 7: generate 3 proactive suggested follow-up questions."""
    try:
        from app.ai.intelligence import gerar_sugestoes_chat
        return await gerar_sugestoes_chat(mensagem, resposta, estudo_id, historico)
    except Exception:
        return []


def _decode_bytes(v: object) -> str:
    """Decode bytes field from SQL result — decrypts Fernet-encrypted PII fields."""
    if isinstance(v, (bytes, bytearray)):
        return pii.decrypt(bytes(v))
    return str(v) if v else ""


def _clean(text: str) -> str:
    """Strip markdown bold/italic markers from AI responses."""
    import re
    text = re.sub(r'\*{1,3}(.*?)\*{1,3}', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'_{1,2}(.*?)_{1,2}', r'\1', text, flags=re.DOTALL)
    return text


async def _build_bulk_preview(
    origem_id: int,
    destino_id: int,
    estudo_id: Optional[int],
    db: AsyncSession,
) -> dict:
    """Build a preview dict for bulk visit reassignment (IDs already known)."""
    from sqlalchemy import text as sqlt

    # Fetch analyst names
    a_rows = (
        await db.execute(
            sqlt("SELECT id, convert_from(nome,'UTF8') AS nome FROM analistas WHERE id IN :ids")
            .bindparams(bindparam("ids", expanding=True)),
            {"ids": (origem_id, destino_id)},
        )
    ).mappings().all()
    nome_map = {r["id"]: r["nome"] for r in a_rows}

    if origem_id not in nome_map:
        return {"erro": f"Analista de origem (id={origem_id}) não encontrado."}
    if destino_id not in nome_map:
        return {"erro": f"Analista de destino (id={destino_id}) não encontrado."}

    base_where = "v.analista_id = :fid AND v.estado NOT IN ('fechada', 'anulada')"
    params: dict = {"fid": origem_id}
    if estudo_id:
        base_where += " AND v.estudo_id = :eid"
        params["eid"] = estudo_id

    count_row = (
        await db.execute(sqlt(f"SELECT COUNT(*) AS cnt FROM visitas v WHERE {base_where}"), params)
    ).mappings().first()
    count = int(count_row["cnt"]) if count_row else 0

    sample_rows = (
        await db.execute(
            sqlt(
                f"""
                SELECT v.id, v.estado, e.nome AS estudo, est.nome AS estabelecimento
                FROM visitas v
                JOIN estudos e ON e.id = v.estudo_id
                JOIN estabelecimentos est ON est.id = v.estabelecimento_id
                WHERE {base_where}
                ORDER BY v.id DESC LIMIT 10
                """
            ),
            params,
        )
    ).mappings().all()

    return {
        "acao": f"Reatribuir {count} visitas",
        "analista_origem_id": origem_id,
        "analista_origem_nome": nome_map[origem_id],
        "analista_destino_id": destino_id,
        "analista_destino_nome": nome_map[destino_id],
        "estudo_id": estudo_id,
        "visitas_count": count,
        "visitas_sample": [
            {k: _decode_bytes(v) if isinstance(v, (bytes, bytearray)) else v for k, v in dict(r).items()}
            for r in sample_rows
        ],
    }


# ---------------------------------------------------------------------------
# Logistics — Visit Reassignment (legacy endpoints still used by chat router)
# ---------------------------------------------------------------------------

LOGISTICS_SYSTEM = """Analisa pedidos de reatribuição de visitas em mystery shopping.

Extrai APENAS um JSON válido com os campos:
{
  "from_analista": "<código externo OU nome do analista origem>",
  "to_analista": "<código externo OU nome do analista destino>",
  "estudo_id": <número inteiro OU null>,
  "visita_ids": null
}

Regras:
- Se o utilizador especifica um código (ex: A001, 10865), usa como from_analista / to_analista
- Se especifica um nome (ex: João Silva), usa o nome
- estudo_id é null a menos que o utilizador mencione explicitamente um estudo
- Responde SOMENTE com JSON, sem texto adicional
- Se faltarem dados essenciais, responde: {"erro": "descrição do problema"}
"""


async def run_logistica_preview(mensagem: str, db: AsyncSession) -> dict:
    """Parse a logistics command via GPT and return a preview of affected visits."""
    if not client:
        return {"erro": "Serviço de IA não configurado."}

    import json as _json
    ai_logi_client = client

    resp = await ai_logi_client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "system", "content": LOGISTICS_SYSTEM},
            {"role": "user", "content": mensagem},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    try:
        intent = _json.loads(resp.choices[0].message.content or "{}")
    except Exception:
        return {"erro": "Não consegui interpretar o pedido em JSON."}

    if "erro" in intent:
        return {"erro": intent["erro"]}

    from_str = str(intent.get("from_analista", "")).strip()
    to_str = str(intent.get("to_analista", "")).strip()
    estudo_id = intent.get("estudo_id")

    if not from_str or not to_str:
        return {"erro": "Não identifiquei analistas de origem e destino. Especifica os códigos ou nomes."}

    from sqlalchemy import text as sqlt

    from_row = (
        await db.execute(
            sqlt("SELECT id, nome FROM analistas WHERE codigo_externo = :c OR convert_from(nome, 'UTF8') ILIKE :n LIMIT 1"),
            {"c": from_str, "n": f"%{from_str}%"},
        )
    ).mappings().first()

    to_row = (
        await db.execute(
            sqlt("SELECT id, nome FROM analistas WHERE codigo_externo = :c OR convert_from(nome, 'UTF8') ILIKE :n LIMIT 1"),
            {"c": to_str, "n": f"%{to_str}%"},
        )
    ).mappings().first()

    if not from_row:
        return {"erro": f"Analista de origem '{from_str}' não encontrado."}
    if not to_row:
        return {"erro": f"Analista de destino '{to_str}' não encontrado."}

    base_where = "v.analista_id = :fid AND v.estado NOT IN ('fechada', 'anulada')"
    params: dict = {"fid": from_row["id"]}
    if estudo_id:
        base_where += " AND v.estudo_id = :eid"
        params["eid"] = estudo_id

    count_row = (
        await db.execute(
            sqlt(f"SELECT COUNT(*) AS cnt FROM visitas v WHERE {base_where}"),
            params,
        )
    ).mappings().first()
    count = int(count_row["cnt"]) if count_row else 0

    sample_rows = (
        await db.execute(
            sqlt(
                f"""
                SELECT v.id, v.estado, e.nome AS estudo, est.nome AS estabelecimento
                FROM visitas v
                JOIN estudos e ON e.id = v.estudo_id
                JOIN estabelecimentos est ON est.id = v.estabelecimento_id
                WHERE {base_where}
                ORDER BY v.id DESC
                LIMIT 10
                """
            ),
            params,
        )
    ).mappings().all()

    return {
        "acao": f"Reatribuir {count} visitas",
        "analista_origem_id": int(from_row["id"]),
        "analista_origem_nome": _decode_bytes(from_row["nome"]),
        "analista_destino_id": int(to_row["id"]),
        "analista_destino_nome": _decode_bytes(to_row["nome"]),
        "estudo_id": estudo_id,
        "visitas_count": count,
        "visitas_sample": [
            {k: _decode_bytes(v) if isinstance(v, (bytes, bytearray)) else v for k, v in dict(r).items()}
            for r in sample_rows
        ],
    }


async def run_logistica_execute(
    origem_id: int,
    destino_id: int,
    estudo_id: Optional[int],
    db: AsyncSession,
    visita_ids: Optional[list[int]] = None,
) -> dict:
    """Execute a parameterised visit reassignment.

    If visita_ids is provided, only those specific visits are updated.
    Otherwise, all active visits from origem_id are reassigned.
    """
    from sqlalchemy import text as sqlt
    from sqlalchemy.sql import bindparam as bp

    if visita_ids:
        stmt = sqlt(
            "UPDATE visitas SET analista_id = :destino "
            "WHERE id IN :ids AND estado NOT IN ('fechada','anulada')"
        ).bindparams(bp("ids", expanding=True))
        result = await db.execute(stmt, {"destino": destino_id, "ids": tuple(visita_ids)})
    else:
        params: dict = {"origem": origem_id, "destino": destino_id}
        extra = ""
        if estudo_id:
            extra = " AND estudo_id = :eid"
            params["eid"] = estudo_id
        result = await db.execute(
            sqlt(
                f"UPDATE visitas SET analista_id = :destino "
                f"WHERE analista_id = :origem AND estado NOT IN ('fechada', 'anulada'){extra}"
            ),
            params,
        )
    await db.commit()
    return {"alteradas": result.rowcount}
