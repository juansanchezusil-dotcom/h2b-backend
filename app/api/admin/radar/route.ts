import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { computeRadar, RADAR, type RadarInput } from '../../../../src/admin/radar';

export const dynamic = 'force-dynamic';

// Radar de actividad de los miembros: quién está activo, quién se enfría, quién está por vencer,
// quién cumple el Compromiso de PRO y a quién conviene escribirle. Solo para administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const supabase = adminClient();
    const now = Date.now();
    const since = new Date(now - RADAR.commitmentDays * 24 * 60 * 60 * 1000).toISOString();

    const [accesosRes, profilesRes, appsRes, eventsRes] = await Promise.all([
      supabase.from('accesos').select('email, vence_el, origen, created_at, contactado_el, nota_admin').eq('activo', true),
      supabase.from('profiles').select('id, full_name, last_seen_at, perfil_completado, base_cv_text'),
      supabase.from('applications').select('user_id, status').limit(20000),
      supabase
        .from('application_events')
        .select('user_id, company_name, from_status, to_status, created_at')
        .gte('created_at', since)
        .limit(20000),
    ]);
    for (const r of [accesosRes, profilesRes, appsRes, eventsRes]) {
      if (r.error) throw r.error;
    }

    // Correo -> usuario (y su último inicio de sesión). Los perfiles no guardan el correo.
    const users: RadarInput['users'] = new Map();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) {
        if (u.email) users.set(u.email.trim().toLowerCase(), { id: u.id, last_sign_in_at: u.last_sign_in_at ?? null });
      }
      if (data.users.length < 200) break;
    }

    const profiles: RadarInput['profiles'] = new Map();
    for (const p of profilesRes.data || []) {
      profiles.set(p.id, {
        full_name: p.full_name,
        last_seen_at: p.last_seen_at,
        perfil_completado: p.perfil_completado,
        hasCv: (p.base_cv_text || '').trim().length >= 30,
      });
    }

    const statusCounts: RadarInput['statusCounts'] = new Map();
    for (const a of appsRes.data || []) {
      if (!a.user_id) continue;
      const counts = statusCounts.get(a.user_id) || {};
      counts[a.status] = (counts[a.status] || 0) + 1;
      statusCounts.set(a.user_id, counts);
    }

    const { resumen, miembros } = computeRadar({
      accesos: accesosRes.data || [],
      users,
      profiles,
      statusCounts,
      events: eventsRes.data || [],
      now,
    });

    return NextResponse.json({ config: RADAR, resumen, miembros, generado: new Date(now).toISOString() });
  } catch (err: any) {
    console.error('Error calculando el radar:', err);
    return NextResponse.json({ error: 'No se pudo calcular el radar.' }, { status: 500 });
  }
}
