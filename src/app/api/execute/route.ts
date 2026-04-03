// src/app/api/execute/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateAgentIdentity } from '@/gateway/layer1-identity';
import { enforceHardConstraints } from '@/gateway/layer2-constraints';
import { analyzeScopeNeeded } from '@/gateway/layer3-analyzer';
import { verifyPostExecution } from '@/gateway/layer4-verify';
import { requestStepUpApproval } from '@/lib/ciba';
import { executeToolWithScopedToken } from '@/lib/token-vault';
import { auditLog } from '@/lib/audit-log';
import { recordAction } from '@/lib/velocity-tracker';
import {
  ScopeGuardError,
  HardConstraintError,
  StepUpDeniedError,
  StepUpTimeoutError,
} from '@/lib/errors';
import { randomUUID } from 'crypto';
import type { GatewayRequest, GatewayError, ScopeDecision } from '@/types';

export async function POST(request: NextRequest) {
  const auditId = randomUUID();

  // ── Parse body ────────────────────────────────────────────────
  let body: GatewayRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON', auditId } satisfies GatewayError,
      { status: 400 }
    );
  }

  const { toolCall } = body;
  if (!toolCall?.name || !toolCall?.params) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'toolCall.name and toolCall.params are required', auditId } satisfies GatewayError,
      { status: 400 }
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LAYER 1: AGENT IDENTITY
  // ══════════════════════════════════════════════════════════════
  let identityResult: Awaited<ReturnType<typeof validateAgentIdentity>>;
  try {
    identityResult = await validateAgentIdentity(request);
  } catch (err) {
    if (err instanceof ScopeGuardError) {
      return NextResponse.json(
        { error: err.code as GatewayError['error'], message: err.message, auditId } satisfies GatewayError,
        { status: err.statusCode }
      );
    }
    throw err;
  }

  const { agentProfile } = identityResult;
  recordAction(agentProfile.agentId);

  // ══════════════════════════════════════════════════════════════
  // LAYER 2: HARD CONSTRAINTS
  // ══════════════════════════════════════════════════════════════
  let constraintResult: Awaited<ReturnType<typeof enforceHardConstraints>>;
  try {
    constraintResult = await enforceHardConstraints(toolCall, agentProfile);
  } catch (err) {
    if (err instanceof HardConstraintError) {
      return NextResponse.json(
        { error: err.code as GatewayError['error'], message: err.message, violations: err.violations, auditId } satisfies GatewayError,
        { status: err.statusCode }
      );
    }
    if (err instanceof ScopeGuardError) {
      return NextResponse.json(
        { error: err.code as GatewayError['error'], message: err.message, auditId } satisfies GatewayError,
        { status: err.statusCode }
      );
    }
    throw err;
  }

  // ══════════════════════════════════════════════════════════════
  // LAYER 3: LLM INTENT ANALYZER
  // ══════════════════════════════════════════════════════════════
  let scopeDecision: ScopeDecision;
  try {
    scopeDecision = await analyzeScopeNeeded(toolCall, agentProfile, constraintResult);
  } catch (err) {
    console.error('[ScopeGuard] Layer 3 LLM failed, using fallback:', err);
    scopeDecision = {
      minimalScopes: agentProfile.declaredCapabilities,
      riskLevel: 'high',
      requiresStepUp: true,
      naturalLanguageExplanation:
        'The agent is requesting access to perform an action. Please review and approve.',
      reversible: false,
      reasoning: 'LLM analyzer unavailable — using conservative fallback',
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CIBA STEP-UP
  // ══════════════════════════════════════════════════════════════
  if (scopeDecision.requiresStepUp) {
    try {
      await requestStepUpApproval({
        userId: agentProfile.ownerUserId,
        agentId: agentProfile.agentId,
        bindingMessage: scopeDecision.naturalLanguageExplanation,
        scopes: scopeDecision.minimalScopes,
      });
    } catch (err) {
      if (err instanceof StepUpDeniedError) {
        return NextResponse.json(
          { error: 'STEPUP_DENIED', message: 'User denied this action', auditId } satisfies GatewayError,
          { status: 403 }
        );
      }
      if (err instanceof StepUpTimeoutError) {
        return NextResponse.json(
          { error: 'STEPUP_TIMEOUT', message: 'User did not respond within time limit', auditId } satisfies GatewayError,
          { status: 408 }
        );
      }
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // TOKEN VAULT EXECUTION
  // ══════════════════════════════════════════════════════════════
  const executionStartMs = Date.now();
  let executionResult: Awaited<ReturnType<typeof executeToolWithScopedToken>>;
  try {
    executionResult = await executeToolWithScopedToken({
      toolCall,
      minimalScopes: scopeDecision.minimalScopes,
      connection: toolCall.requiredConnection,
      agentId: agentProfile.agentId,
      userId: agentProfile.ownerUserId,
    });
  } catch (err) {
    auditLog({
      event: 'TOOL_EXECUTION_FAILED',
      agentId: agentProfile.agentId,
      ownerUserId: agentProfile.ownerUserId,
      toolName: toolCall.name,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      metadata: { auditId },
    });
    return NextResponse.json(
      { error: 'EXECUTION_FAILED', message: 'Tool execution failed', auditId } satisfies GatewayError,
      { status: 500 }
    );
  }

  // ══════════════════════════════════════════════════════════════
  // LAYER 4: POST-EXECUTION VERIFICATION
  // ══════════════════════════════════════════════════════════════
  const verification = await verifyPostExecution({
    toolCall,
    result: executionResult.result,
    agentProfile,
    scopeDecision,
    executionStartMs,
  });

  // Quarantined → block result, return error
  if (verification.status === 'quarantined') {
    auditLog({
      event: 'TOOL_EXECUTION_FAILED',
      agentId: agentProfile.agentId,
      ownerUserId: agentProfile.ownerUserId,
      toolName: toolCall.name,
      errorMessage: 'Result quarantined by Layer 4 post-execution verification',
      metadata: {
        auditId,
        violations: verification.violations.map(v => `${v.type}: ${v.detail}`),
      },
    });
    return NextResponse.json(
      {
        error: 'EXECUTION_FAILED',
        message: 'Result quarantined — post-execution verification detected critical violations',
        violations: verification.violations.map(v => `[${v.severity.toUpperCase()}] ${v.type}: ${v.detail}`),
        auditId,
      } satisfies GatewayError,
      { status: 403 }
    );
  }

  // ── Final audit log ──────────────────────────────────────────
  auditLog({
    event: 'TOOL_EXECUTED_SUCCESS',
    agentId: agentProfile.agentId,
    ownerUserId: agentProfile.ownerUserId,
    toolName: toolCall.name,
    scopesGranted: agentProfile.declaredCapabilities,
    scopesActuallyUsed: scopeDecision.minimalScopes,
    riskLevel: scopeDecision.riskLevel,
    stepUpRequired: scopeDecision.requiresStepUp,
    metadata: {
      auditId,
      reasoning: scopeDecision.reasoning,
      verificationStatus: verification.status,
      verificationViolations: verification.violations.length,
      executionMs: verification.executionMs,
      tokenExpiresIn: executionResult.tokenInfo.expiresIn,
    },
  });

  return NextResponse.json({
    success: true,
    auditId,
    stepUpCompleted: scopeDecision.requiresStepUp,
    scopeDecision: {
      minimalScopes: scopeDecision.minimalScopes,
      riskLevel: scopeDecision.riskLevel,
      requiresStepUp: scopeDecision.requiresStepUp,
      explanation: scopeDecision.naturalLanguageExplanation,
      reversible: scopeDecision.reversible,
    },
    tokenVault: {
      connection: executionResult.tokenInfo.connection,
      scopesIssued: executionResult.tokenInfo.scopes,
      expiresIn: executionResult.tokenInfo.expiresIn,
      note: 'Short-lived scoped token — expires after use',
    },
    verification: {
      status: verification.status,
      violations: verification.violations.length,
      redacted: verification.violations.some(v => v.redacted),
      executionMs: verification.executionMs,
    },
    // Return sanitized result (violations redacted if needed)
    result: verification.sanitizedResult,
  });
}