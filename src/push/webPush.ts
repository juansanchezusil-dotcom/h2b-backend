import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

// Lo que muestra el celular. `url` es a dónde lleva tocar el aviso (p. ej. /?tab=crm).
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string; // avisos con el mismo tag se reemplazan en vez de apilarse
}

let configured: boolean | null = null;

// Sin las claves VAPID no se envía nada (y la app no ofrece activar avisos)
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:juan@mail.juanteavisa.com', pub, priv);
  return (configured = true);
}

// Envía a todos los dispositivos de la persona. Borra las suscripciones que el navegador dio de baja (404/410).
// Devuelve cuántos dispositivos lo recibieron.
export async function sendPushToUser(supabase: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;

  let delivered = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12, urgency: 'normal' }
      );
      delivered++;
      await supabase.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id);
      } else {
        console.error(`Push rechazado para ${userId} (${status ?? 'sin código'}):`, err);
      }
    }
  }
  return delivered;
}
