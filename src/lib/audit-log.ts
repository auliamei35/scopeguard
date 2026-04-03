// src/lib/audit-log.ts
import { randomUUID } from 'crypto';
import type { AuditLogEntry, AuditEventType, RiskLevel } from '@/types';

// In-memory store — production pakai Supabase atau Vercel KV
const logs: AuditLogEntry[] = [];

interface LogParams {
  event: AuditEventType;
  agentId: string;
  ownerUserId?: string;
  toolName?: string;
  scopesGranted?: string[];
  scopesActuallyUsed?: string[];
  riskLevel?: RiskLevel;
  stepUpRequired?: boolean;
  stepUpApproved?: boolean;
  constraintViolations?: string[];
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export function auditLog(params: LogParams): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: randomUUID(),
    timestamp: new Date(),
    ...params,
  };
  logs.push(entry);

  // Console output selama development
  const icon: Record<AuditEventType, string> = {
    AGENT_IDENTITY_RESOLVED: '🔵',
    IDENTITY_REJECTED: '🔴',
    CONSTRAINT_PASSED: '🟢',
    CONSTRAINT_BLOCKED: '🔴',
    DATA_ACCESS_BLOCKED: '🚫',
    DATA_STEPUP_REQUIRED:'🔒',
    SCOPE_DECIDED: '🟡',
    STEPUP_TRIGGERED: '🟠',
    STEPUP_APPROVED: '🟢',
    STEPUP_DENIED: '🔴',
    STEPUP_TIMEOUT: '🟠',
    TOOL_EXECUTED_SUCCESS: '✅',
    TOOL_EXECUTION_FAILED: '❌',
    AGENT_REVOKED: '🚫',
  };

  console.log(
    `${icon[params.event]} [ScopeGuard] ${params.event}`,
    `| agent: ${params.agentId}`,
    params.toolName ? `| tool: ${params.toolName}` : '',
    params.constraintViolations?.length
      ? `| violations: ${params.constraintViolations.join(', ')}`
      : ''
  );

  return entry;
}

export function getAuditLogs(agentId?: string): AuditLogEntry[] {
  if (agentId) return logs.filter((l) => l.agentId === agentId);
  return [...logs].reverse(); // newest first
}

export function getAuditStats() {
  const total = logs.length;
  const blocked = logs.filter((l) => l.event === 'CONSTRAINT_BLOCKED').length;
  const stepUps = logs.filter((l) => l.event === 'STEPUP_TRIGGERED').length;
  const success = logs.filter((l) => l.event === 'TOOL_EXECUTED_SUCCESS').length;

  // Scope efficiency: rata-rata berapa scope yang benar-benar dipakai
  // vs scope yang di-grant — ini adalah core insight value ScopeGuard
  const executedLogs = logs.filter(
    (l) => l.scopesGranted && l.scopesActuallyUsed
  );
  const avgScopeReduction =
    executedLogs.length > 0
      ? executedLogs.reduce((acc, l) => {
          const granted = l.scopesGranted!.length;
          const used = l.scopesActuallyUsed!.length;
          return acc + (granted > 0 ? (granted - used) / granted : 0);
        }, 0) / executedLogs.length
      : 0;

  return {
    total,
    blocked,
    stepUps,
    success,
    blockRate: total > 0 ? Math.round((blocked / total) * 100) : 0,
    avgScopeReduction: Math.round(avgScopeReduction * 100), // dalam persen
  };
}