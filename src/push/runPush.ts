import type { SupabaseClient } from '@supabase/supabase-js';
import { userHasActiveAccess } from '../auth/member';
import { jobMatchesRole } from '../jobs/roleMatch';
import { weekKey } from '../email/engagement';
import { pushConfigured, sendPushToUser, type PushPayload } from './webPush';

const DAY = 24 * 60 * 60 * 1000;

// Avisos push diarios (corre dentro del cron de las 12:00 UTC, 7:00 en Perú). Solo a quien los activó en su
// celular y tiene membresía vigente. Como mucho uno de cada tipo:
// - ofertas: ofertas publicadas en las últimas 24 h que calzan con su puesto o industria (una vez al día)
// - seguimientos: postulaciones de 7 días o más sin respuesta (una vez por semana)
export interface PushSummary {
  enabled: boolean;
  users: number;
  sent: { ofertas: number; seguimientos: number };
  failed: string[];
}

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

export async function runPush(opts: { supabase: SupabaseClient; now: number }): Promise<PushSummary> {
  const { supabase, now } = opts;
  const summary: PushSummary = { enabled: pushConfigured(), users: 0, sent: { ofertas: 0, seguimientos: 0 }, failed: [] };
  if (!summary.enabled) return summary;

  const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('user_id');
  if (subsError) throw subsError;
  const userIds = [...new Set((subs || []).map((s) => s.user_id as string))];
  if (!userIds.length) return summary;

  const [profRes, jobsRes, appsRes] = await Promise.all([
    supabase.from('profiles').select('id, target_role, industry').in('id', userIds),
    supabase
      .from('jobs')
      .select('title, employer_name, created_at')
      .gte('created_at', new Date(now - DAY).toISOString())
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('applications')
      .select('user_id, company_name, created_at, reply_type')
      .in('user_id', userIds)
      .eq('status', 'seguimiento')
      .lte('created_at', new Date(now - 7 * DAY).toISOString()),
  ]);
  for (const r of [profRes, jobsRes, appsRes]) if (r.error) throw r.error;

  const profile = new Map((profRes.data || []).map((p) => [p.id as string, p]));
  const newJobs = (jobsRes.data || []).filter((j) => j.title && j.employer_name);
  const pendingByUser = new Map<string, string[]>();
  for (const a of appsRes.data || []) {
    if (a.reply_type) continue; // si el empleador ya respondió, no hay que hacer seguimiento
    const list = pendingByUser.get(a.user_id) || [];
    list.push(a.company_name || 'una empresa');
    pendingByUser.set(a.user_id, list);
  }

  // Registra antes de enviar (así un reintento del cron no repite el aviso); si no llegó a ningún dispositivo, lo deshace
  const deliver = async (userId: string, kind: 'ofertas' | 'seguimientos', key: string, payload: PushPayload) => {
    const { error: logError } = await supabase.from('push_log').insert({ user_id: userId, kind, dedupe_key: key });
    if (logError) {
      if (logError.code !== '23505') {
        console.error(`No se pudo registrar el push ${kind}, no se envía:`, logError);
        summary.failed.push(`${kind}:${userId}`);
      }
      return;
    }
    const delivered = await sendPushToUser(supabase, userId, payload).catch((err) => {
      console.error(`Falló el push ${kind} para ${userId}:`, err);
      return 0;
    });
    if (delivered > 0) {
      summary.sent[kind]++;
    } else {
      await supabase.from('push_log').delete().eq('user_id', userId).eq('kind', kind).eq('dedupe_key', key);
    }
  };

  for (const userId of userIds) {
    const { data: u } = await supabase.auth.admin.getUserById(userId);
    if (!u?.user || !(await userHasActiveAccess(supabase, u.user))) continue;
    summary.users++;

    const p = profile.get(userId);
    const role = (p?.target_role || '').trim();
    const industry = (p?.industry || '').trim();
    if (role || industry) {
      const matches = newJobs.filter((j) => jobMatchesRole(j.title as string, role, industry));
      if (matches.length) {
        const first = matches[0];
        const more = matches.length - 1;
        await deliver(userId, 'ofertas', dayKey(now), {
          title: matches.length === 1 ? '🆕 1 oferta nueva de tu puesto' : `🆕 ${matches.length} ofertas nuevas de tu puesto`,
          body: `${first.title} en ${first.employer_name}${more > 0 ? ` y ${more} más` : ''}. Postula antes que el resto.`,
          url: '/?tab=jobs',
          tag: 'ofertas',
        });
      }
    }

    const pending = pendingByUser.get(userId) || [];
    if (pending.length) {
      await deliver(userId, 'seguimientos', weekKey(now), {
        title: pending.length === 1 ? '📅 Tienes 1 seguimiento pendiente' : `📅 Tienes ${pending.length} seguimientos pendientes`,
        body: `${pending[0]}${pending.length > 1 ? ` y ${pending.length - 1} más` : ''} no ha respondido. Escríbeles para reconfirmar tu interés.`,
        url: '/?tab=crm',
        tag: 'seguimientos',
      });
    }
  }
  return summary;
}
