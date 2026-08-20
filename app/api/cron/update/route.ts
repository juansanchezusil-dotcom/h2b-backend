export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/db/supabase';
import { scrapeSeasonalJobs } from '../../../../src/scrapers/seasonalJobs';
import { scrapeUSCIS } from '../../../../src/scrapers/uscisHub';
import { normalizeJob, normalizeEmployer } from '../../../../src/utils/normalize';

export async function GET(request: Request) {
  // Validación de seguridad para Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobsRaw = await scrapeSeasonalJobs();
    const employersRaw = await scrapeUSCIS();

    const jobs = jobsRaw.map(normalizeJob);
    const employers = employersRaw.map(normalizeEmployer);

    // Subir empleadores en lotes de 200
    const employerBatchSize = 200;
    for (let i = 0; i < employers.length; i += employerBatchSize) {
      const batch = employers.slice(i, i + employerBatchSize);
      const { error } = await supabase
        .from('employers')
        .upsert(batch, { onConflict: 'employer,state,year' });

      if (error) {
        console.error(`❌ Error en lote empleadores ${i}:`, error.message);
      }
    }

    // Subir trabajos en lotes de 200 usando la restricción única del esquema
    const jobBatchSize = 200;
    for (let i = 0; i < jobs.length; i += jobBatchSize) {
      const batch = jobs.slice(i, i + jobBatchSize);
      const { error } = await supabase
        .from('jobs')
        .upsert(batch, { onConflict: 'unique_job_offer' });

      if (error) {
        console.error(`❌ Error en lote empleadores/trabajos ${i}:`, error.message);
      }
    }

    return NextResponse.json(
      { updated: true, jobs: jobs.length, employers: employers.length },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}