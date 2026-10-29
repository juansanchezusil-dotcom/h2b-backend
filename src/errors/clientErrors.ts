import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CLIENT_ERROR_KINDS = ['error', 'promesa', 'pantalla'] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];

// Huella del error: tipo + mensaje sin números (ids, líneas) + primera línea útil de la pila.
// Así el mismo fallo en distintos celulares cae en el mismo grupo.
export function fingerprintOf(kind: string, message: string, stack: string | null): string {
  const normalized = message.replace(/\d+/g, '#').slice(0, 200);
  const frame = (stack || '').split('\n').find((l) => /at |@/.test(l))?.replace(/:\d+:\d+/g, '').trim() || '';
  return createHash('sha1').update(`${kind}|${normalized}|${frame}`).digest('hex').slice(0, 16);
}

export interface ErrorGroup {
  fingerprint: string;
  kind: string;
  message: string;
  count: number;
  users: number;
  firstSeen: string;
  lastSeen: string;
  url: string | null;
  stack: string | null;
  userAgent: string | null;
}

interface ErrorRow {
  created_at: string;
  user_id: string | null;
  kind: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  fingerprint: string;
}

// Errores desde `since`, agrupados por huella y ordenados por cantidad
export async function loadErrorGroups(supabase: SupabaseClient, since: Date, limit = 2000): Promise<{ total: number; groups: ErrorGroup[] }> {
  const { data, error } = await supabase
    .from('client_errors')
    .select('created_at, user_id, kind, message, stack, url, user_agent, fingerprint')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data || []) as ErrorRow[];
  const byFp = new Map<string, ErrorGroup & { userSet: Set<string> }>();
  for (const r of rows) {
    let g = byFp.get(r.fingerprint);
    if (!g) {
      // Las filas vienen de la más reciente a la más antigua: la primera trae el ejemplo más nuevo
      g = {
        fingerprint: r.fingerprint, kind: r.kind, message: r.message, count: 0, users: 0,
        firstSeen: r.created_at, lastSeen: r.created_at, url: r.url, stack: r.stack, userAgent: r.user_agent,
        userSet: new Set(),
      };
      byFp.set(r.fingerprint, g);
    }
    g.count++;
    g.firstSeen = r.created_at;
    if (r.user_id) g.userSet.add(r.user_id);
  }
  const groups = [...byFp.values()]
    .map(({ userSet, ...g }) => ({ ...g, users: userSet.size }))
    .sort((a, b) => b.count - a.count);
  return { total: rows.length, groups };
}
