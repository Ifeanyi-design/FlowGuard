# PRD — FlowGuard: Risk-Adaptive Transaction Protection & Resolution (governing spec)

> Prototype/demo only. No real money, banking systems, KYC, or biometrics.

## 1. Core principle

**The customer provides evidence and context; FlowGuard assesses the risk; the bank retains final authority.**

Customer actions — recognizing the transaction, confirming the sender, stating purpose, identifying the
beneficiary, completing step-up (demo OTP/biometric) — do **not** authorize the movement of funds. They are
evidence. Nothing the customer does can "unlock" restricted funds on its own.

## 2. Correct flow

1. **Customer** — "Yes, I recognize this ₦4M payment. It is for debt repayment to John Doe."
   Evidence submitted for bank review (`POST /api/transactions/{id}/authorize` records a SUBMITTED request).
2. **FlowGuard Risk Engine** — reassesses using amount, sender, beneficiary, device, history, velocity.
   Returns score, level, factors, recommended action. Never touches funds.
3. **Policy Engine** — deterministic rules map the assessment to a recommendation:
   APPROVE-eligible / STEP_UP / HOLD / ESCALATE / BLOCK. Hard rules (e.g. regulatory HOLD) always win.
4. **Bank Operator** — reviews evidence, risk assessment, verification state, context, audit trail.
5. **Final decision by the bank operator only**: APPROVE (bank authorizes + executes, simulated),
   STEP_UP (more verification), ESCALATE (compliance/fraud review), BLOCK (remains blocked).

## 3. ₦4M example

Faith → Treasure ₦4M → unusual inflow detected → contained → Treasure verifies Faith → states
"debt repayment" → identifies John Doe → FlowGuard reassesses the outgoing leg → officer reviews →
officer approves/holds/escalates/blocks → if approved, the bank's system executes the authorized transaction.

## 4. Non-negotiables

- No single signal (customer confirmation, sender, purpose, risk score) authorizes a high-value transaction.
- The risk engine never calls the bank adapter; the customer flow never calls it either — only the
  officer's approval touches the (mock) ledger.
- Fail-safe: if risk services fail, the case is HELD for the bank, never auto-approved.
- Every step is audit-logged with actor, action, timestamp, and metadata.
