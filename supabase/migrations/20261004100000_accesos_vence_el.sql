-- Membresía con vencimiento: el acceso se corta solo cuando pasa vence_el.
-- null = sin vencimiento (los accesos que ya existen siguen funcionando igual).
alter table public.accesos
  add column if not exists vence_el timestamptz;
