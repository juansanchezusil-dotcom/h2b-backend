import { NextResponse } from 'next/server';
import { adminClient } from '../../../src/admin/auth';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// "Borrar mi cuenta": la persona elimina sus datos por su cuenta. Solo puede borrar los suyos: el usuario sale
// del token de su sesión, nunca de lo que mande en el cuerpo.
// Se borran: sus postulaciones y su historial, su perfil (CV, borradores, pasos), el registro de correos, su uso de
// IA, su contacto del Mapa público (si dejó el mismo correo) y su cuenta de acceso. NO se toca su membresía
// (tabla accesos): esa la administras tú, y es el registro de lo que pagó.
export async function DELETE(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Inicia sesión para borrar tu cuenta.' }, { status: 401, headers });

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== 'BORRAR') {
    return NextResponse.json({ error: 'Escribe BORRAR para confirmar.' }, { status: 400, headers });
  }

  const supabase = adminClient();
  const { data, error: userError } = await supabase.auth.getUser(token);
  if (userError || !data.user) return NextResponse.json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }, { status: 401, headers });
  const userId = data.user.id;
  const email = data.user.email?.trim().toLowerCase();

  // Primero los datos propios; si algo falla, no se borra la cuenta y se puede reintentar sin perder nada más
  const steps: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ['application_events', supabase.from('application_events').delete().eq('user_id', userId)],
    ['applications', supabase.from('applications').delete().eq('user_id', userId)],
    ['email_log', supabase.from('email_log').delete().eq('user_id', userId)],
    ['ai_usage', supabase.from('ai_usage').delete().eq('user_id', userId)],
  ];
  for (const [name, op] of steps) {
    const { error } = await op;
    // Una tabla que no existe en este entorno no debe impedir el borrado
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.error(`No se pudo borrar ${name} de la cuenta:`, error);
      return NextResponse.json({ error: 'No pudimos borrar tu cuenta. Intenta de nuevo.' }, { status: 500, headers });
    }
  }

  if (email) await supabase.from('map_leads').delete().eq('email', email);

  const profile = await supabase.from('profiles').delete().eq('id', userId);
  if (profile.error) {
    console.error('No se pudo borrar el perfil de la cuenta:', profile.error);
    return NextResponse.json({ error: 'No pudimos borrar tu cuenta. Intenta de nuevo.' }, { status: 500, headers });
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('No se pudo borrar la cuenta de acceso:', authError);
    return NextResponse.json({ error: 'Borramos tus datos, pero no pudimos cerrar tu cuenta. Escríbenos para terminarlo.' }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers });
}
