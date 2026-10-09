-- Fase 3: datos que antes vivían solo en el navegador.
--   1) profiles.manual_steps: pasos manuales del Mapa (pasaporte, DS-160). Así los ve el radar y
--      sobreviven a cambiar de dispositivo. Las políticas de profiles ya limitan cada fila a su dueño.
--   2) class_offers: ofertas que el administrador encuentra en vivo (masterclass) y que ven todos los miembros.
--      Solo el backend (llave de servicio) escribe; los miembros solo leen las activas.

alter table public.profiles
  add column if not exists manual_steps jsonb not null default '{}'::jsonb;

create table if not exists public.class_offers (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  company_name text not null,
  state text,
  url text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists class_offers_active_idx on public.class_offers (active, created_at desc);

alter table public.class_offers enable row level security;

drop policy if exists "ver ofertas de la clase" on public.class_offers;
create policy "ver ofertas de la clase" on public.class_offers
  for select to authenticated
  using (active);
