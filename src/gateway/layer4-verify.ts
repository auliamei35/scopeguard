// src/gateway/layer4-verify.ts
import { auditLog } from '@/lib/audit-log';
import type {
  AgentProfile,
  ScopeDecision,
  PostExecutionResult,
  VerificationViolation,
  VerificationStatus,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════
// MULTI-LAYER PII DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

// ── LAYER 4A: Allowlist — pasti bukan PII, skip scan ─────────────
// Jika string mengandung kata ini, langsung lewati
const SYSTEM_ID_PREFIXES = [
  'TXN-', 'BK-', 'CASE-', 'ALERT-', 'PAT-', 'SCR-', 'SAR-',
  'SARR-', 'PROV-', 'TASK-', 'EMAIL-', 'DOC-', 'KYC-', 'KYCF-',
  'AML-', 'EMP-', 'CUST-', 'version_', 'build_', 'tracking_',
  'audit_', 'session_', 'request_', 'correlation_',
];

const SAFE_FIELD_NAMES = new Set([
  'transactionId', 'transaction_id', 'bookingId', 'booking_id',
  'caseId', 'case_id', 'alertId', 'alert_id', 'reportId', 'report_id',
  'employeeId', 'employee_id', 'customerId', 'customer_id',
  'screeningId', 'screening_id', 'provisioningId', 'provisioning_id',
  'taskId', 'task_id', 'emailId', 'email_id', 'kycId', 'kyc_id',
  'riskScore', 'risk_score', 'confidence', 'pages',
  'expiresIn', 'expires_in', 'retentionDays', 'retention_days',
  'transactionCount', 'transaction_count', 'flaggedCount', 'flagged_count',
]);

function isAllowlisted(value: string, fieldName?: string): boolean {
  // Cek field name allowlist
  if (fieldName && SAFE_FIELD_NAMES.has(fieldName)) return true;

  // Cek prefix sistem
  for (const prefix of SYSTEM_ID_PREFIXES) {
    if (value.toUpperCase().startsWith(prefix.toUpperCase())) return true;
  }

  // Cek apakah UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(value)) return true;

  return false;
}

// ── LAYER 4B: Timestamp Sanity Check ─────────────────────────────
// Angka 13 digit yang merupakan Unix timestamp (ms) antara 2020-2035
function isLikelyTimestamp(numStr: string): boolean {
  if (numStr.length !== 13) return false;
  const num = parseInt(numStr, 10);
  const year2020 = 1577836800000;
  const year2035 = 2051222400000;
  return num >= year2020 && num <= year2035;
}

// Angka 10 digit yang merupakan Unix timestamp (seconds)
function isLikelyTimestampSeconds(numStr: string): boolean {
  if (numStr.length !== 10) return false;
  const num = parseInt(numStr, 10);
  const year2020 = 1577836800;
  const year2035 = 2051222400;
  return num >= year2020 && num <= year2035;
}

// ── LAYER 4C: Luhn Algorithm — validasi kartu kredit ─────────────
function luhnCheck(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ── LAYER 4D: NIK Validation — struktur NIK Indonesia ────────────
// NIK: 16 digit, 6 digit pertama adalah kode wilayah valid
function isValidNIK(numStr: string): boolean {
  if (numStr.length !== 16) return false;
  if (!/^\d{16}$/.test(numStr)) return false;

  // Digit pertama harus 1-9 (kode provinsi valid)
  const provinceCode = parseInt(numStr.substring(0, 2), 10);
  if (provinceCode < 11 || provinceCode > 96) return false;

  // Digit 7-8 adalah tanggal lahir (01-71 untuk perempuan ditambah 40)
  const day = parseInt(numStr.substring(6, 8), 10);
  if (day < 1 || day > 71) return false;

  // Digit 9-10 adalah bulan lahir (01-12)
  const month = parseInt(numStr.substring(8, 10), 10);
  if (month < 1 || month > 12) return false;

  // Bukan timestamp
  if (isLikelyTimestamp(numStr) || isLikelyTimestampSeconds(numStr)) return false;

  return true;
}

// ── LAYER 1+2+3+4 Combined: PII Candidate Scanner ────────────────
interface PIICandidate {
  type: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: 'high' | 'medium' | 'low';
  fieldName?: string;
}

function scanForPII(obj: unknown, path = ''): PIICandidate[] {
  const candidates: PIICandidate[] = [];

  if (typeof obj === 'string') {
    // Layer 1: Regex — tangkap kandidat kasar
    const digits = obj.replace(/[\s\-]/g, '');

    // Kandidat kartu kredit: 13-19 digit
    if (/^\d{13,19}$/.test(digits) && digits.length >= 13) {
      const fieldName = path.split('.').pop();

      // Layer 4: Allowlist check
      if (!isAllowlisted(obj, fieldName) && !isAllowlisted(digits, fieldName)) {

        // Layer 2: Timestamp sanity check
        const isTimestamp = isLikelyTimestamp(digits) || isLikelyTimestampSeconds(digits);

        if (!isTimestamp) {
          // Layer 3: Luhn algorithm
          if (luhnCheck(digits)) {
            candidates.push({
              type: 'Credit card number',
              value: `${digits.substring(0, 4)}****${digits.substring(digits.length - 4)}`,
              severity: 'critical',
              confidence: 'high',
              fieldName,
            });
          }
          // Layer 3: NIK validation
          else if (isValidNIK(digits)) {
            candidates.push({
              type: 'Indonesian NIK',
              value: `${digits.substring(0, 6)}**********`,
              severity: 'critical',
              confidence: 'high',
              fieldName,
            });
          }
        }
      }
    }

    // Password/secret yang ter-expose — regex + field name check
    const passwordPattern = /^.{8,}$/;
    const fieldName = path.split('.').pop()?.toLowerCase() ?? '';
    const sensitiveFieldNames = ['password', 'passwd', 'secret', 'private_key', 'client_secret', 'api_key', 'access_token'];
    if (sensitiveFieldNames.includes(fieldName) && passwordPattern.test(obj)) {
      candidates.push({
        type: 'Exposed secret',
        value: '[REDACTED]',
        severity: 'critical',
        confidence: 'high',
        fieldName,
      });
    }
  }

  // Rekursif untuk object dan array
  if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      candidates.push(...scanForPII(val, childPath));
    }
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      candidates.push(...scanForPII(item, `${path}[${idx}]`));
    });
  }

  return candidates;
}

// ── Blocked field patterns ───────────────────────────────────────
const BLOCKED_FIELD_PATTERNS = [
  'salary', 'gaji', 'bonus', 'bank_account', 'rekening',
  'medical_history', 'riwayat_medis', 'disability',
  'performance_score', 'review_notes', 'rating_karyawan',
  'npwp', 'private_key', 'client_secret',
];

// ── Write operation indicators ────────────────────────────────────
const WRITE_INDICATORS = [
  'affected_rows', 'rows_deleted', 'deleted_count', 'mutation_id',
];

// ── Volume thresholds per tool (bytes) ───────────────────────────
const VOLUME_THRESHOLDS: Record<string, number> = {
  search_flights:       10_000,
  check_transaction:    5_000,
  get_employee_profile: 3_000,
  book_flight:          2_000,
  check_aml:            8_000,
  file_sar:             5_000,
  verify_kyc:           4_000,
  analyze_pattern:      6_000,
};

// ═══════════════════════════════════════════════════════════════════
// MAIN VERIFIER
// ═══════════════════════════════════════════════════════════════════

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

  const resultStr = serializeSafe(result);
  let sanitizedResult = result;

  // ── CHECK 1: Sensitive field leak (HR data classification) ──────
  if (agentProfile.hardLimits.blockedDataFields?.length) {
    for (const blockedField of agentProfile.hardLimits.blockedDataFields) {
      const pattern = new RegExp(`["']?${blockedField}["']?\\s*[:=]\\s*`, 'i');
      if (pattern.test(resultStr)) {
        violations.push({
          type: 'SENSITIVE_FIELD_LEAK',
          severity: 'critical',
          field: blockedField,
          detail: `Response contains blocked data field: "${blockedField}". ` +
                  `This data should never be accessible to this agent.`,
          redacted: true,
        });
        sanitizedResult = redactField(sanitizedResult, blockedField);
      }
    }
  }

  // ── CHECK 2: Generic blocked field patterns ───────────────────────
  for (const pattern of BLOCKED_FIELD_PATTERNS) {
    const regex = new RegExp(`["']${pattern}["']\\s*:`, 'i');
    if (regex.test(resultStr)) {
      const isAllowed = agentProfile.hardLimits.allowedDataFields?.some(
        f => f.toLowerCase() === pattern.toLowerCase()
      );
      if (!isAllowed) {
        violations.push({
          type: 'SENSITIVE_FIELD_LEAK',
          severity: 'high',
          field: pattern,
          detail: `Response contains sensitive pattern "${pattern}" not in the allowed data fields list.`,
          redacted: true,
        });
        sanitizedResult = redactField(sanitizedResult, pattern);
      }
    }
  }

  // ── CHECK 3: Multi-layer PII detection ───────────────────────────
  // Hanya pada tools yang seharusnya tidak return PII langsung
  const STRICT_NON_PII_TOOLS = new Set([
    'search_flights',
    'analyze_pattern',
    'generate_sar_report',
  ]);

  if (STRICT_NON_PII_TOOLS.has(toolCall.name)) {
    const piiCandidates = scanForPII(result);

    for (const candidate of piiCandidates) {
      if (candidate.confidence === 'high') {
        violations.push({
          type: 'PII_DETECTED',
          severity: candidate.severity,
          field: candidate.fieldName,
          detail: `Multi-layer PII validation confirmed ${candidate.type} ` +
                  `(passed Luhn/NIK algorithm check) in tool "${toolCall.name}" ` +
                  `which should not return personal data. ` +
                  `Masked value: ${candidate.value}`,
          redacted: true,
        });
        sanitizedResult = redactPIIFromResult(sanitizedResult, candidate.type);
      }
    }
  }

  // ── CHECK 4: Amount drift detection ──────────────────────────────
  const requestedAmount = extractAmountFromParams(toolCall.params);
  const responseAmount  = extractAmountFromResult(result);

  if (requestedAmount !== null && responseAmount !== null) {
    const drift = Math.abs(responseAmount - requestedAmount) / requestedAmount;
    if (drift > 0.05) {
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

  // ── CHECK 5: Scope overshoot ──────────────────────────────────────
  const hasWriteScope = scopeDecision.minimalScopes.some(s => s.includes(':write'));
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

  // ── CHECK 6: Anomalous volume ─────────────────────────────────────
  const resultBytes = resultStr.length;
  const threshold = VOLUME_THRESHOLDS[toolCall.name] ?? 50_000;

  if (resultBytes > threshold) {
    violations.push({
      type: 'ANOMALOUS_VOLUME',
      severity: resultBytes > threshold * 5 ? 'high' : 'low',
      detail: `Response size ${resultBytes} bytes exceeds expected ` +
              `threshold of ${threshold} bytes for tool "${toolCall.name}".`,
      redacted: false,
    });
  }

  // ── Determine status ──────────────────────────────────────────────
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const highViolations     = violations.filter(v => v.severity === 'high');

  let status: VerificationStatus;
  if (criticalViolations.length > 0) {
    status = 'quarantined';
  } else if (highViolations.length > 0 || violations.some(v => v.redacted)) {
    status = 'redacted';
  } else {
    status = 'clean';
  }

  // ── Audit log ─────────────────────────────────────────────────────
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
      violations: violations.map(v => ({
        type: v.type,
        severity: v.severity,
        field: v.field,
        detail: v.detail,
      })),
      executionMs,
      resultBytes,
    },
  });

  if (violations.length > 0) {
    console.warn(
      `[ScopeGuard L4] ${status.toUpperCase()} — ` +
      `${violations.length} violation(s) for ${agentProfile.agentId}:${toolCall.name}`
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

// ── Helpers ───────────────────────────────────────────────────────

function serializeSafe(value: unknown): string {
  try { return JSON.stringify(value) ?? ''; } catch { return String(value); }
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

function redactPIIFromResult(result: unknown, piiType: string): unknown {
  const str = serializeSafe(result);
  // Redact long digit sequences yang sudah confirmed PII
  const redacted = str.replace(
    /\b\d{13,19}\b/g,
    `[${piiType.toUpperCase().replace(' ', '-')}-REDACTED]`
  );
  try { return JSON.parse(redacted); } catch { return redacted; }
}