"""Business logic for visit analytics, fraud detection, and SLA monitoring.

Extracted from routers/visitas.py to keep the HTTP layer thin and these
functions independently testable.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, cast, text, Date as SADate
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import tenant_filter
from app.models.analyst import Analista
from app.models.client import Cliente
from app.models.establishment import Estabelecimento
from app.models.study import Estudo, Onda
from app.models.user import Utilizador
from app.models.visit import Visita
from app.services import pii


async def compute_visita_stats(
    db: AsyncSession,
    user: Utilizador,
    estudo_id: Optional[int] = None,
) -> dict:
    """Return total, per-state counts, and average score."""
    tid = tenant_filter(user)
    q = select(Visita.estado, func.count(Visita.id).label("cnt")).group_by(Visita.estado)
    if tid is not None:
        q = (
            q.join(Estudo, Visita.estudo_id == Estudo.id)
             .join(Cliente, Estudo.cliente_id == Cliente.id)
             .where(Cliente.tenant_id == tid)
        )
    if estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)
    result = await db.execute(q)
    por_estado = {row.estado: row.cnt for row in result.all()}

    q_avg = select(func.avg(Visita.pontuacao))
    if tid is not None:
        q_avg = (
            q_avg.join(Estudo, Visita.estudo_id == Estudo.id)
                 .join(Cliente, Estudo.cliente_id == Cliente.id)
                 .where(Cliente.tenant_id == tid)
        )
    if estudo_id:
        q_avg = q_avg.where(Visita.estudo_id == estudo_id)
    avg_val = (await db.execute(q_avg)).scalar_one_or_none()

    return {
        "total": sum(por_estado.values()),
        "por_estado": por_estado,
        "pontuacao_media": round(float(avg_val), 1) if avg_val else None,
    }


async def compute_visita_timeline(
    db: AsyncSession,
    user: Utilizador,
    days: int = 30,
    estudo_id: Optional[int] = None,
) -> list:
    """Return daily visit counts for the last *days* days."""
    tid = tenant_filter(user)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    q = (
        select(
            cast(Visita.inserida_em, SADate).label("dia"),
            func.count(Visita.id).label("total"),
        )
        .where(Visita.inserida_em >= cutoff)
        .group_by(cast(Visita.inserida_em, SADate))
        .order_by(cast(Visita.inserida_em, SADate))
    )
    if tid is not None:
        q = (
            q.join(Estudo, Visita.estudo_id == Estudo.id)
             .join(Cliente, Estudo.cliente_id == Cliente.id)
             .where(Cliente.tenant_id == tid)
        )
    if estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)
    result = await db.execute(q)
    return [{"dia": str(row.dia), "total": row.total} for row in result]


async def detect_fraude(
    db: AsyncSession,
    user: Utilizador,
    estudo_id: Optional[int] = None,
    min_intervalo_minutos: int = 30,
) -> dict:
    """Heuristic fraud/anomaly detection across visits.

    Returns flagged visits grouped by anomaly type:
    - **intervalo_suspeito**: same analista completes two visits at different
      establishments within ``min_intervalo_minutos``.
    - **foto_duplicada**: same photo filename uploaded in multiple visits by
      the same analista.
    - **pontuacao_perfeita**: visit with score == 100 submitted without a single
      correction (highly unusual).
    """
    alertas: list[dict] = []
    tid = tenant_filter(user)
    tenant_sql_1 = (
        "AND EXISTS (SELECT 1 FROM estudos e JOIN clientes c ON c.id = e.cliente_id"
        " WHERE e.id = v1.estudo_id AND c.tenant_id = :tid_fraude)"
        if tid is not None else ""
    )
    tenant_sql_2 = (
        "AND EXISTS (SELECT 1 FROM estudos e JOIN clientes c ON c.id = e.cliente_id"
        " WHERE e.id = v.estudo_id AND c.tenant_id = :tid_fraude)"
        if tid is not None else ""
    )

    # ─── 1. Speed violations ────────────────────────────────────────────
    estudo_filter_1 = "AND v1.estudo_id = :eid" if estudo_id else ""
    speed_sql = text(f"""
        SELECT
            v1.id      AS visita1_id,
            v2.id      AS visita2_id,
            v1.analista_id,
            v1.estabelecimento_id AS estab1_id,
            v2.estabelecimento_id AS estab2_id,
            ROUND(
                EXTRACT(EPOCH FROM (v2.realizada_inicio - v1.realizada_inicio)) / 60
            )::int AS intervalo_min
        FROM visitas v1
        JOIN visitas v2
            ON  v1.analista_id          = v2.analista_id
            AND v2.id                   > v1.id
            AND v2.realizada_inicio     > v1.realizada_inicio
            AND v2.realizada_inicio     < v1.realizada_inicio + INTERVAL '1 hour' * :threshold_h
            AND v2.estabelecimento_id  != v1.estabelecimento_id
        WHERE v1.analista_id        IS NOT NULL
          AND v1.realizada_inicio   IS NOT NULL
          AND v2.realizada_inicio   IS NOT NULL
          {estudo_filter_1}
          {tenant_sql_1}
        ORDER BY intervalo_min ASC
        LIMIT 100
    """)
    params: dict = {"threshold_h": min_intervalo_minutos / 60}
    if estudo_id:
        params["eid"] = estudo_id
    if tid is not None:
        params["tid_fraude"] = tid
    speed_rows = (await db.execute(speed_sql, params)).fetchall()

    analista_ids_speed = {r.analista_id for r in speed_rows}
    analista_map: dict[int, str] = {}
    if analista_ids_speed:
        res = await db.execute(select(Analista).where(Analista.id.in_(analista_ids_speed)))
        for a in res.scalars():
            raw = a.nome
            analista_map[a.id] = pii.decrypt(raw) if isinstance(raw, (bytes, bytearray)) else str(raw or "")

    for r in speed_rows:
        alertas.append({
            "tipo": "intervalo_suspeito",
            "severidade": "alta" if r.intervalo_min < 15 else "media",
            "descricao": f"Analista realizou 2 visitas em apenas {r.intervalo_min} min",
            "visita_id": r.visita1_id,
            "visita_id_b": r.visita2_id,
            "analista_id": r.analista_id,
            "analista_nome": analista_map.get(r.analista_id, "?"),
            "detalhe": {
                "visita_a": r.visita1_id,
                "visita_b": r.visita2_id,
                "intervalo_minutos": r.intervalo_min,
                "estabelecimento_a": r.estab1_id,
                "estabelecimento_b": r.estab2_id,
            },
        })

    # ─── 2. Duplicate photo filenames ───────────────────────────────────────
    estudo_filter_2 = "AND v.estudo_id = :eid2" if estudo_id else ""
    dup_sql = text(f"""
        SELECT
            fv.nome_ficheiro,
            v.analista_id,
            COUNT(DISTINCT v.id)           AS num_visitas,
            ARRAY_AGG(DISTINCT v.id ORDER BY v.id) AS visita_ids
        FROM fotos_visita fv
        JOIN visitas v ON v.id = fv.visita_id
        WHERE v.analista_id IS NOT NULL
          {estudo_filter_2}
          {tenant_sql_2}
        GROUP BY fv.nome_ficheiro, v.analista_id
        HAVING COUNT(DISTINCT v.id) > 1
        ORDER BY num_visitas DESC
        LIMIT 50
    """)
    dup_params: dict = {}
    if estudo_id:
        dup_params["eid2"] = estudo_id
    if tid is not None:
        dup_params["tid_fraude"] = tid
    dup_rows = (await db.execute(dup_sql, dup_params)).fetchall()

    analista_ids_dup = {r.analista_id for r in dup_rows}
    if analista_ids_dup - analista_ids_speed:
        res2 = await db.execute(
            select(Analista).where(Analista.id.in_(analista_ids_dup - analista_ids_speed))
        )
        for a in res2.scalars():
            raw = a.nome
            analista_map[a.id] = pii.decrypt(raw) if isinstance(raw, (bytes, bytearray)) else str(raw or "")

    for r in dup_rows:
        alertas.append({
            "tipo": "foto_duplicada",
            "severidade": "alta",
            "descricao": f"Foto '{r.nome_ficheiro}' reutilizada em {r.num_visitas} visitas",
            "visita_id": r.visita_ids[0],
            "analista_id": r.analista_id,
            "analista_nome": analista_map.get(r.analista_id, "?"),
            "detalhe": {
                "nome_ficheiro": r.nome_ficheiro,
                "num_visitas": r.num_visitas,
                "visita_ids": list(r.visita_ids),
            },
        })

    # ─── 3. Suspiciously perfect scores ──────────────────────────────────────
    perfect_q = (
        select(Visita)
        .where(
            Visita.pontuacao >= 99,
            Visita.pontuacao_estado != "nao_avaliada",
            Visita.estado.in_(["inserida", "validada", "fechada"]),
        )
    )
    if estudo_id:
        perfect_q = perfect_q.where(Visita.estudo_id == estudo_id)
    if tid is not None:
        perfect_q = (
            perfect_q
            .join(Estudo, Visita.estudo_id == Estudo.id)
            .join(Cliente, Estudo.cliente_id == Cliente.id)
            .where(Cliente.tenant_id == tid)
        )
    perfect_rows = (await db.execute(
        perfect_q.order_by(Visita.id.desc()).limit(30)
    )).scalars().all()

    analista_ids_perf = {v.analista_id for v in perfect_rows if v.analista_id}
    if analista_ids_perf - set(analista_map.keys()):
        res3 = await db.execute(
            select(Analista).where(Analista.id.in_(analista_ids_perf - set(analista_map.keys())))
        )
        for a in res3.scalars():
            raw = a.nome
            analista_map[a.id] = pii.decrypt(raw) if isinstance(raw, (bytes, bytearray)) else str(raw or "")

    for v in perfect_rows:
        alertas.append({
            "tipo": "pontuacao_perfeita",
            "severidade": "baixa",
            "descricao": f"Pontuação de {v.pontuacao:.0f}/100 — verificar validade",
            "visita_id": v.id,
            "analista_id": v.analista_id,
            "analista_nome": analista_map.get(v.analista_id, "?") if v.analista_id else "—",
            "detalhe": {"pontuacao": v.pontuacao, "estado": v.estado},
        })

    return {"total": len(alertas), "alertas": alertas}


async def compute_visita_sla(
    db: AsyncSession,
    user: Utilizador,
    estudo_id: Optional[int] = None,
) -> dict:
    """SLA monitoring: return visits stuck beyond per-client or global thresholds."""
    tid = tenant_filter(user)

    DEFAULT_THRESHOLDS = {
        "planeada": 2,
        "inserida": 3,
        "corrigir": 2,
        "corrigir_email": 2,
    }
    STATES = list(DEFAULT_THRESHOLDS.keys())

    # Load per-client thresholds
    estudos_q = select(Estudo, Cliente).join(Cliente, Estudo.cliente_id == Cliente.id)
    if tid is not None:
        estudos_q = estudos_q.where(Cliente.tenant_id == tid)
    if estudo_id:
        estudos_q = estudos_q.where(Estudo.id == estudo_id)
    estudos_rows = (await db.execute(estudos_q)).all()
    estudo_thresholds: dict[int, dict[str, int]] = {}
    for estudo_obj, cliente_obj in estudos_rows:
        v_dias = cliente_obj.sla_visita_dias or DEFAULT_THRESHOLDS["planeada"]
        val_dias = cliente_obj.sla_validacao_dias or DEFAULT_THRESHOLDS["inserida"]
        estudo_thresholds[estudo_obj.id] = {
            "planeada": v_dias,
            "inserida": val_dias,
            "corrigir": val_dias,
            "corrigir_email": val_dias,
        }

    now = datetime.now(timezone.utc)
    q = (
        select(Visita)
        .where(Visita.estado.in_(STATES))
        .order_by(Visita.id.desc())
        .limit(500)
    )
    if tid is not None:
        q = (
            q.join(Estudo, Visita.estudo_id == Estudo.id)
             .join(Cliente, Estudo.cliente_id == Cliente.id)
             .where(Cliente.tenant_id == tid)
        )
    if estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)
    visitas_list = (await db.execute(q)).scalars().all()

    estab_ids = {v.estabelecimento_id for v in visitas_list}
    estab_map: dict[int, str] = {}
    if estab_ids:
        res = await db.execute(select(Estabelecimento).where(Estabelecimento.id.in_(estab_ids)))
        estab_map = {e.id: e.nome for e in res.scalars()}

    analista_ids = {v.analista_id for v in visitas_list if v.analista_id}
    analista_map: dict[int, str] = {}
    if analista_ids:
        res2 = await db.execute(select(Analista).where(Analista.id.in_(analista_ids)))
        for a in res2.scalars():
            raw = a.nome
            analista_map[a.id] = pii.decrypt(raw) if isinstance(raw, (bytes, bytearray)) else str(raw or "")

    alerts: list[dict] = []
    summary: dict[str, int] = {s: 0 for s in STATES}

    for v in visitas_list:
        if v.estado == "planeada" and v.planeada_em:
            ref = v.planeada_em
        elif v.estado in ("inserida", "corrigir", "corrigir_email") and v.inserida_em:
            ref = v.inserida_em
        else:
            continue

        if ref.tzinfo is None:
            ref = ref.replace(tzinfo=timezone.utc)

        days_elapsed = (now - ref).total_seconds() / 86400
        t = estudo_thresholds.get(v.estudo_id, DEFAULT_THRESHOLDS)
        threshold = t.get(v.estado, DEFAULT_THRESHOLDS.get(v.estado, 2))

        if days_elapsed > threshold:
            summary[v.estado] = summary.get(v.estado, 0) + 1
            alerts.append({
                "visita_id": v.id,
                "estado": v.estado,
                "days_elapsed": round(days_elapsed, 1),
                "threshold_days": threshold,
                "estabelecimento": estab_map.get(v.estabelecimento_id, "?"),
                "estabelecimento_id": v.estabelecimento_id,
                "analista_nome": analista_map.get(v.analista_id) if v.analista_id else "—",
                "analista_id": v.analista_id,
                "estudo_id": v.estudo_id,
                "ref_data": ref.isoformat(),
            })

    alerts.sort(key=lambda x: -x["days_elapsed"])
    return {
        "total_alerts": len(alerts),
        "thresholds": DEFAULT_THRESHOLDS,
        "summary": summary,
        "alerts": alerts,
    }
