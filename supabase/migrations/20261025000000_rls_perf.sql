-- Rendimiento de RLS (avisos del linter de Supabase): auth.uid()/auth.jwt() envueltos en (select ...)
-- para que se evalúen una vez por consulta y no por fila, una sola política SELECT en accesos
-- e índice en la clave foránea applications.user_id. Mismo acceso que antes.

drop policy if exists "Usuarios pueden consultar su propio acceso" on public.accesos;
drop policy if exists "leer propio acceso" on public.accesos;
create policy "leer propio acceso" on public.accesos
  for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "ver mis eventos" on public.application_events;
create policy "ver mis eventos" on public.application_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ver mis postulaciones" on public.applications;
create policy "ver mis postulaciones" on public.applications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "crear mis postulaciones" on public.applications;
create policy "crear mis postulaciones" on public.applications
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "editar mis postulaciones" on public.applications;
create policy "editar mis postulaciones" on public.applications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "borrar mis postulaciones" on public.applications;
create policy "borrar mis postulaciones" on public.applications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ver mi perfil" on public.profiles;
create policy "ver mi perfil" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "crear mi perfil" on public.profiles;
create policy "crear mi perfil" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create index if not exists applications_user_id_idx on public.applications (user_id);
