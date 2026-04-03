// src/types/index.ts

// ─────────────────────────────────────────────
// AGENT IDENTITY & PROFILE
// ─────────────────────────────────────────────

export type AgentType = 'orchestrator' | 'specialist' | 'tool-executor';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskTolerance = 'low' | 'medium' | 'high';
export type Currency = 'USD';

export interface AgentHardLimits {
  maxTransactionAmountUSD: number;      // Ceiling absolut per transaksi
  allowedDomains: string[];             // Whitelist domain yang boleh diakses
  maxActionsPerMinute: number;          // Velocity cap
  forbiddenScopes: string[];            // Scope yang tidak pernah boleh diminta
  requiresStepUpAboveUSD: number;       // Threshold untuk CIBA step-up
  // AML-specific
  highRiskCountries?: string[];        // ISO 3166-1 alpha-2 codes
  sarThresholdUSD?: number;            // Suspicious Activity Report threshold
  blockedCountries?: string[];         // Hard block — no override
  // HR-specific
  allowedDataFields?: string[];         // Whitelist field yang boleh dibaca
  blockedDataFields?: string[];         // Field yang TIDAK PERNAH boleh dibaca
  dataRetentionDays?: number;           // Berapa lama data boleh di-cache
  requiresStepUpForFields?: string[];   // Field yang butuh step-up sebelum akses
}

export interface AgentProfile {
  agentId: string;
  agentType: AgentType;
  ownerUserId: string;
  declaredCapabilities: string[];
  hardLimits: AgentHardLimits;
  auth0ClientId: string;
  createdAt: Date;
  version: string;
  isActive: boolean;
}

// Claims yang di-inject oleh Auth0 Action ke M2M access token
export interface AgentTokenClaims {
  'https://scopeguard.dev/agent_id': string;
  'https://scopeguard.dev/agent_type': AgentType;
  'https://scopeguard.dev/max_amount_usd': number;
  'https://scopeguard.dev/allowed_domains': string[];
  'https://scopeguard.dev/stepup_threshold_usd': number;
  sub: string;      // Auth0 client ID
  iss: string;      // Auth0 issuer
  aud: string[];    // API audience
  exp: number;
  iat: number;
}

// ─────────────────────────────────────────────
// TOOL CALL
// ─────────────────────────────────────────────

export type ConnectionType = 'google-oauth2' | 'github' | 'stripe' | 'mock';

export interface ToolCall {
  name: string;
  params: Record<string, unknown>;
  requiredConnection: ConnectionType;
}

// ─────────────────────────────────────────────
// GATEWAY LAYER RESULTS
// ─────────────────────────────────────────────

// Layer 1 result
export interface IdentityVerificationResult {
  agentProfile: AgentProfile;
  claims: AgentTokenClaims;
  verifiedAt: Date;
}

// Layer 2 result
export interface ConstraintCheckResult {
  allowed: boolean;
  blockedReasons: string[];
  requiresStepUp: boolean;
  auditData: {
    transactionAmountUSD: number | null;
    targetDomain: string | null;
    recentActionCount: number;
    flaggedScopes: string[];
  };
}

// Layer 3 result
export interface ScopeDecision {
  minimalScopes: string[];
  riskLevel: RiskLevel;
  requiresStepUp: boolean;
  naturalLanguageExplanation: string;   // Untuk consent modal & CIBA binding message
  reversible: boolean;
  reasoning: string;                    // Untuk audit log & insight value
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

export type AuditEventType =
  | 'AGENT_IDENTITY_RESOLVED'
  | 'IDENTITY_REJECTED'
  | 'CONSTRAINT_PASSED'
  | 'CONSTRAINT_BLOCKED'
  | 'DATA_ACCESS_BLOCKED'
  | 'DATA_STEPUP_REQUIRED'
  | 'SCOPE_DECIDED'
  | 'STEPUP_TRIGGERED'
  | 'STEPUP_APPROVED'
  | 'STEPUP_DENIED'
  | 'STEPUP_TIMEOUT'
  | 'TOOL_EXECUTED_SUCCESS'
  | 'TOOL_EXECUTION_FAILED'
  | 'AGENT_REVOKED';

export interface AuditLogEntry {
  id: string;
  event: AuditEventType;
  timestamp: Date;
  agentId: string;
  ownerUserId?: string;
  toolName?: string;
  // Security insight: apa yang di-grant vs benar-benar dipakai
  scopesGranted?: string[];
  scopesActuallyUsed?: string[];
  riskLevel?: RiskLevel;
  stepUpRequired?: boolean;
  stepUpApproved?: boolean;
  constraintViolations?: string[];
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// USER CONTEXT
// ─────────────────────────────────────────────

export interface UserContext {
  userId: string;
  email: string;
  riskTolerance: RiskTolerance;
  revokedAgents: string[];
}

// ─────────────────────────────────────────────
// GATEWAY REQUEST & RESPONSE
// ─────────────────────────────────────────────

export interface GatewayRequest {
  toolCall: ToolCall;
}

export interface GatewayResponse {
  success: boolean;
  result?: unknown;
  auditId: string;
  scopesUsed?: string[];
  riskLevel?: RiskLevel;
}

export interface GatewayError {
  error:
    | 'INVALID_REQUEST'
    | 'UNREGISTERED_AGENT'
    | 'IDENTITY_REJECTED'
    | 'HARD_CONSTRAINT_VIOLATION'
    | 'SCOPE_CEILING_EXCEEDED'
    | 'STEPUP_DENIED'
    | 'STEPUP_TIMEOUT'
    | 'EXECUTION_FAILED';
  message: string;
  violations?: string[];
  auditId: string;
}