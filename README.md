# 🔐 ScopeGuard

> **LLM-Driven Dynamic Permission Negotiator for AI Agents**  
> Built for the [Authorized to Act: Auth0 for AI Agents Hackathon](https://authorizedtoact.devpost.com/)

[![Auth0 Token Vault](https://img.shields.io/badge/Auth0-Token%20Vault-EB5424?style=flat-square&logo=auth0)](https://auth0.com/ai/docs/intro/token-vault)
[![CIBA](https://img.shields.io/badge/Auth0-CIBA%20Step--Up-EB5424?style=flat-square&logo=auth0)](https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-initiated-backchannel-authentication-flow)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)

---

## The Problem

The [Gravitee State of AI Agent Security 2026 report](https://www.gravitee.io/state-of-ai-agent-security) surveyed 919 practitioners and found:

- **88%** of organizations experienced AI agent security incidents last year
- **78%** cannot trace agent actions back to a specific agent identity
- **45.6%** still use shared API keys for agent-to-agent authentication
- **27.2%** use hardcoded authorization logic that is impossible to audit at scale

The root cause is structural: AI agents today operate with a **"blank check"**. Once a user grants `payment:write`, the agent can make payments of any amount, to any recipient, at any time. A single prompt injection can trigger a $10,000 transaction using the same token that was granted for a $5 purchase.

ScopeGuard solves this with a **three-layer authorization gateway** that ensures agents only receive the permissions they actually need for each specific action — not a permanent blank check.

---

## Architecture: Four-Layer Defense

\```
Every tool call passes through four mandatory layers:

┌─────────────────────────────────────────────────────────────┐
│                   SCOPEGUARD GATEWAY                        │
│                                                             │
│  Layer 1 ── Agent Identity (Auth0 M2M)                      │
│  "Who is this agent? Is it registered?"                     │
│             ↓ if valid                                      │
│  Layer 2 ── Hard Constraints Engine (non-LLM, pure code)    │
│  "Is this action within absolute limits?"                   │
│  • Amount ceiling  • Domain whitelist                       │
│  • Velocity cap    • Scope ceiling                          │
│  • Data classification (HR)                                 │
│  • Country block / SAR threshold (AML)                      │
│             ↓ if passes                                     │
│  Layer 3 ── LLM Intent Analyzer (Gemini 2.5 Flash)          │
│  "What is the MINIMAL scope needed for this action?"        │
│             ↓                                               │
│  CIBA Step-Up ── Human Approval (if high-stakes)            │
│  "Does the user explicitly approve this?"                   │
│             ↓                                               │
│  Token Vault ── Scoped Token Exchange                       │
│  Short-lived token, 300 second expiry                       │
│             ↓                                               │
│  Layer 4 ── Post-Execution Verification                     │
│  "Is the result safe to return to the agent?"               │
│  • Sensitive field leak scan                                │
│  • PII detection & redaction                                │
│  • Amount drift detection                                   │
│  • Scope overshoot check                                    │
│  • Anomalous response volume                                │
│  ↓ clean → return  │  violation → redact  │  critical → quarantine
└─────────────────────────────────────────────────────────────┘
\```

### Why Layer 2 Must Run Before Layer 3

The most critical architectural insight from building ScopeGuard: **LLM alone cannot secure authorization.**

A prompt injection that reaches the LLM can still result in a misclassified risk level. A prompt injection that hits pure-code constraints is always blocked, regardless of its content. Layer 2 is the LLM-proof safety net.

---

## Registered Agents

ScopeGuard ships with four production-grade agents demonstrating different security profiles:

| Agent | Use Case | Key Constraints | Unique Check |
|-------|----------|-----------------|--------------|
| `travel-booking-agent-v1` | Flight & hotel booking | $1,000 ceiling, 2 domains | Step-up > $200 |
| `fraud-detection-agent-v1` | Real-time transaction monitoring | $5,000 ceiling, banking domains only | Velocity: 3/min |
| `aml-compliance-agent-v1` | Anti-Money Laundering, KYC, SAR | $100K ceiling, SAR @ $10K | Country block (OFAC) + High-risk jurisdictions |
| `hr-onboarding-agent-v1` | Employee lifecycle, access provisioning | No payments, 2 internal domains | Data classification: blocks salary/medical/performance |

See [AGENTS.md](./AGENTS.md) for full per-agent documentation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Auth & Identity | Auth0 (M2M Applications, Token Vault, CIBA) |
| LLM (Layer 3) | Google Gemini 2.5 Flash via Vercel AI SDK |
| Structured Output | Zod schema validation |
| JWT Verification | jose |
| Deployment | Vercel |

---

## Project Structure

```
scopeguard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── execute/          # Gateway endpoint — mandatory choke point
│   │   │   ├── audit/            # Real-time audit log API
│   │   │   ├── agents/           # Agent registry CRUD
│   │   │   └── demo/
│   │   │       ├── route.ts      # Travel agent demo trigger
│   │   │       ├── fraud/        # Fraud agent demo trigger
│   │   │       ├── aml/          # AML agent demo trigger
│   │   │       └── hr/           # HR agent demo trigger
│   │   ├── dashboard/            # Real-time monitoring dashboard
│   │   ├── consent/              # User permissions & consent UI
│   │   ├── activity/             # Full audit log table with filters
│   │   ├── rules/                # Security rules documentation
│   │   ├── insights/             # Security insights & findings
│   │   ├── settings/             # Gateway configuration
│   │   └── help/                 # FAQ & documentation
│   ├── gateway/
│   │   ├── layer1-identity.ts    # Auth0 JWT verification + agent registry lookup
│   │   ├── layer2-constraints.ts # Hard constraints engine (LLM-proof)
│   │   ├── layer3-analyzer.ts    # Gemini intent analysis + scope minimization
│   │   └── layer4-verify.ts      # Post-Execution Verification Layer
│   ├── lib/
│   │   ├── agent-registry.ts     # In-memory agent store with lazy env resolution
│   │   ├── audit-log.ts          # Structured audit trail with stats
│   │   ├── ciba.ts               # CIBA step-up auth (Auth0 + mock fallback)
│   │   ├── token-vault.ts        # Auth0 Token Vault exchange wrapper
│   │   ├── extract-params.ts     # Tool call parameter extraction utilities
│   │   ├── velocity-tracker.ts   # Rolling window rate limiter
│   │   ├── get-agent-token.ts    # Auth0 M2M token fetcher with cache
│   │   ├── gemini.ts             # Gemini client singleton
│   │   ├── errors.ts             # Typed error classes
│   │   └── jwks-client.ts        # JWKS client with singleton cache
│   ├── demo/
│   │   ├── travel-agent.ts       # Travel booking agent scenarios
│   │   ├── fraud-agent.ts        # Fraud detection agent scenarios
│   │   ├── aml-agent.ts          # AML compliance agent scenarios
│   │   └── hr-agent.ts           # HR onboarding agent scenarios
│   ├── components/
│   │   └── AgentCard.tsx         # Shared agent UI components
│   └── types/
│       └── index.ts              # All TypeScript interfaces
├── scripts/
│   └── register-agent.ts         # CLI to register new agents in Auth0
├── .env.example                  # Template for environment variables
└── ...config files
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm (recommended) or npm
- Auth0 account (free tier works)
- Google AI Studio account (for Gemini API key)

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/scopeguard.git
cd scopeguard
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your values (see full guide below):

```bash
# Auth0
AUTH0_SECRET=                    # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=           # https://YOUR-TENANT.us.auth0.com
AUTH0_CLIENT_ID=                 # Regular Web App client ID
AUTH0_CLIENT_SECRET=             # Regular Web App client secret
AUTH0_AUDIENCE=https://scopeguard-api

# Agent M2M credentials
AGENT_TRAVEL_CLIENT_ID=
AGENT_TRAVEL_CLIENT_SECRET=
AGENT_FRAUD_CLIENT_ID=
AGENT_FRAUD_CLIENT_SECRET=
AGENT_AML_CLIENT_ID=
AGENT_AML_CLIENT_SECRET=
AGENT_HR_CLIENT_ID=
AGENT_HR_CLIENT_SECRET=

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=

# Internal
SCOPEGUARD_GATEWAY_SECRET=       # openssl rand -hex 32
CIBA_MOCK_AUTO_APPROVE=true
```

### 3. Auth0 Setup

You need to create the following in your Auth0 dashboard:

**a) Regular Web App** — for the Next.js frontend
- Callback URL: `http://localhost:3000/auth/callback`
- Logout URL: `http://localhost:3000`

**b) Custom API** — identifier: `https://scopeguard-api`
- Enable RBAC
- Enable "Add Permissions in the Access Token"

**c) Four M2M Applications** — one per agent (see [AGENTS.md](./AGENTS.md))
- Enable CIBA grant type on each
- Add application metadata per agent

**d) Auth0 Action** — Machine to Machine trigger — injects agent claims into tokens:

```javascript
exports.onExecuteCredentialsExchange = async (event, api) => {
  const metadata = event.client.metadata || {};
  if (metadata.scopeguard_agent_id) {
    api.accessToken.setCustomClaim('https://scopeguard.dev/agent_id', metadata.scopeguard_agent_id);
    api.accessToken.setCustomClaim('https://scopeguard.dev/agent_type', metadata.scopeguard_agent_type || 'unknown');
    api.accessToken.setCustomClaim('https://scopeguard.dev/max_amount_usd', parseInt(metadata.scopeguard_max_amount_usd || '0'));
    api.accessToken.setCustomClaim('https://scopeguard.dev/allowed_domains', (metadata.scopeguard_allowed_domains || '').split(','));
    api.accessToken.setCustomClaim('https://scopeguard.dev/stepup_threshold_usd', parseInt(metadata.scopeguard_stepup_threshold_usd || '0'));
  }
};
```

### 4. Run Development Server

```bash
pnpm dev
```

Open http://localhost:3000

### 5. Test the Gateway

```bash
# Get M2M token for travel agent
TOKEN=$(curl -s --request POST \
  --url 'https://YOUR-TENANT.us.auth0.com/oauth/token' \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_AGENT_CLIENT_ID",
    "client_secret": "YOUR_AGENT_CLIENT_SECRET",
    "audience": "https://scopeguard-api",
    "grant_type": "client_credentials"
  }' | jq -r '.access_token')

# Test: amount ceiling (should be blocked)
curl -s -X POST http://localhost:3000/api/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolCall":{"name":"book_flight","params":{"destination":"Tokyo","amount":1500},"requiredConnection":"mock"}}' \
  | jq .

# Test: valid booking with step-up
curl -s -X POST http://localhost:3000/api/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toolCall":{"name":"book_flight","params":{"destination":"Tokyo","amount":500},"requiredConnection":"mock"}}' \
  | jq .
```

---

## Gateway API

### `POST /api/execute`

The only endpoint through which agents may execute tools. All requests must carry a valid Auth0 M2M token.

**Request:**
```json
{
  "toolCall": {
    "name": "book_flight",
    "params": {
      "destination": "Tokyo",
      "amount": 500,
      "airline": "Garuda Indonesia"
    },
    "requiredConnection": "mock"
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "auditId": "uuid",
  "stepUpCompleted": true,
  "scopeDecision": {
    "minimalScopes": ["payment:write", "email:send"],
    "riskLevel": "high",
    "requiresStepUp": true,
    "explanation": "This action will book a flight to Tokyo for $500 and send a confirmation email.",
    "reversible": false
  },
  "tokenVault": {
    "connection": "mock",
    "scopesIssued": ["payment:write", "email:send"],
    "expiresIn": 300,
    "note": "Short-lived scoped token — expires after use"
  },
  "result": { ... }
}
```

**Error Responses:**

| Status | Error Code | When |
|--------|-----------|------|
| 401 | `IDENTITY_REJECTED` | Invalid or missing M2M token |
| 401 | `UNREGISTERED_AGENT` | Agent not in registry |
| 403 | `HARD_CONSTRAINT_VIOLATION` | Amount ceiling, domain, velocity, scope, country, or data classification |
| 403 | `STEPUP_DENIED` | User explicitly denied the CIBA request |
| 408 | `STEPUP_TIMEOUT` | User did not respond within 2 minutes |

---

## Registering a New Agent

Use the CLI script to programmatically create a new agent in Auth0:

```bash
npx ts-node scripts/register-agent.ts fraud-detection-agent-v1
```

Or manually in Auth0 Dashboard, then add to `src/lib/agent-registry.ts`:

```typescript
const myAgent: AgentProfile = {
  agentId: 'my-agent-v1',
  agentType: 'specialist',
  ownerUserId: 'auth0|user_id',
  declaredCapabilities: ['scope:one', 'scope:two'],
  hardLimits: {
    maxTransactionAmountUSD: 500,
    allowedDomains: ['api.myservice.com'],
    maxActionsPerMinute: 10,
    forbiddenScopes: ['admin:write', 'data:delete'],
    requiresStepUpAboveUSD: 100,
  },
  auth0ClientId: '',
  createdAt: new Date(),
  version: '1.0.0',
  isActive: true,
};
```

---

## Security Model

### What ScopeGuard Guarantees

1. **Every agent has a unique identity** — no shared API keys, no user proxies
2. **Hard limits cannot be overridden** — not by prompts, not by developers, not by the LLM
3. **Every token is short-lived** — 300 second expiry, scoped to the minimum needed
4. **Every action is auditable** — agent_id, scopes granted vs used, risk level, decision reason
5. **High-stakes actions require human approval** — CIBA out-of-band before execution

### Layer 4: Post-Execution Verification

ScopeGuard verifies not just what the agent is *allowed to do* (L1-L3), 
but also whether the *result of execution* is safe to return.

This addresses the "EchoLeak" class of vulnerabilities identified by 
OWASP ASI01 — where agents retrieve authorized data but output it to 
unauthorized recipients or channels.

**Checks performed after every execution:**

| Check | Trigger | Action |
|-------|---------|--------|
| Sensitive field leak | Blocked field found in response | Redact field + audit |
| PII detection | PII pattern in non-PII tool response | Redact + audit |
| Amount drift | Response amount ≠ requested amount by >5% | Flag + audit |
| Scope overshoot | Write indicators in read-only response | Flag + audit |
| Anomalous volume | Response size exceeds tool threshold | Flag + audit |

**Violation severity → action:**
- `critical` → **Quarantine**: result blocked, agent receives 403
- `high` → **Redact**: violations removed, sanitized result returned
- `low/medium` → **Flag**: result returned, violation logged

### What ScopeGuard Does NOT Do (Current MVP)

- Real provider API calls (Token Vault exchange returns structured mock results)
- Real CIBA push notifications to mobile (uses mock auto-approve in dev mode)
- Persistent storage (audit logs reset on server restart)
- Multi-agent delegation narrowing (AgentChain — planned as v2 feature)

---

## Insights from Building ScopeGuard

These findings are documented in the `/insights` dashboard page:

1. **LLM alone cannot secure authorization** — hard constraints must precede LLM analysis
2. **Agents routinely request more than they need** — Gemini reduced scope by 33-100% per action
3. **Identity is the prerequisite for all other controls** — without `agent_id`, no control is attributable
4. **Consent must be specific** — generic "please approve" has no value; Gemini-generated natural language explanation makes CIBA meaningful

---

## Gravitee Report Alignment

ScopeGuard directly addresses the four structural gaps identified in the Gravitee State of AI Agent Security 2026 report:

| Gravitee Finding | Stat | ScopeGuard Solution |
|-----------------|------|---------------------|
| No unique agent identity | 78% can't trace actions | Auth0 M2M per agent + `agent_id` claim |
| Shared API keys | 45.6% use shared keys | Short-lived M2M tokens, zero standing credentials |
| Hardcoded authorization | 27.2% use custom hardcoded logic | Centralized agent registry + gateway enforcement |
| No audit trails | 57.4% cite this as top concern | Structured audit log: scopes granted vs used |

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Built With

- [Auth0 for AI Agents](https://auth0.com/ai) — Token Vault, CIBA, M2M Applications
- [Google Gemini](https://ai.google.dev) — Intent analysis and scope minimization
- [Next.js](https://nextjs.org) — App Router, API Routes
- [Vercel AI SDK](https://sdk.vercel.ai) — Structured output from Gemini
- [jose](https://github.com/panva/jose) — JWT verification

---

*Submitted to [Authorized to Act: Auth0 for AI Agents Hackathon](https://authorizedtoact.devpost.com/) · April 2026*
