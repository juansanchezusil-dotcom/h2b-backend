import { writeFileSync } from 'fs';
import { supabase } from '../db/supabase';

// Empareja cada oferta (jobs) con su empresa en el historial de USCIS (sponsor_companies).
//
// No existe un identificador común: las ofertas abiertas son casos nuevos de la próxima
// temporada y el historial de USCIS solo trae peticiones ya aprobadas. Por eso se empareja
// por NOMBRE + ESTADO, y solo se acepta cuando no hay dudas.
//
// Lo llaman el cron diario (después del scraper) y src/scripts/linkJobsToSponsors.ts.

export type Confidence = 'exacta' | 'probable' | 'ambigua' | 'otro_estado' | 'sin_historial';

// "otro_estado" también se muestra, con la aclaración "Historial de la empresa en otros estados"
const VISIBLE = new Set<Confidence>(['exacta', 'probable', 'otro_estado']);

interface Sponsor {
  id: number;
  employer_name: string;
  state: string | null;
  worksite_states: string | null;
  consular_processed: string | null;
  total_approved: number | null;
  cap_type: string | null;
}

interface Job {
  id: number;
  employer_name: string | null;
  state: string | null;
  location: string | null;
}

// USCIS corta los nombres largos (ej. "VALLEY LANDSCAPING INC-CHRISTIANSB")
const USCIS_NAME_LIMIT = 33;
const MIN_KEY_LENGTH = 4;

const SUFFIXES = new Set([
  'LLC', 'L L C', 'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY',
  'LTD', 'LIMITED', 'LP', 'LLP', 'PLLC', 'PC', 'THE',
]);

// Mayúsculas, sin puntuación, espacios simples
const clean = (name: string) =>
  name
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[.,'’"()]/g, '')
    .replace(/[-/–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Abreviaturas que USCIS usa para que el nombre quepa
const ABBREVIATIONS: Record<string, string> = {
  MGMT: 'MANAGEMENT', SVCS: 'SERVICES', SVC: 'SERVICE', ASSN: 'ASSOCIATION',
  ASSOC: 'ASSOCIATION', INTL: 'INTERNATIONAL', ENTMT: 'ENTERTAINMENT', CTR: 'CENTER',
};

const US_STATE_CODES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI'.split(' ')
);

// Además quita las formas jurídicas (LLC, INC...), que se escriben de mil maneras,
// y un código de estado al final ("THE MUNIE COMPANY KS" / "The Munie Company - IL")
const key = (name: string) => {
  const words = clean(name)
    .split(' ')
    .map((w) => ABBREVIATIONS[w] || w)
    .filter((w) => !SUFFIXES.has(w));
  if (words.length > 1 && US_STATE_CODES.has(words[words.length - 1])) words.pop();
  return words.join(' ');
};

// "X DBA Y" → ["X DBA Y", "X", "Y"]: la oferta puede usar cualquiera de los dos nombres
// También cubre el "DBA" cortado al final por USCIS ("… LLC D/B/"), que deja una sola parte
const nameVariants = (name: string) => {
  const parts = name.split(/\s+(?:DBA|D\/B\/A|D\/B\/?|D B A)(?:\s+|$)/i).map((p) => p.trim()).filter(Boolean);
  return [name, ...parts.filter((p) => p !== name.trim())];
};

const jobState = (job: Job) => {
  if (job.state && /^[A-Z]{2}$/i.test(job.state.trim())) return job.state.trim().toUpperCase();
  const match = job.location?.match(/,\s*([A-Z]{2})\b/i);
  return match ? match[1].toUpperCase() : null;
};

const sponsorStates = (s: Sponsor) =>
  new Set(
    [s.state, ...(s.worksite_states || '').split(/[,;]/)]
      .map((x) => (x || '').trim().toUpperCase())
      .filter(Boolean)
  );

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  // PostgREST corta en 1000 filas: hay que paginar
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export function matchJob(job: Job, byKey: Map<string, Sponsor[]>, truncated: Sponsor[]) {
  if (!job.employer_name) return { confidence: 'sin_historial' as Confidence, sponsor: null };
  const state = jobState(job);
  const jobKeys = nameVariants(job.employer_name).map(key).filter((k) => k.length >= MIN_KEY_LENGTH);

  // 1) Mismo nombre (sin formas jurídicas), en cualquiera de sus variantes
  let candidates = new Map<number, Sponsor>();
  for (const k of jobKeys) for (const s of byKey.get(k) || []) candidates.set(s.id, s);
  let method: 'nombre' | 'nombre_cortado' = 'nombre';

  // 2) Si no hay, nombre cortado por USCIS: la oferta empieza igual que el nombre truncado
  if (candidates.size === 0) {
    const jobClean = clean(job.employer_name);
    for (const s of truncated) {
      const prefix = clean(s.employer_name);
      if (prefix.length >= 15 && jobClean.startsWith(prefix)) candidates.set(s.id, s);
    }
    method = 'nombre_cortado';
  }

  if (candidates.size === 0) return { confidence: 'sin_historial' as Confidence, sponsor: null };

  // El estado de la oferta tiene que estar entre los estados donde la empresa usó visas
  const inState = [...candidates.values()].filter((s) => state && sponsorStates(s).has(state));
  if (inState.length === 0) {
    // Solo si es una única empresa: con dos homónimas en otros estados no sabemos cuál es
    return candidates.size === 1
      ? { confidence: 'otro_estado' as Confidence, sponsor: [...candidates.values()][0] }
      : { confidence: 'ambigua' as Confidence, sponsor: null };
  }
  if (inState.length > 1) return { confidence: 'ambigua' as Confidence, sponsor: inState[0] };

  return {
    confidence: (method === 'nombre' ? 'exacta' : 'probable') as Confidence,
    sponsor: inState[0],
  };
}

interface LinkOptions {
  write?: boolean; // false = solo reporta (modo prueba)
  csvPath?: string | null;
}

export async function linkJobsToSponsors({ write = false, csvPath = null }: LinkOptions = {}) {
  console.log('📥 Leyendo ofertas e historial de USCIS...');
  const [jobs, sponsors] = await Promise.all([
    fetchAll<Job>('jobs', 'id, employer_name, state, location'),
    fetchAll<Sponsor>('sponsor_companies', 'id, employer_name, state, worksite_states, consular_processed, total_approved, cap_type'),
  ]);

  const byKey = new Map<string, Sponsor[]>();
  for (const s of sponsors) {
    for (const v of nameVariants(s.employer_name)) {
      const k = key(v);
      if (k.length < MIN_KEY_LENGTH) continue;
      if (!byKey.has(k)) byKey.set(k, []);
      if (!byKey.get(k)!.some((x) => x.id === s.id)) byKey.get(k)!.push(s);
    }
  }
  const truncated = sponsors.filter((s) => s.employer_name.length >= USCIS_NAME_LIMIT);

  const results = jobs.map((job) => ({ job, ...matchJob(job, byKey, truncated) }));

  const counts: Record<Confidence, number> = { exacta: 0, probable: 0, ambigua: 0, otro_estado: 0, sin_historial: 0 };
  for (const r of results) counts[r.confidence]++;

  console.log(`\n📊 ${jobs.length} ofertas contra ${sponsors.length} empresas de USCIS`);
  for (const [c, n] of Object.entries(counts)) {
    console.log(`   ${c.padEnd(14)} ${String(n).padStart(5)}  (${((n / jobs.length) * 100).toFixed(1)}%)`);
  }
  const shown = counts.exacta + counts.probable + counts.otro_estado;
  console.log(`   → con historial visible: ${shown} ofertas (${((shown / jobs.length) * 100).toFixed(1)}%)`);

  if (csvPath) {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['confianza,oferta_empresa,oferta_estado,uscis_empresa,uscis_estados,consular,visas_aprobadas,cupo'];
    for (const r of results) {
      lines.push([
        r.confidence, r.job.employer_name, jobState(r.job),
        r.sponsor?.employer_name, r.sponsor ? [...sponsorStates(r.sponsor)].join(' ') : '',
        r.sponsor?.consular_processed, r.sponsor?.total_approved, r.sponsor?.cap_type,
      ].map(esc).join(','));
    }
    writeFileSync(csvPath, '﻿' + lines.join('\n'), 'utf8');
    console.log(`\n📝 Detalle completo en ${csvPath}`);
  }

  if (write) {
    // Agrupa por (empresa, confianza) para actualizar muchas ofertas en una sola llamada
    const groups = new Map<string, { sponsorId: number | null; confidence: Confidence; jobIds: number[] }>();
    for (const r of results) {
      // Solo se guarda el vínculo cuando se va a mostrar; ambigua/sin_historial quedan sin empresa
      const sponsorId = VISIBLE.has(r.confidence) ? r.sponsor!.id : null;
      const k = `${sponsorId}|${r.confidence}`;
      if (!groups.has(k)) groups.set(k, { sponsorId, confidence: r.confidence, jobIds: [] });
      groups.get(k)!.jobIds.push(r.job.id);
    }

    let updated = 0;
    for (const g of groups.values()) {
      for (let i = 0; i < g.jobIds.length; i += 500) {
        const ids = g.jobIds.slice(i, i + 500);
        const { error } = await supabase
          .from('jobs')
          .update({ sponsor_company_id: g.sponsorId, sponsor_match: g.confidence })
          .in('id', ids);
        if (error) throw error;
        updated += ids.length;
      }
    }
    console.log(`💾 ${updated} ofertas actualizadas con su historial de USCIS`);
  }

  return counts;
}
