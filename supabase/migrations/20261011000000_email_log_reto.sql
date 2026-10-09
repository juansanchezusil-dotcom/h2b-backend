-- Correo del Reto de 30 días: se agrega el tipo 'reto_30' a los correos que se registran.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('renewal_7', 'renewal_3', 'renewal_after', 'reengage', 'reto_30'));
