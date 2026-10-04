import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Correos con permiso de administrador, separados por coma en ADMIN_EMAILS (Vercel).
// Si la variable no existe, nadie es administrador.
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Devuelve una respuesta de error si quien llama no es administrador, o null si puede continuar.
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await adminClient().auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase();
  if (error || !email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!adminEmails().includes(email)) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
  return null;
}
