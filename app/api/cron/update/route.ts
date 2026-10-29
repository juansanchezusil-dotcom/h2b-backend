export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { scrapeSeasonalJobs } from '../../../../src/scrapers/seasonalJobs';
import { scrapeCareerOneStop } from '../../../../src/scrapers/careerOneStop';
import { linkJobsToSponsors } from '../../../../src/sponsors/linkJobs';
import { isCronAuthorized } from '../../../../src/auth/cronAuth';
import { errMsg } from '../../../../src/utils/errors';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Ejecutar scrapers
    const jobs = await scrapeSeasonalJobs();

    // CareerOneStop nunca sobreescribe ni duplica una oferta del DOL (se filtra
    // por empresa+puesto contra toda la tabla); si falla, deja lo de días
    // anteriores intacto y no tumba el resto del cron.
    let careerOneStopCount = 0;
    try {
      careerOneStopCount = await scrapeCareerOneStop();
    } catch (cosErr: any) {
      console.error('⚠️ No se pudo scrapear CareerOneStop:', cosErr.message);
    }

    // Vincula las ofertas (nuevas y viejas) con el historial de su empresa en USCIS.
    // Un fallo aquí no debe tumbar el scraper: las ofertas ya quedaron guardadas.
    let sponsorLinks = null;
    try {
      sponsorLinks = await linkJobsToSponsors({ write: true });
    } catch (linkErr: any) {
      console.error('⚠️ No se pudo vincular ofertas con USCIS:', linkErr.message);
    }

    // 2. Devolver respuesta exitosa (200 OK)
    return NextResponse.json(
      { updated: true, jobs: jobs ? jobs.length : 0, careerOneStopCount, sponsorLinks },
      { status: 200 }
    );
  } catch (e) {
    console.error('❌ Error general en cron:', errMsg(e));
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}