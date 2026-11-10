import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { aiUserId, guardAiRequest } from '../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../src/ai/callGemini';
import { ASISTENTE_DAILY_LIMIT, MAX_MESSAGE, buildAsistentePrompt, cleanHistory, clip } from '../../../src/ai/asistente';
import { errMsg } from '../../../src/utils/errors';
import { guardarPregunta } from '../../../src/ai/asistentePreguntas';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// "Pregúntale a Juan": responde dudas de los miembros sobre la app y el proceso H-2B. Solo miembros con
// acceso vigente, con tope diario propio y costo registrado bajo la función "asistente".
export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  try {
    const body = await request.json().catch(() => ({}));
    const message = clip(body.message, MAX_MESSAGE);
    if (message.length < 3) return NextResponse.json({ error: 'Escribe tu duda.' }, { status: 400, headers });

    const blocked = await guardAiRequest(request, headers, { bucket: 'asistente', limit: ASISTENTE_DAILY_LIMIT });
    if (blocked) return blocked;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 500, headers });
    const ai = new GoogleGenAI({ apiKey });

    const prompt = buildAsistentePrompt(message, cleanHistory(body.history), clip(body.pantalla, 60));
    const text = await generateTextWithFallback(
      ai,
      { model: 'gemini-3.6-flash', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } },
      { feature: 'asistente', userId: aiUserId(request) }
    );
    let parsed: { respuesta?: unknown; deriva?: unknown } = {};
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      parsed = {};
    }
    const respuesta = clip(parsed.respuesta, 1200);
    if (!respuesta) {
      return NextResponse.json({ errorCode: 'GENERIC', error: 'No pude responder esta vez. Intenta de nuevo.' }, { status: 502, headers });
    }
    const deriva = parsed.deriva === true;
    // Sin nombre ni correo; si falla el guardado no se corta la respuesta
    await guardarPregunta({ pregunta: message, respuesta, deriva, pantalla: clip(body.pantalla, 60) });
    return NextResponse.json({ respuesta, deriva, limite: ASISTENTE_DAILY_LIMIT }, { status: 200, headers });
  } catch (err) {
    console.error('Error en el asistente de dudas:', err);
    if (isTransientGeminiError(errMsg(err) || '')) {
      return NextResponse.json({ errorCode: 'RATE_LIMIT', error: 'Hay mucho tráfico ahora. Intenta de nuevo en unos minutos.' }, { status: 429, headers });
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No pude responder esta vez. Intenta de nuevo.' }, { status: 500, headers });
  }
}
