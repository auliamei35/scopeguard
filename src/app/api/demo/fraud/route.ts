// src/app/api/demo/fraud/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { runFraudAgentDemo } from '@/demo/fraud-agent';

export async function POST() {
  runFraudAgentDemo().catch(console.error);
  return NextResponse.json({
    success: true,
    message: 'Fraud agent demo started — watch console for activity',
  });
}