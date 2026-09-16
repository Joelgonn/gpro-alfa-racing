-- Migration: ALFA-008.2 Fase 1 — Biblioteca em Nuvem gpro_sponsors somente leitura
-- Catálogo global, sem INSERT/UPDATE/DELETE para cliente

alter table public.gpro_sponsors enable row level security;

drop policy if exists "gpro_sponsors_select_authenticated" on public.gpro_sponsors;
create policy "gpro_sponsors_select_authenticated"
on public.gpro_sponsors
for select
to authenticated
using (true);

-- Não criar policies de INSERT/UPDATE/DELETE para authenticated/anon => apenas service_role (bypass) pode escrever
