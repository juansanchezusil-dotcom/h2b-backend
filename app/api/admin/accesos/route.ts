import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

const DAY_MS = 24 * 60 * 60 * 1000;
const normalize = (email: unknown) => String(email || '').trim().toLowerCase();

// Lista de membresías, las que vencen antes primero
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { data, error } = await adminClient()
    .from('accesos')
    .select('email, activo, vence_el, origen')
    .order('vence_el', { ascending: true, nullsFirst: true });
  if (error) {
    console.error('Error listando accesos:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 });
  }
  return NextResponse.json({ accesos: data });
}

// Da de alta o renueva: suma `dias` desde hoy, o desde el vencimiento actual si todavía no venció
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  const dias = Number(body.dias ?? 30);
  if (!email.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  if (!Number.isFinite(dias) || dias < 1 || dias > 3650) {
    return NextResponse.json({ error: 'Días inválidos (1 a 3650)' }, { status: 400 });
  }

  const supabase = adminClient();
  const { data: current } = await supabase.from('accesos').select('vence_el').eq('email', email).maybeSingle();
  const currentEnd = current?.vence_el ? new Date(current.vence_el).getTime() : 0;
  const base = Math.max(Date.now(), currentEnd);

  const { error } = await supabase.from('accesos').upsert(
    { email, activo: true, vence_el: new Date(base + dias * DAY_MS).toISOString(), origen: 'manual' },
    { onConflict: 'email' }
  );
  if (error) {
    console.error('Error guardando acceso:', error);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Revoca de inmediato
export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  if (!email) return NextResponse.json({ error: 'Falta el correo' }, { status: 400 });

  const { error } = await adminClient().from('accesos').update({ activo: false }).eq('email', email);
  if (error) {
    console.error('Error revocando acceso:', error);
    return NextResponse.json({ error: 'No se pudo revocar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
