-- Migration: ALFA-014.1 — Infraestrutura payment_events (auditoria Pix)

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.premium_orders(id) on delete set null,
  payment_id uuid references public.premium_payments(id) on delete set null,
  provider text,
  event_type text,
  event_id text,
  payload_hash text,
  payload_json jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','failed','ignored')),
  error_message text
);

comment on table public.payment_events is 'Eventos de pagamento Pix — auditoria idempotente, payload_json mascarado';
comment on column public.payment_events.event_id is 'ID do evento no provedor para idempotência';
comment on column public.payment_events.payload_hash is 'Hash do payload para replay protection';
comment on column public.payment_events.payload_json is 'Payload mascarado, nunca retornar por padrão ao frontend';

-- Índices
create unique index if not exists uniq_payment_events_event_id on public.payment_events (event_id) where event_id is not null;
create index if not exists idx_payment_events_payload_hash on public.payment_events (payload_hash) where payload_hash is not null;
create index if not exists idx_payment_events_order_id on public.payment_events (order_id) where order_id is not null;
create index if not exists idx_payment_events_payment_id on public.payment_events (payment_id) where payment_id is not null;
create index if not exists idx_payment_events_provider on public.payment_events (provider) where provider is not null;

-- RLS — somente backend/admin, nenhum acesso para authenticated por padrão
alter table public.payment_events enable row level security;

drop policy if exists "payment_events_select_own" on public.payment_events;
-- Criar política que permite apenas service_role (bypass) — não criar para authenticated
-- Para admin via service_role, bypass RLS. Para authenticated, sem acesso (payload_json nunca deve ser retornado por padrão)
-- Não criar policy para authenticated — acesso somente via service_role em GET /api/admin/payment-events

notify pgrst, 'reload schema';
