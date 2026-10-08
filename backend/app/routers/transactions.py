"""Transaction workflow endpoints. Backend owns all risk/decision/state."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import policy_engine, risk_engine
from ..audit import log
from ..bank_adapter import get_adapter
from ..database import get_db
from ..models import Account, Beneficiary, Case, RiskEvent, Transaction, User
from ..schemas import (
    BeneficiaryRequest,
    DecisionOut,
    IdentityConfirmRequest,
    IncomingRequest,
    PurposeRequest,
    RiskResult,
    TransactionOut,
    VerifyRequest,
)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])

LARGEST_HISTORY = 500_000
HIGH_RISK_NAMES = ("ghost", "shell", "crypto", "mule", "unknown", "dark")


def actor(db: Session, x_user_id: str | None) -> User:
    user: User | None = None
    if x_user_id:
        try:
            user = db.query(User).filter(User.id == int(x_user_id)).first()
        except ValueError:
            user = None
    if user is None:
        user = db.query(User).filter(User.role == "customer").first()
    if user is None:
        raise HTTPException(status_code=401, detail="Demo user not seeded. POST /api/demo/reset first.")
    return user


def require_owner(db: Session, user: User, txn: Transaction) -> Account:
    acct = db.query(Account).filter(Account.id == txn.account_id).first()
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.role == "customer" and acct.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your transaction")
    return acct


def scenario_flags(scenario: str) -> dict:
    s = (scenario or "A").upper()
    base = {
        "sender_risk": "low",
        "is_known_sender": True,
        "is_new_device": False,
        "is_rapid_outgoing": False,
        "beneficiary_risk": "low",
    }
    if s == "B":
        base.update(sender_risk="high", is_known_sender=False, is_new_device=True)
    elif s == "C":
        base.update(sender_risk="medium", beneficiary_risk="high")
    elif s == "D":
        base.update(
            sender_risk="medium",
            is_known_sender=False,
            is_rapid_outgoing=True,
            beneficiary_risk="medium",
        )
    elif s == "E":
        base.update(sender_risk="medium", is_known_sender=False, is_new_device=True)
    return base


def build_context(txn: Transaction, flags: dict, beneficiary_trusted: bool = False) -> dict:
    return {
        "amount": txn.amount,
        "largest_history": LARGEST_HISTORY,
        "is_new_beneficiary": bool(txn.beneficiary_name) and not beneficiary_trusted,
        "is_new_device": bool(txn.is_new_device),
        "is_rapid_outgoing": bool(txn.is_rapid),
        "sender_risk": flags.get("sender_risk", txn.sender_risk),
        "is_known_sender": flags.get("is_known_sender", False),
        "is_trusted_device": not bool(txn.is_new_device),
        "is_expected_transaction": bool(txn.sender_confirmed and txn.purpose),
        "is_known_beneficiary": beneficiary_trusted,
        "beneficiary_risk": txn.beneficiary_risk or "low",
    }


def to_risk(result: dict) -> RiskResult:
    return RiskResult(
        score=result["score"],
        level=result["level"],
        factors=result["factors"],
        recommended_action=result["recommended_action"],
    )


def get_txn(db: Session, txn_id: int) -> Transaction:
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


def get_case(db: Session, txn_id: int) -> Case:
    case = db.query(Case).filter(Case.transaction_id == txn_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.post("/incoming")
def incoming(
    body: IncomingRequest,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = actor(db, x_user_id)
    acct = db.query(Account).filter(Account.user_id == user.id).first()
    if acct is None and user.role == "officer":
        acct = db.query(Account).first()
    if acct is None:
        raise HTTPException(status_code=404, detail="No account for demo user")
    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive")

    flags = scenario_flags(body.scenario)
    device = body.device_id or user.device_id
    is_new_device = 1 if (flags["is_new_device"] or device != user.device_id) else 0
    txn = Transaction(
        account_id=acct.id,
        direction="IN",
        amount=body.amount,
        currency="NGN",
        sender_name=body.sender_name,
        sender_risk=flags["sender_risk"],
        status="awaiting_review",
        device_id=device,
        is_new_device=is_new_device,
        is_rapid=1 if flags["is_rapid_outgoing"] else 0,
        scenario=body.scenario.upper(),
    )
    db.add(txn)
    db.flush()

    try:
        result = risk_engine.assess(build_context(txn, flags))
    except Exception as exc:  # fail-safe: never auto-approve
        result = {"score": 100, "level": "CRITICAL", "factors": [], "recommended_action": "ESCALATE"}
        log(db, action="risk_engine_failed", actor="system", transaction_id=txn.id,
            details={"error": str(exc)})
    txn.risk_score, txn.risk_level = result["score"], result["level"]
    case = Case(
        transaction_id=txn.id,
        status="open",
        risk_score=result["score"],
        risk_level=result["level"],
        verification_state="unverified",
        scenario=txn.scenario,
    )
    db.add(case)
    db.flush()
    db.add(RiskEvent(transaction_id=txn.id, case_id=case.id, score=result["score"],
                      level=result["level"], factors=result["factors"],
                      recommended_action=result["recommended_action"]))
    log(db, action="transaction_received", actor="system", case_id=case.id,
        transaction_id=txn.id, details={"sender": txn.sender_name, "amount": txn.amount})
    log(db, action="risk_triggered", actor="system", case_id=case.id,
        transaction_id=txn.id, details={"score": result["score"], "level": result["level"]})
    db.commit()
    db.refresh(txn)
    return {
        "transaction": TransactionOut.model_validate(txn).model_dump(),
        "risk": result,
        "case_id": case.id,
        "unusual": txn.amount >= LARGEST_HISTORY * 1.5,
    }


@router.get("/{txn_id}")
def get_transaction(txn_id: int, db: Session = Depends(get_db),
                    x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = db.query(Case).filter(Case.transaction_id == txn.id).first()
    events = db.query(RiskEvent).filter(RiskEvent.transaction_id == txn.id).order_by(RiskEvent.id.desc()).all()
    risk = None
    if events:
        e = events[0]
        risk = {"score": e.score, "level": e.level, "factors": e.factors,
                "recommended_action": e.recommended_action}
    return {"transaction": TransactionOut.model_validate(txn).model_dump(),
            "case_id": case.id if case else None, "risk": risk,
            "verification_state": case.verification_state if case else "unverified"}


DEMO_CODE_SALT = 7919  # demo-only derivation, see demo_code()


def demo_code(txn_id: int) -> str:
    """Deterministic demo OTP so the prototype needs no SMS gateway or storage.

    PROTOTYPE ONLY — production must use random single-use codes delivered
    out-of-band (SMS/authenticator), rate-limited, expiring, and NEVER
    returned by the API. The code is deterministic here purely so a reviewer
    can complete the flow without infrastructure.
    """
    return f"{(txn_id * DEMO_CODE_SALT) % 1_000_000:06d}"


@router.post("/{txn_id}/identity")
def identity_start(txn_id: int, db: Session = Depends(get_db),
                   x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    """Step 1 of customer verification: prove YOU are the account holder.

    Issues the demo one-time code (shown on screen only because this is a
    prototype). Must be confirmed via /identity/confirm before the sender
    can be confirmed and before anything can be authorized.
    """
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    log(db, action="identity_code_issued", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"channel": "SMS •• •• 4567 (demo)"})
    db.commit()
    return {"ok": True, "channel": "SMS •• •• 4567 (demo)", "code": demo_code(txn.id),
            "note": "Prototype: code is displayed here. Production delivers it out-of-band."}


@router.post("/{txn_id}/identity/confirm")
def identity_confirm(txn_id: int, body: IdentityConfirmRequest, db: Session = Depends(get_db),
                     x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    if body.code.strip() != demo_code(txn.id):
        log(db, action="identity_failed", actor=user.name, case_id=case.id,
            transaction_id=txn.id, details={"reason": "incorrect code"})
        db.commit()
        raise HTTPException(status_code=422, detail="Incorrect code — check and try again")
    case.verification_state = "identity_verified"
    case.status = "awaiting_customer"
    log(db, action="identity_verified", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"method": "demo OTP"})
    db.commit()
    return {"ok": True, "verification_state": case.verification_state}


@router.post("/{txn_id}/verify")
def verify(txn_id: int, body: VerifyRequest, db: Session = Depends(get_db),
           x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    if not txn.sender_confirmed and case.verification_state not in ("identity_verified", "sender_confirmed"):
        raise HTTPException(status_code=409, detail="Complete the identity check first")
    txn.sender_confirmed = 1 if body.confirm_sender else 0
    if body.confirm_sender:
        txn.status = "verified"
    case.verification_state = "sender_confirmed" if body.confirm_sender else "sender_disputed"
    if body.confirm_sender:
        case.status = "awaiting_customer"
    log(db, action="customer_verified" if body.confirm_sender else "sender_disputed",
        actor=user.name, case_id=case.id, transaction_id=txn.id,
        details={"confirm_sender": body.confirm_sender, "expected": body.expected})
    db.commit()
    return {"ok": True, "verification_state": case.verification_state}


@router.post("/{txn_id}/purpose")
def set_purpose(txn_id: int, body: PurposeRequest, db: Session = Depends(get_db),
                x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    allowed = ["Debt repayment", "Family support", "Business payment", "Savings", "Other"]
    if body.purpose not in allowed:
        raise HTTPException(status_code=422, detail=f"Purpose must be one of: {', '.join(allowed)}")
    txn.purpose = body.purpose
    log(db, action="purpose_selected", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"purpose": body.purpose})
    db.commit()
    return {"ok": True, "purpose": txn.purpose}


@router.post("/{txn_id}/beneficiary")
def set_beneficiary(txn_id: int, body: BeneficiaryRequest, db: Session = Depends(get_db),
                    x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    name = body.beneficiary_name.strip()
    existing = db.query(Beneficiary).filter(
        Beneficiary.account_id == txn.account_id,
        Beneficiary.name.ilike(name)).first()
    flags = scenario_flags(txn.scenario)
    if existing and existing.trusted:
        txn.beneficiary_risk = "low"
    elif name.lower() == "mama ngozi":
        txn.beneficiary_risk = "low"
    elif any(k in name.lower() for k in HIGH_RISK_NAMES) or flags["beneficiary_risk"] == "high":
        # Scenario C forces high risk for the demo beneficiary; name heuristics back it up.
        txn.beneficiary_risk = "high" if (flags["beneficiary_risk"] == "high" or
                                          any(k in name.lower() for k in HIGH_RISK_NAMES)) else flags["beneficiary_risk"]
    else:
        txn.beneficiary_risk = flags["beneficiary_risk"]
    txn.beneficiary_name = name
    if existing is None:
        db.add(Beneficiary(account_id=txn.account_id, name=name,
                            risk_flag=txn.beneficiary_risk, trusted=0))
    log(db, action="beneficiary_submitted", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"beneficiary": name, "beneficiary_risk": txn.beneficiary_risk})
    db.commit()
    return {"ok": True, "beneficiary": name, "beneficiary_risk": txn.beneficiary_risk}


@router.post("/{txn_id}/reassess")
def reassess(txn_id: int, db: Session = Depends(get_db),
             x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    flags = scenario_flags(txn.scenario)
    trusted_ben = db.query(Beneficiary).filter(
        Beneficiary.account_id == txn.account_id,
        Beneficiary.name.ilike(txn.beneficiary_name or "__none__"),
        Beneficiary.trusted == 1).first() is not None
    try:
        result = risk_engine.assess(build_context(txn, flags, trusted_ben))
        failed = False
    except Exception as exc:
        result = {"score": 100, "level": "CRITICAL", "factors": [], "recommended_action": "ESCALATE"}
        failed = True
        log(db, action="risk_engine_failed", actor="system", case_id=case.id,
            transaction_id=txn.id, details={"error": str(exc)})
    policy = policy_engine.failsafe("reassessment error") if failed else policy_engine.decide(
        result,
        {"regulatory_hold": bool(txn.regulatory_hold), "is_rapid_outgoing": bool(txn.is_rapid),
         "sender_confirmed": bool(txn.sender_confirmed), "purpose": txn.purpose,
         "beneficiary_name": txn.beneficiary_name, "reassessed": True},
    )
    txn.risk_score, txn.risk_level, txn.reassessed = result["score"], result["level"], 1
    case.risk_score, case.risk_level, case.decision = result["score"], result["level"], policy["decision"]
    case.status = {"APPROVE": "awaiting_officer", "STEP_UP": "step_up",
                   "HOLD": "held", "ESCALATE": "escalated", "BLOCK": "blocked"}[policy["decision"]]
    db.add(RiskEvent(transaction_id=txn.id, case_id=case.id, score=result["score"],
                     level=result["level"], factors=result["factors"],
                     recommended_action=result["recommended_action"]))
    log(db, action="risk_reassessed", actor=user.name, case_id=case.id, transaction_id=txn.id,
        details={"score": result["score"], "level": result["level"],
                 "suggested": policy["decision"], "reason": policy["reason"]})
    db.commit()
    return {"risk": result, "suggested_decision": policy["decision"], "reason": policy["reason"]}


def _finalize_authorize(db: Session, txn: Transaction, case: Case, user: User) -> dict:
    if txn.decision in ("APPROVE", "BLOCK") and txn.status in ("approved", "blocked"):
        result = {"score": txn.risk_score, "level": txn.risk_level, "factors": [],
                  "recommended_action": txn.decision}
        return {"decision": txn.decision, "reason": "Idempotent replay — already decided.",
                "risk": result, "transaction": TransactionOut.model_validate(txn).model_dump(),
                "case_status": case.status, "bank": {}}
    if not (txn.sender_confirmed and txn.purpose and txn.beneficiary_name and txn.reassessed):
        raise HTTPException(status_code=409,
                            detail="Complete verification, purpose, beneficiary and reassessment first")
    flags = scenario_flags(txn.scenario)
    trusted_ben = db.query(Beneficiary).filter(
        Beneficiary.account_id == txn.account_id,
        Beneficiary.name.ilike(txn.beneficiary_name or "__none__"),
        Beneficiary.trusted == 1).first() is not None
    try:
        result = risk_engine.assess(build_context(txn, flags, trusted_ben))
        policy = policy_engine.decide(
            result,
            {"regulatory_hold": bool(txn.regulatory_hold), "is_rapid_outgoing": bool(txn.is_rapid),
             "sender_confirmed": bool(txn.sender_confirmed), "purpose": txn.purpose,
             "beneficiary_name": txn.beneficiary_name, "reassessed": True},
        )
    except Exception as exc:
        result = {"score": 100, "level": "CRITICAL", "factors": [], "recommended_action": "ESCALATE"}
        policy = policy_engine.failsafe(str(exc))
    bank = get_adapter().authorize(f"TXN-{txn.id}", txn.amount, policy["decision"])
    txn.risk_score, txn.risk_level, txn.decision = result["score"], result["level"], policy["decision"]
    txn.status = {"APPROVE": "approved", "STEP_UP": "step_up", "HOLD": "held",
                  "ESCALATE": "escalated", "BLOCK": "blocked"}[policy["decision"]]
    case.risk_score, case.risk_level, case.decision = result["score"], result["level"], policy["decision"]
    case.status = txn.status if txn.status != "approved" else "approved"
    if policy["decision"] == "APPROVE" and user.role == "customer":
        # Customer authorization of a HIGH+ decision still needs the bank/officer —
        # keep case open for officer confirmation (bank is final authority).
        case.status = "awaiting_officer"
    log(db, action="authorization_decision", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"decision": policy["decision"],
                                        "reason": policy["reason"], "bank": bank})
    db.commit()
    db.refresh(txn)
    return {"decision": policy["decision"], "reason": policy["reason"], "risk": result,
            "transaction": TransactionOut.model_validate(txn).model_dump(),
            "case_status": case.status, "bank": bank}


@router.post("/{txn_id}/authorize", response_model=DecisionOut)
def authorize(txn_id: int, db: Session = Depends(get_db),
              x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    return _finalize_authorize(db, txn, case, user)


@router.post("/{txn_id}/escalate")
def escalate(txn_id: int, db: Session = Depends(get_db),
             x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    txn = get_txn(db, txn_id)
    require_owner(db, user, txn)
    case = get_case(db, txn_id)
    txn.status, txn.decision, case.status, case.decision = "escalated", "ESCALATE", "escalated", "ESCALATE"
    log(db, action="case_escalated", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"to": "officer_review"})
    db.commit()
    return {"ok": True, "status": "escalated"}


@router.post("/{txn_id}/block")
def block(txn_id: int, db: Session = Depends(get_db),
          x_user_id: str | None = Header(default=None, alias="X-User-Id")):
    user = actor(db, x_user_id)
    if user.role not in ("officer", "admin"):
        raise HTTPException(status_code=403, detail="Officer role required to block")
    txn = get_txn(db, txn_id)
    case = get_case(db, txn_id)
    txn.status, txn.decision, case.status, case.decision = "blocked", "BLOCK", "blocked", "BLOCK"
    log(db, action="transaction_blocked", actor=user.name, case_id=case.id,
        transaction_id=txn.id, details={"reason": "officer decision"})
    db.commit()
    return {"ok": True, "status": "blocked"}
