// src/app/api/agents/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAllAgents, revokeAgent } from '@/lib/agent-registry';

export async function GET() {
  const agents = getAllAgents();

  const result = agents.map((agent) => ({
    agentId: agent.agentId,
    agentType: agent.agentType,
    isActive: agent.isActive,
    version: agent.version,
    createdAt: agent.createdAt,
    permissions: {
      declared: agent.declaredCapabilities,
      humanReadable: agent.declaredCapabilities.map(scopeToHuman),
    },
    limits: {
      maxTransactionUSD: agent.hardLimits.maxTransactionAmountUSD,
      stepUpThresholdUSD: agent.hardLimits.requiresStepUpAboveUSD,
      allowedDomains: agent.hardLimits.allowedDomains,
      maxActionsPerMinute: agent.hardLimits.maxActionsPerMinute,
      forbiddenScopes: agent.hardLimits.forbiddenScopes,
    },
  }));

  return NextResponse.json({ agents: result });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const success = revokeAgent(agentId);
  if (!success) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: `Agent ${agentId} revoked` });
}

function scopeToHuman(scope: string): string {
  const map: Record<string, string> = {
    'payment:write':          'Make payments on your behalf',
    'calendar:events:write':  'Create and edit calendar events',
    'email:send':             'Send emails on your behalf',
    'email:read':             'Read your emails',
    'contacts:read':          'View your contacts',
    'files:read':             'Read your files',
    'files:write':            'Create and edit files',
    'profile:read':           'View your profile information',
  };
  return map[scope] ?? scope.replace(/:/g, ' — ').replace(/_/g, ' ');
}