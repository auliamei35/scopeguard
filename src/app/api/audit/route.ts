// src/app/api/audit/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, getAuditStats } from '@/lib/audit-log';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId') || undefined;

  return NextResponse.json({
    logs: getAuditLogs(agentId),
    stats: getAuditStats(),
  });
}