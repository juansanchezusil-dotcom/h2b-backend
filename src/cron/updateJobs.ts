import { scrapeSeasonalJobs } from '../scrapers/seasonalJobs';
import { scrapeCareerOneStop } from '../scrapers/careerOneStop';
import { linkJobsToSponsors } from '../sponsors/linkJobs';
import { errMsg } from '../utils/errors';
import type { CronOutcome } from './runLog';

export interface UpdateJobsResult extends CronOutcome {
  jobs: number;
  careerOneStopCount: number;
  sponsorLinks: unknown;
}

// Actualiza las ofertas: DOL (seasonaljobs), CareerOneStop y el vínculo con el historial de USCIS.
export async function runUpdateJobs(): Promise<UpdateJobsResult> {
  const jobs = await scrapeSeasonalJobs();
  const warnings: string[] = [];
  // scrapeSeasonalJobs atrapa sus propios errores y devuelve []: cero ofertas se trata como falla.
  if (!jobs || jobs.length === 0) warnings.push('DOL devolvió 0 ofertas (descarga o lectura fallida)');

  // CareerOneStop nunca sobreescribe ni duplica una oferta del DOL (se filtra
  // por empresa+puesto contra toda la tabla); si falla, deja lo de días
  // anteriores intacto y no tumba el resto del cron.
  let careerOneStopCount = 0;
  try {
    careerOneStopCount = await scrapeCareerOneStop();
  } catch (cosErr) {
    console.error('⚠️ No se pudo scrapear CareerOneStop:', errMsg(cosErr));
    warnings.push(`CareerOneStop falló: ${errMsg(cosErr)}`);
  }

  // Un fallo aquí no debe tumbar el scraper: las ofertas ya quedaron guardadas.
  let sponsorLinks: unknown = null;
  try {
    sponsorLinks = await linkJobsToSponsors({ write: true });
  } catch (linkErr) {
    console.error('⚠️ No se pudo vincular ofertas con USCIS:', errMsg(linkErr));
    warnings.push(`Vínculo USCIS falló: ${errMsg(linkErr)}`);
  }

  const count = jobs ? jobs.length : 0;
  return {
    ok: warnings.length === 0,
    jobs: count,
    careerOneStopCount,
    sponsorLinks,
    error: warnings.length ? warnings.join(' | ') : undefined,
    details: { jobs: count, careerOneStopCount, sponsorLinks },
  };
}
