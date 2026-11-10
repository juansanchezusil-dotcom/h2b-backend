-- Preguntas al asistente "Pregúntale a Juan", para mejorar sus respuestas y ver qué dudas se repiten.
-- Sin nombre, correo ni id de usuario. Se borran a los 90 días (lo hace el proceso diario).
-- Solo el backend (service role) lee y escribe: RLS activado, sin políticas y sin permisos para anon/authenticated.
-- Reversa:
--   drop table if exists public.asistente_preguntas;

create table if not exists public.asistente_preguntas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pregunta text not null,
  respuesta text not null,
  deriva boolean not null default false,
  pantalla text
);
alter table public.asistente_preguntas enable row level security;
revoke all on public.asistente_preguntas from anon, authenticated;
create index if not exists asistente_preguntas_created_idx on public.asistente_preguntas (created_at desc);
