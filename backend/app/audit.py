"""Audit helper — every significant event creates an audit log row."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AuditLog


def log(
    db: Session,
    *,
    action: str,
    actor: str = "system",
    case_id: int | None = None,
    transaction_id: int | None = None,
    details: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        case_id=case_id,
        transaction_id=transaction_id,
        actor=actor,
        action=action,
        details=details or {},
        meta_text=str(details or {})[:2000],
    )
    db.add(entry)
    db.flush()
    return entry
