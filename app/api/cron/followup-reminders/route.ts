export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { runEngagement } from '../../../../src/email/engagement';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Usamos la SERVICE_ROLE_KEY (no la anon) porque necesitamos leer el correo
  // real del usuario desde auth.users, algo que la clave pública no permite.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY!);

  // Todo el cálculo de tiempo se basa SIEMPRE en created_at (fecha real de
  // postulación), nunca en last_updated — esa columna cambia con cualquier
  // edición (una nota, un drag) y reiniciaría el conteo sin querer.
  const daysSinceApplied = (app: { created_at: string }) =>
    (Date.now() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24);

  const getUserEmail = async (userId: string) => {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  };

  let promoted7 = 0;
  let reminders14 = 0;
  let closed21 = 0;
  const failures: string[] = [];

  // ======================================================
  // PASO 1 — DÍA 21: correo final + mover a "rechazado"
  // Se procesa primero para que una postulación muy vieja
  // (ej. olvidada por semanas) no reciba también el correo
  // de día 14 en la misma corrida.
  // ======================================================
  const { data: day21Candidates, error: day21Error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'seguimiento')
    .eq('reminder_21_sent', false);

  if (day21Error) {
    console.error('Error consultando candidatos día 21:', day21Error);
  }

  for (const app of day21Candidates || []) {
    if (daysSinceApplied(app) < 21) continue;

    const email = await getUserEmail(app.user_id);
    if (!email) {
      failures.push(`día21:${app.id} sin correo`);
      continue;
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Juan Te Avisa <recordatorios@mail.juanteavisa.com>',
      to: email,
      subject: `❌ Sin respuesta de ${app.company_name} — movida a No Respondido`,
      html: `
        <p>Hola,</p>
        <p>Han pasado 21 días desde tu postulación a <strong>${app.company_name}</strong>
        (${app.job_title || 'vacante H-2B'}) sin ninguna actualización.</p>
        <p>Siguiendo el sistema, movimos esta tarjeta a <strong>"No Respondido"</strong> en tu CRM.
        Esto no significa que hayas hecho algo mal — así funciona el proceso, y lo importante
        es seguir aplicando a nuevas empresas en paralelo.</p>
        <p>Entra a tu <a href="https://h2b-fronted.vercel.app">Portal H-2B</a> para ver el detalle
        o volver a marcarla como activa si de pronto sí te responden.</p>
      `,
    });

    if (sendError) {
      console.error(`Resend rechazó el correo día 21 para ${app.id}:`, sendError);
      failures.push(`día21:${app.id} resend-error`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: 'no_respondido', reminder_21_sent: true })
      .eq('id', app.id);

    if (updateError) {
      console.error(`Correo día 21 enviado pero no se pudo actualizar ${app.id}:`, updateError);
      failures.push(`día21:${app.id} update-error`);
      continue;
    }

    closed21++;
  }

  // ======================================================
  // PASO 2 — DÍA 14: recordatorio (sin cambio de estado)
  // ======================================================
  const { data: day14Candidates, error: day14Error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'seguimiento')
    .eq('reminder_14_sent', false);

  if (day14Error) {
    console.error('Error consultando candidatos día 14:', day14Error);
  }

  for (const app of day14Candidates || []) {
    const days = daysSinceApplied(app);
    if (days < 14) continue;

    const email = await getUserEmail(app.user_id);
    if (!email) {
      failures.push(`día14:${app.id} sin correo`);
      continue;
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Juan Te Avisa <recordatorios@mail.juanteavisa.com>',
      to: email,
      subject: `⚠️ Último aviso: sigue sin respuesta de ${app.company_name}`,
      html: `
        <p>Hola,</p>
        <p>Tu postulación a <strong>${app.company_name}</strong> (${app.job_title || 'vacante H-2B'})
        lleva ${Math.floor(days)} días en seguimiento sin actualización.</p>
        <p>Este es tu último aviso — si no hay respuesta antes del día 21, la moveremos
        automáticamente a "No Respondido".</p>
        <p>Te recomendamos escribirle a la empresa una última vez para preguntar por el estado.</p>
        <p>Entra a tu <a href="https://h2b-fronted.vercel.app">Portal H-2B</a> para ver el detalle.</p>
      `,
    });

    if (sendError) {
      console.error(`Resend rechazó el correo día 14 para ${app.id}:`, sendError);
      failures.push(`día14:${app.id} resend-error`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update({ reminder_14_sent: true })
      .eq('id', app.id);

    if (updateError) {
      console.error(`Correo día 14 enviado pero no se pudo marcar ${app.id}:`, updateError);
      failures.push(`día14:${app.id} update-error`);
      continue;
    }

    reminders14++;
  }

  // ======================================================
  // PASO 3 — DÍA 7: promueve "postulado" → "seguimiento"
  // y envía el primer aviso de seguimiento
  //
  // Incluye también 'seguimiento': si la persona mueve la tarjeta a mano
  // con el botón del CRM antes de que corra el cron, la fila deja de estar
  // en 'postulado' y el filtro original nunca la volvía a encontrar — el
  // correo de día 7 se saltaba para siempre aunque reminder_7_sent
  // siguiera en false. Acotado a <14 días para no chocar con el correo de
  // día 14 (PASO 2, ya corrido) si el catch-up llega tarde.
  // ======================================================
  const { data: day7Candidates, error: day7Error } = await supabase
    .from('applications')
    .select('*')
    .in('status', ['postulado', 'seguimiento'])
    .eq('reminder_7_sent', false);

  if (day7Error) {
    console.error('Error consultando candidatos día 7:', day7Error);
  }

  for (const app of day7Candidates || []) {
    const days = daysSinceApplied(app);
    if (days < 7 || days >= 14) continue;

    const email = await getUserEmail(app.user_id);
    if (!email) {
      failures.push(`día7:${app.id} sin correo`);
      continue;
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Juan Te Avisa <recordatorios@mail.juanteavisa.com>',
      to: email,
      subject: `📅 Toca dar seguimiento a ${app.company_name}`,
      html: `
        <p>Hola,</p>
        <p>Ya pasaron 7 días desde que postulaste a <strong>${app.company_name}</strong>
        (${app.job_title || 'vacante H-2B'}) y aún no has recibido respuesta.</p>
        <p>Movimos esta tarjeta a <strong>"Seguimiento"</strong> en tu CRM. Te recomendamos
        escribirle a la empresa para preguntar por el estado de tu postulación.</p>
        <p>Entra a tu <a href="https://h2b-fronted.vercel.app">Portal H-2B</a> para ver el detalle
        y usar la plantilla de seguimiento del Kit de Inicio Rápido.</p>
      `,
    });

    if (sendError) {
      console.error(`Resend rechazó el correo día 7 para ${app.id}:`, sendError);
      failures.push(`día7:${app.id} resend-error`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: 'seguimiento', reminder_7_sent: true })
      .eq('id', app.id);

    if (updateError) {
      console.error(`Correo día 7 enviado pero no se pudo promover ${app.id}:`, updateError);
      failures.push(`día7:${app.id} update-error`);
      continue;
    }

    promoted7++;
  }

  // Correos de renovación y reenganche. Vienen apagados (ENGAGEMENT_EMAILS) y un fallo aquí nunca debe
  // afectar a los recordatorios de arriba, que ya se procesaron.
  let engagement: unknown = null;
  try {
    engagement = await runEngagement({ supabase, resend, now: Date.now(), includeDigest: true });
  } catch (err) {
    console.error('Error en los correos de renovación y reenganche:', err);
    engagement = { error: 'falló, ver los registros' };
  }

  return NextResponse.json({
    message: 'Recordatorios procesados',
    promoted7,
    reminders14,
    closed21,
    failures,
    engagement,
  });
}