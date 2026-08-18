import { scrapeSeasonalJobs } from './seasonalJobs';

async function run() {
  try {
    console.log('🚀 Iniciando scraper de Seasonal Jobs...');
    await scrapeSeasonalJobs();
    console.log('✨ Proceso completado.');
  } catch (error) {
    console.error('❌ Error ejecutando el scraper:', error);
  }
}

run();