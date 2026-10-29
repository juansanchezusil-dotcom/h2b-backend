import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

export const dynamic = 'force-dynamic';

const KINDS = ['ofertas', 'seguimientos'] as const;

// Avisos push de los últimos 30 días: cuántos dispositivos los tienen activos, cuántos se enviaron y cuántos se abrieron.
// Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const supabase = adminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [subs, logs] = await Promise.all([
      supabase.from('push_subscriptions').select('user_id'),
      supabase.from('push_log').select('kind').gte('created_at', since),
    ]);
    if (subs.error) throw subs.error;
    if (logs.error) throw logs.error;

    const count = (kind: string) => (logs.data || []).filter((l) => l.kind === kind).length;
    const porTipo = KINDS.map((k) => {
      const enviados = count(k);
      const abiertos = count(`abierto:${k}`);
      return { tipo: k, enviados, abiertos, tasa: enviados ? Math.round((abiertos / enviados) * 100) : null };
    });
    return NextResponse.json({
      dispositivos: (subs.data || []).length,
      personas: new Set((subs.data || []).map((s) => s.user_id)).size,
      porTipo,
      desde: since,
    });
  } catch (err) {
    console.error('Error leyendo las métricas de avisos push:', err);
    return NextResponse.json({ error: 'No se pudieron leer las métricas.' }, { status: 500 });
  }
}
