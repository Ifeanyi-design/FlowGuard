import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Fingerprint,
  KeyRound,
  Landmark,
  Loader2,
  ScanFace,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api, setIds } from '../api';
import { PURPOSES, SCENARIO_CATALOGUE, type CaseItem, type RiskResult, type Transaction } from '../types';
import {
  Eyebrow,
  Panel,
  RiskBadge,
  ScoreBar,
  SectionHeading,
  StepBadge,
  StatusPill,
  naira
} from '../components/ui';

type Step = 'idle' | 'alert' | 'verified' | 'reassessed' | 'decided';

const DONE_STEPS: Step[] = ['verified', 'reassessed', 'decided'];

export default function CustomerDashboard() {
  const { txnId } = useParams();
  const [scenario, setScenario] = useState('A');
  const [sender, setSender] = useState('Faith');
  const [amount, setAmount] = useState(4000000);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [expected, setExpected] = useState(false);
  const [identityCode, setIdentityCode] = useState<string | null>(null);
  const [identityChannel, setIdentityChannel] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [identityDone, setIdentityDone] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [bioDone, setBioDone] = useState(false);
  const [bioModal, setBioModal] = useState<null | 'face' | 'fingerprint'>(null);
  const [bioScanning, setBioScanning] = useState(false);
  const timer = useRef<number | null>(null);
  const [history, setHistory] = useState<{ case: CaseItem; transaction: Transaction }[]>([]);
  const [purpose, setPurpose] = useState('Debt repayment');
  const [beneficiary, setBeneficiary] = useState('John Doe');
  const [decision, setDecision] = useState<{ decision: string; reason: string; caseStatus?: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (txnId) {
      loadExisting(Number(txnId));
    } else {
      api
        .reset('A')
        .then((r) => setIds(r.customer_id, r.officer_id))
        .catch(() => {});
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExisting(id: number) {
    setError('');
    try {
      const g = await api.getTxn(id);
      setTxn(g.transaction);
      setCaseId(g.case_id);
      setRisk(g.risk);
      syncIdentity(g.verification_state);
      setPurpose(g.transaction.purpose || 'Debt repayment');
      setBeneficiary(g.transaction.beneficiary_name || 'John Doe');
      setStep('alert');
      setDecision(null);
      setDisputed(false);
      setBioDone(g.verification_state === 'biometric_verified');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transaction');
    }
  }

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setError('');
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const r = await run(() => api.reset(scenario));
    if (!r) return;
    setIds(r.customer_id, r.officer_id);
    const inc = await run(() => api.incoming(sender || 'Faith', amount, scenario));
    if (!inc) return;
    setTxn(inc.transaction);
    loadHistory();
    setCaseId(inc.case_id);
    setRisk(inc.risk);
    setStep('alert');
    setDecision(null);
    setIdentityCode(null);
    setIdentityChannel('');
    setCodeInput('');
    setIdentityDone(false);
    setDisputed(false);
    setBioDone(false);
    setBioModal(null);
  }

  async function loadHistory() {
    const r = await api.cases().catch(() => null);
    if (r) setHistory(r.cases);
  }

  function syncIdentity(v?: string) {
    setIdentityDone(v === 'identity_verified' || v === 'sender_confirmed');
  }

  async function sendCode() {
    if (!txn) return;
    const r = await run(() => api.identity(txn.id));
    if (!r) return;
    setIdentityCode(r.code);
    setIdentityChannel(r.channel);
  }

  async function confirmCode() {
    if (!txn) return;
    const r = await run(() => api.identityConfirm(txn.id, codeInput));
    if (!r) return;
    setIdentityDone(true);
    setIdentityCode(null);
    setCodeInput('');
  }

  async function verify() {
    if (!txn) return;
    const r = await run(() => api.verify(txn.id, true, expected));
    if (!r) return;
    const g = await run(() => api.getTxn(txn.id));
    if (g) {
      setTxn(g.transaction);
      syncIdentity(g.verification_state);
    }
    setStep('verified');
  }

  async function submitPurposeAndBeneficiary() {
    if (!txn) return;
    const p = await run(() => api.purpose(txn.id, purpose));
    if (!p) return;
    const b = await run(() => api.beneficiary(txn.id, beneficiary));
    if (!b) return;
    const g = await run(() => api.getTxn(txn.id));
    if (g) {
      setTxn(g.transaction);
      syncIdentity(g.verification_state);
      if (g.risk) setRisk(g.risk);
    }
  }

  async function reassess() {
    if (!txn) return;
    const r = await run(() => api.reassess(txn.id));
    if (!r) return;
    setRisk(r.risk);
    setDecision({ decision: r.suggested_decision, reason: r.reason });
    setStep('reassessed');
  }

  function startBio(method: 'face' | 'fingerprint') {
    if (!txn || bioScanning) return;
    setBioModal(method);
    setBioScanning(true);
    setError('');
    timer.current = window.setTimeout(async () => {
      try {
        await api.biometric(txn.id, method);
        setBioDone(true);
        setBioModal(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Biometric check failed');
        setBioModal(null);
      } finally {
        setBioScanning(false);
      }
    }, 1800);
  }

  async function authorize() {
    if (!txn) return;
    const r = await run(() => api.authorize(txn.id));
    if (!r) return;
    setRisk(r.risk);
    setDecision({ decision: r.decision, reason: r.reason, caseStatus: r.case_status });
    setStep('decided');
    const g = await api.getTxn(txn.id).catch(() => null);
    if (g) setTxn(g.transaction);
    loadHistory();
  }

  async function deny() {
    if (!txn) return;
    const r = await run(() => api.verify(txn.id, false, false));
    if (!r) return;
    setDisputed(true);
    const g = await api.getTxn(txn.id).catch(() => null);
    if (g) setTxn(g.transaction);
  }

  async function escalate() {
    if (!txn) return;
    await run(() => api.escalate(txn.id));
    setDecision({ decision: 'ESCALATE', reason: 'Customer requested officer review.' });
    setStep('decided');
  }

  const activeScenario = SCENARIO_CATALOGUE.find((s) => s.id === scenario);
  const steps = [
    { label: 'Identity', done: identityDone },
    { label: 'Sender', done: DONE_STEPS.includes(step) },
    { label: 'Details', done: Boolean(txn?.purpose && txn?.beneficiary_name) },
    { label: 'Risk', done: step === 'reassessed' || step === 'decided' },
    { label: 'Decision', done: step === 'decided' }
  ];
  const activeStep = steps.findIndex((s) => !s.done);
  const showProtection = step === 'reassessed' || step === 'decided';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Hero */}
      <div className="animate-fade-up">
        <Eyebrow>
          <span className="inline-flex items-center gap-1.5">
            <Landmark size={12} aria-hidden /> FlowGuard · Customer demo · Treasure
          </span>
        </Eyebrow>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
          <span className="font-mono text-accent">₦4,000,000</span> received → verify it in seconds
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
          Normal history max is ₦500,000, so this credit is flagged unusual. Verify sender, purpose and
          beneficiary — the bank reassesses risk before anything is authorized. No real money moves.
        </p>
      </div>

      {/* Step 1 — sandbox control panel */}
      <Panel className="animate-fade-up">
        <div className="flex items-center justify-between border-b border-line bg-black/30 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </span>
            <span className="font-mono text-[11px] text-slate-500">sandbox://incoming-transfer</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            LIVE
          </span>
        </div>

        <div className="space-y-4 p-5">
          <SectionHeading
            index="1"
            title="Simulate incoming transfer"
            hint="Pick a fraud scenario, then inject the credit into the sandbox."
            icon={ArrowRight}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SCENARIO_CATALOGUE.map((s) => {
              const on = s.id === scenario;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  aria-pressed={on}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all duration-200 ${
                    on
                      ? 'border-accent/50 bg-accent/10 text-accent shadow-glow-cyan'
                      : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-xs font-bold">{s.id}</span>
                  <span className="text-[11px] leading-tight">{s.title}</span>
                </button>
              );
            })}
          </div>

          <p className="font-mono text-[11px] text-slate-500">
            <span className="text-accent">&gt;</span> class: <span className="text-slate-300">{activeScenario?.class}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            expected: <span className="text-slate-300">{activeScenario?.expectation}</span>
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-400">
              Sender
              <input value={sender} onChange={(e) => setSender(e.target.value)} className="fg-input mt-1.5" />
            </label>
            <label className="text-xs font-medium text-slate-400">
              Amount (₦)
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="fg-input mt-1.5 font-mono"
              />
            </label>
            <div className="flex items-end">
              <button
                disabled={busy}
                onClick={start}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
                Simulate Faith → Treasure
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div
          role="alert"
          className="animate-fade-up rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Alert banner */}
      {txn && step !== 'idle' && (
        <Panel className="animate-fade-up border-amber-400/40 shadow-glow-amber">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="flex items-start gap-4">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-300">
                <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-amber-400/25" aria-hidden />
                <AlertTriangle size={20} className="relative" aria-hidden />
              </span>
              <div>
                <Eyebrow className="text-amber-400/80">Unusual transaction alert</Eyebrow>
                <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                  {naira(txn.amount)}
                </div>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                  Incoming credit from <b className="text-slate-200">{txn.sender_name}</b> — significantly higher
                  than your usual activity. Your funds remain protected while we verify the transaction.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <RiskBadge risk={risk} size="sm" />
              <span className="font-mono text-[11px] text-slate-500">Case #{caseId}</span>
              <StatusPill status={txn.status} size="sm" />
            </div>
          </div>
          <div className="px-5 pb-5">
            <ScoreBar score={risk?.score ?? 0} level={risk?.level} />
          </div>
        </Panel>
      )}

      {/* Workflow */}
      {step !== 'idle' && txn && (
        <Panel className="animate-fade-up">
          <div className="space-y-6 p-5">
            {/* Stepper */}
            <div className="flex flex-wrap items-center gap-2">
              {steps.map((s, i) => (
                <Fragment key={s.label}>
                  <StepBadge label={s.label} done={s.done} active={i === activeStep} />
                  {i < steps.length - 1 && <span className="hidden h-px w-4 bg-white/10 sm:block" aria-hidden />}
                </Fragment>
              ))}
            </div>

            {/* 2 — identity */}
            <div className="space-y-3">
              <SectionHeading
                index="2"
                title="Prove it's you, then review"
                hint="An identity check runs first so a compromised session can't wave the payment through."
                icon={Fingerprint}
              />
              <div className="rounded-xl border border-line bg-black/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <KeyRound size={14} className="text-accent" aria-hidden /> Identity check — one-time code
                  </span>
                  {identityDone && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 size={11} aria-hidden /> verified
                    </span>
                  )}
                </div>

                {!identityDone ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs leading-relaxed text-slate-400">
                      To rule out account takeover, enter the one-time code sent to{' '}
                      <b className="text-slate-200">{identityChannel || 'your verified phone'}</b>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        disabled={busy}
                        onClick={sendCode}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-accent/40 hover:text-accent disabled:opacity-50"
                      >
                        {identityCode ? 'Resend code' : 'Send code'}
                      </button>
                      {identityCode && (
                        <span className="rounded-lg border border-dashed border-amber-400/60 bg-amber-400/10 px-3 py-1.5 font-mono text-base font-bold tracking-[0.3em] text-amber-200">
                          {identityCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Prototype: the code is shown here. Production delivers it out-of-band via SMS/authenticator.
                    </p>
                    {identityCode && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value)}
                          placeholder="6-digit code"
                          maxLength={6}
                          inputMode="numeric"
                          className="fg-input w-36 font-mono tracking-[0.3em]"
                        />
                        <button
                          disabled={busy || !codeInput}
                          onClick={confirmCode}
                          className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-40"
                        >
                          <ShieldCheck size={14} aria-hidden /> Verify me
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 size={14} aria-hidden /> Identity verified — this session is proven to be Treasure.
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={expected}
                  onChange={(e) => setExpected(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 accent-cyan-400"
                />
                <span>
                  I recognise <b className="text-slate-100">{txn.sender_name}</b> and this payment was expected.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy || !identityDone}
                  onClick={verify}
                  title={!identityDone ? 'Complete the identity check first' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-all duration-200 hover:bg-emerald-500/25 hover:shadow-glow-emerald disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserCheck size={16} aria-hidden /> Confirm sender
                </button>
                <button
                  disabled={busy || !identityDone}
                  onClick={deny}
                  title={!identityDone ? 'Complete the identity check first' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/5 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/15 hover:shadow-glow-rose disabled:cursor-not-allowed disabled:opacity-40"
                >
                  I don't recognise this
                </button>
              </div>
              {!identityDone && (
                <p className="text-[11px] text-slate-500">
                  Complete the identity check above to unlock sender confirmation — the backend enforces this order.
                </p>
              )}
              {disputed && (
                <div className="animate-fade-up rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-xs leading-relaxed text-rose-200">
                  <b>You marked this transaction as unrecognised.</b> It stays contained under review — nothing can
                  be authorized from a disputed transaction. If this wasn't you, request an officer review below.
                </div>
              )}
            </div>

            {/* 3 — purpose & beneficiary */}
            <div className="space-y-3 border-t border-line pt-5">
              <SectionHeading
                index="3"
                title="Purpose & beneficiary"
                hint="Context for the onward payment. A legitimate credit never auto-clears the beneficiary."
                icon={ArrowRight}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-400">
                  Purpose
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="fg-input mt-1.5">
                    {PURPOSES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-400">
                  Beneficiary (onward payment)
                  <input
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    className="fg-input mt-1.5"
                  />
                </label>
              </div>
              <button
                disabled={busy}
                onClick={submitPurposeAndBeneficiary}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                Save purpose & beneficiary
              </button>
            </div>

            {/* 4 — reassess + explainable risk */}
            <div className="space-y-3 border-t border-line pt-5">
              <SectionHeading
                index="4"
                title="Reassess risk"
                hint="A second assessment runs on the intended outgoing payment."
                icon={ShieldCheck}
              />
              <button
                disabled={busy}
                onClick={reassess}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
                Reassess risk
              </button>

              {risk && step !== 'alert' && (
                <div className="rounded-xl border border-line bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">Explainable risk score</span>
                    <RiskBadge risk={risk} size="sm" />
                  </div>
                  <div className="mt-3">
                    <ScoreBar score={risk.score} level={risk.level} />
                  </div>

                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Risk drivers
                  </p>
                  <ul className="mt-1 divide-y divide-white/5">
                    {risk.factors
                      .filter((f) => f.points >= 0)
                      .map((f) => (
                        <li key={f.signal} className="flex items-start justify-between gap-3 py-2 text-xs">
                          <span className="text-slate-300">{f.explanation}</span>
                          <b className="shrink-0 font-mono text-rose-300">+{f.points}</b>
                        </li>
                      ))}
                    {risk.factors.filter((f) => f.points >= 0).length === 0 && (
                      <li className="py-2 text-xs text-slate-500">No adverse drivers.</li>
                    )}
                  </ul>

                  {risk.factors.some((f) => f.points < 0) && (
                    <>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Mitigating
                      </p>
                      <ul className="mt-1 divide-y divide-white/5">
                        {risk.factors
                          .filter((f) => f.points < 0)
                          .map((f) => (
                            <li key={f.signal} className="flex items-start justify-between gap-3 py-2 text-xs">
                              <span className="text-slate-300">{f.explanation}</span>
                              <b className="shrink-0 font-mono text-emerald-300">{f.points}</b>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}

                  {decision && (
                    <p className="mt-3 border-t border-line pt-3 text-xs text-slate-400">
                      <b className="text-slate-200">Suggested:</b> {decision.decision} — {decision.reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 5 — protection checklist */}
            {showProtection && risk && (
              <div className="space-y-3 border-t border-line pt-5">
                <SectionHeading
                  index="5"
                  title="Protection checklist"
                  hint="Every control that was applied to this payment."
                  icon={CheckCircle2}
                />
                <ul className="space-y-2 rounded-xl border border-line bg-black/30 p-4 text-xs">
                  {[
                    {
                      label: `Amount screening — ${naira(txn.amount)} vs ${naira(500000)} usual max`,
                      st: risk.factors.some((f) => f.signal === 'amount_deviation') ? ('flag' as const) : ('ok' as const)
                    },
                    {
                      label: 'Device check',
                      st: risk.factors.some((f) => f.signal === 'new_device')
                        ? ('flag' as const)
                        : risk.factors.some((f) => f.signal === 'trusted_device')
                          ? ('ok' as const)
                          : ('pending' as const)
                    },
                    {
                      label: 'Sender intelligence',
                      st: risk.factors.some((f) => f.signal === 'sender_risk')
                        ? ('flag' as const)
                        : risk.factors.some((f) => f.signal === 'known_sender')
                          ? ('ok' as const)
                          : ('pending' as const)
                    },
                    {
                      label: 'Beneficiary screening',
                      st: risk.factors.some((f) => f.signal === 'beneficiary_risk' || f.signal === 'new_beneficiary')
                        ? ('flag' as const)
                        : risk.factors.some((f) => f.signal === 'known_beneficiary')
                          ? ('ok' as const)
                          : ('pending' as const)
                    },
                    { label: 'Customer identity (one-time code)', st: identityDone ? ('ok' as const) : ('pending' as const) },
                    { label: 'Biometric (Face ID / fingerprint)', st: bioDone ? ('ok' as const) : ('pending' as const) },
                    { label: 'Bank review', st: step === 'decided' ? ('ok' as const) : ('pending' as const) }
                  ].map((c) => (
                    <li key={c.label} className="flex items-center gap-2.5">
                      {c.st === 'ok' && <CheckCircle2 size={15} className="shrink-0 text-emerald-400" aria-hidden />}
                      {c.st === 'flag' && <AlertTriangle size={15} className="shrink-0 text-amber-400" aria-hidden />}
                      {c.st === 'pending' && <Clock size={15} className="shrink-0 text-slate-600" aria-hidden />}
                      <span className={c.st === 'pending' ? 'text-slate-500' : 'text-slate-300'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6 — biometric */}
            {showProtection && (
              <div className="space-y-3 border-t border-line pt-5">
                <SectionHeading
                  index="6"
                  title="Verify payment — biometric"
                  hint="Confirm it's really you with Face ID or fingerprint. Mock check — no real biometrics."
                  icon={ScanFace}
                />
                {!bioDone ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() => startBio('face')}
                      className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
                    >
                      <ScanFace size={16} aria-hidden /> Face ID
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => startBio('fingerprint')}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all duration-200 hover:border-accent/40 hover:text-accent disabled:opacity-50"
                    >
                      <Fingerprint size={16} aria-hidden /> Fingerprint
                    </button>
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 size={14} aria-hidden /> Biometric verified — payment check complete.
                  </p>
                )}
              </div>
            )}

            {/* Decision outcome */}
            {step === 'decided' && decision && (
              <div className="animate-fade-up space-y-1.5 rounded-xl border border-line bg-black/40 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <BadgeCheck size={16} className="text-accent" aria-hidden /> Bank decision: {decision.decision}
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{decision.reason}</p>
                {decision.decision === 'APPROVE' && decision.caseStatus === 'AWAITING_OFFICER' && (
                  <p className="text-xs font-semibold text-amber-300">
                    Pending final confirmation by a bank officer in the Ops dashboard.
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Authorization simulated — no money moved. Track progress under Case #{caseId} or in Ops.
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Floating execution panel */}
      {step !== 'idle' && txn && (
        <div className="fg-glass sticky bottom-3 z-30 space-y-2 rounded-2xl border border-line px-4 py-3 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300">
                <Landmark size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-slate-100">{naira(txn.amount)}</div>
                <div className="truncate text-[11px] text-slate-500">
                  Case #{caseId} · {decision ? decision.decision : 'awaiting decision'}
                </div>
              </div>
              <RiskBadge risk={risk} size="sm" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || !bioDone}
                onClick={authorize}
                title={!bioDone ? 'Complete biometric verification first' : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_0_24px_-8px_rgba(52,211,153,0.9)] transition-all duration-200 hover:from-emerald-300 hover:to-emerald-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
              >
                <BadgeCheck size={16} aria-hidden /> Confirm & submit to bank
              </button>
              <button
                disabled={busy}
                onClick={escalate}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-all duration-200 hover:bg-amber-400/15 hover:shadow-glow-amber disabled:opacity-50"
              >
                Request officer review
              </button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Your confirmation submits the case for a bank decision — final authorization always rests with the bank,
            never the customer.
            {!bioDone && showProtection && ' Complete biometric verification above to unlock submission.'}
          </p>
        </div>
      )}

      {/* Case history */}
      {history.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between border-b border-line bg-black/30 px-4 py-2.5">
            <span className="font-mono text-[11px] text-slate-500">case history</span>
            <span className="font-mono text-[11px] text-slate-600">{history.length} records</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {history.map((h) => (
              <li
                key={h.case.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2 text-xs">
                  <Link
                    to={`/cases/${h.case.id}`}
                    className="font-mono font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    Case #{h.case.id}
                  </Link>
                  <span className="text-slate-500">
                    {naira(h.transaction.amount)} · {h.transaction.sender_name} →{' '}
                    {h.transaction.beneficiary_name || '—'}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={h.case.status} size="sm" />
                  <span className="font-mono text-[11px] text-slate-500">{h.case.decision}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Biometric modal */}
      {bioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="fg-card w-full max-w-xs p-6 text-center">
            <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-accent/25" aria-hidden />
              {bioModal === 'face' ? (
                <ScanFace size={40} className="relative animate-pulse" aria-hidden />
              ) : (
                <Fingerprint size={40} className="relative animate-pulse" aria-hidden />
              )}
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-100">{bioScanning ? 'Scanning…' : 'Done'}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Mock {bioModal === 'face' ? 'Face ID' : 'fingerprint'} — prototype only, no real biometrics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
