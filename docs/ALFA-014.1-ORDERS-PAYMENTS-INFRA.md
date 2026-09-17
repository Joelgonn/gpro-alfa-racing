# ALFA-014.1 — Infraestrutura Orders + Payments

> **Sprint:** ALFA-014.1 — Orders + Payments (sem Pix real, sem VIP automático)
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations VIP:** `20250917000001`..`00005` `Local|Remote` iguais (5/5 após 014.0)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## Resumo

Infraestrutura de pedidos e pagamentos criada localmente como base para futuro Pix, sem gateway, sem webhook, sem `grant` VIP automático, sem `commit`/`push`/`deploy`.

## Arquivos criados/alterados

| Arquivo | Tipo | Ação |
|---|---|---|
| `supabase/migrations/20250917000006_create_premium_orders.sql` | **Criado 45 linhas** | `premium_orders` + índices + RLS + trigger `updated_at` |
| `supabase/migrations/20250917000007_create_premium_payments.sql` | **Criado 40 linhas** | `premium_payments` + índices + RLS + trigger |
| `supabase/migrations/20250917000008_create_payment_events.sql` | **Criado 30 linhas** | `payment_events` + índices + RLS |
| `app/lib/payments/types.ts` | **Alterado +40 linhas** | `PremiumOrder`, `PremiumPayment`, `PaymentProvider`, `PremiumOrderStatus` etc., mantendo `price_cents`/`duration_days null` compatível com `premium_plans` |
| `app/lib/payments/orderService.ts` | **Criado 55 linhas** | `createOrderIdempotent` (captura `price_cents` do plano, não frontend), `getOrderForUser`, `transitionOrderStatus` |
| `app/lib/payments/paymentService.ts` | **Criado 35 linhas** | `createPaymentForOrder` idempotente por `order_id`, `getPaymentForUser` com `EXISTS` |
| `app/lib/payments/paymentStateMachine.ts` | **Criado 30 linhas** | `canTransitionOrder/Payment`, `ORDER_TRANSITIONS`/`PAYMENT_TRANSITIONS`, `GRANT_ISSUED_AFTER` |
| `app/api/admin/orders/route.ts` | **Criado 55 linhas** | `GET` com `requireAdmin`, paginação `page/limit`, filtros `status/userId`, máscara `pix_txid`, `405` para POST etc. |
| `app/api/admin/payments/route.ts` | **Criado 55 linhas** | `GET` com `requireAdmin`, filtros `status/orderId`, máscara, `405` |
| `app/api/admin/payment-events/route.ts` | **Criado 45 linhas** | `GET` com `requireAdmin`, filtros `provider/event_type`, `payload_json` omitido por padrão, `405` |
| `tests/alfa-014-orders.test.js` | **Criado 30 linhas** | Schema/FK/RLS/serviço/API |
| `tests/alfa-014-payments.test.js` | **Criado 25 linhas** | Schema/RLS/serviço |
| `tests/alfa-014-idempotency.test.js` | **Criado 25 linhas** | Idempotência, transições, separação |
| `tests/alfa-014-security.test.js` | **Criado 35 linhas** | RLS, 405, payload, VIP_CHECK, sem grant |
| `supabase/seed.sql` | Mantido 24 linhas (013.1) | `vip_monthly`/`vip_lifetime` `ON CONFLICT DO NOTHING`, não alterado (sem `TEST-ALFA-0141-` pagamentos reais) |

## Migrations

### `premium_orders` (00006)
* `id uuid pk`, `user_id uuid not null`, `plan_id uuid references premium_plans(id)`, `status check draft/pending/awaiting_payment/paid/cancelled/expired/failed/refunded/chargeback`, `amount_cents int check >=0`, `currency text default BRL check BRL`, `pix_txid text`, `payload_hash text`, `expires_at`, `paid_at`, `cancelled_at`, `created_at/updated_at`.
* Índices: `uniq_premium_orders_pix_txid where pix_txid not null`, `idx_payload_hash`, `idx_user_id`, `idx_plan_id`, `idx_status`.
* Trigger `update_premium_orders_updated_at`.
* RLS `enable` + `premium_orders_select_own` `for select to authenticated using (auth.uid()=user_id)` — sem `insert/update/delete` para `authenticated` (só `service_role`).

### `premium_payments` (00007)
* `id`, `order_id references premium_orders`, `provider text`, `provider_payment_id`, `pix_txid`, `status check created/pending/confirmed/failed/refunded/chargeback`, `amount_cents >=0`, `currency BRL`, `payload_hash`, `paid_at`, `created_at/updated_at`.
* Índices: `idx_order_id`, `uniq pix_txid where not null`, `idx provider_payment_id`, `idx payload_hash`, `idx status`.
* RLS `enable` + `premium_payments_select_own` `exists (select 1 from premium_orders where id=order_id and user_id=auth.uid())` — usuário só vê pagamentos de seus pedidos.

### `payment_events` (00008)
* `id`, `order_id`, `payment_id`, `provider`, `event_type`, `event_id`, `payload_hash`, `payload_json jsonb`, `received_at default now()`, `processed_at`, `processing_status check pending/processed/failed/ignored`, `error_message`.
* Índices: `uniq event_id where not null`, `idx payload_hash, order_id, payment_id, provider`.
* RLS `enable` — sem policy para `authenticated` (só `service_role` via `GET /api/admin/payment-events` com `requireAdmin`), `payload_json` nunca retornado por padrão.

Todas `create table if not exists` + `create index if not exists` + `drop policy/trigger if exists` — idempotentes, sem `DROP TABLE/TRUNCATE`.

## Schema (resumo)

| Tabela | PK | FK | Status check | Índices únicos |
|---|---|---|---|---|
| `premium_plans` (014.0) | `id` | — | — | `uniq_premium_plans_code` |
| `premium_orders` | `id` | `plan_id → premium_plans` | 9 valores | `uniq pix_txid` parcial |
| `premium_payments` | `id` | `order_id → premium_orders` | 6 valores | `uniq pix_txid` parcial |
| `payment_events` | `id` | `order_id/payment_id` | `processing_status` 4 | `uniq event_id` parcial |

## RLS

* `premium_orders` `select own` (`auth.uid()=user_id`), sem escrita `authenticated`.
* `premium_payments` `select own` via `EXISTS` no `premium_orders`, sem escrita.
* `payment_events` sem `select` para `authenticated` (só `service_role`).
* Verificado via `grep` `for select to authenticated` `1` cada, sem `for insert` para `authenticated`.

## APIs

| Método | Rota | Auth | Paginação | Filtros | Sensível |
|---|---|---|---|---|---|
| `GET` | `/api/admin/orders` | `requireAdmin` 401/403 | `page/limit` 1-100 | `status` enum validado, `userId` UUID | `pix_txid` mascarado `slice(0,8)***`, sem `payload_json` |
| `GET` | `/api/admin/payments` | `requireAdmin` | `page/limit` | `status`, `orderId` UUID | `pix_txid`/`provider_payment_id` mascarados |
| `GET` | `/api/admin/payment-events` | `requireAdmin` | `page/limit` | `provider`, `event_type` | `payload_json` omitido (não `select payload_json`) |

Todos `POST/PUT/PATCH/DELETE` → `405 Method Not Allowed`. Sem `userId` arbitrário sem validação (`userId`/`orderId` validados `^[0-9a-f-]{36}$` UUID), sem `service_role` no JSON.

## Máquina de estados

**Orders:** `draft→pending→awaiting_payment→paid→(refunded/chargeback)` + `cancelled/expired/failed` de `pending/awaiting_payment`. `canTransitionOrder` em `paymentStateMachine.ts` com `ORDER_TRANSITIONS` map.

**Payments:** `created→pending→confirmed→(refunded/chargeback)` + `failed` de `pending`, `awaiting_payment` legado compatível. `canTransitionPayment`.

**Grant:** `GRANT_ISSUED_AFTER = ['paid']` — só após `paid` confirmado, via `service_role` após webhook validado (não nesta sprint), nunca frontend.

**Idempotência:** `pix_txid` único parcial (`uniq ... where pix_txid not null`), `payload_hash` índice, `event_id` único, `provider_payment_id` índice, `orderService` `SELECT ... WHERE user_id + plan_id IN (pending, awaiting_payment)` antes de `INSERT`, `paymentService` `SELECT ... WHERE order_id IN (pending, created)` antes de `INSERT`.

## Idempotência

* `premium_orders` `pix_txid` `unique where not null` — `INSERT` com mesmo `pix_txid` falha `23505` (duplicidade Pix).
* `premium_payments` `pix_txid` idem, `payload_hash` índice para replay.
* `payment_events` `event_id` `unique where not null` — webhook duplicado `event_id` já existe → `failed`/`ignored`.
* `orderService.createOrderIdempotent` — `SELECT ... WHERE user_id + plan_id IN (pending)` → se existe retorna, senão `INSERT` com `amount_cents` capturado de `premium_plans.price_cents` (nunca `body.amount_cents`).
* `paymentService.createPaymentForOrder` — `SELECT ... WHERE order_id IN (pending)` → idempotente por pedido.

## Testes e resultados

| Suite | Arquivo | Asserts | Resultado |
|---|---|---|---|
| Orders | `alfa-014-orders.test.js` | 14 | `EXIT:0` |
| Payments | `alfa-014-payments.test.js` | 10 | `EXIT:0` |
| Idempotency | `alfa-014-idempotency.test.js` | 8 | `EXIT:0` |
| Security | `alfa-014-security.test.js` | 13 | `EXIT:0` |
| Premium plans | `alfa-014-premium-plans.test.js` | 24 | `EXIT:0` (revalidado após ajuste `allow premium_plans`) |
| 011.2..9 + 012.1 | `alfa-011-*.test.js` | 150+ | `EXIT:0` todos |
| TypeScript | `npx tsc --noEmit` | — | `TSC:0` |
| Build | `npm run build` | 37/37 | `BUILD:0` |

**Dry-run remoto:** `supabase db push --dry-run --linked` não executado nesta sprint (sem autorização explícita para `00006`..`00008`; `supabase migration list --linked` ainda `00001..00005` `Local` apenas para `00005` antes, agora `00006..00008` `Local` apenas — `Remote` `00001..00004` apenas, `00005` também local após 014.0 não push). Validado localmente via `grep` RLS e `create table if not exists` sem `supabase db push --linked` (conforme restrição `Não aplicar migrations remotas sem autorização`).

## Limitações

* Migrations `00006..00008` **não aplicadas** no remoto `cycq***us` — `supabase db push` não executado (sem `--dry-run` com `00006` ainda pendente). `supabase/migrations` 8 arquivos local, `Remote` `00001..00004` apenas.
* `supabase db reset` não executado (Docker `supabase status` `failed to inspect container health` sem Docker Desktop) — validado via `grep` + `tst` estático, não `psql` local.
* Seed `supabase/seed.sql` não executado remotamente (tabela `premium_plans` ainda `Local` apenas após 014.0, não `Remote` — seed `IF EXISTS` não faria nada remoto até `00005` push).

## Pendências

* Aplicar `00005`..`00008` em staging com `supabase db push --linked` após autorização (quando `premium_plans` for validado remoto, `seed.sql` `vip_monthly`/`vip_lifetime` poderá ser aplicado com `psql -f supabase/seed.sql`).
* Implementar `POST /api/payments/orders` com `requireAuth` + `planId` validado + `amount_cents` capturado (não `body`), sem Pix real.
* `VIP_CHECK=false` permanece até `paid → grant_issued` validado com `TEST-*` `pix_txid` idempotente.

## Confirmações

* **VIP_CHECK** `false` (`app/lib/access/accessService.ts:23` `false as const` 1, `VIP_CHECK=true` 0) — `grep -r VIP_CHECK` `1`.
* **requireVip** desativado (`grep -r requireVip app/api` `0` em Manager, só definição em `accessService.ts`).
* **Sem commit:** `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5) + `??` 3 migrations + `??` `app/lib/payments/*` + `??` 3 endpoints + `??` 4 testes + `??` docs — `git diff --check` `0` (warnings CRLF), `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (ainda `signup.ts` + `layout.tsx` de sprints anteriores), `git log --oneline -1` `a20eae3`.
* **Sem push:** `git remote -v` não `push`.
* **Sem deploy:** `vercel --prod` não executado.
* **Sem Pix real:** `grep -r "pix_txid.*insert" app/lib/payments` `0` `INSERT` Pix real, só `premium_orders` `pix_txid` `null` default; nenhum `provider` `efi`/`pagarme` com credencial, nenhum `webhook` `POST /api/payments/webhook` criado.
* **Sem APK rebuild:** `npx cap` não executado, `android/` não alterado.

---

## Status final

**Aprovada** — infraestrutura `premium_orders`/`premium_payments`/`payment_events` criada localmente idempotente com `RLS`, `amount_cents` capturado do plano (não frontend), `pix_txid`/`event_id` idempotência, `service_role` só backend, APIs admin `GET` com `requireAdmin` + paginação + máscara + `405`, sem `grant` VIP automático, sem Pix real, sem `VIP_CHECK=true`, sem `commit`/`push`/`deploy`.

Próxima sprint `ALFA-014.2` pode criar `POST /api/payments/orders` com `TEST-ALFA-0141-` isolado e `supabase db push --dry-run --linked` quando autorizado.

*Fim ALFA-014.1 — aguardar autorização para `db push` de `00005`..`00008`.*
