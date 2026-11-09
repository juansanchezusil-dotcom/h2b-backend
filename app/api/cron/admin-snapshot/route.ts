export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminClient } from '../../../../src/admin/auth';
import { loadPanelData, saveSnapshot } from '../../../../src/admin/loadPanel';
import { isCronAuthorized } from '../../../../src/auth/cronAuth';

// Deja la foto diaria del negocio (miembros, vencimientos, ingreso estimado) para las gráficas de evolución.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = adminClient();
    const data = await loadPanelData(supabase, Date.now(), 1);
    const row = await saveSnapshot(supabase, data);
    return NextResponse.json({ ok: true, day: row.day });
  } catch (err) {
    console.error('Error guardando la foto diaria:', err);
    return NextResponse.json({ error: 'No se pudo guardar la foto diaria.' }, { status: 500 });
  }
}
