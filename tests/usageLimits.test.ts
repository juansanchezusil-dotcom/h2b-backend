// Los topes de uso protegen el gasto en IA: si el contador falla, las rutas de IA deben cortar, no dejar pasar.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }) },
    rpc,
  }),
}));
vi.mock('../src/auth/member', () => ({ userHasActiveAccess: async () => true }));
vi.mock('../src/admin/auth', () => ({ adminClient: () => ({ rpc }) }));

import { guardAiRequest } from '../src/ai/guard';
import { allowRequest } from '../src/auth/rateLimit';

const request = () => new Request('https://x.test', { headers: { authorization: 'Bearer t' } });

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('guardAiRequest', () => {
  it('deja pasar dentro del límite', async () => {
    rpc.mockResolvedValue({ data: 20, error: null });
    expect(await guardAiRequest(request(), {})).toBeNull();
  });

  it('corta con 429 al pasar el límite', async () => {
    rpc.mockResolvedValue({ data: 21, error: null });
    expect((await guardAiRequest(request(), {}))?.status).toBe(429);
  });

  it('corta con 503 si el contador falla', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'caído' } });
    expect((await guardAiRequest(request(), {}))?.status).toBe(503);
  });

  it('corta con 503 si el contador responde algo que no es un número', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await guardAiRequest(request(), {}))?.status).toBe(503);
  });
});

describe('allowRequest', () => {
  it('sin failClosed deja pasar si el contador falla', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'caído' } });
    expect(await allowRequest(request(), 'b', 5, 60)).toBe(true);
  });

  it('con failClosed corta si el contador falla o lanza un error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'caído' } });
    expect(await allowRequest(request(), 'b', 5, 60, { failClosed: true })).toBe(false);
    rpc.mockRejectedValueOnce(new Error('sin red'));
    expect(await allowRequest(request(), 'b', 5, 60, { failClosed: true })).toBe(false);
  });

  it('respeta el límite cuando el contador funciona', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await allowRequest(request(), 'b', 5, 60)).toBe(false);
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await allowRequest(request(), 'b', 5, 60, { failClosed: true })).toBe(true);
  });
});
