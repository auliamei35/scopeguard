// src/app/api/demo/token/route.ts
// Helper endpoint: returns M2M token for a given agentId
// Used by the /ask simulator to make real gateway calls
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

const AGENT_CREDENTIALS: Record<string, { clientId: string; clientSecret: string }> = {
  'travel-booking-agent-v1': {
    clientId:     process.env.AGENT_TRAVEL_CLIENT_ID     ?? '',
    clientSecret: process.env.AGENT_TRAVEL_CLIENT_SECRET ?? '',
  },
  'fraud-detection-agent-v1': {
    clientId:     process.env.AGENT_FRAUD_CLIENT_ID     ?? '',
    clientSecret: process.env.AGENT_FRAUD_CLIENT_SECRET ?? '',
  },
  'aml-compliance-agent-v1': {
    clientId:     process.env.AGENT_AML_CLIENT_ID     ?? '',
    clientSecret: process.env.AGENT_AML_CLIENT_SECRET ?? '',
  },
  'hr-onboarding-agent-v1': {
    clientId:     process.env.AGENT_HR_CLIENT_ID     ?? '',
    clientSecret: process.env.AGENT_HR_CLIENT_SECRET ?? '',
  },
};

// Simple in-memory token cache (60s buffer before expiry)
const cache = new Map<string, { token: string; expiresAt: number }>();

export async function POST(request: Request) {
  const { agentId } = await request.json();

  const creds = AGENT_CREDENTIALS[agentId];
  if (!creds || !creds.clientId) {
    return NextResponse.json({ error: 'Unknown agent or missing credentials' }, { status: 400 });
  }

  // Return cached token if still valid
  const cached = cache.get(agentId);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return NextResponse.json({ token: cached.token });
  }

  const issuer   = process.env.AUTH0_ISSUER_BASE_URL!;
  const audience = process.env.AUTH0_AUDIENCE!;

  const res = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'client_credentials',
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      audience,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Auth0 token fetch failed: ${err}` }, { status: 502 });
  }

  const { access_token, expires_in } = await res.json();

  cache.set(agentId, {
    token: access_token,
    expiresAt: Date.now() + expires_in * 1000,
  });

  return NextResponse.json({ token: access_token });
}