/** Centralized backend client. No fetch calls outside this file.
 * BASE is same-origin ('') by default: local dev goes through the Vite
 * /api proxy (see vite.config.ts), production uses VITE_API_URL. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

let userId: string | null = localStorage.getItem('fg_user_id');
let officerId: string | null = localStorage.getItem('fg_officer_id');

export function getUserId() {
  return userId;
}
export function setIds(customer: string | number | null, officer: string | number | null) {
  if (customer != null) {
    userId = String(customer);
    localStorage.setItem('fg_user_id', userId);
  }
  if (officer != null) {
    officerId = String(officer);
    localStorage.setItem('fg_officer_id', officerId);
  }
}
export function getOfficerId() {
  return officerId;
}

async function req<T>(path: string, opts: RequestInit = {}, asOfficer = false): Promise<T> {
  const uid = asOfficer ? officerId || userId : userId;
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(uid ? { 'X-User-Id': String(uid) } : {}),
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string; db: string }>('/api/health'),
  reset: (scenario = 'A') =>
    req<{ ok: boolean; scenario: string; description: string; customer_id: number; officer_id: number }>(
      '/api/demo/reset',
      { method: 'POST', body: JSON.stringify({ scenario }) }
    ),
  incoming: (sender_name: string, amount: number, scenario: string) =>
    req<{ transaction: import('./types').Transaction; risk: import('./types').RiskResult; case_id: number; unusual: boolean }>(
      '/api/transactions/incoming',
      { method: 'POST', body: JSON.stringify({ sender_name, amount, scenario }) }
    ),
  getTxn: (id: number) => req<{ transaction: import('./types').Transaction; case_id: number; risk: import('./types').RiskResult | null; verification_state: string }>(`/api/transactions/${id}`),
  identity: (id: number) =>
    req<{ ok: boolean; channel: string; code: string; note: string }>(
      `/api/transactions/${id}/identity`,
      { method: 'POST', body: '{}' }
    ),
  identityConfirm: (id: number, code: string) =>
    req<{ ok: boolean; verification_state: string }>(
      `/api/transactions/${id}/identity/confirm`,
      { method: 'POST', body: JSON.stringify({ code }) }
    ),
  verify: (id: number, confirm_sender: boolean, expected: boolean) =>
    req(`/api/transactions/${id}/verify`, { method: 'POST', body: JSON.stringify({ confirm_sender, expected }) }),
  purpose: (id: number, purpose: string) =>
    req(`/api/transactions/${id}/purpose`, { method: 'POST', body: JSON.stringify({ purpose }) }),
  beneficiary: (id: number, beneficiary_name: string) =>
    req<{ ok: boolean; beneficiary: string; beneficiary_risk: string }>(`/api/transactions/${id}/beneficiary`, {
      method: 'POST',
      body: JSON.stringify({ beneficiary_name })
    }),
  reassess: (id: number) =>
    req<{ risk: import('./types').RiskResult; suggested_decision: string; reason: string }>(
      `/api/transactions/${id}/reassess`,
      { method: 'POST', body: '{}' }
    ),
  authorize: (id: number) =>
    req<{ decision: string; reason: string; risk: import('./types').RiskResult; case_status: string; bank: Record<string, unknown> }>(
      `/api/transactions/${id}/authorize`,
      { method: 'POST', body: '{}' }
    ),
  escalate: (id: number) =>
    req(`/api/transactions/${id}/escalate`, { method: 'POST', body: '{}' }),
  block: (id: number) =>
    req(`/api/transactions/${id}/block`, { method: 'POST', body: '{}' }, true),
  cases: (asOfficer = false) =>
    req<{ cases: { case: import('./types').CaseItem; transaction: import('./types').Transaction; customer: string }[] }>(
      '/api/cases',
      {},
      asOfficer
    ),
  caseDetail: (id: number, asOfficer = false) =>
    req<{
      case: import('./types').CaseItem;
      transaction: import('./types').Transaction;
      risk: import('./types').RiskResult;
      verification: Record<string, unknown>;
      allowed_actions?: string[];
    }>(`/api/cases/${id}`, {}, asOfficer),
  caseAudit: (id: number, asOfficer = false) =>
    req<{ audit: import('./types').AuditEntry[] }>(`/api/cases/${id}/audit`, {}, asOfficer),
  officerDecision: (id: number, decision: 'APPROVE' | 'ESCALATE' | 'BLOCK') =>
    req(`/api/cases/${id}/officer-decision`, { method: 'POST', body: JSON.stringify({ decision }) }, true)
};

export const API_BASE = BASE;
