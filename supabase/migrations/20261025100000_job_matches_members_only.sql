-- get_job_matches es SECURITY DEFINER: se saltaba el RLS de solo miembros del catálogo y un miembro vencido
-- podía leer todas las ofertas por /api/jobs/matches. Ahora no devuelve nada sin acceso activo.
-- Mismo cálculo de antes; solo se agrega la comprobación al inicio. Los permisos de EXECUTE no cambian.

create or replace function public.get_job_matches()
returns table(job_id bigint, title text, employer_name text, location text, wage text, case_number text, match_score integer, match_breakdown jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_english text;
  v_years int;
  v_has_h2b boolean;
  v_industry text;
begin
  if not public.has_active_access() then
    return;
  end if;

  select nivel_ingles, anos_experiencia, has_previous_h2b, lower(coalesce(experiencia_industria, ''))
  into v_english, v_years, v_has_h2b, v_industry
  from profiles
  where id = auth.uid();

  return query
  select
    j.id,
    j.title,
    j.employer_name,
    j.location,
    j.wage,
    j.case_number,
    (
      case
        -- ¿Es un puesto de cara al cliente? (el inglés pesa más ahí)
        when j.title ilike '%front desk%' or j.title ilike '%server%'
          or j.title ilike '%bartender%' or j.title ilike '%host%'
          or j.title ilike '%guest services%' or j.title ilike '%receptionist%'
        then
          -- Experiencia (máx 35): completa si la industria coincide, parcial si no
          (case
            when (v_industry like '%cocina%' and lower(j.title) ~* '(cook|kitchen|chef|food|restaurant)')
              or (v_industry like '%limpieza%' and lower(j.title) ~* '(housekeep|clean|maid|janitor|hotel)')
              or (v_industry like '%constru%' and lower(j.title) ~* '(labor|concrete|construct|build)')
              or (v_industry like '%jardin%' and lower(j.title) ~* '(landscape|ground|lawn|garden)')
              or (v_industry like '%mantenimiento%' and lower(j.title) ~* '(maintenance|general|handyman|repair)')
            then least(35, coalesce(v_years, 0) * 7 + 10)
            when coalesce(v_years, 0) > 0 then 15
            else 5
          end)
          + (case v_english when 'Avanzado' then 30 when 'Intermedio' then 18 else 5 end)
          + (case when v_has_h2b then 20 else 8 end)
          + 15
        else
          -- Resto de puestos: la experiencia manda, el inglés pesa poco
          (case
            when (v_industry like '%cocina%' and lower(j.title) ~* '(cook|kitchen|chef|food|restaurant)')
              or (v_industry like '%limpieza%' and lower(j.title) ~* '(housekeep|clean|maid|janitor|hotel)')
              or (v_industry like '%constru%' and lower(j.title) ~* '(labor|concrete|construct|build)')
              or (v_industry like '%jardin%' and lower(j.title) ~* '(landscape|ground|lawn|garden)')
              or (v_industry like '%mantenimiento%' and lower(j.title) ~* '(maintenance|general|handyman|repair)')
            then least(50, coalesce(v_years, 0) * 10 + 10)
            when coalesce(v_years, 0) > 0 then 20
            else 8
          end)
          + (case v_english when 'Avanzado' then 10 when 'Intermedio' then 6 else 3 end)
          + (case when v_has_h2b then 20 else 8 end)
          + 20
      end
    )::int as match_score,
    jsonb_build_object(
      'anos_experiencia', v_years,
      'nivel_ingles', v_english,
      'has_previous_h2b', v_has_h2b,
      'industria_perfil', v_industry,
      'industria_coincide', (
        (v_industry like '%cocina%' and lower(j.title) ~* '(cook|kitchen|chef|food|restaurant)')
        or (v_industry like '%limpieza%' and lower(j.title) ~* '(housekeep|clean|maid|janitor|hotel)')
        or (v_industry like '%constru%' and lower(j.title) ~* '(labor|concrete|construct|build)')
        or (v_industry like '%jardin%' and lower(j.title) ~* '(landscape|ground|lawn|garden)')
        or (v_industry like '%mantenimiento%' and lower(j.title) ~* '(maintenance|general|handyman|repair)')
      ),
      'es_cara_al_cliente', (
        j.title ilike '%front desk%' or j.title ilike '%server%'
        or j.title ilike '%bartender%' or j.title ilike '%host%'
        or j.title ilike '%guest services%' or j.title ilike '%receptionist%'
      )
    ) as match_breakdown
  from jobs j
  order by match_score desc, j.created_at desc;
end;
$function$;
