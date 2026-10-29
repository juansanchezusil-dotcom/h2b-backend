import { describe, expect, it } from 'vitest';
import { errMsg } from '../src/utils/errors';
import { fingerprintOf } from '../src/errors/clientErrors';
import { jobMatchesRole } from '../src/jobs/roleMatch';

describe('errMsg', () => {
  it('lee el mensaje de lo que llegue a un catch', () => {
    expect(errMsg(new Error('falló'))).toBe('falló');
    expect(errMsg('texto')).toBe('texto');
    expect(errMsg({ message: 'de supabase' })).toBe('de supabase');
    expect(errMsg(null)).toBe('');
    expect(errMsg(42)).toBe('');
  });
});

describe('fingerprintOf', () => {
  it('agrupa el mismo error aunque cambien números y líneas', () => {
    const a = fingerprintOf('error', 'No se encontró la oferta 123', 'Error\n    at load (page.js:10:5)');
    const b = fingerprintOf('error', 'No se encontró la oferta 987', 'Error\n    at load (page.js:44:9)');
    expect(a).toBe(b);
  });
  it('separa errores distintos', () => {
    expect(fingerprintOf('error', 'A', null)).not.toBe(fingerprintOf('error', 'B', null));
    expect(fingerprintOf('error', 'A', null)).not.toBe(fingerprintOf('promesa', 'A', null));
  });
});

describe('jobMatchesRole (avisos de ofertas nuevas)', () => {
  it.each([
    ['Housekeeper', 'Camarera de pisos', ''],
    ['Landscape Laborer', 'jardinero', ''],
    ['Line Cook', '', 'cocina'],
  ])('"%s" calza con el puesto "%s" / industria "%s"', (title, role, industry) => {
    expect(jobMatchesRole(title, role, industry)).toBe(true);
  });
  it('no calza con otro rubro', () => {
    expect(jobMatchesRole('Truck Driver', 'housekeeper', '')).toBe(false);
  });
  it('sin puesto ni industria no avisa', () => {
    expect(jobMatchesRole('Housekeeper', '', '')).toBe(false);
  });
});
