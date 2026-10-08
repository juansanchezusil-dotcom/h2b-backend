import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

const normalize = (email: unknown) => String(email || '').trim().toLowerCase();

// Marca que ya le escribiste a un miembro (con una nota opcional), para que el radar no te lo vuelva a
// pedir durante unos días. Solo administradores.
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  if (!email.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 500) : '';

  const { error } = await adminClient()
    .from('accesos')
    .update({ contactado_el: new Date().toISOString(), nota_admin: nota || null })
    .eq('email', email);
  if (error) {
    console.error('Error marcando contacto:', error);
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

  const { error } = await adminClient().from('accesos').update({ contactado_el: null, nota_admin: null }).eq('email', email);
  if (error) {
    console.error('Error quitando la marca de contacto:', error);
    return NextResponse.json({ error: 'No se pudo deshacer.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
