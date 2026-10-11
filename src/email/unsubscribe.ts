import { createHash, createHmac, timingSafeEqual } from 'crypto';

// Dirección pública del backend, donde vive la página de baja. No pasa por el frontend a propósito:
// el frontend manda a iniciar sesión a quien no la tiene, y un enlace de baja debe abrir sin sesión.
export const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || 'https://h2b-backend-three.vercel.app';

// Clave para firmar los enlaces. Si no hay UNSUBSCRIBE_SECRET se deriva de la llave de servicio, que
// nunca sale del servidor: no hace falta configurar nada nuevo.
function secret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    createHash('sha256').update(`unsub:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`).digest('hex')
  );
}

const sign = (userId: string) => createHmac('sha256', secret()).update(userId).digest('hex').slice(0, 32);

// El enlace lleva el id de la persona y una firma: sin la firma no se puede dar de baja a otra persona.
export function makeUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

// Devuelve el id de la persona si la firma es válida; si no, null.
export function readUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  // Debe verse como un id (uuid): evita que un texto cualquiera llegue a la consulta
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}

export const unsubscribeUrl = (userId: string) => `${BACKEND_URL}/api/avisos?t=${encodeURIComponent(makeUnsubscribeToken(userId))}`;

// Contactos del Mapa público (no tienen cuenta): el identificador lleva el prefijo "l-" para distinguirlos.
export const makeLeadUnsubscribeToken = (leadId: string) => `l-${leadId}.${sign(`l-${leadId}`)}`;

export const leadUnsubscribeUrl = (leadId: string) => `${BACKEND_URL}/api/avisos?t=${encodeURIComponent(makeLeadUnsubscribeToken(leadId))}`;

// Lee cualquiera de los dos tipos de enlace: de un miembro (id de usuario) o de un contacto del Mapa.
export function readUnsubscribeSubject(token: string | null | undefined): { kind: 'user' | 'lead'; id: string } | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const subject = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(subject));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (subject.startsWith('l-')) {
    const id = subject.slice(2);
    return /^[0-9a-f-]{36}$/i.test(id) ? { kind: 'lead', id } : null;
  }
  return /^[0-9a-f-]{36}$/i.test(subject) ? { kind: 'user', id: subject } : null;
}

// Enlace para recuperar el Mapa público desde el correo: id del contacto, vencimiento y firma.
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const signAccess = (leadId: string, exp: number) => createHmac('sha256', secret()).update(`r|${leadId}|${exp}`).digest('hex').slice(0, 32);

export function makeLeadAccessToken(leadId: string, now = Date.now()): string {
  const exp = now + ACCESS_TTL_MS;
  return `${leadId}~${exp}~${signAccess(leadId, exp)}`;
}

// Devuelve el id del contacto si la firma es válida y no venció; si no, null.
export function readLeadAccessToken(token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [leadId, expRaw, sig] = token.split('~');
  const exp = Number(expRaw);
  if (!leadId || !sig || !Number.isFinite(exp) || exp < now) return null;
  const given = Buffer.from(sig);
  const expected = Buffer.from(signAccess(leadId, exp));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return /^[0-9a-f-]{36}$/i.test(leadId) ? leadId : null;
}
