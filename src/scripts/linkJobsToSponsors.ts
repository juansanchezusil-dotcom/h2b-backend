import { linkJobsToSponsors } from '../sponsors/linkJobs';

// Uso:
//   npx tsx src/scripts/linkJobsToSponsors.ts                 → modo prueba, solo reporta
//   npx tsx src/scripts/linkJobsToSponsors.ts --csv salida.csv → además guarda el detalle
//   npx tsx src/scripts/linkJobsToSponsors.ts --write          → guarda el vínculo en jobs
// Correrlo con --write después de cada importación de USCIS (importSponsorCompanies.ts).

const csvIndex = process.argv.indexOf('--csv');

linkJobsToSponsors({
  write: process.argv.includes('--write'),
  csvPath: csvIndex > -1 ? process.argv[csvIndex + 1] : null,
}).catch((err) => {
  console.error('❌ Error vinculando ofertas con USCIS:', err);
  process.exit(1);
});
