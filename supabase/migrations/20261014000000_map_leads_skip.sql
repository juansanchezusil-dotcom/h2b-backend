-- Contactos del Mapa que ya están registrados en la masterclass: no reciben el recordatorio para no duplicar.
alter table public.map_leads add column if not exists skip_reminder boolean not null default false;
