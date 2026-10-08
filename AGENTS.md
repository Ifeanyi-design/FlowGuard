# AGENTS.md — FlowGuard: Risk-Adaptive Transaction Protection & Resolution System

> Prototype/demo only. No real banking, payment rails, customer data, KYC, biometrics, or money movement.

## 1. Project Purpose

Demonstrate the complete risk-adaptive workflow for banks:

**Detect → Assess → Contain → Verify → Understand → Reassess → Authorize / Step-up / Escalate → Monitor**

Primary demo journey: `Faith → Treasure ₦4,000,000` (8× normal history of ₦500k max) is flagged unusual, then customer verifies sender → selects purpose (Debt repayment) → enters beneficiary (John Doe) → risk reassessment → explainable score → Approve / Step-up / Escalate. No money moves; authorization is simulated via `MockBankAdapter`.

Critical product rules:
1. Not a PND bypass system. Bank remains final authority.
2. Incoming verification never auto-authorizes outgoing transactions.
3. No single signal authorizes a high-value transaction.
4. Risk scoring is explainable. AI/risk never directly controls funds: Risk Engine → Policy Engine → Final Decision → Mock Bank Adapter.
5. Never process real money. Regulatory/critical restrictions always enforceable (HOLD wins).
6. Core ledger (mock) is source of truth. Convenience increases only as risk reduces.
7. Fail-safe: if risk services fail, NEVER auto-approve — controlled HOLD/error state.

## 2. Architecture

```
Customer UI (React) ──┐
Ops Dashboard (React) ─┤→ API (FastAPI) → AuthZ → Transaction Service → Risk Engine → Policy Engine → MockBankAdapter
                       │                  → Cases → Risk Events → Audit Logs → PostgreSQL (prod) / SQLite (local dev)
                       └→ GET /api/health, /api/transactions/*, /api/cases/*
```

Logical chain: Customer channels → API Gateway (FastAPI app) → AuthN/Z (demo header `X-User-Id`, role looked up server-side) → Transaction Event → Risk Engine → Policy/Decision Engine → Approve/Step-up/Hold/Escalate → Mock Bank Authorization.

Frontend is only a client. Backend owns risk calculations, authorization decisions, case ownership, transaction state, audit logging. Never trust frontend-supplied scores, ownership, auth status, or roles.

## 3. Stack

- Frontend: React 18, Vite 5, TypeScript 5, Tailwind CSS 3, Lucide React, React Router 6
- Backend: Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, psycopg (prod), sqlite (local fallback)
- DB: PostgreSQL (Render; local dev defaults to SQLite file for zero-setup, Postgres via `DATABASE_URL`)
- Testing: Pytest (backend), `tsc --noEmit` + `vite build` (frontend)
- Hosting (Render ONLY): Frontend = Static Site, Backend = Web Service, DB = Render PostgreSQL. Blueprint: `render.yaml`

## 4. Folder Structure

```
AGENTS.md  PROCESS_LOG.md  README.md  render.yaml
backend/
  requirements.txt
  app/
    main.py            # FastAPI app, CORS from env, router mounting, startup seed
    config.py          # env settings (DATABASE_URL, CORS_ORIGINS, DEMO_* )
    database.py        # engine/session (postgres via psycopg / sqlite fallback)
    models.py          # users, accounts, transactions, beneficiaries, cases, risk_events, audit_logs
    schemas.py         # Pydantic request/response contracts
    risk_engine.py     # explainable weighted rules engine (no mock dependency)
    policy_engine.py   # deterministic hard rules → APPROVE/STEP_UP/HOLD/ESCALATE/BLOCK
    bank_adapter.py    # BankAdapter interface + MockBankAdapter simulation
    audit.py           # audit log helper
    seed.py            # demo seed (Treasure, Faith, John Doe, scenarios)
    routers/
      transactions.py  # incoming/get/verify/purpose/beneficiary/reassess/authorize/escalate/block
      cases.py         # list/get/audit
      demo.py          # POST /api/demo/reset {scenario}
  tests/               # pytest: risk engine, policy, API flow
frontend/
  package.json  vite.config.ts  tsconfig.json  tailwind.config.js  postcss.config.js  index.html
  src/ main.tsx  App.tsx  api.ts  types.ts  pages/  components/
```

## 5. Development Commands

Backend:
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="sqlite:///./flowguard.db"  # local default; omit for file default
python -m app.seed                               # init + seed demo data
uvicorn app.main:app --reload --port 8000
```

Frontend (no .env needed — Vite dev proxies `/api` to the backend):
```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173; override API target with BACKEND_URL=...
```

## 6. Testing Commands

```powershell
cd backend; pytest -v
cd frontend; npm run typecheck   # tsc --noEmit
cd frontend; npm run build       # production bundle check
```

Integration (both running): execute demo flow Faith→Treasure ₦4m → verify → purpose → beneficiary → reassess → authorize; switch scenarios A–E; confirm audit timeline grows.

## 7. Render Deployment Requirements

- Blueprint `render.yaml` defines: `flowguard-db` (PostgreSQL), `flowguard-api` (Web Service: `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`), `flowguard-web` (Static Site: `npm install; npm run build`, publish `dist`, `VITE_API_URL` = backend URL).
- Backend env: `DATABASE_URL` (Render-provided), `CORS_ORIGINS` (frontend URL), `PYTHON_VERSION=3.12`.
- Frontend env: `VITE_API_URL` (backend URL, production only). No hardcoded localhost in production builds — `src/api.ts` reads `import.meta.env.VITE_API_URL` with a same-origin fallback (Vite `/api` proxy) for dev.
- CORS: backend allows origins from `CORS_ORIGINS` env (comma-separated) + localhost dev defaults.
- No secrets in source. All via env vars.
- DB init on Render: backend creates tables on startup (`Base.metadata.create_all`) and seeds demo user if empty; for a clean demo call `POST /api/demo/reset`.

## 8. Security Rules (prototype-level, enforced)

- Server-side authorization: resolve user by `X-User-Id` header → DB lookup; NEVER trust frontend `role`.
- Backend-owned risk score/decision; transaction state machine validated server-side (e.g. authorize requires verified+purpose+beneficiary+reassessed; idempotent authorize returns existing decision).
- Pydantic input validation, consistent HTTP error shape `{detail}`, CORS from env, env vars for secrets/URLs.
- Fail-safe: risk engine exception → score 100/CRITICAL, action ESCALATE, decision HOLD.
- No real PII beyond demo names; demo data only.

## 9. Important Non-Goals

No real banking integration, payment processing, KYC, biometrics, fraud intel, Kafka, Redis, K8s, graph DB, ML training, production SSO, elaborate auth. Realistic mocks only.

## 10. Process Log Requirement

`PROCESS_LOG.md` at project root MUST always be maintained. After every meaningful stage append an entry: timestamp, phase, objective, files created/modified, commands run, tests/checks, result, problems + resolution, remaining work. Never batch it at the end.
