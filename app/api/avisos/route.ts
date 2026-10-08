import { NextResponse } from 'next/server';
import { adminClient } from '../../../src/admin/auth';
import { readUnsubscribeToken } from '../../../src/email/unsubscribe';

export const dynamic = 'force-dynamic';

// Página pública de "avisos por correo": abre sin iniciar sesión, desde el enlace de cada correo.
// El enlace lleva el id de la persona firmado, así que nadie puede dar de baja a otra.
// Importante: abrir el enlace (GET) NO cambia nada: algunos programas de correo abren los enlaces solos
// para revisarlos y darían de baja a todos. El cambio se hace al pulsar el botón (POST), que también es
// lo que usa el botón "darse de baja" de Gmail y Outlook (RFC 8058).

function page(title: string, inner: string, status = 200) {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<div style="max-width:440px;margin:48px auto;padding:0 16px">
  <div style="background:#08131F;border-radius:12px 12px 0 0;padding:16px 24px"><span style="color:#C89B3C;font-weight:700;font-size:13px;letter-spacing:0.22em">JUAN TE AVISA</span></div>
  <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px 24px">${inner}</div>
</div></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const button = (label: string, accion: 'baja' | 'alta', primary: boolean) =>
  `<button name="accion" value="${accion}" style="cursor:pointer;border:0;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;${
    primary ? 'background:#C89B3C;color:#08131F' : 'background:#e2e8f0;color:#1e293b'
  }">${label}</button>`;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  if (!readUnsubscribeToken(token)) {
    return page('Enlace no válido', '<h1 style="margin:0 0 8px;font-size:20px">Este enlace no es válido</h1><p style="font-size:14px">Usa el enlace del correo más reciente que te enviamos.</p>', 400);
  }
  return page(
    'Avisos por correo',
    `<h1 style="margin:0 0 8px;font-size:20px">Avisos por correo</h1>
     <p style="font-size:14px;line-height:1.6">Te escribimos cuando tu acceso está por vencer o cuando llevas días sin entrar. Los recordatorios de seguimiento de tus postulaciones (7, 14 y 21 días) son parte del servicio y siguen llegando.</p>
     <form method="post" style="margin-top:20px">${button('Dejar de recibir estos avisos', 'baja', true)}</form>`
  );
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const userId = readUnsubscribeToken(token);
  if (!userId) return page('Enlace no válido', '<h1 style="margin:0 0 8px;font-size:20px">Este enlace no es válido</h1>', 400);

  // Del botón sale "accion"; el "darse de baja" de Gmail/Outlook manda "List-Unsubscribe=One-Click"
  let accion: string = 'baja';
  try {
    const form = await request.formData();
    if (form.get('accion') === 'alta') accion = 'alta';
  } catch {
    // Sin formulario legible: es una baja de un clic
  }

  const optout = accion === 'baja';
  const { error } = await adminClient().from('profiles').update({ email_optout: optout }).eq('id', userId);
  if (error) {
    console.error('No se pudo actualizar email_optout:', error);
    return page('No se pudo guardar', '<h1 style="margin:0 0 8px;font-size:20px">No pudimos guardar tu cambio</h1><p style="font-size:14px">Inténtalo de nuevo en unos minutos.</p>', 500);
  }

  return page(
    optout ? 'Listo' : 'Avisos activados',
    optout
      ? `<h1 style="margin:0 0 8px;font-size:20px">Listo, no recibirás más estos avisos</h1>
         <p style="font-size:14px;line-height:1.6">Seguirás recibiendo los recordatorios de seguimiento de tus postulaciones. Si cambias de idea:</p>
         <form method="post" style="margin-top:16px">${button('Volver a recibir los avisos', 'alta', false)}</form>`
      : `<h1 style="margin:0 0 8px;font-size:20px">Avisos activados</h1><p style="font-size:14px">Volverás a recibir los avisos de renovación y de actividad.</p>`
  );
}
