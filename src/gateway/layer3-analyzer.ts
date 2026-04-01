// src/gateway/layer3-analyzer.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { getGeminiModel } from '@/lib/gemini';
import { auditLog } from '@/lib/audit-log';
import type {
  ToolCall,
  AgentProfile,
  ConstraintCheckResult,
  ScopeDecision,
} from '@/types';

// Schema untuk structured output dari Gemini
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

export async function analyzeScopeNeeded(
  toolCall: ToolCall,
  agentProfile: AgentProfile,
  constraintResult: ConstraintCheckResult
): Promise<ScopeDecision> {

  const { object } = await generateObject({
    model: getGeminiModel(),
    schema: ScopeDecisionSchema,
    prompt: buildAnalyzerPrompt(toolCall, agentProfile, constraintResult),
  });

  const decision: ScopeDecision = {
    minimalScopes: object.minimalScopes,
    riskLevel: object.riskLevel,
    // Step-up: LLM bisa flag tambahan, tapi Layer 2 flag tetap OR
    requiresStepUp: object.requiresStepUp || constraintResult.requiresStepUp,
    naturalLanguageExplanation: object.naturalLanguageExplanation,
    reversible: object.reversible,
    reasoning: object.reasoning,
  };

  auditLog({
    event: 'SCOPE_DECIDED',
    agentId: agentProfile.agentId,
    ownerUserId: agentProfile.ownerUserId,
    toolName: toolCall.name,
    scopesGranted: agentProfile.declaredCapabilities,
    scopesActuallyUsed: decision.minimalScopes,
    riskLevel: decision.riskLevel,
    stepUpRequired: decision.requiresStepUp,
    metadata: { reasoning: decision.reasoning },
  });

  return decision;
}

function buildAnalyzerPrompt(
  toolCall: ToolCall,
  agentProfile: AgentProfile,
  constraintResult: ConstraintCheckResult
): string {
  return `
You are a security analyzer for an AI agent authorization system called ScopeGuard.
Your job: determine the MINIMAL scopes needed for this specific action.

## Agent Profile
- Agent ID: ${agentProfile.agentId}
- Agent Type: ${agentProfile.agentType}
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
4. Determine if additional human approval is needed beyond hard constraints

## Rules
- minimalScopes must be a SUBSET of: [${agentProfile.declaredCapabilities.join(', ')}]
- Never add scopes not in the declared capabilities list
- If the tool is read-only, never include write scopes
- naturalLanguageExplanation must be in English, clear, non-technical
- For payment actions, always mention the exact amount and destination if available
`.trim();
}