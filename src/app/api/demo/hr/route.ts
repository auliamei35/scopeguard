// src/app/api/demo/hr/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { runHRAgentDemo } from '@/demo/hr-agent';

export async function POST() {
  runHRAgentDemo().catch(console.error);
  return NextResponse.json({
    success: true,
    message: 'HR onboarding agent demo started — watch console for activity',
  });
}