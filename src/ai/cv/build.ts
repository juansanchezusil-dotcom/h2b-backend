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

export type RequirementStatus = 'MATCH' | 'TRANSFERABLE' | 'MISSING' | 'UNKNOWN';

export interface Requirement {
  requirement_es: string;
  status: RequirementStatus;
}

const STATUSES: RequirementStatus[] = ['MATCH', 'TRANSFERABLE', 'MISSING', 'UNKNOWN'];

// Matriz oferta vs. candidato. Un requisito solo puede salir como MATCH o TRANSFERABLE si cita
// al menos un dato real del candidato; si no, baja a UNKNOWN. Así un faltante nunca se convierte
// en coincidencia por invención del modelo.
export function verifyRequirements(profile: CandidateProfile, raw: unknown): Requirement[] {
  const facts = factIndex(profile);
  return (Array.isArray(raw) ? raw : [])
    .slice(0, 8)
    .map((r: any): Requirement | null => {
      const text = clip(r?.requirement_es, 200);
      if (!text) return null;
      let status: RequirementStatus = STATUSES.includes(r?.status) ? r.status : 'UNKNOWN';
      if (status === 'MATCH' || status === 'TRANSFERABLE') {
        const refs: unknown[] = Array.isArray(r?.refs) ? r.refs : [];
        if (!refs.some((ref) => typeof ref === 'string' && facts.has(ref))) status = 'UNKNOWN';
      }
      return { requirement_es: text, status };
    })
    .filter((r): r is Requirement => r !== null);
}

// Arma la carta con saludo y firma puestos por código. Cada oración debe tener solo números
// que existan en los datos del candidato o en la oferta, y ninguna puede hablar de patrocinio.
export function buildVerifiedLetter(
  profile: CandidateProfile,
  model: any,
  job: { title?: string; employer_name?: string; job_duties?: string } | null
): { letter: string; removed: number } {
  const allowedNumbers = new Set(numbersIn(JSON.stringify(profile) + ' ' + JSON.stringify(job || {})));
  let removed = 0;
  const paragraphs: string[] = [];

  for (const para of (Array.isArray(model?.paragraphs) ? model.paragraphs : []).slice(0, 3)) {
    const sentences = clip(para, 900).split(/(?<=[.!?])\s+/).filter(Boolean);
    const kept = sentences.filter((s) => numbersIn(s).every((n) => allowedNumbers.has(n)) && !/sponsor/i.test(s));
    removed += sentences.length - kept.length;
    if (kept.length) paragraphs.push(kept.join(' '));
  }

  const body = paragraphs.join('\n\n');
  return {
    removed,
    letter: body ? `Dear Hiring Manager,\n\n${body}\n\nSincerely,\n${profile.fullName}` : '',
  };
}
