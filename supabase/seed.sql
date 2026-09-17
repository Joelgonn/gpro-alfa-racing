-- Seed local premium_plans — ALFA-013.1
-- Idempotente, seguro para reexecução, somente local, sem pagamentos reais
-- Não aplicar em produção até tabela premium_plans existir (pendência infraestrutura)

DO $$
BEGIN
  -- Verifica se tabela premium_plans existe (caso não exista, apenas notifica e não falha)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='premium_plans') THEN
    -- Plano mensal — 30 dias, preço demonstrativo R$ 19,90
    INSERT INTO public.premium_plans (code, name, description, duration_days, price_cents, currency, is_active)
    VALUES ('vip_monthly', 'VIP Mensal', 'Acesso Full Premium por 30 dias — plano demonstrativo', 30, 1990, 'BRL', true)
    ON CONFLICT (code) DO NOTHING;

    -- Plano vitalício — sem expiração, preço demonstrativo R$ 99,00
    INSERT INTO public.premium_plans (code, name, description, duration_days, price_cents, currency, is_active)
    VALUES ('vip_lifetime', 'VIP Vitalício', 'Acesso Full Premium vitalício — plano demonstrativo', NULL, 9900, 'BRL', true)
    ON CONFLICT (code) DO NOTHING;

    RAISE NOTICE 'Seed premium_plans aplicado (vip_monthly, vip_lifetime)';
  ELSE
    RAISE NOTICE 'Tabela premium_plans não existe — seed ignorado (pendência infraestrutura ALFA-013.1)';
  END IF;
END
$$;
