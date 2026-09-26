import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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

  const { data: stalled, error } = await supabase
    .from('applications')
    .select('*')
    .eq('status', 'seguimiento');

  if (error) {
    console.error('Error consultando applications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  let remindersSent = 0;

  for (const app of stalled || []) {
    const daysSince = (now - new Date(app.last_updated).getTime()) / (1000 * 60 * 60 * 24);

    let shouldSend: '7' | '14' | null = null;
    if (daysSince >= 7 && daysSince < 14 && !app.reminder_7_sent) shouldSend = '7';
    if (daysSince >= 14 && daysSince < 21 && !app.reminder_14_sent) shouldSend = '14';

    if (!shouldSend) continue;

    // Obtenemos el correo real del usuario dueño de esta postulación
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(app.user_id);
    if (userError || !userData?.user?.email) {
      console.warn(`No se pudo obtener el correo del usuario ${app.user_id}`);
      continue;
    }

    const isDay14 = shouldSend === '14';

    try {
      await resend.emails.send({
        from: 'Juan Te Avisa <recordatorios@mail.juanteavisa.com>',
        to: userData.user.email,
        subject: isDay14
          ? `⚠️ Último aviso: sigue sin respuesta de ${app.company_name}`
          : `📅 Toca dar seguimiento a ${app.company_name}`,
        html: `
          <p>Hola,</p>
          <p>Tu postulación a <strong>${app.company_name}</strong> (${app.job_title || 'vacante H-2B'})
          lleva ${Math.floor(daysSince)} días en la etapa de seguimiento sin actualización.</p>
          ${isDay14
            ? `<p>Este es tu último aviso — si no hay respuesta antes del día 21, la moveremos automáticamente a "No Respondido".</p>`
            : `<p>Te recomendamos escribirle a la empresa para preguntar por el estado de tu postulación.</p>`
          }
          <p>Entra a tu <a href="https://h2b-fronted.vercel.app">Portal H-2B</a> para ver el detalle.</p>
        `,
      });

      const updateField = isDay14 ? { reminder_14_sent: true } : { reminder_7_sent: true };
      await supabase.from('applications').update(updateField).eq('id', app.id);
      remindersSent++;
    } catch (err: any) {
      console.error(`Error enviando recordatorio para ${app.id}:`, err);
    }
  }

  return NextResponse.json({ message: 'Recordatorios procesados', remindersSent });
}