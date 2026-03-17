"""Single source of truth for default nav item sets per role.

Mirrors ``DEFAULT_NAV`` in frontend/src/lib/navConfig.ts.
Both the ``configuracoes`` and ``auth`` routers import from here so that a nav
change only needs to be made in one place (plus the frontend counterpart).
"""

NAV_DEFAULTS: dict[str, list[str]] = {
    "admin":       ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","utilizadores","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","configuracoes","branding","mapa","sla","pesquisa","alertas","qrcodes","webhooks","audit","barcode","shelf-audit","planos","wizard","planograma"],
    "coordenador": ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","mapa","sla","pesquisa","alertas","qrcodes","barcode","shelf-audit","wizard","planograma"],
    "validador":   ["dashboard","estudos","visitas","mensagens","chat","chat-interno","callcenter","mapa","pesquisa"],
    "analista":    ["dashboard","visitas","mensagens","chat-interno","mapa","barcode","shelf-audit"],
    "cliente":     ["portal","portal-mapa","chat","benchmarking","relatorios","mensagens"],
}
