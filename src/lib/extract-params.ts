// src/lib/extract-params.ts
import type { ToolCall } from '@/types';

// ── Extract transaction amount ────────────────────────────────────
// Cek berbagai key yang umum dipakai untuk amount di tool params
export function extractTransactionAmount(toolCall: ToolCall): number | null {
  const params = toolCall.params;
  const amountKeys = [
    'amount', 'total', 'price', 'payment_amount',
    'value', 'sum', 'cost', 'fare', 'fee', 'charge',
  ];

  for (const key of amountKeys) {
    const val = params[key];
    if (typeof val === 'number' && val > 0) {
      return val;
    }
    // Handle string number: "150.00"
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

// ── Extract target domain ────────────────────────────────────────
// Cek url, endpoint, domain, destination_url di params
export function extractTargetDomain(toolCall: ToolCall): string | null {
  const params = toolCall.params;
  const urlKeys = ['url', 'endpoint', 'domain', 'destination_url', 'api_url', 'base_url'];

  for (const key of urlKeys) {
    const val = params[key];
    if (typeof val === 'string' && val.length > 0) {
      try {
        const url = new URL(
          val.startsWith('http') ? val : `https://${val}`
        );
        return url.hostname;
      } catch {
        // bukan URL valid, skip
      }
    }
  }

  // Fallback: cek nama tool untuk mapping domain
  return inferDomainFromToolName(toolCall.name);
}

// Mapping tool name → domain (untuk tool yang tidak sertakan URL di params)
function inferDomainFromToolName(toolName: string): string | null {
  const mappings: Record<string, string> = {
    // Travel Agent Tools
    book_flight:    'api.traveloka.com',
    search_flights: 'api.traveloka.com',
    book_hotel:     'api.traveloka.com',
    book_ticket:    'api.tiket.com',
    search_tickets: 'api.tiket.com',
    // Fraud Detection Agent Tools
    check_transaction:   'api.bri.co.id',
    flag_transaction:    'api.bri.co.id',
    get_account_history: 'api.bca.co.id',
    submit_alert:        'api.bri.co.id',
    analyze_pattern:     'api.bca.co.id',
    freeze_account:      'api.bri.co.id',
    // AML Compliance Agent Tools
    check_aml:           'api.bri.co.id',
    file_sar:            'akun.bri.co.id',
    verify_kyc:          'akun.bri.co.id',
    flag_kyc:            'akun.bri.co.id',
    screen_transaction:  'api.bri.co.id',
    generate_sar_report: 'akun.bri.co.id',
    // HR Onboarding
    get_employee_profile:   'api.hr.internal',
    get_employee_contact:   'api.hr.internal',
    create_onboarding_task: 'api.hr.internal',
    update_department:      'api.hr.internal',
    provision_access:       'api.directory.internal',
    send_welcome_email:     'api.hr.internal',
    get_payroll:            'api.hr.internal',
    get_performance_review: 'api.hr.internal',
    get_medical_records:    'api.hr.internal',
    get_salary_history:     'api.hr.internal',
    get_employee_documents: 'api.hr.internal',
  };
  return mappings[toolName] ?? null;
}

// ── Extract requested scopes ─────────────────────────────────────
export function extractRequestedScopes(toolCall: ToolCall): string[] {
  const params = toolCall.params;
  const scopeKeys = ['scopes', 'scope', 'permissions', 'required_scopes'];

  for (const key of scopeKeys) {
    const val = params[key];
    if (Array.isArray(val)) return val.filter((s) => typeof s === 'string');
    if (typeof val === 'string') return val.split(/[\s,]+/).filter(Boolean);
  }
  return [];
}
// ── Extract data fields yang diminta dari tool call params ────────
// HR agent tools menyertakan 'fields' atau 'data' di params
export function extractRequestedFields(toolCall: ToolCall): string[] {
  const params = toolCall.params;
  const fieldKeys = ['fields', 'data_fields', 'include', 'attributes', 'columns'];

  for (const key of fieldKeys) {
    const val = params[key];
    if (Array.isArray(val)) return val.filter(f => typeof f === 'string');
    if (typeof val === 'string') return val.split(/[\s,]+/).filter(Boolean);
  }

  // Fallback: infer dari tool name
  return inferFieldsFromToolName(toolCall.name);
}

function inferFieldsFromToolName(toolName: string): string[] {
  const mappings: Record<string, string[]> = {
    get_employee_profile:     ['email', 'phone', 'department', 'name', 'position'],
    get_employee_contact:     ['email', 'phone', 'address'],
    get_payroll:              ['salary', 'bonus', 'tax', 'bank_account'],
    get_performance_review:   ['performance_score', 'review_notes', 'rating'],
    get_medical_records:      ['medical_history', 'insurance', 'disability'],
    create_onboarding_task:   ['email', 'department', 'start_date', 'name'],
    update_department:        ['department', 'manager', 'team'],
    get_salary_history:       ['salary', 'bonus', 'salary_history'],
    provision_access:         ['email', 'department', 'role'],
    get_employee_documents:   ['id_card', 'contract', 'nda'],
    send_welcome_email:       ['email', 'name', 'start_date'],
  };
  return mappings[toolName] ?? [];
}

// Tambahkan juga domain mapping untuk HR tools
// (update inferDomainFromToolName yang sudah ada)

// ── Cek apakah tool termasuk irreversible ────────────────────────
const IRREVERSIBLE_PATTERNS = [
  /^delete/i, /^remove/i, /^purge/i,
  /^send_/i,  /^submit_/i,
  /^make_payment/i, /^pay_/i,
  /^book_/i,  /^purchase/i, /^buy_/i,
  /^transfer/i, /^publish/i,
];

export function isIrreversibleTool(toolName: string): boolean {
  return IRREVERSIBLE_PATTERNS.some((pattern) => pattern.test(toolName));
}

// ── Extract country code from transaction params ──────────────────
export function extractCountryCode(toolCall: ToolCall): string | null {
  const params = toolCall.params;
  const countryKeys = [
    'country', 'country_code', 'destination_country',
    'recipient_country', 'jurisdiction', 'offshore_country',
  ];
  for (const key of countryKeys) {
    const val = params[key];
    if (typeof val === 'string' && val.length === 2) {
      return val.toUpperCase();
    }
  }
  return null;
}

// ── Extract transaction amount for SAR check ─────────────────────
// Same as extractTransactionAmount but exported with SAR-specific name
export function extractSARAmount(toolCall: ToolCall): number | null {
  return extractTransactionAmount(toolCall);
}