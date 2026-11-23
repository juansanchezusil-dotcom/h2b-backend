-- CV de la Ruta B (la secundaria). El de la Ruta A sigue en las columnas de siempre (base_cv_text, cv_en, cv_draft...).
-- Guarda: { target_role, base_cv_text, skills, cv_en, cv_draft, cover_letter_en, route, updated_at }
alter table public.profiles add column if not exists cv_b jsonb;
