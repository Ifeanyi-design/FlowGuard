# PROCESS_LOG.md — FlowGuard MVP Build Log

> MANDATORY log. Every meaningful stage appends: timestamp, phase, objective, files created/modified, commands run, tests/checks, result, problems + resolution, remaining work.

---

## 2026-10-08T00:00:00Z — Phase 1: Repository inspection

- Objective: Inspect repo, confirm empty workspace, check toolchains.
- Files: none yet.
- Commands: `read` workspace dir; `python --version; pip --version; node --version; npm --version`.
- Result: Empty dir (0 entries). Python 3.12.1, pip 25.3, node v24.16.0, npm 11.13.0. Proceed to scaffold.
- Problems: none.
- Remaining: create AGENTS.md, scaffold backend/frontend, render.yaml.

---

## 2026-10-08T00:05:00Z — Phase 2: Project instructions (AGENTS.md)

- Objective: Create AGENTS.md per spec (purpose, architecture, stack, folders, commands, Render, security, non-goals, log rule).
- Files created: `AGENTS.md`.
- Result: Done.
- Remaining: scaffold backend risk/policy/mock-adapter/API + frontend + render.yaml + README.

---

## 2026-10-08T00:15:00Z — Phase 3: Scaffold (backend core + DB models)

- Objective: Backend skeleton, config, DB layer, all 7 SQLAlchemy models.
- Files created: `backend/requirements.txt` (fastapi/uvicorn/SQLAlchemy/pydantic/psycopg/pytest/httpx),
  `backend/app/__init__.py`, `backend/app/config.py` (env: DATABASE_URL default sqlite, CORS_ORIGINS),
  `backend/app/database.py` (postgres→postgresql+psycopg normalisation, sqlite fallback),
  `backend/app/models.py` (users, accounts, transactions, beneficiaries, cases, risk_events, audit_logs).
- Assumption: local dev uses SQLite file by default (zero-setup); Render injects Postgres via DATABASE_URL. Same models/queries both.
- Remaining: risk/policy/bank-adapter/audit/schemas/seed/routers.

---

## 2026-10-08T00:25:00Z — Phase 4: Risk engine, policy engine, mock adapter, audit, schemas, seed

- Objective: Explainable risk engine (spec weights verbatim), deterministic policy engine with hard rules + fail-safe,
  MockBankAdapter behind BankAdapter interface, audit helper, Pydantic contracts, demo seed.
- Files created: `backend/app/risk_engine.py`, `backend/app/policy_engine.py` (regulatory HOLD wins; CRITICAL→ESCALATE,
  mule pattern→BLOCK; failsafe()→HOLD), `backend/app/bank_adapter.py`, `backend/app/audit.py`,
  `backend/app/schemas.py`, `backend/app/seed.py` (Treasure customer + officer + 0123456789 account + Mama Ngozi trusted beneficiary).
- Commands: none (code only).
- Remaining: routers, main app, tests, frontend.

---

## 2026-10-08T00:40:00Z — Phase 5: API routers + app wiring

- Objective: All 12 required endpoints. Backend owns risk/decision/state; demo auth via X-User-Id resolved to DB role
  (never trusts client roles); ownership checks; state-machine validation (authorize requires verified+purpose+
  beneficiary+reassessed, 409 otherwise); idempotent authorize; officer-only block + officer-decision; audit on every event.
- Files created: `backend/app/routers/__init__.py`, `backend/app/routers/transactions.py`
  (incoming/get/verify/purpose/beneficiary/reassess/authorize/escalate/block + scenario flag map A–E),
  `backend/app/routers/cases.py` (list/get/audit + officer-decision APPROVE/ESCALATE/BLOCK, state-gated),
  `backend/app/routers/demo.py` (reset + scenario catalogue), `backend/app/main.py` (CORS from env, lifespan startup seed).
- Scenario flags: B=sender-high+new-device; C=sender-medium+beneficiary-high; D=rapid+medium/medium; E=new-device+sender-medium.
- Remaining: tests, frontend, render.yaml, README.

---

## 2026-10-08T00:50:00Z — Phase 6: Backend tests (TDD check)

- Objective: pytest coverage for engine, policy, full API flow, officer-gating.
- Files created: `backend/tests/__init__.py`, `tests/test_risk_engine.py`, `tests/test_policy.py`, `tests/test_api.py`
  (full Faith→Treasure ₦4m flow incl. 7-event audit assertion; customer-block → 403).
- Commands: `pip install -r requirements.txt` (ok; downgraded some preinstalled pkgs, harmless pytest-asyncio notice);
  `pytest -v` → **11 passed**.
- Problems: none (only third-party deprecation warnings).
- Remaining: frontend scaffold.

---

## 2026-10-08T01:05:00Z — Phase 7: Frontend scaffold + customer flow + ops dashboard

- Objective: Vite React TS Tailwind app; centralized `src/api.ts` (only fetch layer); typed contracts; customer wizard
  (simulate → alert → confirm sender → purpose → beneficiary → reassess with factor breakdown → authorize/escalate);
  ops table (risk-sorted) + case detail (transaction, factors, verification, gated APPROVE/ESCALATE/BLOCK, audit timeline).
- Files created: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`,
  `postcss.config.js`, `index.html`, `.env.example` (VITE_API_URL), `src/main.tsx`, `src/App.tsx` (Customer/Ops tabs + health),
  `src/api.ts`, `src/types.ts`, `src/index.css`, `src/components/ui.tsx` (RiskBadge/ScoreBar/naira),
  `src/pages/CustomerDashboard.tsx`, `src/pages/OpsDashboard.tsx`, `src/pages/CaseDetailPage.tsx`.
- Problems: first `npm run typecheck` failed — tsconfig used moduleResolution NodeNext (extension-required imports) and
  missing vite/client types. Resolved: switched to `module ESNext / moduleResolution bundler`, added `src/vite-env.d.ts`.
- Commands: `npm install` (138 pkgs, ok); `npm run typecheck` → pass; `npm run build` → pass (dist 189KB JS, 11.5KB CSS).
- Remaining: render.yaml, README, live integration sweep.

---

## 2026-10-08T01:20:00Z — Phase 6b: Risk calibration fix (spec alignment)

- Objective: Live sweep showed C/D resolving MEDIUM→APPROVE (spec demands HIGH/CRITICAL→escalate) and A scoring 0
  (spec: MEDIUM → verification → approval). Root cause: familiarity mitigations (−45) erased adverse intelligence.
- Assumption (documented in `risk_engine.py` docstring): spec weights kept verbatim; added (a) suppression — customer
  "expected" counts −5 not −20 when intel/rapid present, known-sender zeroed when sender high; (b) disclosed floors —
  ≥5× amount → min 31 MEDIUM, high sender/beneficiary intel → min 61 HIGH, rapid+large+intel → min 81 CRITICAL.
  Floors are emitted as explicit factors so the score stays explainable.
- Files modified: `backend/app/risk_engine.py`; `backend/tests/test_risk_engine.py` (+3 tests: amount floor, intel floor/suppression, scenario B).
- Commands: `pytest -v` → **14 passed**; live HTTP sweep (temp `backend/_verify_live.py`, deleted afterwards):
  A incoming 31 MEDIUM → reassess 31 MEDIUM → authorize APPROVE; B 95 CRITICAL → ESCALATE; C 61 HIGH → STEP_UP;
  D 81 CRITICAL → BLOCK; E 67 HIGH → STEP_UP. Health `{"status":"ok","db":"ok"}`. All match §13 expectations
  (B incoming was 80 HIGH, rising to CRITICAL as the onward beneficiary is added — sensible escalation narrative).
- Remaining: render.yaml, README, final log.

---

## 2026-10-08T01:30:00Z — Phase 8: Render config, README, gitignore, final verification

- Objective: Render-only Blueprint (static web + python web service + postgres), README per spec, clean repo.
- Files created: `render.yaml` (flowguard-api rootDir backend, flowguard-web rootDir frontend publish dist,
  flowguard-db postgres free; DATABASE_URL fromDatabase; CORS_ORIGINS + VITE_API_URL as dashboard-set vars),
  `README.md` (description, arch, setup, env, DB, tests, Render steps, demo scenarios A–E, limitations/prototype-vs-prod),
  `.gitignore` (venvs, *.db, node_modules, dist, .env).
- Verification rerun: `pytest -v` → 14 passed; `npm run typecheck` → pass; `npm run build` → pass.
  Also replaced deprecated `@app.on_event("startup")` with lifespan handler (verified via passing suite).
- Problems: PowerShell has no `&&`/`tail` — used `;`-free single commands and plain `pytest -v`.
- Remaining: deploy to Render (needs GitHub push + Blueprint; see next steps).

---

## FINAL STATUS

- Completed: AGENTS.md, PROCESS_LOG.md, README.md, render.yaml; backend (models, risk+policy engines, mock adapter,
  12+ endpoints, seed, audit); frontend (customer wizard, ops dashboard, case detail w/ audit timeline);
  14 backend tests green; frontend typecheck + production build green; live 5-scenario HTTP sweep matches expectations.
- Incomplete: actual Render deployment (requires repo push + dashboard env vars); no CI pipeline; demo auth header
  instead of SSO (intentional non-goal).
- Known limitations: SQLite locally (Postgres only on Render); mocks for ledger/intel/devices/KYC; single demo customer;
  no rate limiting/concurrency controls — not production-hardened by design.
- Test results: backend `pytest -v` 14/14 pass; frontend `npm run typecheck` pass; `npm run build` pass;
  live sweep A→APPROVE, B→ESCALATE, C→STEP_UP, D→BLOCK, E→STEP_UP with 7-event audit trail verified.
- Deployment status: `render.yaml` written, NOT yet applied. Next steps: push to GitHub → Render Blueprint →
  set CORS_ORIGINS=https://<web>.onrender.com on API and VITE_API_URL=https://<api>.onrender.com on web → redeploy →
  smoke test /api/health + demo flow.

---

## 2026-10-08T02:10:00Z — Phase 9: Frontend↔backend connection + disk-full incident

- Objective: User reported backend not connected to frontend. Root causes found: (1) no frontend `.env` existed, so the
  app depended on a backend happening to run on localhost:8000; (2) C: disk was 100% full (61.7GB/61.7GB), which broke
  file writes and truncated `frontend/vite.config.ts` to 0 bytes mid-edit.
- Fix: same-origin API base (`src/api.ts` BASE defaults to `''`) + Vite dev `/api` proxy to `http://localhost:8000`
  (override via `BACKEND_URL`), so local dev needs no `.env`; `VITE_API_URL` is production-only. Restored
  `vite.config.ts`; updated `.env.example`, README, AGENTS.md. Freed ~290MB by deleting npm/pip caches
  (regenerable) + `dist`; restored config afterwards.
- Files modified: `frontend/vite.config.ts`, `frontend/src/api.ts`, `frontend/src/App.tsx` (proxy label),
  `frontend/.env.example`, `README.md`, `AGENTS.md`.
- Verification: backend boots + `/api/health` ok in ~4s (direct); Vite boots in ~2.2s (its own log);
  `npm run typecheck` pass. A combined backend+vite+proxy flow script was attempted twice but the runner
  killed/interrupted it before output; piece-wise proof stands. User action to confirm: run backend
  (`uvicorn app.main:app --port 8000`) + `npm run dev`, header should read `api: proxy ok/db:ok`.
- Remaining: rerun combined check if time permits; submit.

---

## 2026-10-08T02:20:00Z — Phase 10: Scenario classification (sub-scenarios under classes)

- Objective: Classify fraud scenarios under risk classes instead of a flat A–E list.
- Change: backend `POST /api/demo/reset` now also returns `catalogue` (id/class/title/description/expectation) and
  `classes`; classes: Legitimate baseline (A), Sender compromise (B), Beneficiary risk (C), Velocity abuse (D),
  Session compromise (E). Frontend picker uses grouped `<optgroup>`s + shows class/expectation caption.
  No engine/policy/score changes.
- Files modified: `backend/app/routers/demo.py`, `frontend/src/types.ts`, `frontend/src/pages/CustomerDashboard.tsx`.
- Commands: `pytest -q` → 14 passed; `npm run typecheck` → pass; catalogue endpoint smoke test → correct classes.
- Temp files removed: `backend/_verify_live.py` (earlier), `backend/_verify_link.py`, `vite-link.log`.
- Remaining: submit (push + Render Blueprint + env vars + smoke test).

---

## 2026-10-08T02:30:00Z — Phase 11: True customer verification (enforced identity proof)

- Objective: User feedback — checkbox-only "verification" was not credible. Replaced with an enforced identity
  checkpoint: demo OTP code must be confirmed before sender confirmation, and the backend rejects out-of-order
  calls (verify → 409 until identity done; wrong code → 422). Audit records identity_code_issued/identity_failed/
  identity_verified. No schema change: identity state lives on case.verification_state
  (unverified → identity_verified → sender_confirmed); demo code is deterministic per transaction
  (`(id*7919)%1e6`, documented prototype-only — production needs random, expiring, out-of-band codes).
- Files modified: `backend/app/routers/transactions.py` (POST /{id}/identity, POST /{id}/identity/confirm, 409 gate
  in verify, verification_state in GET), `backend/app/schemas.py` (IdentityConfirmRequest),
  `backend/tests/test_api.py` (identity steps + 409/422 assertions), `frontend/src/api.ts`,
  `frontend/src/pages/CustomerDashboard.tsx` (OTP panel, locked sender button, 5-step checklist), `README.md`.
- Commands: `pytest -q` → 14 passed; `npm run typecheck` → pass on retry (first attempt: Node OOM from disk
  pressure, transient — no code change between attempts).
- Remaining: submit.

---

## 2026-10-08T02:35:00Z — Phase 12: Push to GitHub

- Objective: Push to https://github.com/Strikertee/FlowGuard.
- Commands: `git init -b main; git add -A; git commit` (43 files); `git push -u origin main`.
- Problems: push failed first — TCP to github.com:443 fine but git/OpenSSL TLS handshake stalled; repo confirmed
  to exist via GitHub API (curl ok). Resolved repo-locally: `git config http.sslBackend schannel` → push succeeded,
  `main -> main`, tracking set.
- Remaining: Render Blueprint deploy + env vars + smoke test (dashboard-side, cannot be done from here).

---

## 2026-10-08T02:40:00Z — Phase 13: Customer submits, bank decides (action-framing fix)

- Objective: User feedback — customer page showed "Authorize / Approve" + "Escalate", wrongly implying the
  customer approves their own transfer. The backend already enforced bank-final-authority (customer APPROVE lands
  in `awaiting_officer`; block/officer-decision are officer-only), but the UI framing contradicted it.
- Change: customer buttons → "Confirm & submit to bank" + "Request officer review", with microcopy stating final
  authorization rests with the bank; outcome box → "Bank decision" + pending-officer-confirmation notice.
  Case detail page: officer APPROVE/ESCALATE/BLOCK controls render only in Ops context (`?ops`); customers see a
  read-only bank-decision note. Committed f29946a, pushed to origin/main.
- Commands: `npm run typecheck` → pass.
- Remaining: Render deploy + smoke test.

---

## 2026-10-08T02:50:00Z — Phase 14: PRD fine-tune (states, deny, history, DB, audit)

- Objective: User-supplied PRD demanded: §10 state vocabulary + simulated SETTLED; §5 confirm/deny + case history;
  §11 columns (normal_transaction_limit, bank, masked numbers, resolution); §15 step-up/settlement audit lines;
  §7 drivers/mitigating split.
- Change (backend): transaction statuses now CREATED → UNDER_REVIEW → CUSTOMER_VERIFIED →
  BENEFICIARY_SUBMITTED → RISK_REASSESSED → AUTHORIZED → SETTLED (officer APPROVE on AUTHORIZED simulates
  settlement via MockBankAdapter; direct officer APPROVE authorizes), STEP_UP_REQUIRED / ESCALATED / BLOCKED
  branches; case.resolution set on outcomes; deny keeps UNDER_REVIEW + sender_disputed; reassess logs
  step_up_completed for elevated suggestions; risk limit read from account.normal_transaction_limit;
  ensure_columns() backfills PRD columns on stale demo DBs. (frontend): deny button + disputed panel, customer
  case-history card, AWAITING_OFFICER notice, drivers/mitigating split in both risk views.
- Commands: `pytest -q` → 14 passed (new asserts: AUTHORIZED/AWAITING_OFFICER, officer APPROVE → SETTLED +
  payment_settled_simulated, deny → UNDER_REVIEW/sender_disputed); `npm run typecheck` → pass.
- Remaining: commit + push + Render deploy + smoke test.

---

## 2026-10-08T03:00:00Z — Phase 15: ALAT-style bank app around the verification flow

- Objective: User request — login, dashboard (balance, airtime/data/bills, last-3 history), "Enhanced protection"
  banner beside balance for large inflows, Verify-payment page (OTP + mock Face ID/fingerprint + checklist),
  officer completion in Ops.
- Change (backend): POST /api/auth/login (seeded email + demo PIN 1234, documented mock); GET /api/dashboard
  (account, last 3 txns, pending actionable inflow); POST /api/demo/topup (airtime/data/bill, deducts balance,
  SETTLED + audit, 422 if insufficient); POST /api/transactions/{id}/biometric (face|fingerprint, mocked,
  requires sender_confirmed, audited) — authorization now also requires biometric_verified (409 otherwise).
  (frontend): LoginPage, BankDashboard (balance hide/show, banner → /verify/:txnId, quick-action modals, history,
  demo inflow simulator), Verify page deep-links existing txns, biometric scan modal, protection checklist;
  App has auth guard + logout + role-aware nav.
- Commands: `pytest -q` → 15 passed (login 401/ok, dashboard shape, topup deduct/insufficient, biometric gate);
  `npm run typecheck` → pass (one fix: replaceAll → regex for ES2020 lib).
- Follow-up (pushed 7d530bb): user-specified layout — suspicious inflow nests under the Enhanced Protection
  header with a button labeled exactly "Verify" → /verify/:id; empty state offers one-click ₦4m simulation.
- Remaining: commit + push + Render deploy + smoke test.

---

## 2026-10-08T03:10:00Z — Phase 16: Bank-only authorization (governing principle enforced)

- Objective: User correction — customer evidence must never authorize funds. The customer authorize endpoint
  could still return APPROVE/AUTHORIZED. Restructured: POST /authorize now always returns SUBMITTED, records
  FlowGuard's recommendation (case/transaction decision), routes to AWAITING_OFFICER, logs review_requested,
  and never touches the mock ledger. Only officer-decision APPROVEs (authorizes + executes simulated
  settlement, audits authorization_decision). HOLD recommendation keeps UNDER_REVIEW containment.
- Change: schemas (DecisionOut.recommendation, CaseOut.resolution), transactions._finalize_authorize rewrite,
  cases.officerDecision always settle-on-approve, dashboard pending carries case_status/recommendation,
  UI shows SUBMITTED + assessment / recommendation-vs-bank-decision labels, new PRD.md (governing spec),
  AGENTS.md rule 2, README narration.
- Commands: `pytest -q` → 15 passed; `npm run typecheck` → pass.
- Remaining: commit + push + Render deploy + smoke test.
