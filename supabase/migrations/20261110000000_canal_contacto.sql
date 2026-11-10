-- Canal por el que Juan contactó a cada miembro (skool es el recomendado: es la comunidad donde ya están).
alter table public.accesos add column if not exists canal_contacto text;
alter table public.accesos drop constraint if exists accesos_canal_contacto_check;
alter table public.accesos add constraint accesos_canal_contacto_check
  check (canal_contacto is null or canal_contacto in ('skool', 'correo', 'telefono', 'otro'));
