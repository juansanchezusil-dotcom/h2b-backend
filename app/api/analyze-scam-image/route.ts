import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const { imageBase64, mediaType } = await request.json();

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Falta la imagen o el tipo de archivo' }, { status: 400, headers });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const promptText = `Eres un experto en detectar señales de fraude en el proceso de visa de trabajo H2B (Estados Unidos). 
Analiza la imagen proporcionada y evalúa si contiene señales de alerta de posible estafa.
Debes responder ÚNICAMENTE con un objeto JSON estricto con las claves: "nivel" ("alto", "moderado" o "bajo"), "resumen", "senales" (array de strings) y "recomendacion".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mediaType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);

    return NextResponse.json(parsed, { status: 200, headers });

  } catch (err: any) {
    console.error('Error procesando la imagen con Gemini:', err);

    // Detectar específicamente el error de cuota agotada (429) para dar
    // un mensaje claro al usuario en vez de un error genérico.
    const errorMessage = err.message || '';
    const isRateLimit =
      err.status === 429 ||
      errorMessage.includes('429') ||
      errorMessage.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
      errorMessage.toUpperCase().includes('QUOTA');

    if (isRateLimit) {
      return NextResponse.json(
        {
          errorCode: 'RATE_LIMIT',
          error: 'Hemos recibido mucho tráfico en este momento. Por favor intenta de nuevo en unos minutos.',
        },
        { status: 429, headers }
      );
    }

    return NextResponse.json(
      { errorCode: 'GENERIC', error: err.message || 'Error del servidor' },
      { status: 500, headers }
    );
  }
}