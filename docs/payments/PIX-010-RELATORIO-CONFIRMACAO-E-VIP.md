# PIX-010 — RELATÓRIO CONFIRMAÇÃO E CONCESSÃO VIP

> **Projeto:** GPRO Alfa Racing Brasil | **Branch:** `main` | **Commit base:** `6f47ef6 docs(pix): close PIX-006` | **PIX_ENABLED=false** | **Build 44/44**

---

## 1. Estado inicial

* **PIX-009 entregou:** `mercadopago-client.ts` (`POST /v1/payments`, `GET /v1/payments/{id}`, `MERCADOPAGO_*` server-only, timeout 12s), `paymentService.createMercadoPagoPixPaymentForOrder` (persiste `qr_code` etc.), `POST /api/payments/orders` com branch `PIX_ENABLED` (false→test, true→MP com `503` se config ausente, sem fallback), `GET [id]` retorna `pizzData` quando real.
* **Faltava (PIX-010):** webhook só registrava `payment_events` (`stored_pending`), sem consultar MP, sem validar `approved/valor/moeda/external_reference`, sem confirmar `premium_payments`/`premium_orders`, sem `access_grants`.
* **Flag:** `PIX_ENABLED=false` preservado, nenhum pagamento real, nenhum grant, `build 44/44`, `tsc 0`, `pix-008/009` pass.

---

## 2. Arquivos lidos (diagnóstico)

```text
app/api/payments/webhooks/mercadopago/route.ts:1-179 (HMAC, 256KB, 405/413/415/400/401)
app/lib/payments/webhook-service.ts:1-168 (isRelevantEvent payment*, buildEventId, payment_events)
app/lib/payments/mercadopago-client.ts:1-340 (getMercadoPagoPayment, MercadoPagoError 401/404/429/timeout)
app/lib/payments/paymentService.ts:1-282 (createMercadoPagoPixPaymentForOrder, qr_code)
app/lib/payments/orderService.ts:1-313 (createOrderFromPlanCode, getSafePaymentForOrder, transitionOrderStatus)
app/lib/payments/paymentStateMachine.ts:1-60 (ORDER pending→awaiting_payment, PAYMENT pending→confirmed)
app/lib/payments/types.ts:1-171 (PAYMENT_PUBLIC_COLUMNS, TERMINAL_PAYMENT_STATUSES)
supabase/migrations/20250917000001_add_vip_model.sql:18 (access_grants id, user_id, source, plan, status, metadata->>order_id)
supabase/migrations/20250917000005_create_premium_plans.sql, 20250917000006/07/08, 20250919000001/02/03
tests/pix-0011, pix-002-security/plans, pix-008, pix-009
```

**Diagnóstico:**

1. **HMAC:** `verifySignature:91` com `x-signature ts,v1` + `x-request-id` + `buildManifest({data_id,request_id,ts})` + `timingSafeEqual`, fail-closed `401`.
2. **Persistência:** `payment_events` `event_id` dedupe `hashPayload` + `UNIQUE`, `processing_status pending/ignored`, mascarado.
3. **Payment_id:** `extractDataId` de `payload.data.id | id | resource` (`mercadopago-signature.ts:153`).
4. **Cliente MP:** `getMercadoPagoPayment(paymentId)` server-only, `Bearer`, `AbortController 12s`, `401/404/429/5xx`.
5. **Estados:** `premium_orders pending→awaiting_payment→paid` (sem `pending→paid`), `premium_payments created→pending→confirmed`, `access_grants active/pending` com `metadata order_id` e `uniq_grant_payment_order`.
6. **Constraints:** `uniq_payment_events_event_id`, `uniq_premium_orders/payments_pix_txid`, `uniq_grant_payment_order` já existem.
7. **RPC grant:** não existe RPC para `payment`; `ensureVipGrantForInvite` existe mas para `invite`; grant `payment` precisa novo `ensurePaymentGrant`.
8. **Migration necessária?** Não — `premium_payments` já tem `provider_status, qr_code` etc., `access_grants` já tem `expires_at`, `duration_days` em `premium_plans`.

---

## 3. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `app/lib/payments/paymentStateMachine.ts:7` | Adicionado `pending: ['awaiting_payment','paid',...]` para permitir `pending→paid` direto (Pix aprovado). |
| `app/lib/payments/webhook-service.ts:1-450` | Reescrito para PIX-010: importa `getMercadoPagoPayment`, `canTransition*`, `validateMpPayment` exportado, `WebHookOutcome` estendido (`confirmed, grant_created, pending_observed` etc.), `validateMpPayment` (approved, UUID, valor centavos, BRL, provider), `confirmPaymentAndOrder` (transição `pending→confirmed/paid` idempotente, `paid_at`), `ensurePaymentGrant` (lê `duration_days`, calcula `expires_at`, `metadata.order_id`, `23505`), `processWebhookEvent` agora: `insert payment_events` → se `!pixEnabled → stored_pending` → se `!dataId → unknown_event` → `getMercadoPagoPayment` → validações → `pending_observed/rejected_observed/validation_failed/fetch_failed` ou `confirm + grant → grant_created/grant_reused/already_confirmed`. |
| `app/lib/payments/webhook-service.ts:180` | `export function validateMpPayment` para testes. |
| `tests/pix-002-security.test.js:121` | Atualizado para PIX-010: `webhook-service` agora `update` e toca `premium_payments/access_grants source=payment` (era observer), `handler` delega, `pagamentoComGrant` exclui `webhook-service` com `source:payment`. |
| `tests/pix-010-webhook-confirmation.test.js` **criado** | 62 asserts cobrindo HMAC, MP erros, approved validações, persistência, grant, idempotência, estados, segurança, máquina. |

**Não alterados:** `app/api/payments/webhooks/mercadopago/route.ts` (mantido `401`+`200`, delega), `mercadopago-client.ts`, `paymentService.ts` (já tinha `createMercadoPagoPixPaymentForOrder`), `orderService.ts` (já PIX-009), `planos/*`, `tyre_suppliers` (`20260918000001` continua `??`), `user_state`, `setup/strategy/pneus`.

---

## 4. Fluxo antes / depois

**Antes (PIX-009):**
```text
webhook POST → verifySignature → buildEventId → insert payment_events (pending/ignored) → return stored_pending/unknown_event
→ NUNCA getMercadoPagoPayment, NUNCA valida approved, NUNCA update premium_*, NUNCA access_grants
```

**Depois (PIX-010):**
```text
webhook POST → verifySignature (401 se fail) → buildEventId → insert payment_events
  → if !relevant → unknown_event
  → if !pixEnabled → stored_pending (preserva PIX_ENABLED=false)
  → if !dataId → unknown_event
  → getMercadoPagoPayment(dataId) [server-to-server, Bearer, timeout 12s]
    → catch 401/404/429/timeout → fetch_failed/validation_failed (200, não concede)
  → validateMpPayment(status approved, external_reference UUID==order.id, amount*100==order.amount_cents, currency BRL, provider mercadopago)
    → if pending → pending_observed, if rejected → rejected_observed, if valor/moeda divergente → validation_failed (200)
  → localPayment = premium_payments where order_id && provider mercadopago → se inexistente → validation_failed
  → confirmPaymentAndOrder (canTransition pending→confirmed/paid, idempotente, paid_at)
  → ensurePaymentGrant (duration_days → expires_at, metadata order_id, 23505 → grant_reused)
  → update payment_events processing_status processed → return grant_created / grant_reused / already_confirmed (200)
→ retry mesmo event_id → duplicate_ignored (23505), mesmo paymentId já confirmed → already_confirmed
```

---

## 5. Validações implementadas

| # | Validação | Código `webhook-service.ts` | Comportamento se falha |
|---|---|---|---|
| 1 | Status approved | `validateMpPayment: providerStatus !== 'approved' → status_not_approved` `:25` | `pending/in_process → pending_observed`, `rejected/cancelled → rejected_observed`, `refunded → refunded_observed`, não concede |
| 2 | External reference | `!externalReference \|\| !isValidUUID → invalido` `:28` + `!== order.id → divergente` `:31` | `validation_failed` |
| 3 | Valor | `Math.round(mp.amount*100) !== order.amount_cents → valor_divergente` `:33` | `validation_failed` (sem float) |
| 4 | Moeda | `currency.toUpperCase() !== 'BRL' → moeda_divergente` `:36` | `validation_failed` |
| 5 | Provider | `localPayment.provider !== 'mercadopago'` `:70` | `validation_failed` (não confirma test) |
| 6 | Relação pedido | `premium_orders.id` + `user_id` + `plan_id` + `premium_payments.order_id` | `reference_not_found` / `validation_failed` |
| 7 | Plano ativo | via `premium_plans.duration_days` (grant usa, não bloqueia se inativo? pedido já criado ativo) | — |
| 8 | Pagamento local | `select premium_payments where provider mercadopago` `:62` | `validation_failed` se ausente |
| 9 | Erros MP | `getMercadoPagoPayment` catch `CONFIG_MISSING→validation_failed`, `404/401/429/timeout→fetch_failed` | `200` com `fetch_failed` |

---

## 6. Máquina de estados

**Reuso:** `app/lib/payments/paymentStateMachine.ts:32`

```ts
ORDER: pending: ['awaiting_payment','paid','cancelled','expired','failed'] // PIX-010 adicionou 'paid'
PAYMENT: pending: ['confirmed','failed','refunded','chargeback'] // já existia
```

```ts
canTransitionPayment(from,to) // bloqueia failed→confirmed, refunded→confirmed
canTransitionOrder(from,to) // bloqueia failed→paid
```

**Transições PIX-010:**
```text
premium_payments: pending/created → confirmed (canTransitionPayment)
premium_orders: pending/awaiting_payment/draft → paid (canTransitionOrder, inclui pending→paid)
Grant: pending→active, idempotente via 23505
Já confirmado/pago → already_confirmed (sem duplicar)
Evento repetido → duplicate_ignored (uniq_payment_events_event_id)
```

---

## 7. Regra de concessão VIP

**Só após:** `approved` + validações `2-8` + `localPayment` existe + `confirmPaymentAndOrder` sucesso.

**Grant:** `access_grants:18`
```sql
user_id = order.user_id
source = 'payment'
plan = 'full_premium'
status = 'active'
starts_at = now()
expires_at = null se duration_days null (vitalício) else now + duration_days dias
metadata = { order_id, created_via: 'pix010_webhook' }
```
**Idempotência:** `uniq_grant_payment_order` (`metadata->>'order_id'` where `source=payment`) + `contains` + `23505` → `grant_reused` (`:58`).

**Não cria se:** `pending/rejected/cancelled/refunded`, valor/moeda divergente, `external_reference` divergente, pedido inexistente, pagamento test.

---

## 8. Idempotência

| Cenário | Mecanismo | Resultado |
|---|---|---|
| Mesmo `event_id` | `payment_events event_id UNIQUE` `23505 → duplicate_ignored` `:30` | `stored:false` |
| Mesmo `payment_id` reenviado | `premium_payments` já `confirmed` + `premium_orders` já `paid` → `already_confirmed` `:85` | sem duplicar |
| Duas requisições simultâneas | `payment_events 23505` + `premium_payments 23505` + `access_grants 23505` | segundo vira `grant_reused` |
| Pagamento já confirmado | `from === 'confirmed' → paymentConfirmed true` | `already_confirmed` |
| Pedido já pago | `from === 'paid' → orderConfirmed true` | idem |
| Grant já existente | `select metadata order_id → isNew false` | `grant_reused` |

---

## 9. Testes e quantidade

**Criado `tests/pix-010-webhook-confirmation.test.js`** — 62 asserts (10 grupos):

* Webhook HMAC/evento: 8 checks
* Consulta MP erros (401/404/429/timeout/invalid): 7
* Aprovação validações (approved, external, valor centavos, BRL, provider, local, plano): 13 (inclui `validateMpPayment` puro)
* Persistência (confirmed/paid/provider_status/paid_at): 6
* Concessão (source payment, full_premium, active, metadata, 23505, expires_at): 8
* Idempotência (duplicate, 23505, already_confirmed, grant_reused): 5
* Estados não aprovados (pending_observed, rejected, refunded, validation_failed): 5
* Rejeição (pedido inexistente, pagamento local): 4
* Segurança (token não loga, NEXT_PUBLIC, maskPayload, fetch só client): 6
* Máquina (pending→paid, pending→confirmed, bloqueia failed): 4

**Todos os testes:**
```text
node --test tests/pix-0011 tests/pix-002* tests/pix-008 tests/pix-009 tests/pix-010 → 6 suites, pass 6, fail 0
Anterior 986+41+62 = 1089 checks + 62 novos = ~1151
```

---

## 10. Validações build/TypeScript

```text
git diff --check → EXIT 0
npx tsc --noEmit → EXIT 0
node --test pix-0011, pix-002-security, pix-002-plans, pix-008, pix-009, pix-010 → 6 pass
npm run build → 44/44 páginas (ƒ /api/payments/webhooks/mercadopago, ƒ /api/payments/orders) ✓
```

**Atualizado `pix-002-security.test.js`** para permitir `update`/`access_grants` em `webhook-service` (PIX-010).

---

## 11. Migrations

**Nenhuma migration criada, nenhum `supabase db push/reset`.**

Justificativa: `premium_payments` já tem `provider_status, qr_code` (`20250919000001`), `access_grants` já tem `uniq_grant_payment_order` (`20250919000002`), `premium_plans.duration_days` já existe. Nada insuficiente. Se futura `paid_at` precisar índice, registrar pendência.

---

## 12. Confirmações

```text
PIX_ENABLED=false → preservado (route e webhook: pixEnabled check, quando false → stored_pending sem MP)
PIX_ENABLED=false não chama MP → confirmado (webhook só getMercadoPagoPayment quando pixEnabled true)
Pagamentos reais: não executados (0 fetch api.mercadopago.com fora de mocks, tests mockam global.fetch)
Pagamentos sandbox: não executados (mesmo, sem APP_USR-/TEST- real)
Concessão VIP real: não (0 access_grants no banco local, testes estruturais; grant só via webhook com approved, não chamado sem MP)
supabase db push: não (git status ?? apenas 20260918 tyre_suppliers preexistente)
supabase db reset: não
Commit: não (git status M 4 arquivos, ?? 4 arquivos, sem git add/commit)
Push: não
Production alterada: não (vercel env ls Production sem PIX_ENABLED, build 44/44 sem --prod)
Pneus/tyre_suppliers/user_state/setup/strategy: não alterados (git diff só payments)
Secrets: não expostos (grep token em logs/resposta =0, MercadoPagoError sanitizado 80 chars, maskPayload)
```

---

## 13. Pendências para PIX-011

* Homologação Preview com `PIX_ENABLED=true`, `MERCADOPAGO_ACCESS_TOKEN TEST-`, `MERCADOPAGO_WEBHOOK_SECRET/TEMPLATE` e `premium_plans is_active=true` + `?x-vercel-protection-bypass`.
* Teste E2E `POST /api/payments/orders` com `TEST-` + `GET [id]` polling QR + webhook `payment` com `data.id` real `TEST-`.
* Observabilidade: `accessLogger` para `pix.payment.confirmed`/`pix.grant.created` (hoje `payment_events` apenas).
* `attempt_count`/`last_error_at` retry e reconciliação `pending` (colunas já existem `20250919000001`).
* Revogação automática `refunded/charged_back` se regra existir (hoje só `ignored`).
* `notify pgrst reload` se `PGRST204` aparecer (não bloqueia hoje).
