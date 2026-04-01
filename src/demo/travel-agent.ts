// src/demo/travel-agent.ts
import { getAgentM2MToken } from '@/lib/get-agent-token';

const GATEWAY_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface FlightSearchParams {
  destination: string;
  date: string;
}

interface FlightBookParams {
  destination: string;
  amount: number;
  airline: string;
  departure: string;
}

// ── Agent SDK: satu-satunya cara agent execute tool ──────────────
async function agentExecuteTool<T extends object>(
  toolName: string,
  params: T
) {
  const token = await getAgentM2MToken({
    clientId: process.env.AGENT_TRAVEL_CLIENT_ID!,
    clientSecret: process.env.AGENT_TRAVEL_CLIENT_SECRET!,
  });

  const response = await fetch(`${GATEWAY_URL}/api/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      toolCall: {
        name: toolName,
        params,
        requiredConnection: 'mock',
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `[${data.error}] ${data.message}` +
      (data.violations ? `\nViolations: ${data.violations.join(', ')}` : '')
    );
  }

  return data;
}

// ── Tool definitions ─────────────────────────────────────────────
export async function searchFlights(params: FlightSearchParams) {
  console.log(`\n🔍 Searching flights to ${params.destination}...`);
  return agentExecuteTool('search_flights', params);
}

export async function bookFlight(params: FlightBookParams) {
  console.log(`\n✈️  Booking flight to ${params.destination} ($${params.amount})...`);
  return agentExecuteTool('book_flight', params);
}

// ── Demo scenarios ───────────────────────────────────────────────
export async function runDemoScenario() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SCOPEGUARD DEMO — Travel Booking Agent');
  console.log('═'.repeat(60));

  // Scenario 1: Search (low risk — no step-up)
  console.log('\n📋 Scenario 1: Search flights (low risk)');
  try {
    const searchResult = await searchFlights({
      destination: 'Bali',
      date: '2026-04-15',
    });
    console.log('✅ Search completed');
    console.log('   Risk:', searchResult.scopeDecision?.riskLevel);
    console.log('   Scopes used:', searchResult.scopeDecision?.minimalScopes);
    console.log('   Explanation:', searchResult.scopeDecision?.explanation);
  } catch (err) {
    console.error('❌ Search failed:', err);
  }

  await sleep(1000);

  // Scenario 2: Book cheap flight (step-up — amount > $200)
  console.log('\n📋 Scenario 2: Book flight $500 (requires step-up)');
  try {
    const bookResult = await bookFlight({
      destination: 'Tokyo',
      amount: 500,
      airline: 'Garuda Indonesia',
      departure: '2026-04-20',
    });
    console.log('✅ Booking completed (step-up approved)');
    console.log('   Step-up completed:', bookResult.stepUpCompleted);
    console.log('   Scopes used:', bookResult.scopeDecision?.minimalScopes);
  } catch (err) {
    console.error('❌ Booking blocked:', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 3: Book expensive flight (hard block — amount > $1000)
  console.log('\n📋 Scenario 3: Book flight $1500 (hard block)');
  try {
    await bookFlight({
      destination: 'New York',
      amount: 1500,
      airline: 'Singapore Airlines',
      departure: '2026-05-01',
    });
    console.log('✅ (should not reach here)');
  } catch (err) {
    console.log('🔴 Correctly blocked by hard constraint:');
    console.log('  ', err instanceof Error ? err.message : err);
  }

  await sleep(1000);

  // Scenario 4: Book to non-whitelisted domain (domain violation)
  console.log('\n📋 Scenario 4: Book via unauthorized API (domain block)');
  try {
    await agentExecuteTool('book_flight', {
      destination: 'Paris',
      amount: 300,
      url: 'https://api.shadytravel.com/book',
    });
  } catch (err) {
    console.log('🔴 Correctly blocked by domain whitelist:');
    console.log('  ', err instanceof Error ? err.message : err);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Demo completed — check dashboard for audit log');
  console.log('═'.repeat(60) + '\n');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}