-- Avisos de ofertas nuevas del puesto de cada miembro: se agrega el tipo 'ofertas' al registro de correos.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('renewal_7', 'renewal_3', 'renewal_after', 'reengage', 'reto_30', 'ofertas'));
