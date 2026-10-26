import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

// Los asistentes de IA (CV, carta, correo, simulador, detector de estafas) llaman a Claude y, si falla, a Gemini.
// Gemini a veces responde 503 "high demand" o 429 de cupo, errores que casi siempre se resuelven solos
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

// Claude es el principal; Gemini queda de respaldo. "fast" (Haiku) sirve para la entrevista, el correo, el
// simulador y el detector de estafas; "quality" (Sonnet) se reserva para lo que la persona se lleva: el CV y la carta.
const CLAUDE_MODELS = {
  fast: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 6000 },
  quality: { model: 'claude-sonnet-5-5', effort: 'medium', maxTokens: 10000 },
} as const;

export type AiTier = keyof typeof CLAUDE_MODELS;

let claudeClient: Anthropic | null = null;
function getClaude(): Anthropic {
  // Si Claude tarda, queda tiempo para que Gemini responda dentro del mismo pedido
  claudeClient ??= new Anthropic({ timeout: 40_000, maxRetries: 1 });
  return claudeClient;
}

const JSON_ONLY = 'Responde únicamente con el objeto JSON pedido: sin texto antes ni después y sin bloques de código.';

// Convierte el prompt de Gemini (texto + imágenes inline) al formato de Claude.
function toClaudeContent(contents: any): Anthropic.ContentBlockParam[] {
  const parts: any[] = contents?.[0]?.parts || [];
  const blocks = parts.map((p): Anthropic.ContentBlockParam => {
    if (!p.inlineData) return { type: 'text', text: p.text || '' };
    const source = { type: 'base64' as const, media_type: p.inlineData.mimeType, data: p.inlineData.data };
    // Claude recibe los PDF como "document" y las fotos como "image"
    return (p.inlineData.mimeType === 'application/pdf' ? { type: 'document', source } : { type: 'image', source }) as Anthropic.ContentBlockParam;
  });
  blocks.push({ type: 'text', text: JSON_ONLY });
  return blocks;
}

// Los modelos nuevos no aceptan prellenar la respuesta con "{", así que se pide el JSON en el prompt
// y aquí se recorta lo que sobre (por si llega con ```json ... ```).
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

async function callClaude(contents: any, tier: AiTier): Promise<string> {
  const { model, effort, maxTokens } = CLAUDE_MODELS[tier];
  const response = await getClaude().messages.create({
    model,
    max_tokens: maxTokens,
    output_config: { effort },
    messages: [{ role: 'user', content: toClaudeContent(contents) }],
  });
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new Error(`Claude ${model} terminó con ${response.stop_reason}`);
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  if (!text.trim()) throw new Error(`Claude ${model} respondió vacío`);
  // Para medir el costo real por función cuando haya uso de verdad
  console.log(`🤖 Claude ${model}: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
  return extractJson(text);
}

// Claude primero. Si falla (cupo, saturación, imagen no soportada, sin saldo) o no hay ANTHROPIC_API_KEY,
// responde Gemini con sus reintentos, para que la persona no vea el error de "mucho tráfico".
export async function generateTextWithFallback(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  { tier = 'fast' }: { tier?: AiTier } = {}
): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await callClaude(params.contents, tier);
    } catch (err: any) {
      console.warn('⚠️ Claude falló, respondiendo con Gemini:', err?.message || err);
    }
  }
  const response = await generateContentWithRetry(ai, params);
  return response.text || '';
}
