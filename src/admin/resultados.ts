import type { Miembro } from './radar';

// Tablero de resultados: cuenta el camino de los miembros (perfil, CV, postulaciones, respuestas, entrevistas)
// con datos que ya existen. Función pura, sin base de datos, para poder probarla.

const POSTED = ['postulado', 'seguimiento', 'entrevista', 'aceptado', 'rechazada', 'no_respondido'];

export interface ResultadosInput {
  miembros: Miembro[];
  // correo -> id de usuario, y conteo de postulaciones por estado de cada usuario
  userIdByEmail: Map<string, string>;
  statusCounts: Map<string, Record<string, number>>;
  // postulaciones de todos (para ver qué puestos se buscan y cuáles tienen respuesta)
  applications: { user_id: string | null; job_title: string | null; status: string; reply_type?: string | null }[];
  leads: { email: string; unsubscribed_at: string | null; reminder_sent_at: string | null; skip_reminder: boolean | null }[];
  accesoEmails: Set<string>; // correos con acceso (activo o no), para saber qué contactos del Mapa se volvieron miembros
}

export interface Resultados {
  muestra: number; // miembros considerados
  embudo: { clave: string; etiqueta: string; n: number }[];
  promedioPostulaciones30: number | null;
  activos7: number;
  vigentes: number;
  porVencer: number;
  vencidos: number;
  puestos: { puesto: string; postulaciones: number; respuestas: number }[];
  // Respuestas de empleadores que los miembros registraron en sus tarjetas. Es un mínimo: solo cuentan las que marcaron.
  respuestasEmpleador: { postuladas: number; conRespuesta: number; masDatos: number; entrevista: number; rechazo: number; otra: number };
  mapa: { total: number; recordatorio: number; deBaja: number; excluidos: number; sonMiembros: number };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function computeResultados(input: ResultadosInput): Resultados {
  const { miembros } = input;
  const idOf = (m: Miembro) => input.userIdByEmail.get(m.email.trim().toLowerCase());
  const counts = (m: Miembro) => {
    const id = idOf(m);
    return (id && input.statusCounts.get(id)) || {};
  };
  const n = (c: Record<string, number>, keys: string[]) => keys.reduce((s, k) => s + (c[k] || 0), 0);

  const conCuenta = miembros.filter((m) => !!idOf(m));
  const perfil = conCuenta.filter((m) => !m.compromiso.faltan.includes('perfil'));
  const cv = conCuenta.filter((m) => !m.compromiso.faltan.includes('CV'));
  const postularon = conCuenta.filter((m) => n(counts(m), POSTED) > 0);
  const diez = conCuenta.filter((m) => m.postulaciones30 >= 10);
  const respuesta = conCuenta.filter((m) => n(counts(m), ['entrevista', 'aceptado', 'rechazada']) > 0);
  const entrevista = conCuenta.filter((m) => n(counts(m), ['entrevista', 'aceptado']) > 0);
  const aceptados = conCuenta.filter((m) => n(counts(m), ['aceptado']) > 0);

  const embudo = [
    { clave: 'acceso', etiqueta: 'Miembros con acceso', n: miembros.length },
    { clave: 'cuenta', etiqueta: 'Entraron a la app', n: conCuenta.length },
    { clave: 'perfil', etiqueta: 'Completaron su perfil', n: perfil.length },
    { clave: 'cv', etiqueta: 'Tienen su CV', n: cv.length },
    { clave: 'postularon', etiqueta: 'Postularon al menos a 1 empresa', n: postularon.length },
    { clave: 'diez', etiqueta: 'Llegaron a 10 postulaciones (30 días)', n: diez.length },
    { clave: 'respuesta', etiqueta: 'Recibieron alguna respuesta', n: respuesta.length },
    { clave: 'entrevista', etiqueta: 'Llegaron a entrevista', n: entrevista.length },
    { clave: 'aceptado', etiqueta: 'Aceptados', n: aceptados.length },
  ];

  const promedioPostulaciones30 = conCuenta.length
    ? Math.round((conCuenta.reduce((s, m) => s + m.postulaciones30, 0) / conCuenta.length) * 10) / 10
    : null;

  // Puestos: por título de la postulación, cuántas hay y cuántas tuvieron respuesta
  const byRole = new Map<string, { puesto: string; postulaciones: number; respuestas: number }>();
  for (const a of input.applications) {
    if (!a.job_title || !POSTED.includes(a.status)) continue;
    const key = norm(a.job_title);
    const row = byRole.get(key) || { puesto: a.job_title.trim(), postulaciones: 0, respuestas: 0 };
    row.postulaciones++;
    if (['entrevista', 'aceptado', 'rechazada'].includes(a.status) || a.reply_type) row.respuestas++;
    byRole.set(key, row);
  }
  const puestos = [...byRole.values()].sort((a, b) => b.postulaciones - a.postulaciones).slice(0, 8);

  const postuladas = input.applications.filter((a) => POSTED.includes(a.status));
  const replies = input.applications.filter((a) => a.reply_type);
  const respuestasEmpleador = {
    postuladas: postuladas.length,
    conRespuesta: replies.length,
    masDatos: replies.filter((a) => a.reply_type === 'mas_datos').length,
    entrevista: replies.filter((a) => a.reply_type === 'entrevista').length,
    rechazo: replies.filter((a) => a.reply_type === 'rechazo').length,
    otra: replies.filter((a) => a.reply_type === 'otra').length,
  };

  const vigentes = miembros.filter((m) => m.diasParaVencer === null || m.diasParaVencer >= 0).length;
  const mapa = {
    total: input.leads.length,
    recordatorio: input.leads.filter((l) => l.reminder_sent_at).length,
    deBaja: input.leads.filter((l) => l.unsubscribed_at).length,
    excluidos: input.leads.filter((l) => l.skip_reminder).length,
    sonMiembros: input.leads.filter((l) => input.accesoEmails.has(l.email.trim().toLowerCase())).length,
  };

  return {
    muestra: miembros.length,
    embudo,
    promedioPostulaciones30,
    activos7: miembros.filter((m) => m.diasSinEntrar !== null && m.diasSinEntrar <= 7).length,
    vigentes,
    porVencer: miembros.filter((m) => m.porVencer).length,
    vencidos: miembros.length - vigentes,
    puestos,
    respuestasEmpleador,
    mapa,
  };
}
