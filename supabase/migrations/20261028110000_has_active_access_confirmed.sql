-- La membresía se busca por correo: exigir que ese correo esté confirmado. Sin esto, si el registro con
-- correo y contraseña estuviera activo, alguien podría crear una cuenta con el correo de un miembro y usar su acceso.
-- (Con Google el correo siempre viene confirmado, así que a los usuarios de hoy no les cambia nada.)
-- Misma regla que userHasActiveAccess en el backend.

create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.accesos a
    join auth.users u on u.id = auth.uid()
    where u.email_confirmed_at is not null
      and a.email = lower(coalesce(u.email, ''))
      and a.activo
      and (a.vence_el is null or a.vence_el > now())
  );
$$;
