# FlowGuard — Risk-Adaptive Transaction Protection & Resolution System (MVP Demo)

> Prototype/demo only. No real banking systems, payment rails, customer data, KYC, biometrics, or money movement. Authorization is simulated via `MockBankAdapter`.

Demonstrates **Detect → Assess → Contain → Verify → Understand → Reassess → Authorize / Step-up / Escalate → Monitor** for the demo journey **Faith → Treasure ₦4,000,000** (normal max ₦500,000).

## Architecture

```
React (bank app + ops console) → FastAPI
  → /api/auth/login (demo email + PIN) → returns user + account + demo actor ids
  → /api/dashboard, /api/demo/topup (everyday banking surface)
  → X-User-Id header → role resolved server-side (client roles are never trusted)
  → Transaction service → Risk Engine (weighted, explainable)
  → Policy Engine (deterministic hard rules) → MockBankAdapter
  → Cases / RiskEvents / AuditLogs → PostgreSQL (prod) / SQLite (local)
```

Frontend routes: `/login`, `/` (bank dashboard), `/verify/:txnId?` (verification flow), `/ops` (officer ledger), `/cases/:id` (case detail). All non-login routes are auth-gated (`RequireAuth`).

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
Frontend: `VITE_API_URL` (production only — local dev uses the same-origin Vite `/api` proxy, no .env needed). Vite inlines this at **build** time, so it must be set before/at build.

On Render both of these are wired automatically by `render.yaml` (`fromService`), so the blueprint needs no manual variables.

## Database setup

Tables auto-create on startup (`Base.metadata.create_all`) and seed if empty. Fresh demo anytime: `POST /api/demo/reset {"scenario":"A"}` or `python -m app.seed`. Models: users, accounts, transactions, beneficiaries, cases, risk_events, audit_logs.

## Test commands

```powershell
cd backend; pytest -v
cd frontend; npm run typecheck
cd frontend; npm run build
```

## Render deployment

Render ONLY, via Blueprint `render.yaml`: `flowguard-db` (PostgreSQL free), `flowguard-api` (Web Service, rootDir `backend`, health check `/api/health`), `flowguard-web` (Static Site, rootDir `frontend`, publish `dist`).

1. Push the repo to GitHub, then **New → Blueprint** and select the repo.
2. `render.yaml` **auto-wires** `CORS_ORIGINS` (API ← the static site's URL) and `VITE_API_URL` (static site ← the API's URL) using `fromService`, so there are no manual dashboard variables. If your plan/blueprint rejects `fromService` for a static site, set them by hand instead:
   - API service: `CORS_ORIGINS=https://<flowguard-web>.onrender.com`
   - Web service: `VITE_API_URL=https://<flowguard-api>.onrender.com` — then trigger a **rebuild** (it is a build-time variable).
3. The static site ships an **SPA rewrite** (`/*` → `/index.html`) so deep links and refreshes on `/login`, `/ops`, `/verify/:txnId` and `/cases/:id` do not 404.
4. Smoke test: `GET /api/health`, then log in with `treasure@demo.bank` / PIN `1234`, simulate the ₦4m inflow and run the verification flow.

## Demo credentials / scenarios

No passwords (demo headers). `POST /api/demo/reset` returns `customer_id` (Treasure) and `officer_id`. Frontend stores them in localStorage and sends `X-User-Id`; the backend resolves the role server-side and never trusts client roles.

| ID | Scenario | Expected |
|----|----------|----------|
| A | Legitimate debt repayment (Faith→Treasure ₦4m → John Doe) | verification → approval |
| B | Compromised sender (+device risk) | HIGH → step-up/hold |
| C | Suspicious beneficiary | HIGH → step-up/escalate |
| D | Money mule (rapid outflows) | CRITICAL → escalate/block |
| E | Account takeover (new device) | HIGH/CRITICAL → step-up/escalate |

Main flow (bank app): login (`treasure@demo.bank` / PIN `1234`) → dashboard with balance, airtime/data/bills,
last-3 history → **Enhanced protection** banner on unusual inflow → Verify payment → demo OTP identity → sender
confirm/deny → purpose → beneficiary → reassess → mock Face ID/fingerprint → **submit for bank review**
(FlowGuard records only a recommendation) → officer APPROVE (authorizes + executes simulated settlement) /
STEP-UP / ESCALATE / BLOCK in Ops. Identity, biometric and bank gates are enforced server-side (409/422/403);
deny keeps disputed transactions contained. Governing principle (see PRD.md): the customer provides evidence,
FlowGuard assesses risk, the bank alone authorizes. Officer APPROVE credits an approved inflow to the
customer balance and settles (simulated); the Ops room is officer-only and invisible to customers.
Refreshing the page restarts the whole demo (fresh ₦250k balance, no cases).

Transaction states (PRD §10): CREATED → UNDER_REVIEW → CUSTOMER_VERIFIED → BENEFICIARY_SUBMITTED → RISK_REASSESSED → AUTHORIZED → SETTLED (simulated), with STEP_UP_REQUIRED / ESCALATED / BLOCKED branches. Cases carry status + resolution; audit covers received → risk → verified → purpose → beneficiary → reassessed → step-up → decision → settlement. Ops tab → open case → APPROVE/ESCALATE/BLOCK (officer-only, state-gated) → audit timeline.

## Limitations / prototype vs production

Mocks: bank ledger, sender intel, devices, KYC/biometrics. Demo auth header instead of SSO. SQLite locally. No Kafka/Redis/ML/graph. Fail-safe HOLD on risk failure, idempotent authorize, but no real concurrency controls, rate limiting, or PII vaulting — all required before production. This is not a PND bypass; the bank (officer + policy) is final authority.
