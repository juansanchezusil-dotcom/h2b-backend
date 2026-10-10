import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { renderMapaReminder } from '../../../../src/email/templates';
import { leadUnsubscribeUrl } from '../../../../src/email/unsubscribe';

const MASTERCLASS_URL = 'https://juanteavisa.com/masterclass-h2b/';
const FROM = () => process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>';
const SEND_CAP = 100; // por pulsación: si hay más, se vuelve a pulsar

// Contactos que dejaron su correo en el Mapa público. Solo administradores.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { data, error } = await adminClient()
    .from('map_leads')
    .select('email, nombre, role, stage, answers, created_at, updated_at, unsubscribed_at, reminder_sent_at, skip_reminder')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('Error leyendo los contactos del Mapa:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 });
  }
  return NextResponse.json({ leads: data || [] });
}

// { accion: 'prueba' }  -> te manda el recordatorio a ti, con datos de ejemplo
// { accion: 'enviar' }  -> lo manda a quienes aceptaron, no se dieron de baja y aún no lo recibieron
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Falta RESEND_API_KEY' }, { status: 500 });
  const resend = new Resend(apiKey);
  const replyTo = process.env.ENGAGEMENT_REPLY_TO || undefined;

  if (body.accion === 'prueba') {
    const to = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
    if (!to) return NextResponse.json({ error: 'Falta ADMIN_EMAILS' }, { status: 500 });
    const r = renderMapaReminder({ nombre: 'Ana Pérez', masterclassUrl: MASTERCLASS_URL, unsubscribeUrl: 'https://h2b-backend-three.vercel.app/api/avisos?t=ejemplo' });
    const { error } = await resend.emails.send({ from: FROM(), to, subject: '[EJEMPLO] ' + r.subject, html: r.html, text: r.text, replyTo });
    if (error) return NextResponse.json({ error: 'Resend rechazó el correo de prueba.' }, { status: 502 });
    return NextResponse.json({ ok: true, to });
  }

  if (body.accion === 'enviar') {
    // Sin ENGAGEMENT_REPLY_TO el correo pide "respóndeme" y nadie lo leería
    if (!replyTo) return NextResponse.json({ error: 'Falta ENGAGEMENT_REPLY_TO (la dirección donde lees las respuestas).' }, { status: 400 });

    const supabase = adminClient();
    const { data, error } = await supabase
      .from('map_leads')
      .select('id, email, nombre')
      .is('unsubscribed_at', null)
      .is('reminder_sent_at', null)
      .eq('skip_reminder', false)
      .limit(SEND_CAP);
    if (error) return NextResponse.json({ error: 'No se pudo leer la lista.' }, { status: 500 });

    let sent = 0;
    const failed: string[] = [];
    for (const lead of data || []) {
      const r = renderMapaReminder({ nombre: lead.nombre, masterclassUrl: MASTERCLASS_URL, unsubscribeUrl: leadUnsubscribeUrl(lead.id) });
      const url = leadUnsubscribeUrl(lead.id);
      const { error: sendError } = await resend.emails.send({
        from: FROM(),
        to: lead.email,
        subject: r.subject,
        html: r.html,
        text: r.text,
        replyTo,
        headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      if (sendError) {
        console.error('Resend rechazó el recordatorio del Mapa:', sendError);
        failed.push(lead.email);
        continue;
      }
      sent++;
      // Se registra después de enviar: si falla, lo peor es repetir uno, nunca dejar a alguien sin saber
      const { error: markError } = await supabase.from('map_leads').update({ reminder_sent_at: new Date().toISOString() }).eq('id', lead.id);
      if (markError) console.error('No se pudo marcar el recordatorio como enviado:', markError);
    }
    return NextResponse.json({ ok: true, sent, failed, restantes: (data || []).length === SEND_CAP });
  }

  // { accion: 'excluir', emails: [...] } -> esas personas no recibirán el recordatorio (ya están en la masterclass)
  // { accion: 'incluir', emails: [...] }  -> deshace la exclusión
  if (body.accion === 'excluir' || body.accion === 'incluir') {
    const emails: string[] = (Array.isArray(body.emails) ? body.emails : [])
      .map((e: unknown) => String(e || '').trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
      .slice(0, 2000);
    if (!emails.length) return NextResponse.json({ error: 'No encontramos correos válidos en lo que pegaste.' }, { status: 400 });
    const { data, error } = await adminClient()
      .from('map_leads')
      .update({ skip_reminder: body.accion === 'excluir' })
      .in('email', emails)
      .select('email');
    if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
    return NextResponse.json({ ok: true, recibidos: emails.length, coinciden: (data || []).length });
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
