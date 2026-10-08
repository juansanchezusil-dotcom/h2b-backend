-- Base de actividad para el radar de riesgo y los retos:
--   1) profiles.last_seen_at: última vez que la persona abrió la app.
--   2) application_events: historial de cambios de estado de cada postulación. Lo llena un trigger,
--      así no depende de que el navegador lo registre bien y no se puede alterar desde el cliente.
-- Los datos solo se acumulan desde que esto se activa: por eso va primero.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Sin llave foránea a propósito: si la persona borra la postulación, el historial se conserva
  application_id uuid,
  -- Empresa en minúsculas y sin espacios sobrantes, para contar empresas distintas
  company_name text not null,
  from_status text, -- null = la postulación se creó con ese estado
  to_status text not null,
  source text not null default 'trigger' check (source in ('trigger', 'backfill')),
  created_at timestamptz not null default now()
);

create index if not exists application_events_user_time_idx
  on public.application_events (user_id, created_at desc);
create index if not exists application_events_status_time_idx
  on public.application_events (to_status, created_at desc);

-- Solo el backend (llave de servicio) la lee y la escribe: RLS activado y sin políticas.
alter table public.application_events enable row level security;

create or replace function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.application_events (user_id, application_id, company_name, from_status, to_status)
    values (new.user_id, new.id, lower(trim(new.company_name)), null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.application_events (user_id, application_id, company_name, from_status, to_status)
    values (new.user_id, new.id, lower(trim(new.company_name)), old.status, new.status);
  end if;

  return null;
end;
$$;

revoke all on function public.log_application_status() from public, anon, authenticated;

drop trigger if exists application_status_log on public.applications;
create trigger application_status_log
  after insert or update of status on public.applications
  for each row execute function public.log_application_status();

-- Carga inicial: una fila por postulación existente, con su estado actual y la fecha de su último
-- cambio. Es aproximada (no hay historial anterior) y queda marcada como 'backfill'.
insert into public.application_events (user_id, application_id, company_name, from_status, to_status, source, created_at)
select a.user_id, a.id, lower(trim(a.company_name)), null, a.status, 'backfill', a.last_updated
from public.applications a
where a.user_id is not null
  and not exists (select 1 from public.application_events e where e.application_id = a.id);
