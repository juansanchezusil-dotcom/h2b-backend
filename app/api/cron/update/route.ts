export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/db/supabase';
import { scrapeSeasonalJobs } from '../../../../src/scrapers/seasonalJobs';
import { scrapeUSCIS } from '../../../../src/scrapers/uscisHub';
import { normalizeJob, normalizeEmployer } from '../../../../src/utils/normalize';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobsRaw = await scrapeSeasonalJobs();
    const employersRaw = await scrapeUSCIS();

    const jobs = jobsRaw.map(normalizeJob);
    const employers = employersRaw.map(normalizeEmployer);

    // Guardar empleadores
    const employerBatchSize = 200;
    for (let i = 0; i < employers.length; i += employerBatchSize) {
      const batch = employers.slice(i, i + employerBatchSize);
      await supabase
        .from('employers')
        .upsert(batch, { onConflict: 'employer,state,year' });
    }

    // Guardar trabajos ignorando duplicados si coinciden con la restricción
    console.log(`Guardando/Actualizando ${jobs.length} ofertas en Supabase...`);
    const jobBatchSize = 200;
    for (let i = 0; i < jobs.length; i += jobBatchSize) {
      const batch = jobs.slice(i, i + jobBatchSize);
      
      // Se utiliza ignoreDuplicates para evitar que la restricción detenga la ejecución
      const { error } = await supabase
        .from('jobs')
        .upsert(batch, { ignoreDuplicates: true });

      if (error) {
        console.warn(`Aviso en bloque ${i / jobBatchSize + 1}: ${error.message}`);
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