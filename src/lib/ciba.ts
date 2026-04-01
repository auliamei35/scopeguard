// src/lib/ciba.ts
import { auditLog } from '@/lib/audit-log';
import { StepUpDeniedError, StepUpTimeoutError } from '@/lib/errors';

interface CIBARequest {
  userId: string;
  agentId: string;
  bindingMessage: string;    // Pesan yang user lihat di notifikasi
  scopes: string[];
  timeoutSeconds?: number;
}

interface CIBAResult {
  approved: boolean;
  approvedAt?: Date;
}

// Polling interval dan timeout
const POLL_INTERVAL_MS = 3000;   // cek setiap 3 detik
const DEFAULT_TIMEOUT_S = 120;   // 2 menit

export async function requestStepUpApproval(
  params: CIBARequest
): Promise<CIBAResult> {
  const {
    userId,
    agentId,
    bindingMessage,
    scopes,
    timeoutSeconds = DEFAULT_TIMEOUT_S,
  } = params;

  const issuer = process.env.AUTH0_ISSUER_BASE_URL!;
  const clientId = process.env.AUTH0_CLIENT_ID!;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET!;
  const audience = process.env.AUTH0_AUDIENCE!;

  auditLog({
    event: 'STEPUP_TRIGGERED',
    agentId,
    ownerUserId: userId,
    metadata: { bindingMessage, scopes },
  });

  // ── Step 1: Initiate CIBA request ────────────────────────────
  let authReqId: string;
  let expiresIn: number;

  try {
    const cibaResponse = await fetch(`${issuer}/bc-authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        login_hint: JSON.stringify({ format: 'iss_sub', iss: issuer, sub: userId }),
        scope: ['openid', ...scopes].join(' '),
        audience,
        binding_message: bindingMessage,
        request_expiry: String(timeoutSeconds),
      }),
    });

    if (!cibaResponse.ok) {
      const error = await cibaResponse.json();
      // Jika CIBA belum dikonfigurasi, gunakan mock untuk development
      if (error.error === 'unauthorized_client' || cibaResponse.status === 403) {
        console.warn('[ScopeGuard] CIBA not configured — using mock approval for dev');
        return mockCIBAApproval(params);
      }
      throw new Error(`CIBA initiation failed: ${JSON.stringify(error)}`);
    }

    const cibaData = await cibaResponse.json();
    authReqId = cibaData.auth_req_id;
    expiresIn = cibaData.expires_in || timeoutSeconds;

  } catch (err) {
    if (err instanceof StepUpDeniedError || err instanceof StepUpTimeoutError) {
      throw err;
    }
    // Network error atau CIBA tidak tersedia — fallback ke mock
    console.warn('[ScopeGuard] CIBA unavailable, using mock:', err);
    return mockCIBAApproval(params);
  }

  // ── Step 2: Poll untuk approval ──────────────────────────────
  const deadline = Date.now() + Math.min(expiresIn, timeoutSeconds) * 1000;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const tokenResponse = await fetch(`${issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'urn:openid:params:grant-type:ciba',
        auth_req_id: authReqId,
      }),
    });

    const tokenData = await tokenResponse.json();

    // User approved
    if (tokenResponse.ok && tokenData.access_token) {
      auditLog({
        event: 'STEPUP_APPROVED',
        agentId,
        ownerUserId: userId,
        stepUpApproved: true,
      });
      return { approved: true, approvedAt: new Date() };
    }

    // User denied
    if (tokenData.error === 'access_denied') {
      auditLog({
        event: 'STEPUP_DENIED',
        agentId,
        ownerUserId: userId,
        stepUpApproved: false,
      });
      throw new StepUpDeniedError();
    }

    // Masih pending — lanjut polling
    if (tokenData.error === 'authorization_pending' ||
        tokenData.error === 'slow_down') {
      continue;
    }

    // Error lain — stop
    throw new Error(`CIBA polling error: ${JSON.stringify(tokenData)}`);
  }

  // Timeout
  auditLog({
    event: 'STEPUP_TIMEOUT',
    agentId,
    ownerUserId: userId,
    stepUpApproved: false,
  });
  throw new StepUpTimeoutError();
}

// ── Mock untuk development (CIBA belum dikonfigurasi) ────────────
async function mockCIBAApproval(params: CIBARequest): Promise<CIBAResult> {
  const autoApprove = process.env.CIBA_MOCK_AUTO_APPROVE !== 'false';

  console.log(`\n${'─'.repeat(60)}`);
  console.log('[ScopeGuard] 🔔 STEP-UP APPROVAL REQUIRED');
  console.log(`  Agent:   ${params.agentId}`);
  console.log(`  User:    ${params.userId}`);
  console.log(`  Action:  ${params.bindingMessage}`);
  console.log(`  Scopes:  ${params.scopes.join(', ')}`);
  console.log(`  Mode:    ${autoApprove ? 'AUTO-APPROVE (dev)' : 'AUTO-DENY (dev)'}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Simulasi delay user melihat notifikasi
  await sleep(2000);

  if (!autoApprove) {
    auditLog({
      event: 'STEPUP_DENIED',
      agentId: params.agentId,
      ownerUserId: params.userId,
      stepUpApproved: false,
    });
    throw new StepUpDeniedError();
  }

  auditLog({
    event: 'STEPUP_APPROVED',
    agentId: params.agentId,
    ownerUserId: params.userId,
    stepUpApproved: true,
  });

  return { approved: true, approvedAt: new Date() };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}