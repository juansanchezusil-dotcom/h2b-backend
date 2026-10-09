import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const safeUrl = (v: unknown) => {
  const u = clip(v, 400);
  return /^https?:\/\//i.test(u) ? u : '';
};

// Ofertas de la clase: las que el administrador encuentra en vivo. Los miembros las leen directo de la base
// (solo las activas); aquí se agregan y se quitan. Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { data, error } = await adminClient()
    .from('class_offers')
    .select('id, job_title, company_name, state, url, note, active, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('Error leyendo las ofertas de la clase:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 });
  }
  return NextResponse.json({ ofertas: data || [] });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const jobTitle = clip(body.puesto, 120);
  const company = clip(body.empresa, 120);
  if (!jobTitle || !company) return NextResponse.json({ error: 'Faltan el puesto y la empresa.' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('class_offers')
    .insert({
      job_title: jobTitle,
      company_name: company,
      state: clip(body.estado, 40) || null,
      url: safeUrl(body.url) || null,
      note: clip(body.nota, 300) || null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('Error guardando la oferta de la clase:', error);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

// Quitar = desactivar: deja de verse para los miembros pero no se pierde el registro
export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const id = clip(body.id, 60);
  if (!id) return NextResponse.json({ error: 'Falta la oferta.' }, { status: 400 });

  const { error } = await adminClient().from('class_offers').update({ active: false }).eq('id', id);
  if (error) {
    console.error('Error quitando la oferta de la clase:', error);
    return NextResponse.json({ error: 'No se pudo quitar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
