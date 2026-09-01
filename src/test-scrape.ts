import { scrapeSeasonalJobs } from './scrapers/seasonalJobs';

async function test() {
  console.log('Iniciando scraper de prueba...');
  const result = await scrapeSeasonalJobs();
  console.log(`Proceso terminado. Registros retornados: ${result.length}`);
}

test();