import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

// Correos que dejaron su Mapa H2B público. Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { data, error } = await adminClient()
    .from('map_leads')
    .select('email, nombre, role, stage, answers, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('Error leyendo los contactos del Mapa:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 });
  }
  return NextResponse.json({ leads: data || [] });
}
