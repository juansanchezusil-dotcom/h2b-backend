import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRequest } from '../../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../../src/ai/callGemini';
import { buildCoverLetterPrompt } from '../../../../src/ai/cv/prompts';
import { computeGaps, sanitizeProfile } from '../../../../src/ai/cv/profile';
import { buildVerifiedLetter } from '../../../../src/ai/cv/build';

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

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Carta de presentación en inglés, de 3 párrafos, coherente con el perfil del candidato.
// Es opcional y se pide aparte del CV para no gastar una llamada que quizá no se usa.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const blocked = await guardAiRequest(request, headers);
    if (blocked) return blocked;

    const body = await request.json();
    const profile = sanitizeProfile(body.profile);
    if (computeGaps(profile).some((g) => g.level === 'critical')) {
      return NextResponse.json({ error: 'Primero completa tu perfil para poder armar la carta.' }, { status: 400, headers });
    }

    const job =
      body.job && typeof body.job === 'object'
        ? { title: clip(body.job.title, 120), employer_name: clip(body.job.employer_name, 120), job_duties: clip(body.job.job_duties, 1500) }
        : null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }
    const ai = new GoogleGenAI({ apiKey });

    const text = await generateTextWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: buildCoverLetterPrompt({ profile, job }) }] }],
      config: { responseMimeType: 'application/json' },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      console.error('Carta: el modelo no devolvió JSON válido:', text.slice(0, 200));
      return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar la carta. Intenta de nuevo.' }, { status: 502, headers });
    }

    const { letter, removed } = buildVerifiedLetter(profile, parsed, job);
    if (!letter) {
      return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar la carta. Intenta de nuevo.' }, { status: 502, headers });
    }

    return NextResponse.json(
      { letter, notes_es: typeof parsed.notes_es === 'string' ? parsed.notes_es.slice(0, 400) : '', removed },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error('Error generando la carta:', err);
    if (isTransientGeminiError(err?.message || '')) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Hemos recibido mucho tráfico en este momento. Intenta de nuevo en unos minutos.' },
        { status: 429, headers }
      );
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar la carta. Intenta de nuevo.' }, { status: 500, headers });
  }
}
