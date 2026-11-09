import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRadarInput } from './loadRadar';
import { computeRadar } from './radar';
import { snapshotRow, type PanelData } from './panel';

const DAY = 24 * 60 * 60 * 1000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Lee de la base lo que necesita el panel. Reutiliza loadRadarInput y computeRadar: el panel y el radar
// deciden con exactamente los mismos datos.
export async function loadPanelData(supabase: SupabaseClient, now: number, dias: number): Promise<PanelData> {
  const radar = await loadRadarInput(supabase, now);
  const { miembros } = computeRadar(radar);
  const span = Math.min(Math.max(dias, 1), 180) * 2 * DAY;
  const since = new Date(now - span).toISOString();
  const sinceDay = ymd(now - span);

  type AppRow = PanelData['apps'][number];
  let appsRes: { data: AppRow[] | null; error: unknown } = await supabase
    .from('applications')
    .select('user_id, job_title, status, reply_type, created_at')
    .limit(20000);
  // reply_type existe después de la migración employer_reply; sin ella se lee igual, sin esas cifras
  if (appsRes.error) {
    const r = await supabase.from('applications').select('user_id, job_title, status, created_at').limit(20000);
    appsRes = { data: (r.data || []).map((a) => ({ ...a, reply_type: null })) as AppRow[], error: r.error };
  }

  const [eventsRes, accesosRes, leadsRes, aiRes, aiUserRes, usageRes, errRes, snapRes, profRes] = await Promise.all([
    supabase.from('application_events').select('user_id, company_name, from_status, to_status, created_at').gte('created_at', since).limit(20000),
    supabase.from('accesos').select('email, created_at, activo, vence_el').limit(5000),
    supabase.from('map_leads').select('created_at').limit(5000),
    supabase.from('ai_cost_daily').select('day, model, calls, input_tokens, output_tokens').limit(20000),
    supabase.from('ai_cost_user_daily').select('day, user_id, feature, model, calls, input_tokens, output_tokens').gte('day', sinceDay).limit(20000),
    supabase.from('ai_usage').select('bucket, count').eq('day', ymd(now)).limit(5000),
    supabase.from('client_errors').select('created_at, kind').gte('created_at', since).limit(5000),
    supabase.from('admin_snapshots').select('*').gte('day', sinceDay).order('day', { ascending: true }),
    supabase.from('profiles').select('id, pais_origen').limit(5000),
  ]);
  for (const r of [appsRes, eventsRes, accesosRes, leadsRes, aiRes, aiUserRes, usageRes, errRes, snapRes, profRes]) {
    if (r.error) throw r.error;
  }

  const paisByUser = new Map<string, string | null>();
  for (const p of profRes.data || []) paisByUser.set(p.id, p.pais_origen ?? null);

  return {
    now,
    radar,
    miembros,
    paisByUser,
    events: eventsRes.data || [],
    apps: appsRes.data || [],
    accesos: accesosRes.data || [],
    leads: leadsRes.data || [],
    aiCost: aiRes.data || [],
    aiUser: aiUserRes.data || [],
    aiUsageToday: usageRes.data || [],
    errors: errRes.data || [],
    snapshots: (snapRes.data || []).map((s) => ({ ...s, ingreso_estimado: Number(s.ingreso_estimado) })),
  };
}

// Guarda (o actualiza) la foto de hoy. Una por día: las gráficas de evolución salen de aquí.
export async function saveSnapshot(supabase: SupabaseClient, data: PanelData) {
  const row = snapshotRow(data);
  const { error } = await supabase.from('admin_snapshots').upsert(row, { onConflict: 'day' });
  if (error) throw error;
  return row;
}
