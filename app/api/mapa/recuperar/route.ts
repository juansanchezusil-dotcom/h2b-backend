import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '../../../../src/admin/auth';
import { allowRequest } from '../../../../src/auth/rateLimit';
import { renderMapaRecover } from '../../../../src/email/templates';
import { makeLeadAccessToken } from '../../../../src/email/unsubscribe';
import { MAPA_URL } from '../../../../src/email/mapaSequence';

// "Ya hice mi mapa": manda al correo un enlace (24 horas) para verlo de nuevo. Siempre responde lo mismo, exista
// el correo o no, para que nadie pueda averiguar quién dejó su correo. Tampoco entrega las respuestas aquí.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_GAP_MS = 10 * 60 * 1000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: Request) {
  // 5 pedidos por hora por conexión: evita usar la ruta para llenar bandejas ajenas
  if (!(await allowRequest(request, 'mapa_recuperar', 5, 3600))) {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta de nuevo en un rato.' }, { status: 429, headers });
  }
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400, headers });

  try {
    const supabase = adminClient();
    const { data: lead } = await supabase.from('map_leads').select('id, nombre, recover_sent_at').eq('email', email).maybeSingle();
    const recent = lead?.recover_sent_at && Date.now() - new Date(lead.recover_sent_at).getTime() < MIN_GAP_MS;
    const apiKey = process.env.RESEND_API_KEY;

    if (lead && !recent && apiKey) {
      const link = `${MAPA_URL}/?r=${encodeURIComponent(makeLeadAccessToken(lead.id))}`;
      const mail = renderMapaRecover({ nombre: lead.nombre, link });
      const { error } = await new Resend(apiKey).emails.send({
        from: process.env.ENGAGEMENT_FROM || 'Juan Te Avisa <juan@mail.juanteavisa.com>',
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: process.env.ENGAGEMENT_REPLY_TO || undefined,
      });
      if (error) console.error('Resend rechazó el enlace de recuperación del Mapa:', error);
      else await supabase.from('map_leads').update({ recover_sent_at: new Date().toISOString() }).eq('id', lead.id);
    }
  } catch (err) {
    console.error('Error recuperando el Mapa público:', err);
  }
  return NextResponse.json({ ok: true }, { status: 200, headers });
}
