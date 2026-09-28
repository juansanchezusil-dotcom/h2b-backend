import { chromium } from 'playwright';
import { supabase } from '../db/supabase';

// Scrapea los resultados de búsqueda "h2b" en CareerOneStop (portal de empleo
// del DOL) y guarda las ofertas nuevas en `jobs` con source: 'CareerOneStop'.
// No hay número de caso como en el feed del DOL, así que la deduplicación es
// por empresa + puesto contra TODA la tabla `jobs` (DOL incluido): si ya
// existe, se salta — nunca sobreescribe ni duplica una oferta del DOL.
// Si el scraping falla (sitio caído, bloqueo, cambio de HTML), no lanza:
// deja las ofertas de días anteriores tal como están.

interface RawRow {
  title: string;
  href: string | null;
  companyName: string;
  locationText: string;
  dateText: string;
}

interface JobRecord {
  title: string;
  employer_name: string;
  city: string;
  state: string;
  start_date: string | null;
  link: string | null;
  visa_type: string;
  source: string;
}

const BASE_URL = 'https://www.careeronestop.org/Toolkit/Jobs/find-jobs-results.aspx';
const SEARCH_QS = 'keyword=h2b&location=United%20States&radius=25&referer=/Toolkit/Jobs/find-jobs.aspx';
// CareerOneStop bloquea con 403 al User-Agent por defecto de Chromium headless
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
// Margen de seguridad: hoy la búsqueda trae ~39 resultados (10 por página)
const MAX_PAGES = 20;

function cleanCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+d\/b\/a\s+.*/i, '')
    .replace(/\b(inc|llc|corp|co|ltd)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function isValidJobTitle(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase().trim();
  return !(
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.includes('careeronestop.org') ||
    lower.length > 150
  );
}

// "08/05/2026" -> "2026-08-05"
function parseDate(raw: string): string | null {
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [month, day, year] = parts;
  if (!month || !day || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function scrapeAllPages(): Promise<RawRow[]> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    const allRows: RawRow[] = [];
    let totalExpected = Infinity;

    for (let curPage = 1; curPage <= MAX_PAGES; curPage++) {
      const url = `${BASE_URL}?${SEARCH_QS}&curPage=${curPage}`;

      // El sitio a veces responde 5xx de forma transitoria: 2 intentos antes de rendirse
      let res = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
        if (res && res.ok()) break;
        if (attempt < 2) await page.waitForTimeout(3000);
      }
      if (!res || !res.ok()) {
        console.warn(`⚠️ CareerOneStop página ${curPage} respondió ${res?.status() ?? 'sin respuesta'}, se detiene aquí.`);
        break;
      }
      await page.waitForSelector('td[headers="thtitle"], #recordNumber', { timeout: 15000 }).catch(() => {});

      if (curPage === 1) {
        const totalText = await page.textContent('#recordNumber').catch(() => null);
        const total = totalText ? parseInt(totalText.trim(), 10) : NaN;
        if (!Number.isNaN(total)) totalExpected = total;
        console.log(`🔎 CareerOneStop reporta ${Number.isFinite(totalExpected) ? totalExpected : '?'} resultados para "h2b".`);
      }

      const rows: RawRow[] = await page.$$eval('td[headers="thtitle"]', (tds) =>
        tds.map((td) => {
          const tr = td.closest('tr');
          const a = td.querySelector('a.job-detail');
          const companyDiv = tr?.querySelector('td[headers="thCompany"] div.notranslate');
          const companyLines = (companyDiv?.textContent || '')
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s && s !== 'Federal Contractor');
          return {
            title: a?.getAttribute('title')?.trim() || a?.textContent?.trim() || '',
            href: a?.getAttribute('href') || null,
            companyName: companyLines[0] || '',
            locationText: tr?.querySelector('td[headers="thLocation"] div.notranslate')?.textContent?.trim() || '',
            dateText: tr?.querySelector('td[headers="thDatePosted"] div.notranslate')?.textContent?.trim() || '',
          };
        })
      );

      if (rows.length === 0) {
        console.log(`ℹ️ CareerOneStop página ${curPage} sin filas, se detiene aquí.`);
        break;
      }
      allRows.push(...rows);

      if (allRows.length >= totalExpected) break;
    }

    return allRows;
  } finally {
    await browser.close();
  }
}

export async function scrapeCareerOneStop(): Promise<number> {
  console.log('🚀 Scrapeando CareerOneStop (búsqueda "h2b")...');

  let rawRows: RawRow[];
  try {
    rawRows = await scrapeAllPages();
  } catch (err: any) {
    // El sitio puede bloquear el scraping, caerse, o cambiar su HTML.
    // No propaga el error: las ofertas de CareerOneStop de días anteriores
    // se quedan como están, y el cron del DOL sigue su curso.
    console.error('❌ Error scrapeando CareerOneStop:', err.message || err);
    return 0;
  }

  if (rawRows.length === 0) {
    console.log('ℹ️ CareerOneStop no devolvió resultados hoy. Se mantienen las ofertas ya guardadas.');
    return 0;
  }

  // Carga TODA la tabla (DOL + CareerOneStop) para no duplicar ni pisar una oferta del DOL
  const { data: existingJobs, error: fetchError } = await supabase.from('jobs').select('title, employer_name');
  if (fetchError) {
    console.error('❌ No se pudo leer jobs existentes, se aborta por seguridad:', fetchError.message);
    return 0;
  }
  const existingKeys = new Set(
    (existingJobs || []).map((j) => `${cleanCompanyName(j.employer_name)}|${(j.title || '').toLowerCase().trim()}`)
  );

  const newByKey = new Map<string, JobRecord>();
  for (const row of rawRows) {
    if (!isValidJobTitle(row.title) || !row.companyName) continue;

    const key = `${cleanCompanyName(row.companyName)}|${row.title.toLowerCase().trim()}`;
    if (existingKeys.has(key) || newByKey.has(key)) continue; // ya existe (DOL o CareerOneStop) o repetida en este lote

    let city = '';
    let state = '';
    if (row.locationText.includes(',')) {
      const parts = row.locationText.split(',');
      state = parts.pop()?.trim() || '';
      city = parts.join(',').trim();
    } else {
      city = row.locationText;
    }

    newByKey.set(key, {
      title: row.title,
      employer_name: row.companyName,
      city,
      state,
      start_date: row.dateText ? parseDate(row.dateText) : null,
      link: row.href ? (row.href.startsWith('http') ? row.href : `https://www.careeronestop.org${row.href}`) : null,
      visa_type: 'H-2B',
      source: 'CareerOneStop',
    });
  }

  const toInsert = Array.from(newByKey.values());
  if (toInsert.length === 0) {
    console.log('ℹ️ CareerOneStop: todas las ofertas de hoy ya estaban en la base de datos (o coinciden con el DOL).');
    return 0;
  }

  // Inserta solamente lo nuevo — no hace falta upsert porque ya se filtró contra lo existente
  const { error: insertError } = await supabase.from('jobs').insert(toInsert);
  if (insertError) {
    console.error('❌ Error guardando ofertas de CareerOneStop:', insertError.message);
    return 0;
  }

  console.log(`✅ CareerOneStop: ${toInsert.length} ofertas nuevas guardadas.`);
  return toInsert.length;
}
