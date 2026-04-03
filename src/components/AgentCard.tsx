// src/components/AgentCard.tsx
import type { AgentProfile } from '@/types';

interface Props {
  agent: AgentProfile & {
    permissions: { declared: string[]; humanReadable: string[] };
    limits: {
      maxTransactionUSD: number;
      stepUpThresholdUSD: number;
      allowedDomains: string[];
      maxActionsPerMinute: number;
      forbiddenScopes: string[];
    };
    isActive: boolean;
  };
  onRevoke?: (agentId: string) => void;
  onSimulateStepUp?: (agentId: string) => void;
  isRevoking?: boolean;
}

const AGENT_COLORS: Record<string, { accent: string; bg: string }> = {
  'travel-booking-agent-v1':  { accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  'fraud-detection-agent-v1': { accent: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'aml-compliance-agent-v1':  { accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'hr-onboarding-agent-v1':   { accent: '#10b981', bg: 'rgba(16,185,129,0.1)' },

};

export function getAgentColor(agentId: string) {
  return AGENT_COLORS[agentId] ?? { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' };
}

export function AgentBadge({ agentId }: { agentId: string }) {
  const { accent, bg } = getAgentColor(agentId);
  const labels: Record<string, string> = {
    'travel-booking-agent-v1':  'Travel',
    'fraud-detection-agent-v1': 'Fraud Detection',
    'aml-compliance-agent-v1':  'AML Compliance',
    'hr-onboarding-agent-v1':   'HR Onboarding',
  };
  return (
    <span style={{
      background: bg,
      color: accent,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 20,
      fontFamily: 'var(--mono, monospace)',
    }}>
      {labels[agentId] ?? agentId}
    </span>
  );
}