export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { scrapeSeasonalJobs } from '../../../src/services/seasonalJobs'; // Ajusta la ruta si es necesario

export async function GET() {
  // Ejecuta el scraper al cargar la API
  await scrapeSeasonalJobs();

  return NextResponse.json({ message: 'Scraper ejecutado' });
}