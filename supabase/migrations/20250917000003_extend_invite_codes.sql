-- Migration: ALFA-011.5 — Gerenciador de convites VIP
-- Objetivo: ampliar public.invite_codes sem recriar, sem apagar dados antigos
-- Mantém compatibilidade: todos os novos campos aceitam NULL, default jsonb

-- 1. Colunas de auditoria e validade (aditivas, IF NOT EXISTS)
alter table public.invite_codes add column if not exists used_by uuid;
alter table public.invite_codes add column if not exists used_at timestamptz;
alter table public.invite_codes add column if not exists created_by uuid;
alter table public.invite_codes add column if not exists expires_at timestamptz;
alter table public.invite_codes add column if not exists revoked_at timestamptz;
alter table public.invite_codes add column if not exists revoked_by uuid;
alter table public.invite_codes add column if not exists invite_type text;
alter table public.invite_codes add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.invite_codes.used_by is 'Usuário que utilizou o convite (auth.users.id); NULL se ainda não usado';
comment on column public.invite_codes.used_at is 'Data em que o convite foi utilizado';
comment on column public.invite_codes.created_by is 'Admin que criou o convite';
comment on column public.invite_codes.expires_at is 'Validade do convite; NULL = vitalício (nunca expira)';
comment on column public.invite_codes.revoked_at is 'Data de revogação; NULL se não revogado';
comment on column public.invite_codes.revoked_by is 'Admin que revogou o convite';
comment on column public.invite_codes.invite_type is 'Tipo do convite: vip_30_days | vip_lifetime | vip_custom';
comment on column public.invite_codes.metadata is 'Metadados auxiliares (ex: validityType), default {}';

-- 2. Índices úteis (IF NOT EXISTS, parciais)
create index if not exists idx_invite_codes_expires_at on public.invite_codes (expires_at) where expires_at is not null;
create index if not exists idx_invite_codes_revoked_at on public.invite_codes (revoked_at) where revoked_at is not null;
create index if not exists idx_invite_codes_used_by on public.invite_codes (used_by) where used_by is not null;
create index if not exists idx_invite_codes_created_by on public.invite_codes (created_by) where created_by is not null;
create index if not exists idx_invite_codes_is_used on public.invite_codes (is_used);
create index if not exists idx_invite_codes_invite_type on public.invite_codes (invite_type) where invite_type is not null;

-- 3. Constraint de tipo (check) — permite NULL para compatibilidade com antigos
do $$
begin
  if not exists (select 1 from pg_constraint where conname='invite_codes_invite_type_check') then
    alter table public.invite_codes add constraint invite_codes_invite_type_check
      check (invite_type is null or invite_type in ('vip_30_days','vip_lifetime','vip_custom'));
  end if;
end $$;

-- 4. RPC atômico para consumo de convite (uso único, protegido contra corrida)
--    Uso futuro em signup: select for update implícito via UPDATE ... WHERE is_used=false ...
create or replace function public.consume_invite_code(p_code text)
returns table (id uuid, code text, invite_type text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  -- Tenta marcar como usado atomicamente: só sucede se is_used=false, não revogado e não expirado
  update public.invite_codes
  set is_used = true, used_at = now(), used_by = auth.uid()
  where invite_codes.code = p_code
    and invite_codes.is_used = false
    and invite_codes.revoked_at is null
    and (invite_codes.expires_at is null or invite_codes.expires_at > now())
  returning * into v_row;

  if not found then
    -- Distingue motivo para mensagem adequada (sem vazar existência se necessário, mas aqui retorna vazio)
    return;
  end if;

  return query select v_row.id, v_row.code, v_row.invite_type, v_row.expires_at;
end;
$$;

comment on function public.consume_invite_code(text) is 'ALFA-011.5 RPC atômico: consome convite se disponível (is_used=false, não revogado, não expirado); protege contra concorrência';

grant execute on function public.consume_invite_code(text) to authenticated;
grant execute on function public.consume_invite_code(text) to service_role;

-- 5. RLS já existente para invite_codes (invite_select_auth) permanece
--    Garantir que não há insert/update/delete para authenticated (escrita só service_role/RPC definer)
--    RPC acima é security definer, então authenticated pode consumir via RPC mesmo sem políticas de update

-- Reload schema cache
notify pgrst, 'reload schema';
