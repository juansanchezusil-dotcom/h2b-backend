import { NextResponse } from 'next/server';
import { adminClient } from '../../../src/admin/auth';
import { userHasActiveAccess } from '../../../src/auth/member';
import { pushConfigured } from '../../../src/push/webPush';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// La clave pública VAPID: la app la necesita para suscribirse. Si no hay claves, los avisos están apagados.
export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  if (!pushConfigured()) return NextResponse.json({ enabled: false }, { headers });
  return NextResponse.json({ enabled: true, publicKey: process.env.VAPID_PUBLIC_KEY }, { headers });
}

// El usuario sale del token de su sesión, nunca del cuerpo
async function sessionUser(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

// Activar avisos en este dispositivo
export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  if (!pushConfigured()) return NextResponse.json({ error: 'Los avisos no están disponibles.' }, { status: 503, headers });

  const session = await sessionUser(request);
  if (!session) return NextResponse.json({ error: 'Inicia sesión para activar los avisos.' }, { status: 401, headers });
  if (!(await userHasActiveAccess(session.supabase, session.user))) {
    return NextResponse.json({ error: 'Necesitas una membresía activa.' }, { status: 403, headers });
  }

  const body = await request.json().catch(() => ({}));
  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: 'Suscripción inválida.' }, { status: 400, headers });
  }

  // Si el mismo navegador ya estaba suscrito (otra cuenta, o llaves nuevas), queda a nombre de quien la activa ahora
  const { error } = await session.supabase.from('push_subscriptions').upsert(
    {
      user_id: session.user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('No se pudo guardar la suscripción push:', error);
    return NextResponse.json({ error: 'No pudimos activar los avisos. Intenta de nuevo.' }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}

// Apagar avisos en este dispositivo
export async function DELETE(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const session = await sessionUser(request);
  if (!session) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401, headers });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return NextResponse.json({ error: 'Falta el dispositivo.' }, { status: 400, headers });

  const { error } = await session.supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', session.user.id)
    .eq('endpoint', endpoint);
  if (error) {
    console.error('No se pudo borrar la suscripción push:', error);
    return NextResponse.json({ error: 'No pudimos apagar los avisos.' }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
