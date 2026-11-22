import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiClient, generateTextWithFallback } from '../src/ai/callGemini';

// Las rutas de IA exigían GEMINI_API_KEY y respondían 500 aunque Claude, el proveedor principal, estuviera listo.
afterEach(() => vi.unstubAllEnvs());

describe('aiClient', () => {
  it('basta con la llave de Claude', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(aiClient()).not.toBeNull();
  });

  it('basta con la llave de Gemini', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'g-test');
    expect(aiClient()).not.toBeNull();
  });

  it('sin ninguna llave no hay cliente', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(aiClient()).toBeNull();
  });
});

describe('generateTextWithFallback sin llave de Gemini', () => {
  it('no intenta Gemini y avisa que no hay proveedor', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    const ai = { models: { generateContent: vi.fn() } } as never;
    await expect(generateTextWithFallback(ai, { model: 'x', contents: 'hola' })).rejects.toThrow('No hay proveedor de IA');
    expect((ai as { models: { generateContent: ReturnType<typeof vi.fn> } }).models.generateContent).not.toHaveBeenCalled();
  });
});
