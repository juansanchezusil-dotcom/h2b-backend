import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';
import { computeRadar } from '../admin/radar';
import { loadRadarInput } from '../admin/loadRadar';
import { jobMatchesRole } from '../jobs/roleMatch';
import { readMode, weekKey, type Mode } from './engagement';
import { renderJobAlert, type AlertJob } from './templates';
import { unsubscribeUrl } from './unsubscribe';

const DAY = 24 * 60 * 60 * 1000;

// Aviso semanal de ofertas nuevas del puesto de cada miembro. Usa el mismo interruptor que los demás correos de
// miembros (ENGAGEMENT_EMAILS: off / test / on) y la misma baja (profiles.email_optout).
export const JOB_ALERTS = {
  lookbackDays: 7, // ofertas publicadas en la última semana
  maxJobs: 5, // por correo
  minGapDays: 6, // entre un aviso y el siguiente
  perRunCap: 50,
  testCap: 3,
};

export interface JobAlertsSummary {
  mode: Mode;
  planned: number;
  sent: number;
  failed: string[];
  error?: string;
}

interface JobRow {
  id: string | number;
  title: string | null;
  employer_name: string | null;
  location: string | null;
  created_at: string | null;
}

const FROM = () => process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>';

export async function runJobAlerts(opts: {
  supabase: SupabaseClient;
  resend: Resend | null;
  now: number;
  modeOverride?: Mode;
  dryRun?: boolean;
}): Promise<JobAlertsSummary> {
  const { supabase, resend, now } = opts;
  const mode = opts.modeOverride ?? readMode();
  const summary: JobAlertsSummary = { mode, planned: 0, sent: 0, failed: [] };
  if (mode === 'off' && !opts.dryRun) return summary;

  const input = await loadRadarInput(supabase, now);
  const { miembros } = computeRadar(input);
  const userIdByEmail = new Map<string, string>();
  for (const [email, u] of input.users) userIdByEmail.set(email, u.id);

  // Solo quien tiene acceso vigente y cuenta en la app
  const vigentes = miembros.filter((m) => (m.diasParaVencer === null || m.diasParaVencer >= 0) && userIdByEmail.has(m.email.trim().toLowerCase()));
  if (!vigentes.length) return summary;
  const ids = vigentes.map((m) => userIdByEmail.get(m.email.trim().toLowerCase()) as string);

  const since = new Date(now - JOB_ALERTS.lookbackDays * DAY).toISOString();
  const [profRes, optRes, logRes, jobsRes] = await Promise.all([
    supabase.from('profiles').select('id, target_role, industry').in('id', ids),
    supabase.from('profiles').select('id').eq('email_optout', true),
    supabase.from('email_log').select('user_id, kind, created_at').gte('created_at', new Date(now - 2 * DAY - JOB_ALERTS.minGapDays * DAY).toISOString()),
    supabase.from('jobs').select('id, title, employer_name, location, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
  ]);
  for (const r of [profRes, optRes, logRes, jobsRes]) if (r.error) throw r.error;

  const optout = new Set((optRes.data || []).map((r) => r.id));
  const profile = new Map((profRes.data || []).map((p) => [p.id, p]));
  const logsByUser = new Map<string, { kind: string; created_at: string }[]>();
  for (const l of logRes.data || []) {
    const list = logsByUser.get(l.user_id) || [];
    list.push({ kind: l.kind, created_at: l.created_at });
    logsByUser.set(l.user_id, list);
  }
  const jobs = (jobsRes.data || []) as JobRow[];

  const planned: { userId: string; email: string; nombre: string | null; jobs: AlertJob[] }[] = [];
  for (const m of vigentes) {
    const userId = userIdByEmail.get(m.email.trim().toLowerCase()) as string;
    if (optout.has(userId)) continue;
    const p = profile.get(userId);
    const role = (p?.target_role || '').trim();
    const industry = (p?.industry || '').trim();
    if (!role && !industry) continue;

    const logs = logsByUser.get(userId) || [];
    // Un aviso de ofertas por semana, y nunca el mismo día que otro correo (renovación, reenganche, etc.)
    const lastAlert = logs.filter((l) => l.kind === 'ofertas').reduce((mx, l) => Math.max(mx, new Date(l.created_at).getTime()), 0);
    if (lastAlert && now - lastAlert < JOB_ALERTS.minGapDays * DAY) continue;
    if (logs.some((l) => now - new Date(l.created_at).getTime() < DAY)) continue;

    const matches = jobs
      .filter((j) => j.title && j.employer_name && jobMatchesRole(j.title, role, industry))
      .slice(0, JOB_ALERTS.maxJobs)
      .map((j) => ({ title: j.title as string, employer: j.employer_name as string, location: j.location || '' }));
    if (!matches.length) continue;
    planned.push({ userId, email: m.email, nombre: m.nombre, jobs: matches });
  }
  summary.planned = planned.length;
  if (opts.dryRun || mode === 'off') return summary;
  if (!resend) {
    summary.error = 'Falta RESEND_API_KEY';
    return summary;
  }
  const admin = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase();
  if (mode === 'test' && !admin) {
    summary.error = 'Falta ADMIN_EMAILS para el modo de prueba';
    return summary;
  }
  const replyTo = process.env.ENGAGEMENT_REPLY_TO;
  if (mode === 'on' && !replyTo) {
    summary.error = 'Falta ENGAGEMENT_REPLY_TO';
    return summary;
  }

  const appUrl = process.env.APP_URL || 'https://h2b-fronted.vercel.app';
  const toSend = (mode === 'test' ? planned.slice(0, JOB_ALERTS.testCap) : planned).slice(0, JOB_ALERTS.perRunCap);
  for (const p of toSend) {
    // En modo real se registra ANTES de enviar: si el registro falla no se envía, así un fallo nunca repite el aviso cada día
    if (mode === 'on') {
      const { error: logError } = await supabase.from('email_log').insert({ user_id: p.userId, kind: 'ofertas', dedupe_key: weekKey(now) });
      if (logError) {
        if (logError.code !== '23505') console.error('No se pudo registrar el aviso de ofertas, no se envía:', logError);
        summary.failed.push(p.email);
        continue;
      }
    }
    const url = unsubscribeUrl(p.userId);
    const mail = renderJobAlert({ nombre: p.nombre, jobs: p.jobs, appUrl, unsubscribeUrl: url });
    const { error } = await resend.emails.send({
      from: FROM(),
      to: mode === 'test' ? (admin as string) : p.email,
      subject: mode === 'test' ? `[PRUEBA para ${p.email}] ${mail.subject}` : mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: replyTo || undefined,
      headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (error) {
      console.error(`Resend rechazó el aviso de ofertas para ${p.email}:`, error);
      summary.failed.push(p.email);
      // Si no se envió, se deshace el registro para poder reintentar
      if (mode === 'on') await supabase.from('email_log').delete().eq('user_id', p.userId).eq('kind', 'ofertas').eq('dedupe_key', weekKey(now));
      continue;
    }
    summary.sent++;
  }
  return summary;
}
