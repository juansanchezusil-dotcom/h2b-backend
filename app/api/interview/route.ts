import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRequest } from '../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../src/ai/callGemini';

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

// Simulador de entrevista H-2B: genera preguntas típicas de un entrevistador
// real en inglés, y luego da feedback constructivo en español a cada
// respuesta que el candidato practique. Dos modos en una sola ruta, igual
// que /api/email/generate con su "emailType".
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const blocked = await guardAiRequest(request, headers);
    if (blocked) return blocked;

    const body = await request.json();
    const mode: string = body.mode || 'questions';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }
    const ai = new GoogleGenAI({ apiKey });

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

      const responseText = await generateTextWithFallback(ai, {
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(responseText || '{}');
      return NextResponse.json(parsed, { status: 200, headers });
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

Da feedback constructivo y breve EN ESPAÑOL: qué estuvo bien de la respuesta, y qué mejorar (contenido, no solo gramática). Sé amable pero honesto — si la respuesta no responde la pregunta o es demasiado corta, dilo claramente. Si hay errores de inglés importantes, menciónalos sin ser duro. No corrijas cada coma, enfócate en 1-2 mejoras que más importan.

También da una respuesta modelo en inglés simple (apropiada al nivel del candidato, no un inglés perfecto de oficina) que el candidato pueda usar como referencia.

Responde ÚNICAMENTE con un objeto JSON con las claves:
- "feedback_es": el feedback en español (2-4 líneas).
- "model_answer_en": la respuesta modelo en inglés.`;

      const responseText = await generateTextWithFallback(ai, {
        model: 'gemini-3.6-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(responseText || '{}');
      return NextResponse.json(parsed, { status: 200, headers });
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
