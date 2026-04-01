// src/gateway/layer1-identity.ts
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getAgentProfile, isAgentActive } from '@/lib/agent-registry';
import { auditLog } from '@/lib/audit-log';
import {
  InvalidTokenError,
  UnregisteredAgentError,
  RevokedAgentError,
} from '@/lib/errors';
import type { AgentTokenClaims, IdentityVerificationResult } from '@/types';

// Buat JWKS client fresh per cold start — tidak pakai cache module level
function makeJWKSClient() {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  if (!issuer) throw new Error('AUTH0_ISSUER_BASE_URL is not set');

  return createRemoteJWKSet(
    new URL(`${issuer}/.well-known/jwks.json`),
    { timeoutDuration: 10000 }
  );
}

// Singleton — dibuat sekali per server instance
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!_jwks) _jwks = makeJWKSClient();
  return _jwks;
}

export async function validateAgentIdentity(
  request: Request
): Promise<IdentityVerificationResult> {

  // ── Step 1: Extract Bearer token ─────────────────────────────
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new InvalidTokenError('Missing or malformed Authorization header');
  }
  const token = authHeader.slice(7);

  // ── Step 2: Debug — decode header dulu tanpa verify ──────────
  // Ini membantu kita lihat isi token tanpa bergantung JWKS
  let tokenIssuer = '';
  try {
    const [, payloadB64] = token.split('.');
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payloadPreview = JSON.parse(payloadStr);
    tokenIssuer = payloadPreview.iss || '';
    console.log('[ScopeGuard] Token preview:', {
      iss: payloadPreview.iss,
      sub: payloadPreview.sub,
      aud: payloadPreview.aud,
      agent_id: payloadPreview['https://scopeguard.dev/agent_id'],
    });
  } catch {
    // ignore — ini hanya untuk debug
  }

  // ── Step 3: Verifikasi JWT ────────────────────────────────────
  let claims: AgentTokenClaims;
  try {
    const issuer = process.env.AUTH0_ISSUER_BASE_URL!;
    const audience = process.env.AUTH0_AUDIENCE!;

    console.log('[ScopeGuard] Verifying against issuer:', issuer);
    console.log('[ScopeGuard] Token issuer:', tokenIssuer);
    console.log('[ScopeGuard] Expected audience:', audience);

    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: issuer.endsWith('/') ? issuer : `${issuer}/`,
      audience,
    });

    claims = payload as unknown as AgentTokenClaims;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JWT verification failed';

    // Reset JWKS client jika ada fetch error — force refresh next time
    if (message.includes('HTTP') || message.includes('fetch') || message.includes('network')) {
      _jwks = null;
      console.error('[ScopeGuard] JWKS fetch failed, resetting client:', message);
    }

    auditLog({
      event: 'IDENTITY_REJECTED',
      agentId: 'unknown',
      errorMessage: message,
    });
    throw new InvalidTokenError(`Token verification failed: ${message}`);
  }

  // ── Step 4: Cek agent_id claim ────────────────────────────────
  const agentId = claims['https://scopeguard.dev/agent_id'];
  if (!agentId) {
    auditLog({
      event: 'IDENTITY_REJECTED',
      agentId: 'unknown',
      errorMessage: 'Token missing agent_id claim',
    });
    throw new UnregisteredAgentError(
      'Token does not contain agent identity claims. ' +
      'Only registered agents may call this gateway.'
    );
  }

  // ── Step 5: Load dari registry ────────────────────────────────
  const agentProfile = getAgentProfile(agentId);
  if (!agentProfile) {
    auditLog({
      event: 'IDENTITY_REJECTED',
      agentId,
      errorMessage: `Agent ${agentId} not found in registry`,
    });
    throw new UnregisteredAgentError(
      `Agent "${agentId}" is not registered in ScopeGuard`
    );
  }

  // ── Step 6: Cek aktif ─────────────────────────────────────────
  if (!isAgentActive(agentId)) {
    auditLog({
      event: 'IDENTITY_REJECTED',
      agentId,
      ownerUserId: agentProfile.ownerUserId,
      errorMessage: 'Agent has been revoked',
    });
    throw new RevokedAgentError(agentId);
  }

  // ── Step 7: Client ID match ───────────────────────────────────
// Auth0 M2M token format: sub = "CLIENT_ID@clients"
// Registry menyimpan hanya CLIENT_ID (tanpa @clients)
// Kita normalize keduanya sebelum dibandingkan
if (agentProfile.auth0ClientId) {
  const subWithoutSuffix = claims.sub.replace('@clients', '');
  const registryId = agentProfile.auth0ClientId.replace('@clients', '');

  if (registryId !== subWithoutSuffix) {
    auditLog({
      event: 'IDENTITY_REJECTED',
      agentId,
      errorMessage: `Client ID mismatch: expected ${registryId}, got ${subWithoutSuffix}`,
    });
    throw new InvalidTokenError(
      'Agent client ID does not match registry record'
    );
  }
}

  // ── Step 8: Success ───────────────────────────────────────────
  auditLog({
    event: 'AGENT_IDENTITY_RESOLVED',
    agentId,
    ownerUserId: agentProfile.ownerUserId,
    metadata: { agentType: agentProfile.agentType, auth0Sub: claims.sub },
  });

  return { agentProfile, claims, verifiedAt: new Date() };
}