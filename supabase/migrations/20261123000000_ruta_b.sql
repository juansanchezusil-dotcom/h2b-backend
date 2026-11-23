-- Ruta B del Mapa H2B Personal: el puesto secundario de la persona (opcional).
-- La Ruta A sigue siendo experiencia_industria (la de mayor experiencia). Máximo 2 rutas.
alter table public.profiles add column if not exists experiencia_industria_b text;
