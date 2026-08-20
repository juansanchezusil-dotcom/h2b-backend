export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { scrapeSeasonalJobs } from '../../../src/scrapers/seasonalJobs';
export async function GET() {
  // Ejecuta el scraper al cargar la API
  await scrapeSeasonalJobs();

  return NextResponse.json({ message: 'Scraper ejecutado' });
}