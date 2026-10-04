-- Límite diario de uso de los asistentes de IA (CV, correo, detector de estafas, entrevista).
-- Solo el backend (service role) lee y escribe aquí: RLS activado y sin políticas.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Suma 1 al contador del día de forma atómica y dice si todavía está dentro del límite.
-- Devuelve el contador ya incrementado; si supera p_limit el backend rechaza la llamada.
create or replace function public.consume_ai_usage(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set count = public.ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.consume_ai_usage(uuid, integer) from public, anon, authenticated;
