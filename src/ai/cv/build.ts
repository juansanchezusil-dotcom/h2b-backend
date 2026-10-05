import type { CandidateProfile } from './types';
import { factIndex } from './profile';

export interface CvBullet {
  text: string;
}
export interface CvExperience {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: CvBullet[];
}
export interface BuiltCv {
  header: { fullName: string; city: string; phone: string; email: string };
  summary: string;
  experiences: CvExperience[];
  skills: string[];
  education: string[];
  certifications: string[];
  languages: string[];
  sectionTitle: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numbersIn = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) || [];

const ENGLISH_LEVELS: Record<string, string> = {
  basico: 'Basic', 'básico': 'Basic', intermedio: 'Intermediate', avanzado: 'Advanced',
  'avanzado / fluido': 'Advanced', fluido: 'Fluent', nativo: 'Native',
};

function englishLevelLabel(level: string): string {
  const key = level.trim().toLowerCase();
  return ENGLISH_LEVELS[key] || level.trim();
}

// Arma el CV a partir de lo que devolvió el modelo, pero SOLO con lo que se puede respaldar:
// - nombre, empresa, lugar y contacto salen del perfil del usuario, nunca del modelo;
// - un bullet sin referencias válidas a datos de esa experiencia se descarta;
// - cualquier número (cifra, porcentaje, año) debe existir en los datos del usuario.
// Devuelve el CV verificado y cuántas frases se descartaron.
export function buildVerifiedCv(profile: CandidateProfile, model: any): { cv: BuiltCv; removed: number } {
  const facts = factIndex(profile);
  const allowedNumbers = new Set(numbersIn(JSON.stringify(profile)));
  const numbersOk = (text: string) => numbersIn(text).every((n) => allowedNumbers.has(n));
  let removed = 0;

  const modelExps: any[] = Array.isArray(model?.experiences) ? model.experiences : [];
  const experiences: CvExperience[] = profile.experiences.map((exp) => {
    const m = modelExps.find((x) => x?.id === exp.id) || {};
    const titleEn = clip(m.title_en, 100);
    const datesEn = clip(m.dates_en, 80);
    const bullets: CvBullet[] = [];
    for (const b of Array.isArray(m.bullets) ? m.bullets : []) {
      const text = clip(b?.text, 400);
      const refs: string[] = Array.isArray(b?.refs) ? b.refs : [];
      const validRef = refs.some((r) => typeof r === 'string' && r.startsWith(`${exp.id}.`) && facts.has(r));
      if (!text || !validRef || !numbersOk(text)) {
        removed++;
        continue;
      }
      bullets.push({ text });
    }
    return {
      title: titleEn && numbersOk(titleEn) ? titleEn : exp.title,
      company: exp.company,
      location: exp.location,
      dates: datesEn && numbersOk(datesEn) ? datesEn : exp.dates || exp.duration,
      bullets: bullets.slice(0, 6),
    };
  });

  const sentences = clip(model?.summary, 700).split(/(?<=[.!?])\s+/).filter(Boolean);
  const keptSentences = sentences.filter((s) => numbersOk(s));
  removed += sentences.length - keptSentences.length;

  const strings = (v: unknown, max: number, maxLen: number) =>
    (Array.isArray(v) ? v : []).map((x) => clip(x, maxLen)).filter(Boolean).slice(0, max);

  const languages = profile.languages.filter((l) => !/english|ingl[eé]s/i.test(l));
  if (profile.englishLevel) languages.push(`English (${englishLevelLabel(profile.englishLevel)})`);

  return {
    removed,
    cv: {
      header: { fullName: profile.fullName, city: profile.city, phone: profile.phone, email: profile.email },
      summary: keptSentences.join(' '),
      experiences,
      skills: strings(model?.skills, 10, 40),
      education: strings(model?.education, profile.education.length, 160),
      certifications: strings(model?.certifications, profile.certifications.length, 160),
      languages,
      sectionTitle: profile.route === 'C' ? 'RELEVANT PRACTICAL EXPERIENCE' : 'PROFESSIONAL EXPERIENCE',
    },
  };
}

// Texto plano del CV, armado por código a partir del CV ya verificado.
export function cvToText(cv: BuiltCv): string {
  const out: string[] = [];
  out.push(cv.header.fullName.toUpperCase());
  const contact = [cv.header.city, cv.header.phone, cv.header.email].filter(Boolean).join(' | ');
  if (contact) out.push(contact);
  if (cv.summary) out.push('', 'SUMMARY', cv.summary);

  const exps = cv.experiences.filter((e) => e.title && (e.bullets.length > 0 || e.dates));
  if (exps.length) {
    out.push('', cv.sectionTitle);
    for (const e of exps) {
      const head = [e.title, [e.company, e.location].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
      out.push('', head);
      if (e.dates) out.push(e.dates);
      for (const b of e.bullets) out.push(`• ${b.text}`);
    }
  }
  if (cv.skills.length) out.push('', 'SKILLS', cv.skills.join(', '));
  if (cv.education.length) out.push('', 'EDUCATION', ...cv.education);
  if (cv.certifications.length) out.push('', 'CERTIFICATIONS', ...cv.certifications);
  if (cv.languages.length) out.push('', 'LANGUAGES', cv.languages.join(' | '));
  return out.join('\n');
}
