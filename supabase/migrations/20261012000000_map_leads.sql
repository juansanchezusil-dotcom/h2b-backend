-- Mapa H2B público (mapa.juanteavisa.com): personas que no son miembros dejan su correo, con su
-- consentimiento, para recibir su mapa y que Juan les escriba sobre la masterclass.
-- Solo el backend (llave de servicio) lee y escribe: RLS activado y sin políticas.

create table if not exists public.map_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nombre text,
  consent_at timestamptz not null default now(),
  role text,
  industry text,
  stage text,
  answers jsonb not null default '{}'::jsonb,
  source text not null default 'mapa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists map_leads_email_key on public.map_leads (lower(email));
create index if not exists map_leads_created_idx on public.map_leads (created_at desc);

alter table public.map_leads enable row level security;
