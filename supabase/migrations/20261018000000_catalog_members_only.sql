-- El catálogo (ofertas, empresas con historial y agencias) solo lo lee quien tiene un acceso activo.
-- Antes cualquiera con la clave pública, que va dentro de la página, podía descargarlo completo.
--
-- Qué hace:
--   1) has_active_access(): true si el correo de la sesión tiene un acceso activo y vigente en "accesos".
--      Es SECURITY DEFINER para no depender de las reglas de la tabla "accesos".
--   2) En jobs, sponsor_companies y sponsor_agencies: activa RLS, quita las reglas de lectura que hubiera
--      (cualquiera que fuera su nombre) y deja una sola: leer solo con acceso activo.
-- El servidor (llave de servicio) no se ve afectado: ese acceso no pasa por RLS.
--
-- Para deshacerlo, por tabla:
--   create policy "lectura publica" on public.jobs for select using (true);

create or replace function public.has_active_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.accesos a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.activo
      and (a.vence_el is null or a.vence_el > now())
  );
$$;

revoke all on function public.has_active_access() from public, anon;
grant execute on function public.has_active_access() to authenticated;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['jobs', 'sponsor_companies', 'sponsor_agencies'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t and cmd in ('SELECT', 'ALL')
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy "miembros ven el catalogo" on public.%I for select to authenticated using (public.has_active_access())',
      t
    );
  end loop;
end
$$;
