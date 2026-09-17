-- Migration: ALFA-014.0 — Infraestrutura premium_plans (somente plano comercial, sem pagamento)
-- Objetivo: definir contrato definitivo de planos, sem criar orders/payments, sem ativar VIP
-- Idempotente, sem modificar access_grants/user_state/Auth

-- 1. Tabela premium_plans
create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  duration_days integer check (duration_days is null or duration_days > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicidade estável em code (ex: vip_monthly, vip_lifetime)
create unique index if not exists uniq_premium_plans_code on public.premium_plans (code);

comment on table public.premium_plans is 'Planos comerciais VIP — define produto, não concede acesso (grant separado)';
comment on column public.premium_plans.code is 'Identificador estável: vip_monthly, vip_lifetime';
comment on column public.premium_plans.duration_days is 'Duração em dias; NULL = vitalício (não usar 0)';
comment on column public.premium_plans.price_cents is 'Preço em centavos, nunca float; ex: 1990 = R$19,90';
comment on column public.premium_plans.currency is 'Moeda explícita, BRL';
comment on column public.premium_plans.is_active is 'Plano ativo não concede acesso automaticamente';

-- 2. Trigger updated_at
create or replace function public.update_premium_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_premium_plans_updated_at on public.premium_plans;
create trigger trg_premium_plans_updated_at
  before update on public.premium_plans
  for each row execute function public.update_premium_plans_updated_at();

-- 3. RLS
alter table public.premium_plans enable row level security;

-- Leitura: usuários autenticados podem consultar somente planos ativos (is_active=true)
drop policy if exists "premium_plans_select_active" on public.premium_plans;
create policy "premium_plans_select_active" on public.premium_plans
  for select
  to authenticated
  using (is_active = true);

-- Leitura pública opcional para landing (anon pode ver ativos? manter restrito a authenticated conforme modelo existente de gpro_sponsors)
-- Não criar políticas de insert/update/delete para authenticated/anon — somente service_role (bypass) pode administrar

-- 4. Reload schema cache
notify pgrst, 'reload schema';
