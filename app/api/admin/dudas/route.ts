import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

export const dynamic = 'force-dynamic';

// Preguntas que los miembros le hicieron al asistente, sin datos de la persona. Solo administradores.
// ?derivadas=1 deja solo las que el asistente mandó a Juan.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const soloDerivadas = new URL(request.url).searchParams.get('derivadas') === '1';
  try {
    let q = adminClient()
      .from('asistente_preguntas')
      .select('id, created_at, pregunta, respuesta, deriva, pantalla')
      .order('created_at', { ascending: false })
      .limit(100);
    if (soloDerivadas) q = q.eq('deriva', true);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ preguntas: data || [], retencionDias: 90 });
  } catch (err) {
    console.error('Error leyendo las dudas del asistente:', err);
    return NextResponse.json({ error: 'No se pudieron cargar las dudas.' }, { status: 500 });
  }
}
