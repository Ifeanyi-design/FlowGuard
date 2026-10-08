"""Demo helpers: health-safe reset + seeded scenario switching."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..audit import log
from ..database import get_db
from ..models import User
from ..schemas import ResetRequest
from ..seed import init_db, seed

router = APIRouter(prefix="/api/demo", tags=["demo"])

SCENARIOS = {
    "A": "LEGITIMATE DEBT REPAYMENT — Faith→Treasure ₦4m, onward to John Doe. Expect verification → approval.",
    "B": "COMPROMISED SENDER — sender/device risk. Expect HIGH → step-up/escalate.",
    "C": "SUSPICIOUS BENEFICIARY — incoming OK, outgoing beneficiary high risk. Expect HIGH → step-up/escalate.",
    "D": "MONEY MULE — large credit + rapid outflows. Expect CRITICAL → escalate/block.",
    "E": "ACCOUNT TAKEOVER — new device + unusual transaction. Expect HIGH/CRITICAL → step-up/escalate.",
}

# Fraud scenarios classified under risk classes (served to the UI picker).
CATALOGUE = [
    {"id": "A", "class": "Legitimate baseline", "title": "Legitimate debt repayment",
     "description": "Faith→Treasure ₦4m, onward to John Doe.",
     "expectation": "MEDIUM → verification → APPROVE"},
    {"id": "B", "class": "Sender compromise", "title": "Compromised sender",
     "description": "Sender carries high fraud-intel risk; session from an unknown device.",
     "expectation": "HIGH/CRITICAL → STEP_UP or ESCALATE"},
    {"id": "C", "class": "Beneficiary risk", "title": "Suspicious beneficiary",
     "description": "Incoming leg OK; onward beneficiary flagged high-risk.",
     "expectation": "HIGH → STEP_UP or ESCALATE"},
    {"id": "D", "class": "Velocity abuse", "title": "Money mule",
     "description": "Large credit followed by rapid onward transfers.",
     "expectation": "CRITICAL → ESCALATE or BLOCK"},
    {"id": "E", "class": "Session compromise", "title": "Account takeover",
     "description": "New device/session plus an unusual transaction.",
     "expectation": "HIGH/CRITICAL → STEP_UP or ESCALATE"},
]
CLASSES = ["Legitimate baseline", "Sender compromise", "Beneficiary risk",
           "Velocity abuse", "Session compromise"]


@router.post("/reset")
def reset(body: ResetRequest | None = None, db: Session = Depends(get_db)):
    scenario = ((body.scenario if body else "A") or "A").upper()
    if scenario not in SCENARIOS:
        scenario = "A"
    init_db()
    ids = seed()
    log(db, action="demo_reset", actor="system", details={"scenario": scenario})
    db.commit()
    customer = db.query(User).filter(User.email == "treasure@demo.bank").first()
    officer = db.query(User).filter(User.email == "officer@demo.bank").first()
    return {"ok": True, "scenario": scenario, "description": SCENARIOS[scenario],
            "customer_id": customer.id if customer else ids["customer_id"],
            "officer_id": officer.id if officer else ids["officer_id"],
            "scenarios": SCENARIOS, "catalogue": CATALOGUE, "classes": CLASSES}
