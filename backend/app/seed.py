"""Seed/demo data. `python -m app.seed` (re)creates tables + demo customer."""
from __future__ import annotations

from .database import Base, SessionLocal, engine
from .models import Account, Beneficiary, User

CUSTOMER = {"name": "Treasure", "email": "treasure@demo.bank", "role": "customer"}
OFFICER = {"name": "Ops Officer", "email": "officer@demo.bank", "role": "officer"}


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_columns()


def ensure_columns() -> None:
    """Add PRD columns to pre-existing demo databases (create_all skips them)."""
    from sqlalchemy import inspect, text

    wanted = [
        ("accounts", "normal_transaction_limit", "FLOAT DEFAULT 500000"),
        ("beneficiaries", "bank", "VARCHAR(100) DEFAULT 'Demo Bank'"),
        ("beneficiaries", "account_number_masked", "VARCHAR(20) DEFAULT '••••0000'"),
        ("cases", "resolution", "VARCHAR(50)"),
    ]
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    for table, col, ddl in wanted:
        if table not in existing_tables:
            continue
        names = {c["name"] for c in insp.get_columns(table)}
        if col not in names:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))


def seed() -> dict:
    from .models import AuditLog, Case, RiskEvent, Transaction

    db = SessionLocal()
    try:
        # Clean demo tables (keep schema).
        for m in (AuditLog, RiskEvent, Case, Transaction, Beneficiary, Account, User):
            db.query(m).delete()
        db.commit()

        customer = User(name=CUSTOMER["name"], email=CUSTOMER["email"], role="customer")
        officer = User(name=OFFICER["name"], email=OFFICER["email"], role="officer")
        db.add_all([customer, officer])
        db.flush()

        account = Account(
            user_id=customer.id, account_number="0123456789", balance=250_000, status="active",
            normal_transaction_limit=500_000,
        )
        db.add(account)
        db.flush()
        # Known beneficiary from history (trusted).
        db.add(Beneficiary(account_id=account.id, name="Mama Ngozi", trusted=1, risk_flag="low"))
        db.commit()
        return {"customer_id": customer.id, "officer_id": officer.id, "account_id": account.id}
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    ids = seed()
    print(f"Seeded: {ids}")
