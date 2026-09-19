# PIX-012 — Relatório de Homologação E2E Preview

## 1. Identificação

- **Sprint:** PIX-012
- **Commit:** `92c1074` `fix(payments): harden PIX webhook and payment authorization`
- **Preview:** `https://gpro-alfa-racing-brasil-ke76kou45-joelson-goncalves-projects.vercel.app` (`ke76kou45` / `dpl_CjqvTsqXSvhNkYQYTp6TbmjafdB7`, `f6s7geq92` também `92c1074`)
- **Production:** `https://gpro-alfa-racing-brasil-eiklmp33z-joelson-goncalves-projects.vercel.app` (`eiklmp33z` / `dpl_HAjWoVepX4n26kqeeTjy8LtCBC5R`, `92c1074`)
- **Data:** 2026-09-19

## 2. Objetivo

Registrar a homologação do fluxo PIX após o hardening `PIX-011` (`IDOR`, `TOCTOU`, `HMAC freshness`, `dedupe`, `limit(10)`, `catch`).

## 3. Ambiente Preview

- **Deployment:** `ke76kou45` `Ready` (`92c1074`)
- **Commit SHA:** `92c1074`
- **VERCEL_ENV:** `preview`
- **PIX_ENABLED:** `true` (Preview `Hidden Sensitive`)
- **Plano E2E:** `vip_monthly` (`042036a4-4aa7-4efc-b70e-663341ea8f84`, `1990`/`BRL`, `is_active=false` mas visível via `PIX_E2E_PLAN_CODE=vip_monthly` + `VERCEL_ENV=preview` + `PIX_ENABLED=true`)
- **Mercado Pago Test Credentials:** `MERCADOPAGO_ACCESS_TOKEN` `Hidden Sensitive` (`APP_USR-` Preview), `MERCADOPAGO_WEBHOOK_SECRET` `Hidden` + `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` `id:{data_id};request-id:{request_id};ts:{ts};` (Preview)

*Valores de secrets não registrados.*

## 4. Fluxo homologado

```
POST /api/payments/orders {planCode: vip_monthly, Idempotency-Key: TEST-ALFA-0141-...}
  → orderService.createOrderFromPlanCode (userId da sessão, price do banco, payload_hash)
  → premium_orders (service_role, RLS select own)
→ paymentService.createMercadoPagoPixPaymentForOrder
  → mercadopago-client POST /v1/orders {external_reference=order.id, total_amount 19.90, payer.email}
  → premium_payments (mercadopago, pending, qr_code, ticket_url) + premium_orders.provider_order_id
→ POST /v1/orders/{id}/events {status: approved} (simulação teste, 204)
→ GET /v1/orders/{id} (server-to-server, processed/accredited)
→ POST /api/payments/webhooks/mercadopago {type:order, data.id} com x-signature/x-request-id
  → mercadopago-signature verifySignature (HMAC-SHA256, timingSafeEqual, fail-closed, freshness 10min/10y test)
  → webhook-service processWebhookEvent (event_id, payment_events, getMercadoPagoOrder, validateMpPayment, confirmPaymentAndOrder, ensurePaymentGrant)
  → access_grants (payment, grant_created/duplicate_ignored)
```

## 5. Resultados E2E

- **Criação:** `ab07f65a-ae2e-475f-949e-8baf60e315f0` (`871ac000-...`, `pending` `1990/BRL`, `payload_hash 01f13046...`) criado via SQL Editor (fora CLI, `service_role`), `POST /v1/orders` `201` `ORDTST01M2X1JZB8BKMZY8XN8499N1GK`/`PAY01M2X1JZBSXE0QH1Q56NKN346X`.
- **IDOR:** `paymentService.createPaymentForOrder` exige `userId` + `eq user_id`, `transitionOrderStatus` exige `userId` + `eq user_id` no `UPDATE`, `GET /api/payments/orders/[id]` `premium_orders!inner(user_id)` + `eq user_id` → `A→B 404` (estrutural, `node --test` cobre).
- **Idempotência pedido:** `Idempotency-Key` + `payload_hash` + `23505` → `200 idempotent:true`.
- **Orders API:** `external_reference=premium_order.id` UUID, `total_amount 19.90`, `BRL`, `pix/bank_transfer`, `X-Idempotency-Key`.
- **Aprovação teste:** `POST /v1/orders/.../events {"status":"approved"} → 204` → `GET → 200 processed/accredited` (`mercadopago-client.ts:312`).
- **Webhook HMAC:** `pix.webhook.received verified=true hasRequestId:true hasDataId:true` → `pix.webhook.processed grant_created stored:true eventType:order orderIdMasked:ab07f65a***` (`ke76kou45` `dpl_CjqvTsq...`).
- **Grant:** `premium_orders pending→paid`, `premium_payments pending→confirmed` (`provider_status processed`), `access_grants 1` `source payment` `metadata {order_id: ab07f65a..., created_via: pix010_webhook}` `expires_at +30d`.
- **Replay:** reenvio mesmo `x-signature`/`x-request-id`/`data.id` → `{"received":true,"outcome":"duplicate_ignored","stored":false}` (`payment_events` `23505`, `access_grants` permanece `1`).
- **Freshness:** `mercadopago-signature.ts:135` `Math.abs(now-tsMs) > windowMs` (`10min` prod / `10y` test) → `ts` expirado `11 anos → mismatch`.
- **Status `processed`:** `webhook-service.ts:132` `normalizedStatus !== 'approved' && !== 'processed' → status_not_approved`, `ab07f65a***` `grant_created` comprova `processed` aceito.

## 6. Evidência de banco

- **premium_orders:** `ab07f65a-...` `pending→paid` (`provider_order_id ORDTST...` `provider_external_reference ab07f65a...`).
- **premium_payments:** `PAY01...` `pending→confirmed` (`provider_status processed`/`accredited`, `provider_payment_id PAY01...`, `paid_at`).
- **payment_events:** `1` `order:ORDTST...:order.processed` `grant_created` `order_id ab07f65a...` `processing_status processed`.
- **access_grants:** `1` `source payment` `metadata.order_id ab07f65a...` `expires_at` preenchido.

## 7. Replay

- Primeiro webhook: `grant_created`
- Reenvio: `duplicate_ignored` (`stored:false`)
- `access_grants = 1` (idempotente, `grant_reused` não necessário pois `payment_events` dedupeou antes).

## 8. Segurança

- **HMAC `verified`** (`safeEqualHex` `timingSafeEqual`), **freshness** `10min`, **manifest** `id:{data_id};request-id:{request_id};ts:{ts};` via `buildManifest`.
- **IDOR bloqueado** (`userId` obrigatório + `eq user_id` + `404` idêntico).
- **Dedupe antes do `fetch`** (`webhook-service.ts:330` `shouldBePending = isOrder ? true : ...`, `orderId` resolvido **após** `dedupe` via `getMercadoPagoOrder` + `update payment_events set order_id`).
- **Status `processed` aceito** (`validateMpPayment`).

## 9. Regressão

- `npx tsc --noEmit → 0`
- `node --test tests/pix-*.test.js → 7/7 pass` (`pix-0112` incluído)
- `npm run build → 44/44`
- `git diff --check → 0` (LF warnings)

## 10. Production

**PIX NÃO está ativo em Production.**

`npx vercel env ls` → Production: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` apenas; **nenhum** `PIX_ENABLED`/`MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET`/`PIX_E2E_PLAN_CODE` em `target: production` (só `Preview` `Hidden Sensitive`).

## 11. Limitação da homologação

Não foi possível criar um novo usuário/pedido E2E nesta sessão porque o `signup` está desabilitado (`422 signup_disabled`) e o `SUPABASE_SERVICE_ROLE_KEY` estava mascarado/indisponível para criação administrativa (`decrypted:false`). A homologação reutilizou o pedido E2E `ab07f65a-ae2e-475f-949e-8baf60e315f0` já existente, executando novamente o fluxo de `webhook`/`grant` na Preview `92c1074` (`ke76kou45`).

Não apresentado como novo pedido independente.

## 12. Conclusão

Fluxo PIX pós-hardening homologado em Preview `92c1074` (`ke76kou45`):

```
verified → processed → paid → confirmed → grant_created
```

com `1` `access_grant` e replay `duplicate_ignored` idempotente. Production sem PIX.

