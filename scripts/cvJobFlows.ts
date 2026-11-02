// Prueba con el modelo real la carta de presentación y el CV adaptado a una oferta, con los MISMOS prompts
// y verificaciones de producción. Cada oferta pide cosas que el candidato NO tiene: no deben aparecer como suyas.
//
// Uso:  npx tsx scripts/cvJobFlows.ts [carpeta-de-salida]
// Necesita ANTHROPIC_API_KEY y GEMINI_API_KEY en .env.local. Cuesta centavos por corrida.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from '@google/genai';
import { generateTextWithFallback } from '../src/ai/callGemini';
import { buildCoverLetterPrompt, buildGeneratePrompt } from '../src/ai/cv/prompts';
import { emptyProfile } from '../src/ai/cv/profile';
import { buildVerifiedCv, buildVerifiedLetter, cvToText, verifyRequirements } from '../src/ai/cv/build';
import type { CandidateProfile } from '../src/ai/cv/types';
import { asRaw } from '../src/utils/raw';

const maria: CandidateProfile = {
  ...emptyProfile(),
  fullName: 'María Quispe', city: 'Cusco, Perú', phone: '+51 984 222 111', email: 'maria.quispe84@gmail.com',
  targetRole: 'Housekeeper', industry: 'Hotelería', englishLevel: 'básico', route: 'A',
  availability: 'de abril a octubre', passport: 'yes',
  experiences: [{
    id: 'e1', kind: 'formal', autonomy: 'solo', supervision: '', title: 'Camarera de pisos',
    company: 'Hotel Casa Andina Cusco', location: 'Cusco, Perú', dates: 'marzo 2019 a diciembre 2024', duration: '5 años y 9 meses',
    tasks: ['Limpiaba unas 14 habitaciones por turno', 'Cambiaba sábanas', 'Limpiaba baños y reponía amenities'],
    tools: ['Carrito de limpieza', 'Aspiradora'], results: [],
  }],
};

const pedro: CandidateProfile = {
  ...emptyProfile(),
  fullName: 'Pedro Gómez', city: 'Saltillo, Coahuila, México', phone: '+52 844 111 2233', email: 'pedro.gomez.h2b@gmail.com',
  targetRole: 'Landscaping', industry: 'Landscaping', englishLevel: 'básico', route: 'A',
  availability: 'de marzo a noviembre', passport: 'yes',
  experiences: [{
    id: 'e1', kind: 'formal', autonomy: 'supervisado', supervision: '', title: 'Trabajador de mantenimiento de jardines en cuadrilla',
    company: 'Green Valley Landscaping', location: 'Austin, Texas', dates: '2022 y 2023 (temporadas)', duration: '2 temporadas',
    tasks: ['Mantenía unos 25 jardines por semana con la cuadrilla', 'Operaba podadora y sopladora'],
    tools: ['Podadora John Deere', 'Sopladora'], results: [],
  }],
};

const CASES = [
  {
    id: 'maria-hotel', profile: maria,
    job: {
      title: 'Housekeeper / Room Attendant', employer_name: 'Lakeside Resort',
      job_duties: 'Clean 16 guest rooms per day. Must have 2 years of hotel housekeeping experience. Intermediate English required. Must supervise a team of 3 room attendants. Forklift certification preferred. Employer sponsors H-2B visas.',
    },
    // Lo que la oferta pide y ella no tiene: nunca puede aparecer como suyo
    forbidden: [/forklift/i, /supervis/i, /intermediate/i, /sponsor/i, /\b16\b/],
    notMatch: [/supervise|supervis/i, /forklift/i, /english|ingl[eé]s/i],
  },
  {
    id: 'pedro-landscape', profile: pedro,
    job: {
      title: 'Landscape Crew Leader', employer_name: 'Sunrise Grounds LLC',
      job_duties: 'Lead a crew of 5 workers. Valid CDL driver license required. State pesticide applicator license required. Operate zero-turn mowers and skid steers. Fluent English.',
    },
    forbidden: [/\bCDL\b/, /pesticide/i, /skid steer/i, /zero-turn/i, /crew leader/i, /\blead\b|\bled\b/i, /fluent/i, /\b5\b/],
    notMatch: [/lead|lider/i, /cdl|licencia de conducir/i, /pesticid/i, /skid/i, /english|ingl[eé]s/i],
  },
];

async function ask(ai: GoogleGenAI, prompt: string) {
  const text = await generateTextWithFallback(ai, {
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  }, { tier: 'quality' });
  return asRaw(JSON.parse(text || '{}'));
}

const hits = (text: string, patterns: RegExp[]) => patterns.filter((p) => p.test(text)).map(String);

async function main() {
  const outDir = process.argv[2] || 'cv-job-flows';
  mkdirSync(outDir, { recursive: true });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  let failed = 0;

  for (const c of CASES) {
    const issues: string[] = [];

    const general = buildVerifiedLetter(c.profile, await ask(ai, buildCoverLetterPrompt({ profile: c.profile, job: null })), null);
    if (!general.letter) issues.push('carta general vacía');

    const parsedLetter = await ask(ai, buildCoverLetterPrompt({ profile: c.profile, job: c.job }));
    const adapted = buildVerifiedLetter(c.profile, parsedLetter, c.job);
    if (!adapted.letter) issues.push('carta para la oferta vacía');

    const parsedCv = await ask(ai, buildGeneratePrompt({ profile: c.profile, job: c.job }));
    const { cv, removed } = buildVerifiedCv(c.profile, parsedCv);
    const cvText = cvToText(cv);
    const requirements = verifyRequirements(c.profile, parsedCv.requirements);

    for (const [name, text] of [['carta general', general.letter], ['carta oferta', adapted.letter], ['CV adaptado', cvText]] as const) {
      // Nombrar el puesto al que postula no es atribuirse esa experiencia
      const found = hits(text.replaceAll(c.job.title, ''), c.forbidden);
      if (found.length) issues.push(`${name} menciona: ${found.join(', ')}`);
    }
    if (!requirements.length) issues.push('sin matriz de requisitos');
    for (const r of requirements) {
      if ((r.status === 'MATCH' || r.status === 'TRANSFERABLE') && hits(r.requirement_es, c.notMatch).length) {
        issues.push(`requisito marcado ${r.status}: ${r.requirement_es}`);
      }
    }

    writeFileSync(join(outDir, `${c.id}.json`), JSON.stringify({
      id: c.id, issues, generalLetter: general, jobLetter: adapted, notes_es: parsedLetter.notes_es,
      cv: cvText, removed, requirements, diagnostico_es: parsedCv.diagnostico_es, estrategia_es: parsedCv.estrategia_es,
    }, null, 2));

    if (issues.length) failed++;
    console.log(`${issues.length ? '❌' : '✅'} ${c.id}${issues.length ? ` — ${issues.join(' | ')}` : ''}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
