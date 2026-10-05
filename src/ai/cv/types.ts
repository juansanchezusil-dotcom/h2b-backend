export interface Experience {
  id: string; // e1, e2... estable durante toda la entrevista
  kind: 'formal' | 'informal' | '';
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
}

export type GapLevel = 'critical' | 'important';

export interface Gap {
  key: string;
  level: GapLevel;
  label: string; // en español, para mostrarlo al usuario
}
