import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wallet,
  Wifi,
  X
} from 'lucide-react';
import { api, getSession } from '../api';
import { SCENARIO_CATALOGUE, type DashboardData, type ScenarioInfo } from '../types';
import { Eyebrow, Panel, RiskBadge, StatusPill, naira } from '../components/ui';
import ScenarioEvidence from '../components/ScenarioEvidence';

type TopupKind = 'airtime' | 'data' | 'bill' | null;

export default function BankDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [modal, setModal] = useState<TopupKind>(null);
  const [phone, setPhone] = useState('08030000000');
  const [amount, setAmount] = useState(500);
  const [network, setNetwork] = useState('MTN');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState('A');
  const [catalogue, setCatalogue] = useState<ScenarioInfo[] | null>(null);

  async function load() {
    setError('');
    try {
      setData(await api.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }

  useEffect(() => {
    load();
    api.scenarios().then((r) => setCatalogue(r.catalogue)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doTopup() {
    if (!modal) return;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const r = await api.topup(modal, amount, phone, network);
      setMsg(`${modal[0].toUpperCase() + modal.slice(1)} successful — new balance ${naira(r.balance)}`);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    setError('');
    setBusy(true);
    try {
      await api.incoming('Faith', 4_000_000, scenario);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setBusy(false);
    }
  }

  const name = getSession().name || data?.user.name || 'Customer';
  const pending = data?.pending ?? null;

  const quickActions = [
    { k: 'airtime' as const, label: 'Airtime', Icon: Smartphone },
    { k: 'data' as const, label: 'Data', Icon: Wifi },
    { k: 'bill' as const, label: 'Bills', Icon: Receipt }
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Good day,</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">{name}</h1>
        </div>
        <Link
          to="/verify"
          className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan"
        >
          <ShieldCheck size={16} aria-hidden /> Verify payment
        </Link>
      </div>

      {error && (
        <div role="alert" className="animate-fade-up rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {msg && (
        <div className="animate-fade-up rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {/* Balance card */}
        <Panel className="p-6 md:col-span-3">
          <div className="flex items-start justify-between">
            <Eyebrow>Available balance</Eyebrow>
            <Wallet size={16} className="text-slate-500" aria-hidden />
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className="font-mono text-3xl font-bold tracking-tight text-slate-50">
              {showBalance ? naira(data?.account.balance ?? 0) : '••••••'}
            </span>
            <button
              onClick={() => setShowBalance(!showBalance)}
              title="Toggle balance"
              aria-label="Toggle balance visibility"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-all duration-200 hover:text-accent"
            >
              {showBalance ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
            </button>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Savings · {data?.account.number_masked ?? '••••'}
          </p>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {quickActions.map(({ k, label, Icon }) => (
              <button
                key={k}
                onClick={() => setModal(k)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[11px] font-medium text-slate-300 transition-all duration-200 hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent"
              >
                <Icon size={17} aria-hidden />
                {label}
              </button>
            ))}
            <button
              onClick={() => nav('/verify')}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[11px] font-medium text-slate-300 transition-all duration-200 hover:border-accent/40 hover:bg-white/[0.06] hover:text-accent"
            >
              <ShieldCheck size={17} aria-hidden />
              Verify
            </button>
          </div>
        </Panel>

        {/* Enhanced Protection */}
        <Panel className={`p-6 md:col-span-2 ${pending ? 'border-amber-400/40 shadow-glow-amber' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              {pending ? (
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-amber-400/30" aria-hidden />
                  <ShieldAlert size={16} className="relative text-amber-300" aria-hidden />
                </span>
              ) : (
                <ShieldCheck size={16} className="text-emerald-400" aria-hidden />
              )}
              Enhanced protection
            </span>
            {pending && <RiskBadge risk={pending.risk} size="sm" />}
          </div>

          {pending ? (
            <div className="mt-3">
              <Eyebrow className="text-amber-400/80">Suspicious inflow under protection</Eyebrow>
              <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-slate-50">
                {naira(pending.transaction.amount)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                From <b className="text-slate-200">{pending.transaction.sender_name}</b> ·{' '}
                {pending.risk.level} risk ({pending.risk.score})
              </p>
              <div className="mt-2">
                <StatusPill status={pending.transaction.status} size="sm" />
              </div>
              {pending.case_status === 'AWAITING_OFFICER' ? (
                <Link
                  to={`/cases/${pending.case_id}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_0_24px_-8px_rgba(52,211,153,0.9)] transition-all duration-200 hover:from-emerald-300 hover:to-emerald-500"
                >
                  View case
                </Link>
              ) : (
                <button
                  onClick={() => nav(`/verify/${pending.transaction.id}`)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition-all duration-200 hover:bg-amber-400/20 hover:shadow-glow-amber"
                >
                  <ShieldCheck size={16} aria-hidden /> Verify
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-xs leading-relaxed text-slate-400">
                No unusual money right now. Everyday spending stays instant; anything anomalous lands here for
                verification.
              </p>
              <button
                disabled={busy}
                onClick={simulate}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                Simulate ₦4m inflow
              </button>
            </div>
          )}
        </Panel>
      </div>

      {/* Recent transactions */}
      <Panel>
        <div className="flex items-center justify-between border-b border-line bg-black/30 px-4 py-2.5">
          <span className="font-mono text-[11px] text-slate-500">ledger://recent</span>
          <span className="font-mono text-[11px] text-slate-600">last 3</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {(data?.recent ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.03]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    t.direction === 'IN'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-400'
                  }`}
                >
                  {t.direction === 'IN' ? <ArrowDownLeft size={15} aria-hidden /> : <ArrowUpRight size={15} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-xs font-semibold text-slate-200">
                    {t.direction === 'IN' ? t.sender_name : t.beneficiary_name || t.purpose}
                  </b>
                  <span className="block truncate text-[11px] text-slate-500">
                    {t.purpose || t.status} · {t.status.replace(/_/g, ' ')}
                  </span>
                </span>
              </span>
              <b className={`shrink-0 font-mono text-xs ${t.direction === 'IN' ? 'text-emerald-300' : 'text-slate-300'}`}>
                {t.direction === 'IN' ? '+' : '−'}
                {naira(t.amount)}
              </b>
            </li>
          ))}
          {(data?.recent ?? []).length === 0 && (
            <li className="px-4 py-8 text-center text-xs text-slate-500">No transactions yet.</li>
          )}
        </ul>
      </Panel>

      {/* Demo controls */}
      <Panel className="border-dashed p-5">
        <Eyebrow>Demo controls</Eyebrow>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="fg-input w-auto">
            {SCENARIO_CATALOGUE.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.title}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={simulate}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowDownLeft size={15} aria-hidden />}
            Simulate Faith → you ₦4,000,000
          </button>
        </div>
        <ScenarioEvidence entry={catalogue?.find((s) => s.id === scenario)} />
      </Panel>

      {/* Top-up modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="fg-card w-full max-w-sm p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold capitalize text-slate-100">Buy {modal}</h3>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors duration-200 hover:text-slate-100"
              >
                <X size={15} aria-hidden />
              </button>
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-400">
              {modal === 'bill' ? 'Biller' : 'Network'}
              <select value={network} onChange={(e) => setNetwork(e.target.value)} className="fg-input mt-1.5">
                {(modal === 'bill' ? ['PHCN', 'DSTV', 'GOTV', 'Lagos Water'] : ['MTN', 'Airtel', 'Glo', '9mobile']).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-medium text-slate-400">
              {modal === 'bill' ? 'Account / smartcard' : 'Phone number'}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="fg-input mt-1.5 font-mono" />
            </label>

            <label className="mt-3 block text-xs font-medium text-slate-400">
              Amount (₦)
              <input
                type="number"
                min={1}
                max={100000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="fg-input mt-1.5 font-mono"
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-500">
              Max {naira(100000)} per simulated purchase.
            </p>

            <button
              disabled={busy || amount <= 0 || amount > 100000}
              onClick={doTopup}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {busy ? 'Processing…' : `Pay ${naira(amount)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Simulated purchase — recorded in history, no real value moves.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
