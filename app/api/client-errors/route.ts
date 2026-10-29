import { NextResponse } from 'next/server';
import { adminClient } from '../../../src/admin/auth';
import { allowRequest } from '../../../src/auth/rateLimit';
import { CLIENT_ERROR_KINDS, fingerprintOf, type ClientErrorKind } from '../../../src/errors/clientErrors';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

const clip = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : null);

// La app manda aquí los errores que pasan en el celular o navegador de la persona.
// Abierta sin sesión (un error puede ocurrir antes de entrar), con límite por dispositivo para que nadie la llene.
export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  if (!(await allowRequest(request, 'client_errors', 30, 60 * 60))) {
    return NextResponse.json({ ok: false }, { status: 429, headers });
  }

  const body = await request.json().catch(() => null);
  const kind = (CLIENT_ERROR_KINDS as readonly string[]).includes(body?.kind) ? (body.kind as ClientErrorKind) : null;
  const message = clip(body?.message, 500);
  if (!kind || !message) return NextResponse.json({ ok: false }, { status: 400, headers });
  const stack = clip(body?.stack, 4000);

  const supabase = adminClient();
  // Si viene con sesión, se anota de quién es (para saber a cuántas personas afecta)
  let userId: string | null = null;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const { error } = await supabase.from('client_errors').insert({
    user_id: userId,
    kind,
    message,
    stack,
    url: clip(body?.url, 500),
    user_agent: clip(request.headers.get('user-agent'), 300),
    fingerprint: fingerprintOf(kind, message, stack),
  });
  if (error) {
    console.error('No se pudo guardar un error del cliente:', error.message);
    return NextResponse.json({ ok: false }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
