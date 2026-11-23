import { describe, expect, it } from 'vitest';
import { CLOSING_QUESTION, OPENING_QUESTIONS, TOTAL_QUESTIONS, buildNextPrompt, employerStageGuide } from '../src/ai/interviewSim';

const candidate = { role: 'Line Cook', industry: 'Cocina', englishLevel: 'Básico', cvText: '' };

describe('guion de la entrevista del empleador', () => {
  it('abre con presentarse y experiencia laboral', () => {
    expect(employerStageGuide(1)).toContain(OPENING_QUESTIONS[0]);
    expect(employerStageGuide(2)).toContain(OPENING_QUESTIONS[1]);
  });
  it('luego pregunta el tipo de lugar y las habilidades del oficio', () => {
    expect(employerStageGuide(3)).toMatch(/TIPO de lugar/);
    expect(employerStageGuide(4)).toMatch(/TIPO de lugar/);
    for (const n of [5, 6, 7]) expect(employerStageGuide(n)).toMatch(/Habilidades específicas/);
  });
  it('cierra con vivienda y con las preguntas finales', () => {
    expect(employerStageGuide(TOTAL_QUESTIONS - 1)).toMatch(/vivienda/i);
    expect(employerStageGuide(TOTAL_QUESTIONS)).toContain(CLOSING_QUESTION);
  });
  it('no inventa datos de vivienda', () => {
    expect(employerStageGuide(TOTAL_QUESTIONS - 1)).toMatch(/NUNCA inventes/);
  });
  it('se aplica solo al módulo del empleador', () => {
    const employer = buildNextPrompt({ module: 'employer', candidate, turns: [] });
    const consular = buildNextPrompt({ module: 'consular', candidate, turns: [] });
    expect(employer).toContain(OPENING_QUESTIONS[0]);
    expect(consular).not.toContain('ETAPA DE ESTA PREGUNTA');
  });
});
