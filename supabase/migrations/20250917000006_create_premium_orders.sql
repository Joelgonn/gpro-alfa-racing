-- Migration: ALFA-014.1 — Infraestrutura premium_orders (sem pagamento real)
-- Objetivo: pedidos de planos premium, sem cobrança Pix, sem grant VIP automático

-- 1. Tabela premium_orders
create table if not exists public.premium_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.premium_plans(id) on delete restrict,
  status text not null check (status in ('draft','pending','awaiting_payment','paid','cancelled','expired','failed','refunded','chargeback')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  pix_txid text,
  payload_hash text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.premium_orders is 'Pedidos de planos premium — intenção de compra, não concede VIP';
comment on column public.premium_orders.plan_id is 'FK premium_plans.id — preço capturado de premium_plans.price_cents no backend';
comment on column public.premium_orders.amount_cents is 'Valor em centavos capturado do plano, nunca do frontend';
comment on column public.premium_orders.pix_txid is 'ID Pix para idempotência (quando gerado)';
comment on column public.premium_orders.payload_hash is 'Hash do payload para idempotência';

-- Índices
create unique index if not exists uniq_premium_orders_pix_txid on public.premium_orders (pix_txid) where pix_txid is not null;
create index if not exists idx_premium_orders_payload_hash on public.premium_orders (payload_hash) where payload_hash is not null;
create index if not exists idx_premium_orders_user_id on public.premium_orders (user_id);
create index if not exists idx_premium_orders_plan_id on public.premium_orders (plan_id);
create index if not exists idx_premium_orders_status on public.premium_orders (status);

-- Trigger updated_at
create or replace function public.update_premium_orders_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_premium_orders_updated_at on public.premium_orders;
create trigger trg_premium_orders_updated_at before update on public.premium_orders
  for each row execute function public.update_premium_orders_updated_at();

-- RLS
alter table public.premium_orders enable row level security;

-- Leitura: usuário só vê próprios pedidos
drop policy if exists "premium_orders_select_own" on public.premium_orders;
create policy "premium_orders_select_own" on public.premium_orders
  for select to authenticated using (auth.uid() = user_id);

-- Sem insert/update/delete para authenticated — somente service_role (bypass) pode escrever
-- service_role bypassa RLS por padrão

-- Reload
notify pgrst, 'reload schema';
