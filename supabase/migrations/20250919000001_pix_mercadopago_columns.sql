-- Migration: PIX-001.1 — Colunas de integração com o Mercado Pago (Payments API / Pix)
--
-- Objetivo: preparar premium_orders e premium_payments para o ciclo Pix real, de forma
-- ADITIVA e IDEMPOTENTE. Nenhuma coluna existente é alterada ou removida. Nenhum CHECK
-- existente é modificado (o vocabulário do MP é mapeado para os valores já permitidos).
--
-- NÃO concede acesso VIP. NÃO ativa Pix. NÃO cria webhook.
-- NÃO altera RLS existente nem policies existentes.

-- ============================================================
-- 1. premium_orders — identificadores e controle no provedor
-- ============================================================
alter table public.premium_orders
  add column if not exists provider_external_reference text,
  add column if not exists provider_order_id text,
  add column if not exists provider_status text,
  add column if not exists provider_updated_at timestamptz;

comment on column public.premium_orders.provider_external_reference is
  'Identificador enviado ao provedor (= premium_orders.id). Usado para validar posse no webhook.';
comment on column public.premium_orders.provider_order_id is
  'ID da order no provedor (Orders API). NULL quando o fluxo usa apenas Payments API.';
comment on column public.premium_orders.provider_status is
  'Status BRUTO devolvido pelo provedor (approved|pending|in_process|rejected|cancelled|refunded|charged_back). O status interno continua em premium_orders.status.';
comment on column public.premium_orders.provider_updated_at is
  'updated_at informado pelo provedor, usado para descartar eventos fora de ordem.';

create index if not exists idx_premium_orders_provider_order_id
  on public.premium_orders (provider_order_id) where provider_order_id is not null;

create index if not exists idx_premium_orders_provider_external_reference
  on public.premium_orders (provider_external_reference) where provider_external_reference is not null;

-- ============================================================
-- 2. premium_payments — dados da cobrança Pix
-- ============================================================
alter table public.premium_payments
  add column if not exists provider_status text,
  add column if not exists external_reference text,
  add column if not exists qr_code text,
  add column if not exists qr_code_base64 text,
  add column if not exists ticket_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists raw_response_masked jsonb;

comment on column public.premium_payments.provider_status is
  'Status BRUTO do provedor. O status interno continua em premium_payments.status (CHECK já existente).';
comment on column public.premium_payments.external_reference is
  'Referência externa enviada ao provedor (= premium_payments.order_id -> premium_orders.id).';
comment on column public.premium_payments.qr_code is
  'Pix Copia e Cola (payload EMV). Repassado ao usuário; não é segredo, mas não deve ser logado.';
comment on column public.premium_payments.qr_code_base64 is
  'Imagem do QR Code em base64 (data URI ou base64 puro, conforme o provedor).';
comment on column public.premium_payments.ticket_url is
  'URL da página de pagamento do provedor, quando disponível.';
comment on column public.premium_payments.expires_at is
  'Validade da cobrança Pix (date_of_expiration do provedor).';
comment on column public.premium_payments.raw_response_masked is
  'Resposta do provedor MASCARADA (LGPD): nunca armazenar payload integral nem dados do pagador.';

create index if not exists idx_premium_payments_provider_status
  on public.premium_payments (provider_status) where provider_status is not null;

create index if not exists idx_premium_payments_expires_at
  on public.premium_payments (expires_at) where expires_at is not null;

-- O filtro "cobranças pendentes vencidas" (conciliação / polling) usa status + expires_at
create index if not exists idx_premium_payments_pending_expires
  on public.premium_payments (expires_at)
  where status = 'pending' and expires_at is not null;

-- ============================================================
-- 3. payment_events — suporte a dedupe e reprocessamento robusto
--    (a tabela já existe com event_id UNIQUE parcial e processing_status)
-- ============================================================
alter table public.payment_events
  add column if not exists provider_status text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error_at timestamptz;

comment on column public.payment_events.attempt_count is
  'Tentativas de processamento do evento (retry). Não substitui processing_status.';
comment on column public.payment_events.last_error_at is
  'Quando ocorreu o último erro de processamento (para backoff e observabilidade).';

-- ============================================================
-- 4. Índices para o fluxo de concessão de VIP por pagamento
--    (apenas índices — NENHUMA policy ou RLS é alterada aqui)
-- ============================================================
create index if not exists idx_access_grants_source
  on public.access_grants (source, status);

create index if not exists idx_access_grants_metadata_order
  on public.access_grants ((metadata->>'order_id'))
  where source = 'payment' and metadata ? 'order_id';

-- ============================================================
-- 5. Verificação de sanidade (não falha a migration; apenas reporta)
-- ============================================================
do $$
declare
  n_ord int; n_pay int; n_evt int;
begin
  select count(*) into n_ord from information_schema.columns
    where table_schema='public' and table_name='premium_orders'
      and column_name in ('provider_external_reference','provider_order_id','provider_status','provider_updated_at');

  select count(*) into n_pay from information_schema.columns
    where table_schema='public' and table_name='premium_payments'
      and column_name in ('provider_status','external_reference','qr_code','qr_code_base64','ticket_url','expires_at','provider_updated_at','raw_response_masked');

  select count(*) into n_evt from information_schema.columns
    where table_schema='public' and table_name='payment_events'
      and column_name in ('provider_status','attempt_count','last_error_at');

  raise notice 'PIX-001.1: premium_orders %/4 colunas novas | premium_payments %/8 | payment_events %/3', n_ord, n_pay, n_evt;
end $$;
