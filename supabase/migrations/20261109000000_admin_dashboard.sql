-- Panel de administrador: foto diaria del negocio y costo de IA por miembro y función.
-- Aditiva y reversible. Solo el backend (service role) lee y escribe: RLS activado y sin políticas.
-- Reversa:
--   drop function if exists public.record_ai_cost_user(uuid, text, text, integer, integer);
--   drop table if exists public.ai_cost_user_daily;
--   drop table if exists public.admin_snapshots;

create table if not exists public.admin_snapshots (
  day date primary key,
  miembros_vigentes integer not null default 0,
  por_vencer integer not null default 0,
  vencidos integer not null default 0,
  activos_7d integer not null default 0,
  postulaciones_dia integer not null default 0,
  ingreso_estimado numeric(10,2) not null default 0
);
alter table public.admin_snapshots enable row level security;

create table if not exists public.ai_cost_user_daily (
  day date not null default (now() at time zone 'utc')::date,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  model text not null,
  calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (day, user_id, feature, model)
);
alter table public.ai_cost_user_daily enable row level security;

create or replace function public.record_ai_cost_user(p_user uuid, p_feature text, p_model text, p_input integer, p_output integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_cost_user_daily (day, user_id, feature, model, calls, input_tokens, output_tokens)
  values ((now() at time zone 'utc')::date, p_user, p_feature, p_model, 1, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (day, user_id, feature, model)
  do update set
    calls = public.ai_cost_user_daily.calls + 1,
    input_tokens = public.ai_cost_user_daily.input_tokens + greatest(p_input, 0),
    output_tokens = public.ai_cost_user_daily.output_tokens + greatest(p_output, 0);
end;
$$;

revoke all on function public.record_ai_cost_user(uuid, text, text, integer, integer) from public, anon, authenticated;
