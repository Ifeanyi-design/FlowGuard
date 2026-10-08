import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Circle,
  KeyRound,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon
} from 'lucide-react';
import { api, getSession } from '../api';
import type { AuditEntry, CaseItem, RiskResult, Transaction } from '../types';
import { Panel, RiskBadge, ScoreBar, SectionHeading, StatusPill, naira, riskTone } from '../components/ui';

const AUDIT_ICONS: Record<string, LucideIcon> = {
  transaction_received: ArrowDownLeft,
  risk_triggered: ShieldAlert,
  risk_engine_failed: ShieldAlert,
  identity_code_issued: KeyRound,
  identity_verified: KeyRound,
  identity_failed: AlertTriangle,
  customer_verified: UserCheck,
  sender_disputed: AlertTriangle,
  purpose_selected: Send,
  beneficiary_submitted: Users,
  risk_reassessed: ShieldCheck,
  biometric_verified: CheckCircle2,
  review_requested: Send,
  step_up_completed: ShieldCheck,
  authorization_decision: BadgeCheck,
  payment_settled_simulated: CheckCircle2,
  case_escalated: AlertTriangle,
  transaction_blocked: Ban,
  officer_approve: CheckCircle2,
  officer_escalate: AlertTriangle,
  officer_block: Ban,
  topup_purchased: Send
};

function auditIcon(action: string): LucideIcon {
  return AUDIT_ICONS[action] ?? Circle;
}

/** Human-readable label: sender_risk -> Sender risk. */
function metaLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable value: money formatted, nested objects flattened one level. */
function metaValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && /amount|balance/i.test(key)) return naira(value);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '—';
    return entries.map(([k, v]) => `${metaLabel(k)}: ${metaValue(k, v)}`).join(' · ');
  }
  return String(value);
}

/** Audit metadata as labeled rows — never a raw JSON dump. */
function MetaRows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return null;
  return (
    <dl className="mt-1.5 space-y-1 rounded-lg border border-line bg-black/40 p-2.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 text-[11px]">
          <dt className="shrink-0 text-slate-500">{metaLabel(k)}</dt>
          <dd className="text-right font-medium text-slate-300">{metaValue(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<{
    case: CaseItem;
    transaction: Transaction;
    risk: RiskResult;
    verification: Record<string, unknown>;
    allowed_actions?: string[];
  } | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const asOfficer = getSession().role === 'officer';

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
    if (decision === 'BLOCK' && !window.confirm('Block this transaction? This is a destructive, officer-only action.')) {
      return;
    }
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

  if (error && !detail) {
    return (
      <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!detail) return <div className="text-sm text-slate-500">Loading case…</div>;

  const { case: c, transaction: t, risk } = detail;
  const allowed: string[] = detail.allowed_actions || [];
  const tone = riskTone(risk.level);
  const drivers = risk.factors.filter((f) => f.points >= 0);
  const mitigating = risk.factors.filter((f) => f.points < 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <Panel className="animate-fade-up p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Case #{c.id} · scenario {c.scenario}
            </span>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              <span className="font-mono">{naira(t.amount)}</span>{' '}
              <span className="text-sm font-normal text-slate-400">from {t.sender_name}</span>
            </h1>
          </div>
          <RiskBadge risk={risk} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={c.status} />
          <span className="font-mono text-[11px] text-slate-500" title={c.resolution ? 'Bank decision' : 'FlowGuard recommendation'}>
            {c.resolution ? `bank: ${c.decision}` : `rec.: ${c.decision}`}
          </span>
          <span className="font-mono text-[11px] text-slate-500">txn: {t.status}</span>
        </div>
        <div className="mt-4">
          <ScoreBar score={risk.score} level={risk.level} />
        </div>
      </Panel>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <SectionHeading title="Transaction" />
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-mono font-semibold text-slate-100">{naira(t.amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <dt className="text-slate-500">Sender</dt>
              <dd className="text-slate-200">
                {t.sender_name} <span className="font-mono text-[10px] text-slate-500">({t.sender_risk})</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <dt className="text-slate-500">Purpose</dt>
              <dd className="text-slate-200">{t.purpose || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <dt className="text-slate-500">Beneficiary</dt>
              <dd className="text-slate-200">
                {t.beneficiary_name || '—'}{' '}
                <span className="font-mono text-[10px] text-slate-500">({t.beneficiary_risk})</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Verification</dt>
              <dd>
                <StatusPill status={c.verification_state} size="sm" />
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionHeading title="Risk factors" />
            <RiskBadge risk={risk} size="sm" />
          </div>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Risk drivers</p>
          <ul className="mt-1 divide-y divide-white/5">
            {drivers.map((f) => (
              <li key={f.signal} className="flex items-start justify-between gap-2 py-2 text-xs">
                <span className="text-slate-300">{f.explanation}</span>
                <b className="shrink-0 font-mono text-rose-300">+{f.points}</b>
              </li>
            ))}
            {drivers.length === 0 && <li className="py-2 text-xs text-slate-500">No adverse drivers.</li>}
          </ul>

          {mitigating.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mitigating</p>
              <ul className="mt-1 divide-y divide-white/5">
                {mitigating.map((f) => (
                  <li key={f.signal} className="flex items-start justify-between gap-2 py-2 text-xs">
                    <span className="text-slate-300">{f.explanation}</span>
                    <b className="shrink-0 font-mono text-emerald-300">{f.points}</b>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-3 border-t border-line pt-3 text-[11px] text-slate-500">
            Recommended action: <span className="font-mono text-slate-300">{risk.recommended_action}</span>
          </p>
        </Panel>
      </div>

      {asOfficer ? (
        <Panel className="p-5">
          <SectionHeading title="Officer actions" hint="Gated by case status; the bank is the final authority." />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={!allowed.includes('APPROVE')}
              onClick={() => decide('APPROVE')}
              title={allowed.includes('APPROVE') ? 'Approve' : `Not allowed while ${c.status}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-[0_0_24px_-8px_rgba(52,211,153,0.9)] transition-all duration-200 hover:from-emerald-300 hover:to-emerald-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              <BadgeCheck size={16} aria-hidden /> APPROVE
            </button>
            <button
              disabled={!allowed.includes('ESCALATE')}
              onClick={() => decide('ESCALATE')}
              title={allowed.includes('ESCALATE') ? 'Escalate' : `Not allowed while ${c.status}`}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-all duration-200 hover:bg-amber-400/15 hover:shadow-glow-amber disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <AlertTriangle size={16} aria-hidden /> ESCALATE
            </button>
            <button
              disabled={!allowed.includes('BLOCK')}
              onClick={() => decide('BLOCK')}
              title={allowed.includes('BLOCK') ? 'Block' : `Not allowed while ${c.status}`}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/5 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/15 hover:shadow-glow-rose disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Ban size={16} aria-hidden /> BLOCK
            </button>
          </div>
          {allowed.length === 0 && (
            <p className="mt-2 text-[11px] text-slate-500">No actions available in status {c.status}.</p>
          )}
        </Panel>
      ) : (
        <Panel className="p-5">
          <SectionHeading title="Bank decision" />
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Bank decision: <b className="text-slate-200">{c.resolution ?? 'pending'}</b> · FlowGuard
            recommendation: <b className="text-slate-200">{c.decision}</b> · status {c.status}. Approval, escalation
            and blocking are decided by bank officers in the Ops dashboard — never by the customer.
          </p>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionHeading title="Audit timeline" hint="Every significant event is recorded chronologically." />
        <ol className="mt-4 space-y-0">
          {audit.map((a, i) => {
            const Icon = auditIcon(a.action);
            const hasMeta = a.metadata && Object.keys(a.metadata).length > 0;
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < audit.length - 1 && (
                  <span className="absolute left-[13px] top-7 h-full w-px bg-white/10" aria-hidden />
                )}
                <span
                  className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    i === audit.length - 1
                      ? `${tone.border} ${tone.bg} ${tone.text}`
                      : 'border-white/10 bg-white/[0.03] text-slate-400'
                  }`}
                >
                  <Icon size={13} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <b className="text-xs font-semibold text-slate-200">{a.action.replace(/_/g, ' ')}</b>
                    <span className="font-mono text-[10px] text-slate-500">
                      {a.actor} · {new Date(a.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {hasMeta && <MetaRows data={a.metadata} />}
                </div>
              </li>
            );
          })}
          {audit.length === 0 && <li className="text-xs text-slate-500">No audit entries.</li>}
        </ol>
      </Panel>
    </div>
  );
}
