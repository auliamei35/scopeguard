// src/gateway/layer2-constraints.ts
import { auditLog } from '@/lib/audit-log';
import { HardConstraintError } from '@/lib/errors';
import {
  extractTransactionAmount,
  extractTargetDomain,
  extractRequestedScopes,
  isIrreversibleTool,
  extractCountryCode,
  extractRequestedFields,
} from '@/lib/extract-params';
import { countRecentActions } from '@/lib/velocity-tracker';
import type { AgentProfile, ConstraintCheckResult, ToolCall } from '@/types';

export async function enforceHardConstraints(
  toolCall: ToolCall,
  agentProfile: AgentProfile
): Promise<ConstraintCheckResult> {
  const violations: string[] = [];
  const limits = agentProfile.hardLimits;

  const amountUSD         = extractTransactionAmount(toolCall);
  const targetDomain      = extractTargetDomain(toolCall);
  const requestedScopes   = extractRequestedScopes(toolCall);
  const recentActionCount = countRecentActions(agentProfile.agentId);
  const irreversible      = isIrreversibleTool(toolCall.name);
  const countryCode       = extractCountryCode(toolCall);

  // AML compliance tools yang memang perlu handle transaksi di atas SAR threshold
  const SAR_TOOLS = new Set([
    'file_sar', 'screen_transaction', 'check_aml',
    'generate_sar_report', 'analyze_pattern', 'verify_kyc', 'flag_kyc',
  ]);
  const isSARContext = SAR_TOOLS.has(toolCall.name) && !!limits.sarThresholdUSD;

  // ── CHECK 1: Amount ceiling ──────────────────────────────────────
  // Untuk SAR context: ceiling berlaku HANYA jika melebihi hard ceiling (100K),
  // bukan SAR threshold (10K) — karena AML agent MEMANG perlu monitor transaksi besar
  if (amountUSD !== null && amountUSD > limits.maxTransactionAmountUSD) {
    if (!isSARContext) {
      // Non-AML tools: hard block seperti biasa
      violations.push(
        `AMOUNT_CEILING: $${amountUSD.toFixed(2)} exceeds absolute limit ` +
        `of $${limits.maxTransactionAmountUSD.toFixed(2)} for agent "${agentProfile.agentId}"`
      );
    }
    // AML context: tidak hard block, tapi dipastikan step-up di bawah
  }

  // ── CHECK 2: Domain whitelist ────────────────────────────────────
  if (targetDomain !== null && !limits.allowedDomains.includes(targetDomain)) {
    violations.push(
      `DOMAIN_VIOLATION: Domain "${targetDomain}" is not whitelisted. ` +
      `Allowed: [${limits.allowedDomains.join(', ')}]`
    );
  }

  // ── CHECK 3: Velocity cap ────────────────────────────────────────
  if (recentActionCount >= limits.maxActionsPerMinute) {
    violations.push(
      `VELOCITY_CAP: Agent performed ${recentActionCount} actions in the last 60s. ` +
      `Limit is ${limits.maxActionsPerMinute}/min`
    );
  }

  // ── CHECK 4: Scope ceiling ───────────────────────────────────────
  const forbiddenScopes = requestedScopes.filter(
    scope =>
      limits.forbiddenScopes.includes(scope) ||
      limits.forbiddenScopes.some(f => scope.startsWith(f))
  );
  if (forbiddenScopes.length > 0) {
    violations.push(
      `SCOPE_CEILING: Agent requested forbidden scopes: [${forbiddenScopes.join(', ')}]`
    );
  }

  // ── CHECK 5: AML — Hard blocked countries ───────────────────────
  if (limits.blockedCountries && countryCode) {
    if (limits.blockedCountries.includes(countryCode)) {
      violations.push(
        `COUNTRY_BLOCKED: Transactions to/from "${countryCode}" are permanently blocked ` +
        `for this agent. Blocked jurisdictions: [${limits.blockedCountries.join(', ')}]`
      );
    }
  }

  // ── CHECK 6: AML — SAR threshold → step-up ──────────────────────
  let sarTriggered = false;
  if (limits.sarThresholdUSD && amountUSD !== null) {
    if (amountUSD >= limits.sarThresholdUSD) {
      sarTriggered = true;
      auditLog({
        event: 'STEPUP_TRIGGERED',
        agentId: agentProfile.agentId,
        ownerUserId: agentProfile.ownerUserId,
        toolName: toolCall.name,
        metadata: {
          reason: 'SAR_THRESHOLD',
          amountUSD,
          sarThresholdUSD: limits.sarThresholdUSD,
          note: `Transaction $${amountUSD.toFixed(2)} meets SAR reporting threshold of $${limits.sarThresholdUSD.toLocaleString()}`,
        },
      });
    }
  }

  // ── CHECK 7: AML — High-risk countries → step-up ─────────────────
  let highRiskCountryTriggered = false;
  if (limits.highRiskCountries && countryCode) {
    if (limits.highRiskCountries.includes(countryCode)) {
      highRiskCountryTriggered = true;
      auditLog({
        event: 'STEPUP_TRIGGERED',
        agentId: agentProfile.agentId,
        ownerUserId: agentProfile.ownerUserId,
        toolName: toolCall.name,
        metadata: {
          reason: 'HIGH_RISK_COUNTRY',
          countryCode,
          note: `Transaction involves high-risk jurisdiction "${countryCode}"`,
        },
      });
    }
  }

  // ── CHECK 8: Data classification — hard blocked fields ───────────
  // HR agent: field seperti salary, medical tidak boleh PERNAH diakses
  let blockedFieldsFound: string[] = [];
  if (limits.blockedDataFields && limits.blockedDataFields.length > 0) {
    const requestedFields = extractRequestedFields(toolCall);
    blockedFieldsFound = requestedFields.filter(
      field => limits.blockedDataFields!.includes(field)
    );
    if (blockedFieldsFound.length > 0) {
      violations.push(
        `DATA_CLASSIFICATION_BLOCKED: Fields [${blockedFieldsFound.join(', ')}] are ` +
        `classified as restricted and cannot be accessed by this agent. ` +
        `Blocked fields: [${limits.blockedDataFields.join(', ')}]`
      );
      // Log khusus DATA_ACCESS_BLOCKED
      auditLog({
        event: 'DATA_ACCESS_BLOCKED',
        agentId: agentProfile.agentId,
        ownerUserId: agentProfile.ownerUserId,
        toolName: toolCall.name,
        metadata: {
          blockedFields: blockedFieldsFound,
          requestedFields: extractRequestedFields(toolCall),
          reason: 'DATA_CLASSIFICATION',
        },
      });
    }
  }

  // ── CHECK 9: Data classification — fields that require step-up ───
  let sensitiveFieldsFound: string[] = [];
  if (limits.requiresStepUpForFields && limits.requiresStepUpForFields.length > 0) {
    const requestedFields = extractRequestedFields(toolCall);
    sensitiveFieldsFound = requestedFields.filter(
      field => limits.requiresStepUpForFields!.includes(field)
    );
    if (sensitiveFieldsFound.length > 0) {
      auditLog({
        event: 'DATA_STEPUP_REQUIRED',
        agentId: agentProfile.agentId,
        ownerUserId: agentProfile.ownerUserId,
        toolName: toolCall.name,
        metadata: {
          sensitiveFields: sensitiveFieldsFound,
          reason: 'SENSITIVE_DATA_ACCESS',
        },
      });
    }
  }

  // ── Determine step-up requirement ───────────────────────────────
  const requiresStepUp =
    sarTriggered ||
    highRiskCountryTriggered ||
    sensitiveFieldsFound.length > 0 ||
    (amountUSD !== null && amountUSD > limits.requiresStepUpAboveUSD) ||
    (irreversible && amountUSD !== null && amountUSD > 0);

  const allowed = violations.length === 0;

  auditLog({
    event: allowed ? 'CONSTRAINT_PASSED' : 'CONSTRAINT_BLOCKED',
    agentId: agentProfile.agentId,
    ownerUserId: agentProfile.ownerUserId,
    toolName: toolCall.name,
    constraintViolations: violations,
    metadata: {
      amountUSD,
      targetDomain,
      recentActionCount,
      irreversible,
      requiresStepUp,
      sarTriggered,
      highRiskCountryTriggered,
      countryCode,
      isSARContext,
    },
  });

  if (!allowed) {
    throw new HardConstraintError(violations);
  }

  return {
    allowed: true,
    blockedReasons: [],
    requiresStepUp,
    auditData: {
      transactionAmountUSD: amountUSD,
      targetDomain,
      recentActionCount,
      flaggedScopes: forbiddenScopes,
    },
  };
}