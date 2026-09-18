-- Migration: PIX-001.2 — Unicidade de concessão de VIP por PAGAMENTO
--
-- Objetivo: impedir duplicidade de access_grants quando o acesso vem de pagamento
-- (source='payment'). Hoje só existe proteção equivalente para convite
-- (uniq_grant_invite_user, criado na 20250917000004).
--
-- Estratégia: índice único PARCIAL sobre (metadata->>'order_id') quando source='payment'.
-- A chave natural é o PEDIDO: um pagamento confirmado por pedido == um grant.
-- Pagamentos repetidos do mesmo pedido reutilizam o mesmo grant (idempotência).
--
-- ADITIVA E DEFENSIVA:
--   - respeita o mesmo padrão da 000004: audita duplicatas ANTES de criar o índice;
--   - se houver duplicatas, interrompe a migration com EXCEPTION e exige limpeza manual;
--   - não altera RLS, policies, nem CHECKs; não remove dados.
--
-- Nada aqui concede acesso. O grant continua sendo criado apenas pelo servidor.

do $$
declare
  dup_count int := 0;
  dup_rec record;
begin
  -- 1. Auditoria: existem grants de pagamento duplicados para o mesmo pedido?
  for dup_rec in
    select metadata->>'order_id' as order_id, count(*) as cnt
    from public.access_grants
    where source = 'payment'
      and metadata ? 'order_id'
      and coalesce(metadata->>'order_id', '') <> ''
    group by metadata->>'order_id'
    having count(*) > 1
  loop
    dup_count := dup_count + 1;
    raise notice 'PIX-001.2 duplicata detectada: order_id=% cnt=%', dup_rec.order_id, dup_rec.cnt;
  end loop;

  if dup_count > 0 then
    raise exception 'PIX-001.2: % pedido(s) com grant duplicado em access_grants; limpeza manual necessária', dup_count using errcode = '23505';
  else
    raise notice 'PIX-001.2: nenhuma duplicata — prosseguindo para o indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.access_grants
    where source = 'payment'
      and metadata ? 'order_id'
      and coalesce(metadata->>'order_id', '') <> ''
    group by metadata->>'order_id'
    having count(*) > 1
  ) then
    create unique index if not exists uniq_grant_payment_order
      on public.access_grants ((metadata->>'order_id'))
      where source = 'payment'
        and metadata ? 'order_id'
        and coalesce(metadata->>'order_id', '') <> '';

    raise notice 'PIX-001.2: indice uniq_grant_payment_order verificado/criado';
  else
    raise notice 'PIX-001.2: indice NAO criado (duplicatas presentes)';
  end if;
end $$;

-- Verificação de sanidade
do $$
declare
  existe boolean;
begin
  select exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uniq_grant_payment_order'
  ) into existe;

  raise notice 'PIX-001.2: uniq_grant_payment_order presente = %', existe;
end $$;
