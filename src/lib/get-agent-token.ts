// src/lib/get-agent-token.ts

interface AgentCredentials {
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Cache token sampai 60 detik sebelum expire
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getAgentM2MToken(
  credentials: AgentCredentials
): Promise<string> {
  const cacheKey = credentials.clientId;
  const cached = tokenCache.get(cacheKey);

  // Return cached token jika masih valid (dengan 60 detik buffer)
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  // Request token baru dari Auth0
  const issuer = process.env.AUTH0_ISSUER_BASE_URL!;
  const audience = process.env.AUTH0_AUDIENCE!;

  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      audience,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get agent M2M token: ${error}`);
  }

  const data: TokenResponse = await response.json();

  // Simpan ke cache
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}