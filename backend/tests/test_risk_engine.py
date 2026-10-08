"""Risk engine unit tests: weights, levels, explanations."""
from app import risk_engine


def test_large_amount_flags_deviation():
    r = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000})
    assert r["score"] >= 25
    assert any(f["signal"] == "amount_deviation" for f in r["factors"])


def test_levels():
    assert risk_engine.level_for(10) == "LOW"
    assert risk_engine.level_for(45) == "MEDIUM"
    assert risk_engine.level_for(70) == "HIGH"
    assert risk_engine.level_for(90) == "CRITICAL"


def test_mitigations_reduce_score():
    risky = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                                "is_new_device": True, "sender_risk": "high"})
    calm = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                               "is_known_sender": True, "is_trusted_device": True,
                               "is_expected_transaction": True})
    assert calm["score"] < risky["score"]


def test_mule_pattern_critical():
    r = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                            "is_new_beneficiary": True, "is_rapid_outgoing": True,
                            "sender_risk": "medium", "beneficiary_risk": "medium"})
    assert r["level"] == "CRITICAL"


def test_extreme_amount_floor_medium():
    # Faith -> Treasure 8x history: cannot score below MEDIUM even fully verified.
    r = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                            "is_known_sender": True, "is_trusted_device": True,
                            "is_expected_transaction": True})
    assert r["score"] >= 31 and r["level"] == "MEDIUM"


def test_intel_suppresses_expected_and_floors_high():
    r = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                            "is_new_beneficiary": True, "is_known_sender": True,
                            "is_trusted_device": True, "is_expected_transaction": True,
                            "sender_risk": "medium", "beneficiary_risk": "high"})
    assert r["level"] == "HIGH"


def test_scenario_b_reaches_high():
    r = risk_engine.assess({"amount": 4_000_000, "largest_history": 500_000,
                            "is_new_beneficiary": True, "is_new_device": True,
                            "sender_risk": "high", "is_expected_transaction": True})
    assert r["level"] in ("HIGH", "CRITICAL")
