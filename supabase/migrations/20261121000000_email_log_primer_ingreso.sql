-- Correo a quien nunca ha entrado a la app (3 días después del alta): se agrega el tipo 'primer_ingreso'.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('renewal_7', 'renewal_3', 'renewal_after', 'reengage', 'reto_30', 'ofertas', 'primer_ingreso'));
