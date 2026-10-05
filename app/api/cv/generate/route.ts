import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRequest } from '../../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../../src/ai/callGemini';
import { buildGeneratePrompt } from '../../../../src/ai/cv/prompts';
import { computeGaps, profileToPlainText, sanitizeProfile } from '../../../../src/ai/cv/profile';
import { buildVerifiedCv, cvToText } from '../../../../src/ai/cv/build';

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

// Genera el CV en inglés a partir del perfil armado en la entrevista. El modelo redacta,
// pero el CV final lo arma el código con lo que se puede respaldar (ver buildVerifiedCv).
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const blocked = await guardAiRequest(request, headers);
    if (blocked) return blocked;

    const body = await request.json();
    const profile = sanitizeProfile(body.profile);
    if (computeGaps(profile).some((g) => g.level === 'critical')) {
      return NextResponse.json(
        { error: 'Todavía falta información clave para armar tu CV. Sigue la conversación un poco más.' },
        { status: 400, headers }
      );
    }

    const job = body.job && typeof body.job === 'object' ? body.job : null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }
    const ai = new GoogleGenAI({ apiKey });

    const text = await generateTextWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: buildGeneratePrompt({ profile, job }) }] }],
      config: { responseMimeType: 'application/json' },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      console.error('Generar CV: el modelo no devolvió JSON válido:', text.slice(0, 200));
      return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar el CV. Intenta de nuevo.' }, { status: 502, headers });
    }

    const { cv, removed } = buildVerifiedCv(profile, parsed);
    const strings = (v: unknown, max: number) =>
      (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, max) as string[];

    return NextResponse.json(
      {
        ruta: profile.route,
        diagnostico_es: typeof parsed.diagnostico_es === 'string' ? parsed.diagnostico_es.slice(0, 600) : '',
        estrategia_es: typeof parsed.estrategia_es === 'string' ? parsed.estrategia_es.slice(0, 400) : '',
        recomendaciones_es: strings(parsed.recomendaciones_es, 4),
        cv,
        full_text: cvToText(cv),
        base_cv_text: profileToPlainText(profile),
        removed,
      },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error('Error generando el CV:', err);
    if (isTransientGeminiError(err?.message || '')) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Hemos recibido mucho tráfico en este momento. Intenta de nuevo en unos minutos.' },
        { status: 429, headers }
      );
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar el CV. Intenta de nuevo.' }, { status: 500, headers });
  }
}
