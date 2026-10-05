import type { Autonomy, CandidateProfile, Experience, Gap } from './types';

const AUTONOMY_LEVELS: Autonomy[] = ['conoce', 'ayudaba', 'realizaba', 'solo', 'avanzado'];

const clip = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function list(v: unknown, maxItems = 15, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => clip(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

function union(a: string[], b: string[], maxItems = 15): string[] {
  const seen = new Set(a.map((s) => s.toLowerCase()));
  const out = [...a];
  for (const s of b) {
    if (!seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, maxItems);
}

export function emptyProfile(): CandidateProfile {
  return {
    fullName: '', city: '', phone: '', email: '', targetRole: '', industry: '', englishLevel: '',
    route: '', experiences: [], education: [], certifications: [], languages: [], skills: [], notDone: [],
  };
}

function cleanExperience(raw: any, fallbackId: string): Experience {
  const id = /^e\d{1,2}$/.test(clip(raw?.id, 6)) ? clip(raw.id, 6) : fallbackId;
  const kind = raw?.kind === 'formal' || raw?.kind === 'informal' ? raw.kind : '';
  const autonomy = AUTONOMY_LEVELS.includes(raw?.autonomy) ? raw.autonomy : '';
  return {
    id, kind, autonomy, supervision: clip(raw?.supervision, 100),
    title: clip(raw?.title, 100), company: clip(raw?.company, 100), location: clip(raw?.location, 100),
    dates: clip(raw?.dates, 80), duration: clip(raw?.duration, 80),
    tasks: list(raw?.tasks), tools: list(raw?.tools), results: list(raw?.results),
  };
}

// Limpia y acota cualquier perfil que venga de fuera (cliente o modelo): tipos correctos,
// textos recortados, listas con tope. Nada que no sea un campo conocido pasa.
export function sanitizeProfile(raw: any): CandidateProfile {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  p.fullName = clip(raw.fullName, 100);
  p.city = clip(raw.city, 100);
  p.phone = clip(raw.phone, 40);
  p.email = clip(raw.email, 120);
  p.targetRole = clip(raw.targetRole, 100);
  p.industry = clip(raw.industry, 100);
  p.englishLevel = clip(raw.englishLevel, 60);
  p.route = raw.route === 'A' || raw.route === 'B' || raw.route === 'C' ? raw.route : '';
  p.education = list(raw.education);
  p.certifications = list(raw.certifications);
  p.languages = list(raw.languages);
  p.skills = list(raw.skills, 20);
  p.notDone = list(raw.notDone);
  const exps = Array.isArray(raw.experiences) ? raw.experiences.slice(0, 8) : [];
  p.experiences = exps.map((e: any, i: number) => cleanExperience(e, `e${i + 1}`));
  return p;
}

// Aplica lo que el modelo extrajo del último mensaje sobre el perfil acumulado.
// Los textos nuevos reemplazan solo si no vienen vacíos; las listas se suman sin repetir.
export function mergeProfile(base: CandidateProfile, rawUpdates: any): CandidateProfile {
  const up = sanitizeProfile(rawUpdates);
  const out: CandidateProfile = JSON.parse(JSON.stringify(base));
  const scalars = ['fullName', 'city', 'phone', 'email', 'targetRole', 'industry', 'englishLevel'] as const;
  for (const k of scalars) if (up[k]) out[k] = up[k];
  if (up.route) out.route = up.route;
  out.education = union(out.education, up.education);
  out.certifications = union(out.certifications, up.certifications);
  out.languages = union(out.languages, up.languages);
  out.skills = union(out.skills, up.skills, 20);
  out.notDone = union(out.notDone, up.notDone);

  const rawExps = Array.isArray(rawUpdates?.experiences) ? rawUpdates.experiences.slice(0, 8) : [];
  rawExps.forEach((rawExp: any) => {
    const wantedId = clip(rawExp?.id, 6);
    const existing = out.experiences.find((e) => e.id === wantedId);
    const nextId = () => {
      let n = out.experiences.length + 1;
      while (out.experiences.some((e) => e.id === `e${n}`)) n++;
      return `e${n}`;
    };
    const incoming = cleanExperience(rawExp, existing ? existing.id : nextId());
    if (existing) {
      (['kind', 'autonomy', 'supervision', 'title', 'company', 'location', 'dates', 'duration'] as const).forEach((k) => {
        if (incoming[k]) (existing as any)[k] = incoming[k];
      });
      existing.tasks = union(existing.tasks, incoming.tasks);
      existing.tools = union(existing.tools, incoming.tools);
      existing.results = union(existing.results, incoming.results);
    } else if (out.experiences.length < 8 && (incoming.title || incoming.tasks.length)) {
      out.experiences.push(incoming);
    }
  });
  return out;
}

// Lo que falta, decidido por código y no por el modelo. "critical" bloquea generar el CV;
// "important" se pregunta pero no bloquea.
export function computeGaps(p: CandidateProfile): Gap[] {
  const gaps: Gap[] = [];
  if (!p.fullName) gaps.push({ key: 'fullName', level: 'critical', label: 'Tu nombre completo' });
  if (!p.targetRole) gaps.push({ key: 'targetRole', level: 'critical', label: 'El puesto al que apuntas' });
  const complete = p.experiences.some((e) => e.title && e.tasks.length > 0 && (e.dates || e.duration));
  if (!complete) {
    gaps.push({ key: 'experience', level: 'critical', label: 'Una experiencia con puesto, tareas y tiempo' });
  }
  if (!p.route) gaps.push({ key: 'route', level: 'critical', label: 'Tipo de experiencia (se define sola al conversar)' });
  if (!p.englishLevel) gaps.push({ key: 'englishLevel', level: 'important', label: 'Tu nivel de inglés' });
  if (!p.phone) gaps.push({ key: 'phone', level: 'important', label: 'Un teléfono de contacto' });
  if (!p.city) gaps.push({ key: 'city', level: 'important', label: 'Tu ciudad y país' });
  if (!p.experiences.some((e) => e.tools.length > 0)) {
    gaps.push({ key: 'tools', level: 'important', label: 'Herramientas o equipos que has usado' });
  }
  if (p.experiences.some((e) => e.tasks.length > 0 && !e.autonomy)) {
    gaps.push({ key: 'autonomy', level: 'important', label: 'Qué tan independiente eras en esas tareas' });
  }
  return gaps;
}

// Cada dato del usuario con una referencia estable (e1.t1, e1.o2, e1.r1) para que el CV
// pueda citar de dónde sale cada frase.
export function factIndex(p: CandidateProfile): Map<string, string> {
  const facts = new Map<string, string>();
  for (const e of p.experiences) {
    e.tasks.forEach((t, i) => facts.set(`${e.id}.t${i + 1}`, t));
    e.tools.forEach((t, i) => facts.set(`${e.id}.o${i + 1}`, t));
    e.results.forEach((t, i) => facts.set(`${e.id}.r${i + 1}`, t));
  }
  return facts;
}

// Texto plano con la experiencia tal como la dijo el usuario. Se guarda en base_cv_text
// para que los demás asistentes (correo, entrevista, checklist) sigan funcionando.
export function profileToPlainText(p: CandidateProfile): string {
  return p.experiences
    .map((e) => {
      const head = [e.title, e.company && `en ${e.company}`, (e.dates || e.duration) && `(${e.dates || e.duration})`]
        .filter(Boolean)
        .join(' ');
      const parts = [
        e.tasks.length ? `Tareas: ${e.tasks.join('; ')}.` : '',
        e.tools.length ? `Herramientas: ${e.tools.join(', ')}.` : '',
        e.results.length ? `Resultados: ${e.results.join('; ')}.` : '',
        e.autonomy ? `Nivel: ${e.autonomy}.` : '',
      ].filter(Boolean);
      return `${head}. ${parts.join(' ')}`.trim();
    })
    .join('\n');
}
