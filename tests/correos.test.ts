import { describe, it, expect } from 'vitest';
import { correosPorMiembro } from '../src/admin/correosPorMiembro';
import type { Miembro } from '../src/admin/radar';

const DAY = 86400000;
const now = Date.parse('2026-11-09T12:00:00Z');
const m = (email: string, diasSinEntrar: number | null) => ({ email, nombre: null, estado: 'inactivo', diasSinEntrar, contactadoEl: null }) as unknown as Miembro;
const log = (user_id: string, kind: string, diasAtras: number) => ({ user_id, kind, created_at: new Date(now - diasAtras * DAY).toISOString() });

describe('correosPorMiembro', () => {
  const ids = new Map([['a@x.com', 'a'], ['b@x.com', 'b'], ['c@x.com', 'c']]);

  it('cuenta solo los correos enviados después de la última visita', () => {
    const r = correosPorMiembro([m('a@x.com', 27)], ids, [log('a', 'reengage', 16), log('a', 'reengage', 8), log('a', 'reto_30', 1), log('a', 'reengage', 40)], new Set(), now, true);
    expect(r[0].sinRespuesta).toBe(3);
    expect(r[0].veredicto.tono).toBe('alto');
    expect(r[0].enviados[0].tipo).toBe('reto_30');
  });

  it('marca al miembro que volvió después del correo', () => {
    const r = correosPorMiembro([m('b@x.com', 2)], ids, [log('b', 'reengage', 10)], new Set(), now, true);
    expect(r[0].sinRespuesta).toBe(0);
    expect(r[0].veredicto.tono).toBe('ok');
  });

  it('respeta la baja y oculta correos por defecto, y ordena lo urgente primero', () => {
    const r = correosPorMiembro([m('b@x.com', 2), m('c@x.com', 20), m('a@x.com', 27)], ids, [log('a', 'reengage', 5), log('a', 'reengage', 3)], new Set(['c']), now, false);
    expect(r[0].veredicto.tono).toBe('alto');
    expect(r.find((x) => x.baja)?.veredicto.tono).toBe('aviso');
    expect(r.every((x) => x.correo.includes('***'))).toBe(true);
  });
});
