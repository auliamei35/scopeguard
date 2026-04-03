// src/demo/fraud-agent.ts

const GATEWAY_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function agentExecuteTool(
  toolName: string,
  params: Record<string, unknown>
) {
  // Get M2M token for fraud agent
  const tokenRes = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AGENT_FRAUD_CLIENT_ID,
        client_secret: process.env.AGENT_FRAUD_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
      }),
    }
  );
  const { access_token } = await tokenRes.json();

  const response = await fetch(`${GATEWAY_URL}/api/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      toolCall: { name: toolName, params, requiredConnection: 'mock' },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`[${data.error}] ${data.message}${data.violations ? '\n' + data.violations.join('\n') : ''}`);
  }
  return data;
}

export async function runFraudAgentDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  FRAUD DETECTION AGENT DEMO');
  console.log('═'.repeat(60));

  // Scenario 1: Normal transaction check (low risk, no step-up)
  console.log('\n📋 Scenario 1: Check small transaction ($200) — should pass');
  try {
    const result = await agentExecuteTool('check_transaction', {
      transactionId: 'TXN-001',
      amount: 200,
      currency: 'USD',
      url: 'https://api.bri.co.id/v1/transactions/check',
    });
    console.log('✅ Transaction check completed');
    console.log('   Risk:', result.scopeDecision?.riskLevel);
    console.log('   Scopes used:', result.scopeDecision?.minimalScopes);
    console.log('   Result:', JSON.stringify(result.result));
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 2: High-value transaction (step-up required — > $1000)
  console.log('\n📋 Scenario 2: Flag suspicious $2000 transaction — requires step-up');
  try {
    const result = await agentExecuteTool('flag_transaction', {
      transactionId: 'TXN-002',
      amount: 2000,
      url: 'https://api.bri.co.id/v1/transactions/flag',
      reason: 'velocity_anomaly',
      severity: 'high',
    });
    console.log('✅ Transaction flagged (step-up approved)');
    console.log('   Step-up completed:', result.stepUpCompleted);
    console.log('   Case ID:', (result.result as Record<string, unknown>)?.caseId);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 3: Velocity cap — exceeds 3 actions/hour
  console.log('\n📋 Scenario 3: Rapid-fire 4 requests — velocity cap should trigger');
  for (let i = 1; i <= 4; i++) {
    try {
      await agentExecuteTool('check_transaction', {
        transactionId: `TXN-RAPID-${i}`,
        amount: 100,
        url: 'https://api.bri.co.id/v1/transactions/check',
      });
      console.log(`   Request ${i}: passed`);
    } catch (err) {
      console.log(`🔴 Request ${i}: BLOCKED — ${err instanceof Error ? err.message.split('\n')[0] : err}`);
    }
  }

  await sleep(1000);

  // Scenario 4: Amount exceeds $5000 hard limit
  console.log('\n📋 Scenario 4: $10,000 transfer analysis — hard block (exceeds $5000)');
  try {
    await agentExecuteTool('check_transaction', {
      transactionId: 'TXN-BIG',
      amount: 10000,
      url: 'https://api.bri.co.id/v1/transactions/check',
    });
    console.log('✅ (should not reach here)');
  } catch (err) {
    console.log('🔴 Correctly blocked by hard constraint:');
    console.log('  ', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 5: Domain not in whitelist
  console.log('\n📋 Scenario 5: Call to non-banking domain — domain whitelist block');
  try {
    await agentExecuteTool('check_transaction', {
      transactionId: 'TXN-DOMAIN',
      amount: 100,
      url: 'https://api.mandiri.co.id/v1/transactions',
    });
  } catch (err) {
    console.log('🔴 Correctly blocked by domain whitelist:');
    console.log('  ', err instanceof Error ? err.message : err);
  }

  // Scenario 6: Forbidden scope attempt
  console.log('\n📋 Scenario 6: Attempt transfer:execute scope — forbidden scope block');
  try {
    await agentExecuteTool('check_transaction', {
      transactionId: 'TXN-SCOPE',
      amount: 100,
      url: 'https://api.bri.co.id/v1/transactions/check',
      scopes: ['transfer:execute', 'account:write'],
    });
  } catch (err) {
    console.log('🔴 Correctly blocked by scope ceiling:');
    console.log('  ', err instanceof Error ? err.message : err);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Fraud Agent Demo completed');
  console.log('═'.repeat(60) + '\n');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}