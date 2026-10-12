import { timingSafeEqual } from 'crypto';

// Los procesos programados (cron) y las tareas internas se llaman con "Authorization: Bearer <CRON_SECRET>".
// Importante: si CRON_SECRET no está definido, NADIE queda autorizado. (Comparar con `Bearer ${undefined}` dejaría
// pasar a quien mande literalmente "Bearer undefined".) La comparación es de tiempo constante.
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const sent = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
