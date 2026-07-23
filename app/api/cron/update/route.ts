import { NextResponse } from 'next/server';
import { supabase } from '../../../../src/db/supabase';
import { scrapeSeasonalJobs } from '../../../../src/scrapers/seasonalJobs';
import { scrapeUSCIS } from '../../../../src/scrapers/uscisHub';
import { normalizeJob, normalizeEmployer } from '../../../../src/utils/normalize';

export async function GET() {
  try {
    const jobsRaw = await scrapeSeasonalJobs();
    const employersRaw = await scrapeUSCIS();

    const jobs = jobsRaw.map(normalizeJob);
    const employers = employersRaw.map(normalizeEmployer);

    await supabase.from('jobs').upsert(jobs, { onConflict: 'url' });
    await supabase.from('employers').upsert(employers, {
      onConflict: 'employer,state,year'
    });

    return NextResponse.json(
      { updated: true, jobs: jobs.length, employers: employers.length },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
