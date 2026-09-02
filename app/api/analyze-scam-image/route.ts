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
      return NextResponse.json({ error: 'Falta la imagen o el tipo' }, { status: 400, headers });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta GEMINI_API_KEY' }, { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const systemPrompt = `Eres un experto en detectar señales de fraude en el proceso de visa de trabajo H2B (Estados Unidos). 
Analiza la imagen proporcionada y evalúa si contiene señales de alerta de posible estafa (cobros al trabajador, promesas de visa garantizada, urgencia, depósitos a cuentas personales, etc.).
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin bloques de código triple backtick, con este formato:
{"nivel": "alto" o "moderado" o "bajo", "resumen": "string corto en español", "senales": ["señal 1", "señal 2"], "recomendacion": "string en español"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: mediaType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    });

    const textResult = response.text || '';
    const cleanJson = textResult.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json(parsed, { status: 200, headers });
  } catch (err: any) {
    console.error('Error en analyze-scam-image:', err);
    return NextResponse.json({ error: 'No se pudo procesar la imagen' }, { status: 500, headers });
  }
}