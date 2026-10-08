import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, ShieldHalf } from 'lucide-react';
import CustomerDashboard from './pages/CustomerDashboard';
import OpsDashboard from './pages/OpsDashboard';
import CaseDetailPage from './pages/CaseDetailPage';
import { API_BASE, api } from './api';

export default function App() {
  const loc = useLocation();
  const [health, setHealth] = useState('…');
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
            <ShieldHalf size={20} /> FlowGuard
            <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-normal text-slate-500">demo · no real money</span>
          </div>
          <nav className="flex gap-1">
            {tab('/', 'Customer', LayoutDashboard, loc.pathname === '/')}
            {tab('/ops?ops=1', 'Ops', Activity, loc.pathname.startsWith('/ops') || loc.pathname.startsWith('/cases'))}
          </nav>
          <span className="text-xs text-slate-400" title={API_BASE || 'same-origin via Vite /api proxy'}>
            api: {API_BASE ? `${API_BASE} ` : 'proxy '}{health}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<CustomerDashboard />} />
          <Route path="/ops" element={<OpsDashboard />} />
          <Route path="/cases/:id" element={<CaseDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
