"""Unit tests for app/nav_defaults.py and navConfig-equivalent logic.

These are pure-Python tests — no DB, no HTTP client required.
"""
import pytest

from app.nav_defaults import NAV_DEFAULTS


# ── NAV_DEFAULTS structure ─────────────────────────────────────────────────────

def test_nav_defaults_has_required_roles() -> None:
    required = {"admin", "coordenador", "validador", "analista", "cliente"}
    assert required.issubset(set(NAV_DEFAULTS.keys()))


def test_admin_can_see_configuracoes() -> None:
    assert "configuracoes" in NAV_DEFAULTS["admin"]


def test_admin_can_see_utilizadores() -> None:
    assert "utilizadores" in NAV_DEFAULTS["admin"]


def test_analista_cannot_see_utilizadores() -> None:
    assert "utilizadores" not in NAV_DEFAULTS["analista"]


def test_analista_cannot_see_configuracoes() -> None:
    assert "configuracoes" not in NAV_DEFAULTS["analista"]


def test_cliente_sees_portal() -> None:
    assert "portal" in NAV_DEFAULTS["cliente"]


def test_cliente_cannot_administer() -> None:
    for restricted in ("utilizadores", "configuracoes", "audit", "planos"):
        assert restricted not in NAV_DEFAULTS["cliente"], f"cliente should not see {restricted}"


def test_coordenador_sees_visitas() -> None:
    assert "visitas" in NAV_DEFAULTS["coordenador"]


def test_validador_cannot_manage_analistas() -> None:
    assert "analistas" not in NAV_DEFAULTS["validador"]


def test_all_nav_items_are_strings() -> None:
    for role, items in NAV_DEFAULTS.items():
        for item in items:
            assert isinstance(item, str), f"Item {item!r} in role {role!r} is not a string"


def test_no_duplicate_items_per_role() -> None:
    for role, items in NAV_DEFAULTS.items():
        assert len(items) == len(set(items)), f"Duplicate nav items found for role {role!r}"


def test_admin_is_superset_of_analista() -> None:
    analista_items = set(NAV_DEFAULTS["analista"])
    admin_items = set(NAV_DEFAULTS["admin"])
    missing = analista_items - admin_items
    assert not missing, f"admin is missing items that analista has: {missing}"


def test_admin_is_superset_of_validador() -> None:
    validador_items = set(NAV_DEFAULTS["validador"])
    admin_items = set(NAV_DEFAULTS["admin"])
    missing = validador_items - admin_items
    assert not missing, f"admin is missing items that validador has: {missing}"
