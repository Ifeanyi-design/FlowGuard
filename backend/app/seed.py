"""Seed/demo data. `python -m app.seed` (re)creates tables + demo customer."""
from __future__ import annotations

from .database import Base, SessionLocal, engine
from .models import Account, Beneficiary, User

CUSTOMER = {"name": "Treasure", "email": "treasure@demo.bank", "role": "customer"}
OFFICER = {"name": "Ops Officer", "email": "officer@demo.bank", "role": "officer"}


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


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
            user_id=customer.id, account_number="0123456789", balance=1_250_000, status="active"
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
