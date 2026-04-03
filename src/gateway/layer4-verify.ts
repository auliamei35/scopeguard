// src/gateway/layer4-verify.ts
import { auditLog } from '@/lib/audit-log';
import type {
  AgentProfile,
  ScopeDecision,
  PostExecutionResult,
  VerificationViolation,
  VerificationStatus,
} from '@/types';

// ── PII patterns untuk deteksi kebocoran ─────────────────────────
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'low' | 'medium' | 'high' | 'critical' }> = [
  { name: 'Credit card number',  pattern: /\b(?:\d[ -]?){13,16}\b/,                    severity: 'critical' },
  { name: 'Indonesian NIK',      pattern: /\b[1-9]\d{15}\b/,                            severity: 'critical' },
  { name: 'Bank account',        pattern: /\b\d{10,16}\b/,                              severity: 'high'     },
  { name: 'Email address',       pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/, severity: 'medium' },
  { name: 'Phone number (ID)',   pattern: /(?:\+62|0)[0-9]{8,12}/,                      severity: 'medium'   },
  { name: 'Password-like value', pattern: /["']?(?:password|passwd|secret|token|key)["']?\s*[:=]\s*["'][^"']{8,}/i, severity: 'critical' },
];

// ── Blocked field patterns — kata-kata yang seharusnya tidak ada di response ──
const BLOCKED_FIELD_PATTERNS = [
  'salary', 'gaji', 'bonus', 'bank_account', 'rekening',
  'medical_history', 'riwayat_medis', 'disability', 'disabilitas',
  'performance_score', 'review_notes', 'rating_karyawan',
  'tax_id', 'npwp', 'private_key', 'client_secret',
];

export async function verifyPostExecution(params: {
  toolCall: { name: string; params: Record<string, unknown> };
  result: unknown;
  agentProfile: AgentProfile;
  scopeDecision: ScopeDecision;
  executionStartMs: number;
}): Promise<PostExecutionResult> {
  const { toolCall, result, agentProfile, scopeDecision, executionStartMs } = params;
  const executionMs = Date.now() - executionStartMs;
  const violations: VerificationViolation[] = [];

  // Serialize result untuk inspection
  const resultStr = serializeSafe(result);
  let sanitizedResult = result;

  // ── CHECK 1: Sensitive field leak detection ───────────────────────
  // Untuk HR agent: pastikan blocked fields tidak ada di response
  if (agentProfile.hardLimits.blockedDataFields?.length) {
    for (const blockedField of agentProfile.hardLimits.blockedDataFields) {
      const pattern = new RegExp(`["']?${blockedField}["']?\\s*[:=]\\s*`, 'i');
      if (pattern.test(resultStr)) {
        violations.push({
          type: 'SENSITIVE_FIELD_LEAK',
          severity: 'critical',
          field: blockedField,
          detail: `Response contains blocked data field: "${blockedField}". This data should never be accessible to this agent.`,
          redacted: true,
        });
        // Redact field dari result
        sanitizedResult = redactField(sanitizedResult, blockedField);
      }
    }
  }

  // ── CHECK 2: Generic blocked field patterns ───────────────────────
  for (const pattern of BLOCKED_FIELD_PATTERNS) {
    const regex = new RegExp(`["']${pattern}["']\\s*:`, 'i');
    if (regex.test(resultStr)) {
      // Hanya flag jika bukan declared field yang diizinkan
      const isAllowed = agentProfile.hardLimits.allowedDataFields?.some(
        f => f.toLowerCase() === pattern.toLowerCase()
      );
      if (!isAllowed) {
        violations.push({
          type: 'SENSITIVE_FIELD_LEAK',
          severity: 'high',
          field: pattern,
          detail: `Response contains sensitive pattern "${pattern}" that is not in the allowed data fields list.`,
          redacted: true,
        });
        sanitizedResult = redactField(sanitizedResult, pattern);
      }
    }
  }

  // ── CHECK 3: Amount drift detection ─────────────────────────────────
  // Pastikan amount di response tidak signifikan berbeda dari request
  const requestedAmount = extractAmountFromParams(toolCall.params);
  const responseAmount  = extractAmountFromResult(result);

  if (requestedAmount !== null && responseAmount !== null) {
    const drift = Math.abs(responseAmount - requestedAmount) / requestedAmount;
    if (drift > 0.05) {  // >5% drift — anomali
      violations.push({
        type: 'AMOUNT_DRIFT',
        severity: drift > 0.20 ? 'critical' : 'high',
        detail: `Amount drift detected: requested $${requestedAmount.toFixed(2)}, ` +
                `response contains $${responseAmount.toFixed(2)} ` +
                `(${(drift * 100).toFixed(1)}% difference). Possible manipulation.`,
        redacted: false,
      });
    }
  }

  // ── CHECK 4: PII detection ───────────────────────────────────────────
  // Untuk tools yang seharusnya tidak return PII
  const NON_PII_TOOLS = new Set([
    'search_flights', 'check_transaction', 'analyze_pattern',
    'check_aml', 'screen_transaction', 'generate_sar_report',
  ]);

  if (NON_PII_TOOLS.has(toolCall.name)) {
    for (const { name, pattern, severity } of PII_PATTERNS) {
      if (pattern.test(resultStr)) {
        violations.push({
          type: 'PII_DETECTED',
          severity,
          detail: `PII detected in response (${name}) for tool "${toolCall.name}" ` +
                  `which should not return personal data.`,
          redacted: true,
        });
        // Redact PII dari response
        sanitizedResult = redactPII(sanitizedResult, pattern);
        break; // Flag satu kali cukup
      }
    }
  }

  // ── CHECK 5: Scope overshoot ─────────────────────────────────────────
  // Kalau scope yang diotorisasi adalah read-only, response tidak boleh
  // berisi tanda-tanda write operation (affected_rows, created_id, dll)
  const hasWriteScope = scopeDecision.minimalScopes.some(s => s.includes(':write'));
  const WRITE_INDICATORS = ['affected_rows', 'rows_deleted', 'deleted_count', 'mutation_id'];

  if (!hasWriteScope) {
    for (const indicator of WRITE_INDICATORS) {
      if (resultStr.toLowerCase().includes(indicator)) {
        violations.push({
          type: 'SCOPE_OVERSHOOT',
          severity: 'high',
          detail: `Response contains write operation indicator "${indicator}" but ` +
                  `only read scopes were authorized: [${scopeDecision.minimalScopes.join(', ')}]`,
          redacted: false,
        });
      }
    }
  }

  // ── CHECK 6: Anomalous volume ────────────────────────────────────────
  const resultBytes = resultStr.length;
  const VOLUME_THRESHOLDS: Record<string, number> = {
    search_flights:       10_000,  // ~10KB untuk hasil search
    check_transaction:    5_000,
    get_employee_profile: 3_000,
    book_flight:          2_000,
    check_aml:            8_000,
    file_sar:             5_000,
  };
  const threshold = VOLUME_THRESHOLDS[toolCall.name] ?? 50_000;

  if (resultBytes > threshold) {
    violations.push({
      type: 'ANOMALOUS_VOLUME',
      severity: resultBytes > threshold * 5 ? 'high' : 'low',
      detail: `Response size ${resultBytes} bytes exceeds expected threshold ` +
              `of ${threshold} bytes for tool "${toolCall.name}". ` +
              `Possible data exfiltration or misconfiguration.`,
      redacted: false,
    });
  }

  // ── Determine final status ───────────────────────────────────────────
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const highViolations     = violations.filter(v => v.severity === 'high');

  let status: VerificationStatus;
  if (criticalViolations.length > 0) {
    status = 'quarantined';  // Critical → quarantine, block result dari agent
  } else if (highViolations.length > 0 || violations.some(v => v.redacted)) {
    status = 'redacted';     // High → redact violations, pass sanitized result
  } else {
    status = 'clean';
  }

  // ── Audit log ────────────────────────────────────────────────────────
  const auditEvent =
    status === 'quarantined' ? 'POST_EXEC_QUARANTINED' :
    violations.length > 0    ? 'POST_EXEC_VIOLATION'   :
                               'POST_EXEC_CLEAN';

  auditLog({
    event: auditEvent,
    agentId: agentProfile.agentId,
    ownerUserId: agentProfile.ownerUserId,
    toolName: toolCall.name,
    metadata: {
      status,
      violationCount: violations.length,
      violations: violations.map(v => ({ type: v.type, severity: v.severity, detail: v.detail })),
      executionMs,
      resultBytes,
    },
  });

  if (violations.length > 0) {
    console.warn(
      `[ScopeGuard Layer 4] ${status.toUpperCase()} — ${violations.length} violation(s) ` +
      `for ${agentProfile.agentId}:${toolCall.name}`
    );
    for (const v of violations) {
      console.warn(`  [${v.severity.toUpperCase()}] ${v.type}: ${v.detail}`);
    }
  }

  return {
    status,
    violations,
    sanitizedResult,
    verifiedAt: new Date(),
    executionMs,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function serializeSafe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function extractAmountFromParams(params: Record<string, unknown>): number | null {
  const keys = ['amount', 'total', 'price', 'value', 'sum', 'payment_amount'];
  for (const key of keys) {
    if (typeof params[key] === 'number') return params[key] as number;
    if (typeof params[key] === 'string') {
      const n = parseFloat(params[key] as string);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractAmountFromResult(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const keys = ['amount', 'total', 'charged_amount', 'transaction_amount', 'price', 'final_amount'];
  for (const key of keys) {
    if (typeof r[key] === 'number') return r[key] as number;
  }
  return null;
}

function redactField(result: unknown, fieldName: string): unknown {
  if (!result || typeof result !== 'object') return result;
  const r = { ...(result as Record<string, unknown>) };
  for (const key of Object.keys(r)) {
    if (key.toLowerCase() === fieldName.toLowerCase()) {
      r[key] = '[REDACTED BY SCOPEGUARD L4]';
    } else if (r[key] && typeof r[key] === 'object') {
      r[key] = redactField(r[key], fieldName);
    }
  }
  return r;
}

function redactPII(result: unknown, pattern: RegExp): unknown {
  const str = serializeSafe(result);
  const redacted = str.replace(pattern, '[PII-REDACTED]');
  try {
    return JSON.parse(redacted);
  } catch {
    return redacted;
  }
}