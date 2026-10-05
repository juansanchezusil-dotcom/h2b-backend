-- Asistente de CV con entrevista: guarda el borrador, la ruta, el CV generado y la carta.
alter table public.profiles
  add column if not exists cv_draft jsonb,
  add column if not exists cv_route text check (cv_route in ('A', 'B', 'C')),
  add column if not exists cv_en jsonb,
  add column if not exists cover_letter_en text;

-- El límite diario ahora es por "bucket": los turnos de entrevista del CV tienen tope aparte
-- de los usos generales de IA.
alter table public.ai_usage add column if not exists bucket text not null default 'ai';
alter table public.ai_usage drop constraint if exists ai_usage_pkey;
alter table public.ai_usage add primary key (user_id, day, bucket);

drop function if exists public.consume_ai_usage(uuid, integer);

create or replace function public.consume_ai_usage(p_user uuid, p_limit integer, p_bucket text default 'ai')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, day, bucket, count)
  values (p_user, (now() at time zone 'utc')::date, p_bucket, 1)
  on conflict (user_id, day, bucket)
  do update set count = public.ai_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.consume_ai_usage(uuid, integer, text) from public, anon, authenticated;
