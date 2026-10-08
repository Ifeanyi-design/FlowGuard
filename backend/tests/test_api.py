"""End-to-end API flow: reset → incoming → verify → purpose → beneficiary → reassess → authorize → audit."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_flowguard.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_full_demo_flow():
    Base.metadata.drop_all(bind=engine)
    r = client.post("/api/demo/reset", json={"scenario": "A"})
    assert r.status_code == 200, r.text
    customer_id = r.json()["customer_id"]

    h = {"X-User-Id": str(customer_id)}
    r = client.post("/api/transactions/incoming",
                    json={"sender_name": "Faith", "amount": 4_000_000, "scenario": "A"}, headers=h)
    assert r.status_code == 200, r.text
    txn_id = r.json()["transaction"]["id"]
    assert r.json()["unusual"] is True

    # Identity proof gates everything: wrong code rejected, verify blocked until done.
    assert client.post(f"/api/transactions/{txn_id}/verify",
                       json={"confirm_sender": True, "expected": True}, headers=h).status_code == 409
    start = client.post(f"/api/transactions/{txn_id}/identity", headers=h)
    assert start.status_code == 200, start.text
    assert client.post(f"/api/transactions/{txn_id}/identity/confirm",
                       json={"code": "000000"}, headers=h).status_code == 422
    code = start.json()["code"]
    assert client.post(f"/api/transactions/{txn_id}/identity/confirm",
                       json={"code": code}, headers=h).status_code == 200

    assert client.post(f"/api/transactions/{txn_id}/verify",
                       json={"confirm_sender": True, "expected": True}, headers=h).status_code == 200
    assert client.post(f"/api/transactions/{txn_id}/purpose",
                       json={"purpose": "Debt repayment"}, headers=h).status_code == 200
    assert client.post(f"/api/transactions/{txn_id}/beneficiary",
                       json={"beneficiary_name": "John Doe"}, headers=h).status_code == 200

    r = client.post(f"/api/transactions/{txn_id}/reassess", headers=h)
    assert r.status_code == 200, r.text
    assert "risk" in r.json() and "suggested_decision" in r.json()

    r = client.post(f"/api/transactions/{txn_id}/authorize", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["decision"] in ("APPROVE", "STEP_UP", "HOLD", "ESCALATE", "BLOCK")

    # Idempotent replay
    r2 = client.post(f"/api/transactions/{txn_id}/authorize", headers=h)
    assert r2.status_code == 200

    cases = client.get("/api/cases", headers=h).json()["cases"]
    assert len(cases) >= 1
    case_id = cases[0]["case"]["id"]
    audit = client.get(f"/api/cases/{case_id}/audit", headers=h).json()["audit"]
    actions = [a["action"] for a in audit]
    for expected in ("transaction_received", "risk_triggered", "customer_verified",
                     "purpose_selected", "beneficiary_submitted", "risk_reassessed",
                     "authorization_decision"):
        assert expected in actions, f"missing {expected} in {actions}"


def test_block_requires_officer():
    Base.metadata.drop_all(bind=engine)
    r = client.post("/api/demo/reset", json={"scenario": "B"})
    customer_id = r.json()["customer_id"]
    h = {"X-User-Id": str(customer_id)}
    txn_id = client.post("/api/transactions/incoming",
                         json={"sender_name": "Faith", "amount": 4_000_000, "scenario": "B"},
                         headers=h).json()["transaction"]["id"]
    r = client.post(f"/api/transactions/{txn_id}/block", headers=h)
    assert r.status_code == 403  # customer cannot block
