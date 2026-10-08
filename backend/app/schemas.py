"""Pydantic contracts. Frontend must use these shapes via centralized api.ts."""
from datetime import datetime

from pydantic import BaseModel, Field


class RiskFactor(BaseModel):
    signal: str
    points: int
    explanation: str


class RiskResult(BaseModel):
    score: int
    level: str
    factors: list[RiskFactor] = []
    recommended_action: str


class TransactionOut(BaseModel):
    id: int
    account_id: int
    direction: str
    amount: float
    currency: str
    sender_name: str
    sender_risk: str
    beneficiary_name: str
    beneficiary_risk: str
    purpose: str
    status: str
    risk_score: int
    risk_level: str
    decision: str
    scenario: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class CaseOut(BaseModel):
    id: int
    transaction_id: int
    status: str
    risk_score: int
    risk_level: str
    verification_state: str
    decision: str
    scenario: str

    model_config = {"from_attributes": True}


class CaseDetail(BaseModel):
    case: CaseOut
    transaction: TransactionOut
    risk: RiskResult
    verification: dict
    audit: list[dict] = []


class IncomingRequest(BaseModel):
    sender_name: str = "Faith"
    amount: float = 4_000_000
    scenario: str = "A"
    device_id: str = "device-treasure-1"


class VerifyRequest(BaseModel):
    confirm_sender: bool = Field(..., description="Customer confirms they recognise the sender")
    expected: bool = False


class PurposeRequest(BaseModel):
    purpose: str = Field(..., min_length=2, max_length=100)


class BeneficiaryRequest(BaseModel):
    beneficiary_name: str = Field(..., min_length=2, max_length=100)


class IdentityConfirmRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


class ResetRequest(BaseModel):
    scenario: str = "A"


class DecisionOut(BaseModel):
    decision: str
    reason: str
    risk: RiskResult
    transaction: TransactionOut
    case_status: str
    bank: dict = {}
