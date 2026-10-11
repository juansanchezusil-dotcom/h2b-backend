-- Cuándo la persona envió su primer y su segundo seguimiento (los marca ella al enviarlos).
-- El cierre a los 21 días sin respuesta ya lo hace el proceso diario solo.
alter table public.applications add column if not exists followup1_sent_at timestamptz;
alter table public.applications add column if not exists followup2_sent_at timestamptz;
