# Gemini Integration in ScopeGuard

ScopeGuard uses Google Gemini as the **Layer 3 LLM Intent Analyzer** — the semantic reasoning engine that determines the minimal set of OAuth scopes needed for each specific tool call. This document explains the design, implementation, and observed behavior.

---

## Role in the Architecture

```
Layer 1 (Auth0 M2M)   →  Who is the agent?
Layer 2 (Pure Code)   →  Are hard limits respected? (LLM-proof)
Layer 3 (Gemini) ─────→  What is the MINIMAL scope for this action?
CIBA (Auth0)          →  Does the user approve? (if high-stakes)
Token Vault (Auth0)   →  Issue scoped token
```

**Critical design principle:** Gemini runs *after* Layer 2. This means:

- Gemini can only recommend scopes within the agent's declared capabilities
- Gemini cannot override hard constraints — they already passed
- If Gemini fails (quota, timeout, error), ScopeGuard falls back to conservative defaults (all declared scopes + step-up required) and continues — it never blocks execution due to LLM failure

---

## Model Selection

**Model used:** `gemini-2.5-flash`

**Why not `gemini-2.0-flash`?**
- `gemini-2.0-flash` hit free tier quota limits during development
- `gemini-1.5-flash` returned 404 (deprecated in v1beta API)
- `gemini-2.5-flash` is available on free tier with separate quota, faster response, and supports structured output natively

**Why not `gemini-2.5-pro`?**
- Pro is higher quality but slower and more expensive
- For scope classification (a structured, bounded task), Flash is more than sufficient
- Pro would be appropriate if the analysis involved complex reasoning across many documents

**Checking available models for your API key:**
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_GEMINI_API_KEY" \
  | jq '.models[].name'
```

---

## Setup

### 1. Get API Key

1. Go to https://aistudio.google.com/apikeys
2. Click **Create API Key**
3. Select your Google Cloud project
4. Copy the key

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
- Model is called at invocation time (not module load) — allows hot-swapping model without restart
- No streaming — structured output requires complete response

### Structured Output Schema (`src/gateway/layer3-analyzer.ts`)

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

**Why `generateObject` instead of `generateText`?**

`generateObject` with a Zod schema enforces that Gemini returns parseable, typed JSON. Without this, the response might be natural language, markdown-wrapped JSON, or inconsistently structured. The Vercel AI SDK handles retry logic and schema enforcement automatically.

### Prompt Design

The prompt passed to Gemini has three key sections:

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
1. From the agent's declared capabilities, select ONLY the scopes truly needed for THIS specific tool call
2. Assess risk level based on: reversibility, amount, data sensitivity
3. Write a plain English explanation (max 2 sentences) for the user consent modal

## Rules
- minimalScopes must be a SUBSET of: [${agentProfile.declaredCapabilities.join(', ')}]
- Never add scopes not in the declared capabilities list
- If the tool is read-only, never include write scopes
- naturalLanguageExplanation must be in English, clear, non-technical
- For payment actions, always mention the exact amount and destination if available
`.trim();
}
```

**Key prompt design decisions:**

1. **Scope ceiling is explicit** — Gemini is told exactly what the maximum scopes are. It cannot hallucinate new scopes.
2. **Hard constraints are included** — Gemini sees the constraint results so it can incorporate them into its reasoning (e.g., if step-up is already required by L2, Gemini knows not to flag it again as a surprise).
3. **Minimal scope instruction is explicit** — "select ONLY the scopes truly needed" with emphasis prevents Gemini from being overly permissive.
4. **Natural language explanation** — This output directly powers the CIBA `bindingMessage` and the consent modal text.

---

## Observed Behavior

### Travel Agent Scenarios

| Tool Call | Declared Scopes | Gemini Selected | Reduction |
|-----------|----------------|-----------------|----------:|
| `search_flights` (Bali, read-only) | 3 | 0 | **100%** |
| `book_flight` ($500, Tokyo) | 3 | 2 (payment:write, email:send) | 33% |
| `book_hotel` ($200, Bali) | 3 | 2 | 33% |

**Notable:** For `search_flights`, Gemini correctly determined that a flight search requires no OAuth scopes at all — it's a read-only lookup that doesn't touch user credentials. This is the most impactful reduction.

**Why not `calendar:events:write` for flight booking?** Gemini assessed that booking confirmation via email (`email:send`) is sufficient — calendar creation is optional and should be a separate agent action with separate consent.

### Gemini Natural Language Explanations (observed)

```
search_flights →
"The agent wants to search for available flights to Bali on April 15, 2026.
This action is read-only and will not modify any of your personal information."

book_flight $500 →
"This action will book a flight to Tokyo for $500 using your payment method
and send you a confirmation email. This action cannot be undone."

check_transaction $200 (fraud agent) →
"The agent will analyze a $200 transaction for suspicious patterns.
This is a read-only review and will not modify any account data."
```

These explanations are used verbatim in:
1. The CIBA `bindingMessage` (what appears in the step-up modal)
2. The `scopeDecision.explanation` field returned by the gateway
3. The activity feed in the dashboard (humanized event descriptions)

---

## Fallback Behavior

When Gemini is unavailable (quota exceeded, timeout, network error):

```typescript
} catch (err) {
  console.error('[ScopeGuard] Layer 3 LLM failed, using fallback:', err);
  scopeDecision = {
    minimalScopes: agentProfile.declaredCapabilities,  // Use ALL declared scopes
    riskLevel: 'high',                                  // Conservative risk level
    requiresStepUp: true,                               // Force human approval
    naturalLanguageExplanation:
      'The agent is requesting access to perform an action. Please review and approve.',
    reversible: false,                                  // Assume worst case
    reasoning: 'LLM analyzer unavailable — using conservative fallback',
  };
}
```

**Why this is the right behavior:**
- Execution is not blocked — the agent can still complete its task
- Security is not degraded — the fallback is *more* restrictive, not less
- The user gets a step-up prompt — they make the final decision
- The audit log records `reasoning: 'LLM analyzer unavailable'` — full transparency

---

## Free Tier Limits and Rate Management

Google Gemini free tier limits (as of April 2026):

| Model | Requests/min | Requests/day | Tokens/min |
|-------|-------------|-------------|-----------|
| gemini-2.5-flash | 10 | 500 | 250,000 |
| gemini-2.0-flash | 15 | 1,500 | 1,000,000 |

**For hackathon demo purposes**, the free tier is sufficient.

**If you hit rate limits:**

1. Wait 60 seconds (per-minute quota resets)
2. Switch to `gemini-2.0-flash` in `src/lib/gemini.ts` if that model's quota is available
3. Enable billing on Google Cloud for higher limits

**In production**, you would:
- Enable billing (pay-per-use)
- Implement request caching for identical tool calls
- Use `gemini-2.5-flash` (efficient) for most requests, `gemini-2.5-pro` for high-stakes decisions only

---

## Troubleshooting

### `Expected 200 OK from the JSON Web Key Set HTTP response`

Not a Gemini issue — this is the JWKS fetch failing for Layer 1. Check `AUTH0_ISSUER_BASE_URL` in `.env.local` includes the `.us.` regional subdomain: `https://YOUR-TENANT.us.auth0.com`

### `models/gemini-2.5-flash is not found for API version v1beta`

The model name changed. Check available models:
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY" | jq '.models[].name'
```

Then update `src/lib/gemini.ts` with the correct model string.

### `Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests`

Free tier daily limit hit. Options:
1. Wait until tomorrow (quota resets daily)
2. Enable billing in Google Cloud Console
3. Create a new Google Cloud project with a new API key

### `AI_RetryError: Failed after 3 attempts`

Vercel AI SDK automatically retries failed requests. After 3 failures, it throws. The ScopeGuard fallback catches this and continues with conservative defaults.

---

## Security Considerations

### Can Gemini be prompt-injected to bypass Layer 2?

**No.** Layer 2 runs *before* Gemini is called. By the time Gemini is invoked:
- Amount ceiling has already been checked
- Domain whitelist has already been verified
- Forbidden scopes have already been blocked
- Country sanctions have already been enforced

Even if Gemini were manipulated to return `minimalScopes: ['payment:admin']`, the scope ceiling check in Layer 2 would have already blocked the request before Gemini was reached.

### Can Gemini hallucinate scopes outside the declared set?

**Not usefully.** The prompt explicitly instructs: "minimalScopes must be a SUBSET of: [declared capabilities]". Additionally, the gateway only exchanges tokens for scopes that Auth0 Token Vault is configured to issue — any hallucinated scope would fail at the Token Vault exchange step.

### What if Gemini recommends a wider scope than needed?

This reduces the security benefit (less scope reduction) but does not create a security violation — the scope is still within the declared capabilities. The audit log records both `scopesGranted` (declared) and `scopesActuallyUsed` (Gemini's recommendation), so scope inflation is visible and auditable.

---

## Integration with Auth0 CIBA

Gemini's `naturalLanguageExplanation` output becomes the CIBA `bindingMessage`:

```typescript
// In src/lib/ciba.ts
await requestStepUpApproval({
  userId: agentProfile.ownerUserId,
  agentId: agentProfile.agentId,
  bindingMessage: scopeDecision.naturalLanguageExplanation,  // ← Gemini output
  scopes: scopeDecision.minimalScopes,
});
```

This means the approval notification a user receives is:
- Written in natural language (not `payment:write, email:send`)
- Specific to the exact action being requested
- Accurate about what cannot be undone

This is what makes consent **meaningful** — the user understands what they are approving.

---

## Interaction with Layer 4 (Post-Execution Verification)

Gemini's `scopeDecision` output is used by Layer 4 in two ways:

**1. Scope overshoot check:**
```typescript
// Layer 4 reads minimalScopes from Gemini's decision
const hasWriteScope = scopeDecision.minimalScopes.some(s => s.includes(':write'));
// If no write scope authorized, flags write operation indicators in response
```

**2. Natural language in quarantine messages:**
When Layer 4 quarantines a result, the audit log includes Gemini's
`naturalLanguageExplanation` alongside the violation detail — providing
full context for security review: what was being attempted, what
the LLM thought was appropriate, and what went wrong in the output.

**Why Layer 4 is necessary even with Layer 3:**
Layer 3 determines what scopes are *requested*. Layer 4 verifies what
data is *actually returned*. Even with correct scope minimization, a
misconfigured backend could return more data than expected. Layer 4 is
the output-side safety net that Layer 3 cannot provide.

## Future Improvements

If extending ScopeGuard beyond the hackathon:

1. **Caching** — Hash the (toolName + params + agentId) tuple; cache Gemini's scope decision for identical requests to reduce API calls and latency.

2. **Fine-tuning** — A fine-tuned model trained on scope-decision pairs would be faster, cheaper, and more consistent than a general model with a long prompt.

3. **Multi-model** — Use `gemini-2.5-flash` for standard requests, escalate to `gemini-2.5-pro` for `riskLevel: critical` decisions.

4. **Prompt versioning** — Version control the system prompt. Different prompt versions may yield different scope decisions; the audit log should record which prompt version was used.

5. **Feedback loop** — Track cases where users deny CIBA requests. This signals that either (a) the scope was correct but the user disagrees, or (b) the scope was too broad. This data can improve prompt quality over time.

