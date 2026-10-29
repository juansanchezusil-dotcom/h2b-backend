// Lo que protege a los CV de datos inventados: si algo de esto se rompe, un CV podría exagerar a la persona.
import { describe, expect, it } from 'vitest';
import { buildVerifiedCv, cvToText } from '../src/ai/cv/build';
import { computeGaps, emptyProfile, mergeProfile } from '../src/ai/cv/profile';
import type { CandidateProfile } from '../src/ai/cv/types';

function profile(over: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    ...emptyProfile(),
    fullName: 'Carlos Ajú',
    phone: '+502 5555 7788',
    targetRole: 'Construction laborer',
    englishLevel: 'básico',
    route: 'A',
    experiences: [
      {
        id: 'e1', kind: 'formal', autonomy: 'ayudaba', supervision: '', title: 'Ayudante de albañil',
        company: 'Constructora Pérez', location: 'Quetzaltenango', dates: '2021 - 2024', duration: '3 años',
        tasks: ['Mezclaba concreto', 'Cargaba material'], tools: ['Pala', 'Carretilla'], results: [],
      },
    ],
    ...over,
  };
}

const model = (bullets: { text: string; refs: string[] }[], summary = 'Construction helper with experience.') => ({
  summary,
  headline_en: 'Construction Laborer',
  experiences: [{ id: 'e1', title_en: "Mason's Helper", dates_en: '2021 - 2024', bullets }],
  skills: ['Concrete mixing'],
});

describe('buildVerifiedCv', () => {
  it('descarta bullets sin referencias válidas', () => {
    const { cv, removed } = buildVerifiedCv(profile(), model([
      { text: 'Mixed concrete for block walls.', refs: ['e1.t1'] },
      { text: 'Operated heavy machinery.', refs: [] },
      { text: 'Poured foundations.', refs: ['e9.t1'] },
    ]));
    expect(cv.experiences[0].bullets.map((b) => b.text)).toEqual(['Mixed concrete for block walls.']);
    expect(removed).toBe(2);
  });

  it('descarta números que la persona no dio', () => {
    const { cv } = buildVerifiedCv(profile(), model([
      { text: 'Mixed 40 bags of concrete per day.', refs: ['e1.t1'] },
      { text: 'Loaded materials.', refs: ['e1.t2'] },
    ]));
    expect(cvToText(cv)).not.toContain('40');
  });

  it('no deja verbos de liderazgo si la persona no enseñaba ni supervisaba', () => {
    const { cv } = buildVerifiedCv(profile(), model(
      [{ text: 'Supervised the concrete crew.', refs: ['e1.t1'] }, { text: 'Loaded materials.', refs: ['e1.t2'] }],
      'Led a team of workers. Construction helper with experience.'
    ));
    const text = cvToText(cv);
    expect(text).not.toMatch(/supervised|led a team/i);
    expect(text).toContain('Loaded materials.');
  });

  it('el nombre y la empresa salen del perfil, no del modelo', () => {
    const { cv } = buildVerifiedCv(profile(), { ...model([{ text: 'Loaded materials.', refs: ['e1.t2'] }]), fullName: 'Otro Nombre' });
    expect(cvToText(cv)).toContain('CARLOS AJÚ');
    expect(cvToText(cv)).toContain('Constructora Pérez');
  });

  it.each([
    ['básico', 'English: Basic'],
    ['Básico (aprendido en la escuela, casi no lo usa)', 'English: Basic'],
    ['intermedio', 'English: Intermediate'],
    ['me defiendo, nivel avanzado', 'English: Advanced'],
  ])('traduce el nivel de inglés "%s"', (level, expected) => {
    const { cv } = buildVerifiedCv(profile({ englishLevel: level }), model([{ text: 'Loaded materials.', refs: ['e1.t2'] }]));
    expect(cv.languages).toContain(expected);
  });

  it.each(['nada', 'Nada (no habla inglés)', 'ninguno', 'algo raro'])('no pone inglés en español en el CV ("%s")', (level) => {
    const { cv } = buildVerifiedCv(profile({ englishLevel: level }), model([{ text: 'Loaded materials.', refs: ['e1.t2'] }]));
    expect(cv.languages.join(' ')).not.toMatch(/english/i);
    expect(cv.languages).toContain('Spanish: Native');
  });
});

describe('computeGaps', () => {
  const critical = (p: CandidateProfile) => computeGaps(p).filter((g) => g.level === 'critical').map((g) => g.key);

  it('un perfil completo no tiene faltantes críticos', () => {
    expect(critical(profile())).toEqual([]);
  });

  it('exige un teléfono o correo', () => {
    expect(critical(profile({ phone: '' }))).toContain('contact');
    expect(critical(profile({ phone: '', email: 'a@b.com' }))).not.toContain('contact');
  });

  it('la ruta sin definir no bloquea (la decide el modelo, no la persona)', () => {
    expect(critical(profile({ route: '' }))).not.toContain('route');
  });

  it('exige el nivel de inglés', () => {
    expect(critical(profile({ englishLevel: '' }))).toContain('englishLevel');
  });

  it('si a la experiencia solo le falta el tiempo, lo pide por su nombre', () => {
    const p = profile();
    p.experiences[0] = { ...p.experiences[0], dates: '', duration: '' };
    const gap = computeGaps(p).find((g) => g.key === 'experience_time');
    expect(gap?.level).toBe('critical');
    expect(gap?.label).toContain('Ayudante de albañil');
  });
});

describe('mergeProfile', () => {
  it('agrega datos a la misma experiencia por id sin duplicarla', () => {
    const merged = mergeProfile(profile(), { experiences: [{ id: 'e1', tools: ['Nivel'] }] });
    expect(merged.experiences).toHaveLength(1);
    expect(merged.experiences[0].tools).toContain('Nivel');
  });
});
