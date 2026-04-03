// src/app/api/demo/aml/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { runAMLAgentDemo } from '@/demo/aml-agent';

export async function POST() {
  runAMLAgentDemo().catch(console.error);
  return NextResponse.json({
    success: true,
    message: 'AML compliance agent demo started — watch console for activity',
  });
}