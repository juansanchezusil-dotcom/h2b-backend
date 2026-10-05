import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { guardAiRequest, CV_TURN_DAILY_LIMIT } from '../../../../src/ai/guard';
import { generateTextWithFallback, isTransientGeminiError } from '../../../../src/ai/callGemini';
import { buildInterviewPrompt, type InterviewTurn } from '../../../../src/ai/cv/prompts';
import { computeGaps, mergeProfile, sanitizeProfile } from '../../../../src/ai/cv/profile';

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

const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_DOC_BASE64 = 4_000_000; // ~3 MB de archivo; Vercel acepta cuerpos de hasta ~4.5 MB

// Un turno de la entrevista del CV: recibe el perfil acumulado y la conversación reciente,
// extrae lo nuevo que dijo el usuario (o de su CV subido) y responde con la siguiente pregunta.
// Qué falta y si ya se puede generar el CV lo decide el código (computeGaps), no el modelo.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const blocked = await guardAiRequest(request, headers, { bucket: 'cv_turn', limit: CV_TURN_DAILY_LIMIT });
    if (blocked) return blocked;

    const body = await request.json();
    const profile = sanitizeProfile(body.profile);
    const turns: InterviewTurn[] = (Array.isArray(body.turns) ? body.turns : [])
      .filter((t: any) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.text === 'string')
      .slice(-8)
      .map((t: any) => ({ role: t.role, text: t.text.slice(0, 1500) }));
    const pastedCv: string = typeof body.pastedCv === 'string' ? body.pastedCv.trim() : '';
    const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const job =
      body.job && typeof body.job === 'object'
        ? { title: clip(body.job.title, 120), employer_name: clip(body.job.employer_name, 120), job_duties: clip(body.job.job_duties, 1500) }
        : null;
    const doc = body.document;

    let documentPart: { inlineData: { mimeType: string; data: string } } | null = null;
    if (doc) {
      const data = typeof doc.base64 === 'string' ? doc.base64.replace(/^data:[^;]+;base64,/, '') : '';
      if (!DOC_TYPES.includes(doc.mediaType) || !data) {
        return NextResponse.json({ error: 'Sube tu CV como PDF o como foto (JPG, PNG o WebP).' }, { status: 400, headers });
      }
      if (data.length > MAX_DOC_BASE64) {
        return NextResponse.json({ error: 'El archivo pesa más de 3 MB. Sube uno más liviano.' }, { status: 413, headers });
      }
      documentPart = { inlineData: { mimeType: doc.mediaType, data } };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }
    const ai = new GoogleGenAI({ apiKey });

    const prompt = buildInterviewPrompt({
      profile,
      gaps: computeGaps(profile),
      turns,
      pastedCv,
      hasDocument: !!documentPart,
      isFirstTurn: turns.length === 0 && !pastedCv && !documentPart,
      job,
    });

    const text = await generateTextWithFallback(ai, {
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }, ...(documentPart ? [documentPart] : [])] }],
      config: { responseMimeType: 'application/json' },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      console.error('Entrevista CV: el modelo no devolvió JSON válido:', text.slice(0, 200));
      return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo procesar tu respuesta. Intenta de nuevo.' }, { status: 502, headers });
    }

    const merged = mergeProfile(profile, { ...(parsed.profile_updates || {}), route: parsed.route || parsed.profile_updates?.route });
    const gaps = computeGaps(merged);
    const reply = typeof parsed.reply_es === 'string' ? parsed.reply_es.trim().slice(0, 1200) : '';

    return NextResponse.json(
      {
        reply_es: reply || 'Cuéntame un poco más sobre tu experiencia.',
        profile: merged,
        gaps,
        ready: !gaps.some((g) => g.level === 'critical'),
      },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error('Error en la entrevista del CV:', err);
    if (isTransientGeminiError(err?.message || '')) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Hemos recibido mucho tráfico en este momento. Intenta de nuevo en unos minutos.' },
        { status: 429, headers }
      );
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo procesar tu respuesta. Intenta de nuevo.' }, { status: 500, headers });
  }
}
