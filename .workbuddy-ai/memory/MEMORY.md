# FlowGuard — project memory (durable)

## Local dev (this machine)
- **Backend:** `127.0.0.1:8010` — `backend/.venv/Scripts/python.exe -m uvicorn app.main:app --port 8010`
  (venv = managed Python 3.13.12). Set `CORS_ORIGINS` to include the frontend origin.
- **Frontend:** `localhost:5180` — `BACKEND_URL=http://localhost:8010 npm run dev -- --port 5180 --strictPort`.
- Ports **8000 / 5173 belong to other projects** — never default back to them.
- Vite binds IPv6 `[::1]` → always browse `http://localhost:5180`, never `127.0.0.1:5180`.
- The shell has an HTTP proxy set → `curl` to `127.0.0.1` returns 502. Use `curl --noproxy '*'` + `localhost`.
- `npm install` on Windows fails with esbuild `EBUSY` → use `npm install --ignore-scripts --no-audit --no-fund`
  (see the `vite-windows-deps` skill).

## Non-negotiable product rules (from PRD/AGENTS.md)
- Not a PND bypass; the bank is final authority. Never process real money.
- Backend owns risk score / decision / transaction state / audit. Frontend is a client only —
  `frontend/src/api.ts` is the single fetch layer.
- Incoming verification never auto-authorizes the outgoing payment; no single signal authorizes high value.
- Fail-safe: risk-service failure → HOLD, never auto-approve.

## Frontend conventions
- Stack: React 18 + Vite 5 + TS 5 (strict, no `any`) + Tailwind 3 + Lucide + React Router 6. No new deps.
- **Routes:** `/login` · `/` (bank dashboard) · `/verify/:txnId?` (verification flow) · `/ops` (officer ledger)
  · `/cases/:id` (case detail). All except `/login` are wrapped in `RequireAuth`.
- **Demo login:** `treasure@demo.bank` (customer) / `officer@demo.bank` (officer), PIN `1234` for both.
  Session lives in localStorage (`fg_user_id`, `fg_officer_id`, `fg_name`, `fg_role`); `api.ts` sends
  `X-User-Id` and the backend resolves the role server-side.
- Dark design system: tokens `obsidian #030712`, `carbon #0B0F19`, `panel #0E1424`, `line #1F2937`,
  `accent #22D3EE`; risk tones LOW emerald / MEDIUM amber / HIGH orange / CRITICAL rose.
  Glow shadows `glow-cyan|emerald|amber|rose`; animations `pulse-ring`, `fade-up`, `spin-slow`.
- Utility classes: `.fg-card`, `.fg-glass`, `.fg-input` (defined in `src/index.css`).
- Reusable components live in `src/components/ui.tsx` — reuse them; don't re-invent per page.
  `RiskBadge` accepts a minimal `{level, score}` or a full `RiskResult`.
- **Icons must be Lucide SVG, never emoji.**
- Backend-allowed purposes: `Debt repayment | Family support | Business payment | Savings | Other`
  (the frontend prompt's wider list would 422 — do not expand without changing the backend).

## Deploy (Render blueprint)
- `render.yaml` must keep the **SPA rewrite** `/* → /index.html` — without it, deep links/refreshes on
  `/login`, `/ops`, `/verify/:txnId`, `/cases/:id` 404 on the static host.
- **A Render static site is `type: web` + `runtime: static` — and must NOT have a `plan` field.**
  Render's schema (`https://render.com/schema/render.yaml.json`, definition `staticService`) pins `type` to
  the constant `web`, `runtime` to the constant `static`, and sets `additionalProperties: false` with no
  `plan` property (static sites are always free). Adding `plan: free` fails with
  `services[N].plan — no such plan free for service type web`. `type: static` is NOT valid.
  `plan: free` IS valid on the API service (`serverPlan` enum includes `free`).
- `CORS_ORIGINS` and `VITE_API_URL` are auto-wired with `fromService` (`RENDER_EXTERNAL_URL`), so no manual
  dashboard variables. `VITE_API_URL` is a **build-time** value — rebuild after changing it.
- API health check: `/api/health`.
- Validate changes against the official schema before pushing — it catches this class of error instantly.

## Verification recipe
- Backend: `pytest -q` (14 tests). Frontend: `tsc --noEmit`, `npm run build`.
- UI: Playwright-core + installed chromium (see the daily log for exact paths) driving the real flow.
- `PROCESS_LOG.md` at repo root is MANDATORY — append an entry after every meaningful stage.
