import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { sendBienvenida } from '../../../../src/email/bienvenida';

const DAY_MS = 24 * 60 * 60 * 1000;
const normalize = (email: unknown) => String(email || '').trim().toLowerCase();

// "cortesia" = acceso gratis, no cuenta como ingreso. Si la petición no lo indica, se conserva el origen que ya tenía.
const origenFinal = (cortesia: unknown, actual: string | null | undefined) =>
  cortesia === true ? 'cortesia' : cortesia === false ? 'manual' : actual || 'manual';

// Lista de membresías, las más recientes primero. Cada una trae su día de ingreso y su última visita
// (profiles.last_seen_at, o el último inicio de sesión) para saber si ya entró a la app.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('accesos')
    .select('email, activo, vence_el, origen, created_at')
    .order('created_at', { ascending: false, nullsFirst: false });
  if (error) {
    console.error('Error listando accesos:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 });
  }

  const users = new Map<string, { id: string; last_sign_in_at: string | null }>();
  for (let page = 1; page <= 10; page++) {
    const { data: list, error: usersError } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (usersError) {
      console.error('Error leyendo usuarios para la última visita:', usersError);
      break;
    }
    for (const u of list.users) {
      if (u.email) users.set(u.email.trim().toLowerCase(), { id: u.id, last_sign_in_at: u.last_sign_in_at ?? null });
    }
    if (list.users.length < 200) break;
  }
  const { data: profs } = await supabase.from('profiles').select('id, last_seen_at');
  const seen = new Map((profs || []).map((p) => [p.id, p.last_seen_at as string | null]));

  const accesos = (data || []).map((a) => {
    const u = users.get(String(a.email).trim().toLowerCase());
    const ultima_visita = (u && seen.get(u.id)) || u?.last_sign_in_at || null;
    return { ...a, ultima_visita };
  });
  return NextResponse.json({ accesos });
}

// Da de alta o renueva (o deja indefinido con `indefinido: true`): suma `dias` desde hoy, o desde el vencimiento actual si todavía no venció
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  const dias = Number(body.dias ?? 30);
  if (!email.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });

  // Acceso indefinido: sin fecha de vencimiento
  if (body.indefinido === true) {
    const { data: indef } = await adminClient().from('accesos').select('origen').eq('email', email).maybeSingle();
    const { error } = await adminClient()
      .from('accesos')
      .upsert({ email, activo: true, vence_el: null, origen: origenFinal(body.cortesia, indef?.origen) }, { onConflict: 'email' });
    if (error) {
      console.error('Error guardando acceso indefinido:', error);
      return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!Number.isFinite(dias) || dias < 1 || dias > 3650) {
    return NextResponse.json({ error: 'Días inválidos (1 a 3650)' }, { status: 400 });
  }

  const supabase = adminClient();
  const { data: current } = await supabase.from('accesos').select('vence_el, activo, origen').eq('email', email).maybeSingle();
  const currentEnd = current?.vence_el ? new Date(current.vence_el).getTime() : 0;
  const base = Math.max(Date.now(), currentEnd);
  // Bienvenida solo si no tenía un acceso vigente (alta nueva o reactivación); una renovación no la repite
  const yaVigente = !!current?.activo && (!current.vence_el || currentEnd > Date.now());
  const venceEl = new Date(base + dias * DAY_MS).toISOString();
  const origen = origenFinal(body.cortesia, current?.origen);

  const { error } = await supabase.from('accesos').upsert(
    { email, activo: true, vence_el: venceEl, origen },
    { onConflict: 'email' }
  );
  if (error) {
    console.error('Error guardando acceso:', error);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  const correo = yaVigente ? null : await sendBienvenida({ email, dias, venceEl });
  return NextResponse.json({ ok: true, correoBienvenida: correo });
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

// Marca o desmarca un acceso como cortesía (gratis) sin tocar sus fechas
export async function PATCH(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const email = normalize(body.email);
  if (!email || typeof body.cortesia !== 'boolean') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const { error } = await adminClient()
    .from('accesos')
    .update({ origen: body.cortesia ? 'cortesia' : 'manual' })
    .eq('email', email);
  if (error) {
    console.error('Error marcando cortesía:', error);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
