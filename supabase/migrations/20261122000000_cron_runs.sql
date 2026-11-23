-- Registro de cada corrida de los procesos programados (cron): cuándo corrió, si salió bien y qué hizo.
create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  details jsonb,
  error text
);

create index if not exists cron_runs_job_started_idx on public.cron_runs (job, started_at desc);

-- Solo el servidor (service role) lee y escribe; sin políticas, nadie más entra.
alter table public.cron_runs enable row level security;
