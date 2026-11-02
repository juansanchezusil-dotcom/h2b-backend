import { createHash } from 'crypto';
import { adminClient } from '../admin/auth';

// Quién llama: la primera dirección de x-forwarded-for (Vercel la pone). Se guarda solo un hash con sal.
function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'desconocida';
  const salt = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'jta';
  return createHash('sha256').update(`rl:${salt}:${ip}`).digest('hex').slice(0, 32);
}

// true si la llamada puede seguir. Si el contador falla no se bloquea a nadie (mejor dejar pasar que cerrar la página),
// salvo con failClosed: las rutas públicas que gastan dinero en IA no pueden quedar sin tope.
export async function allowRequest(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
  { failClosed = false }: { failClosed?: boolean } = {}
): Promise<boolean> {
  try {
    const { data, error } = await adminClient().rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_key: clientKey(request),
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) {
      console.error(`consume_rate_limit falló (${bucket}, failClosed=${failClosed}):`, error.message);
      return !failClosed;
    }
    return data !== false;
  } catch (err) {
    console.error(`Error en el límite de intentos (${bucket}, failClosed=${failClosed}):`, err);
    return !failClosed;
  }
}
