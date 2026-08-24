import dotenv from 'dotenv';
dotenv.config();

// Se agrega la extensión .js al final de la ruta para compatibilidad con ES Modules
import { scrapeSeasonalJobs } from './scrapers/seasonalJobs.js';

async function runTest() {
  console.log('🚀 Iniciando sincronización manual de Seasonal Jobs...');
  try {
    const result = await scrapeSeasonalJobs();
    console.log('✅ Resultado:', result);
  } catch (error) {
    console.error('❌ Error ejecutando el scraper:', error);
  }
}

runTest();