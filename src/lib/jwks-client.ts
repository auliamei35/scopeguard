// src/lib/jwks-client.ts
import { createRemoteJWKSet } from 'jose';

let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null;

export function getJWKSClient() {
  if (!jwksClient) {
    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    if (!issuer) {
      throw new Error('AUTH0_ISSUER_BASE_URL is not set');
    }

    const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`);

    jwksClient = createRemoteJWKSet(jwksUrl, {
      // Paksa fetch fresh — cegah Next.js cache intercept
      headers: {
        'Cache-Control': 'no-cache',
      },
      // Timeout 10 detik
      timeoutDuration: 10000,
    });
  }
  return jwksClient;
}