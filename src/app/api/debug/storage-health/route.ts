/**
 * TEMPORARY public diagnostic for the screenshot storage setup.
 *
 * Returns NO secrets — only whether SUPABASE_* are configured, the host the
 * app is connected to, and whether a write to the bucket succeeds. Used to
 * debug the backfill from outside the admin session; remove once screenshots
 * are confirmed working.
 */
import { NextResponse } from 'next/server';
import { probeScreenshotStorage } from '@/lib/storage/screenshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const storage = await probeScreenshotStorage();
  return NextResponse.json({ storage }, { headers: { 'cache-control': 'no-store' } });
}
