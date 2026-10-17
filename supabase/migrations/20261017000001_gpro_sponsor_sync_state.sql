-- Migration: ALFA-010 — Claim de sincronização do catálogo de patrocinadores
-- Garante no máximo um refresh de AvailSponsors por (user_id, season, race),
-- inclusive sob requisições concorrentes em múltiplas instâncias serverless.
--
-- Aditiva e idempotente: não altera tabelas/colunas existentes e não apaga dados.
-- Apenas service_role (bypass) acessa: RLS habilitada SEM policies para
-- authenticated/anon, seguindo o padrão de public.gpro_sponsors.

create table if not exists public.gpro_sponsor_sync_state (
  user_id uuid not null,
  season integer not null,
  race integer not null,
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  constraint gpro_sponsor_sync_state_pkey primary key (user_id, season, race)
);

alter table public.gpro_sponsor_sync_state enable row level security;

-- Sem policies de SELECT/INSERT/UPDATE/DELETE para authenticated/anon
-- => somente service_role (bypass) pode ler/escrever.
