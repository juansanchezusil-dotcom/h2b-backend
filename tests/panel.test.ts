/* eslint-disable @typescript-eslint/no-explicit-any -- el resultado de buildPanel cambia por vista; aquí solo se leen campos */
import { describe, expect, it } from 'vitest';
import { computeRadar, type RadarInput } from '../src/admin/radar';
import { buildPanel, etapaOf, ingresoEstimado, initials, maskEmail, parseFilters, planOf, snapshotRow, type PanelData } from '../src/admin/panel';

const DAY = 86_400_000;
const now = Date.parse('2026-12-10T15:00:00Z');
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

// 4 miembros: ana (mensual, activa, entrevista), luis (mensual, 12 días sin entrar), eva (anual de promo), tom (nunca entró)
function fixture(): PanelData {
  const accesos = [
    { email: 'ana@gmail.com', vence_el: iso(-10), origen: 'skool', created_at: iso(20) },
    { email: 'luis@gmail.com', vence_el: iso(-3), origen: 'skool', created_at: iso(27) },
    { email: 'eva@gmail.com', vence_el: iso(-300), origen: 'skool', created_at: iso(65) },
    { email: 'tom@gmail.com', vence_el: iso(-28), origen: 'skool', created_at: iso(2) },
  ];
  const users = new Map([
    ['ana@gmail.com', { id: 'u-ana', last_sign_in_at: iso(0) }],
    ['luis@gmail.com', { id: 'u-luis', last_sign_in_at: iso(12) }],
    ['eva@gmail.com', { id: 'u-eva', last_sign_in_at: iso(1) }],
  ]);
  const profiles = new Map([
    ['u-ana', { full_name: 'Ana Gómez', last_seen_at: iso(0), perfil_completado: true, hasCv: true }],
    ['u-luis', { full_name: 'Luis Pérez', last_seen_at: iso(12), perfil_completado: true, hasCv: true }],
    ['u-eva', { full_name: 'Eva Ríos', last_seen_at: iso(1), perfil_completado: false, hasCv: false }],
  ]);
  const statusCounts = new Map<string, Record<string, number>>([
    ['u-ana', { postulado: 3, entrevista: 1 }],
    ['u-luis', { postulado: 2, seguimiento: 1 }],
    ['u-eva', { guardadas: 4 }],
  ]);
  const events = [
    { user_id: 'u-ana', company_name: 'Resort A', from_status: 'guardadas', to_status: 'postulado', created_at: iso(3) },
    { user_id: 'u-ana', company_name: 'Resort B', from_status: 'guardadas', to_status: 'postulado', created_at: iso(2) },
    { user_id: 'u-ana', company_name: 'Resort B', from_status: 'postulado', to_status: 'entrevista', created_at: iso(1) },
    { user_id: 'u-luis', company_name: 'Hotel C', from_status: null, to_status: 'postulado', created_at: iso(40) },
  ];
  const radar: RadarInput = { accesos, users, profiles, statusCounts, events, now };
  const { miembros } = computeRadar(radar);
  return {
    now,
    radar,
    miembros,
    paisByUser: new Map([['u-ana', 'Perú']]),
    events,
    apps: [
      { user_id: 'u-ana', job_title: 'Housekeeper', status: 'postulado', reply_type: 'entrevista', created_at: iso(3) },
      { user_id: 'u-luis', job_title: 'Housekeeper', status: 'postulado', reply_type: null, created_at: iso(10) },
    ],
    accesos: accesos.map((a) => ({ ...a, activo: true })),
    leads: [{ created_at: iso(1) }],
    aiCost: [{ day: iso(1).slice(0, 10), model: 'claude-haiku-5-5', calls: 10, input_tokens: 1_000_000, output_tokens: 1_000_000 }],
    aiUser: [],
    aiUsageToday: [{ bucket: 'ai', count: 3 }],
    errors: [{ created_at: iso(0.2), kind: 'error' }],
    snapshots: [],
  };
}

describe('privacidad', () => {
  it('enmascara correos e iniciales', () => {
    expect(maskEmail('maria.lopez@gmail.com')).toBe('ma***@g***.com');
    expect(initials('Ana Gómez')).toBe('AG');
    expect(initials('luis@gmail.com')).toBe('L');
  });
});

describe('filtros de la URL', () => {
  it('acepta valores válidos y descarta el resto', () => {
    const f = parseFilters(new URLSearchParams('dias=7&plan=anual&etapa=postula&estado=activo'));
    expect(f).toMatchObject({ dias: 7, plan: 'anual', etapa: 'postula', estado: 'activo' });
    expect(parseFilters(new URLSearchParams('dias=abc&plan=xx&etapa=zz')).dias).toBe(30);
    expect(parseFilters(new URLSearchParams('plan=xx')).plan).toBeUndefined();
  });
});

describe('plan e ingreso estimado', () => {
  it('deduce el plan por la duración del acceso', () => {
    const { miembros } = fixture();
    const by = (e: string) => miembros.find((m) => m.email === e)!;
    expect(planOf(by('ana@gmail.com'))).toBe('mensual');
    expect(planOf(by('eva@gmail.com'))).toBe('anual');
  });

  it('suma mensual completo y anual dividido entre 12, con el precio de promo antes del 28-nov', () => {
    const { miembros } = fixture();
    const r = ingresoEstimado(miembros, now);
    // ana, luis y tom: 3 × $37. eva (alta hace 65 días = 6-oct): promo $259 / 12
    expect(r.porPlan.mensual).toEqual({ n: 3, usd: 111 });
    expect(r.porPlan.anual.n).toBe(1);
    expect(r.porPlan.anual.usd).toBeCloseTo(259 / 12, 2);
    expect(r.total).toBeCloseTo(111 + 259 / 12, 2);
  });

  it('no cuenta cuentas de prueba ni al administrador', () => {
    const { miembros } = fixture();
    const r = ingresoEstimado(miembros, now, new Set(['ana@gmail.com']));
    expect(r.excluidos).toBe(1);
    expect(r.porPlan.mensual.n).toBe(2);
    const prueba = miembros.map((m) => (m.email === 'luis@gmail.com' ? { ...m, origen: 'prueba' } : m));
    expect(ingresoEstimado(prueba, now).excluidos).toBe(1);
  });

  it('no cuenta las cortesías como ingreso y las informa aparte', () => {
    const { miembros } = fixture();
    const cortesia = miembros.map((m) => (m.email === 'luis@gmail.com' ? { ...m, origen: 'cortesia' } : m));
    const r = ingresoEstimado(cortesia, now);
    expect(r.cortesias).toBe(1);
    expect(r.porPlan.mensual.n).toBe(2);
  });

  it('el anual dado de alta desde el 28-nov cuesta 296', () => {
    const { miembros } = fixture();
    const eva = { ...miembros.find((m) => m.email === 'eva@gmail.com')!, diasDesdeAlta: 5 };
    const r = ingresoEstimado([eva], now);
    expect(r.porPlan.anual.usd).toBeCloseTo(296 / 12, 2);
  });
});

describe('etapa del miembro', () => {
  it('toma la más avanzada', () => {
    expect(etapaOf({ guardadas: 3 })).toBe('busca');
    expect(etapaOf({ postulado: 1 })).toBe('postula');
    expect(etapaOf({ postulado: 1, seguimiento: 1 })).toBe('seguimiento');
    expect(etapaOf({ entrevista: 1, postulado: 2 })).toBe('entrevista');
    expect(etapaOf({})).toBe('sin_empresas');
  });
});

describe('buildPanel', () => {
  const f = { dias: 30 };

  it('resumen: KPI, salud y embudo salen de los mismos datos', () => {
    const r = buildPanel(fixture(), f, 'resumen') as any;
    const k = (id: string) => r.kpis.find((x: any) => x.id === id);
    expect(k('miembros').valor).toBe(4);
    expect(k('postulaciones').valor).toBe(2); // eventos de ana dentro de 30 días; el de luis es de hace 40
    expect(k('entrevistas').valor).toBe(1);
    expect(k('leads').valor).toBe(1);
    expect(k('errores24h').valor).toBe(1);
    expect(k('costoIa').valor).toBeCloseTo(0.6, 3); // 1M in × $0.10 + 1M out × $0.50
    expect(r.embudo.map((e: any) => e.n)).toEqual([4, 3, 2, 2, 1]); // acceso, busca, postula, follow-up (ana y luis), entrevista (ana)
    expect(r.salud.valor).toBeGreaterThanOrEqual(0);
    expect(r.salud.valor).toBeLessThanOrEqual(100);
    expect(r.ingreso.total).toBeGreaterThan(0);
  });

  it('filtra por estado y por etapa de forma combinada', () => {
    const r = buildPanel(fixture(), { dias: 30, etapa: 'entrevista' }, 'resumen') as any;
    expect(r.muestra).toBe(1);
    const r2 = buildPanel(fixture(), { dias: 30, estado: 'activo', etapa: 'busca' }, 'resumen') as any;
    expect(r2.muestra).toBe(1); // eva: activa y solo guardó empresas
    const none = buildPanel(fixture(), { dias: 30, plan: 'anual', etapa: 'entrevista' }, 'resumen') as any;
    expect(none.muestra).toBe(0);
  });

  it('radar: por defecto no muestra correos ni notas, y con mostrar sí', () => {
    const oculto = buildPanel(fixture(), f, 'radar') as any;
    expect(JSON.stringify(oculto)).not.toContain('@gmail.com');
    expect(oculto.lista.length).toBeGreaterThan(0);
    const visible = buildPanel(fixture(), f, 'radar', true) as any;
    expect(JSON.stringify(visible)).toContain('@gmail.com');
  });

  it('insights: señala por vencer sin avanzar y avisa de muestras chicas', () => {
    const r = buildPanel(fixture(), f, 'resumen') as any;
    const ids = r.insights.map((i: any) => i.id);
    expect(ids).toContain('vence-sin-mover');
    expect(r.insights.every((i: any) => i.muestraChica === true)).toBe(true);
  });

  it('operación: costo por miembro y presupuesto', () => {
    const r = buildPanel(fixture(), f, 'operacion') as any;
    expect(r.ia.totalUsd).toBeCloseTo(0.6, 3);
    expect(r.ia.costoPorMiembro).toBeCloseTo(0.15, 3);
    expect(r.ia.presupuesto.usd).toBe(20);
    expect(r.limites.hoy.ai).toBe(3);
  });

  it('miembros: vencimientos próximos y cohortes', () => {
    const r = buildPanel(fixture(), f, 'miembros') as any;
    expect(r.vencimientos[0].dias).toBeLessThanOrEqual(r.vencimientos[r.vencimientos.length - 1].dias);
    expect(r.cohortes.reduce((s: number, c: any) => s + c.n, 0)).toBe(4);
    expect(r.paises).toEqual({ Perú: 1 });
  });

  it('la foto diaria usa los datos sin filtrar', () => {
    const s = snapshotRow(fixture());
    expect(s.miembros_vigentes).toBe(4);
    expect(s.por_vencer).toBe(1);
    expect(s.day).toBe('2026-12-10');
  });
});
