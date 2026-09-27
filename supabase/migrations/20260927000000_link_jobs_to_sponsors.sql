-- Vincula cada oferta (jobs) con el historial de su empresa en USCIS (sponsor_companies).
-- Lo llena src/sponsors/linkJobs.ts después de cada scraper y de cada importación de USCIS.

alter table public.jobs
  add column if not exists sponsor_company_id bigint
    references public.sponsor_companies(id) on delete set null;

-- exacta / probable / otro_estado se muestran en la app; ambigua y sin_historial no
alter table public.jobs
  add column if not exists sponsor_match text
    check (sponsor_match in ('exacta', 'probable', 'ambigua', 'otro_estado', 'sin_historial'));

create index if not exists jobs_sponsor_company_id_idx on public.jobs (sponsor_company_id);
