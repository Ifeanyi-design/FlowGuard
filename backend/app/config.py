"""Centralised env configuration. No secrets in source."""
import os


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default)


DATABASE_URL: str = _get("DATABASE_URL", "sqlite:///./flowguard.db")
CORS_ORIGINS_RAW: str = _get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
ENV: str = _get("ENV", "local")


def cors_origins() -> list[str]:
    return [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()]
