// src/types/approvals.ts
// Shared types for CIBA approval flow — used by API, /approvals UI, and /ask polling

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** A structured risk reason — replaces free-form explanation string */
export interface RiskReason {
  label: string;   // e.g. "Amount exceeds $300 threshold"
  severity: 'info' | 'warn' | 'critical';
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentLabel: string;
  agentColor: string;
  agentVerified: boolean;        // ← Point 2: request authenticity
  sessionId: string;             // ← Point 2: session traceability
  tool: string;
  amount?: number;
  destination?: string;
  currency?: string;
  scopes: string[];
  dangerousScopes: string[];     // ← Bonus 2: highlight dangerous scopes
  riskLevel: RiskLevel;
  riskReasons: RiskReason[];     // ← Point 3: structured risk explanation
  denyConsequences: string[];    // ← Point 4: what happens if denied
  reversible: boolean;
  expiresAt: Date;               // ← Bonus 1: countdown expiry
  createdAt: Date;
  status: ApprovalStatus;
  resolvedAt?: Date;
  resolvedBy?: string;           // ← Point 5: audit trail
  resolvedNote?: string;         // ← Point 5: reason for decision
}

/** Payload sent to POST /api/approve */
export interface ApprovePayload {
  id: string;
  decision: 'approved' | 'denied';
  resolvedBy?: string;
  resolvedNote?: string;
}

/** Response from POST /api/approve */
export interface ApproveResponse {
  ok: boolean;
  status: ApprovalStatus;
  error?: string;
}

/** Response from GET /api/approve?id=xxx (polling) */
export interface PollResponse {
  id: string;
  status: ApprovalStatus;
  resolvedAt?: string;
}