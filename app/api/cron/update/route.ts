export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { scrapeSeasonalJobs } from '../../../../src/scrapers/seasonalJobs';
import { scrapeUSCIS } from '../../../../src/scrapers/uscisHub';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Ejecutar scrapers
    const jobs = await scrapeSeasonalJobs();
    
    let employersCount = 0;
    try {
      const employersRaw = await scrapeUSCIS();
      employersCount = employersRaw ? employersRaw.length : 0;
    } catch (uscisErr: any) {
      console.warn('⚠️ Aviso en scraper USCIS:', uscisErr.message);
    }

    // 2. Devolver respuesta exitosa (200 OK)
    return NextResponse.json(
      { updated: true, jobs: jobs ? jobs.length : 0, employers: employersCount },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('❌ Error general en cron:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}