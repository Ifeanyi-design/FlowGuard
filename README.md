# FlowGuard — Risk-Adaptive Transaction Protection & Resolution System (MVP Demo)

> Prototype/demo only. No real banking systems, payment rails, customer data, KYC, biometrics, or money movement. Authorization is simulated via `MockBankAdapter`.

Demonstrates **Detect → Assess → Contain → Verify → Understand → Reassess → Authorize / Step-up / Escalate → Monitor** for the demo journey **Faith → Treasure ₦4,000,000** (normal max ₦500,000).

## Architecture

```
React (customer + ops) → FastAPI → demo auth (X-User-Id, role from DB)
  → Transaction service → Risk Engine (weighted, explainable)
  → Policy Engine (deterministic hard rules) → MockBankAdapter
  → Cases / RiskEvents / AuditLogs → PostgreSQL (prod) / SQLite (local)
```

Backend owns risk scores, decisions, case ownership, state, audit. Frontend is only a client (`frontend/src/api.ts` is the single API layer).

## Stack

React 18 · Vite 5 · TypeScript · Tailwind · Lucide · FastAPI · SQLAlchemy 2 · Pydantic v2 · psycopg · PostgreSQL (Render) / SQLite (local) · Pytest · Render Blueprint (`render.yaml`).

## Local setup

Backend:
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Frontend (no .env needed — Vite proxies `/api` to the backend):
```powershell
cd frontend
npm install
npm run dev              # http://localhost:5173 → /api proxied to http://localhost:8000
```

## Environment variables

Backend: `DATABASE_URL` (default `sqlite:///./flowguard.db`; Render injects Postgres), `CORS_ORIGINS` (comma-separated; default localhost:5173), `ENV`.
Frontend: `VITE_API_URL` (production only — local dev uses the same-origin Vite `/api` proxy, no .env needed).

## Database setup

Tables auto-create on startup (`Base.metadata.create_all`) and seed if empty. Fresh demo anytime: `POST /api/demo/reset {"scenario":"A"}` or `python -m app.seed`. Models: users, accounts, transactions, beneficiaries, cases, risk_events, audit_logs.

## Test commands

```powershell
cd backend; pytest -v
cd frontend; npm run typecheck
cd frontend; npm run build
```

## Render deployment

Render ONLY, via Blueprint `render.yaml`: `flowguard-db` (PostgreSQL free), `flowguard-api` (Web Service, rootDir `backend`), `flowguard-web` (Static Site, rootDir `frontend`, publish `dist`).
1. Push repo to GitHub, **New → Blueprint**, select repo.
2. After deploy set `CORS_ORIGINS=https://<flowguard-web>.onrender.com` on the API and `VITE_API_URL=https://<flowguard-api>.onrender.com` on the web service, then redeploy/trigger rebuild.
3. Smoke test: `GET /api/health`, `POST /api/demo/reset`, run demo flow in the web UI.

## Demo credentials / scenarios

No passwords (demo headers). `POST /api/demo/reset` returns `customer_id` (Treasure) and `officer_id`. Frontend stores them in localStorage and sends `X-User-Id`; the backend resolves the role server-side and never trusts client roles.

| ID | Scenario | Expected |
|----|----------|----------|
| A | Legitimate debt repayment (Faith→Treasure ₦4m → John Doe) | verification → approval |
| B | Compromised sender (+device risk) | HIGH → step-up/hold |
| C | Suspicious beneficiary | HIGH → step-up/escalate |
| D | Money mule (rapid outflows) | CRITICAL → escalate/block |
| E | Account takeover (new device) | HIGH/CRITICAL → step-up/escalate |

Main flow: Customer tab → scenario A → Simulate → demo OTP identity check → Confirm sender (or deny: disputed stays contained) → Debt repayment → John Doe → Reassess → Submit to bank. Identity proof is enforced server-side: sender confirmation and authorization are rejected until it completes. Officer APPROVE on an authorized case simulates settlement (SETTLED, no real money).

Transaction states (PRD §10): CREATED → UNDER_REVIEW → CUSTOMER_VERIFIED → BENEFICIARY_SUBMITTED → RISK_REASSESSED → AUTHORIZED → SETTLED (simulated), with STEP_UP_REQUIRED / ESCALATED / BLOCKED branches. Cases carry status + resolution; audit covers received → risk → verified → purpose → beneficiary → reassessed → step-up → decision → settlement. Ops tab → open case → APPROVE/ESCALATE/BLOCK (officer-only, state-gated) → audit timeline.

## Limitations / prototype vs production

Mocks: bank ledger, sender intel, devices, KYC/biometrics. Demo auth header instead of SSO. SQLite locally. No Kafka/Redis/ML/graph. Fail-safe HOLD on risk failure, idempotent authorize, but no real concurrency controls, rate limiting, or PII vaulting — all required before production. This is not a PND bypass; the bank (officer + policy) is final authority.
