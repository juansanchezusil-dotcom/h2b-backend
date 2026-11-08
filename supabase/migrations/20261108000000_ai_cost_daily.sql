-- Costo de IA por día y modelo: llamadas y tokens. El precio en dólares se calcula al leer
-- (src/ai/costTracking.ts), así un cambio de tarifa no obliga a tocar los datos.
-- Solo el backend (service role) lee y escribe aquí: RLS activado y sin políticas.

create table if not exists public.ai_cost_daily (
  day date not null default (now() at time zone 'utc')::date,
  model text not null,
  calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (day, model)
);

alter table public.ai_cost_daily enable row level security;

create or replace function public.record_ai_cost(p_model text, p_input integer, p_output integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_cost_daily (day, model, calls, input_tokens, output_tokens)
  values ((now() at time zone 'utc')::date, p_model, 1, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (day, model)
  do update set
    calls = public.ai_cost_daily.calls + 1,
    input_tokens = public.ai_cost_daily.input_tokens + greatest(p_input, 0),
    output_tokens = public.ai_cost_daily.output_tokens + greatest(p_output, 0);
end;
$$;

revoke all on function public.record_ai_cost(text, integer, integer) from public, anon, authenticated;
