import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  OctagonX,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon
} from 'lucide-react';
import type { RiskResult } from '../types';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Minimal shape the badge needs. */
export interface RiskLike {
  level: string;
  score: number;
}

/** Accepts either a minimal {level, score} or a full backend RiskResult. */
type RiskInput = RiskLike | RiskResult;

interface RiskTone {
  label: string;
  text: string;
  border: string;
  bg: string;
  dot: string;
  glow: string;
  bar: string;
  icon: LucideIcon;
}

/** Risk tone system — colour is always paired with an icon + text label (a11y). */
export const RISK: Record<RiskLevel, RiskTone> = {
  LOW: {
    label: 'Low',
    text: 'text-emerald-300',
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-400/10',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_22px_-8px_rgba(52,211,153,0.85)]',
    bar: 'from-emerald-400 to-emerald-500',
    icon: CheckCircle2
  },
  MEDIUM: {
    label: 'Medium',
    text: 'text-amber-300',
    border: 'border-amber-400/30',
    bg: 'bg-amber-400/10',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_22px_-8px_rgba(251,191,36,0.85)]',
    bar: 'from-amber-300 to-amber-500',
    icon: Info
  },
  HIGH: {
    label: 'High',
    text: 'text-orange-300',
    border: 'border-orange-400/35',
    bg: 'bg-orange-400/10',
    dot: 'bg-orange-400',
    glow: 'shadow-[0_0_22px_-8px_rgba(251,146,60,0.9)]',
    bar: 'from-orange-400 to-orange-500',
    icon: AlertTriangle
  },
  CRITICAL: {
    label: 'Critical',
    text: 'text-rose-300',
    border: 'border-rose-400/35',
    bg: 'bg-rose-400/10',
    dot: 'bg-rose-400',
    glow: 'shadow-[0_0_24px_-8px_rgba(251,113,133,0.95)]',
    bar: 'from-rose-400 to-rose-600',
    icon: OctagonX
  }
};

export function riskTone(level: string): RiskTone {
  return RISK[level as RiskLevel] ?? RISK.MEDIUM;
}

/** Glassmorphic risk pill: icon + LEVEL + score, colour-coded to the risk band. */
export function RiskBadge({
  risk,
  size = 'md',
  showScore = true
}: {
  risk: RiskInput | null;
  size?: 'sm' | 'md';
  showScore?: boolean;
}) {
  if (!risk) {
    return <span className="text-xs text-slate-500">No assessment yet</span>;
  }
  const tone = riskTone(risk.level);
  const Icon = tone.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold backdrop-blur-sm ${tone.text} ${tone.border} ${tone.bg} ${tone.glow} ${
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <Icon size={size === 'sm' ? 12 : 14} aria-hidden />
      <span className="tracking-wide">{tone.label.toUpperCase()}</span>
      {showScore && <span className="font-mono opacity-80">· {risk.score}</span>}
    </span>
  );
}

/** Gradient risk meter with a soft leading glow. */
export function ScoreBar({ score, level }: { score: number; level?: string }) {
  const tone = level
    ? riskTone(level)
    : riskTone(score >= 81 ? 'CRITICAL' : score >= 61 ? 'HIGH' : score >= 31 ? 'MEDIUM' : 'LOW');
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/5">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** ₦ formatting in the Nigerian convention. */
export function naira(n: number): string {
  return `₦${Number(n).toLocaleString('en-NG')}`;
}

/** Dark hairline card with an inner radial glow. */
export function Panel({
  children,
  className = ''
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`fg-card ${className}`}>{children}</section>;
}

/** Numbered section heading used across the workflow. */
export function SectionHeading({
  index,
  title,
  hint,
  icon: Icon
}: {
  index?: string;
  title: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3">
      {index && (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 font-mono text-[11px] font-bold text-accent">
          {index}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100">
          {Icon && <Icon size={15} className="text-accent" aria-hidden />}
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Neon micro-badge used in the workflow stepper. */
export function StepBadge({ label, done, active }: { label: string; done: boolean; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all duration-200 ${
        done
          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_-8px_rgba(52,211,153,0.9)]'
          : active
            ? 'border-accent/40 bg-accent/10 text-accent shadow-[0_0_18px_-8px_rgba(34,211,238,0.9)]'
            : 'border-white/10 bg-white/[0.02] text-slate-500'
      }`}
    >
      {done ? (
        <CheckCircle2 size={12} aria-hidden />
      ) : (
        <span className={`h-2 w-2 rounded-full ${active ? 'bg-accent' : 'bg-slate-600'}`} />
      )}
      {label}
    </span>
  );
}

type Tone = 'slate' | 'cyan' | 'violet' | 'amber' | 'orange' | 'emerald' | 'rose';

const TONES: Record<Tone, string> = {
  slate: 'border-white/10 bg-white/[0.03] text-slate-300',
  cyan: 'border-accent/30 bg-accent/10 text-accent',
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  orange: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300'
};

const STATUS_MAP: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  open: { label: 'Open', tone: 'slate', icon: Clock },
  pending: { label: 'Pending', tone: 'slate', icon: Clock },
  unverified: { label: 'Unverified', tone: 'slate', icon: ShieldAlert },
  awaiting_customer: { label: 'Awaiting customer', tone: 'cyan', icon: Clock },
  awaiting_officer: { label: 'Awaiting officer', tone: 'violet', icon: ShieldCheck },
  step_up: { label: 'Step-up required', tone: 'amber', icon: ShieldAlert },
  held: { label: 'On hold', tone: 'amber', icon: Ban },
  escalated: { label: 'Escalated', tone: 'orange', icon: AlertTriangle },
  approved: { label: 'Authorized', tone: 'emerald', icon: BadgeCheck },
  blocked: { label: 'Blocked', tone: 'rose', icon: Ban },
  closed: { label: 'Closed', tone: 'slate', icon: CheckCircle2 },
  settled: { label: 'Settled', tone: 'emerald', icon: CheckCircle2 },
  verified: { label: 'Verified', tone: 'emerald', icon: CheckCircle2 },
  identity_verified: { label: 'Identity verified', tone: 'emerald', icon: CheckCircle2 },
  sender_confirmed: { label: 'Sender confirmed', tone: 'emerald', icon: CheckCircle2 },
  sender_disputed: { label: 'Sender disputed', tone: 'rose', icon: AlertTriangle },
  biometric_verified: { label: 'Biometric verified', tone: 'emerald', icon: CheckCircle2 },
  // everyday-banking / protection pipeline statuses
  under_review: { label: 'Under review', tone: 'cyan', icon: ShieldAlert },
  customer_verified: { label: 'Customer verified', tone: 'emerald', icon: CheckCircle2 },
  beneficiary_submitted: { label: 'Beneficiary submitted', tone: 'cyan', icon: CheckCircle2 },
  risk_reassessed: { label: 'Risk reassessed', tone: 'cyan', icon: ShieldCheck },
  step_up_required: { label: 'Step-up required', tone: 'amber', icon: ShieldAlert },
  authorized: { label: 'Authorized', tone: 'emerald', icon: BadgeCheck }
};

/** Status chip for case / transaction / verification states. */
export function StatusPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const key = status.toLowerCase();
  const meta = STATUS_MAP[key] ?? { label: status.replace(/_/g, ' '), tone: 'slate' as Tone, icon: Info };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium backdrop-blur-sm ${TONES[meta.tone]} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon size={size === 'sm' ? 11 : 12} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Small uppercase eyebrow label. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${className}`}>
      {children}
    </span>
  );
}
