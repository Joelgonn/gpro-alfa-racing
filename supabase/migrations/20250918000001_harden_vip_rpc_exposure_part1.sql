-- Migration: ALFA-011.10 (PARTE 1) — Endurecimento da exposição das RPCs VIP
--
-- Objetivo:
--   (a) fechar a enumeração de convites (policy de SELECT ampla em invite_codes);
--   (b) revogar EXECUTE de public/anon/authenticated das 5 RPCs VIP;
--   (c) remover as 2 funções comprovadamente sem consumidor.
--
-- Escopo desta migration — NÃO faz:
--   * NÃO remove renew_access_grant, revoke_access_grant, update_user_profile;
--   * NÃO usa CASCADE;
--   * NÃO remove tabelas, colunas ou dados;
--   * NÃO corrige a coluna tyre_suppliers;
--   * NÃO altera migrations antigas (as definições originais permanecem em
--     20250917000002/000003/000004 como registro histórico e como rollback);
--   * NÃO emite NOTIFY nesta etapa.
--
-- Evidência de segurança para as remoções:
--   * consume_invite_code(text) — 0 chamadas em app/**; o fluxo vigente de convite é
--     TypeScript/server-side em app/actions/signup.ts (UPDATE condicional atômico).
--   * expire_overdue_grants() — 0 chamadas; o wrapper expireOverdueGrants()
--     (app/lib/access/accessService.ts) não possui consumidor e possui fallback JS puro.
--
-- Preservação explícita: o EXECUTE de service_role nas 3 funções mantidas é reafirmado
-- ao final, limitado exclusivamente a elas.

-- ============================================================
-- 1. Fechar a enumeração de convites
--    A policy permitia SELECT de TODA a tabela a qualquer usuário autenticado
--    (using (auth.role() = 'authenticated'), sem filtro por linha).
--    Nenhum caminho do aplicativo lê invite_codes via cliente: os 12 acessos ao
--    longo do código são server-side (supabaseAdmin / service_role), que bypassa RLS.
-- ============================================================
drop policy if exists "invite_select_auth" on public.invite_codes;
-- RAISE NOTICE só existe em PL/pgSQL: precisa estar dentro de um bloco DO
do $$ begin raise notice 'ALFA-011.10: policy invite_select_auth removida de public.invite_codes'; end $$;

-- ============================================================
-- 2. Revogar EXECUTE de public, anon e authenticated nas 5 RPCs
--    Dirigido por catálogo (pg_proc) para acertar qualquer assinatura real e para
--    ser idempotente: se a função não existir, nada acontece e nenhum erro é lançado.
--    O grant a service_role NÃO é mencionado aqui — portanto é preservado.
--    Aviso por função efetivamente encontrada/revogada (observabilidade).
-- ============================================================
do $$
declare
  r      record;
  alvos  text[] := array[
    'consume_invite_code',
    'expire_overdue_grants',
    'renew_access_grant',
    'revoke_access_grant',
    'update_user_profile'
  ];
  nome   text;
  achou  boolean;
begin
  foreach nome in array alvos loop
    achou := false;
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = nome
    loop
      achou := true;
      execute format('revoke execute on function %s from public', r.sig);
      execute format('revoke execute on function %s from anon', r.sig);
      execute format('revoke execute on function %s from authenticated', r.sig);
      raise notice 'ALFA-011.10: revoke execute em %.% de public/anon/authenticated', 'public', r.sig;
    end loop;

    if not achou then
      raise notice 'ALFA-011.10: funcao public.% nao encontrada em pg_proc (nada a revogar)', nome;
    end if;
  end loop;
end $$;

-- ============================================================
-- 3. Remover SOMENTE as 2 funções sem consumidor
--    Assinaturas completas. Sem CASCADE (nenhuma dependência conhecida:
--    0 triggers, 0 views, 0 rotas, 0 scripts, 0 ações de servidor).
-- ============================================================
drop function if exists public.consume_invite_code(text);
do $$ begin raise notice 'ALFA-011.10: funcao public.consume_invite_code(text) removida (se existia)'; end $$;

drop function if exists public.expire_overdue_grants();
do $$ begin raise notice 'ALFA-011.10: funcao public.expire_overdue_grants() removida (se existia)'; end $$;

-- ============================================================
-- 4. Preservação explícita do acesso de service_role
--    Limitado EXCLUSIVAMENTE às 3 funções MANTIDAS nesta migration
--    (renew_access_grant, revoke_access_grant, update_user_profile).
--    Idempotente e seguro: usa as assinaturas exatas declaradas no repositório.
--    Nenhuma outra função recebe GRANT aqui.
-- ============================================================
grant execute on function public.renew_access_grant(uuid, uuid) to service_role;
grant execute on function public.revoke_access_grant(uuid, uuid) to service_role;
grant execute on function public.update_user_profile(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, double precision, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, jsonb, jsonb) to service_role;
do $$ begin raise notice 'ALFA-011.10: execute de service_role reafirmado nas 3 funcoes mantidas'; end $$;

-- ============================================================
-- FIM — Parte 1
-- Pendências fora desta migration (exigem autorização própria):
--   * Parte 2: migrar renewGrant/revokeGrant/expireOverdueGrants para TypeScript puro
--     antes de qualquer DROP de renew_access_grant / revoke_access_grant;
--   * tyre_suppliers: corrigir a coluna ou a referencia dentro de update_user_profile;
--   * confirmar no remoto que não existe outra policy de SELECT em invite_codes
--     criada fora do controle de migrations.
-- ============================================================
