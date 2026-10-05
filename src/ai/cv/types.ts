export type Autonomy = '' | 'conoce' | 'ayudaba' | 'realizaba' | 'solo' | 'avanzado';

export interface Experience {
  id: string; // e1, e2... estable durante toda la entrevista
  kind: 'formal' | 'informal' | '';
  // Qué tan independiente era en esas tareas. Define los verbos del CV (Assisted vs. Performed...).
  autonomy: Autonomy;
  supervision: string; // a quién supervisaba o entrenaba, solo si lo dijo
  title: string;
  company: string;
  location: string;
  dates: string;
  duration: string;
  tasks: string[];
  tools: string[];
  results: string[];
}

// Todo lo que el candidato ha dicho, ya ordenado. La entrevista lo va llenando y el CV
// se redacta SOLO a partir de esto: lo que no esté aquí no puede aparecer en el CV.
export interface CandidateProfile {
  fullName: string;
  city: string;
  phone: string;
  email: string;
  targetRole: string;
  industry: string;
  englishLevel: string;
  route: '' | 'A' | 'B' | 'C';
  experiences: Experience[];
  education: string[];
  certifications: string[];
  languages: string[];
  skills: string[];
  // Lo que NO sabe hacer o solo observó. Nunca va al CV; sirve para no exagerar.
  notDone: string[];
  // Disponibilidad en sus propias palabras (temporada, meses, flexibilidad) y si tiene pasaporte vigente.
  // El pasaporte es solo sí/no: nunca se pide ni se guarda el número.
  availability: string;
  passport: '' | 'yes' | 'no';
}

export type GapLevel = 'critical' | 'important';

export interface Gap {
  key: string;
  level: GapLevel;
  label: string; // en español, para mostrarlo al usuario
}
