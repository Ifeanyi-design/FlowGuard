import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Landmark, LayoutDashboard, LogOut, ShieldHalf } from 'lucide-react';
import CustomerDashboard from './pages/CustomerDashboard';
import OpsDashboard from './pages/OpsDashboard';
import CaseDetailPage from './pages/CaseDetailPage';
import LoginPage from './pages/LoginPage';
import BankDashboard from './pages/BankDashboard';
import { API_BASE, api, getSession, getUserId, logout } from './api';

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!getUserId()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [health, setHealth] = useState('…');
  const session = getSession();
  const loggedIn = Boolean(getUserId());
  useEffect(() => {
    api.health().then((h) => setHealth(`${h.status}/db:${h.db}`)).catch(() => setHealth('offline?'));
  }, []);
  const tab = (to: string, label: string, Icon: typeof Activity, active: boolean) => (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${active ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      <Icon size={15} /> {label}
    </Link>
  );
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            {loggedIn && session.role === 'officer' ? <Landmark size={20} /> : <ShieldHalf size={20} />}
            FlowGuard {loggedIn && session.role === 'officer' ? 'Ops' : 'Bank'}
            <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-normal text-slate-500">demo · no real money</span>
          </div>
          {loggedIn && (
            <nav className="flex items-center gap-1">
              {session.role === 'officer' ? (
                tab('/ops', 'Ops', Activity, loc.pathname.startsWith('/ops') || loc.pathname.startsWith('/cases'))
              ) : (
                <>
                  {tab('/', 'Bank', LayoutDashboard, loc.pathname === '/')}
                  {tab('/verify', 'Verify', ShieldHalf, loc.pathname.startsWith('/verify') || loc.pathname.startsWith('/cases'))}
                  {tab('/ops?ops=1', 'Ops view', Activity, loc.pathname.startsWith('/ops'))}
                </>
              )}
              <span className="ml-1 hidden text-xs text-slate-400 sm:inline">{session.name}</span>
              <button
                onClick={() => { logout(); nav('/login', { replace: true }); }}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-sm text-slate-500 hover:bg-slate-200"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </nav>
          )}
          <span className="text-xs text-slate-400" title={API_BASE || 'same-origin via Vite /api proxy'}>
            api: {API_BASE ? `${API_BASE} ` : 'proxy '}{health}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><BankDashboard /></RequireAuth>} />
          <Route path="/verify/:txnId?" element={<RequireAuth><CustomerDashboard /></RequireAuth>} />
          <Route path="/ops" element={<RequireAuth><OpsDashboard /></RequireAuth>} />
          <Route path="/cases/:id" element={<RequireAuth><CaseDetailPage /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  );
}
