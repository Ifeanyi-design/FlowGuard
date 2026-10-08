"""Case endpoints for customer + ops dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..audit import log
from ..database import get_db
from ..models import Account, Case, Transaction, User
from ..schemas import CaseDetail, CaseOut, RiskResult, TransactionOut

router = APIRouter(prefix="/api/cases", tags=["cases"])


def actor(db: Session, x_user_id: str | None) -> User:
    user = None
    if x_user_id:
        try:
            user = db.query(User).filter(User.id == int(x_user_id)).first()
        except ValueError:
            user = None
    if user is None:
        user = db.query(User).filter(User.role == "customer").first()
    if user is None:
        raise HTTPException(status_code=401, detail="Demo user not seeded")
    return user


@router.get("")
def list_cases(db: Session = Depends(get_db),
               x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    q = db.query(Case, Transaction, Account).join(
        Transaction, Transaction.id == Case.transaction_id).join(
        Account, Account.id == Transaction.account_id)
    if user.role == "customer":
        q = q.filter(Account.user_id == user.id)
    rows = q.order_by(Case.id.desc()).all()
    out = []
    for case, txn, acct in rows:
        owner = db.query(User).filter(User.id == acct.user_id).first()
        out.append({
            "case": CaseOut.model_validate(case).model_dump(),
            "transaction": TransactionOut.model_validate(txn).model_dump(),
            "customer": owner.name if owner else "?",
        })
    return {"cases": out}


@router.get("/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db),
             x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    from ..models import RiskEvent

    user = actor(db, x_user_id)
    case = db.query(Case).filter(Case.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    txn = db.query(Transaction).filter(Transaction.id == case.transaction_id).first()
    acct = db.query(Account).filter(Account.id == txn.account_id).first()
    if user.role == "customer" and acct.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your case")
    events = db.query(RiskEvent).filter(RiskEvent.case_id == case.id).order_by(RiskEvent.id.desc()).all()
    latest = events[0] if events else None
    risk = {"score": latest.score if latest else case.risk_score,
            "level": latest.level if latest else case.risk_level,
            "factors": latest.factors if latest else [],
            "recommended_action": latest.recommended_action if latest else case.decision}
    detail = CaseDetail(
        case=CaseOut.model_validate(case),
        transaction=TransactionOut.model_validate(txn),
        risk=RiskResult(**risk),
        verification={"sender_confirmed": bool(txn.sender_confirmed), "purpose": txn.purpose,
                      "beneficiary": txn.beneficiary_name, "reassessed": bool(txn.reassessed),
                      "state": case.verification_state},
        audit=[],
    ).model_dump()
    # Officer approve action (state-gated): only from awaiting_officer/step_up/open.
    detail["allowed_actions"] = officer_actions(case.status)
    return detail


def officer_actions(status: str) -> list[str]:
    if status in ("OPEN", "AWAITING_CUSTOMER", "AWAITING_OFFICER", "CUSTOMER_VERIFIED",
                  "BENEFICIARY_SUBMITTED", "RISK_REASSESSED", "STEP_UP_REQUIRED",
                  "UNDER_REVIEW", "AUTHORIZED", "ESCALATED"):
        return ["APPROVE", "ESCALATE", "BLOCK"]
    return []


@router.post("/{case_id}/officer-decision")
def officer_decision(case_id: int, body: dict, db: Session = Depends(get_db),
                     x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    """Ops dashboard APPROVE / ESCALATE / BLOCK buttons. Officer role required."""
    user = actor(db, x_user_id)
    if user.role not in ("officer", "admin"):
        raise HTTPException(status_code=403, detail="Officer role required")
    case = db.query(Case).filter(Case.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.status in ("SETTLED", "BLOCKED"):
        raise HTTPException(status_code=409, detail=f"Case already {case.status}")
    decision = str(body.get("decision", "")).upper()
    if decision not in ("APPROVE", "ESCALATE", "BLOCK"):
        raise HTTPException(status_code=422, detail="decision must be APPROVE|ESCALATE|BLOCK")
    txn = db.query(Transaction).filter(Transaction.id == case.transaction_id).first()
    if decision == "APPROVE":
        # ONLY the bank can approve: authorizing executes the (simulated) settlement.
        # Customer evidence and FlowGuard's recommendation never touch the ledger.
        from ..bank_adapter import get_adapter

        bank = get_adapter().authorize(f"TXN-{txn.id}", txn.amount, "APPROVE")
        txn.status, txn.decision = "SETTLED", "APPROVE"
        case.status, case.decision, case.resolution = "SETTLED", "APPROVE", "approved_settled"
        log(db, action="officer_approve", actor=user.name, case_id=case.id,
            transaction_id=txn.id, details={"decision": decision})
        log(db, action="authorization_decision", actor=user.name, case_id=case.id,
            transaction_id=txn.id, details={"decision": "APPROVE", "bank": bank})
        log(db, action="payment_settled_simulated", actor="system", case_id=case.id,
            transaction_id=txn.id, details={"bank": bank, "note": "No real money moved"})
    elif decision == "ESCALATE":
        txn.status, txn.decision = "ESCALATED", "ESCALATE"
        case.status, case.decision, case.resolution = "ESCALATED", "ESCALATE", "escalated"
        log(db, action="officer_escalate", actor=user.name, case_id=case.id,
            transaction_id=txn.id, details={"decision": decision})
    else:
        txn.status, txn.decision = "BLOCKED", "BLOCK"
        case.status, case.decision, case.resolution = "BLOCKED", "BLOCK", "blocked"
        log(db, action="officer_block", actor=user.name, case_id=case.id,
            transaction_id=txn.id, details={"decision": decision})
    db.commit()
    return {"ok": True, "decision": decision, "status": case.status}


@router.get("/{case_id}/audit")
def case_audit(case_id: int, db: Session = Depends(get_db),
               x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    from ..models import AuditLog

    user = actor(db, x_user_id)
    case = db.query(Case).filter(Case.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    rows = db.query(AuditLog).filter(AuditLog.case_id == case_id).order_by(AuditLog.id.asc()).all()
    return {"audit": [{"actor": r.actor, "action": r.action,
                       "timestamp": r.created_at.isoformat() if r.created_at else None,
                       "metadata": r.details} for r in rows]}
