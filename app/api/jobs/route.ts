export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { scrapeSeasonalJobs } from '../../../src/scrapers/seasonalJobs';
import { isCronAuthorized } from '../../../src/auth/cronAuth';

// Dispara el scraper a mano. Solo con el secreto del cron: abierto, cualquiera podía lanzarlo sin límite.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await scrapeSeasonalJobs();

  return NextResponse.json({ message: 'Scraper ejecutado' });
}