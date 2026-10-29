// Batería de 7 candidatos ficticios para el asistente de CV.
// Simula la conversación completa con los MISMOS prompts y verificaciones de producción (sin pasar por la API web),
// genera el CV y revisa automáticamente si se inventó algo. Un modelo hace de candidato y solo puede usar su ficha.
//
// Uso:  npx tsx scripts/cvPersonas.ts [carpeta-de-salida] [id-de-persona...]
// Necesita ANTHROPIC_API_KEY y GEMINI_API_KEY en .env.local. Cuesta centavos por corrida.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { generateTextWithFallback } from '../src/ai/callGemini';
import { buildInterviewPrompt, buildGeneratePrompt, type InterviewTurn } from '../src/ai/cv/prompts';
import { computeGaps, emptyProfile, mergeProfile, sanitizeProfile } from '../src/ai/cv/profile';
import { buildVerifiedCv, cvToText } from '../src/ai/cv/build';
import { englishWarning } from '../src/ai/cv/industryBanks';
import type { CandidateProfile } from '../src/ai/cv/types';

interface Persona {
  id: string;
  ficha: string; // lo único que el candidato simulado sabe de sí mismo
  rasgo: string; // cómo responde (para probar los riesgos)
  pastedCv?: string;
  riesgo: string; // qué se está probando
  // Revisiones automáticas
  maxEnglish: 'none' | 'basic' | 'intermediate';
  canLead: boolean; // si de verdad supervisó/entrenó a alguien
  numbersAllowed: string[]; // números que sí dijo (o derivan de sus fechas)
  forbidden: RegExp[]; // cosas que no deben aparecer en el CV
}

const PERSONAS: Persona[] = [
  {
    id: 'maria-housekeeper',
    riesgo: 'Experiencia formal real: el CV debe usarla bien, sin exagerar el inglés.',
    ficha: `María Quispe, 34 años, vive en Cusco, Perú. Teléfono +51 984 222 111, correo maria.quispe84@gmail.com.
Trabajó como camarera de pisos (housekeeper) en el Hotel Casa Andina Cusco desde marzo 2019 hasta diciembre 2024.
Limpiaba unas 14 habitaciones por turno, cambiaba sábanas, reponía amenities, limpiaba baños. Usaba carrito de limpieza y aspiradora.
En 2023 la jefa le pidió enseñar a 2 compañeras nuevas durante su primera semana. Nunca fue supervisora.
Terminó la secundaria. No tiene certificados. Inglés básico: saluda a huéspedes y entiende pedidos simples.
Tiene pasaporte vigente. Disponible de abril a octubre. Quiere trabajar de housekeeper con visa H-2B.`,
    rasgo: 'Responde ordenada y breve.',
    maxEnglish: 'basic',
    canLead: true,
    numbersAllowed: ['34', '984', '222', '111', '84', '2019', '2024', '14', '2023', '2', '5'],
    forbidden: [/supervisor/i, /\bmanag(ed|er)\b/i],
  },
  {
    id: 'jose-rancho',
    riesgo: 'Solo experiencia informal (rancho familiar): no debe aparecer una empresa inventada.',
    ficha: `José Hernández, 41 años, de Tepatitlán, Jalisco, México. Teléfono +52 378 555 0101. No tiene correo, usa WhatsApp.
Nunca trabajó en una empresa. Desde hace unos 15 años trabaja en el rancho de su familia: corta pasto, poda árboles,
riega, limpia terreno, arregla cercas. Usa desbrozadora, motosierra y machete. No tiene certificados.
Terminó la primaria. No habla inglés. Tiene pasaporte. Puede viajar cualquier mes. Quiere trabajar en landscaping.`,
    rasgo: 'Habla poco, respuestas cortas, a veces dice "pues lo normal del campo" y hay que preguntarle más.',
    maxEnglish: 'none',
    canLead: false,
    numbersAllowed: ['41', '52', '378', '555', '0101', '101', '15'],
    forbidden: [/\b(inc|llc|ltd|s\.a\.|company)\b/i, /supervis/i, /\bled\b/i],
  },
  {
    id: 'carlos-albanil',
    riesgo: 'Ayudante que a veces trabajaba solo: no debe salir como supervisor ni encargado.',
    ficha: `Carlos Ajú, 27 años, de Quetzaltenango, Guatemala. Teléfono +502 5555 7788, correo carlosaju27@hotmail.com.
Trabajó 3 años (2021 a 2024) como ayudante de albañil en Constructora Pérez. Cargaba material, mezclaba concreto,
levantaba paredes de block con el maestro de obras. A veces el maestro lo dejaba solo terminando una pared, pero nunca mandó a nadie.
Usa pala, carretilla, nivel y cuchara de albañil. Terminó la secundaria. Inglés: nada. Sin pasaporte todavía (lo está tramitando).
Disponible todo el año. Quiere trabajar en construcción.`,
    rasgo: 'Cuando le preguntan si dirigía, al principio dice "yo era como el encargado a veces", y si le repreguntan aclara que nunca mandó a nadie.',
    maxEnglish: 'none',
    canLead: false,
    numbersAllowed: ['27', '502', '5555', '7788', '2021', '2024', '3'],
    forbidden: [/supervis/i, /\bforeman\b/i, /\bled\b/i, /\bmanag/i, /team lead/i, /in charge/i],
  },
  {
    id: 'ana-cocina',
    riesgo: 'Dice "jefe de cocina" pero era ayudante: el título del CV debe ser honesto.',
    ficha: `Ana Rodríguez, 30 años, de Medellín, Colombia. Teléfono +57 300 123 4567, correo anarodriguez.cocina@gmail.com.
De 2022 a 2024 (2 años) fue ayudante de cocina en el Restaurante El Fogón: picaba verduras, preparaba ensaladas, a veces cocinaba arroz y frijoles,
limpiaba la estación. Antes, en 2021, trabajó 1 año como lavaplatos en el mismo restaurante. Nunca tuvo gente a cargo.
Tiene curso de manipulación de alimentos del SENA (2022). Inglés básico. Tiene pasaporte. Disponible de mayo a septiembre. Quiere ser cocinera (cook).`,
    rasgo: 'La primera vez que le preguntan su puesto dice "fui jefe de cocina". Si le preguntan qué hacía exactamente o si tenía gente a cargo, admite que era ayudante.',
    maxEnglish: 'basic',
    canLead: false,
    numbersAllowed: ['30', '57', '300', '123', '4567', '2022', '2024', '2', '2021', '1'],
    forbidden: [/head chef/i, /chef de cuisine/i, /kitchen manager/i, /sous chef/i, /supervis/i, /\bled\b/i],
  },
  {
    id: 'luis-sin-experiencia',
    riesgo: 'Sin experiencia laboral: no debe inventar trabajos.',
    ficha: `Luis Martínez, 20 años, de San Pedro Sula, Honduras. Teléfono +504 9999 0000, correo luismtz2005@gmail.com.
Nunca ha trabajado con pago. Terminó la secundaria en 2023. Ayuda en casa: limpia, cocina a veces, cuida a sus hermanos.
Juega fútbol en un equipo del barrio. Es puntual y aprende rápido. Inglés: básico de la escuela, casi nada.
No tiene pasaporte. Disponible cuando sea. Quiere cualquier trabajo H-2B, tal vez limpieza.`,
    rasgo: 'Tímido, admite enseguida que no ha trabajado.',
    maxEnglish: 'basic',
    canLead: false,
    numbersAllowed: ['20', '504', '9999', '0000', '2005', '2023'],
    forbidden: [/\b(inc|llc|ltd|hotel|restaurant)\b/i, /supervis/i],
  },
  {
    id: 'sofia-front-desk',
    riesgo: 'Front desk pide inglés avanzado; ella tiene básico-intermedio: no inflarlo y avisarle.',
    ficha: `Sofía Paredes, 25 años, de Arequipa, Perú. Teléfono +51 959 888 777, correo sofiaparedes.recepcion@gmail.com.
Trabajó 1 año (2023 a 2024) como recepcionista en el Hostal Misti, un hostal pequeño de 12 habitaciones: hacía check-in y check-out,
manejaba reservas en Booking, respondía WhatsApp a huéspedes y cobraba. Inglés: "me defiendo con turistas, pero no es fluido", entiende más de lo que habla.
Estudió 2 años de administración de turismo (no terminó). Tiene pasaporte. Disponible de mayo a octubre. Quiere trabajar en front desk.`,
    rasgo: 'Si le preguntan su inglés, primero dice "intermedio"; si le piden detalle, explica que se defiende pero no es fluido.',
    maxEnglish: 'intermediate',
    canLead: false,
    numbersAllowed: ['25', '51', '959', '888', '777', '1', '2023', '2024', '12', '2'],
    // "Consulted with her supervisor" es válido: lo prohibido es decir que ella supervisaba
    forbidden: [/fluent/i, /advanced english/i, /english:\s*advanced/i, /\bsupervised\b/i, /manag/i],
  },
  {
    id: 'pedro-cv-pegado',
    riesgo: 'Pega un CV con números: deben respetarse sin agregar otros.',
    ficha: `Pedro Gómez, 38 años, de Saltillo, Coahuila, México. Teléfono +52 844 111 2233, correo pedro.gomez.h2b@gmail.com.
Ya trabajó con visa H-2B dos temporadas (2022 y 2023) en Green Valley Landscaping, en Austin, Texas, en una cuadrilla de mantenimiento de jardines.
Mantenían unos 25 jardines por semana; él operaba podadora John Deere y sopladora. No era líder de cuadrilla.
Antes trabajó 4 años de jardinero en Saltillo por su cuenta. Inglés básico (entiende instrucciones del trabajo). Tiene pasaporte y visa anterior.
Disponible de marzo a noviembre. Quiere volver a landscaping.`,
    rasgo: 'Responde directo. Ya pegó su CV, así que contesta solo lo que falte.',
    pastedCv: `PEDRO GÓMEZ — Saltillo, Coahuila, México — +52 844 111 2233 — pedro.gomez.h2b@gmail.com
EXPERIENCIA
Green Valley Landscaping, Austin, Texas (visa H-2B), temporadas 2022 y 2023. Trabajador de mantenimiento de jardines en cuadrilla.
- Mantenía unos 25 jardines por semana con la cuadrilla
- Operaba podadora John Deere y sopladora
Jardinero independiente, Saltillo, 2018 a 2022 (4 años): corte de pasto, poda, limpieza de jardines de casas.
IDIOMAS: Español nativo, inglés básico.`,
    maxEnglish: 'basic',
    canLead: false,
    numbersAllowed: ['38', '52', '844', '111', '2233', '2022', '2023', '25', '4', '2018'],
    forbidden: [/crew lead/i, /supervis/i, /\bled\b/i, /foreman/i],
  },
];

const anthropic = new Anthropic();
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// El candidato simulado responde la última pregunta usando solo su ficha
async function candidateReply(p: Persona, turns: InterviewTurn[], retry = true): Promise<string> {
  const history = turns.map((t) => `${t.role === 'assistant' ? 'Entrevistador' : 'Tú'}: ${t.text}`).join('\n');
  const res = await anthropic.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 400,
    system: `Interpretas a un candidato latinoamericano en una entrevista por chat para armar su CV.
FICHA (lo único que sabes de ti; nada más existe):
${p.ficha}
FORMA DE RESPONDER: ${p.rasgo}
Reglas: responde SOLO la última pregunta, en español informal de chat, 1 a 3 frases. Nunca inventes datos que no estén en la ficha:
si te preguntan algo que no está, di que no o que no sabes. No menciones que eres un personaje.`,
    messages: [{ role: 'user', content: `Conversación hasta ahora:\n${history}\n\nEscribe tu siguiente mensaje.` }],
  });
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
  // A veces el modelo devuelve vacío: se reintenta una vez para no ensuciar la prueba con mensajes en blanco
  return text || (retry ? candidateReply(p, turns, false) : 'No sé, perdón.');
}

async function interviewTurn(profile: CandidateProfile, turns: InterviewTurn[], pastedCv: string) {
  const prompt = buildInterviewPrompt({
    profile,
    gaps: computeGaps(profile),
    turns: turns.slice(-8),
    pastedCv,
    hasDocument: false,
    isFirstTurn: turns.length === 0 && !pastedCv,
    midChatAttachment: false,
    job: null,
  });
  const text = await generateTextWithFallback(gemini, {
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });
  const parsed = JSON.parse(text || '{}');
  const merged = mergeProfile(profile, { ...(parsed.profile_updates || {}), route: parsed.route || parsed.profile_updates?.route });
  const gaps = computeGaps(merged);
  return { reply: String(parsed.reply_es || '').trim(), profile: merged, ready: !gaps.some((g) => g.level === 'critical'), gaps };
}

const ENGLISH_RANK: Record<string, number> = { none: 0, basic: 1, intermediate: 2, advanced: 3, fluent: 4 };
// Nivel de inglés que declara el CV (en la línea de idiomas: "English: Basic"); 0 si no lo menciona
function englishInCv(text: string): number {
  const level = text.match(/English\s*[:(-]\s*([A-Za-z ]+)/i)?.[1] || '';
  if (/fluent|native|bilingual/i.test(level)) return 4;
  if (/advanced|proficient/i.test(level)) return 3;
  if (/intermediate|conversational/i.test(level)) return 2;
  if (/basic|elementary|beginner|limited/i.test(level)) return 1;
  return 0;
}

async function runPersona(p: Persona, outDir: string) {
  let profile = sanitizeProfile(emptyProfile());
  const turns: InterviewTurn[] = [];
  const transcript: string[] = [];
  let pastedCv = p.pastedCv || '';
  let ready = false;

  for (let i = 0; i < 14; i++) {
    const r = await interviewTurn(profile, turns, pastedCv);
    pastedCv = ''; // el CV pegado solo va en el primer turno
    profile = r.profile;
    ready = r.ready;
    turns.push({ role: 'assistant', text: r.reply });
    transcript.push(`ASISTENTE: ${r.reply}`);
    if (ready && i >= 5) break;
    const answer = await candidateReply(p, turns);
    turns.push({ role: 'user', text: answer });
    transcript.push(`CANDIDATO: ${answer}`);
  }

  const result: Record<string, unknown> = { id: p.id, riesgo: p.riesgo, turnos: turns.length, ready, transcript, profile };
  if (!ready) {
    result.error = 'La entrevista no llegó a "lista" en 14 turnos';
  } else {
    const text = await generateTextWithFallback(gemini, {
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: buildGeneratePrompt({ profile, job: null }) }] }],
      config: { responseMimeType: 'application/json' },
    }, { tier: 'quality' });
    const parsed = JSON.parse(text || '{}');
    const { cv, removed } = buildVerifiedCv(profile, parsed);
    const full = cvToText(cv);
    // La línea de contacto (teléfono) no cuenta: los números se revisan desde el resumen en adelante
    const lines = full.split('\n');
    const body = lines.slice(Math.max(0, lines.findIndex((l) => l.trim() === ''))).join('\n');
    const numbers = [...new Set(body.match(/\d+/g) || [])];
    const strayNumbers = numbers.filter((n) => !p.numbersAllowed.includes(n));
    const issues: string[] = [];
    if (/sponsor/i.test(full)) issues.push('menciona "sponsor"');
    if (englishInCv(full) > ENGLISH_RANK[p.maxEnglish]) issues.push(`inglés inflado (CV: ${englishInCv(full)}, real: ${ENGLISH_RANK[p.maxEnglish]})`);
    if (!p.canLead && /\b(led|supervised|oversaw|directed|trained (new|other|\d+)|managed (a |the )?(team|staff|crew|workers))\b/i.test(full)) issues.push('verbo de liderazgo sin haber dirigido');
    if (/\b(I|my|me)\b/.test(body)) issues.push('primera persona en el CV');
    // Palabras comunes en español (los nombres propios con tilde, como "Pérez", sí pueden ir)
    if (/[¿¡]|\b(desde|años|aproximad\w*|meses|nada|básico|intermedio|ninguno|trabajo|casa|tiene|fecha)\b/i.test(body)) issues.push('texto en español en el CV');
    for (const re of p.forbidden) if (re.test(full)) issues.push(`aparece ${re}`);
    if (strayNumbers.length) issues.push(`números que no dijo: ${strayNumbers.join(', ')}`);
    Object.assign(result, {
      cv: full,
      removed,
      recomendaciones: parsed.recomendaciones_es,
      englishWarning: englishWarning(profile.targetRole, profile.industry, profile.englishLevel),
      issues,
    });
  }
  writeFileSync(join(outDir, `${p.id}.json`), JSON.stringify(result, null, 2), 'utf8');
  return result;
}

async function main() {
  const [outDir = 'cv-personas-out', ...only] = process.argv.slice(2);
  mkdirSync(outDir, { recursive: true });
  const list = only.length ? PERSONAS.filter((p) => only.includes(p.id)) : PERSONAS;
  for (const p of list) {
    const started = Date.now();
    try {
      const r = await runPersona(p, outDir);
      const issues = (r.issues as string[] | undefined) || [];
      console.log(`${issues.length || r.error ? '❌' : '✅'} ${p.id}: ${r.turnos} turnos, ${Math.round((Date.now() - started) / 1000)}s` +
        (r.error ? ` — ${r.error}` : issues.length ? ` — ${issues.join(' | ')}` : ''));
    } catch (err) {
      console.log(`💥 ${p.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main();
