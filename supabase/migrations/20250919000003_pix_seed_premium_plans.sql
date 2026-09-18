-- Migration: PIX-001.3 — Cadastro inicial dos planos VIP (dados, não schema)
--
-- Objetivo: garantir que os planos existam, inicialmente INATIVOS, para configuração segura antes da produção.
-- Sem plano em premium_plans, o POST /api/payments/orders retorna 404 e nada acontece.
--
-- SEGURANÇA: os preços abaixo são os DEMONSTRATIVOS já presentes em supabase/seed.sql
-- (vip_monthly = R$ 19,90 / vip_lifetime = R$ 99,00). Eles são EDITÁVEIS pelo painel
-- administrativo (/api/admin/plans) e devem ser substituídos pelos preços comerciais
-- reais antes de qualquer ativação em produção.
--
-- IDEMPOTENTE: ON CONFLICT (code) DO NOTHING — nunca sobrescreve preço já ajustado.

insert into public.premium_plans (code, name, description, duration_days, price_cents, currency, is_active)
values
  ('vip_monthly',
   'VIP Mensal',
   'Acesso premium por 30 dias. Configure o preço no painel administrativo antes de ativar.',
   30, 1990, 'BRL', false),
  ('vip_lifetime',
   'VIP Vitalício',
   'Acesso premium sem expiração. Configure o preço no painel administrativo antes de ativar.',
   null, 9900, 'BRL', false)
on conflict (code) do nothing;

do $$
declare
  n_total int;
  n_ativos int;
begin
  select count(*) into n_total from public.premium_plans;
  select count(*) into n_ativos from public.premium_plans where is_active;

  raise notice 'PIX-001.3: premium_plans total=% ativos=%', n_total, n_ativos;
  raise notice 'PIX-001.3: planos criados INATIVOS; configurar precos e ativar somente antes da producao';
end $$;
