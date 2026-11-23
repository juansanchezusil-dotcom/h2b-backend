export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { runUpdateJobs } from '../../../../src/cron/updateJobs';
import { withCronRun } from '../../../../src/cron/runLog';
import { adminClient } from '../../../../src/admin/auth';
import { isCronAuthorized } from '../../../../src/auth/cronAuth';
import { errMsg } from '../../../../src/utils/errors';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const r = await withCronRun(adminClient(), 'update', runUpdateJobs);
    return NextResponse.json(
      { updated: true, jobs: r.jobs, careerOneStopCount: r.careerOneStopCount, sponsorLinks: r.sponsorLinks },
      { status: 200 }
    );
  } catch (e) {
    console.error('❌ Error general en cron:', errMsg(e));
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
