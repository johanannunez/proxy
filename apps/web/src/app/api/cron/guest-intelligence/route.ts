// apps/web/src/app/api/cron/guest-intelligence/route.ts
import { NextResponse } from 'next/server';
import { runGuestIntelligenceSync } from '@/lib/admin/guest-intelligence';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runGuestIntelligenceSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[guest-intelligence] sync error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
