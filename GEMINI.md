# Gemini Integration in ScopeGuard

ScopeGuard uses Google Gemini as the **Layer 3 LLM Intent Analyzer** — the semantic reasoning engine that determines the minimal set of OAuth scopes needed for each specific tool call. This document covers the model selection, implementation, observed behavior, interaction with Layer 4, and troubleshooting.

---

## Role in the Architecture

```
Layer 1 (Auth0 M2M)        →  Who is the agent?
Layer 2 (Pure Code)        →  Are hard limits respected? (LLM-proof)
Layer 3 (Gemini) ──────────→  What is the MINIMAL scope for this action?
CIBA (Auth0)               →  Does the user approve? (if high-stakes)
Token Vault (Auth0)        →  Issue scoped token
Layer 4 (Multi-layer PII)  →  Is the output safe to return?
```

**Critical design principle:** Gemini runs *after* Layer 2. This means:

- Gemini can only recommend scopes within the agent's declared capabilities
- Gemini cannot override hard constraints — they already passed before Gemini is called
- If Gemini fails (quota, timeout, error), ScopeGuard uses conservative fallback and continues — it never blocks execution due to LLM failure
- Gemini's output feeds into Layer 4 — the `scopeDecision` is used to check scope overshoot in the response

---

## Model Selection

**Model used:** `gemini-2.5-flash`

### Why not `gemini-2.0-flash`?

During development, `gemini-2.0-flash` hit free tier quota limits (`limit: 0` for the project). This triggers `AI_RetryError` after 3 attempts. The Vercel AI SDK handles retries automatically, but after all attempts fail, ScopeGuard falls back to conservative defaults.

### Why not `gemini-1.5-flash`?

Returns HTTP 404: `models/gemini-1.5-flash is not found for API version v1beta`. The model was deprecated in the v1beta API endpoint used by `@ai-sdk/google`.

### Why not `gemini-2.5-pro`?

Pro is higher quality but slower response time and higher token cost. For scope classification — a structured, bounded task with a small input/output — Flash is more than sufficient. Pro would be appropriate only if the analysis involved complex reasoning across many documents simultaneously.

### Checking available models for your API key

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_GEMINI_API_KEY" \
  | jq '.models[].name'
```

Then update `src/lib/gemini.ts` with the correct model string if needed.

---

## Setup

### 1. Get API Key

1. Go to https://aistudio.google.com/apikeys
2. Click **Create API Key**
3. Select your Google Cloud project (or create one)
4. Copy the key — starts with `AIzaSy`

### 2. Add to Environment

```bash
# .env.local
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
```

### 3. Install SDK

```bash
pnpm add @ai-sdk/google ai
```

---

## Implementation

### Gemini Client (`src/lib/gemini.ts`)

```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google';

let _gemini: ReturnType<typeof createGoogleGenerativeAI> | null = null;

export function getGeminiClient() {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    _gemini = createGoogleGenerativeAI({ apiKey });
  }
  return _gemini;
}

export function getGeminiModel() {
  return getGeminiClient()('gemini-2.5-flash');
}
```

**Design decisions:**
- Singleton client — avoids re-initializing on every request
- Model called at invocation time (not module load) — allows model hot-swap without restart
- No streaming — structured output requires a complete response before Zod validation

### Structured Output Schema

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const ScopeDecisionSchema = z.object({
  minimalScopes: z
    .array(z.string())
    .describe('Minimal scopes needed — subset of agent declared capabilities'),
  riskLevel: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Risk level of this action'),
  requiresStepUp: z
    .boolean()
    .describe('Whether human approval is needed beyond hard constraint check'),
  naturalLanguageExplanation: z
    .string()
    .describe('Plain English explanation for the user consent modal, max 2 sentences'),
  reversible: z
    .boolean()
    .describe('Whether this action can be undone'),
  reasoning: z
    .string()
    .describe('Brief reasoning for scope decision — for audit log'),
});
```

**Why `generateObject` instead of `generateText`:** `generateObject` with Zod schema enforces parseable, typed JSON. Without this, the response might be natural language, markdown-wrapped JSON, or inconsistently structured. Vercel AI SDK handles retry logic and schema enforcement automatically.

### Prompt Design

```typescript
function buildAnalyzerPrompt(toolCall, agentProfile, constraintResult): string {
  return `
You are a security analyzer for an AI agent authorization system called ScopeGuard.
Your job: determine the MINIMAL scopes needed for this specific action.

## Agent Profile
- Agent ID: ${agentProfile.agentId}
- Declared capabilities (MAXIMUM allowed): ${agentProfile.declaredCapabilities.join(', ')}

## Tool Call Being Requested
- Tool name: ${toolCall.name}
- Parameters: ${JSON.stringify(toolCall.params, null, 2)}

## Hard Constraint Results (already enforced — do not override)
- Transaction amount USD: ${constraintResult.auditData.transactionAmountUSD ?? 'N/A'}
- Target domain: ${constraintResult.auditData.targetDomain ?? 'N/A'}
- Step-up already required by hard constraints: ${constraintResult.requiresStepUp}

## Your Task
1. From the agent's declared capabilities, select ONLY the scopes truly needed
2. Assess risk level based on: reversibility, amount, data sensitivity
3. Write a plain English explanation (max 2 sentences) for the user consent modal

## Rules
- minimalScopes must be a SUBSET of: [${agentProfile.declaredCapabilities.join(', ')}]
- Never add scopes not in the declared capabilities list
- If the tool is read-only, never include write scopes
- naturalLanguageExplanation must be in English, clear, non-technical
- For payment actions, always mention the exact amount and destination
`.trim();
}
```

**Key design decisions:**

1. **Scope ceiling is explicit** — Gemini is told the maximum allowed scopes, cannot hallucinate new ones
2. **Hard constraints included** — Gemini incorporates L2 results, avoids redundant step-up flags
3. **"ONLY" is explicit** — prevents Gemini from being overly permissive out of caution
4. **Natural language output** — directly powers CIBA `bindingMessage` and consent modal

---

## Observed Behavior

### Scope Minimization Results

| Agent | Tool Call | Declared (N scopes) | Gemini Selected | Reduction |
|-------|-----------|--------------------|-----------------|---------:|
| Travel | `search_flights` | 3 | 0 | **100%** |
| Travel | `book_flight $500` | 3 | 2 | 33% |
| Fraud | `check_transaction $200` | 4 | 1 (transaction:read) | 75% |
| Fraud | `flag_transaction $2000` | 4 | 2 | 50% |
| AML | `check_aml` domestic | 6 | 2 | 67% |
| AML | `file_sar $15K` | 6 | 2 (transaction:read, sar:write) | 67% |
| HR | `create_onboarding_task` | 5 | 2 (employee:read, onboarding:write) | 60% |

**Notable finding for `search_flights`:** Gemini correctly determined that a flight search requires *zero* OAuth scopes — it's a read-only query that doesn't touch user credentials. This is the maximum possible reduction.

**Notable finding for `book_flight`:** Gemini selected `payment:write` and `email:send`, but *not* `calendar:events:write`. It assessed that calendar creation is optional and should be a separate user action with separate consent — a non-obvious but correct decision.

### Natural Language Explanations (observed)

```
search_flights →
"The agent wants to search for available flights to Bali on April 15, 2026.
This action is read-only and will not modify any of your personal information."

book_flight $500 →
"This action will book a flight to Tokyo for $500 using your payment method
and send you a confirmation email. This action cannot be undone."

check_transaction $200 (fraud) →
"The agent will analyze a $200 transaction for suspicious patterns.
This is a read-only review and will not modify any account data."

file_sar $15K (AML) →
"The agent will file a Suspicious Activity Report for a $15,000 transaction
with the PPATK compliance authority. This action is required by regulation."

get_employee_documents (HR, id_card field) →
"The agent needs to access employee identity documents including ID card
and contract. These are sensitive documents that require your approval."
```

These are used verbatim in:
1. The CIBA `bindingMessage` — what appears in the step-up approval modal
2. The `scopeDecision.explanation` field returned by the gateway API
3. The activity feed in the dashboard
4. The Layer 4 audit log for quarantined results (context for security review)

---

## Interaction with Layer 4

Gemini's `ScopeDecision` output is used by Layer 4 in two ways:

### 1. Scope Overshoot Check

```typescript
// Layer 4 reads minimalScopes from Gemini's decision
const hasWriteScope = scopeDecision.minimalScopes.some(s => s.includes(':write'));

// If Gemini said "no write scopes needed" but response contains write indicators:
if (!hasWriteScope) {
  for (const indicator of WRITE_INDICATORS) {
    if (resultStr.toLowerCase().includes(indicator)) {
      violations.push({ type: 'SCOPE_OVERSHOOT', severity: 'high', ... });
    }
  }
}
```

**Example:** Gemini determines `search_flights` needs 0 scopes (read-only). If the mock/real backend returns a response containing `rows_deleted` or `mutation_id`, Layer 4 flags it as scope overshoot.

### 2. Context in Quarantine Audit Logs

When Layer 4 quarantines a result, the audit entry includes:
- Gemini's `naturalLanguageExplanation` — what was being attempted
- Gemini's `reasoning` — what the LLM thought about the action
- Layer 4 violation details — what went wrong in the output

This gives security teams full context: intent, authorization decision, and actual output anomaly — all in one audit record.

### Why Layer 4 Is Necessary Even With Gemini

Gemini determines what scopes are *requested*. Layer 4 verifies what data is *actually returned*. These are different problems:

- Gemini: "This search needs 0 scopes" ✓
- Backend: Returns employee salary data in search results due to misconfiguration
- Layer 4: Detects `salary` field in response → flags SENSITIVE_FIELD_LEAK → quarantines

This addresses the **EchoLeak class of attacks** (OWASP ASI01): authorization checked at retrieval, not at output.

---

## Fallback Behavior

When Gemini is unavailable:

```typescript
} catch (err) {
  console.error('[ScopeGuard] Layer 3 LLM failed, using fallback:', err);
  scopeDecision = {
    minimalScopes: agentProfile.declaredCapabilities,  // All declared scopes
    riskLevel: 'high',                                  // Conservative
    requiresStepUp: true,                               // Force human approval
    naturalLanguageExplanation:
      'The agent is requesting access to perform an action. Please review and approve.',
    reversible: false,                                  // Assume worst case
    reasoning: 'LLM analyzer unavailable — using conservative fallback',
  };
}
```

**Why this is correct behavior:**
- Execution is not blocked — the agent can still complete its task
- Security is not degraded — fallback is *more* restrictive, not less
- User gets a step-up prompt — they make the final decision
- Audit log records `'LLM analyzer unavailable'` — full transparency
- Layer 4 still runs on the result — output verification is unaffected by L3 failure

---

## Free Tier Limits

| Model | Requests/min | Requests/day |
|-------|-------------|-------------|
| gemini-2.5-flash | 10 | 500 |
| gemini-2.0-flash | 15 | 1,500 |

For hackathon demo purposes, the free tier is sufficient. If rate limited, wait 60 seconds (per-minute quota resets) or enable billing.

---

## Security Considerations

### Can Gemini be prompt-injected to bypass Layer 2?

**No.** Layer 2 runs *before* Gemini is called. By the time Gemini is invoked, all hard constraints have already been verified by pure code. A prompt injection that reaches Gemini cannot retroactively bypass L2 checks that already ran.

### Can Gemini hallucinate scopes outside the declared set?

**Not usefully.** The prompt explicitly states: "minimalScopes must be a SUBSET of: [declared capabilities]". Additionally, any hallucinated scope would fail at the Token Vault exchange step — Auth0 only issues tokens for scopes that are actually configured for the connection.

### What if Gemini recommends a wider scope than needed?

This reduces the security benefit (less scope reduction in the audit log) but does not create a security violation — the wider scope is still within declared capabilities. The audit log records `scopesGranted` (declared) vs `scopesActuallyUsed` (Gemini's recommendation), so scope inflation is visible.

### Does Gemini see sensitive data?

The prompt includes tool call parameters, which may contain amounts and destinations but not user credentials. Auth0 Token Vault ensures credentials never appear in prompts — they are held server-side and exchanged separately.

---

## Troubleshooting

### `Expected 200 OK from the JSON Web Key Set HTTP response`

Not a Gemini issue. JWKS fetch is failing for Layer 1. Check `AUTH0_ISSUER_BASE_URL` includes the regional subdomain: `https://YOUR-TENANT.us.auth0.com` (note `.us.`).

### `models/gemini-X-Y is not found for API version v1beta, status 404`

Model name has changed or been deprecated. Check available models:
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY" \
  | jq '.models[].name'
```
Update `src/lib/gemini.ts` with a valid model from the list.

### `Quota exceeded for metric: generate_content_free_tier_requests, limit: 0`

Daily free tier quota exhausted for this project. Options:
1. Wait until tomorrow (quota resets daily)
2. Enable billing in Google Cloud Console → pay-per-use
3. Create a new Google Cloud project with a new API key

### `AI_RetryError: Failed after 3 attempts`

Vercel AI SDK automatically retried 3 times, all failed. ScopeGuard's fallback catches this and continues with conservative defaults — the request does not fail, it just uses all declared scopes with step-up required.

### `Layer 3 LLM failed, using fallback` in console

This is expected behavior when quota is hit. The fallback is designed to be safe:
- All declared scopes issued (more permissive but not dangerous)
- Step-up required (user must approve)
- Layer 4 still verifies the output
- Audit log records the fallback reason

---

## Future Improvements

1. **Response caching** — Hash (toolName + params + agentId) → cache Gemini's decision for identical requests. Reduces API calls and latency for repeated operations.

2. **Fine-tuning** — A model fine-tuned on scope-decision pairs would be faster, cheaper, and more consistent than a general model with a long prompt.

3. **Multi-model routing** — `gemini-2.5-flash` for standard requests, escalate to `gemini-2.5-pro` for `riskLevel: critical` decisions or large parameter sets.

4. **Prompt versioning** — Version control the system prompt in the audit log. Different prompt versions yield different scope decisions; auditability requires knowing which version was used.

5. **Feedback loop** — Track CIBA denial events correlated with specific Gemini explanations. User denials may indicate the explanation was unclear or the scope recommendation was too broad. This data improves prompt quality over time.

6. **L4 feedback to L3** — If Layer 4 repeatedly finds violations for a specific tool, escalate Gemini's risk assessment for that tool on subsequent calls — adaptive security posture.
