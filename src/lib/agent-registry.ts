// src/lib/agent-registry.ts
import type { AgentProfile } from '@/types';

const registry = new Map<string, AgentProfile>();

// ── Agent 1: Travel Booking ──────────────────────────────────────
const travelAgent: AgentProfile = {
  agentId: 'travel-booking-agent-v1',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: [
    'payment:write',
    'calendar:events:write',
    'email:send',
  ],
  hardLimits: {
    maxTransactionAmountUSD: 1000,
    allowedDomains: ['api.traveloka.com', 'api.tiket.com'],
    maxActionsPerMinute: 5,
    forbiddenScopes: ['payment:admin', 'contacts:delete', 'files:delete'],
    requiresStepUpAboveUSD: 200,
  },
  auth0ClientId: '',
  createdAt: new Date('2026-01-29'),
  version: '1.0.0',
  isActive: true,
};

// ── Agent 2: Fraud Detection ─────────────────────────────────────
const fraudAgent: AgentProfile = {
  agentId: 'fraud-detection-agent-v1',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: [
    'transaction:read',
    'transaction:flag',
    'alert:write',
    'account:read',
  ],
  hardLimits: {
    maxTransactionAmountUSD: 5000,
    allowedDomains: ['api.bri.co.id', 'api.bca.co.id'],
    maxActionsPerMinute: 3,
    forbiddenScopes: [
      'transaction:approve',
      'account:write',
      'account:delete',
      'transfer:execute',
    ],
    requiresStepUpAboveUSD: 1000,
  },
  auth0ClientId: '',
  createdAt: new Date('2026-02-01'),
  version: '1.0.0',
  isActive: true,
};

// ── Agent 3: AML Compliance ──────────────────────────────────────
const amlAgent: AgentProfile = {
  agentId: 'aml-compliance-agent-v1',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: [
    'transaction:read',
    'transaction:flag',
    'sar:write',
    'kyc:read',
    'kyc:flag',
    'alert:write',
  ],
  hardLimits: {
    maxTransactionAmountUSD: 100000,
    allowedDomains: ['akun.bri.co.id', 'api.bri.co.id'],
    maxActionsPerMinute: 5,
    forbiddenScopes: [
      'transaction:approve',
      'account:write',
      'transfer:execute',
      'kyc:delete',
    ],
    requiresStepUpAboveUSD: 50000,
    highRiskCountries: ['KY', 'VG', 'BZ', 'PA'],  // Cayman, BVI, Belize, Panama
    sarThresholdUSD: 10000,
    blockedCountries: ['KP', 'IR', 'SY', 'CU'],   // OFAC sanctioned
  },
  auth0ClientId: '',
  createdAt: new Date('2026-02-02'),
  version: '1.0.0',
  isActive: true,
};

// ── Agent 4: HR Onboarding ───────────────────────────────────────
const hrAgent: AgentProfile = {
  agentId: 'hr-onboarding-agent-v1',
  agentType: 'specialist',
  ownerUserId: 'demo-user',
  declaredCapabilities: [
    'employee:read',
    'employee:write',
    'directory:write',
    'email:send',
    'onboarding:write',
  ],
  hardLimits: {
    maxTransactionAmountUSD: 0,           // HR agent tidak pernah handle payment
    allowedDomains: ['api.hr.internal', 'api.directory.internal'],
    maxActionsPerMinute: 10,
    forbiddenScopes: [
      'employee:delete',
      'payroll:write',
      'payroll:read',
      'medical:read',
      'medical:write',
      'performance:delete',
    ],
    requiresStepUpAboveUSD: 0,
    allowedDataFields: [
      'email', 'phone', 'department', 'name',
      'position', 'start_date', 'manager', 'team', 'role',
    ],
    blockedDataFields: [
      'salary', 'bonus', 'tax', 'bank_account',
      'salary_history', 'performance_score', 'review_notes',
      'rating', 'medical_history', 'insurance', 'disability',
    ],
    dataRetentionDays: 90,
    requiresStepUpForFields: [
      'address', 'id_card', 'contract', 'nda',
    ],
  },
  auth0ClientId: '',
  createdAt: new Date('2026-03-01'),
  version: '1.0.0',
  isActive: true,
};

registry.set(travelAgent.agentId, travelAgent);
registry.set(fraudAgent.agentId, fraudAgent);
registry.set(amlAgent.agentId, amlAgent);
registry.set(hrAgent.agentId, hrAgent);

// ── Resolve env at runtime (avoid module-load timing issue) ──────
function resolveClientId(profile: AgentProfile): AgentProfile {
  const clientIdMap: Record<string, string> = {
    'travel-booking-agent-v1': process.env.AGENT_TRAVEL_CLIENT_ID || '',
    'fraud-detection-agent-v1': process.env.AGENT_FRAUD_CLIENT_ID || '',
    'aml-compliance-agent-v1':  process.env.AGENT_AML_CLIENT_ID   || '',
    'hr-onboarding-agent-v1':   process.env.AGENT_HR_CLIENT_ID    || '',
  };
  const clientId = clientIdMap[profile.agentId];
  if (clientId && !profile.auth0ClientId) {
    return { ...profile, auth0ClientId: clientId };
  }
  return profile;
}

// ── Public API ───────────────────────────────────────────────────
export function getAgentProfile(agentId: string): AgentProfile | undefined {
  const profile = registry.get(agentId);
  if (!profile) return undefined;
  return resolveClientId(profile);
}

export function getAgentByClientId(clientId: string): AgentProfile | undefined {
  return Array.from(registry.values())
    .map(resolveClientId)
    .find(a => a.auth0ClientId === clientId);
}

export function getAllAgents(): AgentProfile[] {
  return Array.from(registry.values()).map(resolveClientId);
}

export function isAgentActive(agentId: string): boolean {
  return registry.get(agentId)?.isActive === true;
}

export function revokeAgent(agentId: string): boolean {
  const agent = registry.get(agentId);
  if (!agent) return false;
  registry.set(agentId, { ...agent, isActive: false });
  return true;
}