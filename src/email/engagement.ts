import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';
import { computeRadar, RADAR, type Miembro } from '../admin/radar';
import { loadRadarInput } from '../admin/loadRadar';
import { renderAdminDigest, renderEmail, type DigestItem, type EmailKind, type TemplateData } from './templates';
import { unsubscribeUrl, BACKEND_URL } from './unsubscribe';

const DAY = 24 * 60 * 60 * 1000;

// Reglas para no insistir: pocas personas, pocos correos, y siempre respetando los avisos previos.
export const ENGAGEMENT = {
  reengageAfterDays: 10, // días sin entrar para el primer correo de reenganche
  reengageGapDays: 7, // entre un correo de reenganche y el siguiente
  reengageMaxUnanswered: 2, // tras 2 correos sin que la persona vuelva, se deja de escribir
  skipIfContactedReengageDays: 7, // si Juan le escribió hace poco, no se le manda correo automático
  skipIfContactedRenewalDays: 3,
  renewal7: [4, 7] as const, // ventana de días para vencer del primer aviso de renovación
  renewal3: [1, 3] as const,
  renewalAfter: [-5, -1] as const, // días después de vencer
  perRunCap: 50,
  testCap: 5,
};

export type Mode = 'off' | 'test' | 'on';

// ENGAGEMENT_EMAILS en Vercel: ausente o 'off' = apagado; 'test' = todo se manda a Juan; 'on' = a los miembros.
export function readMode(): Mode {
  const v = (process.env.ENGAGEMENT_EMAILS || 'off').trim().toLowerCase();
  return v === 'on' || v === 'test' ? v : 'off';
}

export interface PlannedEmail {
  userId: string;
  email: string;
  kind: EmailKind;
  dedupeKey: string;
  data: TemplateData;
}

export interface LogRow {
  kind: string;
  dedupe_key: string;
  created_at: string;
}

export interface PlanInput {
  miembros: Miembro[];
  userIdByEmail: Map<string, string>;
  statusCounts: Map<string, Record<string, number>>;
  optout: Set<string>; // ids de quienes pidieron no recibir avisos
  logs: Map<string, LogRow[]>; // por id de usuario
  now: number;
  appUrl: string;
  renewUrl?: string;
}

// Semana ISO ("2026-W42"): identifica "el mismo correo de reenganche" dentro de una semana
export function weekKey(now: number): string {
  const d = new Date(now);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// La fecha se escribe en hora de Colombia/Perú (UTC-5, sin horario de verano): casi todos tus alumnos
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

// Decide a quién se le escribe hoy y qué correo. Función pura: no envía nada, para poder probarla.
export function planEmails(input: PlanInput): PlannedEmail[] {
  const { now } = input;
  const planned: PlannedEmail[] = [];

  for (const m of input.miembros) {
    const userId = input.userIdByEmail.get(m.email.trim().toLowerCase());
    if (!userId || input.optout.has(userId)) continue;

    const logs = input.logs.get(userId) || [];
    const sent = (kind: EmailKind, key: string) => logs.some((l) => l.kind === kind && l.dedupe_key === key);
    const contactedDays = m.diasDesdeContacto ?? Infinity;

    const data: TemplateData = {
      nombre: m.nombre,
      diasSinEntrar: m.diasSinEntrar,
      postulaciones30: m.postulaciones30,
      meta: RADAR.goal,
      seguimientos: input.statusCounts.get(userId)?.seguimiento || 0,
      venceFecha: m.venceEl ? formatDate(m.venceEl) : null,
      diasParaVencer: m.diasParaVencer,
      renewUrl: input.renewUrl,
      appUrl: input.appUrl,
      unsubscribeUrl: unsubscribeUrl(userId),
    };

    // 1) Renovación: solo si hay fecha de vencimiento, y no si Juan ya habló con la persona hace poco
    const d = m.diasParaVencer;
    if (d !== null && m.venceEl && contactedDays >= ENGAGEMENT.skipIfContactedRenewalDays) {
      const key = m.venceEl.slice(0, 10);
      let kind: EmailKind | null = null;
      if (d >= ENGAGEMENT.renewal7[0] && d <= ENGAGEMENT.renewal7[1] && !sent('renewal_7', key)) kind = 'renewal_7';
      else if (d >= ENGAGEMENT.renewal3[0] && d <= ENGAGEMENT.renewal3[1] && !sent('renewal_3', key)) kind = 'renewal_3';
      else if (d >= ENGAGEMENT.renewalAfter[0] && d <= ENGAGEMENT.renewalAfter[1] && !sent('renewal_after', key)) kind = 'renewal_after';
      if (kind) {
        planned.push({ userId, email: m.email, kind, dedupeKey: key, data });
        continue; // un solo correo por persona y por día
      }
    }

    // 2) Reenganche: quien lleva días sin entrar, con tope para no insistir
    const expired = d !== null && d < 0;
    if (
      !expired &&
      m.diasSinEntrar !== null &&
      m.diasSinEntrar >= ENGAGEMENT.reengageAfterDays &&
      contactedDays >= ENGAGEMENT.skipIfContactedReengageDays
    ) {
      const reengages = logs.filter((l) => l.kind === 'reengage');
      const lastSentMs = reengages.reduce((max, l) => Math.max(max, new Date(l.created_at).getTime()), 0);
      const lastVisitMs = now - m.diasSinEntrar * DAY;
      const unanswered = reengages.filter((l) => new Date(l.created_at).getTime() > lastVisitMs).length;
      const gapOk = !lastSentMs || now - lastSentMs >= ENGAGEMENT.reengageGapDays * DAY;
      if (gapOk && unanswered < ENGAGEMENT.reengageMaxUnanswered) {
        planned.push({ userId, email: m.email, kind: 'reengage', dedupeKey: weekKey(now), data });
      }
    }
  }

  return planned.slice(0, ENGAGEMENT.perRunCap);
}

export interface EngagementSummary {
  mode: Mode;
  planned: { email: string; kind: EmailKind }[];
  sent: number;
  failed: string[];
  digestSent: boolean;
  // Últimos correos registrados (para mostrarlos en el panel del administrador)
  recent?: { email: string; kind: string; at: string }[];
  error?: string;
}

const adminEmail = () => (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase() || null;

const FROM = () => process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>';

const headersFor = (url: string) => ({
  'List-Unsubscribe': `<${url}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

interface RunOptions {
  supabase: SupabaseClient;
  resend: Resend | null;
  now: number;
  modeOverride?: Mode;
  dryRun?: boolean; // solo calcula a quién se le escribiría, sin enviar nada
  includeDigest?: boolean; // resumen semanal para Juan (lo pide el cron, no el botón de pruebas)
}

// Calcula y envía los correos de hoy según el modo. 'off' no envía nada, 'test' manda todo a Juan con el
// aviso de a quién iría, y 'on' escribe a los miembros y lo deja registrado para no repetir.
export async function runEngagement(opts: RunOptions): Promise<EngagementSummary> {
  const { supabase, resend, now } = opts;
  const mode = opts.modeOverride ?? readMode();
  const summary: EngagementSummary = { mode, planned: [], sent: 0, failed: [], digestSent: false };

  // Apagado y sin pedir solo la vista previa: no se consulta nada (el cron diario no hace trabajo de más)
  if (mode === 'off' && !opts.dryRun) return summary;

  const input = await loadRadarInput(supabase, now);
  const { resumen, miembros } = computeRadar(input);

  const userIdByEmail = new Map<string, string>();
  for (const [email, u] of input.users) userIdByEmail.set(email, u.id);

  const [optRes, logRes] = await Promise.all([
    supabase.from('profiles').select('id').eq('email_optout', true),
    supabase
      .from('email_log')
      .select('user_id, kind, dedupe_key, created_at')
      .gte('created_at', new Date(now - 90 * DAY).toISOString()),
  ]);
  if (optRes.error) throw optRes.error;
  if (logRes.error) throw logRes.error;

  const logs = new Map<string, LogRow[]>();
  for (const l of logRes.data || []) {
    const list = logs.get(l.user_id) || [];
    list.push({ kind: l.kind, dedupe_key: l.dedupe_key, created_at: l.created_at });
    logs.set(l.user_id, list);
  }

  const emailByUserId = new Map<string, string>();
  for (const [email, id] of userIdByEmail) emailByUserId.set(id, email);
  summary.recent = (logRes.data || [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15)
    .map((l) => ({ email: emailByUserId.get(l.user_id) || '(sin correo)', kind: l.kind, at: l.created_at }));

  const planned = planEmails({
    miembros,
    userIdByEmail,
    statusCounts: input.statusCounts,
    optout: new Set((optRes.data || []).map((r) => r.id)),
    logs,
    now,
    appUrl: process.env.APP_URL || 'https://h2b-fronted.vercel.app',
    renewUrl: process.env.NEXT_PUBLIC_MEMBERSHIP_URL || undefined,
  });
  summary.planned = planned.map((p) => ({ email: p.email, kind: p.kind }));

  if (opts.dryRun || mode === 'off') return summary;
  if (!resend) {
    summary.error = 'Falta RESEND_API_KEY';
    return summary;
  }
  const admin = adminEmail();
  if (mode === 'test' && !admin) {
    summary.error = 'Falta ADMIN_EMAILS para el modo de prueba';
    return summary;
  }
  const replyTo = process.env.ENGAGEMENT_REPLY_TO;
  // Los correos piden "responde este correo": sin una dirección que Juan lea, no se envía a miembros
  if (mode === 'on' && !replyTo) {
    summary.error = 'Falta ENGAGEMENT_REPLY_TO (la dirección donde Juan lee las respuestas)';
    return summary;
  }

  const toSend = mode === 'test' ? planned.slice(0, ENGAGEMENT.testCap) : planned;
  for (const p of toSend) {
    const rendered = renderEmail(p.kind, p.data);
    const { error: sendError } = await resend.emails.send({
      from: FROM(),
      to: mode === 'test' ? admin! : p.email,
      subject: mode === 'test' ? `[PRUEBA para ${p.email}] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: replyTo || undefined,
      headers: headersFor(p.data.unsubscribeUrl),
    });
    if (sendError) {
      console.error(`Resend rechazó el correo ${p.kind} para ${p.email}:`, sendError);
      summary.failed.push(`${p.kind}:${p.email}`);
      continue;
    }
    summary.sent++;
    if (mode === 'on') {
      // Se registra DESPUÉS de enviar: si algo falla aquí, lo peor es repetir un correo, nunca no avisar
      const { error: logError } = await supabase
        .from('email_log')
        .insert({ user_id: p.userId, kind: p.kind, dedupe_key: p.dedupeKey });
      if (logError && logError.code !== '23505') console.error('No se pudo registrar el correo enviado:', logError);
    }
  }

  // Resumen semanal para Juan: los lunes (UTC), una sola vez por semana
  if (opts.includeDigest && admin && new Date(now).getUTCDay() === 1) {
    const items: DigestItem[] = miembros
      .filter((m) => m.porContactar)
      .slice(0, 8)
      .map((m) => ({
        email: m.email,
        nombre: m.nombre,
        motivos: [
          m.prioridadRenovacion ? 'renovación urgente' : m.porVencer ? 'por vencer' : '',
          m.acelerador.candidato ? `candidato Accelerator (${m.acelerador.motivos[0] || ''})` : '',
          m.casoExito ? 'caso de éxito' : '',
          m.sinArrancar ? 'sin arrancar' : '',
          m.estado === 'en_riesgo' || m.estado === 'inactivo' || m.estado === 'nunca_entro' ? m.estado.replace('_', ' ') : '',
        ].filter(Boolean),
      }));
    const digest = renderAdminDigest(
      resumen.porContactar,
      resumen.candidatosAcelerador,
      resumen.prioridadRenovacion,
      items,
      `${process.env.APP_URL || 'https://h2b-fronted.vercel.app'}/admin`
    );
    const { error: digestError } = await resend.emails.send({
      from: FROM(),
      to: admin,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    });
    if (digestError) console.error('Resend rechazó el resumen semanal:', digestError);
    else summary.digestSent = true;
  }

  return summary;
}

// Cuatro correos de ejemplo a la dirección de Juan, con datos inventados, para aprobar los textos
// antes de encender nada. No toca a ningún miembro.
export async function sendSampleEmails(resend: Resend, to: string): Promise<{ sent: number; failed: string[] }> {
  const base: TemplateData = {
    nombre: 'Ana Pérez',
    diasSinEntrar: 12,
    postulaciones30: 7,
    meta: RADAR.goal,
    seguimientos: 2,
    venceFecha: '24 de octubre',
    diasParaVencer: 6,
    renewUrl: process.env.NEXT_PUBLIC_MEMBERSHIP_URL || undefined,
    appUrl: process.env.APP_URL || 'https://h2b-fronted.vercel.app',
    unsubscribeUrl: `${BACKEND_URL}/api/avisos?t=ejemplo`,
  };
  const samples: { kind: EmailKind; data: TemplateData; label: string }[] = [
    { kind: 'reengage', data: base, label: 'Reenganche' },
    { kind: 'renewal_7', data: base, label: 'Renovación 7 días (con buen avance)' },
    { kind: 'renewal_7', data: { ...base, postulaciones30: 1, seguimientos: 0 }, label: 'Renovación 7 días (poco avance)' },
    { kind: 'renewal_3', data: { ...base, diasParaVencer: 3 }, label: 'Renovación 3 días' },
    { kind: 'renewal_after', data: { ...base, diasParaVencer: -2 }, label: 'Después de vencer' },
  ];
  const failed: string[] = [];
  let sent = 0;
  for (const s of samples) {
    const r = renderEmail(s.kind, s.data);
    const { error } = await resend.emails.send({
      from: FROM(),
      to,
      subject: `[EJEMPLO · ${s.label}] ${r.subject}`,
      html: r.html,
      text: r.text,
      replyTo: process.env.ENGAGEMENT_REPLY_TO || undefined,
    });
    if (error) {
      console.error('Resend rechazó un correo de ejemplo:', error);
      failed.push(s.label);
    } else sent++;
  }
  return { sent, failed };
}
