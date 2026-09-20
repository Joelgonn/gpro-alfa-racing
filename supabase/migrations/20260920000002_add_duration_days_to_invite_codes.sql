-- 20260920000002 — FASE 1: duration_days para convites (sem hardcode vip_7_days)
-- Adiciona duração formal do benefício do convite, separando validade do código (expires_at)
-- de duração do benefício. NULL = lifetime, 1..3650 dias.

alter table public.invite_codes
  add column if not exists duration_days integer;

-- Garante CHECK apropriado (1..3650) ou NULL = lifetime
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invite_codes_duration_days_check'
      and conrelid = 'public.invite_codes'::regclass
  ) then
    alter table public.invite_codes
      add constraint invite_codes_duration_days_check
      check (duration_days is null or duration_days between 1 and 3650);
  end if;
end$$;

comment on column public.invite_codes.duration_days is 'Duração do benefício em dias; NULL = lifetime. Separado de expires_at (validade do código).';
