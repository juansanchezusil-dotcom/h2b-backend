-- Correos de reenganche y renovación (Fase B del radar):
--   1) profiles.email_optout: la persona pidió no recibir estos avisos. Se respeta siempre.
--   2) email_log: qué correo se le envió a quién y cuándo, para no repetir ni insistir.
-- Los correos del sistema de seguimiento 7-14-21 (recordatorios de postulaciones) no dependen de esto.

alter table public.profiles
  add column if not exists email_optout boolean not null default false;

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('renewal_7', 'renewal_3', 'renewal_after', 'reengage')),
  -- Identifica "el mismo aviso": para renovaciones, la fecha de vencimiento; para reenganche, la semana.
  -- Si la persona renueva, la fecha cambia y los avisos vuelven a aplicar.
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);

create index if not exists email_log_user_time_idx on public.email_log (user_id, created_at desc);

-- Solo el backend (llave de servicio) la lee y la escribe: RLS activado y sin políticas.
alter table public.email_log enable row level security;
