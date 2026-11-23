import 'dotenv/config';
import { runUpdateJobs } from '../src/cron/updateJobs';
import { withCronRun } from '../src/cron/runLog';
import { adminClient } from '../src/admin/auth';

// Corre a mano lo mismo que el cron /api/cron/update y deja el registro en cron_runs (job "update-manual").
// Uso: npx tsx scripts/runUpdate.ts
withCronRun(adminClient(), 'update-manual', runUpdateJobs)
  .then((r) => {
    console.log('\nRESULTADO:', JSON.stringify({ ok: r.ok, jobs: r.jobs, careerOneStopCount: r.careerOneStopCount, error: r.error }));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error('FALLÓ:', e);
    process.exit(1);
  });
