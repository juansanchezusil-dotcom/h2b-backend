import { NextResponse } from 'next/server';

function corsHeaders(origin: string | null) {
  // Permite juanteavisa.com, www.juanteavisa.com o cualquier subdominio válido
  const isAllowed = origin && (origin.endsWith('juanteavisa.com') || origin === 'https://juanteavisa.com');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://juanteavisa.com',
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('Falta OPENROUTER_API_KEY en las variables de entorno');
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500, headers });
    }

    const systemPrompt = `Eres un experto en detectar señales de fraude en el proceso de visa de trabajo H2B (Estados Unidos). 
Analiza la imagen proporcionada (puede ser una captura de chat, un contrato, un correo o una promesa por escrito) y evalúa si contiene señales de alerta de posible estafa, tales como: solicitud de pago o dinero, promesas o garantías de visa, solicitud de datos personales o bancarios, presión de urgencia, falta de identificación oficial de la empresa, lenguaje ambiguo o poco profesional, o cualquier otra señal sospechosa relacionada con fraudes de visas de trabajo.
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON, con exactamente esta estructura:
{"nivel": "alto" o "moderado" o "bajo", "resumen": "string corto en español explicando el veredicto en 1-2 frases", "senales": ["señal encontrada 1", "señal encontrada 2"], "recomendacion": "string en español con la recomendación práctica"}
Si no encuentras señales de alerta, deja "senales" como un array vacío.`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://juanteavisa.com',
        'X-Title': 'Juan Te Avisa - Detector de Estafas',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Analiza esta imagen según tus instrucciones y responde solo con el JSON.',
              },
            ],
          },
        ],
      }),
    });

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error('Error de OpenRouter:', errText);
      return NextResponse.json({ error: 'Error al analizar la imagen con OpenRouter' }, { status: 502, headers });
    }

    const data = await openRouterRes.json();
    const contentText = data.choices?.[0]?.message?.content;

    if (!contentText) {
      return NextResponse.json({ error: 'Respuesta inesperada de la IA' }, { status: 502, headers });
    }

    const clean = contentText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json(parsed, { status: 200, headers });
  } catch (err: any) {
    console.error('Error en analyze-scam-image:', err);
    return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500, headers });
  }
}