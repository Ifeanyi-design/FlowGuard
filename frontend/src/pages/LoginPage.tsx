import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Fingerprint, Landmark, Lock, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { api, setIds, setSession } from '../api';

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('treasure@demo.bank');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.login(email.trim(), pin.trim());
      setIds(r.ids.customer, r.ids.officer);
      setSession(r.user.name, r.user.role);
      nav(r.user.role === 'officer' ? '/ops' : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-4">
      <div className="fg-card grid grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative border-b border-line p-8 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-gradient-to-br from-accent/25 to-electric/10 text-accent shadow-[0_0_24px_-8px_rgba(34,211,238,0.9)]">
              <Landmark size={18} aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-wide text-slate-100">FlowGuard Bank</span>
          </div>

          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-50">
            Everyday banking,
            <br />
            protected by <span className="text-accent">risk-aware</span> security.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Balances, airtime, transfers — plus Enhanced Protection that verifies unusual money before it moves.
          </p>

          <ul className="mt-6 space-y-2.5 text-xs text-slate-400">
            {[
              'Unusual credits are contained, never silently blocked',
              'Verification is proportionate to risk',
              'The bank always makes the final call'
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
            <Fingerprint size={16} className="shrink-0" aria-hidden />
            <span>
              Demo build: PIN <b className="font-mono tracking-widest">1234</b> works for every seeded account.
            </span>
          </div>
        </div>

        {/* Form panel */}
        <form onSubmit={submit} className="space-y-4 p-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Welcome back</h2>
            <p className="mt-1 text-xs text-slate-500">Sign in to your FlowGuard account.</p>
          </div>

          <label className="block text-xs font-medium text-slate-400">
            Email
            <span className="relative mt-1.5 block">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="fg-input pl-9"
                placeholder="you@demo.bank"
                autoComplete="username"
              />
            </span>
          </label>

          <label className="block text-xs font-medium text-slate-400">
            PIN
            <span className="relative mt-1.5 block">
              <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                type="password"
                inputMode="numeric"
                maxLength={4}
                className="fg-input pl-9 font-mono tracking-[0.4em]"
                placeholder="••••"
                autoComplete="current-password"
              />
            </span>
          </label>

          {error && (
            <div role="alert" className="animate-fade-up rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/20 hover:shadow-glow-cyan disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail('treasure@demo.bank');
                setPin('1234');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-slate-300 transition-all duration-200 hover:border-accent/40 hover:text-accent"
            >
              <Sparkles size={12} aria-hidden /> Use customer demo
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('officer@demo.bank');
                setPin('1234');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-slate-300 transition-all duration-200 hover:border-accent/40 hover:text-accent"
            >
              <Sparkles size={12} aria-hidden /> Use officer demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
