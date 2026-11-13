import type { CandidateProfile } from './types';
import { factIndex } from './profile';
import { asArray, asRaw } from '../../utils/raw';

export interface CvBullet {
  text: string;
}
export interface CvExperience {
  heading: string; // la empresa (empleo formal) o el cargo (trabajo informal o sin empresa)
  subtitle: string; // el cargo (empleo formal) o "Family / informal work"
  location: string;
  dates: string;
  bullets: CvBullet[];
}
export interface BuiltCv {
  header: { fullName: string; city: string; phone: string; email: string; teams: string };
  headline: string; // el puesto al que apunta, en inglés
  summary: string;
  experiences: CvExperience[];
  skills: string[];
  education: string[];
  certifications: string[];
  languages: string[];
  availability: string;
  sectionTitle: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numbersIn = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) || [];

// ---- Control de "ayudé" vs. "fui responsable de"
// Liderar o supervisar solo se puede decir si la persona enseña o supervisa a otros (nivel "ensena")
// y lo dijo (campo supervision). "Trained in safety" (recibió capacitación) no cuenta como liderazgo.
const LEADERSHIP =
  /\b(led|supervised|supervising|directed|oversaw|headed|coached|mentored|trained (new|other|junior|staff|team|co-?workers?|employees|colleagues|\d+)|managed (an? |the |our )?([\w-]+ ){0,2}(team|staff|crew|employees|workers|people|group|department|shift)|in charge of (an? |the |our )?([\w-]+ ){0,2}(team|staff|crew|people|workers|shift))\b/i;
const OWN_RESPONSIBILITY = /\b(responsible for|in charge of)\b/i;
const INDEPENDENCE = /\b(independently|single-handedly|on (his|her|their) own|solely)\b/i;

// "Managed reservations" sin liderazgo se suaviza a "Handled reservations" (en viñetas y en el resumen) en vez de perder la frase
function softenManaging(text: string): string {
  return text
    .replace(/\bmanaged\b/g, 'handled')
    .replace(/\bManaged\b/g, 'Handled')
    .replace(/\bmanaging\b/g, 'handling')
    .replace(/\bManaging\b/g, 'Handling');
}

// true si la frase afirma más de lo que el nivel de la experiencia respalda
function overstates(text: string, level: string, canLead: boolean): boolean {
  if (LEADERSHIP.test(text) && !canLead) return true;
  // sin nivel declarado se trata como el más modesto ("ayudaba")
  if ((level === '' || level === 'ayudaba') && (OWN_RESPONSIBILITY.test(text) || INDEPENDENCE.test(text))) return true;
  if (level === 'supervisado' && INDEPENDENCE.test(text)) return true;
  return false;
}

// La persona describe su inglés con sus palabras ("básico, de la escuela", "nada", "me defiendo"):
// se toma el nivel por palabra clave. Si no habla inglés o no se entiende el nivel, la línea no va al CV
// (nunca se copia el texto en español).
function englishLevelLabel(level: string): string {
  const t = level.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(nada|ninguno|ninguna|no hablo|no habla|cero|none)\b/.test(t)) return '';
  if (/\b(nativo|native|bilingue)\b/.test(t)) return 'Native';
  if (/\b(fluido|fluent)\b/.test(t)) return 'Fluent';
  if (/\b(avanzado|advanced)\b/.test(t)) return 'Advanced';
  if (/\b(intermedio|intermediate)\b/.test(t)) return 'Intermediate';
  if (/\b(basico|basic|poco|elemental)\b/.test(t)) return 'Basic';
  return '';
}

// El modelo a veces agrega la empresa o el lugar al cargo ("Crew Worker, Green Valley, Austin"), y el CV ya los
// muestra aparte: se quitan los tramos que estén en la empresa o el lugar de la persona.
function titleOnly(title: string, exp: { company: string; location: string }): string {
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const known = plain(`${exp.company}, ${exp.location}`);
  const [first, ...rest] = title.split(',');
  return [first, ...rest.filter((part) => !known.includes(plain(part)))].join(',').trim();
}

// Arma el CV a partir de lo que devolvió el modelo, pero SOLO con lo que se puede respaldar:
// - nombre, empresa, lugar y contacto salen del perfil del usuario, nunca del modelo;
// - un bullet sin referencias válidas a datos de esa experiencia se descarta;
// - cualquier número (cifra, porcentaje, año) debe existir en los datos del usuario.
// Devuelve el CV verificado y cuántas frases se descartaron.
export function buildVerifiedCv(profile: CandidateProfile, modelOutput: unknown): { cv: BuiltCv; removed: number } {
  const model = asRaw(modelOutput);
  const facts = factIndex(profile);
  const allowedNumbers = new Set(numbersIn(JSON.stringify(profile)));
  const numbersOk = (text: string) => numbersIn(text).every((n) => allowedNumbers.has(n));
  let removed = 0;
  const anyoneLeads = profile.experiences.some((e) => e.autonomy === 'ensena' && !!e.supervision);

  const modelExps = asArray(model.experiences).map(asRaw);
  const experiences: CvExperience[] = profile.experiences.flatMap((exp): CvExperience[] => {
    const m = modelExps.find((x) => x.id === exp.id) || {};
    // Si solo lo vio hacer, no es experiencia: no entra al CV
    if (exp.autonomy === 'observo') {
      removed += asArray(m.bullets).length;
      return [];
    }
    const canLead = exp.autonomy === 'ensena' && !!exp.supervision;
    const titleEn = clip(m.title_en, 100);
    const datesEn = clip(m.dates_en, 80);
    const title = titleEn && numbersOk(titleEn) ? titleOnly(titleEn, exp) : exp.title;
    const informal = exp.kind === 'informal';
    const useCompany = !informal && !!exp.company;
    const bullets: CvBullet[] = [];
    for (const b of asArray(m.bullets).map(asRaw)) {
      let text = clip(b.text, 400);
      const refs = asArray(b.refs);
      const validRef = refs.some((r) => typeof r === 'string' && r.startsWith(`${exp.id}.`) && facts.has(r));
      if (!text || !validRef || !numbersOk(text) || overstates(text, exp.autonomy, canLead)) {
        removed++;
        continue;
      }
      if (!canLead) text = softenManaging(text);
      bullets.push({ text });
    }
    return [
      {
        heading: useCompany ? exp.company : title,
        subtitle: useCompany ? title : informal ? 'Family / informal work' : '',
        location: exp.location,
        dates: datesEn && numbersOk(datesEn) ? datesEn : exp.dates || exp.duration,
        bullets: bullets.slice(0, 4),
      },
    ];
  });

  const sentences = clip(model.summary, 900).split(/(?<=[.!?])\s+/).filter(Boolean);
  const keptSentences = sentences.filter((s) => numbersOk(s) && (anyoneLeads || !LEADERSHIP.test(s)));
  removed += sentences.length - keptSentences.length;

  const strings = (v: unknown, max: number, maxLen: number) =>
    (Array.isArray(v) ? v : []).map((x) => clip(x, maxLen)).filter(Boolean).slice(0, max);

  // Como en la plantilla: Spanish, English, otros. El español nativo se da por hecho porque toda
  // la entrevista se hace en español; el inglés sale solo con el nivel que la persona declaró.
  const languages = ['Spanish: Native'];
  const english = englishLevelLabel(profile.englishLevel || '');
  if (english) languages.push(`English: ${english}`);
  languages.push(...profile.languages.filter((l) => !/english|ingl[eé]s|spanish|espa[ñn]ol/i.test(l)));

  const headlineEn = clip(model.headline_en, 60);
  const availabilityEn = clip(model.availability_en, 300);
  const availabilityParts: string[] = [];
  if (profile.availability && availabilityEn && numbersOk(availabilityEn)) availabilityParts.push(/[.!?]$/.test(availabilityEn) ? availabilityEn : `${availabilityEn}.`);
  // Solo se muestra cuando la persona dijo que sí tiene pasaporte vigente; nunca se incluye el número
  if (profile.passport === 'yes') availabilityParts.push('Valid passport: Yes.');

  return {
    removed,
    cv: {
      header: { fullName: profile.fullName, city: profile.city, phone: profile.phone, email: profile.email, teams: profile.teams },
      headline: headlineEn && !/\d/.test(headlineEn) ? headlineEn : profile.targetRole,
      summary: anyoneLeads ? keptSentences.join(' ') : softenManaging(keptSentences.join(' ')),
      experiences,
      skills: strings(model.skills, 10, 40),
      education: strings(model.education, profile.education.length, 160),
      certifications: strings(model.certifications, profile.certifications.length, 160),
      languages,
      availability: availabilityParts.join(' '),
      sectionTitle: profile.route === 'C' ? 'RELEVANT PRACTICAL EXPERIENCE' : 'PROFESSIONAL EXPERIENCE',
    },
  };
}

// Texto plano del CV, armado por código a partir del CV ya verificado.
// Sigue el orden de la plantilla: Summary, Key Skills, Experience, Education, Languages, Availability.
export function cvToText(cv: BuiltCv): string {
  const out: string[] = [];
  out.push(cv.header.fullName.toUpperCase());
  if (cv.headline) out.push(cv.headline);
  const contact = [cv.header.city, cv.header.phone, cv.header.email, cv.header.teams && `Teams: ${cv.header.teams}`].filter(Boolean).join(' | ');
  if (contact) out.push(contact);
  if (cv.summary) out.push('', 'PROFESSIONAL SUMMARY', cv.summary);
  if (cv.skills.length) out.push('', 'KEY SKILLS', cv.skills.join(' • '));

  const exps = cv.experiences.filter((e) => e.heading && (e.bullets.length > 0 || e.dates));
  if (exps.length) {
    out.push('', cv.sectionTitle);
    for (const e of exps) {
      const head = [e.heading, e.location].filter(Boolean).join(', ');
      out.push('', e.dates ? `${head} | ${e.dates}` : head);
      if (e.subtitle) out.push(e.subtitle);
      for (const b of e.bullets) out.push(`• ${b.text}`);
    }
  }
  const edu = [...cv.education, ...cv.certifications];
  if (edu.length) out.push('', 'EDUCATION & CERTIFICATIONS', ...edu);
  if (cv.languages.length) out.push('', 'LANGUAGES', cv.languages.join(' | '));
  if (cv.availability) out.push('', 'AVAILABILITY', cv.availability);
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
    .map((item): Requirement | null => {
      const r = asRaw(item);
      const text = clip(r.requirement_es, 200);
      if (!text) return null;
      let status: RequirementStatus = STATUSES.find((s) => s === r.status) || 'UNKNOWN';
      if (status === 'MATCH' || status === 'TRANSFERABLE') {
        const refs = asArray(r.refs);
        if (!refs.some((ref) => typeof ref === 'string' && facts.has(ref))) status = 'UNKNOWN';
      }
      return { requirement_es: text, status };
    })
    .filter((r): r is Requirement => r !== null);
}

// Saludo de la carta, puesto por código. Solo deja letras, espacios, punto, apóstrofe y guion: el
// nombre del contacto es texto libre del usuario y nunca debe colar otra cosa en la carta.
// Con título (Mr./Ms./Mrs./Mx./Dr.) usa "Dear Ms. Smith,"; sin título, el nombre completo, sin
// asumir género. Sin contacto: "Dear Hiring Manager,".
export function buildGreeting(contactName?: string): string {
  const name = (contactName || '')
    .replace(/[^\p{L}\s.'’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!/\p{L}{2}/u.test(name)) return 'Dear Hiring Manager,';
  const words = name
    .split(' ')
    .slice(0, 4)
    .map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w));
  return `Dear ${words.join(' ')},`;
}

// Arma la carta con saludo y firma puestos por código. Cada oración debe tener solo números
// que existan en los datos del candidato o en la oferta, y ninguna puede hablar de patrocinio.
export function buildVerifiedLetter(
  profile: CandidateProfile,
  modelOutput: unknown,
  job: { title?: string; employer_name?: string; job_duties?: string } | null,
  contactName?: string
): { letter: string; removed: number } {
  const allowedNumbers = new Set(numbersIn(JSON.stringify(profile) + ' ' + JSON.stringify(job || {})));
  const anyoneLeads = profile.experiences.some((e) => e.autonomy === 'ensena' && !!e.supervision);
  let removed = 0;
  const paragraphs: string[] = [];

  for (const para of asArray(asRaw(modelOutput).paragraphs).slice(0, 3)) {
    const sentences = clip(para, 900).split(/(?<=[.!?])\s+/).filter(Boolean);
    const kept = sentences.filter(
      (s) => numbersIn(s).every((n) => allowedNumbers.has(n)) && !/sponsor/i.test(s) && (anyoneLeads || !LEADERSHIP.test(s))
    );
    removed += sentences.length - kept.length;
    if (kept.length) paragraphs.push(kept.join(' '));
  }

  const body = paragraphs.join('\n\n');
  return {
    removed,
    letter: body ? `${buildGreeting(contactName)}\n\n${body}\n\nSincerely,\n${profile.fullName}` : '',
  };
}
