-- Recuperar el Mapa público con el correo: cuándo se envió el último enlace (para no repetirlo seguido).
alter table public.map_leads add column if not exists recover_sent_at timestamptz;
