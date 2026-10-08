import { AlertTriangle, CheckCircle2, Info, OctagonX } from 'lucide-react';
import type { RiskResult } from '../types';

const styles: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200'
};

const icons: Record<string, typeof Info> = {
  LOW: CheckCircle2,
  MEDIUM: Info,
  HIGH: AlertTriangle,
  CRITICAL: OctagonX
};

export function RiskBadge({ risk, size = 'md' }: { risk: RiskResult | null; size?: 'sm' | 'md' }) {
  if (!risk) return <span className="text-sm text-slate-400">No assessment yet</span>;
  const Icon = icons[risk.level] || Info;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${styles[risk.level]} ${
        size === 'sm' ? 'text-xs' : 'text-sm'
      }`}
    >
      <Icon size={size === 'sm' ? 14 : 16} />
      {risk.level} · {risk.score}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 81 ? 'bg-red-500' : score >= 61 ? 'bg-orange-500' : score >= 31 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

export function naira(n: number) {
  return `₦${Number(n).toLocaleString('en-NG')}`;
}
