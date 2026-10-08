"""Deterministic policy/decision engine.

Risk Engine → Policy Engine → Final Decision → Mock Bank Adapter.
Hard rules always win over risk recommendation. Never auto-approves on failure.
"""
from __future__ import annotations


def decide(risk: dict, ctx: dict) -> dict:
    """Return {decision, reason}. decision in APPROVE|STEP_UP|HOLD|ESCALATE|BLOCK."""
    level = risk.get("level", "HIGH")
    recommended = risk.get("recommended_action", "HOLD")
    score = int(risk.get("score", 100))

    # Hard rule 1: regulatory / mock restriction always HOLDs.
    if ctx.get("regulatory_hold"):
        return {"decision": "HOLD", "reason": "Regulatory restriction in force — held regardless of risk score."}

    # Hard rule 2: critical risk never approves.
    if level == "CRITICAL":
        if ctx.get("is_rapid_outgoing") and score >= 81:
            return {"decision": "BLOCK", "reason": "Mule-like pattern: large credit followed by rapid outflows."}
        return {"decision": "ESCALATE", "reason": f"Critical risk ({score}) requires officer review."}

    if level == "HIGH":
        if not ctx.get("sender_confirmed") or not ctx.get("purpose"):
            return {"decision": "HOLD", "reason": "High risk with incomplete verification — contained."}
        return {"decision": "STEP_UP", "reason": f"High risk ({score}) — step-up verification required."}

    if level == "MEDIUM":
        if ctx.get("sender_confirmed") and ctx.get("purpose") and ctx.get("beneficiary_name"):
            if ctx.get("reassessed"):
                return {"decision": "APPROVE", "reason": "Verified expected transaction; residual risk acceptable."}
            return {"decision": "STEP_UP", "reason": "Awaiting risk reassessment before approval."}
        return {"decision": recommended, "reason": "Medium risk — complete verification to proceed."}

    # LOW
    if ctx.get("sender_confirmed") and ctx.get("purpose"):
        return {"decision": "APPROVE", "reason": "Low residual risk after verification."}
    return {"decision": "STEP_UP", "reason": "Confirm sender and purpose before approval."}


def failsafe(reason: str = "Risk service unavailable") -> dict:
    return {"decision": "HOLD", "reason": f"Fail-safe HOLD: {reason}. Never auto-approved."}
