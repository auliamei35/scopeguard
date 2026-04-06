// src/app/api/approve/list/route.ts
// GET /api/approve/list — returns all approval requests sorted newest-first
// Used by /approvals page to hydrate initial state + poll for new step-ups

import { NextResponse } from 'next/server';
import { ApprovalRequest } from '@/types/approvals';

// Re-use the same in-memory store as the parent route via globalThis
declare global {
  var __approvalStore: Map<string, ApprovalRequest> | undefined;
}

function getStore(): Map<string, ApprovalRequest> {
  // If the parent route hasn't been hit yet, seed is handled there.
  // We just return whatever is in the store (may be empty on first cold start).
  return (global.__approvalStore ??= new Map());
}

export async function GET(): Promise<NextResponse> {
  const store = getStore();

  // Auto-expire any stale pending requests
  const now = new Date();
  for (const [id, req] of store.entries()) {
    if (req.status === 'pending' && now > req.expiresAt) {
      store.set(id, { ...req, status: 'expired' });
    }
  }

  const sorted = Array.from(store.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return NextResponse.json(sorted);
}