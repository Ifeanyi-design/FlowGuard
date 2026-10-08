"""Explainable weighted rules-based risk engine.

Pure function of a context dict — no DB, no mock adapter dependency.
Fail-safe: callers must catch exceptions and HOLD.

Weights follow the product spec; floors/suppression are documented demo
assumptions (see PROCESS_LOG phase 6b):
- Familiarity mitigations (expected/known-sender) are suppressed when they
  contradict adverse intelligence — a customer's "expected" checkbox cannot
  wish away flagged senders/beneficiaries or mule-like speed.
- Floors keep extreme anomalies/intel from scoring below the band that
  forces human review. Floors appear as explicit factors so the score
  stays explainable.
"""
from __future__ import annotations


def level_for(score: int) -> str:
    if score >= 81:
        return "CRITICAL"
    if score >= 61:
        return "HIGH"
    if score >= 31:
        return "MEDIUM"
    return "LOW"


def action_for(level: str) -> str:
    return {"LOW": "APPROVE", "MEDIUM": "STEP_UP", "HIGH": "HOLD", "CRITICAL": "ESCALATE"}[level]


def assess(ctx: dict) -> dict:
    """Assess transaction risk from a plain context dict.

    Expected keys (all optional with safe defaults):
      amount, largest_history (default 500000),
      is_new_beneficiary (bool), is_new_device (bool),
      is_rapid_outgoing (bool), sender_risk (low|medium|high),
      is_known_sender (bool), is_trusted_device (bool),
      is_expected_transaction (bool), is_known_beneficiary (bool),
      beneficiary_risk (low|medium|high)
    """
    factors: list[dict] = []
    score = 0

    def add(signal: str, points: int, explanation: str) -> None:
        nonlocal score
        score += points
        factors.append({"signal": signal, "points": points, "explanation": explanation})

    amount = float(ctx.get("amount", 0) or 0)
    largest = float(ctx.get("largest_history", 500000) or 500000)
    if largest > 0 and amount >= largest * 3:
        add("amount_deviation", 25, f"₦{amount:,.0f} is ≥3× normal max of ₦{largest:,.0f}.")
    elif largest > 0 and amount >= largest * 1.5:
        add("amount_deviation", 15, f"₦{amount:,.0f} is well above normal max of ₦{largest:,.0f}.")

    if ctx.get("is_new_beneficiary"):
        add("new_beneficiary", 20, "Beneficiary has not received funds from this account before.")
    if ctx.get("is_new_device"):
        add("new_device", 30, "Session is from a device not seen on this account.")
    if ctx.get("is_rapid_outgoing"):
        add("rapid_outgoing_transfer", 15, "Outgoing transfer follows a large incoming credit unusually fast.")

    sender_risk = str(ctx.get("sender_risk", "low")).lower()
    if sender_risk == "high":
        add("sender_risk", 25, "Sender carries elevated fraud intelligence risk.")
    elif sender_risk == "medium":
        add("sender_risk", 12, "Sender carries moderate risk markers.")

    beneficiary_risk = str(ctx.get("beneficiary_risk", "low")).lower()
    if beneficiary_risk == "high":
        add("beneficiary_risk", 20, "Outgoing beneficiary is flagged high-risk.")
    elif beneficiary_risk == "medium":
        add("beneficiary_risk", 10, "Outgoing beneficiary carries moderate risk.")

    intel = sender_risk == "high" or beneficiary_risk == "high" or bool(ctx.get("is_rapid_outgoing"))

    if ctx.get("is_known_sender"):
        if sender_risk == "high":
            add("known_sender", 0, "Familiar sender, but adverse sender intelligence cancels the credit.")
        else:
            add("known_sender", -10, "Sender is recognised from prior history.")
    if ctx.get("is_trusted_device"):
        add("trusted_device", -15, "Session device is trusted for this account.")
    if ctx.get("is_expected_transaction"):
        if intel:
            add("expected_transaction", -5,
                "Customer says this was expected, but it carries little weight against adverse signals.")
        else:
            add("expected_transaction", -20, "Customer confirmed this transaction was expected.")
    if ctx.get("is_known_beneficiary"):
        add("known_beneficiary", -15, "Beneficiary is known and previously used.")

    score = max(0, min(100, score))

    # Floors — conservative, fail-safe aligned, fully disclosed as factors.
    aged = largest > 0
    if aged and amount >= largest * 5 and score < 31:
        add("amount_floor", 31 - score, "Extreme amount anomaly (≥5× history) cannot score below MEDIUM.")
    if (sender_risk == "high" or beneficiary_risk == "high") and score < 61:
        add("intel_floor", 61 - score, "Adverse intelligence sets minimum risk to HIGH.")
    if (bool(ctx.get("is_rapid_outgoing")) and aged and amount >= largest * 3
            and (sender_risk in ("medium", "high") or beneficiary_risk in ("medium", "high"))
            and score < 81):
        add("mule_floor", 81 - score, "Probable money-mule pattern sets minimum risk to CRITICAL.")

    score = max(0, min(100, score))
    level = level_for(score)
    return {
        "score": score,
        "level": level,
        "factors": factors,
        "recommended_action": action_for(level),
    }
