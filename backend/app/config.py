from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Postgres
    database_url: str = "postgresql+asyncpg://emercado:secret@postgres:5432/estudos_mercado"

    # JWT
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7

    # OpenAI
    openai_api_key: str = ""

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin"
    minio_bucket: str = "estudos-mercado"
    minio_secure: bool = False
    # Public-facing base URL for MinIO (e.g. https://app.example.com/storage)
    # When set, presigned URLs are rewritten to use this origin instead of the
    # internal Docker hostname (minio:9000) so browsers can reach them.
    minio_public_url: str = ""

    # ClamAV
    clamav_host: str = "clamav"
    clamav_port: int = 3310

    # SMTP
    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"

    # PII encryption (Fernet key — generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    pii_key: str = "CHANGE_ME_generate_with_fernet"  # MUST be set in production — generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # Frontend
    frontend_url: str = "http://localhost:3000"

    # SSO / OIDC (works with Authentik, Keycloak, Azure AD, Google, etc.)
    sso_enabled: bool = False
    sso_provider_name: str = "SSO"            # Label shown on the login button
    sso_client_id: str = ""
    sso_client_secret: str = ""
    sso_auth_url: str = ""                    # e.g. https://auth.example.com/application/o/authorize/
    sso_token_url: str = ""                   # e.g. https://auth.example.com/application/o/token/
    sso_userinfo_url: str = ""                # e.g. https://auth.example.com/application/o/userinfo/
    sso_redirect_uri: str = ""                # e.g. https://app.example.com/api/auth/sso/callback
    sso_scopes: str = "openid email profile"
    # Default role assigned to new users created via SSO
    sso_default_role: str = "utilizador"

    # SAML 2.0 Service Provider (python3-saml / OneLogin toolkit)
    # Requires SAML_ENABLED=true and IdP metadata from your identity provider.
    saml_enabled: bool = False
    saml_idp_entity_id: str = ""        # IdP EntityID URI
    saml_idp_sso_url: str = ""          # IdP SSO URL (POST or Redirect binding)
    saml_idp_slo_url: str = ""          # IdP SLO URL (optional)
    saml_idp_cert: str = ""             # IdP X.509 certificate (PEM, no headers)
    saml_sp_entity_id: str = ""         # SP EntityID, e.g. https://app.q21.io/api/auth/saml/metadata
    saml_sp_acs_url: str = ""           # ACS URL, e.g. https://app.q21.io/api/auth/saml/acs
    saml_sp_slo_url: str = ""           # SP SLO URL (optional)
    saml_sp_cert: str = ""              # SP X.509 cert (PEM, no headers; optional, for signed requests)
    saml_sp_key: str = ""               # SP private key (PEM, no headers; optional)
    saml_default_role: str = "utilizador"  # Role assigned to new SAML users

    # Web Push / VAPID (generate with: python3 -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print('private:', v.private_key); print('public:', v.public_key)")
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_email: str = "mailto:admin@example.com"

    # WebRTC TURN server (coturn)
    # Set TURN_HOST to your server's public IP/domain; TURN_SECRET must match docker-compose
    turn_host: str = ""
    turn_secret: str = "changeme-turn-secret-replace-in-prod"

    # Edition / licensing
    edition: str = "community"           # "community" or "pro"
    cognira_license_key: str = ""        # Set to unlock Pro features
    license_signing_key: str = "cognira-dev-signing-key"  # Override in prod

    # Error tracking
    sentry_dsn: str = ""

    # Stripe billing
    stripe_secret_key: str = ""              # sk_live_... or sk_test_...
    stripe_webhook_secret: str = ""          # whsec_... from Stripe Dashboard
    stripe_price_starter: str = ""           # price_... for Starter plan
    stripe_price_professional: str = ""      # price_... for Professional plan
    stripe_price_enterprise: str = ""        # price_... for Enterprise plan

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
