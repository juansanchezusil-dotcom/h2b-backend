import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';
import { renderMapaSequence } from './templates';
import { leadUnsubscribeUrl } from './unsubscribe';

// Secuencia de correos para quienes dejaron su correo en el Mapa público, hasta la masterclass.
//   Paso 1: el recordatorio inicial (lo envía Juan a mano desde /admin).
//   Pasos 2 a 4: salen solos con el proceso diario, cada uno en su ventana de fechas.
// Está apagada por defecto: se enciende con MAPA_SECUENCIA=on en Vercel.

export const MASTERCLASS_URL = 'https://juanteavisa.com/masterclass-h2b/';
export const MAPA_URL = 'https://mapa.juanteavisa.com';

// La masterclass es el 25 de noviembre de 2026 a las 7:00 p. m. (hora de Perú). El proceso diario corre a
// las 12:00 UTC (7:00 a. m. en Perú), así que "desde el día X" significa la mañana de ese día.
const DAY = 24 * 60 * 60 * 1000;
export const SEQUENCE = [
  { step: 2, from: Date.parse('2026-11-18T00:00:00Z'), until: Date.parse('2026-11-25T00:00:00Z'), name: 'Qué vas a armar en la masterclass' },
  { step: 3, from: Date.parse('2026-11-25T00:00:00Z'), until: Date.parse('2026-11-26T00:00:00Z'), name: 'Hoy es la masterclass' },
  { step: 4, from: Date.parse('2026-11-26T00:00:00Z'), until: Date.parse('2026-11-26T00:00:00Z') + 4 * DAY, name: 'Cómo seguir después' },
] as const;

export const sequenceEnabled = () => (process.env.MAPA_SECUENCIA || 'off').trim().toLowerCase() === 'on';

// Qué paso toca hoy (null si ninguno): solo uno por corrida, y solo dentro de su ventana
export function currentStep(now: number): (typeof SEQUENCE)[number] | null {
  return SEQUENCE.find((s) => now >= s.from && now < s.until) || null;
}

interface Lead {
  id: string;
  email: string;
  nombre: string | null;
}

export interface SequenceResult {
  enabled: boolean;
  step: number | null;
  sent: number;
  failed: string[];
}

const FROM = () => process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>';

export async function runMapaSequence(opts: { supabase: SupabaseClient; resend: Resend | null; now: number }): Promise<SequenceResult> {
  const { supabase, resend, now } = opts;
  const result: SequenceResult = { enabled: sequenceEnabled(), step: null, sent: 0, failed: [] };
  if (!result.enabled) return result;

  const slot = currentStep(now);
  if (!slot) return result;
  result.step = slot.step;

  const replyTo = process.env.ENGAGEMENT_REPLY_TO;
  if (!resend || !replyTo) {
    result.failed.push('Falta RESEND_API_KEY o ENGAGEMENT_REPLY_TO');
    return result;
  }

  // Quienes no se dieron de baja, no están excluidos y aún no recibieron este paso (ni uno posterior)
  const { data, error } = await supabase
    .from('map_leads')
    .select('id, email, nombre')
    .is('unsubscribed_at', null)
    .eq('skip_reminder', false)
    .lt('sequence_step', slot.step)
    .limit(100);
  if (error) throw error;

  for (const lead of (data || []) as Lead[]) {
    const url = leadUnsubscribeUrl(lead.id);
    const mail = renderMapaSequence(slot.step, { nombre: lead.nombre, masterclassUrl: MASTERCLASS_URL, mapaUrl: MAPA_URL, unsubscribeUrl: url });
    const { error: sendError } = await resend.emails.send({
      from: FROM(),
      to: lead.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo,
      headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (sendError) {
      console.error(`Resend rechazó el paso ${slot.step} del Mapa para ${lead.email}:`, sendError);
      result.failed.push(lead.email);
      continue;
    }
    result.sent++;
    // Se registra después de enviar: si esto falla, lo peor es repetir un correo, nunca no avisar
    const { error: markError } = await supabase.from('map_leads').update({ sequence_step: slot.step }).eq('id', lead.id);
    if (markError) console.error('No se pudo registrar el paso de la secuencia:', markError);
  }
  return result;
}
