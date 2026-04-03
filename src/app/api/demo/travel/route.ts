// src/app/api/demo/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { runDemoScenario } from '@/demo/travel-agent';

export async function POST() {
  try {
    // Jalankan di background — tidak block response
    runDemoScenario().catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Demo started — watch console for agent activity',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}