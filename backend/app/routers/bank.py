"""Everyday-banking surface: dashboard summary + mock purchases.

Purchases (airtime/data/bills) are low-value simulated top-ups recorded as
SETTLED mock-ledger entries with an audit trail. Anything unusual still goes
through the full verification flow — convenience only where risk is low.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..audit import log
from ..database import get_db
from ..models import Account, Transaction, User
from ..schemas import TransactionOut
from .auth import mask_account
from .transactions import actor as resolve_actor

router = APIRouter(tags=["bank"])

ACTIONABLE = ("UNDER_REVIEW", "CUSTOMER_VERIFIED", "BENEFICIARY_SUBMITTED",
              "RISK_REASSESSED", "STEP_UP_REQUIRED", "AUTHORIZED")


def own_account(db: Session, user: User) -> Account:
    acct = db.query(Account).filter(Account.user_id == user.id).first()
    if acct is None:
        raise HTTPException(status_code=404, detail="No account for this user")
    return acct


@router.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db),
              x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = resolve_actor(db, x_user_id)
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer dashboard only")
    acct = own_account(db, user)
    recent = (db.query(Transaction).filter(Transaction.account_id == acct.id)
              .order_by(Transaction.id.desc()).limit(3).all())
    pend = (db.query(Transaction).filter(Transaction.account_id == acct.id,
                                          Transaction.status.in_(ACTIONABLE))
            .order_by(Transaction.id.desc()).first())
    pending = None
    if pend:
        from ..models import Case

        case = db.query(Case).filter(Case.transaction_id == pend.id).first()
        pending = {"transaction": TransactionOut.model_validate(pend).model_dump(),
                   "risk": {"score": pend.risk_score, "level": pend.risk_level},
                   "case_id": case.id if case else None}
    return {
        "user": {"id": user.id, "name": user.name},
        "account": {"id": acct.id, "number_masked": mask_account(acct.account_number),
                    "balance": acct.balance,
                    "normal_limit": acct.normal_transaction_limit or 500_000},
        "recent": [TransactionOut.model_validate(t).model_dump() for t in recent],
        "pending": pending,
    }


class TopupRequest(BaseModel):
    kind: str = Field(..., pattern="^(airtime|data|bill)$")
    amount: float = Field(..., gt=0, le=100_000)
    phone: str = Field(..., min_length=7, max_length=15)
    network: str = Field(default="MTN", max_length=20)


@router.post("/api/demo/topup")
def topup(body: TopupRequest, db: Session = Depends(get_db),
          x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = resolve_actor(db, x_user_id)
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Customer only")
    acct = own_account(db, user)
    if acct.balance < body.amount:
        raise HTTPException(status_code=422, detail="Insufficient demo balance")
    acct.balance -= body.amount
    txn = Transaction(
        account_id=acct.id, direction="OUT", amount=body.amount, currency="NGN",
        sender_name=user.name, beneficiary_name=f"{body.network} {body.phone}",
        purpose=f"{body.kind} purchase", status="SETTLED",
        risk_score=0, risk_level="LOW", decision="APPROVE", scenario="-",
    )
    db.add(txn)
    db.flush()
    log(db, action="topup_purchased", actor=user.name, transaction_id=txn.id,
        details={"kind": body.kind, "amount": body.amount, "to": body.phone,
                 "network": body.network, "balance": acct.balance})
    db.commit()
    return {"ok": True, "balance": acct.balance,
            "transaction": TransactionOut.model_validate(txn).model_dump()}
