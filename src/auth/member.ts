import { NextResponse } from 'next/server';
import { adminClient } from '../admin/auth';

// Rutas que entregan el catálogo: solo para quien tiene sesión y un acceso activo y vigente (o es administrador).
// Devuelve una respuesta de error si no puede pasar, o null si puede continuar.
export async function requireMember(request: Request): Promise<NextResponse | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Inicia sesión para ver el catálogo.' }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email) return NextResponse.json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }, { status: 401 });

  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email)) return null;

  const { data: acceso } = await supabase.from('accesos').select('activo, vence_el').eq('email', email).maybeSingle();
  const vigente = !!acceso?.activo && (!acceso.vence_el || new Date(acceso.vence_el).getTime() > Date.now());
  if (!vigente) return NextResponse.json({ error: 'Necesitas una membresía activa para ver el catálogo.' }, { status: 403 });
  return null;
}
