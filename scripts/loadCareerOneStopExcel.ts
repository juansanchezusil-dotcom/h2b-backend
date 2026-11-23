// Carga manual semanal de CareerOneStop (el cron recibe 403 de Cloudflare).
// Uso: npx tsx scripts/loadCareerOneStopExcel.ts [ruta.xlsx] [--write]
// Sin --write solo muestra cuántas ofertas entrarían. Con --write las inserta.
// El Excel (JobFinderResults.xlsx) no trae enlaces: las filas quedan con link = null.
import 'dotenv/config';
import * as XLSX from 'xlsx';
import { supabase } from '../src/db/supabase';

const clean = (n: string) =>
  (n || '').toLowerCase().replace(/\s+d\/b\/a\s+.*/i, '').replace(/\b(inc|llc|corp|co|ltd)\b/gi, '').replace(/[^a-z0-9]/gi, '').trim();
const dec = (s: unknown) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const parseDate = (r: unknown) => {
  const p = String(r || '').trim().split('/');
  return p.length === 3 ? `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}` : null;
};

(async () => {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const file = args.find((a) => !a.startsWith('--')) || `${process.env.USERPROFILE}/Downloads/JobFinderResults.xlsx`;
  const wb = XLSX.readFile(file);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['Results'], { header: 1 });

  const { data: jobs, error: readErr } = await supabase.from('jobs').select('title, employer_name');
  if (readErr) throw new Error(readErr.message);
  const keys = new Set((jobs || []).map((j) => `${clean(j.employer_name)}|${(j.title || '').toLowerCase().trim()}`));

  const out = new Map<string, Record<string, unknown>>();
  let total = 0;
  for (const r of rows.slice(3)) {
    if (!r[0] || !r[1]) continue;
    total++;
    const title = dec(r[0]).trim();
    const company = dec(r[1]).trim();
    const k = `${clean(company)}|${title.toLowerCase()}`;
    if (keys.has(k) || out.has(k) || title.length > 150) continue;
    const loc = String(r[2] || '');
    let city = loc;
    let state = '';
    if (loc.includes(',')) {
      const p = loc.split(',');
      state = (p.pop() || '').trim();
      city = p.join(',').trim();
    }
    out.set(k, { title, employer_name: company, city, state, start_date: parseDate(r[3]), link: null, visa_type: 'H-2B', source: 'CareerOneStop' });
  }

  const list = [...out.values()];
  console.log(`Excel: ${total} filas. Nuevas (no están en la base): ${list.length}.`);
  if (!write) return console.log('Simulación: nada se guardó. Agrega --write para insertar.');
  if (list.length === 0) return;
  const { error } = await supabase.from('jobs').insert(list);
  console.log(error ? `ERROR ${error.message}` : `Insertadas ${list.length}.`);
})();
