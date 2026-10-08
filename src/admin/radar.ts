// Radar de actividad de los miembros (solo para el administrador). Función pura: recibe los datos ya
// leídos y devuelve el estado de cada miembro, para poder probarla sin base de datos.

// Umbrales del negocio, en un solo lugar para ajustarlos con datos reales.
export const RADAR = {
  coolingDays: 7, // desde aquí: "enfriándose"
  riskDays: 15, // desde aquí: "en riesgo"
  inactiveDays: 22, // desde aquí: "inactivo" (más de 21 días)
  newbieDays: 3, // días desde el alta sin perfil ni CV: "sin arrancar"
  stalledDays: 14, // con postulaciones pero sin movimientos en este tiempo: "estancado"
  soonDays: 7, // vence en menos de este tiempo: "por vencer"
  commitmentDays: 30, // el Compromiso de PRO se evalúa a los 30 días
  goal: 10, // postulaciones (a empresas distintas) para "aplicó el sistema"
  // Candidato al Accelerator: cuello de botella real en la búsqueda
  accelStalledDays: 20, // 20 o más días sin avanzar
  noResponseMin: 3, // postulaciones que ya vencieron sin respuesta, con 0 respuestas en total
  rejectedMin: 3, // rechazos sin ninguna entrevista
  contactCooldownDays: 7, // tras contactar a alguien, no vuelve a "por contactar" hasta pasar esto
};

const DAY = 24 * 60 * 60 * 1000;

export type Estado = 'activo' | 'enfriandose' | 'en_riesgo' | 'inactivo' | 'nunca_entro';

export interface RadarInput {
  accesos: {
    email: string;
    vence_el: string | null;
    origen: string | null;
    created_at: string | null;
    contactado_el?: string | null;
    nota_admin?: string | null;
  }[];
  // por correo en minúsculas
  users: Map<string, { id: string; last_sign_in_at: string | null }>;
  // por id de usuario
  profiles: Map<string, { full_name: string | null; last_seen_at: string | null; perfil_completado: boolean | null; hasCv: boolean }>;
  // cuántas postulaciones tiene la persona en cada estado ("guardadas", "postulado", "entrevista"...)
  statusCounts: Map<string, Record<string, number>>;
  events: { user_id: string; company_name: string; from_status: string | null; to_status: string; created_at: string }[];
  now: number;
}

export interface Miembro {
  email: string;
  nombre: string | null;
  estado: Estado;
  diasSinEntrar: number | null;
  fuenteVisita: 'app' | 'login' | null;
  postulaciones30: number;
  diasParaVencer: number | null;
  origen: string | null;
  sinArrancar: boolean;
  estancado: boolean;
  porVencer: boolean;
  prioridadRenovacion: boolean;
  compromiso: {
    dia: number | null;
    llegoAlDia30: boolean;
    califica: boolean | null;
    faltan: string[];
  };
  // Candidato a que Juan le escriba por el Accelerator, con los motivos concretos
  acelerador: { candidato: boolean; motivos: string[] };
  casoExito: boolean;
  contactadoEl: string | null;
  diasDesdeContacto: number | null;
  nota: string | null;
  // Hay algo que hacer con esta persona y no se le ha escrito en los últimos días
  porContactar: boolean;
  prioridad: number;
}

export interface Resumen {
  total: number;
  porEstado: Record<Estado, number>;
  sinArrancar: number;
  estancados: number;
  porVencer: number;
  prioridadRenovacion: number;
  califican: number;
  noCalifican: number;
  porContactar: number;
  candidatosAcelerador: number;
  casosExito: number;
}

const days = (now: number, iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : null;
};

// Una "postulación" es una empresa que entró al proceso de postulación: se creó ya postulada o salió de
// "guardadas". Los pasos posteriores (seguimiento, entrevista...) no suman otra postulación.
const entersPipeline = (e: { from_status: string | null; to_status: string }) =>
  e.to_status !== 'guardadas' && (e.from_status === null || e.from_status === 'guardadas');

export function computeRadar(input: RadarInput): { resumen: Resumen; miembros: Miembro[] } {
  const { now } = input;
  const windowStart = now - RADAR.commitmentDays * DAY;

  const postedCompanies = new Map<string, Set<string>>();
  const lastEvent = new Map<string, number>();
  for (const e of input.events) {
    const t = new Date(e.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    lastEvent.set(e.user_id, Math.max(lastEvent.get(e.user_id) || 0, t));
    if (t >= windowStart && entersPipeline(e)) {
      const set = postedCompanies.get(e.user_id) || new Set<string>();
      set.add(e.company_name);
      postedCompanies.set(e.user_id, set);
    }
  }

  const miembros: Miembro[] = input.accesos.map((a) => {
    const user = input.users.get(a.email.trim().toLowerCase());
    const profile = user ? input.profiles.get(user.id) : undefined;
    const counts = (user && input.statusCounts.get(user.id)) || {};
    const n = (status: string) => counts[status] || 0;
    const applied = Object.entries(counts).reduce((sum, [status, c]) => sum + (status === 'guardadas' ? 0 : c), 0);

    // Última visita: la de la app si existe; si no, el último inicio de sesión
    const seenIso = profile?.last_seen_at || user?.last_sign_in_at || null;
    const fuenteVisita: Miembro['fuenteVisita'] = profile?.last_seen_at ? 'app' : user?.last_sign_in_at ? 'login' : null;
    const diasSinEntrar = days(now, seenIso);

    let estado: Estado;
    if (diasSinEntrar === null) estado = 'nunca_entro';
    else if (diasSinEntrar >= RADAR.inactiveDays) estado = 'inactivo';
    else if (diasSinEntrar >= RADAR.riskDays) estado = 'en_riesgo';
    else if (diasSinEntrar >= RADAR.coolingDays) estado = 'enfriandose';
    else estado = 'activo';

    const diasDesdeAlta = days(now, a.created_at);
    const postulaciones30 = user ? postedCompanies.get(user.id)?.size || 0 : 0;
    const hasApplications = applied > 0;
    const lastEventAt = user ? lastEvent.get(user.id) : undefined;
    const hasCv = !!profile?.hasCv;
    const perfilListo = !!profile?.perfil_completado;

    const sinArrancar = diasDesdeAlta !== null && diasDesdeAlta >= RADAR.newbieDays && !perfilListo && !hasCv;
    const estancado = hasApplications && (!lastEventAt || now - lastEventAt >= RADAR.stalledDays * DAY);

    const venceMs = a.vence_el ? new Date(a.vence_el).getTime() : null;
    const diasParaVencer = venceMs !== null ? Math.ceil((venceMs - now) / DAY) : null;
    const porVencer = venceMs !== null && venceMs > now && venceMs - now <= RADAR.soonDays * DAY;
    // Quien está por vencer y casi no se mueve es la renovación más urgente
    const prioridadRenovacion = porVencer && (estado !== 'activo' || postulaciones30 < RADAR.goal);

    // Compromiso de PRO: a los 30 días, "califica" si tiene perfil, CV y las postulaciones de la meta
    const llegoAlDia30 = diasDesdeAlta !== null && diasDesdeAlta >= RADAR.commitmentDays;
    const faltan: string[] = [];
    if (!perfilListo) faltan.push('perfil');
    if (!hasCv) faltan.push('CV');
    if (postulaciones30 < RADAR.goal) faltan.push(`postulaciones (${postulaciones30} de ${RADAR.goal})`);
    const compromiso = {
      dia: diasDesdeAlta === null ? null : Math.min(diasDesdeAlta + 1, RADAR.commitmentDays),
      llegoAlDia30,
      califica: llegoAlDia30 ? faltan.length === 0 : null,
      faltan,
    };

    // Accelerator: solo cuando hay un cuello de botella real. Quien ya fue aceptado es un caso de éxito.
    const respuestas = n('entrevista') + n('aceptado') + n('rechazada');
    const casoExito = n('aceptado') >= 1;
    const motivos: string[] = [];
    if (n('no_respondido') >= RADAR.noResponseMin && respuestas === 0) {
      motivos.push(`Sin respuestas: ${n('no_respondido')} postulaciones sin respuesta y ninguna respuesta en total`);
    }
    if (n('rechazada') >= RADAR.rejectedMin && n('entrevista') === 0 && n('aceptado') === 0) {
      motivos.push(`Respuestas sin entrevistas: ${n('rechazada')} rechazos y ninguna entrevista`);
    }
    if (n('entrevista') >= 1) {
      motivos.push(n('entrevista') === 1 ? 'Tiene una entrevista en curso' : `Tiene ${n('entrevista')} entrevistas en curso`);
    }
    if (hasApplications && (!lastEventAt || now - lastEventAt >= RADAR.accelStalledDays * DAY)) {
      motivos.push(`${RADAR.accelStalledDays}+ días sin avanzar`);
    }
    const acelerador = { candidato: !casoExito && motivos.length > 0, motivos: casoExito ? [] : motivos };

    let prioridad = 0;
    if (prioridadRenovacion) prioridad = 100;
    else if (estado === 'nunca_entro') prioridad = 90;
    else if (sinArrancar) prioridad = 85;
    else if (estado === 'en_riesgo') prioridad = 80;
    else if (estado === 'inactivo') prioridad = 70;
    else if (estado === 'enfriandose') prioridad = 50;
    else if (estancado) prioridad = 40;

    // Seguimiento de contactos: tras escribirle a alguien, deja de salir como pendiente unos días
    const diasDesdeContacto = days(now, a.contactado_el);
    const recienContactado = diasDesdeContacto !== null && diasDesdeContacto < RADAR.contactCooldownDays;
    const hayQueHacer = prioridad >= 40 || acelerador.candidato || casoExito;
    const porContactar = hayQueHacer && !recienContactado;

    return {
      email: a.email,
      nombre: profile?.full_name || null,
      estado,
      diasSinEntrar,
      fuenteVisita,
      postulaciones30,
      diasParaVencer,
      origen: a.origen,
      sinArrancar,
      estancado,
      porVencer,
      prioridadRenovacion,
      compromiso,
      acelerador,
      casoExito,
      contactadoEl: a.contactado_el || null,
      diasDesdeContacto,
      nota: a.nota_admin || null,
      porContactar,
      prioridad,
    };
  });

  // Los recién contactados bajan en la lista (siguen visibles), para que arriba quede lo pendiente
  const orden = (m: Miembro) => (m.diasDesdeContacto !== null && m.diasDesdeContacto < RADAR.contactCooldownDays ? m.prioridad - 1000 : m.prioridad);
  miembros.sort((x, y) => orden(y) - orden(x) || (y.diasSinEntrar ?? 9999) - (x.diasSinEntrar ?? 9999));

  const resumen: Resumen = {
    total: miembros.length,
    porEstado: { activo: 0, enfriandose: 0, en_riesgo: 0, inactivo: 0, nunca_entro: 0 },
    sinArrancar: 0,
    estancados: 0,
    porVencer: 0,
    prioridadRenovacion: 0,
    califican: 0,
    noCalifican: 0,
    porContactar: 0,
    candidatosAcelerador: 0,
    casosExito: 0,
  };
  for (const m of miembros) {
    resumen.porEstado[m.estado]++;
    if (m.sinArrancar) resumen.sinArrancar++;
    if (m.estancado) resumen.estancados++;
    if (m.porVencer) resumen.porVencer++;
    if (m.prioridadRenovacion) resumen.prioridadRenovacion++;
    if (m.compromiso.califica === true) resumen.califican++;
    if (m.compromiso.califica === false) resumen.noCalifican++;
    if (m.porContactar) resumen.porContactar++;
    if (m.acelerador.candidato) resumen.candidatosAcelerador++;
    if (m.casoExito) resumen.casosExito++;
  }
  return { resumen, miembros };
}
