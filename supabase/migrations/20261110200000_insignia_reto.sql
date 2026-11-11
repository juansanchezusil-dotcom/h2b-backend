-- Marca de que Juan ya entregó la insignia del Reto de 30 días en Skool (solo la ve el administrador).
alter table public.accesos add column if not exists insignia_el timestamptz;
