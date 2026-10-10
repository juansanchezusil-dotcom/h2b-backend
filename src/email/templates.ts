// Textos de los correos de renovación y reenganche. Están escritos en la voz de Juan: primera persona,
// tuteo, directos. Reglas que no se rompen: no se promete visa, patrocinio, entrevista ni empleo; no hay
// urgencia inventada (las fechas son las reales); y siempre se puede responder o darse de baja.

export type EmailKind = 'renewal_7' | 'renewal_3' | 'renewal_after' | 'reengage' | 'reto_30';

export interface TemplateData {
  nombre: string | null;
  diasSinEntrar: number | null;
  postulaciones30: number;
  meta: number;
  seguimientos: number;
  venceFecha: string | null; // ya escrita para leer ("24 de octubre")
  diasParaVencer: number | null;
  renewUrl?: string; // si aún no hay enlace de renovación, se pide responder el correo
  appUrl: string;
  unsubscribeUrl: string;
  // Reto de 30 días: si llegó a la meta (perfil, CV y postulaciones) y, si no, qué le falta
  retoCumplido?: boolean;
  retoFaltan?: string[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const NAVY = '#08131F';
const GOLD = '#C89B3C';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const firstName = (nombre: string | null) => (nombre || '').trim().split(/\s+/)[0] || '';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Body {
  subject: string;
  paragraphs: string[];
  button?: { label: string; url: string };
}

function body(kind: EmailKind, d: TemplateData): Body {
  const hola = firstName(d.nombre) ? `Hola ${firstName(d.nombre)}, soy Juan.` : 'Hola, soy Juan.';
  const respondeRenovar = 'Si quieres seguir, respóndeme este correo y te explico cómo renovar.';
  const cumpliendo = d.postulaciones30 >= Math.ceil(d.meta / 2);
  const avance = `${plural(d.postulaciones30, 'postulación', 'postulaciones')} a empresas distintas en los últimos 30 días${
    d.seguimientos > 0 ? ` y ${plural(d.seguimientos, 'empresa', 'empresas')} en seguimiento` : ''
  }`;

  switch (kind) {
    case 'reengage':
      return {
        subject: '¿Qué te frenó esta semana?',
        paragraphs: [
          hola,
          `Vi que no entras a tu Centro de Control desde hace ${plural(d.diasSinEntrar ?? 0, 'día', 'días')}. No te escribo para presionarte: el sistema solo funciona si lo aplicas, y una semana sin postular se nota.`,
          d.postulaciones30 > 0
            ? `Llevas ${avance}. Sigue por ahí.`
            : 'Todavía no tienes postulaciones registradas este mes.',
          'Mira, casi siempre la gente se frena por una de estas tres cosas: no sabe qué empresas verificar, le da miedo el inglés, o duda de si una oferta es real. Respóndeme este correo con la que te toca a ti y te digo por dónde seguir.',
        ],
        button: { label: 'Entrar a mi Centro de Control', url: d.appUrl },
      };

    case 'reto_30': {
      if (d.retoCumplido) {
        return {
          subject: 'Llegaste a la meta de tus primeros 30 días',
          paragraphs: [
            hola,
            `Se cumplieron tus primeros 30 días en Juan Te Avisa PRO y llegaste a la meta: perfil, CV y ${plural(d.postulaciones30, 'postulación', 'postulaciones')} a empresas distintas. Esto lo hiciste tú.`,
            'Lo que sigue es el seguimiento: escribir a las empresas que no respondieron a los 7, 14 y 21 días, y seguir postulando con el mismo ritmo.',
            'Si quieres contarme cómo te va o qué te cuesta, respóndeme este correo.',
          ],
          button: { label: 'Seguir en mi Centro de Control', url: d.appUrl },
        };
      }
      const falta = (d.retoFaltan || []).filter(Boolean);
      return {
        subject: 'Tus primeros 30 días: ¿cómo te fue?',
        paragraphs: [
          hola,
          `Se cumplieron tus primeros 30 días en Juan Te Avisa PRO. Llevas ${plural(d.postulaciones30, 'postulación', 'postulaciones')} a empresas distintas, de ${d.meta} que propone el reto${falta.length ? `. Te falta: ${falta.join(', ')}` : ''}.`,
          'No pasa nada. Casi siempre hay una razón concreta: no encontrar ofertas, el miedo al inglés o dudar de si una oferta es real. Cuéntame cuál es la tuya respondiendo este correo y lo vemos juntos.',
        ],
        button: { label: 'Entrar a mi Centro de Control', url: d.appUrl },
      };
    }

    case 'renewal_7':
      return {
        subject: `Tu acceso a PRO vence el ${d.venceFecha}`,
        paragraphs: [
          hola,
          `Tu acceso a Juan Te Avisa PRO vence el ${d.venceFecha}${d.diasParaVencer !== null ? `, en ${plural(d.diasParaVencer, 'día', 'días')}` : ''}.`,
          cumpliendo
            ? `Esto llevas: ${avance}. Eso es aplicar el sistema.`
            : 'Vi que has usado poco la app este mes. Antes de que venza, cuéntame qué te frenó: respóndeme este correo y lo vemos juntos.',
          d.renewUrl ? 'Si quieres seguir, puedes renovar desde aquí.' : respondeRenovar,
        ],
        button: d.renewUrl ? { label: 'Renovar mi acceso', url: d.renewUrl } : undefined,
      };

    case 'renewal_3':
      return {
        subject: `Quedan ${plural(d.diasParaVencer ?? 3, 'día', 'días')} de tu acceso a PRO`,
        paragraphs: [
          hola,
          `Te recuerdo que tu acceso vence el ${d.venceFecha}. Si quieres seguir con tu CRM, tus seguimientos y tus ofertas verificadas, esta semana es el momento de renovar.`,
          d.renewUrl ? 'Puedes hacerlo desde aquí.' : respondeRenovar,
          'Si decides no seguir, no pasa nada. Gracias por haber estado.',
        ],
        button: d.renewUrl ? { label: 'Renovar mi acceso', url: d.renewUrl } : undefined,
      };

    case 'renewal_after':
      return {
        subject: 'Tu acceso a PRO venció',
        paragraphs: [
          hola,
          `Tu acceso a Juan Te Avisa PRO venció el ${d.venceFecha}.`,
          d.renewUrl
            ? 'Si quieres retomar tu búsqueda, puedes renovar desde aquí.'
            : 'Si quieres retomar tu búsqueda, respóndeme este correo y te explico cómo renovar.',
          'Y si no era el momento, está bien. Cuéntame qué pasó: me ayuda a mejorar el sistema.',
        ],
        button: d.renewUrl ? { label: 'Renovar mi acceso', url: d.renewUrl } : undefined,
      };
  }
}

export function renderEmail(kind: EmailKind, d: TemplateData): RenderedEmail {
  const b = body(kind, d);

  const paragraphs = b.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b">${escapeHtml(p)}</p>`).join('');
  const button = b.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(b.button.url)}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px">${escapeHtml(b.button.label)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(b.subject)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:18px 24px">
    <span style="color:${GOLD};font-weight:700;font-size:14px;letter-spacing:0.22em">JUAN TE AVISA</span>
  </div>
  <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 12px 12px">
    ${paragraphs}${button}
    <p style="margin:0;font-size:15px;color:#1e293b">— Juan</p>
  </div>
  <p style="margin:16px 8px 0;font-size:11px;line-height:1.5;color:#64748b">
    Recibes este correo porque eres miembro de Juan Te Avisa PRO. Puedes responderlo: me llega a mí.
    Si prefieres no recibir estos avisos, <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#64748b">date de baja aquí</a>.
    <a href="${escapeHtml(d.appUrl)}/privacidad" style="color:#64748b">Política de privacidad</a>.
  </p>
</div></body></html>`;

  const text = [
    ...b.paragraphs,
    b.button ? `${b.button.label}: ${b.button.url}` : '',
    '— Juan',
    '',
    `Recibes este correo porque eres miembro de Juan Te Avisa PRO. Puedes responderlo: me llega a mí. Para no recibir estos avisos: ${d.unsubscribeUrl}`,
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n\n');

  return { subject: b.subject, html, text };
}

// Resumen para el administrador (no para los miembros): a quién escribirle esta semana
export interface DigestItem {
  email: string;
  nombre: string | null;
  motivos: string[];
}

export function renderAdminDigest(porContactar: number, candidatosAccelerator: number, renovaciones: number, items: DigestItem[], panelUrl: string): RenderedEmail {
  const subject = `Radar: ${porContactar} por contactar, ${renovaciones} por renovar`;
  const lines = items.map((i) => `${i.nombre ? `${i.nombre} · ` : ''}${i.email}: ${i.motivos.join(', ')}`);
  const resumen = `Esta semana: ${porContactar} por contactar, ${renovaciones} renovaciones urgentes y ${candidatosAccelerator} candidatos al Accelerator.`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 8px;font-size:18px">Radar de actividad</h2>
<p style="font-size:14px">${escapeHtml(resumen)}</p>
${lines.length ? `<ul style="font-size:14px;line-height:1.6;padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '<p style="font-size:14px">Nadie requiere acción esta semana.</p>'}
<p style="font-size:14px"><a href="${escapeHtml(panelUrl)}">Abrir el radar</a></p></body></html>`;

  const text = [resumen, ...lines, `Abrir el radar: ${panelUrl}`].join('\n');
  return { subject, html, text };
}

// Recordatorio para quienes dejaron su correo en el Mapa público (consintieron que se les escriba sobre la
// masterclass). Sin urgencia inventada: la fecha es la real.
export function renderMapaReminder(d: { nombre: string | null; masterclassUrl: string; unsubscribeUrl: string }): RenderedEmail {
  const hola = firstName(d.nombre) ? `Hola ${firstName(d.nombre)}, soy Juan.` : 'Hola, soy Juan.';
  const subject = 'Tu Mapa H2B se activa el 25 de noviembre';
  const paragraphs = [
    hola,
    'Dejaste tu correo en el Mapa H2B. Te cuento lo que sigue: el 25 de noviembre lo trabajamos juntos, en vivo, en la masterclass. Ahí armas tu plan de 3 semanas y tu dashboard para guardar ofertas, empresas y agencias.',
    'Si quieres asistir, reserva tu lugar aquí. Y si tienes una duda, respóndeme este correo.',
  ];
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b">${escapeHtml(p)}</p>`).join('');
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:${NAVY};border-radius:12px 12px 0 0;padding:18px 24px"><span style="color:${GOLD};font-weight:700;font-size:14px;letter-spacing:0.22em">JUAN TE AVISA</span></div>
  <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 12px 12px">
    ${body}
    <p style="margin:24px 0"><a href="${escapeHtml(d.masterclassUrl)}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px">Reservar mi lugar</a></p>
    <p style="margin:0;font-size:15px;color:#1e293b">— Juan</p>
  </div>
  <p style="margin:16px 8px 0;font-size:11px;line-height:1.5;color:#64748b">
    Recibes este correo porque dejaste tu correo en el Mapa H2B de Juan Te Avisa y aceptaste que te escribamos. Puedes responderlo: me llega a mí.
    Si prefieres no recibir más mensajes, <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:#64748b">date de baja aquí</a>.
  </p>
</div></body></html>`;
  const text = [...paragraphs, `Reservar mi lugar: ${d.masterclassUrl}`, '— Juan', '', `Recibes este correo porque dejaste tu correo en el Mapa H2B de Juan Te Avisa y aceptaste que te escribamos. Para no recibir más mensajes: ${d.unsubscribeUrl}`].join('\n\n');
  return { subject, html, text };
}
