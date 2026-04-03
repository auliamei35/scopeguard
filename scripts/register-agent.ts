// scripts/register-agent.ts
// Run: npx ts-node --esm scripts/register-agent.ts fraud-detection-agent-v1

import 'dotenv/config';

const AGENT_CONFIGS: Record<string, {
  name: string;
  metadata: Record<string, string>;
  envKeyId: string;
  envKeySecret: string;
}> = {
  'travel-booking-agent-v1': {
    name: 'ScopeGuard Agent: travel-booking-agent-v1',
    metadata: {
      scopeguard_agent_id: 'travel-booking-agent-v1',
      scopeguard_agent_type: 'specialist',
      scopeguard_max_amount_usd: '1000',
      scopeguard_allowed_domains: 'api.traveloka.com,api.tiket.com',
      scopeguard_stepup_threshold_usd: '200',
    },
    envKeyId: 'AGENT_TRAVEL_CLIENT_ID',
    envKeySecret: 'AGENT_TRAVEL_CLIENT_SECRET',
  },
  'fraud-detection-agent-v1': {
    name: 'ScopeGuard Agent: fraud-detection-agent-v1',
    metadata: {
      scopeguard_agent_id: 'fraud-detection-agent-v1',
      scopeguard_agent_type: 'specialist',
      scopeguard_max_amount_usd: '5000',
      scopeguard_allowed_domains: 'api.bri.co.id,api.bca.co.id',
      scopeguard_stepup_threshold_usd: '1000',
    },
    envKeyId: 'AGENT_FRAUD_CLIENT_ID',
    envKeySecret: 'AGENT_FRAUD_CLIENT_SECRET',
  },
  'aml-compliance-agent-v1': {
    name: 'ScopeGuard Agent: aml-compliance-agent-v1',
    metadata: {
      scopeguard_agent_id: 'aml-compliance-agent-v1',
      scopeguard_agent_type: 'specialist',
      scopeguard_max_amount_usd: '10000',
      scopeguard_allowed_domains: 'akun.bri.co.id,api.bri.co.id',
      scopeguard_stepup_threshold_usd: '10000',
    },
    envKeyId: 'AGENT_AML_CLIENT_ID',
    envKeySecret: 'AGENT_AML_CLIENT_SECRET',
  },
  // Tambahkan ke AGENT_CONFIGS
  'hr-onboarding-agent-v1': {
    name: 'ScopeGuard Agent: hr-onboarding-agent-v1',
    metadata: {
      scopeguard_agent_id: 'hr-onboarding-agent-v1',
      scopeguard_agent_type: 'specialist',
      scopeguard_max_amount_usd: '0',
      scopeguard_allowed_domains: 'api.hr.internal,api.directory.internal',
      scopeguard_stepup_threshold_usd: '0',
    },
    envKeyId: 'AGENT_HR_CLIENT_ID',
    envKeySecret: 'AGENT_HR_CLIENT_SECRET',
  },
};

async function getManagementToken(): Promise<string> {
  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`,
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get management token');
  return data.access_token;
}

async function registerAgent(agentId: string) {
  const config = AGENT_CONFIGS[agentId];
  if (!config) {
    console.error(`Unknown agent: ${agentId}`);
    console.log('Available agents:', Object.keys(AGENT_CONFIGS).join(', '));
    process.exit(1);
  }

  console.log(`\nRegistering: ${agentId}`);

  const token = await getManagementToken();

  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/clients`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: config.name,
        app_type: 'non_interactive',
        grant_types: ['client_credentials'],
        client_metadata: config.metadata,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Failed:', data);
    process.exit(1);
  }

  console.log(`✅ Created successfully`);
  console.log(`\nAdd these to your .env.local:`);
  console.log(`${config.envKeyId}=${data.client_id}`);
  console.log(`${config.envKeySecret}=${data.client_secret}`);
}

const agentId = process.argv[2];
if (!agentId) {
  console.log('Usage: npx ts-node scripts/register-agent.ts <agent-id>');
  console.log('Available:', Object.keys(AGENT_CONFIGS).join(', '));
  process.exit(1);
}

registerAgent(agentId);