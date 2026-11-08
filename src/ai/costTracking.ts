import { createClient } from '@supabase/supabase-js';

// Dólares por millón de tokens (tarifa estándar, prompts de hasta 100K tokens). Si Anthropic cambia
// precios, se edita aquí y el panel recalcula el historial completo.
export const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
};

// Cuando Claude falla y responde Gemini no hay tokens que medir: se cuenta la llamada con este nombre.
export const GEMINI_FALLBACK_MODEL = 'gemini-fallback';

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = CLAUDE_PRICING[model];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// Registra una llamada a IA. Nunca lanza ni demora la respuesta: si falla el registro, solo se avisa en el log.
export function recordAiCost(model: string, inputTokens: number, outputTokens: number): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  createClient(url, key)
    .rpc('record_ai_cost', { p_model: model, p_input: inputTokens, p_output: outputTokens })
    .then(({ error }) => {
      if (error) console.warn('record_ai_cost falló:', error.message);
    });
}
