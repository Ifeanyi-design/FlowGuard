import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Receipt,
  ShieldCheck,
  Smartphone,
  Wifi,
  X
} from 'lucide-react';
import { api, getSession } from '../api';
import { SCENARIO_CATALOGUE, type DashboardData } from '../types';
import { naira } from '../components/ui';

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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Good day,</p>
          <h1 className="text-2xl font-bold">{name}</h1>
        </div>
        <Link to="/verify" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">Verify payment</Link>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-2xl bg-ink p-6 text-white md:col-span-3">
          <p className="text-xs uppercase tracking-wide text-slate-300">Available balance</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl font-bold">{showBalance ? naira(data?.account.balance ?? 0) : '••••••'}</span>
            <button onClick={() => setShowBalance(!showBalance)} className="text-slate-300" title="Toggle balance">
              {showBalance ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-300">Savings · {data?.account.number_masked ?? '••••'}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { k: 'airtime' as const, label: 'Airtime', Icon: Smartphone },
              { k: 'data' as const, label: 'Data', Icon: Wifi },
              { k: 'bill' as const, label: 'Bills', Icon: Receipt }
            ].map(({ k, label, Icon }) => (
              <button key={k} onClick={() => setModal(k)} className="rounded-xl bg-white/10 p-3 hover:bg-white/20">
                <Icon size={18} className="mx-auto" />{label}
              </button>
            ))}
            <button onClick={() => nav('/verify')} className="rounded-xl bg-white/10 p-3 hover:bg-white/20">
              <ShieldCheck size={18} className="mx-auto" />Verify
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-6 md:col-span-2 ${pending ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} className={pending ? 'text-amber-600' : 'text-emerald-600'} />
            Enhanced protection
          </div>
          {pending ? (
            <div className="mt-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Suspicious inflow under protection</p>
              <p className="mt-1 text-2xl font-bold">{naira(pending.transaction.amount)}</p>
              <p className="text-slate-600">
                From {pending.transaction.sender_name} · {pending.risk.level} risk ({pending.risk.score}) ·{' '}
                {pending.transaction.status.replace(/_/g, ' ')}
              </p>
              {pending.transaction.status === 'AUTHORIZED' ? (
                <Link to={`/cases/${pending.case_id}`} className="mt-3 inline-block rounded-xl bg-ink px-4 py-2 font-semibold text-white">View case</Link>
              ) : (
                <button onClick={() => nav(`/verify/${pending.transaction.id}`)} className="mt-3 rounded-xl bg-ink px-4 py-2 font-semibold text-white">
                  Verify
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-500">
              <p>No unusual money right now. Everyday spending stays instant; anything anomalous lands here for verification.</p>
              <button disabled={busy} onClick={simulate} className="mt-2 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50">
                Simulate ₦4m inflow
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Last transactions</h2>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {(data?.recent ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className={`rounded-full p-2 ${t.direction === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {t.direction === 'IN' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </span>
                <span>
                  <b>{t.direction === 'IN' ? t.sender_name : t.beneficiary_name || t.purpose}</b>
                  <span className="block text-xs text-slate-400">{t.purpose || t.status} · {t.status.replace(/_/g, ' ')}</span>
                </span>
              </span>
              <b className={t.direction === 'IN' ? 'text-emerald-600' : ''}>
                {t.direction === 'IN' ? '+' : '−'}{naira(t.amount)}
              </b>
            </li>
          ))}
          {(data?.recent ?? []).length === 0 && <li className="py-3 text-slate-400">No transactions yet.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed bg-white p-5 text-sm">
        <b>Demo controls</b>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="rounded-lg border p-2">
            {SCENARIO_CATALOGUE.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
          </select>
          <button disabled={busy} onClick={simulate} className="rounded-xl bg-ink px-3 py-2 font-semibold text-white disabled:opacity-50">
            Simulate Faith → you ₦4,000,000
          </button>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold capitalize">Buy {modal}</h3>
              <button onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <label className="mt-3 block text-sm">{modal === 'bill' ? 'Biller' : 'Network'}
              <select value={network} onChange={(e) => setNetwork(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
                {(modal === 'bill' ? ['PHCN', 'DSTV', 'GOTV', 'Lagos Water'] : ['MTN', 'Airtel', 'Glo', '9mobile']).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-sm">{modal === 'bill' ? 'Account / smartcard' : 'Phone number'}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border p-2 font-mono" />
            </label>
            <label className="mt-2 block text-sm">Amount (₦)
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <button disabled={busy} onClick={doTopup} className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Processing…' : `Pay ${naira(amount)}`}
            </button>
            <p className="mt-1 text-center text-xs text-slate-400">Simulated purchase — recorded in history, no real value moves.</p>
          </div>
        </div>
      )}
    </div>
  );
}
