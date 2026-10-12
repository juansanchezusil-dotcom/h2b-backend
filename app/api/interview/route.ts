import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRequest } from '../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../src/ai/callGemini';
import {
  INTERVIEW_TURN_DAILY_LIMIT,
  TOTAL_QUESTIONS,
  buildHelpPrompt,
  buildNextPrompt,
  buildReportPrompt,
  clip,
  summarizeScores,
  type CandidateInfo,
  type JobInfo,
  type Module,
  type Turn,
} from '../../../src/ai/interviewSim';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

const MODEL = 'gemini-3.6-flash';

// Simulador de entrevistas H-2B. Modos:
//   next    -> siguiente pregunta de una entrevista adaptativa (sin feedback durante la práctica)
//   help    -> ayuda puntual cuando la persona pausa la práctica
//   report  -> informe final con puntuación calculada por el código
//   questions / feedback -> versión anterior (se conserva para quien tenga la página abierta)
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const mode: string = body.mode || 'questions';

    // Una entrevista completa son unas 12 llamadas: tiene su propio tope y no gasta la cuota general
    const modern = mode === 'next' || mode === 'help' || mode === 'report';
    const blocked = await guardAiRequest(request, headers, modern ? { bucket: 'interview_turn', limit: INTERVIEW_TURN_DAILY_LIMIT } : undefined);
    if (blocked) return blocked;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }
    const ai = new GoogleGenAI({ apiKey });

    const ask = async (prompt: string) => {
      const text = await generateTextWithFallback(ai, {
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });
      return JSON.parse(text || '{}');
    };

    if (modern) {
      const module: Module = body.module === 'consular' ? 'consular' : 'employer';
      const c = body.candidate && typeof body.candidate === 'object' ? body.candidate : {};
      const candidate: CandidateInfo = {
        role: clip(c.role, 120),
        industry: clip(c.industry, 120),
        englishLevel: clip(c.englishLevel, 60),
        cvText: clip(c.cvText, 3500),
      };
      const j = body.job && typeof body.job === 'object' ? body.job : null;
      const job: JobInfo | null = j && clip(j.title, 120) ? { title: clip(j.title, 120), company: clip(j.company, 120), duties: clip(j.duties, 1800) } : null;
      const turns: Turn[] = (Array.isArray(body.turns) ? body.turns : [])
        .map((t: any) => ({ q: clip(t?.q, 400), a: clip(t?.a, 1200) }))
        .filter((t: Turn) => t.q)
        .slice(0, 16);

      if (mode === 'next') {
        const parsed = await ask(buildNextPrompt({ module, candidate, turns, job }));
        const questionEn = clip(parsed.question_en, 500);
        if (!questionEn) return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo preparar la siguiente pregunta. Intenta de nuevo.' }, { status: 502, headers });
        return NextResponse.json(
          {
            question_en: questionEn,
            question_es: clip(parsed.question_es, 500),
            level: [1, 2, 3].includes(Number(parsed.level)) ? Number(parsed.level) : 1,
            is_follow_up: parsed.is_follow_up === true,
            ask_english: parsed.ask_english === true,
            total: TOTAL_QUESTIONS,
          },
          { status: 200, headers }
        );
      }

      if (mode === 'help') {
        const questionEn = clip(body.questionEn, 500);
        if (!questionEn) return NextResponse.json({ error: 'Falta la pregunta.' }, { status: 400, headers });
        const parsed = await ask(buildHelpPrompt({ module, candidate, questionEn, job }));
        return NextResponse.json(
          {
            meaning_es: clip(parsed.meaning_es, 600),
            structure_es: Array.isArray(parsed.structure_es) ? parsed.structure_es.map((s: unknown) => clip(s, 240)).filter(Boolean).slice(0, 4) : [],
            vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.map((s: unknown) => clip(s, 160)).filter(Boolean).slice(0, 6) : [],
          },
          { status: 200, headers }
        );
      }

      // report
      if (turns.length < 1 || turns.every((t) => !t.a)) {
        return NextResponse.json({ error: 'Responde al menos una pregunta para recibir el informe.' }, { status: 400, headers });
      }
      const hasDocs = candidate.cvText.length >= 30;
      const parsed = await ask(buildReportPrompt({ module, candidate, turns, hasDocs, job }));
      const list = (v: unknown, n: number, len = 400) => (Array.isArray(v) ? v.map((s) => clip(s, len)).filter(Boolean).slice(0, n) : []);
      const report = {
        module,
        level_reached: [1, 2, 3].includes(Number(parsed.level_reached)) ? Number(parsed.level_reached) : 1,
        score: summarizeScores(parsed.scores, hasDocs),
        strengths_es: list(parsed.strengths_es, 4),
        improve: (Array.isArray(parsed.improve) ? parsed.improve : []).slice(0, 5).map((i: any) => ({
          question_en: clip(i?.question_en, 500),
          question_es: clip(i?.question_es, 500),
          original: clip(i?.original, 1200),
          mejorar_es: clip(i?.mejorar_es, 600),
          improved_en: clip(i?.improved_en, 1200),
          improved_es: clip(i?.improved_es, 1200),
          consejo_es: clip(i?.consejo_es, 400),
        })),
        english_errors_es: list(parsed.english_errors_es, 5),
        not_understood_es: list(parsed.not_understood_es, 6),
        inconsistencias_es: hasDocs ? list(parsed.inconsistencias_es, 5) : [],
        priorities_es: list(parsed.priorities_es, 3),
        plan_es: list(parsed.plan_es, 5),
        practice_questions: (Array.isArray(parsed.practice_questions) ? parsed.practice_questions : [])
          .slice(0, 5)
          .map((q: any) => ({ en: clip(q?.en, 400), es: clip(q?.es, 400) }))
          .filter((q: { en: string }) => q.en),
        encaje_tiene_es: job ? list(parsed.encaje_tiene_es, 6) : [],
        encaje_falta_es: job ? list(parsed.encaje_falta_es, 6) : [],
        job_title: job?.title || '',
        closing_es: clip(parsed.closing_es, 700),
        has_docs: hasDocs,
      };
      return NextResponse.json(report, { status: 200, headers });
    }

    if (mode === 'questions') {
      const targetRole: string = body.targetRole || 'general worker';
      const industry: string = body.industry || '';
      const englishLevel: string = body.englishLevel || '';

      const promptText = `Eres un empleador de EE. UU. que va a entrevistar a un candidato para un puesto H-2B (trabajo temporal legal en EE. UU.).

Genera 6 preguntas de entrevista TÍPICAS Y REALISTAS que un empleador o patrocinador H-2B haría, en inglés, para este puesto e industria:
- Puesto: ${targetRole}
- Industria: ${industry || 'No especificada'}
- Nivel de inglés del candidato: ${englishLevel || 'No especificado'}

Incluye variedad: experiencia previa, disponibilidad y flexibilidad de horario, trabajo en equipo, manejo de situaciones difíciles, por qué le interesa el puesto, y una pregunta sobre seguir instrucciones de seguridad. Mantén las preguntas simples y directas (no trucos ni preguntas abstractas de oficina corporativa — esto es para trabajo manual/temporal).

Responde ÚNICAMENTE con un objeto JSON con la clave "questions": un array de 6 objetos, cada uno con:
- "question_en": la pregunta en inglés, tal como la haría el entrevistador.
- "question_es": traducción al español, solo para que el candidato entienda qué le preguntan.
- "tip_es": 1 frase en español sobre qué busca escuchar el entrevistador con esa pregunta.`;
      return NextResponse.json(await ask(promptText), { status: 200, headers });
    }

    if (mode === 'feedback') {
      const questionEn: string = body.questionEn || '';
      const answer: string = (body.answer || '').trim();
      const englishLevel: string = body.englishLevel || '';

      if (!questionEn || answer.length < 3) {
        return NextResponse.json({ error: 'Falta la pregunta o la respuesta es muy corta.' }, { status: 400, headers });
      }

      const promptText = `Eres un coach que ayuda a candidatos a practicar entrevistas de trabajo H-2B en inglés.

Pregunta del entrevistador (inglés): "${questionEn}"
Respuesta del candidato: "${answer}"
Nivel de inglés del candidato: ${englishLevel || 'No especificado'}

Da feedback constructivo y breve EN ESPAÑOL: qué estuvo bien de la respuesta, y qué mejorar (contenido, no solo gramática). Sé amable pero honesto. Enfócate en 1-2 mejoras que más importan.

También da una respuesta modelo en inglés simple (apropiada al nivel del candidato) que el candidato pueda usar como referencia, sin inventar experiencia que no dijo.

Responde ÚNICAMENTE con un objeto JSON con las claves:
- "feedback_es": el feedback en español (2-4 líneas).
- "model_answer_en": la respuesta modelo en inglés.`;
      return NextResponse.json(await ask(promptText), { status: 200, headers });
    }

    return NextResponse.json({ error: 'Modo no reconocido' }, { status: 400, headers });
  } catch (err: any) {
    console.error('Error en simulador de entrevista con Gemini:', err);
    const msg = err.message || '';

    if (isTransientGeminiError(msg)) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Hemos recibido mucho tráfico en este momento. Intenta de nuevo en unos minutos.' },
        { status: 429, headers }
      );
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo procesar la entrevista. Intenta de nuevo.' }, { status: 500, headers });
  }
}
