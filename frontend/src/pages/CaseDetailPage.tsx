import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { AuditEntry, CaseItem, RiskResult, Transaction } from '../types';
import { RiskBadge, ScoreBar, naira } from '../components/ui';

export default function CaseDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<{
    case: CaseItem; transaction: Transaction; risk: RiskResult;
    verification: Record<string, unknown>; allowed_actions?: string[];
  } | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const asOfficer = window.location.search.includes('ops');

  async function load() {
    if (!id) return;
    try {
      const d = await api.caseDetail(Number(id), true);
      setDetail(d);
      const a = await api.caseAudit(Number(id), true);
      setAudit(a.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load case');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function decide(decision: 'APPROVE' | 'ESCALATE' | 'BLOCK') {
    if (!id) return;
    setError('');
    setMsg('');
    try {
      await api.officerDecision(Number(id), decision);
      setMsg(`Officer decision recorded: ${decision}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed');
    }
  }

  if (error && !detail) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!detail) return <div className="text-sm text-slate-500">Loading case…</div>;
  const { case: c, transaction: t, risk } = detail;
  const allowed: string[] = detail.allowed_actions || [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="rounded-2xl bg-ink p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Case #{c.id} · {naira(t.amount)} from {t.sender_name}</h1>
          <RiskBadge risk={risk} size="sm" />
        </div>
        <p className="mt-1 text-sm text-slate-300">Status {c.status} · decision {c.decision} · scenario {c.scenario} · {t.status}</p>
        <div className="mt-2"><ScoreBar score={risk.score} /></div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Transaction</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{naira(t.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Sender</dt><dd>{t.sender_name} ({t.sender_risk})</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Purpose</dt><dd>{t.purpose || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Beneficiary</dt><dd>{t.beneficiary_name || '—'} ({t.beneficiary_risk})</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Verification</dt><dd>{c.verification_state}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Risk factors</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {risk.factors.map((f) => (
              <li key={f.signal} className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                <span>{f.explanation}</span>
                <b className={f.points >= 0 ? 'text-red-600' : 'text-emerald-600'}>{f.points > 0 ? `+${f.points}` : f.points}</b>
              </li>
            ))}
            {risk.factors.length === 0 && <li className="text-slate-400">No factor breakdown recorded.</li>}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Officer actions {asOfficer ? '' : '(officer role enforced server-side)'}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['APPROVE', 'ESCALATE', 'BLOCK'] as const).map((d) => (
            <button
              key={d}
              disabled={!allowed.includes(d)}
              onClick={() => decide(d)}
              title={allowed.includes(d) ? d : `Not allowed while ${c.status}`}
              className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {d}
            </button>
          ))}
        </div>
        {allowed.length === 0 && <p className="mt-1 text-xs text-slate-400">No actions available in status {c.status}.</p>}
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Audit timeline</h2>
        <ol className="mt-2 space-y-2">
          {audit.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink" />
              <div>
                <b>{a.action}</b> <span className="text-slate-500">· {a.actor} · {new Date(a.timestamp).toLocaleString()}</span>
                {a.metadata && Object.keys(a.metadata).length > 0 && (
                  <pre className="mt-1 overflow-x-auto rounded bg-mist p-2 text-xs">{JSON.stringify(a.metadata, null, 1)}</pre>
                )}
              </div>
            </li>
          ))}
          {audit.length === 0 && <li className="text-sm text-slate-400">No audit entries.</li>}
        </ol>
      </div>
    </div>
  );
}
