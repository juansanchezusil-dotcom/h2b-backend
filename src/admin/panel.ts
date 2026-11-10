import { RADAR, type Miembro, type RadarInput } from './radar';
import { estimateCostUsd } from '../ai/costTracking';

// Panel del administrador: KPI, series, insights y vistas. Función pura: recibe los datos ya leídos
// (ver loadPanel.ts) y devuelve lo que pinta cada vista, para poder probarla sin base de datos.
// Reutiliza el estado de cada miembro que ya calcula computeRadar; no repite esa lógica.

const DAY = 24 * 60 * 60 * 1000;
const POSTED = ['postulado', 'seguimiento', 'entrevista', 'aceptado', 'rechazada', 'no_respondido'];

// Precios (USD). El anual cuesta 259 hasta el vie 27-nov-2026 y 296 desde el sáb 28.
export const PRECIOS = { mensual: 37, anualPromo: 259, anual: 296, promoHasta: '2026-11-28' };

export interface PanelFilters {
  dias: number;
  plan?: 'mensual' | 'anual';
  estado?: string;
  etapa?: 'busca' | 'postula' | 'seguimiento' | 'entrevista';
  puesto?: string;
  pais?: string;
  cohorte?: string;
}

export interface PanelData {
  now: number;
  radar: RadarInput;
  miembros: Miembro[];
  paisByUser: Map<string, string | null>;
  events: { user_id: string; company_name: string; from_status: string | null; to_status: string; created_at: string }[];
  apps: { user_id: string | null; job_title: string | null; status: string; reply_type: string | null; created_at: string }[];
  accesos: { email: string; created_at: string | null; activo: boolean | null; vence_el: string | null }[];
  leads: { created_at: string }[];
  aiCost: { day: string; model: string; calls: number; input_tokens: number; output_tokens: number }[];
  aiUser: { day: string; user_id: string; feature: string; model: string; calls: number; input_tokens: number; output_tokens: number }[];
  aiUsageToday: { bucket: string | null; count: number }[];
  errors: { created_at: string; kind: string }[];
  snapshots: { day: string; miembros_vigentes: number; por_vencer: number; vencidos: number; activos_7d: number; postulaciones_dia: number; ingreso_estimado: number }[];
}

export function parseFilters(params: URLSearchParams): PanelFilters {
  const d = Number(params.get('dias'));
  const dias = [1, 7, 30, 90].includes(d) ? d : Number.isFinite(d) && d >= 1 && d <= 365 ? Math.floor(d) : 30;
  const plan = params.get('plan');
  const etapa = params.get('etapa');
  const clip = (k: string) => (params.get(k) || '').trim().slice(0, 60) || undefined;
  return {
    dias,
    plan: plan === 'mensual' || plan === 'anual' ? plan : undefined,
    estado: clip('estado'),
    etapa: etapa === 'busca' || etapa === 'postula' || etapa === 'seguimiento' || etapa === 'entrevista' ? etapa : undefined,
    puesto: clip('puesto'),
    pais: clip('pais'),
    cohorte: clip('cohorte'),
  };
}

// ---------- privacidad ----------
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  const [host = '', ...rest] = domain.split('.');
  return `${user.slice(0, 2)}***@${host.slice(0, 1)}***${rest.length ? '.' + rest.join('.') : ''}`;
}
export function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?').slice(0, 2);
}
const who = (m: Miembro, mostrar: boolean) => ({
  quien: mostrar ? m.nombre || m.email : initials(m.nombre || m.email),
  correo: mostrar ? m.email : maskEmail(m.email),
});

// ---------- derivados por miembro ----------
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function planOf(m: Miembro): 'mensual' | 'anual' | 'sin_dato' {
  if (m.diasParaVencer === null || m.diasDesdeAlta === null) return 'sin_dato';
  return m.diasDesdeAlta + m.diasParaVencer >= 300 ? 'anual' : 'mensual';
}

function isoWeek(ms: number): string {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

export type Etapa = 'sin_empresas' | 'busca' | 'postula' | 'seguimiento' | 'entrevista';
export function etapaOf(counts: Record<string, number>): Etapa {
  const n = (k: string) => counts[k] || 0;
  if (n('entrevista') + n('aceptado') > 0) return 'entrevista';
  if (n('seguimiento') > 0) return 'seguimiento';
  if (POSTED.some((k) => n(k) > 0)) return 'postula';
  if (Object.values(counts).some((c) => c > 0)) return 'busca';
  return 'sin_empresas';
}

// ---------- ingreso estimado ----------
// Las cuentas de prueba (origen "prueba") y las del administrador no son ingreso: se excluyen y se cuentan aparte.
export function ingresoEstimado(miembros: Miembro[], now: number, excluirCorreos: Set<string> = new Set()) {
  const por = { mensual: { n: 0, usd: 0 }, anual: { n: 0, usd: 0 } };
  let sinPlan = 0;
  let excluidos = 0;
  for (const m of miembros) {
    if (m.diasParaVencer !== null && m.diasParaVencer < 0) continue; // vencidos no suman
    if (m.origen === 'prueba' || excluirCorreos.has(m.email.trim().toLowerCase())) {
      excluidos++;
      continue;
    }
    const plan = planOf(m);
    if (plan === 'sin_dato') {
      sinPlan++;
      continue;
    }
    if (plan === 'mensual') {
      por.mensual.n++;
      por.mensual.usd += PRECIOS.mensual;
    } else {
      const altaDia = dayKey(now - (m.diasDesdeAlta ?? 0) * DAY);
      const precio = altaDia < PRECIOS.promoHasta ? PRECIOS.anualPromo : PRECIOS.anual;
      por.anual.n++;
      por.anual.usd += precio / 12;
    }
  }
  const total = Math.round((por.mensual.usd + por.anual.usd) * 100) / 100;
  return { total, porPlan: { mensual: { n: por.mensual.n, usd: Math.round(por.mensual.usd * 100) / 100 }, anual: { n: por.anual.n, usd: Math.round(por.anual.usd * 100) / 100 } }, sinPlan, excluidos };
}

// ---------- filtros ----------
interface Ctx {
  data: PanelData;
  f: PanelFilters;
  miembros: Miembro[];
  userIds: Set<string>;
  userOf: Map<string, string>; // correo -> id
  countsOf: (m: Miembro) => Record<string, number>;
}

function buildCtx(data: PanelData, f: PanelFilters): Ctx {
  const userOf = new Map<string, string>();
  for (const [email, u] of data.radar.users) userOf.set(email, u.id);
  const idOf = (m: Miembro) => userOf.get(m.email.trim().toLowerCase());
  const countsOf = (m: Miembro) => {
    const id = idOf(m);
    return (id && data.radar.statusCounts.get(id)) || {};
  };
  const puesto = f.puesto?.toLowerCase();
  const puestoUsers = puesto
    ? new Set(data.apps.filter((a) => a.user_id && (a.job_title || '').toLowerCase().includes(puesto)).map((a) => a.user_id as string))
    : null;
  const miembros = data.miembros.filter((m) => {
    if (f.estado && f.estado !== 'todos' && m.estado !== f.estado) return false;
    if (f.plan && planOf(m) !== f.plan) return false;
    const id = idOf(m);
    if (f.etapa && etapaOf(countsOf(m)) !== f.etapa) return false;
    if (f.pais && (!id || (data.paisByUser.get(id) || '').toLowerCase() !== f.pais.toLowerCase())) return false;
    if (f.cohorte && (m.diasDesdeAlta === null || isoWeek(data.now - m.diasDesdeAlta * DAY) !== f.cohorte)) return false;
    if (puestoUsers && (!id || !puestoUsers.has(id))) return false;
    return true;
  });
  const userIds = new Set<string>();
  for (const m of miembros) {
    const id = idOf(m);
    if (id) userIds.add(id);
  }
  return { data, f, miembros, userIds, userOf, countsOf };
}

const vigente = (m: Miembro) => m.diasParaVencer === null || m.diasParaVencer >= 0;
const entersPipeline = (e: { from_status: string | null; to_status: string }) =>
  e.to_status !== 'guardadas' && (e.from_status === null || e.from_status === 'guardadas');

function inWindow(iso: string | null | undefined, from: number, to: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= from && t < to;
}

const variation = (cur: number | null, prev: number | null) =>
  cur === null || prev === null || prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

function dailySeries(items: { t: string; v: number }[], days: number, now: number): number[] {
  const out: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) out[dayKey(now - i * DAY)] = 0;
  for (const it of items) {
    const k = it.t.slice(0, 10);
    if (k in out) out[k]! += it.v;
  }
  return Object.values(out);
}

const costOf = (rows: { model: string; input_tokens: number; output_tokens: number }[]) =>
  rows.reduce((s, r) => s + estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens)), 0);

// ---------- KPI ----------
export interface Kpi {
  id: string;
  titulo: string;
  valor: number | null;
  formato: 'n' | 'usd' | 'pct';
  variacionPct: number | null; // frente al periodo anterior; null si no hay base
  spark: number[];
  n?: number; // tamaño de la muestra detrás de un porcentaje
  definicion: string; // "¿Cómo se calcula?"
}

export function buildKpis(ctx: Ctx): Kpi[] {
  const { data, f, miembros, userIds } = ctx;
  const now = data.now;
  const p = f.dias;
  const cur = now - p * DAY;
  const prev = now - 2 * p * DAY;
  const evs = data.events.filter((e) => userIds.has(e.user_id));
  const posts = evs.filter(entersPipeline);
  const postsCur = posts.filter((e) => inWindow(e.created_at, cur, now + 1)).length;
  const postsPrev = posts.filter((e) => inWindow(e.created_at, prev, cur)).length;
  const entCur = evs.filter((e) => e.to_status === 'entrevista' && inWindow(e.created_at, cur, now + 1)).length;
  const entPrev = evs.filter((e) => e.to_status === 'entrevista' && inWindow(e.created_at, prev, cur)).length;
  const emails = new Set(miembros.map((m) => m.email.trim().toLowerCase()));
  const nuevosCur = data.accesos.filter((a) => emails.has(a.email.trim().toLowerCase()) && inWindow(a.created_at, cur, now + 1)).length;
  const nuevosPrev = data.accesos.filter((a) => emails.has(a.email.trim().toLowerCase()) && inWindow(a.created_at, prev, cur)).length;
  const leadsCur = data.leads.filter((l) => inWindow(l.created_at, cur, now + 1)).length;
  const leadsPrev = data.leads.filter((l) => inWindow(l.created_at, prev, cur)).length;
  const costCur = costOf(data.aiCost.filter((r) => inWindow(r.day, cur - DAY, now + 1)));
  const costPrev = costOf(data.aiCost.filter((r) => inWindow(r.day, prev - DAY, cur - DAY)));
  const err24 = data.errors.filter((e) => inWindow(e.created_at, now - DAY, now + 1)).length;
  const errPrev24 = data.errors.filter((e) => inWindow(e.created_at, now - 2 * DAY, now - DAY)).length;

  const vig = miembros.filter(vigente);
  const activos7 = miembros.filter((m) => m.diasSinEntrar !== null && m.diasSinEntrar <= 7).length;
  const porVencer = miembros.filter((m) => m.porVencer).length;
  const activados = vig.filter((m) => !m.compromiso.faltan.includes('perfil') && !m.compromiso.faltan.includes('CV')).length;
  const apps = data.apps.filter((a) => a.user_id && userIds.has(a.user_id));
  const appsCur = apps.filter((a) => POSTED.includes(a.status) && inWindow(a.created_at, cur, now + 1));
  const appsPrev = apps.filter((a) => POSTED.includes(a.status) && inWindow(a.created_at, prev, cur));
  const tasa = (rows: typeof apps) => (rows.length ? Math.round((rows.filter((a) => a.reply_type).length / rows.length) * 100) : null);

  const snapPrev = data.snapshots.find((s) => s.day === dayKey(cur));
  const snapSeries = (key: 'miembros_vigentes' | 'por_vencer' | 'activos_7d') =>
    data.snapshots.filter((s) => s.day >= dayKey(cur)).map((s) => s[key]);

  const postsDaily = dailySeries(posts.map((e) => ({ t: e.created_at, v: 1 })), Math.min(p, 90), now);
  const entDaily = dailySeries(evs.filter((e) => e.to_status === 'entrevista').map((e) => ({ t: e.created_at, v: 1 })), Math.min(p, 90), now);
  const leadsDaily = dailySeries(data.leads.map((l) => ({ t: l.created_at, v: 1 })), Math.min(p, 90), now);
  const costDaily = dailySeries(
    data.aiCost.map((r) => ({ t: r.day, v: estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens)) })),
    Math.min(p, 90),
    now
  );
  const errDaily = dailySeries(data.errors.map((e) => ({ t: e.created_at, v: 1 })), Math.min(p, 90), now);

  return [
    { id: 'miembros', titulo: 'Miembros activos', valor: vig.length, formato: 'n', variacionPct: variation(vig.length, snapPrev?.miembros_vigentes ?? null), spark: snapSeries('miembros_vigentes'), definicion: 'Miembros con acceso concedido cuya fecha de vencimiento no ha pasado (o no tiene). Fuente: tabla accesos. La variación compara con la foto diaria de hace el periodo elegido.' },
    { id: 'nuevos', titulo: 'Nuevos del periodo', valor: nuevosCur, formato: 'n', variacionPct: variation(nuevosCur, nuevosPrev), spark: [], definicion: 'Accesos creados dentro del periodo (accesos.created_at), frente al periodo anterior del mismo largo.' },
    { id: 'vencen7', titulo: 'Vencen en 7 días', valor: porVencer, formato: 'n', variacionPct: variation(porVencer, snapPrev?.por_vencer ?? null), spark: snapSeries('por_vencer'), definicion: 'Miembros con vencimiento dentro de los próximos 7 días (RADAR.soonDays).' },
    { id: 'activacion', titulo: 'Activación', valor: vig.length ? Math.round((activados / vig.length) * 100) : null, formato: 'pct', variacionPct: null, spark: [], n: vig.length, definicion: 'Miembros vigentes con perfil completo y CV, entre todos los vigentes. Fuente: profiles.perfil_completado y base_cv_text.' },
    { id: 'postulaciones', titulo: 'Postulaciones', valor: postsCur, formato: 'n', variacionPct: variation(postsCur, postsPrev), spark: postsDaily, definicion: 'Empresas que pasaron de guardadas a postuladas en el periodo (application_events). Un seguimiento o una entrevista no suman otra postulación.' },
    { id: 'respuesta', titulo: 'Tasa de respuesta', valor: tasa(appsCur), formato: 'pct', variacionPct: variation(tasa(appsCur), tasa(appsPrev)), spark: [], n: appsCur.length, definicion: 'Postulaciones del periodo con respuesta marcada por el miembro (reply_type), entre las postulaciones del periodo. Es un mínimo: solo cuentan las respuestas que el miembro marcó.' },
    { id: 'entrevistas', titulo: 'Entrevistas', valor: entCur, formato: 'n', variacionPct: variation(entCur, entPrev), spark: entDaily, definicion: 'Empresas que pasaron a "entrevista" en el periodo (application_events.to_status). El embudo de Miembros cuenta distinto: incluye a quien ya fue aceptado.' },
    { id: 'leads', titulo: 'Leads del Mapa', valor: leadsCur, formato: 'n', variacionPct: variation(leadsCur, leadsPrev), spark: leadsDaily, definicion: 'Correos nuevos del Mapa público en el periodo (map_leads.created_at). No depende de los filtros de miembros.' },
    { id: 'costoIa', titulo: 'Costo de IA', valor: Math.round(costCur * 1000) / 1000, formato: 'usd', variacionPct: variation(costCur, costPrev), spark: costDaily, definicion: 'Costo estimado de las llamadas a Claude en el periodo: tokens registrados (ai_cost_daily) por la tarifa de cada modelo. No incluye Gemini de respaldo.' },
    { id: 'errores24h', titulo: 'Errores en 24 h', valor: err24, formato: 'n', variacionPct: variation(err24, errPrev24), spark: errDaily, definicion: 'Errores reportados por la app de los miembros en las últimas 24 horas (client_errors).' },
    { id: 'activos7', titulo: 'Activos esta semana', valor: activos7, formato: 'n', variacionPct: variation(activos7, snapPrev?.activos_7d ?? null), spark: snapSeries('activos_7d'), n: miembros.length, definicion: 'Miembros que entraron a la app en los últimos 7 días (profiles.last_seen_at, o último inicio de sesión).' },
  ];
}

// ---------- salud del negocio ----------
export function salud(ctx: Ctx, errores24h: number) {
  const vig = ctx.miembros.filter(vigente);
  if (!vig.length) return { valor: null as number | null, n: 0, desglose: [] as { clave: string; puntos: number; max: number }[] };
  const activos = vig.filter((m) => m.diasSinEntrar !== null && m.diasSinEntrar <= 7).length / vig.length;
  const postula = vig.filter((m) => ['postula', 'seguimiento', 'entrevista'].includes(etapaOf(ctx.countsOf(m)))).length / vig.length;
  const sinErrores = 1 - Math.min(1, errores24h / 10);
  const desglose = [
    { clave: 'Activos esta semana', puntos: Math.round(45 * activos), max: 45 },
    { clave: 'Ya postulan', puntos: Math.round(35 * postula), max: 35 },
    { clave: 'Sin errores en 24 h', puntos: Math.round(20 * sinErrores), max: 20 },
  ];
  return { valor: desglose.reduce((s, d) => s + d.puntos, 0), n: vig.length, desglose };
}

// ---------- insights (reglas, sin IA) ----------
export interface Insight {
  id: string;
  nivel: 'alto' | 'medio' | 'info';
  titulo: string;
  dato: string;
  n: number;
  muestraChica: boolean;
  hipotesis: string;
  accion: string;
  filtro: { vista: 'radar' | 'miembros' | 'operacion'; estado?: string };
}

export function buildInsights(ctx: Ctx, kpis: Kpi[]): Insight[] {
  const out: Insight[] = [];
  const ms = ctx.miembros;
  const mk = (i: Omit<Insight, 'muestraChica'>): Insight => ({ ...i, muestraChica: i.n < 10 });

  const venceSinMover = ms.filter((m) => m.prioridadRenovacion);
  if (venceSinMover.length) {
    out.push(mk({ id: 'vence-sin-mover', nivel: 'alto', titulo: `${venceSinMover.length} por vencer sin avanzar`, dato: `Vencen en menos de ${RADAR.soonDays} días y no están entrando o postulan poco.`, n: venceSinMover.length, hipotesis: 'Hipótesis: perdieron el ritmo y no ven el valor para renovar.', accion: 'Escríbeles hoy, antes de que venza el acceso.', filtro: { vista: 'radar' } }));
  }
  const nunca = ms.filter((m) => m.estado === 'nunca_entro' || m.sinArrancar);
  if (nunca.length) {
    out.push(mk({ id: 'sin-arrancar', nivel: 'alto', titulo: `${nunca.length} sin arrancar`, dato: 'Tienen acceso pero nunca entraron, o no completaron perfil ni CV.', n: nunca.length, hipotesis: 'Hipótesis: no recibieron o no entendieron la bienvenida.', accion: 'Mándales el primer paso por mensaje directo.', filtro: { vista: 'radar', estado: 'nunca_entro' } }));
  }
  const sinResp = ms.filter((m) => m.acelerador.candidato && m.acelerador.motivos.some((x) => x.startsWith('Sin respuestas')));
  if (sinResp.length) {
    out.push(mk({ id: 'sin-respuestas', nivel: 'medio', titulo: `${sinResp.length} con postulaciones y 0 respuestas`, dato: `Tienen ${RADAR.noResponseMin} o más postulaciones sin respuesta y ninguna respuesta en total.`, n: sinResp.length, hipotesis: 'Hipótesis: el CV, la carta o los puestos elegidos no están funcionando.', accion: 'Revisa su CV y ofrécele el H2B Accelerator.', filtro: { vista: 'radar' } }));
  }
  const sinEntrevista = ms.filter((m) => m.acelerador.candidato && m.acelerador.motivos.some((x) => x.startsWith('Respuestas sin entrevistas')));
  if (sinEntrevista.length) {
    out.push(mk({ id: 'respuestas-sin-entrevista', nivel: 'medio', titulo: `${sinEntrevista.length} con respuestas pero sin entrevistas`, dato: `Tienen ${RADAR.rejectedMin} o más rechazos y ninguna entrevista.`, n: sinEntrevista.length, hipotesis: 'Hipótesis: el perfil pasa el filtro inicial pero falla en requisitos o inglés.', accion: 'Pídeles un rechazo de ejemplo y revisa el patrón.', filtro: { vista: 'radar' } }));
  }
  const entrevistas = ms.filter((m) => m.acelerador.motivos.some((x) => x.includes('entrevista') && x.startsWith('Tiene')));
  if (entrevistas.length) {
    out.push(mk({ id: 'entrevista-agendada', nivel: 'info', titulo: `${entrevistas.length} con entrevista en curso`, dato: 'Tienen al menos una empresa en estado entrevista.', n: entrevistas.length, hipotesis: 'Es el momento de más valor para acompañarlos.', accion: 'Pregúntales cómo la preparan y ofrece práctica.', filtro: { vista: 'radar' } }));
  }
  const estancados = ms.filter((m) => m.acelerador.candidato && m.acelerador.motivos.some((x) => x.includes('sin avanzar')) && m.estado === 'activo');
  if (estancados.length) {
    out.push(mk({ id: 'activo-estancado', nivel: 'medio', titulo: `${estancados.length} activos sin avanzar ${RADAR.accelStalledDays}+ días`, dato: 'Entran a la app pero no mueven ninguna postulación.', n: estancados.length, hipotesis: 'Hipótesis: no saben qué paso sigue o están esperando respuestas.', accion: 'Dales el siguiente paso concreto (follow-up o nuevas empresas).', filtro: { vista: 'radar' } }));
  }
  const post = kpis.find((k) => k.id === 'postulaciones');
  if (post?.variacionPct !== null && post?.variacionPct !== undefined && post.valor !== null) {
    const base = Math.round(post.valor / (1 + post.variacionPct / 100));
    if (base >= 5 && post.variacionPct <= -40) {
      out.push(mk({ id: 'caida-postulaciones', nivel: 'alto', titulo: `Postulaciones bajaron ${Math.abs(post.variacionPct)}%`, dato: `${post.valor} en el periodo contra ${base} en el anterior.`, n: base + post.valor, hipotesis: 'Hipótesis: menos miembros activos o menos ofertas nuevas.', accion: 'Mira cuántos activos hay esta semana y si hay ofertas nuevas.', filtro: { vista: 'miembros' } }));
    } else if (base >= 5 && post.variacionPct >= 60) {
      out.push(mk({ id: 'pico-postulaciones', nivel: 'info', titulo: `Postulaciones subieron ${post.variacionPct}%`, dato: `${post.valor} en el periodo contra ${base} en el anterior.`, n: base + post.valor, hipotesis: 'Hipótesis: entró una tanda nueva de miembros o salieron ofertas buenas.', accion: 'Aprovecha para pedir testimonios y respuestas de empleadores.', filtro: { vista: 'miembros' } }));
    }
  }
  const err = kpis.find((k) => k.id === 'errores24h');
  if (err?.valor) {
    out.push(mk({ id: 'errores', nivel: err.valor >= 5 ? 'alto' : 'medio', titulo: `${err.valor} errores en 24 h`, dato: 'La app de los miembros reportó fallas.', n: err.valor, hipotesis: 'Hipótesis: una falla reciente en una pantalla o un navegador concreto.', accion: 'Abre Operación y revisa el grupo más repetido.', filtro: { vista: 'operacion' } }));
  }
  const costo = kpis.find((k) => k.id === 'costoIa');
  if (costo && costo.spark.length >= 4) {
    const hoy = costo.spark[costo.spark.length - 1]!;
    const previos = costo.spark.slice(0, -1);
    const media = previos.reduce((s, v) => s + v, 0) / previos.length;
    if (media > 0 && hoy > media * 3) {
      out.push(mk({ id: 'pico-ia', nivel: 'medio', titulo: 'El costo de IA de hoy triplica el promedio', dato: `$${hoy.toFixed(3)} hoy contra $${media.toFixed(3)} de media diaria.`, n: previos.length, hipotesis: 'Hipótesis: una persona usando mucho un asistente, o una prueba tuya.', accion: 'Revisa el costo por función y por miembro en Operación.', filtro: { vista: 'operacion' } }));
    }
  }
  const orden = { alto: 0, medio: 1, info: 2 };
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

// ---------- vistas ----------
export function buildPanel(data: PanelData, f: PanelFilters, vista: string, mostrar = false) {
  const ctx = buildCtx(data, f);
  const kpis = buildKpis(ctx);
  const err24 = kpis.find((k) => k.id === 'errores24h')?.valor ?? 0;
  const insights = buildInsights(ctx, kpis);
  const base = {
    generado: new Date(data.now).toISOString(),
    filtros: f,
    muestra: ctx.miembros.length,
    totalMiembros: data.miembros.length,
    definiciones: {
      salud: 'Puntaje de 0 a 100: 45 puntos por la proporción de vigentes activos esta semana, 35 por los que ya postulan, 20 por no tener errores en 24 h (se descuenta 2 por error, hasta 10). Con pocos miembros es solo una guía.',
      ingreso: 'Estimado, no es cobro real. Miembros vigentes por su plan: mensual $37; anual $259 si se dio de alta antes del 28-nov-2026 y $296 después, dividido entre 12. El plan se deduce de la duración del acceso (300 días o más = anual). No cuenta cuentas de prueba ni la tuya.',
    },
  };

  if (vista === 'resumen') {
    const admins = new Set((process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
    const ing = ingresoEstimado(ctx.miembros, data.now, admins);
    const actividad = [...data.events]
      .filter((e) => ctx.userIds.has(e.user_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12)
      .map((e) => ({ t: e.created_at, estado: e.to_status, empresa: e.company_name, desde: e.from_status }));
    return {
      ...base,
      kpis,
      salud: salud(ctx, Number(err24)),
      ingreso: ing,
      acciones: insights.slice(0, 3),
      insights,
      embudo: embudo(ctx),
      actividad,
    };
  }

  if (vista === 'miembros') {
    const apps = data.apps.filter((a) => a.user_id && ctx.userIds.has(a.user_id));
    const porEstado: Record<string, number> = {};
    for (const a of apps) porEstado[a.status] = (porEstado[a.status] || 0) + 1;
    const byRole = new Map<string, { puesto: string; postulaciones: number; respuestas: number }>();
    for (const a of apps) {
      if (!a.job_title || !POSTED.includes(a.status)) continue;
      const key = a.job_title.trim().toLowerCase().replace(/\s+/g, ' ');
      const row = byRole.get(key) || { puesto: a.job_title.trim(), postulaciones: 0, respuestas: 0 };
      row.postulaciones++;
      if (a.reply_type || ['entrevista', 'aceptado', 'rechazada'].includes(a.status)) row.respuestas++;
      byRole.set(key, row);
    }
    const respuestas: Record<string, number> = {};
    for (const a of apps) if (a.reply_type) respuestas[a.reply_type] = (respuestas[a.reply_type] || 0) + 1;
    const cohortes = new Map<string, { cohorte: string; n: number; activosHoy: number }>();
    for (const m of ctx.miembros) {
      if (m.diasDesdeAlta === null) continue;
      const k = isoWeek(data.now - m.diasDesdeAlta * DAY);
      const row = cohortes.get(k) || { cohorte: k, n: 0, activosHoy: 0 };
      row.n++;
      if (m.diasSinEntrar !== null && m.diasSinEntrar <= 7) row.activosHoy++;
      cohortes.set(k, row);
    }
    const semanas: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const from = data.now - (i + 1) * 7 * DAY;
      const to = data.now - i * 7 * DAY;
      semanas.push(data.accesos.filter((a) => inWindow(a.created_at, from, to)).length);
    }
    const vencimientos = ctx.miembros
      .filter((m) => m.diasParaVencer !== null && m.diasParaVencer >= 0 && m.diasParaVencer <= 14)
      .sort((a, b) => (a.diasParaVencer ?? 99) - (b.diasParaVencer ?? 99))
      .map((m) => ({ ...who(m, mostrar), dias: m.diasParaVencer, estado: m.estado, plan: planOf(m), contactadoRecien: m.diasDesdeContacto !== null && m.diasDesdeContacto < RADAR.contactCooldownDays }));
    const paises: Record<string, number> = {};
    for (const [, id] of ctx.userOf) {
      if (!ctx.userIds.has(id)) continue;
      const p = data.paisByUser.get(id);
      if (p) paises[p] = (paises[p] || 0) + 1;
    }
    return {
      ...base,
      kpis: kpis.filter((k) => ['miembros', 'nuevos', 'vencen7', 'activacion', 'activos7'].includes(k.id)),
      embudo: embudo(ctx),
      porEstadoApp: porEstado,
      puestos: [...byRole.values()].sort((a, b) => b.postulaciones - a.postulaciones).slice(0, 8),
      respuestas,
      cohortes: [...cohortes.values()].sort((a, b) => a.cohorte.localeCompare(b.cohorte)).slice(-8),
      altasPorSemana: semanas,
      vencimientos,
      paises,
      mostrando: mostrar,
    };
  }

  if (vista === 'radar') {
    const ms = ctx.miembros;
    const porEstado: Record<string, number> = { activo: 0, enfriandose: 0, en_riesgo: 0, inactivo: 0, nunca_entro: 0 };
    for (const m of ms) porEstado[m.estado]++;
    const motivo = (m: Miembro) =>
      m.prioridadRenovacion ? `Vence en ${m.diasParaVencer} d y casi no avanza`
      : m.estado === 'nunca_entro' ? 'Nunca entró'
      : m.sinArrancar ? 'Sin perfil ni CV'
      : m.acelerador.candidato ? m.acelerador.motivos[0]!
      : m.diasSinEntrar !== null && m.diasSinEntrar >= RADAR.coolingDays ? `${m.diasSinEntrar} días sin entrar`
      : m.estancado ? 'Sin movimientos recientes' : 'Seguimiento';
    const lista = ms
      .filter((m) => m.porContactar)
      .slice(0, 12)
      .map((m) => ({ ...who(m, mostrar), estado: m.estado, motivo: motivo(m), diasSinEntrar: m.diasSinEntrar, acelerador: m.acelerador.candidato, nota: mostrar ? m.nota : null }));
    return {
      ...base,
      resumen: {
        total: ms.length,
        porEstado,
        porContactar: ms.filter((m) => m.porContactar).length,
        candidatosAcelerador: ms.filter((m) => m.acelerador.candidato).length,
        sinArrancar: ms.filter((m) => m.sinArrancar).length,
        estancados: ms.filter((m) => m.estancado).length,
        porVencer: ms.filter((m) => m.porVencer).length,
        casosExito: ms.filter((m) => m.casoExito).length,
      },
      insights,
      lista,
      mostrando: mostrar,
    };
  }

  if (vista === 'operacion') return { ...base, ...operacion(ctx, kpis) };

  return { ...base, error: 'Vista no reconocida' };
}

function embudo(ctx: Ctx) {
  const ms = ctx.miembros;
  const stage = (m: Miembro) => etapaOf(ctx.countsOf(m));
  const steps = [
    { clave: 'acceso', etiqueta: 'Con acceso', n: ms.length },
    { clave: 'busca', etiqueta: 'Búscalas (guardaron empresas)', n: ms.filter((m) => stage(m) !== 'sin_empresas').length },
    { clave: 'postula', etiqueta: 'Postula', n: ms.filter((m) => ['postula', 'seguimiento', 'entrevista'].includes(stage(m))).length },
    { clave: 'seguimiento', etiqueta: 'Follow-up', n: ms.filter((m) => ['seguimiento', 'entrevista'].includes(stage(m))).length },
    { clave: 'entrevista', etiqueta: 'Entrevista', n: ms.filter((m) => stage(m) === 'entrevista').length },
  ];
  return steps.map((s, i) => ({ ...s, pctDelAnterior: i === 0 || steps[i - 1]!.n === 0 ? null : Math.round((s.n / steps[i - 1]!.n) * 100) }));
}

function operacion(ctx: Ctx, kpis: Kpi[]) {
  const { data, f } = ctx;
  const now = data.now;
  const p = Math.min(f.dias, 90);
  const cur = now - f.dias * DAY;
  const rows = data.aiCost.filter((r) => inWindow(r.day, cur - DAY, now + 1));
  const byModel: Record<string, { calls: number; costUsd: number }> = {};
  for (const r of rows) {
    const m = (byModel[r.model] ??= { calls: 0, costUsd: 0 });
    m.calls += r.calls;
    m.costUsd += estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens));
  }
  const totalCost = costOf(rows);
  const userRows = data.aiUser.filter((r) => inWindow(r.day, cur - DAY, now + 1));
  const byFeature: Record<string, { calls: number; costUsd: number }> = {};
  const byUser = new Map<string, number>();
  for (const r of userRows) {
    const c = estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens));
    const ft = (byFeature[r.feature] ??= { calls: 0, costUsd: 0 });
    ft.calls += r.calls;
    ft.costUsd += c;
    byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + c);
  }
  const vig = data.miembros.filter(vigente).length;
  const trackedCost = [...byUser.values()].reduce((s, v) => s + v, 0);
  const budget = Number(process.env.AI_BUDGET_USD) > 0 ? Number(process.env.AI_BUDGET_USD) : 20;
  const gastadoRegistrado = costOf(data.aiCost);
  const errByKind: Record<string, number> = {};
  const windowErrors = data.errors.filter((e) => inWindow(e.created_at, cur, now + 1));
  for (const e of windowErrors) errByKind[e.kind] = (errByKind[e.kind] || 0) + 1;
  const limits = data.aiUsageToday.reduce<Record<string, number>>((o, r) => ((o[r.bucket || 'ai'] = (o[r.bucket || 'ai'] || 0) + r.count), o), {});
  return {
    kpis: kpis.filter((k) => ['costoIa', 'errores24h'].includes(k.id)),
    ia: {
      totalUsd: Math.round(totalCost * 1000) / 1000,
      llamadas: rows.reduce((s, r) => s + r.calls, 0),
      porDia: dailySeries(
        data.aiCost.map((r) => ({ t: r.day, v: estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens)) })),
        p,
        now
      ),
      porModelo: byModel,
      porFuncion: byFeature,
      costoPorMiembro: vig ? Math.round((totalCost / vig) * 10000) / 10000 : null,
      cobertura: totalCost > 0 ? Math.round((trackedCost / totalCost) * 100) : null, // % del costo ya atribuido a una función y miembro
      presupuesto: { usd: budget, gastadoRegistrado: Math.round(gastadoRegistrado * 1000) / 1000 },
    },
    errores: {
      total: windowErrors.length,
      porTipo: errByKind,
      porDia: dailySeries(data.errors.map((e) => ({ t: e.created_at, v: 1 })), p, now),
    },
    limites: { hoy: limits },
  };
}

// Fila de la foto diaria (siempre sin filtros)
export function snapshotRow(data: PanelData) {
  const ctx = buildCtx(data, { dias: 1 });
  const vig = ctx.miembros.filter(vigente);
  const hoy = dayKey(data.now);
  return {
    day: hoy,
    miembros_vigentes: vig.length,
    por_vencer: ctx.miembros.filter((m) => m.porVencer).length,
    vencidos: ctx.miembros.length - vig.length,
    activos_7d: ctx.miembros.filter((m) => m.diasSinEntrar !== null && m.diasSinEntrar <= 7).length,
    postulaciones_dia: data.events.filter((e) => entersPipeline(e) && e.created_at.slice(0, 10) === hoy).length,
    ingreso_estimado: ingresoEstimado(ctx.miembros, data.now, new Set((process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))).total,
  };
}
