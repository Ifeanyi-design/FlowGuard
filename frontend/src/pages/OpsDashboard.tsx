import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { CaseItem, Transaction } from '../types';
import { RiskBadge, naira } from '../components/ui';

interface Row {
  case: CaseItem;
  transaction: Transaction;
  customer: string;
}

const levelRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function OpsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const r = await api.cases(true);
      setRows([...r.cases].sort((a, b) => (levelRank[a.case.risk_level] ?? 9) - (levelRank[b.case.risk_level] ?? 9)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank operations</h1>
          <p className="text-sm text-slate-500">Open cases · risk · customer · sender · beneficiary · decision · audit</p>
        </div>
        <button onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b bg-mist text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="p-3">Case</th>
              <th className="p-3">Risk</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Sender</th>
              <th className="p-3">Beneficiary</th>
              <th className="p-3">Status</th>
              <th className="p-3">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.case.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-3 font-semibold">
                  <Link className="text-blue-700 underline" to={`/cases/${r.case.id}`}>#{r.case.id}</Link>
                  <span className="ml-2 text-xs text-slate-400">{r.case.scenario}</span>
                </td>
                <td className="p-3">
                  <RiskBadge risk={{ score: r.case.risk_score, level: r.case.risk_level as never, factors: [], recommended_action: '' }} size="sm" />
                </td>
                <td className="p-3 font-semibold">{naira(r.transaction.amount)}</td>
                <td className="p-3">{r.customer}</td>
                <td className="p-3">{r.transaction.sender_name}</td>
                <td className="p-3">{r.transaction.beneficiary_name || '—'}</td>
                <td className="p-3">{r.case.status}</td>
                <td className="p-3">{r.case.resolution ? `${r.case.decision} (bank)` : `${r.case.decision} (FlowGuard rec.)`}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">No cases yet — run the customer flow first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
