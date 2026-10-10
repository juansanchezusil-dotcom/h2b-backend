-- Contactos del Mapa público: darse de baja del correo y no repetir el recordatorio de la masterclass.
alter table public.map_leads add column if not exists unsubscribed_at timestamptz;
alter table public.map_leads add column if not exists reminder_sent_at timestamptz;
