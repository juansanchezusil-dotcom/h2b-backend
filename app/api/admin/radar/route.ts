import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { loadRadarInput } from '../../../../src/admin/loadRadar';
import { computeRadar, RADAR } from '../../../../src/admin/radar';

export const dynamic = 'force-dynamic';

// Radar de actividad de los miembros: quién está activo, quién se enfría, quién está por vencer,
// quién cumple el Compromiso de PRO y a quién conviene escribirle. Solo para administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const now = Date.now();
    const input = await loadRadarInput(adminClient(), now);
    const { resumen, miembros } = computeRadar(input);
    return NextResponse.json({ config: RADAR, resumen, miembros, generado: new Date(now).toISOString() });
  } catch (err: any) {
    console.error('Error calculando el radar:', err);
    return NextResponse.json({ error: 'No se pudo calcular el radar.' }, { status: 500 });
  }
}
