import { describe, expect, it } from 'vitest';
import { errMsg } from '../src/utils/errors';
import { fingerprintOf } from '../src/errors/clientErrors';
import { jobMatchesRole, routeOfJob } from '../src/jobs/roleMatch';

describe('routeOfJob (Ruta A y Ruta B en los avisos)', () => {
  const p = { target_role: null, industry: null, experiencia_industria: 'Cocina / Restaurantes', experiencia_industria_b: 'Hotelería / Limpieza' };
  it('la oferta de la Ruta A sale como A y la de la B como B', () => {
    expect(routeOfJob('Line Cook', p)).toBe('A');
    expect(routeOfJob('Housekeeper', p)).toBe('B');
  });
  it('otro rubro no es de ninguna ruta', () => {
    expect(routeOfJob('Truck Driver', p)).toBeNull();
  });
  it('sin Ruta B solo avisa de la A', () => {
    expect(routeOfJob('Housekeeper', { ...p, experiencia_industria_b: null })).toBeNull();
  });
  it('"Sin Experiencia" no cuenta como ruta', () => {
    expect(routeOfJob('Line Cook', { experiencia_industria: 'Sin Experiencia' })).toBeNull();
  });
  it('si la oferta calza con las dos, gana la A', () => {
    expect(routeOfJob('Kitchen Helper', { experiencia_industria: 'Cocina / Restaurantes', experiencia_industria_b: 'Cocina / Lavaplatos (Dishwasher)' })).toBe('A');
  });
  it.each([
    ['Construction Laborer', 'Construcción'],
    ['Carpenter', 'Carpintero / Carpenter'],
    ['Server', 'Mesero / Server'],
    ['Front Desk Agent', 'Recepción / Front desk'],
    ['Landscaper', 'Paisajismo / Jardinería'],
  ])('"%s" calza con el puesto del cuestionario "%s"', (title, value) => {
    expect(routeOfJob(title, { experiencia_industria: value })).toBe('A');
  });
});

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
