-- Acciones del radar (Fase A):
--   1) accesos.contactado_el / nota_admin: marca de "ya le escribí" y una nota, solo para el administrador.
--   2) Cada persona puede leer SUS PROPIOS eventos de postulación, para ver su avance del Compromiso
--      dentro de la app. Los eventos de los demás siguen sin ser visibles.

alter table public.accesos
  add column if not exists contactado_el timestamptz,
  add column if not exists nota_admin text;

drop policy if exists "ver mis eventos" on public.application_events;
create policy "ver mis eventos" on public.application_events
  for select to authenticated using (auth.uid() = user_id);
