import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { ENGAGEMENT, readMode, runEngagement, sendSampleEmails } from '../../../../src/email/engagement';

export const dynamic = 'force-dynamic';

// Estado de los correos automáticos para el administrador: en qué modo están, a quién se le escribiría
// hoy y qué se envió últimamente. Solo lectura: no envía nada.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const summary = await runEngagement({ supabase: adminClient(), resend: null, now: Date.now(), dryRun: true });
    return NextResponse.json({
      mode: readMode(),
      replyToConfigured: !!process.env.ENGAGEMENT_REPLY_TO,
      renewalLinkConfigured: !!process.env.NEXT_PUBLIC_MEMBERSHIP_URL,
      planned: summary.planned,
      recent: summary.recent ?? [],
      rules: ENGAGEMENT,
    });
  } catch (err: any) {
    console.error('Error leyendo el estado de los correos:', err);
    return NextResponse.json({ error: 'No se pudo cargar el estado de los correos.' }, { status: 500 });
  }
}

// "muestras": envía 5 correos de ejemplo, con datos inventados, SOLO al correo del administrador, para
// aprobar los textos antes de encender nada.
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  if (body.accion !== 'muestras') return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });

  const admin = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim().toLowerCase();
  if (!admin || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Falta ADMIN_EMAILS o RESEND_API_KEY.' }, { status: 500 });
  }

  try {
    const result = await sendSampleEmails(new Resend(process.env.RESEND_API_KEY), admin);
    return NextResponse.json({ ...result, to: admin });
  } catch (err: any) {
    console.error('Error enviando los correos de ejemplo:', err);
    return NextResponse.json({ error: 'No se pudieron enviar los ejemplos.' }, { status: 500 });
  }
}
