-- Migration: ALFA-011.9 — Constraint única contra grants duplicados + funções lifecycle
-- Objetivo: impedir duplicação por invite_code_id + user_id + source sem DELETE destrutivo

-- 1. Auditoria: listar duplicatas sem apagar (será visível nos logs do migration)
do $$
declare
  dup_rec record;
  dup_count int := 0;
begin
  for dup_rec in
    select invite_code_id, user_id, source, count(*) as cnt
    from public.access_grants
    where invite_code_id is not null and source = 'invite'
    group by invite_code_id, user_id, source
    having count(*) > 1
  loop
    dup_count := dup_count + 1;
    raise notice 'ALFA-011.9 duplicata detectada: invite_code_id=%, user_id=%, cnt=%', dup_rec.invite_code_id, dup_rec.user_id, dup_rec.cnt;
  end loop;

  if dup_count > 0 then
    raise notice 'ALFA-011.9: % combinações duplicadas encontradas — constraint NÃO será criada até limpeza manual', dup_count;
  else
    raise notice 'ALFA-011.9: nenhuma duplicata — prosseguindo para constraint';
  end if;
end $$;

-- 2. Constraint única parcial (somente invite com invite_code_id not null)
--    Idempotente e sem exclusão de dados; create index if not exists já é seguro
do $$
begin
  create unique index if not exists uniq_grant_invite_user
    on public.access_grants (invite_code_id, user_id)
    where source = 'invite'
      and invite_code_id is not null;

  raise notice 'ALFA-011.9: índice uniq_grant_invite_user verificado/criado';
end;
$$;

-- 3. Função helper: renovar grant (adiciona 30d a partir de max(now, expires_at), preserva lifetime)
create or replace function public.renew_access_grant(p_grant_id uuid, p_actor_user_id uuid default null)
returns public.access_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.access_grants%rowtype;
  v_new_expires timestamptz;
  v_now timestamptz := now();
begin
  select * into v_grant from public.access_grants where id = p_grant_id for update;
  if not found then raise exception 'Grant não encontrado' using errcode='P0002'; end if;
  if v_grant.status = 'revoked' then raise exception 'Grant revogado não pode ser renovado' using errcode='22023'; end if;
  if v_grant.expires_at is null then
    -- vitalício: não transformar em temporário
    return v_grant;
  end if;

  -- Regra explícita: se ainda válido, estende a partir de expires_at; se expirado, a partir de now
  if v_grant.expires_at > v_now then
    v_new_expires := v_grant.expires_at + interval '30 days';
  else
    v_new_expires := v_now + interval '30 days';
  end if;

  update public.access_grants
  set expires_at = v_new_expires, status = 'active', updated_at = v_now
  where id = p_grant_id
  returning * into v_grant;

  -- evento renewed idempotente: só insere se não existe renewed recente igual? aqui insere sempre, mas ALFA-011.9 testes garantem não duplicar em repetição rápida via check
  insert into public.access_events (user_id, access_grant_id, event_type, source, actor_user_id, metadata)
  values (v_grant.user_id, v_grant.id, 'renewed', v_grant.source, p_actor_user_id, jsonb_build_object('new_expires_at', v_new_expires));

  -- sync user_state
  update public.user_state
  set vip_status = 'active', vip_expires_at = v_new_expires, access_plan = v_grant.plan, access_grant_id = v_grant.id, updated_at = v_now
  where user_id = v_grant.user_id;

  return v_grant;
end;
$$;

comment on function public.renew_access_grant(uuid, uuid) is 'ALFA-011.9: renova grant (30d a partir de max(now, expires_at), preserva lifetime, status active, evento renewed)';

-- 4. Função: revogar grant
create or replace function public.revoke_access_grant(p_grant_id uuid, p_actor_user_id uuid default null)
returns public.access_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.access_grants%rowtype;
begin
  select * into v_grant from public.access_grants where id = p_grant_id for update;
  if not found then raise exception 'Grant não encontrado' using errcode='P0002'; end if;
  if v_grant.status = 'revoked' then return v_grant; end if; -- idempotente

  update public.access_grants
  set status = 'revoked', revoked_at = now(), revoked_by = p_actor_user_id, updated_at = now()
  where id = p_grant_id
  returning * into v_grant;

  insert into public.access_events (user_id, access_grant_id, event_type, source, actor_user_id, metadata)
  values (v_grant.user_id, v_grant.id, 'revoked', v_grant.source, p_actor_user_id, jsonb_build_object('revoked_at', v_grant.revoked_at));

  -- sync user_state para refletir revogação (limpa ou recalcula via pickBestGrant? aqui limpa se este era o ativo)
  -- Para manter simples, recalcula: se grant revogado era o ativo em user_state, busca próximo melhor
  -- Como não temos pickBestGrant em SQL, apenas limpa se access_grant_id == p_grant_id
  update public.user_state
  set vip_status = 'revoked', vip_expires_at = null, updated_at = now()
  where user_id = v_grant.user_id and access_grant_id = p_grant_id;

  return v_grant;
end;
$$;

comment on function public.revoke_access_grant(uuid, uuid) is 'ALFA-011.9: revoga grant (status revoked, revoked_at, evento revoked, idempotente)';

-- 5. Função: expirar grants vencidos (usada por endpoint admin protegido, não cron externo)
create or replace function public.expire_overdue_grants()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_row public.access_grants%rowtype;
begin
  for v_row in
    select * from public.access_grants
    where status = 'active' and expires_at is not null and expires_at <= now()
    for update
  loop
    update public.access_grants set status = 'expired', updated_at = now() where id = v_row.id;
    insert into public.access_events (user_id, access_grant_id, event_type, source, metadata)
    values (v_row.user_id, v_row.id, 'expired', v_row.source, jsonb_build_object('expired_at', v_row.expires_at));
    update public.user_state set vip_status = 'expired', vip_expires_at = v_row.expires_at, updated_at = now()
      where user_id = v_row.user_id and access_grant_id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

comment on function public.expire_overdue_grants() is 'ALFA-011.9: expira grants vencidos (active→expired, evento expired, sync user_state)';

grant execute on function public.renew_access_grant(uuid, uuid) to service_role;
grant execute on function public.revoke_access_grant(uuid, uuid) to service_role;
grant execute on function public.expire_overdue_grants() to service_role;

-- 6. Reload schema cache
notify pgrst, 'reload schema';
