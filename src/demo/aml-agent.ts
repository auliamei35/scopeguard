// src/demo/aml-agent.ts

const GATEWAY_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function getAMLToken(): Promise<string> {
  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AGENT_AML_CLIENT_ID,
        client_secret: process.env.AGENT_AML_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get AML agent token');
  return data.access_token;
}

async function agentExecuteTool(
  token: string,
  toolName: string,
  params: Record<string, unknown>
) {
  const response = await fetch(`${GATEWAY_URL}/api/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      toolCall: { name: toolName, params, requiredConnection: 'mock' },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `[${data.error}] ${data.message}` +
      (data.violations ? '\n' + data.violations.join('\n') : '')
    );
  }
  return data;
}

export async function runAMLAgentDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  AML COMPLIANCE AGENT DEMO');
  console.log('═'.repeat(60));

  const token = await getAMLToken();

  // Scenario 1: Normal AML check ($500, normal country) — passes
  console.log('\n📋 Scenario 1: AML check $500 domestic — should pass');
  try {
    const result = await agentExecuteTool(token, 'check_aml', {
      transactionId: 'TXN-AML-001',
      amount: 500,
      country: 'ID',
      url: 'https://api.bri.co.id/v1/aml/check',
    });
    console.log('✅ AML check passed');
    console.log('   Risk:', result.scopeDecision?.riskLevel);
    console.log('   Explanation:', result.scopeDecision?.explanation);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1200);

  // Scenario 2: $50K to high-risk country (KY — Cayman Islands) → step-up
  console.log('\n📋 Scenario 2: $50,000 to Cayman Islands (KY) — SAR + high-risk country → step-up');
  try {
    const result = await agentExecuteTool(token, 'screen_transaction', {
      transactionId: 'TXN-AML-002',
      amount: 50000,
      country: 'KY',
      recipient: 'Offshore Corp Ltd',
      url: 'https://api.bri.co.id/v1/aml/screen',
    });
    console.log('✅ Transaction screened (step-up approved)');
    console.log('   Step-up completed:', result.stepUpCompleted);
    console.log('   Scopes used:', result.scopeDecision?.minimalScopes);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1200);

  // Scenario 3: OFAC sanctioned country (KP — North Korea) → HARD BLOCK
  console.log('\n📋 Scenario 3: Transaction to North Korea (KP) — OFAC sanctioned → hard block');
  try {
    await agentExecuteTool(token, 'check_aml', {
      transactionId: 'TXN-AML-003',
      amount: 100,
      country: 'KP',
      url: 'https://api.bri.co.id/v1/aml/check',
    });
    console.log('✅ (should not reach here)');
  } catch (err) {
    console.log('🔴 Correctly blocked:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  await sleep(1200);

  // Scenario 4: SAR filing for $10K+ transaction
  console.log('\n📋 Scenario 4: File SAR for $15,000 suspicious transaction → step-up required');
  try {
    const result = await agentExecuteTool(token, 'file_sar', {
      transactionId: 'TXN-AML-004',
      amount: 15000,
      country: 'SG',
      reason: 'structuring',
      url: 'https://akun.bri.co.id/v1/sar/file',
    });
    console.log('✅ SAR filed (step-up approved)');
    console.log('   SAR ID:', (result.result as Record<string, unknown>)?.sarId);
    console.log('   Step-up completed:', result.stepUpCompleted);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1200);

  // Scenario 5: KYC verification for high-risk account
  console.log('\n📋 Scenario 5: KYC verification — low risk, should pass without step-up');
  try {
    const result = await agentExecuteTool(token, 'verify_kyc', {
      customerId: 'CUST-12345',
      country: 'ID',
      url: 'https://akun.bri.co.id/v1/kyc/verify',
    });
    console.log('✅ KYC verified');
    console.log('   Risk level:', result.scopeDecision?.riskLevel);
    console.log('   Reversible:', result.scopeDecision?.reversible);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1200);

  // Scenario 6: Forbidden scope attempt
  console.log('\n📋 Scenario 6: Attempt kyc:delete scope — forbidden scope block');
  try {
    await agentExecuteTool(token, 'verify_kyc', {
      customerId: 'CUST-99999',
      country: 'ID',
      url: 'https://akun.bri.co.id/v1/kyc/verify',
      scopes: ['kyc:delete', 'account:write'],
    });
  } catch (err) {
    console.log('🔴 Correctly blocked:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  AML Agent Demo completed');
  console.log('═'.repeat(60) + '\n');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}