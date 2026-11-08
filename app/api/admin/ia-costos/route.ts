import { NextResponse } from 'next/server';
import { adminClient, requireAdmin } from '../../../../src/admin/auth';
import { estimateCostUsd } from '../../../../src/ai/costTracking';

export const dynamic = 'force-dynamic';

// Costo estimado de los asistentes de IA para el administrador: por día y por modelo, con total.
// ?dias=30 (1 a 365). Solo lectura. El saldo real está en console.anthropic.com.
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const requested = Number(new URL(request.url).searchParams.get('dias'));
  const days = Number.isFinite(requested) && requested >= 1 ? Math.min(Math.floor(requested), 365) : 30;
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await adminClient()
    .from('ai_cost_daily')
    .select('day, model, calls, input_tokens, output_tokens')
    .gte('day', since)
    .order('day', { ascending: false });
  if (error) {
    console.error('Error leyendo ai_cost_daily:', error.message);
    return NextResponse.json({ error: 'No se pudo cargar el costo de IA.' }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    day: r.day as string,
    model: r.model as string,
    calls: r.calls as number,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    costUsd: estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens)),
  }));

  const byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const r of rows) {
    const m = (byModel[r.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    m.calls += r.calls;
    m.inputTokens += r.inputTokens;
    m.outputTokens += r.outputTokens;
    m.costUsd += r.costUsd;
  }
  const totalCostUsd = rows.reduce((sum, r) => sum + r.costUsd, 0);
  const totalCalls = rows.reduce((sum, r) => sum + r.calls, 0);

  return NextResponse.json({
    days,
    since,
    totalCostUsd,
    totalCalls,
    avgCostPerCallUsd: totalCalls ? totalCostUsd / totalCalls : 0,
    byModel,
    rows,
  });
}
