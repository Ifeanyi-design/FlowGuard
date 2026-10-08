import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import type { CaseItem, Transaction } from '../types';
import { Panel, RiskBadge, StatusPill, naira, riskTone } from '../components/ui';

interface Row {
  case: CaseItem;
  transaction: Transaction;
  customer: string;
}

const levelRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

interface Stat {
  label: string;
  value: number;
  tone: string;
}

export default function OpsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);

  async function load() {
    setBusy(true);
    setSpinning(true);
    setError('');
    const started = Date.now();
    try {
      const r = await api.cases(true);
      setRows([...r.cases].sort((a, b) => (levelRank[a.case.risk_level] ?? 9) - (levelRank[b.case.risk_level] ?? 9)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < 500) await new Promise((res) => setTimeout(res, 500 - elapsed));
      setSpinning(false);
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = (fn: (r: Row) => boolean) => rows.filter(fn).length;
  const stats: Stat[] = [
    { label: 'Total cases', value: rows.length, tone: 'text-slate-100' },
    { label: 'Critical', value: count((r) => r.case.risk_level === 'CRITICAL'), tone: 'text-rose-300' },
    { label: 'High', value: count((r) => r.case.risk_level === 'HIGH'), tone: 'text-orange-300' },
    { label: 'Medium', value: count((r) => r.case.risk_level === 'MEDIUM'), tone: 'text-amber-300' },
    { label: 'Low', value: count((r) => r.case.risk_level === 'LOW'), tone: 'text-emerald-300' },
    { label: 'Escalated', value: count((r) => r.case.status === 'escalated'), tone: 'text-violet-300' }
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            FlowGuard · Operations
          </span>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
            Bank Operations Room
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live case ledger · risk · sender · beneficiary · verification · decision
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          aria-label="Refresh cases"
          title="Refresh cases"
          className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-slate-300 transition-all duration-200 hover:border-accent/40 hover:text-accent hover:shadow-glow-cyan disabled:opacity-50"
        >
          <RefreshCw size={17} className={spinning ? 'animate-spin-slow' : ''} aria-hidden />
        </button>
      </div>

      {error && (
        <div role="alert" className="animate-fade-up rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Panel key={s.label} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{s.label}</span>
              <ShieldAlert size={13} className={`${s.tone} opacity-70`} aria-hidden />
            </div>
            <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
          </Panel>
        ))}
      </div>

      {/* Ledger */}
      <Panel>
        <div className="flex items-center justify-between border-b border-line bg-black/30 px-4 py-2.5">
          <span className="font-mono text-[11px] text-slate-500">
            ledger://cases · {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
          <span className="font-mono text-[11px] text-slate-600">sorted by risk</span>
        </div>
        <div className="fg-thin-scroll overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">Risk</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Sender</th>
                <th className="px-4 py-3 font-semibold">Beneficiary</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tone = riskTone(r.case.risk_level);
                return (
                  <tr
                    key={r.case.id}
                    className="border-b border-white/[0.05] transition-colors duration-200 last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                        <span className="font-mono text-xs font-semibold text-slate-200">#{r.case.id}</span>
                        <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {r.case.scenario}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge risk={{ level: r.case.risk_level, score: r.case.risk_score }} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-slate-100">
                      {naira(r.transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{r.customer}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.transaction.sender_name}
                      <span className="ml-1.5 font-mono text-[10px] text-slate-600">{r.transaction.sender_risk}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.transaction.beneficiary_name || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.case.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-slate-400">{r.case.decision}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/cases/${r.case.id}?ops=1`}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/[0.03] px-2 font-mono text-[11px] font-semibold text-slate-300 transition-all duration-200 hover:border-accent/50 hover:text-accent hover:shadow-glow-cyan focus-visible:border-accent/50"
                      >
                        View <ArrowUpRight size={12} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="text-sm font-semibold text-slate-300">No cases yet</div>
                    <p className="mt-1 text-xs text-slate-500">
                      Run the customer flow to inject a transaction into the ledger.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
