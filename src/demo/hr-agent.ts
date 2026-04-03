// src/demo/hr-agent.ts

const GATEWAY_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function getHRToken(): Promise<string> {
  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: process.env.AGENT_HR_CLIENT_ID,
        client_secret: process.env.AGENT_HR_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get HR agent token');
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

export async function runHRAgentDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  HR ONBOARDING AGENT DEMO');
  console.log('═'.repeat(60));

  const token = await getHRToken();

  // Scenario 1: Onboard new employee (allowed fields only)
  console.log('\n📋 Scenario 1: Create onboarding task — allowed fields only → pass');
  try {
    const result = await agentExecuteTool(token, 'create_onboarding_task', {
      employeeId: 'EMP-NEW-001',
      fields: ['email', 'department', 'start_date', 'name'],
      assignee: 'hr-coordinator',
      url: 'https://api.hr.internal/v1/onboarding',
    });
    console.log('✅ Onboarding task created');
    console.log('   Risk:', result.scopeDecision?.riskLevel);
    console.log('   Scopes:', result.scopeDecision?.minimalScopes);
    console.log('   Task ID:', (result.result as Record<string, unknown>)?.taskId);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 2: Get employee profile (allowed fields)
  console.log('\n📋 Scenario 2: Get employee contact info — allowed fields → pass');
  try {
    const result = await agentExecuteTool(token, 'get_employee_contact', {
      employeeId: 'EMP-001',
      fields: ['email', 'phone', 'department'],
      url: 'https://api.hr.internal/v1/employees/contact',
    });
    console.log('✅ Contact info retrieved');
    console.log('   Explanation:', result.scopeDecision?.explanation);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 3: Access payroll — HARD BLOCK (data classification)
  console.log('\n📋 Scenario 3: Access salary data — data classification HARD BLOCK');
  try {
    await agentExecuteTool(token, 'get_payroll', {
      employeeId: 'EMP-001',
      fields: ['salary', 'bonus', 'bank_account'],
      url: 'https://api.hr.internal/v1/payroll',
    });
    console.log('✅ (should not reach here)');
  } catch (err) {
    console.log('🚫 Correctly blocked by data classification:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  await sleep(1000);

  // Scenario 4: Access performance review — HARD BLOCK
  console.log('\n📋 Scenario 4: Access performance review — data classification HARD BLOCK');
  try {
    await agentExecuteTool(token, 'get_performance_review', {
      employeeId: 'EMP-001',
      fields: ['performance_score', 'review_notes', 'rating'],
      url: 'https://api.hr.internal/v1/performance',
    });
    console.log('✅ (should not reach here)');
  } catch (err) {
    console.log('🚫 Correctly blocked by data classification:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  await sleep(1000);

  // Scenario 5: Access employee documents (id_card) — step-up required
  console.log('\n📋 Scenario 5: Access employee documents (id_card) — sensitive → step-up');
  try {
    const result = await agentExecuteTool(token, 'get_employee_documents', {
      employeeId: 'EMP-001',
      fields: ['id_card', 'contract'],
      url: 'https://api.hr.internal/v1/documents',
    });
    console.log('✅ Documents retrieved after step-up approval');
    console.log('   Step-up completed:', result.stepUpCompleted);
  } catch (err) {
    console.error('❌', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 6: Forbidden scope attempt
  console.log('\n📋 Scenario 6: Attempt employee:delete scope — forbidden scope block');
  try {
    await agentExecuteTool(token, 'get_employee_profile', {
      employeeId: 'EMP-001',
      fields: ['email', 'department'],
      url: 'https://api.hr.internal/v1/employees',
      scopes: ['employee:delete', 'payroll:write'],
    });
  } catch (err) {
    console.log('🔴 Correctly blocked by scope ceiling:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  await sleep(1000);

  // Scenario 7: Domain violation
  console.log('\n📋 Scenario 7: Access external API — domain whitelist block');
  try {
    await agentExecuteTool(token, 'get_employee_profile', {
      employeeId: 'EMP-001',
      fields: ['email', 'department'],
      url: 'https://api.external-hr-vendor.com/employees',
    });
  } catch (err) {
    console.log('🔴 Correctly blocked by domain whitelist:');
    console.log('  ', err instanceof Error ? err.message.split('\n')[0] : err);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  HR Agent Demo completed');
  console.log('═'.repeat(60) + '\n');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}