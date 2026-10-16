import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { adminClient } from '../admin/auth';

// ¿Esta cuenta puede usar el servicio? Administrador, o acceso activo y vigente en la tabla accesos.
// El correo debe estar confirmado: la membresía se busca por correo, y sin confirmar cualquiera podría registrarse
// con el correo de un miembro.
export async function userHasActiveAccess(supabase: SupabaseClient, user: User): Promise<boolean> {
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.email_confirmed_at) return false;

  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email)) return true;

  const { data: acceso } = await supabase.from('accesos').select('activo, vence_el').eq('email', email).maybeSingle();
  return !!acceso?.activo && (!acceso.vence_el || new Date(acceso.vence_el).getTime() > Date.now());
}

// Rutas que entregan el catálogo: solo para quien tiene sesión y un acceso activo y vigente (o es administrador).
// Devuelve una respuesta de error si no puede pasar, o null si puede continuar.
export async function requireMember(request: Request): Promise<NextResponse | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Inicia sesión para ver el catálogo.' }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return NextResponse.json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }, { status: 401 });

  if (!(await userHasActiveAccess(supabase, data.user))) {
    return NextResponse.json({ error: 'Necesitas una membresía activa para ver el catálogo.' }, { status: 403 });
  }
  return null;
}
