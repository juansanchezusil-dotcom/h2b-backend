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
