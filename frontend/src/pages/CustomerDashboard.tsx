import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, KeyRound, Landmark, ShieldCheck, UserCheck } from 'lucide-react';
import { api, setIds } from '../api';
import { PURPOSES, SCENARIO_CATALOGUE, type RiskResult, type Transaction } from '../types';
import { RiskBadge, ScoreBar, naira } from '../components/ui';

type Step = 'idle' | 'alert' | 'verified' | 'reassessed' | 'decided';

export default function CustomerDashboard() {
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
  const [purpose, setPurpose] = useState('Debt repayment');
  const [beneficiary, setBeneficiary] = useState('John Doe');
  const [decision, setDecision] = useState<{ decision: string; reason: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.reset('A').then((r) => setIds(r.customer_id, r.officer_id)).catch(() => {});
  }, []);

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
    setCaseId(inc.case_id);
    setRisk(inc.risk);
    setStep('alert');
    setDecision(null);
    setIdentityCode(null);
    setIdentityChannel('');
    setCodeInput('');
    setIdentityDone(false);
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

  async function authorize() {
    if (!txn) return;
    const r = await run(() => api.authorize(txn.id));
    if (!r) return;
    setRisk(r.risk);
    setDecision({ decision: r.decision, reason: r.reason });
    setStep('decided');
    const g = await api.getTxn(txn.id).catch(() => null);
    if (g) setTxn(g.transaction);
  }

  async function escalate() {
    if (!txn) return;
    await run(() => api.escalate(txn.id));
    setDecision({ decision: 'ESCALATE', reason: 'Customer requested officer review.' });
    setStep('decided');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl bg-ink p-6 text-white">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Landmark size={16} /> FlowGuard · Customer demo · Treasure
        </div>
        <h1 className="mt-2 text-2xl font-bold">₦4,000,000 received → verify it in seconds</h1>
        <p className="mt-1 text-sm text-slate-300">
          Normal history max is ₦500,000, so this credit is flagged unusual. Verify sender, purpose and
          beneficiary — the bank reassesses risk before anything is authorized. No real money moves.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">1 · Simulate incoming transfer</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Scenario
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
              {Array.from(new Set(SCENARIO_CATALOGUE.map((s) => s.class))).map((cls) => (
                <optgroup key={cls} label={cls}>
                  {SCENARIO_CATALOGUE.filter((s) => s.class === cls).map((s) => (
                    <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Sender
            <input value={sender} onChange={(e) => setSender(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-sm">
            Amount (₦)
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Class: {SCENARIO_CATALOGUE.find((s) => s.id === scenario)?.class} · Expected:{' '}
          {SCENARIO_CATALOGUE.find((s) => s.id === scenario)?.expectation}
        </p>
        <button disabled={busy} onClick={start} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <ArrowRight size={16} /> Simulate Faith → Treasure
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {txn && step !== 'idle' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle size={18} /> Unusual transaction alert
            </div>
            <RiskBadge risk={risk} size="sm" />
          </div>
          <p className="mt-2 text-2xl font-bold">{naira(txn.amount)} <span className="text-sm font-normal text-slate-500">from {txn.sender_name}</span></p>
          {risk && <div className="mt-2"><ScoreBar score={risk.score} /></div>}
          {caseId && <p className="mt-1 text-xs text-slate-500">Case #{caseId} · status {txn.status} · decision {txn.decision}</p>}
        </div>
      )}

      {step !== 'idle' && txn && (
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: 'Identity', done: identityDone },
              { label: 'Sender', done: step === 'verified' || step === 'reassessed' || step === 'decided' },
              { label: 'Details', done: Boolean(txn.purpose && txn.beneficiary_name) },
              { label: 'Risk', done: step === 'reassessed' || step === 'decided' },
              { label: 'Decision', done: step === 'decided' }
            ].map((s) => (
              <span key={s.label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${s.done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-mist text-slate-500'}`}>
                {s.done ? <CheckCircle2 size={13} /> : <span className="h-3 w-3 rounded-full border border-slate-300" />}
                {s.label}
              </span>
            ))}
          </div>

          <h2 className="font-semibold">2 · Prove it's you, then review</h2>
          <div className="rounded-xl border border-slate-200 bg-mist p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={15} /> Identity check — one-time code
              {identityDone && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">verified</span>}
            </div>
            {!identityDone ? (
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-slate-600">
                  To rule out account takeover, enter the one-time code sent to <b>{identityChannel || 'your verified phone'}</b>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={busy} onClick={sendCode} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">
                    {identityCode ? 'Resend code' : 'Send code'}
                  </button>
                  {identityCode && (
                    <span className="rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 font-mono text-base font-bold tracking-widest">
                      {identityCode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Prototype: the code is displayed here. Production delivers it by SMS/authenticator.</p>
                {identityCode && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="6-digit code" maxLength={6} className="w-36 rounded-lg border p-2 font-mono" />
                    <button disabled={busy || !codeInput} onClick={confirmCode} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      Verify me
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={15} /> Identity verified — this session is proven to be Treasure.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={expected} onChange={(e) => setExpected(e.target.checked)} className="mt-1" />
            <span>I recognise <b>{txn.sender_name}</b> and this payment was expected.</span>
          </label>
          <button disabled={busy || !identityDone} onClick={verify} title={!identityDone ? 'Complete the identity check first' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <UserCheck size={16} /> Confirm sender
          </button>
          {!identityDone && <p className="-mt-2 text-xs text-slate-400">Complete the identity check above to unlock sender confirmation — the backend enforces this order.</p>}

          <h2 className="font-semibold pt-2">3 · Purpose & beneficiary</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">Purpose
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
                {PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-sm">Beneficiary (onward payment)
              <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
            </label>
          </div>
          <button disabled={busy} onClick={submitPurposeAndBeneficiary} className="rounded-xl border px-4 py-2 text-sm font-semibold">
            Save purpose & beneficiary
          </button>

          <h2 className="font-semibold pt-2">4 · Reassess risk</h2>
          <button disabled={busy} onClick={reassess} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <ShieldCheck size={16} /> Reassess risk
          </button>

          {risk && step !== 'alert' && (
            <div className="rounded-xl bg-mist p-4">
              <div className="flex items-center justify-between">
                <b>Explainable risk score</b>
                <RiskBadge risk={risk} size="sm" />
              </div>
              <div className="mt-2"><ScoreBar score={risk.score} /></div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {risk.factors.map((f) => (
                  <li key={f.signal} className="flex justify-between gap-3 border-b border-slate-200 py-1 last:border-0">
                    <span>{f.explanation}</span>
                    <b className={f.points >= 0 ? 'text-red-600' : 'text-emerald-600'}>{f.points > 0 ? `+${f.points}` : f.points}</b>
                  </li>
                ))}
              </ul>
              {decision && <p className="mt-2 text-sm"><b>Suggested:</b> {decision.decision} — {decision.reason}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={busy} onClick={authorize} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <BadgeCheck size={16} /> Authorize / Approve
            </button>
            <button disabled={busy} onClick={escalate} className="rounded-xl border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-700">
              Escalate to officer
            </button>
          </div>

          {step === 'decided' && decision && (
            <div className="rounded-xl border border-slate-200 bg-mist p-4 text-sm">
              <b>Outcome: {decision.decision}</b>
              <p className="text-slate-600">{decision.reason}</p>
              <p className="mt-1 text-slate-500">Authorization simulated — no money moved. Track progress under Case #{caseId} or in Ops.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
