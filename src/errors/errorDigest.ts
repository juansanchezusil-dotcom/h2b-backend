import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';
import { loadErrorGroups } from './clientErrors';

const DAY = 24 * 60 * 60 * 1000;

const escape = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

// Correo diario al administrador con los errores de la app de las últimas 24 h. Si no hubo errores, no se envía nada.
export async function runErrorDigest(opts: { supabase: SupabaseClient; resend: Resend | null; now: number }) {
  const { supabase, resend, now } = opts;
  const admin = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
  if (!admin || !resend) return { sent: false, reason: !admin ? 'Falta ADMIN_EMAILS' : 'Falta RESEND_API_KEY' };

  const { total, groups } = await loadErrorGroups(supabase, new Date(now - DAY));
  if (!total) return { sent: false, total: 0 };

  const appUrl = process.env.APP_URL || 'https://h2b-fronted.vercel.app';
  const top = groups.slice(0, 10);
  const rows = top
    .map(
      (g) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top"><b>${g.count}×</b><br><span style="color:#64748b;font-size:12px">${g.users} persona${g.users === 1 ? '' : 's'}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee"><code style="font-size:13px">${escape(g.message)}</code><br>
        <span style="color:#64748b;font-size:12px">${escape(g.kind)} · ${escape(g.url || 'sin página')}</span></td>
      </tr>`
    )
    .join('');
  const html = `<p>En las últimas 24 horas la app registró <b>${total} error${total === 1 ? '' : 'es'}</b> en ${groups.length} grupo${groups.length === 1 ? '' : 's'}.</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif">${rows}</table>
    ${groups.length > top.length ? `<p style="color:#64748b">Y ${groups.length - top.length} grupo(s) más.</p>` : ''}
    <p>El detalle (pila y navegador) está en el <a href="${appUrl}/admin">panel de administración</a>, sección "Errores de la app".</p>`;

  const { error } = await resend.emails.send({
    from: process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>',
    to: admin,
    subject: `⚠️ ${total} error${total === 1 ? '' : 'es'} en la app (últimas 24 h)`,
    html,
  });
  if (error) throw new Error(`Resend rechazó el resumen de errores: ${error.message}`);
  return { sent: true, total, groups: groups.length };
}
