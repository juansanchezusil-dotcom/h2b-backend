import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { loadRadarInput } from '../../../../src/admin/loadRadar';
import { computeRadar } from '../../../../src/admin/radar';
import { correosPorMiembro } from '../../../../src/admin/correosPorMiembro';

export const dynamic = 'force-dynamic';

// Historial de correos automáticos por miembro: qué se le envió, cuándo, y si volvió a entrar después.
// Solo lectura y solo administradores. Los correos y nombres salen enmascarados salvo con mostrar=1.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const now = Date.now();
    const supabase = adminClient();
    const input = await loadRadarInput(supabase, now);
    const { miembros } = computeRadar(input);
    const userIdByEmail = new Map<string, string>();
    for (const [email, u] of input.users) userIdByEmail.set(email, u.id);

    const [logRes, optRes] = await Promise.all([
      supabase.from('email_log').select('user_id, kind, created_at').gte('created_at', new Date(now - 180 * 86400000).toISOString()).limit(5000),
      supabase.from('profiles').select('id').eq('email_optout', true),
    ]);
    if (logRes.error) throw logRes.error;
    if (optRes.error) throw optRes.error;

    const mostrar = new URL(request.url).searchParams.get('mostrar') === '1';
    const rows = correosPorMiembro(miembros, userIdByEmail, logRes.data || [], new Set((optRes.data || []).map((r) => r.id)), now, mostrar);
    return NextResponse.json({ miembros: rows, generado: new Date(now).toISOString() });
  } catch (err) {
    console.error('Error leyendo los correos por miembro:', err);
    return NextResponse.json({ error: 'No se pudo cargar el historial de correos.' }, { status: 500 });
  }
}
