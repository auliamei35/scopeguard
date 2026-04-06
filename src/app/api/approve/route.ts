// src/app/api/approve/route.ts
// CIBA approval endpoint — stores decisions in memory (swap to Redis/DB in prod)
// POST /api/approve  → resolve a pending approval
// GET  /api/approve?id=xxx → poll status (used by /ask page)

import { NextRequest, NextResponse } from 'next/server';
import { ApprovalRequest, ApprovePayload, ApproveResponse, PollResponse } from '@/types/approvals';

// ---------------------------------------------------------------------------
// In-memory store — replace with Redis / Postgres in production
// ---------------------------------------------------------------------------
declare global {
  var __approvalStore: Map<string, ApprovalRequest> | undefined;
}
const store: Map<string, ApprovalRequest> =
  (global.__approvalStore ??= new Map());

/** Seed mock data if store is empty (dev convenience) */
function seedIfEmpty() {
  if (store.size > 0) return;
  const now = Date.now();
  const MOCK: ApprovalRequest[] = [
    {
      id: 'req-001',
      agentId: 'travel-booking-agent-v1',
      agentLabel: 'Travel Booking Agent',
      agentColor: '#3b82f6',
      agentVerified: true,
      sessionId: 'sess_4f8a2c1b',
      tool: 'book_flight',
      amount: 500,
      destination: 'Tokyo',
      currency: 'USD',
      scopes: ['payment:write', 'email:send'],
      dangerousScopes: ['payment:write'],
      riskLevel: 'high',
      riskReasons: [
        { label: 'Amount exceeds $300 auto-approval threshold', severity: 'critical' },
        { label: 'payment:write scope grants irreversible charge', severity: 'critical' },
        { label: 'Transaction cannot be undone once submitted', severity: 'warn' },
      ],
      denyConsequences: [
        'Flight booking will be canceled',
        'Agent receives STEPUP_DENIED response',
        'No charges will be made',
      ],
      reversible: false,
      expiresAt: new Date(now + 5 * 60 * 1000),
      createdAt: new Date(now - 2 * 60 * 1000),
      status: 'pending',
    },
    {
      id: 'req-002',
      agentId: 'fraud-detection-agent-v1',
      agentLabel: 'Fraud Detection Agent',
      agentColor: '#ef4444',
      agentVerified: true,
      sessionId: 'sess_9d1e7f3a',
      tool: 'flag_transaction',
      amount: 2000,
      currency: 'USD',
      scopes: ['transaction:flag', 'alert:write'],
      dangerousScopes: ['transaction:flag'],
      riskLevel: 'high',
      riskReasons: [
        { label: 'Flags transaction and freezes funds pending review', severity: 'critical' },
        { label: 'Creates compliance case that notifies 3 departments', severity: 'warn' },
      ],
      denyConsequences: [
        'Transaction will proceed without fraud flag',
        'Compliance case will not be opened',
        'Agent will retry with reduced scope',
      ],
      reversible: false,
      expiresAt: new Date(now + 4 * 60 * 1000),
      createdAt: new Date(now - 5 * 60 * 1000),
      status: 'approved',
      resolvedAt: new Date(now - 4 * 60 * 1000),
      resolvedBy: 'user@example.com',
    },
    {
      id: 'req-003',
      agentId: 'aml-compliance-agent-v1',
      agentLabel: 'AML Compliance Agent',
      agentColor: '#f59e0b',
      agentVerified: true,
      sessionId: 'sess_2b5c8e0d',
      tool: 'file_sar',
      amount: 15000,
      currency: 'USD',
      scopes: ['transaction:read', 'sar:write'],
      dangerousScopes: ['sar:write'],
      riskLevel: 'high',
      riskReasons: [
        { label: 'SAR filing notifies PPATK — cannot be retracted', severity: 'critical' },
        { label: '$15,000 meets mandatory SAR reporting threshold', severity: 'warn' },
        { label: 'Creates permanent regulatory record', severity: 'warn' },
      ],
      denyConsequences: [
        'SAR will not be filed with PPATK',
        'Potential regulatory non-compliance risk',
        'Agent will escalate to human compliance officer',
      ],
      reversible: false,
      expiresAt: new Date(now + 1 * 60 * 1000),
      createdAt: new Date(now - 10 * 60 * 1000),
      status: 'denied',
      resolvedAt: new Date(now - 9 * 60 * 1000),
      resolvedBy: 'user@example.com',
    },
    {
      id: 'req-004',
      agentId: 'hr-onboarding-agent-v1',
      agentLabel: 'HR Onboarding Agent',
      agentColor: '#10b981',
      agentVerified: true,
      sessionId: 'sess_7a3f1c9b',
      tool: 'get_employee_documents',
      scopes: ['employee:read', 'document:read'],
      dangerousScopes: [],
      riskLevel: 'medium',
      riskReasons: [
        { label: 'Accesses personal identity documents', severity: 'warn' },
        { label: 'Read-only — no data will be modified', severity: 'info' },
      ],
      denyConsequences: [
        'Onboarding verification cannot proceed',
        'HR agent will request manual document upload',
        'No sensitive data will be accessed',
      ],
      reversible: true,
      expiresAt: new Date(now + 8 * 60 * 1000),
      createdAt: new Date(now - 1 * 60 * 1000),
      status: 'pending',
    },
  ];
  MOCK.forEach(r => store.set(r.id, r));
}

// ---------------------------------------------------------------------------
// POST /api/approve — resolve a request
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse<ApproveResponse>> {
  seedIfEmpty();
  let body: ApprovePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, status: 'pending', error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, decision, resolvedBy = 'user@example.com', resolvedNote } = body;
  const record = store.get(id);

  if (!record) {
    return NextResponse.json({ ok: false, status: 'pending', error: 'Not found' }, { status: 404 });
  }
  if (record.status !== 'pending') {
    return NextResponse.json({ ok: false, status: record.status, error: 'Already resolved' }, { status: 409 });
  }
  if (new Date() > record.expiresAt) {
    store.set(id, { ...record, status: 'expired' });
    return NextResponse.json({ ok: false, status: 'expired', error: 'Request expired' }, { status: 410 });
  }

  const updated: ApprovalRequest = {
    ...record,
    status: decision,
    resolvedAt: new Date(),
    resolvedBy,
    resolvedNote,
  };
  store.set(id, updated);

  return NextResponse.json({ ok: true, status: decision });
}

// ---------------------------------------------------------------------------
// GET /api/approve?id=xxx — poll status (used by /ask page)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse<PollResponse | { error: string }>> {
  seedIfEmpty();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const record = store.get(id);
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Auto-expire
  if (record.status === 'pending' && new Date() > record.expiresAt) {
    store.set(id, { ...record, status: 'expired' });
    return NextResponse.json({ id, status: 'expired' });
  }

  return NextResponse.json({
    id,
    status: record.status,
    resolvedAt: record.resolvedAt?.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// GET /api/approve/list — return all requests (used by /approvals page)
// ---------------------------------------------------------------------------
// Note: in Next.js 14 you'd do this in a separate route file at
// /api/approve/list/route.ts — shown inline here for clarity.
export async function getAll(): Promise<ApprovalRequest[]> {
  seedIfEmpty();
  return Array.from(store.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}