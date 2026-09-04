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
    const body = await request.json();

    // Soporta el formato nuevo (varias imágenes) y el viejo (una sola), para
    // no romper nada si algo todavía manda el formato anterior.
    const images: { base64: string; mediaType: string }[] = body.images
      ? body.images
      : body.imageBase64
      ? [{ base64: body.imageBase64, mediaType: body.mediaType }]
      : [];

    if (images.length === 0) {
      return NextResponse.json({ error: 'Falta al menos una imagen' }, { status: 400, headers });
    }

    if (images.length > 5) {
      return NextResponse.json({ error: 'Máximo 5 imágenes por análisis' }, { status: 400, headers });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('ERROR: GEMINI_API_KEY no encontrada en process.env');
      return NextResponse.json({ error: 'GEMINI_API_KEY no encontrada' }, { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `Eres un experto en detectar señales de fraude en el proceso de visa de trabajo H2B (Estados Unidos), enfocado en el CONTENIDO de lo que se solicita o promete, no en un análisis forense de si la imagen fue editada.

Puede que se te entreguen varias imágenes: pueden ser distintas páginas del mismo documento (ej. página 1 de 2, página 2 de 2), o distintas piezas de evidencia relacionadas (ej. una captura de chat y un contrato). Analízalas en conjunto como parte de un mismo caso.

IMPORTANTE - NO marques estas cosas como señales de alerta, son normales en documentos oficiales reales:
- Que sea una foto (no un escaneo digital) de un papel físico: siempre tendrá ligera borrosidad, sombras, o variación de nitidez. Esto NO es evidencia de edición.
- Que las fechas de validez del aviso principal y las del talón I-94 sean distintas: los avisos I-797A explican en su propio texto que el I-94 puede tener un período de gracia de hasta 10 días antes/después. Esto es NORMAL, no una inconsistencia.
- Que un número de caso del DOL/USCIS (ETA Case Number) aparezca con o sin guiones: ambos formatos existen en documentos oficiales reales (ej. "H40023184162635" y "H-400-23-184-162-635" pueden ser el mismo número válido).

SÍ marca como señales de alerta genuinas:
- Solicitud de pago, depósito, o transferencia al trabajador (el trabajador NUNCA paga en el proceso H2B legítimo)
- Promesas o garantías absolutas de aprobación de visa
- Solicitud de datos bancarios o información personal sensible fuera de canales oficiales
- Presión de urgencia ("paga hoy o pierdes el puesto")
- Contacto solo por WhatsApp/redes sociales sin ningún canal oficial verificable
- Lenguaje o formato que no corresponde en absoluto a comunicación oficial (errores graves, membretes falsos evidentes)

Si el documento es un formulario oficial de USCIS/DOL (I-797, I-129, ETA, etc.) sin ninguna de las señales de arriba, tu veredicto debe ser "bajo" con un resumen que reconozca que parece un documento oficial legítimo, y tu recomendación debe sugerir verificar el número de recibo en https://egov.uscis.gov/ como confirmación adicional, no como razón de sospecha.
Si notas alguna de las situaciones normales descritas arriba (diferencia de fechas por período de gracia, número de caso sin guiones, imperfecciones propias de una foto), MENCIÓNALAS brevemente en tu "resumen" explicando por qué son normales y no una señal de alerta. Esto es importante: el usuario debe sentir que la IA sí revisó esos detalles y los entendió correctamente, no que los pasó por alto. Por ejemplo: "La fecha del talón I-94 (06/10/2024) difiere de la fecha principal (05/31/2024) porque corresponde al período de gracia estándar que USCIS explica en el propio aviso; esto es normal y no indica alteración."
Responde ÚNICAMENTE con un objeto JSON estricto con las claves: "nivel" ("alto", "moderado" o "bajo"), "resumen", "senales" (array de strings) y "recomendacion".`;

    const imageParts = images.map((img) => ({
      inlineData: {
        mimeType: img.mediaType,
        data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
      },
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }, ...imageParts],
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