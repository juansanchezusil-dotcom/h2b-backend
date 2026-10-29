-- Errores que ocurren en el celular o navegador de las personas (la app los manda a /api/client-errors).
-- Sirven para enterarse de fallas que nadie reporta. Solo el servidor (llave de servicio) lee y escribe.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,            -- error | promesa | pantalla
  message text not null,
  stack text,
  url text,
  user_agent text,
  fingerprint text not null      -- mismo error = misma huella, para agruparlos
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
create index if not exists client_errors_fingerprint_idx on public.client_errors (fingerprint, created_at desc);

alter table public.client_errors enable row level security;
