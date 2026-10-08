"""Policy engine: hard rules win, fail-safe holds."""
from app import policy_engine


def test_regulatory_hold_wins():
    risk = {"level": "LOW", "score": 10, "recommended_action": "APPROVE"}
    d = policy_engine.decide(risk, {"regulatory_hold": True})
    assert d["decision"] == "HOLD"


def test_critical_escalates():
    d = policy_engine.decide({"level": "CRITICAL", "score": 90, "recommended_action": "ESCALATE"}, {})
    assert d["decision"] == "ESCALATE"


def test_mule_blocks():
    d = policy_engine.decide({"level": "CRITICAL", "score": 85, "recommended_action": "ESCALATE"},
                             {"is_rapid_outgoing": True})
    assert d["decision"] == "BLOCK"


def test_failsafe_holds():
    assert policy_engine.failsafe()["decision"] == "HOLD"


def test_medium_verified_approves():
    d = policy_engine.decide({"level": "MEDIUM", "score": 40, "recommended_action": "STEP_UP"},
                             {"sender_confirmed": True, "purpose": "Debt repayment",
                              "beneficiary_name": "John Doe", "reassessed": True})
    assert d["decision"] == "APPROVE"
