import { Resend } from 'resend';
import { renderBienvenida } from './templates';

const FROM = () => process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

// Envía el correo de bienvenida. Nunca lanza error: si falla, el acceso ya quedó activo y se informa en el resultado.
export async function sendBienvenida(opts: { email: string; dias: number | null; venceEl: string | null }): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'Falta RESEND_API_KEY' };
  try {
    const rendered = renderBienvenida({
      email: opts.email,
      dias: opts.dias,
      venceFecha: opts.venceEl ? formatDate(opts.venceEl) : null,
      appUrl: process.env.APP_URL || 'https://app.juanteavisa.com',
    });
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM(),
      to: opts.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.ENGAGEMENT_REPLY_TO || undefined,
    });
    if (error) {
      console.error('Resend rechazó la bienvenida:', error);
      return { sent: false, reason: 'Resend rechazó el correo' };
    }
    return { sent: true };
  } catch (err) {
    console.error('Error enviando la bienvenida:', err);
    return { sent: false, reason: 'Error al enviar' };
  }
}
