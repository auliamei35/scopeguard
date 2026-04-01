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
    book_flight: 'api.traveloka.com',
    search_flights: 'api.traveloka.com',
    book_hotel: 'api.traveloka.com',
    book_ticket: 'api.tiket.com',
    search_tickets: 'api.tiket.com',
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