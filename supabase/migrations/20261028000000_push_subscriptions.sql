-- Notificaciones push de la app instalable (PWA).
-- Cada celular o navegador que la persona autoriza es una suscripción (endpoint + llaves de cifrado).
-- Solo el servidor (llave de servicio) lee y escribe: la app llama a /api/push con su sesión.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Registro de avisos enviados, para no repetir el mismo aviso (por día o por semana) aunque el cron corra dos veces.
-- Va aparte de email_log: un push no debe frenar los correos del día.
create table if not exists public.push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, dedupe_key)
);

alter table public.push_log enable row level security;
