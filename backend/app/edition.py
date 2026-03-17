"""
Cognira Edition Gating
======================
Controls which features are available based on the EDITION environment variable.

  EDITION=community   — free, self-hosted, open-source tier
  EDITION=pro         — full-featured commercial tier (default when unlicensed key present)

Set EDITION in your .env file. A valid COGNIRA_LICENSE_KEY overrides community → pro.

Community tier includes:
  - Studies (estudos), visits (visitas), questionnaires
  - Analyst management, basic reporting
  - File/photo uploads (no AI analysis)
  - Client portal (white-label branding disabled)
  - Single tenant, no multi-tenancy
  - Self-hosted only

Pro tier adds:
  - All 14 Cognira AI Modules (photo analysis, scoring, coaching, RAG, etc.)
  - Multi-tenancy & tenant isolation
  - White-label branding per tenant
  - API keys & webhooks
  - Advanced analytics (shelf audit, planogram, sentiment, word cloud)
  - SSO / SAML 2.0
  - Push notifications
  - Superadmin panel
"""

from __future__ import annotations
import os
import hashlib
import logging
from functools import lru_cache
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Features that require Pro edition
PRO_FEATURES: dict[str, str] = {
    # AI modules
    "ai_photo_analysis":      "Cognira AI Módulo 3 — Foto IA (GPT-4o Vision)",
    "ai_validation":          "Cognira AI Módulo 6 — Validação Assistida por IA",
    "ai_planning":            "Cognira AI Módulo 8 — Planeamento Automático de Visitas",
    "ai_scoring":             "Cognira AI Módulo 7 — Score Preditivo",
    "ai_coaching":            "Cognira AI Módulo 14 — Coaching IA",
    "ai_sentiment":           "Cognira AI Módulo 12 — Análise de Sentimento",
    "ai_wordcloud":           "Cognira AI Módulo 10 — Word Cloud",
    "ai_temporal":            "Cognira AI Módulo 11 — Comparativo Temporal",
    "ai_autoqc":              "Cognira AI Módulo 13 — Auto-QC",
    "ai_anomaly":             "Cognira AI Módulo 4 — Detecção de Anomalias",
    "ai_callcenter":          "Contact Center IA — Transcrição & Scoring",
    "ai_shelf_audit":         "Shelf Audit IA — Análise de Planograma",
    "ai_rag":                 "RAG — Pesquisa Semântica sobre Respostas",
    "ai_agent":               "Cognira AI Agent — Chat Conversacional",
    # Platform
    "multitenancy":           "Multi-tenancy & Isolamento de Tenant",
    "white_label":            "White-label Branding por Tenant",
    "api_keys":               "API Keys & Webhooks",
    "sso":                    "SSO / SAML 2.0",
    "push_notifications":     "Web Push Notifications",
    "superadmin":             "Painel Superadmin",
    "advanced_analytics":     "Analytics Avançado",
}


@lru_cache(maxsize=1)
def get_edition() -> str:
    """Return 'pro' or 'community' based on env vars."""
    edition = os.environ.get("EDITION", "community").lower().strip()
    license_key = os.environ.get("COGNIRA_LICENSE_KEY", "").strip()

    if license_key and _verify_license(license_key):
        return "pro"

    if edition == "pro":
        logger.warning(
            "EDITION=pro set without a valid COGNIRA_LICENSE_KEY. "
            "Please obtain a licence at me@otokura.online"
        )
        return "pro"  # honour the flag — trust operator

    return "community"


def is_pro() -> bool:
    return get_edition() == "pro"


def is_community() -> bool:
    return get_edition() == "community"


def require_pro(feature: str) -> None:
    """Raise HTTP 402 if the current edition doesn't include *feature*.

    Usage (in a router):
        from app.edition import require_pro
        require_pro("ai_photo_analysis")
    """
    if feature not in PRO_FEATURES:
        raise ValueError(f"Unknown feature key: {feature!r}")

    if not is_pro():
        label = PRO_FEATURES[feature]
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"'{label}' requires Cognira Pro edition. "
                "Upgrade at me@otokura.online or set EDITION=pro with a valid COGNIRA_LICENSE_KEY."
            ),
        )


def edition_info() -> dict:
    """Return a dict suitable for the /api/edition endpoint."""
    ed = get_edition()
    available = set(PRO_FEATURES.keys()) if ed == "pro" else set()
    locked = set(PRO_FEATURES.keys()) - available
    return {
        "edition": ed,
        "available_features": sorted(available),
        "locked_features": {k: PRO_FEATURES[k] for k in sorted(locked)},
    }


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

_LICENSE_SALT = "cognira-license-v1"


def _verify_license(key: str) -> bool:
    """
    Simple HMAC-based licence key verification.
    A real implementation would call a licensing server or verify a JWT.
    Replace this with your preferred licence validation logic.
    """
    try:
        # Key format: BASE_TOKEN:HMAC_HEX (split at last colon)
        *parts, hmac_hex = key.split(":")
        if not parts:
            return False
        token = ":".join(parts)
        secret = os.environ.get("LICENSE_SIGNING_KEY", "cognira-dev-signing-key")
        import hmac as _hmac
        expected = _hmac.new(
            secret.encode(), f"{_LICENSE_SALT}:{token}".encode(), hashlib.sha256
        ).hexdigest()
        return _hmac.compare_digest(expected, hmac_hex)
    except Exception:
        return False
