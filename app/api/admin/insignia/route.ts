import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

const normalize = (email: unknown) => String(email || '').trim().toLowerCase();

// Marca que ya diste la insignia del Reto de 30 días a un miembro. Solo administradores.
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  if (!email.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });

  const { error } = await adminClient().from('accesos').update({ insignia_el: new Date().toISOString() }).eq('email', email);
  if (error) {
    console.error('Error marcando insignia:', error);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Deshace la marca (por si se marcó por error)
export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  if (!email) return NextResponse.json({ error: 'Falta el correo' }, { status: 400 });

  const { error } = await adminClient().from('accesos').update({ insignia_el: null }).eq('email', email);
  if (error) {
    console.error('Error quitando la insignia:', error);
    return NextResponse.json({ error: 'No se pudo deshacer.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
