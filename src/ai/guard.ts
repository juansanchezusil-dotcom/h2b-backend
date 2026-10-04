import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cuántas llamadas a IA puede hacer una persona por día (UTC), sumando los 4 asistentes.
export const DAILY_AI_LIMIT = 20;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Exige sesión de Supabase (header Authorization: Bearer <token>) y descuenta
// 1 del límite diario. Devuelve una respuesta de error si hay que cortar, o
// null si la llamada puede continuar.
export async function guardAiRequest(request: Request, headers: Record<string, string>): Promise<NextResponse | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json(
      { errorCode: 'UNAUTHENTICATED', error: 'Inicia sesión para usar los asistentes de IA.' },
      { status: 401, headers }
    );
  }

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json(
      { errorCode: 'UNAUTHENTICATED', error: 'Tu sesión expiró. Vuelve a iniciar sesión.' },
      { status: 401, headers }
    );
  }

  const { data: used, error: rpcError } = await supabase.rpc('consume_ai_usage', {
    p_user: data.user.id,
    p_limit: DAILY_AI_LIMIT,
  });
  if (rpcError) {
    // Si el contador falla (ej. migración sin aplicar) no bloqueamos a la persona: ya está autenticada.
    console.error('consume_ai_usage falló, se deja pasar la llamada:', rpcError.message);
    return null;
  }
  if (typeof used === 'number' && used > DAILY_AI_LIMIT) {
    return NextResponse.json(
      {
        errorCode: 'DAILY_LIMIT',
        error: `Llegaste al límite de ${DAILY_AI_LIMIT} usos de IA por hoy. Se reinicia mañana.`,
      },
      { status: 429, headers }
    );
  }
  return null;
}
