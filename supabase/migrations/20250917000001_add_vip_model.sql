-- Migration: ALFA-011.1 — Modelagem VIP (Full Premium + Convites configuráveis)
-- Objetivo: base aditiva para convites VIP, concessão de acesso e histórico, sem ativar bloqueio
-- Regras: aditiva, idempotente, sem DROP TABLE/TRUNCATE, sem NOT NULL, sem quebrar registros atuais

-- 1. Colunas VIP em public.user_state (todas nullable, IF NOT EXISTS)
alter table public.user_state add column if not exists vip_status text;
alter table public.user_state add column if not exists vip_expires_at timestamptz;
alter table public.user_state add column if not exists access_plan text;
alter table public.user_state add column if not exists access_grant_id uuid;

-- Comentários (explicam propósito, não alteram comportamento)
comment on column public.user_state.vip_status is 'Estado resumido do acesso VIP: active | expired | lifetime | null';
comment on column public.user_state.vip_expires_at is 'Data de expiração do acesso VIP; NULL para acesso vitalício ou sem acesso';
comment on column public.user_state.access_plan is 'Plano concedido atualmente: full_premium | premium | null';
comment on column public.user_state.access_grant_id is 'Concessão (access_grants.id) atualmente associada ao usuário; NULL se sem concessão';

-- 2. Tabela public.access_grants (histórico oficial de concessões)
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null check (source in ('invite','manual','payment','admin')),
  invite_code_id uuid,
  plan text not null check (plan in ('premium','full_premium')),
  status text not null check (status in ('active','expired','revoked','pending')) default 'pending',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Comentários
comment on table public.access_grants is 'Concessões de acesso Full Premium; cada linha é um fato imutável (não editar período já concedido)';
comment on column public.access_grants.user_id is 'Referência ao usuário (auth.users.id); sem FK obrigatória para não quebrar se auth schema diferir';
comment on column public.access_grants.source is 'Origem da concessão: invite | manual | payment | admin';
comment on column public.access_grants.invite_code_id is 'Convite que originou a concessão; nullable; FK para invite_codes quando compatível';
comment on column public.access_grants.expires_at is 'Fim do acesso; NULL = vitalício';
comment on column public.access_grants.metadata is 'Dados auxiliares não sensíveis; nunca armazenar raw de pagamento aqui';

-- FK opcional para invite_codes.id (somente se invite_codes existir e tipo compatível; não falha se já existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='invite_codes')
     and not exists (select 1 from information_schema.table_constraints where constraint_name='access_grants_invite_code_id_fkey' and table_name='access_grants') then
    -- invite_codes.id é uuid (ver app/actions/signup.ts:30); FK com ON DELETE SET NULL para não apagar histórico
    begin
      alter table public.access_grants
        add constraint access_grants_invite_code_id_fkey
        foreign key (invite_code_id) references public.invite_codes(id) on delete set null;
    exception when others then
      -- Se tipo incompatível ou já existe, mantém sem FK e segue (registra decisão no relatório ALFA-011.1)
      null;
    end;
  end if;
end $$;

-- 3. Tabela public.access_events (trilha auditável)
create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  access_grant_id uuid,
  event_type text not null check (event_type in ('granted','renewed','revoked','expired','manually_adjusted')),
  source text,
  actor_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.access_events is 'Eventos de acesso (concessão, renovação, revogação, expiração); append-only';
comment on column public.access_events.event_type is 'granted | renewed | revoked | expired | manually_adjusted';
comment on column public.access_events.source is 'Origem do evento: invite | manual | payment | admin';
comment on column public.access_events.actor_user_id is 'Quem executou o evento (admin ou sistema)';

-- FK opcional access_events.access_grant_id -> access_grants.id (SET NULL para preservar histórico)
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name='access_events_access_grant_id_fkey' and table_name='access_events') then
    begin
      alter table public.access_events
        add constraint access_events_access_grant_id_fkey
        foreign key (access_grant_id) references public.access_grants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end $$;

-- 4. RLS — habilitar e criar políticas seguras (leitura própria, escrita só service_role)
alter table public.access_grants enable row level security;
alter table public.access_events enable row level security;

-- Grants: usuário lê apenas próprias concessões; sem insert/update/delete para authenticated => só service_role escreve
drop policy if exists "grants_select_own" on public.access_grants;
create policy "grants_select_own" on public.access_grants
  for select to authenticated using (auth.uid() = user_id);

-- Não criar políticas de insert/update/delete para authenticated => apenas service_role (bypass) pode escrever

-- Events: mesma regra
drop policy if exists "events_select_own" on public.access_events;
create policy "events_select_own" on public.access_events
  for select to authenticated using (auth.uid() = user_id);

-- 5. Índices (somente úteis, IF NOT EXISTS)
create index if not exists idx_access_grants_user_id on public.access_grants (user_id);
create index if not exists idx_access_grants_status on public.access_grants (status);
create index if not exists idx_access_grants_expires_at on public.access_grants (expires_at);
create index if not exists idx_access_grants_invite_code_id on public.access_grants (invite_code_id) where invite_code_id is not null;

create index if not exists idx_access_events_user_id on public.access_events (user_id);
create index if not exists idx_access_events_grant_id on public.access_events (access_grant_id) where access_grant_id is not null;
create index if not exists idx_access_events_created_at on public.access_events (created_at desc);

-- 6. Trigger para updated_at em access_grants (opcional, sem quebrar se já existir)
do $$
begin
  if not exists (select 1 from pg_proc where proname='update_access_grants_updated_at') then
    create or replace function public.update_access_grants_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;
  end if;
end $$;

drop trigger if exists trg_access_grants_updated_at on public.access_grants;
create trigger trg_access_grants_updated_at
  before update on public.access_grants
  for each row execute function public.update_access_grants_updated_at();

-- 7. Reload schema cache
notify pgrst, 'reload schema';
