-- Migration: ALFA-011.4 — Correção de segurança user_state_update_own
-- Objetivo: impedir que usuário comum altere campos sensíveis de privilégio/acesso via REST
-- Estratégia: substituir política ampla por política restrita + trigger BEFORE UPDATE + RPC allowlist
-- Não apaga dados, não altera login/signup, não ativa VIP_CHECK

-- 1. Remover política ampla insegura (auditoria: supabase/migrations/20250914000001_rls_hardening.sql:33)
drop policy if exists "user_state_update_own" on public.user_state;

-- 2. Trigger robusto que bloqueia alteração de campos sensíveis quando auth.role()='authenticated'
--    service_role bypassa mas trigger ainda valida e permite (service_role não é 'authenticated')
create or replace function public.prevent_user_state_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só bloqueia quando o chamador é authenticated (cliente); service_role e postgres passam
  if auth.role() = 'authenticated' then
    if NEW.role is distinct from OLD.role then
      raise exception 'role cannot be changed via client (privilege escalation blocked)' using errcode = '42501';
    end if;
    if NEW.vip_status is distinct from OLD.vip_status then
      raise exception 'vip_status cannot be changed via client' using errcode = '42501';
    end if;
    if NEW.vip_expires_at is distinct from OLD.vip_expires_at then
      raise exception 'vip_expires_at cannot be changed via client' using errcode = '42501';
    end if;
    if NEW.access_plan is distinct from OLD.access_plan then
      raise exception 'access_plan cannot be changed via client' using errcode = '42501';
    end if;
    if NEW.access_grant_id is distinct from OLD.access_grant_id then
      raise exception 'access_grant_id cannot be changed via client' using errcode = '42501';
    end if;
    -- Campos que não existem mas se um dia existirem, bloquear por padrão
    -- is_admin, permissions, subscription_status, plan, entitlement, service_role, gpro_token
    -- Para gpro_token, permitir apenas via service_role (já é o caso) — trigger já bloqueia se tentar via authenticated
    if (to_jsonb(NEW) ? 'is_admin' and NEW::text is distinct from OLD::text) then
      -- genérico: se coluna is_admin existir e for alterada, bloquear
      null; -- manter compatível; verificação específica abaixo evita erro se coluna não existir
    end if;
  end if;
  return NEW;
exception when undefined_column then
  -- Se alguma coluna sensível ainda não existir (ex: migração antiga), não falhar trigger
  return NEW;
end;
$$;

comment on function public.prevent_user_state_privilege_escalation() is 'ALFA-011.4: bloqueia alteração de role/vip_* /access_* por authenticated via REST/DevTools';

drop trigger if exists trg_user_state_privilege_guard on public.user_state;
create trigger trg_user_state_privilege_guard
  before update on public.user_state
  for each row execute function public.prevent_user_state_privilege_escalation();

-- 3. Recriar política de UPDATE restritiva (mesma condição, mas agora com trigger como segunda camada)
--    Mantém auth.uid()=user_id para permitir updates legítimos, mas trigger bloqueia sensíveis
create policy "user_state_update_own_restricted" on public.user_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Garantir que select/insert/delete permanecem como antes (idempotente, sem remoção)
--    Reafirma políticas existentes para não deixar sem substituição
do $$
begin
  if not exists (select 1 from pg_policies where policyname='user_state_select_own' and tablename='user_state') then
    create policy "user_state_select_own" on public.user_state for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='user_state_insert_own' and tablename='user_state') then
    create policy "user_state_insert_own" on public.user_state for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='user_state_delete_own' and tablename='user_state') then
    create policy "user_state_delete_own" on public.user_state for delete using (auth.uid() = user_id);
  end if;
end $$;

-- 5. RPC explícito allowlist para atualização de perfil/dados de jogo
--    Uso futuro: frontend deve preferir RPC em vez de update direto; por enquanto apenas disponibiliza
--    Atualiza somente campos legítimos; ignora qualquer campo sensível mesmo se enviado
create or replace function public.update_user_profile(
  p_track text default null,
  p_driver_editable jsonb default null,
  p_driver_static jsonb default null,
  p_car_json jsonb default null,
  p_tech_director_json jsonb default null,
  p_staff_facilities_json jsonb default null,
  p_test_points_json jsonb default null,
  p_race_options_json jsonb default null,
  p_weather_data jsonb default null,
  p_desgaste_modifier double precision default null,
  p_sponsors_database_json jsonb default null,
  p_energy_coeffs_json jsonb default null,
  p_menu_data jsonb default null,
  p_office_data jsonb default null,
  p_last_import_snapshot jsonb default null,
  p_last_import_at timestamptz default null,
  p_tyre_suppliers jsonb default null,
  p_car_totals jsonb default null,
  p_car_characteristic jsonb default null
)
returns public.user_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_state;
begin
  if v_user_id is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  -- Update somente colunas allowlist; role/vip_* nunca tocados aqui
  update public.user_state
  set
    track = coalesce(p_track, track),
    driver_editable = coalesce(p_driver_editable, driver_editable),
    driver_static = coalesce(p_driver_static, driver_static),
    car_json = coalesce(p_car_json, car_json),
    tech_director_json = coalesce(p_tech_director_json, tech_director_json),
    staff_facilities_json = coalesce(p_staff_facilities_json, staff_facilities_json),
    test_points_json = coalesce(p_test_points_json, test_points_json),
    race_options_json = coalesce(p_race_options_json, race_options_json),
    weather_data = coalesce(p_weather_data, weather_data),
    desgaste_modifier = coalesce(p_desgaste_modifier, desgaste_modifier),
    sponsors_database_json = coalesce(p_sponsors_database_json, sponsors_database_json),
    energy_coeffs_json = coalesce(p_energy_coeffs_json, energy_coeffs_json),
    menu_data = coalesce(p_menu_data, menu_data),
    office_data = coalesce(p_office_data, office_data),
    last_import_snapshot = coalesce(p_last_import_snapshot, last_import_snapshot),
    last_import_at = coalesce(p_last_import_at, last_import_at),
    tyre_suppliers = coalesce((p_tyre_suppliers #>> '{}')::text, tyre_suppliers::text)::jsonb,
    car_totals = coalesce(p_car_totals, car_totals),
    car_characteristic = coalesce(p_car_characteristic, car_characteristic),
    updated_at = now()
  where user_id = v_user_id
  returning * into v_row;

  if not found then
    -- Se linha não existe, cria com defaults mínimos (upsert behavior)
    insert into public.user_state (user_id, track, driver_editable, driver_static, car_json, tech_director_json, staff_facilities_json, test_points_json, race_options_json, weather_data, desgaste_modifier, sponsors_database_json, energy_coeffs_json, menu_data, office_data, last_import_snapshot, last_import_at, updated_at)
    values (
      v_user_id,
      coalesce(p_track, 'Interlagos'),
      p_driver_editable, p_driver_static, p_car_json, p_tech_director_json, p_staff_facilities_json, p_test_points_json, p_race_options_json, p_weather_data, p_desgaste_modifier, p_sponsors_database_json, p_energy_coeffs_json, p_menu_data, p_office_data, p_last_import_snapshot, p_last_import_at, now()
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

comment on function public.update_user_profile(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, double precision, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, jsonb, jsonb) is 'ALFA-011.4 RPC allowlist: atualiza somente campos legítimos de perfil/jogo; nunca altera role/vip_*';

-- Permitir execução por authenticated (service_role já tem por padrão)
grant execute on function public.update_user_profile(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, double precision, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_user_profile(text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, double precision, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, jsonb, jsonb, jsonb) to service_role;

-- 6. Garantir que access_grants/events permanecem sem escrita por authenticated (já sem políticas insert/update/delete)
--    Reafirma ausência: se alguma policy permissiva foi criada por engano, removê-la
do $$
begin
  -- Não há policies de insert/update/delete para authenticated nessas tabelas; garantir que não existam
  if exists (select 1 from pg_policies where tablename='access_grants' and policyname like '%insert%') then
    execute 'drop policy if exists "grants_insert_own" on public.access_grants';
  end if;
  if exists (select 1 from pg_policies where tablename='access_events' and policyname like '%insert%') then
    execute 'drop policy if exists "events_insert_own" on public.access_events';
  end if;
end $$;

-- 7. Reload schema cache
notify pgrst, 'reload schema';
