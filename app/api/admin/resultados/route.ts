import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { loadRadarInput } from '../../../../src/admin/loadRadar';
import { computeRadar } from '../../../../src/admin/radar';
import { computeResultados } from '../../../../src/admin/resultados';

export const dynamic = 'force-dynamic';

// Tablero de resultados: el camino de los miembros y del Mapa público en números. Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const supabase = adminClient();
    const now = Date.now();
    const input = await loadRadarInput(supabase, now);
    const { miembros } = computeRadar(input);

    const userIdByEmail = new Map<string, string>();
    for (const [email, u] of input.users) userIdByEmail.set(email, u.id);

    // reply_type existe después de aplicar la migración employer_reply; sin ella se lee igual, sin esas cifras
    type AppRow = { user_id: string | null; job_title: string | null; status: string; reply_type?: string | null };
    let appsRes: { data: AppRow[] | null; error: unknown } = await supabase.from('applications').select('user_id, job_title, status, reply_type').limit(20000);
    if (appsRes.error) appsRes = await supabase.from('applications').select('user_id, job_title, status').limit(20000);
    const [leadsRes, accesosRes] = await Promise.all([
      supabase.from('map_leads').select('email, unsubscribed_at, reminder_sent_at, skip_reminder').limit(5000),
      supabase.from('accesos').select('email').limit(5000),
    ]);
    for (const r of [appsRes, leadsRes, accesosRes]) if (r.error) throw r.error;

    const resultados = computeResultados({
      miembros,
      userIdByEmail,
      statusCounts: input.statusCounts,
      applications: appsRes.data || [],
      leads: leadsRes.data || [],
      accesoEmails: new Set((accesosRes.data || []).map((a: { email: string }) => a.email.trim().toLowerCase())),
    });
    return NextResponse.json({ ...resultados, generado: new Date(now).toISOString() });
  } catch (err) {
    console.error('Error calculando los resultados:', err);
    return NextResponse.json({ error: 'No se pudieron calcular los resultados.' }, { status: 500 });
  }
}
