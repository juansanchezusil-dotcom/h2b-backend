import { NextResponse } from 'next/server';

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
      return NextResponse.json({ error: 'GEMINI_API_KEY no está configurada en Vercel' }, { status: 500, headers });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `Eres un experto en detectar señales de fraude en el proceso de visa de trabajo H2B (Estados Unidos).
Analiza la imagen proporcionada y evalúa si contiene señales de alerta de posible estafa.
Debes responder ÚNICAMENTE con un objeto JSON estricto con las claves: "nivel" ("alto", "moderado" o "bajo"), "resumen", "senales" (array de strings) y "recomendacion".`;

    // Endpoint corregido con el identificador exacto gemini-2.5-flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mediaType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Error desde la API de Gemini:', errText);
      return NextResponse.json({ error: `Error API Gemini: ${geminiRes.status}` }, { status: 500, headers });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed, { status: 200, headers });

  } catch (err: any) {
    console.error('Error interno:', err);
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500, headers });
  }
}