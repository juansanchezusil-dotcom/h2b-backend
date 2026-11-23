import type { SupabaseClient } from '@supabase/supabase-js';
import { errMsg } from '../utils/errors';

export interface CronOutcome {
  ok: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

// Ejecuta un proceso programado y deja una fila en cron_runs (inicio, fin, resultado).
// Guardar el registro nunca debe tumbar el proceso: si falla, solo se avisa en consola.
export async function withCronRun<T extends CronOutcome>(
  supabase: SupabaseClient,
  job: string,
  fn: () => Promise<T>
): Promise<T> {
  let runId: number | null = null;
  try {
    const { data, error } = await supabase.from('cron_runs').insert({ job }).select('id').single();
    if (error) console.error('⚠️ cron_runs: no se pudo abrir el registro:', error.message);
    else runId = data.id;
  } catch (e) {
    console.error('⚠️ cron_runs: no se pudo abrir el registro:', errMsg(e));
  }

  const close = async (outcome: CronOutcome) => {
    if (runId === null) return;
    try {
      const { error } = await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          ok: outcome.ok,
          details: outcome.details ?? null,
          error: outcome.error ?? null,
        })
        .eq('id', runId);
      if (error) console.error('⚠️ cron_runs: no se pudo cerrar el registro:', error.message);
    } catch (e) {
      console.error('⚠️ cron_runs: no se pudo cerrar el registro:', errMsg(e));
    }
  };

  try {
    const result = await fn();
    await close(result);
    return result;
  } catch (e) {
    await close({ ok: false, error: errMsg(e) });
    throw e;
  }
}
