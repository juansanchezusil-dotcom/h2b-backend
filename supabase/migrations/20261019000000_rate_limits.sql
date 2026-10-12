-- Límite de intentos por origen (para las páginas abiertas, sin sesión: Mapa público y recuperar el mapa).
-- Guarda un contador por "balde" y clave (un hash de la dirección IP, nunca la IP) en ventanas de tiempo.
-- Solo el servidor (llave de servicio) puede usarlo.

create table if not exists public.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- Suma 1 al contador de la ventana actual y devuelve true si todavía está dentro del límite.
create or replace function public.consume_rate_limit(p_bucket text, p_key text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  -- Limpieza barata de ventanas viejas
  delete from public.rate_limits where window_start < now() - interval '2 days';

  insert into public.rate_limits (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_start, 1)
  on conflict (bucket, key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
