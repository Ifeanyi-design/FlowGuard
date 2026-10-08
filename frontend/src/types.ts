export interface RiskFactor {
  signal: string;
  points: number;
  explanation: string;
}

export interface RiskResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  recommended_action: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  direction: string;
  amount: number;
  currency: string;
  sender_name: string;
  sender_risk: string;
  beneficiary_name: string;
  beneficiary_risk: string;
  purpose: string;
  status: string;
  risk_score: number;
  risk_level: string;
  decision: string;
  scenario: string;
  created_at?: string;
}

export interface CaseItem {
  id: number;
  transaction_id: number;
  status: string;
  risk_score: number;
  risk_level: string;
  verification_state: string;
  decision: string;
  resolution: string | null;
  scenario: string;
}

export interface AuditEntry {
  actor: string;
  action: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export const SCENARIOS: Record<string, string> = {
  A: 'Legitimate debt repayment',
  B: 'Compromised sender',
  C: 'Suspicious beneficiary',
  D: 'Money mule',
  E: 'Account takeover'
};

export interface ScenarioSignal {
  tone: 'red' | 'amber' | 'green';
  text: string;
}

export interface ScenarioInfo {
  id: string;
  class: string;
  title: string;
  expectation: string;
  signals?: ScenarioSignal[];
}

/** Fraud scenarios classified under risk classes (mirrors backend catalogue). */
export const SCENARIO_CATALOGUE: ScenarioInfo[] = [
  { id: 'A', class: 'Legitimate baseline', title: 'Legitimate debt repayment', expectation: 'MEDIUM → verification → APPROVE' },
  { id: 'B', class: 'Sender compromise', title: 'Compromised sender', expectation: 'HIGH/CRITICAL → STEP_UP or ESCALATE' },
  { id: 'C', class: 'Beneficiary risk', title: 'Suspicious beneficiary', expectation: 'HIGH → STEP_UP or ESCALATE' },
  { id: 'D', class: 'Velocity abuse', title: 'Money mule', expectation: 'CRITICAL → ESCALATE or BLOCK' },
  { id: 'E', class: 'Session compromise', title: 'Account takeover', expectation: 'HIGH/CRITICAL → STEP_UP or ESCALATE' }
];

export const PURPOSES = ['Debt repayment', 'Family support', 'Business payment', 'Savings', 'Other'];

export interface PendingTxn {
  transaction: Transaction;
  risk: { score: number; level: string };
  case_id: number | null;
  case_status: string | null;
  recommendation: string | null;
}

export interface DashboardData {
  user: { id: number; name: string };
  account: { id: number; number_masked: string; balance: number; normal_limit: number };
  recent: Transaction[];
  pending: PendingTxn | null;
}

export interface LoginResponse {
  user: { id: number; name: string; email: string; role: string };
  account: { id: number; number_masked: string; balance: number; normal_limit: number } | null;
  ids: { customer: number; officer: number };
}
