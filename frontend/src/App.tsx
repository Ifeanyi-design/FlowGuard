import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Landmark, LayoutDashboard, LogOut, ShieldHalf, type LucideIcon } from 'lucide-react';
import CustomerDashboard from './pages/CustomerDashboard';
import OpsDashboard from './pages/OpsDashboard';
import CaseDetailPage from './pages/CaseDetailPage';
import LoginPage from './pages/LoginPage';
import BankDashboard from './pages/BankDashboard';
import { API_BASE, api, getSession, getUserId, logout, setIds } from './api';

interface Health {
  status: string;
  db: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!getUserId()) return <Navigate to="/login" replace />;
  return children;
}

function RequireOfficer({ children }: { children: JSX.Element }) {
  if (!getUserId()) return <Navigate to="/login" replace />;
  if (getSession().role !== 'officer') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [health, setHealth] = useState<Health | null>(null);
  const [offline, setOffline] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const session = getSession();
  const loggedIn = Boolean(getUserId());

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setOffline(false);
      })
      .catch(() => {
        setHealth(null);
        setOffline(true);
      });
    // Demo rule: a full page refresh restarts the whole process (fresh ₦250k
    // balance, no cases). SPA navigation is untouched — only true reloads reset.
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navEntry?.type === 'reload' && getUserId()) {
      api.reset('A').then((r) => setIds(r.customer_id, r.officer_id)).catch(() => {}).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const isOfficer = session.role === 'officer';
  const items: NavItem[] = isOfficer
    ? [{ to: '/ops', label: 'Ops', icon: Activity }]
    : [
        { to: '/', label: 'Bank', icon: LayoutDashboard },
        { to: '/verify', label: 'Verify', icon: ShieldHalf }
      ];

  const isVerify = loc.pathname.startsWith('/verify') || loc.pathname.startsWith('/cases');
  const activeIndex = isOfficer ? 0 : isVerify ? 1 : 0;
  const indicatorIndex = hover ?? activeIndex;
  const online = Boolean(health) && !offline;

  return (
    <div className="min-h-screen">
      <header className="fg-glass sticky top-0 z-50 border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-gradient-to-br from-accent/25 to-electric/10 text-accent shadow-[0_0_24px_-8px_rgba(34,211,238,0.9)]">
              {isOfficer && loggedIn ? <Landmark size={18} aria-hidden /> : <ShieldHalf size={18} aria-hidden />}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide text-slate-100">
                FlowGuard {loggedIn && isOfficer ? 'Ops' : 'Bank'}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                demo · no real money
              </div>
            </div>
          </div>

          {/* Segmented control with sliding capsule */}
          {loggedIn && (
            <nav
              aria-label="Primary"
              className="relative flex rounded-xl border border-white/10 bg-white/[0.03] p-1"
              onMouseLeave={() => setHover(null)}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-gradient-to-b from-white to-cyan-100 shadow-[0_0_22px_-4px_rgba(34,211,238,0.9)] transition-transform duration-300 ease-out"
                style={{
                  width: `calc((100% - 0.5rem) / ${items.length})`,
                  transform: `translateX(${indicatorIndex * 100}%)`
                }}
              />
              {items.map((item, i) => {
                const Icon = item.icon;
                const lit = indicatorIndex === i;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onMouseEnter={() => setHover(i)}
                    className={`relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                      lit ? 'text-slate-900' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={15} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Session + health */}
          <div className="flex items-center gap-2">
            {loggedIn && (
              <>
                <span className="hidden text-xs text-slate-400 sm:inline">{session.name}</span>
                <button
                  onClick={() => {
                    logout();
                    nav('/login', { replace: true });
                  }}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-all duration-200 hover:border-rose-400/40 hover:text-rose-300"
                >
                  <LogOut size={15} aria-hidden />
                </button>
              </>
            )}
            <div
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
              title={API_BASE || 'same-origin via Vite /api proxy'}
            >
              <span className="relative flex h-2 w-2">
                {online && (
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" aria-hidden />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  aria-hidden
                />
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                api {online ? 'ok' : 'offline'} · db {health?.db ?? '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/30 to-transparent" aria-hidden />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!ready ? (
          <p className="py-10 text-center text-sm text-slate-400">Restarting demo…</p>
        ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><BankDashboard /></RequireAuth>} />
          <Route path="/verify/:txnId?" element={<RequireAuth><CustomerDashboard /></RequireAuth>} />
          <Route path="/ops" element={<RequireOfficer><OpsDashboard /></RequireOfficer>} />
          <Route path="/cases/:id" element={<RequireAuth><CaseDetailPage /></RequireAuth>} />
        </Routes>
        )}
      </main>
    </div>
  );
}
