import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { loadErrorGroups } from '../../../../src/errors/clientErrors';

export const dynamic = 'force-dynamic';

// Errores de la app en los celulares de los miembros, últimos 7 días, agrupados. Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { total, groups } = await loadErrorGroups(adminClient(), since);
    return NextResponse.json({ total, groups: groups.slice(0, 50), desde: since.toISOString() });
  } catch (err) {
    console.error('Error leyendo los errores de la app:', err);
    return NextResponse.json({ error: 'No se pudieron leer los errores.' }, { status: 500 });
  }
}
