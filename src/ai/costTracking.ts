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

export interface AiCostContext {
  feature?: string; // asistente que hizo la llamada: cv, carta, correo...
  userId?: string; // miembro que la pidió, si hay sesión
}

// Registra una llamada a IA. Nunca lanza ni demora la respuesta: si falla el registro, solo se avisa en el log.
export function recordAiCost(model: string, inputTokens: number, outputTokens: number, ctx: AiCostContext = {}): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const supabase = createClient(url, key);
  supabase
    .rpc('record_ai_cost', { p_model: model, p_input: inputTokens, p_output: outputTokens })
    .then(({ error }) => {
      if (error) console.warn('record_ai_cost falló:', error.message);
    });
  // Detalle por miembro y función, para ver el costo por persona y por asistente
  if (ctx.userId) {
    supabase
      .rpc('record_ai_cost_user', {
        p_user: ctx.userId,
        p_feature: ctx.feature || 'sin_dato',
        p_model: model,
        p_input: inputTokens,
        p_output: outputTokens,
      })
      .then(({ error }) => {
        if (error) console.warn('record_ai_cost_user falló:', error.message);
      });
  }
}
