-- Secuencia de correos del Mapa público: en qué paso va cada contacto (0 = ninguno, 1 = recordatorio inicial).
alter table public.map_leads add column if not exists sequence_step integer not null default 0;

-- Quienes ya recibieron el recordatorio inicial quedan en el paso 1
update public.map_leads set sequence_step = 1 where reminder_sent_at is not null and sequence_step < 1;
