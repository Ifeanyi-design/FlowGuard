"""SQLAlchemy models: users, accounts, transactions, beneficiaries, cases, risk_events, audit_logs."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

# JSON column that works on both SQLite and Postgres.
JSONType = SQLiteJSON().with_variant(SQLiteJSON(), "postgresql")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="customer")  # customer | officer
    device_id: Mapped[str] = mapped_column(String(100), default="device-treasure-1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(10), default="IN")  # IN | OUT
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="NGN")
    sender_name: Mapped[str] = mapped_column(String(100), default="")
    sender_risk: Mapped[str] = mapped_column(String(20), default="low")  # low | medium | high
    beneficiary_name: Mapped[str] = mapped_column(String(100), default="")
    beneficiary_risk: Mapped[str] = mapped_column(String(20), default="low")
    purpose: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending | verified | awaiting_review | approved | held | escalated | blocked | step_up
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="LOW")
    decision: Mapped[str] = mapped_column(String(20), default="PENDING")
    # PENDING | APPROVE | STEP_UP | HOLD | ESCALATE | BLOCK
    device_id: Mapped[str] = mapped_column(String(100), default="")
    is_new_device: Mapped[int] = mapped_column(Integer, default=0)
    is_rapid: Mapped[int] = mapped_column(Integer, default=0)
    sender_confirmed: Mapped[int] = mapped_column(Integer, default=0)
    reassessed: Mapped[int] = mapped_column(Integer, default=0)
    regulatory_hold: Mapped[int] = mapped_column(Integer, default=0)
    scenario: Mapped[str] = mapped_column(String(5), default="A")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    risk_flag: Mapped[str] = mapped_column(String(20), default="low")
    trusted: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), nullable=False, unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String(30), default="open")
    # open | awaiting_customer | awaiting_officer | approved | held | escalated | blocked | step_up | closed
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="LOW")
    verification_state: Mapped[str] = mapped_column(String(30), default="unverified")
    decision: Mapped[str] = mapped_column(String(20), default="PENDING")
    scenario: Mapped[str] = mapped_column(String(5), default="A")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), nullable=False, index=True
    )
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    factors: Mapped[list] = mapped_column(JSONType, default=list)
    recommended_action: Mapped[str] = mapped_column(String(20), default="STEP_UP")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("cases.id"), nullable=True, index=True)
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id"), nullable=True, index=True
    )
    actor: Mapped[str] = mapped_column(String(100), default="system")
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # optional free-text metadata column for simpler queries
    meta_text: Mapped[str] = mapped_column(Text, default="")
