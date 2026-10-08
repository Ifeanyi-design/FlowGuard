import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ScenarioInfo } from '../types';

const TONE = {
  red: { Icon: ShieldAlert, dot: 'bg-red-400', text: 'text-slate-200' },
  amber: { Icon: AlertTriangle, dot: 'bg-amber-400', text: 'text-slate-200' },
  green: { Icon: CheckCircle2, dot: 'bg-emerald-400', text: 'text-slate-400' }
} as const;

/** Evidence behind a scenario classification — rendered under the scenario
 *  selector so a reviewer sees WHY this outcome is expected, not just the label. */
export default function ScenarioEvidence({ entry }: { entry: ScenarioInfo | undefined }) {
  if (!entry || !entry.signals || entry.signals.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-sm font-bold text-slate-100">Scenario {entry.id} — {entry.title}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Risk signals injected into this scenario
      </p>
      <ul className="mt-2 space-y-1.5">
        {entry.signals.map((s) => {
          const t = TONE[s.tone] ?? TONE.amber;
          const Icon = t.Icon;
          return (
            <li key={s.text} className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden />
              <Icon size={14} className={s.tone === 'green' ? 'text-emerald-400' : s.tone === 'amber' ? 'text-amber-400' : 'text-red-400'} aria-hidden />
              <span className={t.text}>{s.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-white/10 pt-2 text-sm text-slate-300">
        Expected outcome: <b className="text-slate-100">{entry.expectation}</b>
      </p>
    </div>
  );
}
