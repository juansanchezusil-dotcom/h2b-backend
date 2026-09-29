import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { generateContentWithRetry, isTransientGeminiError } from '../../../../src/ai/callGemini';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// Adapta el CV en texto libre del candidato a un currículum en inglés, estilo H-2B.
// No inventa experiencia: solo reescribe y ordena lo que la persona escribió.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const baseCvText: string = (body.baseCvText || '').trim();
    const skills: string[] = Array.isArray(body.skills) ? body.skills.filter(Boolean) : [];
    const targetRole: string = body.targetRole || '';
    const industry: string = body.industry || '';
    const experienceLevel: string = body.experienceLevel || '';
    const englishLevel: string = body.englishLevel || '';
    // Oferta específica a la que quiere adaptarse (opcional)
    const job = body.job || null;

    if (baseCvText.length < 30) {
      return NextResponse.json(
        { error: 'Cuéntanos tu experiencia con un poco más de detalle antes de generar el CV.' },
        { status: 400, headers }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `Eres un experto en currículums para el programa de visas H-2B (trabajo temporal en EE. UU.). Tu tarea es convertir la experiencia laboral que te da el candidato, escrita en sus propias palabras, en un currículum profesional en INGLÉS, con el formato que esperan los empleadores estadounidenses.

REGLA MÁS IMPORTANTE: NUNCA inventes experiencia, empleadores, fechas, logros ni habilidades que el candidato no mencionó. Tu trabajo es reescribir y organizar lo que él te dio, con mejor redacción y verbos de acción — no agregar contenido nuevo. Si algo no está claro o falta un dato (como fechas exactas), dilo de forma general en vez de inventarlo (ej. "Recent experience" en vez de una fecha falsa).

Formato de currículum americano (US resume):
- Sin foto, sin datos personales sensibles (sin pasaporte, sin fecha de nacimiento, sin estado civil).
- Bullets que empiezan con un verbo de acción en pasado (Operated, Prepared, Maintained, Assisted, Managed...).
- Cuantifica solo si el candidato dio un número real (ej. "team of 5", "50+ rooms per day"). Si no dio números, no inventes ninguno.
- Tono profesional, directo, sin relleno.

Datos del candidato:
- Puesto objetivo: ${targetRole || 'No especificado'}
- Industria: ${industry || 'No especificada'}
- Nivel de experiencia: ${experienceLevel || 'No especificado'}
- Nivel de inglés: ${englishLevel || 'No especificado'}
- Habilidades que menciona: ${skills.join(', ') || 'Ninguna indicada'}
- Experiencia en sus propias palabras:
"""
${baseCvText}
"""
${job ? `\nEsta persona quiere adaptar su CV para esta oferta específica (usa esto solo para decidir qué resaltar primero y qué palabras clave usar, NUNCA para inventar experiencia que calce con la oferta):\n- Puesto: ${job.title || ''}\n- Empresa: ${job.employer_name || ''}\n- Funciones del puesto: ${job.job_duties || job.job_description || 'No especificadas'}` : ''}

Responde ÚNICAMENTE con un objeto JSON con estas claves:
- "summary": 2-3 líneas en inglés que resumen el perfil (solo con lo que el candidato dio).
- "experience_bullets": array de strings en inglés, cada uno un logro o responsabilidad real, listo para pegar en un CV.
- "skills": array de strings en inglés, las habilidades del candidato (las que mencionó, traducidas/formalizadas).
- "full_text": el CV completo en inglés, en texto plano, listo para copiar o descargar (con secciones SUMMARY, EXPERIENCE, SKILLS).
- "notes_es": un string en español con 1-2 frases sugiriendo qué información le faltó dar (fechas, nombres de empresas, logros con números) para mejorar el CV la próxima vez. Si no falta nada importante, deja este campo vacío.`;

    // Gemini a veces responde 503 "high demand" de forma pasajera; 2 reintentos
    // silenciosos antes de rendirse cubren casi todos esos casos.
    const response = await generateContentWithRetry(ai, {
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    return NextResponse.json(parsed, { status: 200, headers });
  } catch (err: any) {
    console.error('Error generando CV con Gemini:', err);
    const msg = err.message || '';

    if (isTransientGeminiError(msg)) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Hemos recibido mucho tráfico en este momento. Intenta de nuevo en unos minutos.' },
        { status: 429, headers }
      );
    }
    return NextResponse.json({ errorCode: 'GENERIC', error: 'No se pudo generar el CV. Intenta de nuevo.' }, { status: 500, headers });
  }
}
