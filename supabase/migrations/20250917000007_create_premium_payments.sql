-- Migration: ALFA-014.1 — Infraestrutura premium_payments (sem gateway real)

create table if not exists public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.premium_orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  pix_txid text,
  status text not null check (status in ('created','pending','confirmed','failed','refunded','chargeback')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  payload_hash text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.premium_payments is 'Pagamentos Pix — confirmação financeira, não concede VIP diretamente';
comment on column public.premium_payments.order_id is 'FK premium_orders.id';
comment on column public.premium_payments.pix_txid is 'ID Pix para idempotência';
comment on column public.premium_payments.payload_hash is 'Hash para idempotência e replay protection';

-- Índices
create index if not exists idx_premium_payments_order_id on public.premium_payments (order_id);
create unique index if not exists uniq_premium_payments_pix_txid on public.premium_payments (pix_txid) where pix_txid is not null;
create index if not exists idx_premium_payments_provider_payment_id on public.premium_payments (provider_payment_id) where provider_payment_id is not null;
create index if not exists idx_premium_payments_payload_hash on public.premium_payments (payload_hash) where payload_hash is not null;
create index if not exists idx_premium_payments_status on public.premium_payments (status);

-- Trigger updated_at
create or replace function public.update_premium_payments_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_premium_payments_updated_at on public.premium_payments;
create trigger trg_premium_payments_updated_at before update on public.premium_payments
  for each row execute function public.update_premium_payments_updated_at();

-- RLS
alter table public.premium_payments enable row level security;

-- Leitura: usuário só vê pagamentos de seus próprios pedidos (via join implícito por EXISTS)
drop policy if exists "premium_payments_select_own" on public.premium_payments;
create policy "premium_payments_select_own" on public.premium_payments
  for select to authenticated using (
    exists (
      select 1 from public.premium_orders po
      where po.id = premium_payments.order_id and po.user_id = auth.uid()
    )
  );

-- Sem insert/update/delete para authenticated — somente service_role
notify pgrst, 'reload schema';
