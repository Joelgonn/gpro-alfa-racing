-- Migration: RLS hardening for ALFA-001.0
-- Objetivo: garantir que usuários só acessem seus próprios dados e que área admin exija papel admin
-- Não apaga dados, apenas adiciona políticas (aditiva)

-- 1. Habilita RLS nas tabelas principais
alter table public.user_state enable row level security;
alter table public.api_knowledge_base enable row level security;
alter table public.gpro_import_snapshots enable row level security;
alter table public.invite_codes enable row level security;

-- Tabelas auxiliares se existirem (idempotente)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='energy_observations') then
    execute 'alter table public.energy_observations enable row level security';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_planning') then
    execute 'alter table public.user_planning enable row level security';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='market_drivers') then
    execute 'alter table public.market_drivers enable row level security';
  end if;
end $$;

-- 2. Políticas user_state: usuário acessa apenas sua própria linha
drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own" on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own" on public.user_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own" on public.user_state
  for delete using (auth.uid() = user_id);

-- 3. Políticas api_knowledge_base: por usuário
drop policy if exists "kb_select_own" on public.api_knowledge_base;
create policy "kb_select_own" on public.api_knowledge_base
  for select using (auth.uid() = user_id);

drop policy if exists "kb_insert_own" on public.api_knowledge_base;
create policy "kb_insert_own" on public.api_knowledge_base
  for insert with check (auth.uid() = user_id);

drop policy if exists "kb_update_own" on public.api_knowledge_base;
create policy "kb_update_own" on public.api_knowledge_base
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "kb_delete_own" on public.api_knowledge_base;
create policy "kb_delete_own" on public.api_knowledge_base
  for delete using (auth.uid() = user_id);

-- 4. Políticas gpro_import_snapshots: apenas dono lê/insere
drop policy if exists "snapshots_select_own" on public.gpro_import_snapshots;
create policy "snapshots_select_own" on public.gpro_import_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "snapshots_insert_own" on public.gpro_import_snapshots;
create policy "snapshots_insert_own" on public.gpro_import_snapshots
  for insert with check (auth.uid() = user_id);

-- 5. Políticas invite_codes: apenas leitura para autenticados (verificação), escrita só service_role (bypass RLS)
-- Autenticados podem verificar se código existe, mas não podem inserir
drop policy if exists "invite_select_auth" on public.invite_codes;
create policy "invite_select_auth" on public.invite_codes
  for select using (auth.role() = 'authenticated');

-- Nenhuma política de insert/update/delete para anon/authenticated => apenas service_role (bypass) pode escrever
-- Isso garante que geração de convites só via service_role (admin.ts/signup.ts)

-- 6. Políticas energy_observations: por usuário (se existir)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='energy_observations') then
    execute 'drop policy if exists "energy_select_own" on public.energy_observations';
    execute 'create policy "energy_select_own" on public.energy_observations for select using (auth.uid() = user_id)';
    execute 'drop policy if exists "energy_insert_own" on public.energy_observations';
    execute 'create policy "energy_insert_own" on public.energy_observations for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists "energy_update_own" on public.energy_observations';
    execute 'create policy "energy_update_own" on public.energy_observations for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'drop policy if exists "energy_delete_own" on public.energy_observations';
    execute 'create policy "energy_delete_own" on public.energy_observations for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- 7. Políticas user_planning: por usuário
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_planning') then
    execute 'drop policy if exists "planning_select_own" on public.user_planning';
    execute 'create policy "planning_select_own" on public.user_planning for select using (auth.uid() = user_id)';
    execute 'drop policy if exists "planning_insert_own" on public.user_planning';
    execute 'create policy "planning_insert_own" on public.user_planning for insert with check (auth.uid() = user_id)';
    execute 'drop policy if exists "planning_update_own" on public.user_planning';
    execute 'create policy "planning_update_own" on public.user_planning for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'drop policy if exists "planning_delete_own" on public.user_planning';
    execute 'create policy "planning_delete_own" on public.user_planning for delete using (auth.uid() = user_id)';
  end if;
end $$;

-- 8. Políticas market_drivers: leitura pública, escrita apenas service_role
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='market_drivers') then
    execute 'drop policy if exists "market_select_all" on public.market_drivers';
    execute 'create policy "market_select_all" on public.market_drivers for select using (true)';
    -- sem políticas de insert/update/delete para authenticated => apenas service_role
  end if;
end $$;

-- Nota: service_role bypassa RLS por padrão, portanto as rotas que precisam escrever como gpro/sync e python continuam funcionando via supabaseAdmin.
-- Frontend nunca deve usar anon para escrever dados sensíveis; todas as escritas sensíveis devem passar por APIs que usam supabaseAdmin após validar auth.
