import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Landmark } from 'lucide-react';
import { api, setIds, setSession } from '../api';

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('treasure@demo.bank');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
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
    <div className="mx-auto grid max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border bg-white md:grid-cols-2">
      <div className="bg-ink p-8 text-white">
        <div className="flex items-center gap-2 font-bold"><Landmark size={20} /> FlowGuard Bank</div>
        <h1 className="mt-6 text-3xl font-bold">Everyday banking, protected by risk-aware security.</h1>
        <p className="mt-2 text-sm text-slate-300">
          Balances, airtime, transfers — plus Enhanced Protection that verifies unusual money before it moves.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 p-3 text-xs text-slate-200">
          <Fingerprint size={16} /> Demo build: PIN <b className="font-mono">1234</b> works for every seeded account.
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3 p-8">
        <h2 className="text-xl font-bold">Welcome back</h2>
        <label className="block text-sm">Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="you@demo.bank" />
        </label>
        <label className="block text-sm">PIN
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" maxLength={4} className="mt-1 w-full rounded-lg border p-2 font-mono tracking-widest" placeholder="••••" />
        </label>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>}
        <button disabled={busy} className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => { setEmail('treasure@demo.bank'); setPin('1234'); }} className="rounded-lg border px-2 py-1">Use customer demo</button>
          <button type="button" onClick={() => { setEmail('officer@demo.bank'); setPin('1234'); }} className="rounded-lg border px-2 py-1">Use officer demo</button>
        </div>
      </form>
    </div>
  );
}
