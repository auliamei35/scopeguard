// src/lib/agent-registry.ts
import type { AgentProfile } from '@/types';

const registry = new Map<string, AgentProfile>();

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
  auth0ClientId: '',   // ← kosongkan di sini, diisi lazy di bawah
  createdAt: new Date('2026-01-15'),
  version: '1.0.0',
  isActive: true,
};

registry.set(travelAgent.agentId, travelAgent);

// ── Helper: resolve auth0ClientId dari env saat runtime ──────────
function resolveClientId(profile: AgentProfile): AgentProfile {
  if (profile.agentId === 'travel-booking-agent-v1' && !profile.auth0ClientId) {
    return {
      ...profile,
      auth0ClientId: process.env.AGENT_TRAVEL_CLIENT_ID || '',
    };
  }
  return profile;
}

// ── Public API ───────────────────────────────────────────────────

export function getAgentProfile(agentId: string): AgentProfile | undefined {
  const profile = registry.get(agentId);
  if (!profile) return undefined;
  return resolveClientId(profile);  // ← resolve env saat dipanggil
}

export function getAgentByClientId(clientId: string): AgentProfile | undefined {
  return Array.from(registry.values())
    .map(resolveClientId)
    .find((a) => a.auth0ClientId === clientId);
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