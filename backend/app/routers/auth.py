"""Demo authentication. Prototype only — no real credentials.

Login accepts a seeded email + the documented demo PIN (1234). Production
replaces this with real auth (password + MFA/SSO). The frontend is never
trusted: every request re-resolves the user and role server-side.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_PIN = "1234"


class LoginRequest(BaseModel):
    email: str
    pin: str


def mask_account(n: str) -> str:
    return n[:4] + "••" + n[-4:] if len(n) >= 8 else "••••" + n[-4:]


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user is None or body.pin != DEMO_PIN:
        raise HTTPException(status_code=401, detail="Invalid demo credentials")
    customer = db.query(User).filter(User.role == "customer").first()
    officer = db.query(User).filter(User.role.in_(("officer", "admin"))).first()
    acct = db.query(Account).filter(Account.user_id == user.id).first()
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        "account": (
            {"id": acct.id, "number_masked": mask_account(acct.account_number),
             "balance": acct.balance,
             "normal_limit": acct.normal_transaction_limit or 500_000}
            if acct else None
        ),
        # Demo convenience so the client can address both demo actors without
        # a destructive reset. Roles are still resolved server-side per request.
        "ids": {"customer": customer.id if customer else user.id,
                "officer": officer.id if officer else user.id},
    }
