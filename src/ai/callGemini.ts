import { GoogleGenAI } from '@google/genai';

// Los tres asistentes de IA (CV, correo, detector de estafas) llaman a Gemini
// de la misma forma y chocan con el mismo problema: el modelo a veces responde
// 503 "high demand" o 429 de cupo, errores que casi siempre se resuelven solos
// en unos segundos. Antes cada ruta se rendía en el primer intento y le
// mostraba a la persona el JSON crudo de Gemini en inglés.

// Frases de Gemini que indican una saturación pasajera, no un error real
const TRANSIENT_PATTERNS = ['503', 'UNAVAILABLE', 'OVERLOADED', 'HIGH DEMAND', '429', 'RESOURCE_EXHAUSTED', 'QUOTA'];

export function isTransientGeminiError(message: string): boolean {
  const upper = (message || '').toUpperCase();
  return TRANSIENT_PATTERNS.some((p) => upper.includes(p));
}

interface GenerateOptions {
  retries?: number; // reintentos además del primer intento
  delayMs?: number; // espera entre reintentos
}

// Reintenta solo si el error se ve pasajero (ver isTransientGeminiError).
// Un error de otro tipo (API key inválida, prompt inválido) se relanza de
// inmediato: reintentarlo no cambiaría nada y solo demoraría la respuesta.
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  { retries = 2, delayMs = 2500 }: GenerateOptions = {}
) {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const message = err?.message || String(err);
      if (attempt === retries || !isTransientGeminiError(message)) throw err;
      console.warn(`⚠️ Gemini saturado (intento ${attempt + 1}/${retries + 1}), reintentando en ${delayMs}ms:`, message);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// Convierte el prompt de Gemini (texto + imágenes inline) al formato de Claude.
function toClaudeContent(contents: any) {
  const parts: any[] = contents?.[0]?.parts || [];
  return parts.map((p) => {
    if (!p.inlineData) return { type: 'text', text: p.text || '' };
    const source = { type: 'base64', media_type: p.inlineData.mimeType, data: p.inlineData.data };
    // Claude recibe los PDF como "document" y las fotos como "image"
    return { type: p.inlineData.mimeType === 'application/pdf' ? 'document' : 'image', source };
  });
}

async function callHaiku(contents: any): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: toClaudeContent(contents) },
        // Prellenar con "{" obliga a Claude a responder directo con el JSON
        { role: 'assistant', content: '{' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Haiku ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return '{' + (data.content?.[0]?.text || '');
}

// Gemini primero (con reintentos). Si sigue saturado y hay ANTHROPIC_API_KEY,
// responde con Claude Haiku para que la persona no vea el error de "mucho tráfico".
export async function generateTextWithFallback(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
): Promise<string> {
  try {
    const response = await generateContentWithRetry(ai, params);
    return response.text || '';
  } catch (err: any) {
    const message = err?.message || String(err);
    if (!process.env.ANTHROPIC_API_KEY || !isTransientGeminiError(message)) throw err;
    console.warn('⚠️ Gemini saturado, respondiendo con Claude Haiku:', message);
    return callHaiku(params.contents);
  }
}
