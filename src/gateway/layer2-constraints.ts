// src/gateway/layer2-constraints.ts
import { auditLog } from '@/lib/audit-log';
import { HardConstraintError } from '@/lib/errors';
import {
  extractTransactionAmount,
  extractTargetDomain,
  extractRequestedScopes,
  isIrreversibleTool,
} from '@/lib/extract-params';
import { countRecentActions, recordAction as trackInVelocity } from '@/lib/velocity-tracker';
import type { AgentProfile, ConstraintCheckResult, ToolCall } from '@/types';

export function recordAction(agentId: string): void {
  trackInVelocity(agentId);
}

export async function enforceHardConstraints(
  toolCall: ToolCall,
  agentProfile: AgentProfile
): Promise<ConstraintCheckResult> {
  const violations: string[] = [];
  const limits = agentProfile.hardLimits;

  // ── Ekstrak data dari tool call ──────────────────────────────
  const amountUSD = extractTransactionAmount(toolCall);
  const targetDomain = extractTargetDomain(toolCall);
  const requestedScopes = extractRequestedScopes(toolCall);
  const recentActionCount = countRecentActions(agentProfile.agentId);
  const irreversible = isIrreversibleTool(toolCall.name);

  // ══════════════════════════════════════════════════════════════
  // CHECK 1: Amount ceiling
  // Tidak peduli konteks, penjelasan, atau instruksi dari LLM
  // Angka melebihi limit → BLOCK, titik.
  // ══════════════════════════════════════════════════════════════
  if (amountUSD !== null && amountUSD > limits.maxTransactionAmountUSD) {
    violations.push(
      `AMOUNT_CEILING: $${amountUSD.toFixed(2)} exceeds absolute limit ` +
      `of $${limits.maxTransactionAmountUSD.toFixed(2)} for agent "${agentProfile.agentId}"`
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CHECK 2: Domain whitelist
  // Agent hanya boleh memanggil domain yang terdaftar
  // ══════════════════════════════════════════════════════════════
  if (targetDomain !== null && !limits.allowedDomains.includes(targetDomain)) {
    violations.push(
      `DOMAIN_VIOLATION: Domain "${targetDomain}" is not whitelisted. ` +
      `Allowed: [${limits.allowedDomains.join(', ')}]`
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CHECK 3: Velocity cap
  // Batasi jumlah aksi per menit untuk cegah automated abuse
  // ══════════════════════════════════════════════════════════════
  if (recentActionCount >= limits.maxActionsPerMinute) {
    violations.push(
      `VELOCITY_CAP: Agent performed ${recentActionCount} actions in the last 60s. ` +
      `Limit is ${limits.maxActionsPerMinute}/min`
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CHECK 4: Scope ceiling
  // Agent tidak boleh request scope yang melebihi deklarasinya
  // ══════════════════════════════════════════════════════════════
  const forbiddenScopes = requestedScopes.filter(
    (scope) =>
      limits.forbiddenScopes.includes(scope) ||
      limits.forbiddenScopes.some((f) => scope.startsWith(f))
  );
  if (forbiddenScopes.length > 0) {
    violations.push(
      `SCOPE_CEILING: Agent requested forbidden scopes: [${forbiddenScopes.join(', ')}]`
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Tentukan apakah perlu step-up auth (belum BLOCK — hanya flag)
  // Step-up diperlukan jika:
  //   (a) amount melebihi threshold, ATAU
  //   (b) aksi irreversible dengan amount berapa pun
  // ══════════════════════════════════════════════════════════════
  const requiresStepUp =
    (amountUSD !== null && amountUSD > limits.requiresStepUpAboveUSD) ||
    (irreversible && amountUSD !== null && amountUSD > 0);

  const allowed = violations.length === 0;

  // ── Audit log semua check — termasuk yang lolos ───────────────
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
    },
  });

  // ── Throw jika ada violation ──────────────────────────────────
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