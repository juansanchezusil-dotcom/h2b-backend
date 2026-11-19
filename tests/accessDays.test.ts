import { describe, expect, it } from 'vitest';
import { defaultAccessDays } from '../src/admin/accessDays';

const lima = (iso: string) => Date.parse(`${iso}-05:00`);

describe('defaultAccessDays', () => {
  it('fundadores que entran antes del 25-nov reciben 30', () => {
    expect(defaultAccessDays(true, lima('2026-11-24T23:59:59'))).toBe(30);
  });
  it('persona nueva desde el 25-nov 00:00 Lima recibe 35', () => {
    expect(defaultAccessDays(true, lima('2026-11-25T00:00:00'))).toBe(35);
    expect(defaultAccessDays(true, lima('2026-12-24T23:59:59'))).toBe(35);
  });
  it('renovación o reactivación recibe 30 aun dentro del lanzamiento', () => {
    expect(defaultAccessDays(false, lima('2026-11-30T12:00:00'))).toBe(30);
  });
  it('desde el 25-dic vuelve a 30', () => {
    expect(defaultAccessDays(true, lima('2026-12-25T00:00:00'))).toBe(30);
  });
});
