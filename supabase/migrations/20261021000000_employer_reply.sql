-- La persona registra que el empleador le respondió y qué tipo de respuesta fue (lo marca ella en su tarjeta).
-- Alimenta el tablero de Resultados del administrador (solo totales, sin nombres).
alter table public.applications add column if not exists reply_type text;
alter table public.applications add column if not exists reply_at timestamptz;

alter table public.applications drop constraint if exists applications_reply_type_check;
alter table public.applications
  add constraint applications_reply_type_check
  check (reply_type is null or reply_type in ('mas_datos', 'entrevista', 'rechazo', 'otra'));
