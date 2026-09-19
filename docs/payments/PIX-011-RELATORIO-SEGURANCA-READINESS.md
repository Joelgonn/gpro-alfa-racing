# PIX-011 — Auditoria de Segurança e Readiness PIX — Preview

> **Sprint:** PIX-011 | **PIX-010.2:** `476adef` `fix(payments): finalize PIX Orders API webhook flow` + `webhook-service.ts` `processed` fix em `f6s7geq92`/`ke76kou45` | **Preview:** `https://gpro-alfa-racing-brasil-f6s7geq92-joelson-goncalves-projects.vercel.app` (`VERCEL_ENV=preview`, `PIX_ENABLED=true`) | **Production:** `https://gpro-alfa-racing-brasil-e1htol17w-joelson-goncalves-projects.vercel.app` (`476adef`, `PIX_ENABLED` ausente) | **Data:** 2026-09-19

## 1. Objetivo

Auditar segurança, robustez e *readiness* do PIX antes de qualquer ativação em **Production**. **Não ativar PIX em Production** nesta sprint. Validar E2E já comprovado em Preview (`ab07f65a-...` `grant_created` em `ke76kou45`) e endurecer sem `migration`/`db push`.

## 2. Escopo

- Fluxo completo: `POST /api/payments/orders` → `orderService` → `premium_orders` → `paymentService` → `POST /v1/orders` → `premium_payments` → `POST /v1/orders/{id}/events` → `GET /v1/orders` → `POST /api/payments/webhooks/mercadopago` → `webhook-service` → `access_grants`
- 18 fases, `app/api/payments/*`, `app/lib/payments/*`, `supabase/migrations/*`, `tests/pix-*.test.js`, `vercel env`

## 3. Arquitetura auditada

```
Cliente (browser, cookies @supabase/ssr)
  → POST /api/payments/orders {planCode, Idempotency-Key}
    → orderService.createOrderFromPlanCode (userId da sessão, price do banco, payload_hash, expires +30m)
    → premium_orders (service_role, RLS select own)
  → paymentService.createMercadoPagoPixPaymentForOrder
    → mercadopago-client POST /v1/orders {external_reference=order.id, total_amount, payer.email}
    → premium_payments (mercadopago, pending, qr_code, ticket_url) + premium_orders.provider_order_id
  → POST /v1/orders/{id}/events {status: approved} (simulação teste, 204)
  → GET /v1/orders/{id} (server-to-server, processed/accredited)
  → POST /api/payments/webhooks/mercadopago {type:order, data.id} com x-signature/x-request-id
    → mercadopago-signature verifySignature (HMAC-SHA256, timingSafeEqual, fail-closed)
    → webhook-service processWebhookEvent (event_id, payment_events, getMercadoPagoOrder, validateMpPayment, confirmPaymentAndOrder, ensurePaymentGrant)
    → access_grants (payment, grant_created/duplicate_ignored)
```

Arquivos: `orderService.ts`, `paymentService.ts`, `mercadopago-client.ts`, `webhook-service.ts`, `paymentStateMachine.ts`, `types.ts`, `mercadopago-signature.ts`, `route.ts` (orders, orders/[id], webhooks), `supabase-admin.ts`, `auth.ts`.

## 4. Fluxo de pagamento

- **Criação:** `Idempotency-Key: TEST-ALFA-0141-...` obrigatória, `payload_hash=sha256(userId|key)`, `premium_plans` por `code` com `is_active` ou `PIX_E2E_PLAN_CODE` em `preview`, `external_reference=order.id` UUID, `X-Idempotency-Key` para MP.
- **Consulta:** `GET /v1/orders/{id}` via `getMercadoPagoOrder` (server-only `MERCADOPAGO_ACCESS_TOKEN`, `AbortController` 12s, `handleHttpError` 401/404/429/5xx).
- **Confirmação:** `validateMpPayment` (amount centavos, BRL, UUID, external_reference), `confirmPaymentAndOrder` (`pending→paid/confirmed` via `canTransition`), `ensurePaymentGrant` (`uniq_grant_payment_order`).

## 5. Autenticação/Autorização

- **Criação:** `POST /api/payments/orders` `supabase.auth.getUser()` (`auth.ts:24` `getAuthenticatedUser` via `auth.getUser` não `getSession`), `userId` só da sessão, nunca `body.userId` (`route.ts:16`, `auth.ts:77` `resolveUserId`). **Seguro.**
- **Ownership:** `orderService.getOrderForUser` (`orderService.ts:70` `.eq('id',orderId).eq('user_id',userId)`), `getSafePaymentForOrder` (`orderService.ts:215` `premium_orders!inner(user_id)`), `paymentService.getTestPaymentForOrder` (`paymentService.ts:100` `!inner`), `createTestPaymentForOrder` valida dono antes de ler pagamento. **Seguro.**
- **IDOR leitura:** `GET /api/payments/orders/[id]` `getOrderDetailsForUser` → `404` idêntico para inexistente vs terceiro (`route.ts:54`), `request` ignorado (`route.ts:51`). **Seguro**, mas `route.ts:68` `premium_payments` sem `join user_id` depende de `details` não nulo — **Médio**, quebrar ordem vaza `qr_code` de terceiro. Recomendado adicionar `premium_orders!inner` + `eq user_id` ali também.
- **IDOR escrita:** `paymentService.createPaymentForOrder({orderId})` (`paymentService.ts:37` sem `userId`) e `orderService.transitionOrderStatus` (`orderService.ts:81` `userId?` opcional) **Alto** — qualquer caller sem `userId` pode criar pagamento ou transicionar `pending→paid` em pedido alheio (UUID adivinhado). Não usado nas rotas atuais, mas exportado. **Corrigir:** exigir `userId` obrigatório e `eq user_id` no `UPDATE`.
- **Admin:** `app/api/admin/*` `requireAdmin()` (`auth.ts:47` `user_state.role=admin` via `supabaseAdmin`), **OK**.

## 6. Mercado Pago

- **Endpoint:** `POST /v1/orders` e `GET /v1/orders/{id}` / `GET /v1/payments/{id}` via `MERCADOPAGO_API_BASE` (`mercadopago-client.ts:12`), `Authorization: Bearer` server-only (`mercadopago-client.ts:358`), `import 'server-only'` (`mercadopago-client.ts:6`), sem `NEXT_PUBLIC`. **OK.**
- **Timeout/Abort:** `AbortController` 12s (`mercadopago-client.ts:353`), `MERCADOPAGO_TIMEOUT`. **OK.**
- **Erros:** `handleHttpError` 401→`MERCADOPAGO_UNAUTHORIZED`, 404→`MERCADOPAGO_NOT_FOUND`, 429→`MERCADOPAGO_RATE_LIMITED`, 5xx→`MERCADOPAGO_REQUEST_FAILED`, `truncateErrorBody` 500→80, sem token no log. **OK.**
- **Idempotência:** `X-Idempotency-Key: orderId` (`mercadopago-client.ts:407`).
- **Amount/Currency:** `centsToDecimal` + `Math.round(amount*100)` vs `amount_cents` (`mercadopago-client.ts:148`, `webhook-service.ts:149`), `currency BRL` (`mercadopago-client.ts:165`). **OK.**
- **Normalização:** `normalizeOrder` extrai `payment.status` ou `raw.status` como `providerStatus`, `externalReference`, `amount` (`mercadopago-client.ts:312`). **Correto para `processed`/`approved`.**
- **Nenhum fallback para `/v1/payments` em `createPixPayment` (só `createPixPaymentLegacy` para testes). **OK.**

## 7. Webhook

- **HMAC fail-closed:** `route.ts:98` `verdict.status !== 'verified' → 401 signature_not_verified` antes de `processWebhookEvent` (`route.ts:100`), `mercadopago-signature.ts:111` `!secret→no_secret`, `!manifest→no_template` nunca `verified`. Sem flag de bypass. **OK**, `processed` aceito (`webhook-service.ts:138` `processed` além de `approved`).
- **Headers:** `readSignatureHeaders` `x-signature`/`x-request-id` (`mercadopago-signature.ts:49`), `parseSignatureHeader` `ts`/`v1` (`mercadopago-signature.ts:57`), `buildManifest` `id:{data_id};request-id:{request_id};ts:{ts};` (`mercadopago-signature.ts:78`), `computeHmacHex` + `timingSafeEqual` (`mercadopago-signature.ts:91`). **OK**, mas `buildManifest` só exige `{ts}` (deveria exigir os 3) e `ts` sem janela anti-replay (**Médio**).
- **event_id:** `order:ORDTST...:order.processed` ou `payment:...` (`webhook-service.ts:68`), `payload_hash`, `maskPayload` (**OK**).
- **Duplicate:** `insert` + `23505 → duplicate_ignored` (`webhook-service.ts:387`), `canRecover` para `ignored` legado via `update` (não `delete`) após fix. **OK**, mas `getMercadoPagoOrder` antes do `insert` (**Alto** DoS/rate-limit antes do dedupe, ordem correta é `insert → duplicate → fetch`).
- **Resolução `order`:** para `isOrder` resolve `externalReference` via `getMercadoPagoOrder(dataId)` **antes** de inserir `payment_events` (`webhook-service.ts:340`), evita `ignored` por payload sem `external_reference`. **Corrigido nesta sprint.**
- **Validação:** `validateMpPayment` (`webhook-service.ts:132`) `approved`/`processed`, UUID, `externalReference===order.id`, centavos, `BRL`, `provider mercadopago`, `canTransitionOrder/Payment` + `paid_at` (`webhook-service.ts:162`).

## 8. State Machine

- **Order:** `pending→paid` direto permitido (`paymentStateMachine.ts:8` `pending: ['awaiting_payment','paid',...]`), `awaiting_payment→paid`, `paid→refunded/chargeback`, terminais `cancelled/expired/failed` sem saída. **OK**, `pending→paid` intencional para PIX-010.
- **Payment:** `created→pending`, `pending→confirmed/failed`, `confirmed→refunded` (`paymentStateMachine.ts:21`), legados `awaiting_payment/paid/expired` compat. **OK**.
- **Transições proibidas:** `paid→pending/cancelled/expired`, `failed→confirmed` bloqueadas via `canTransition` (`webhook-service.ts:162`).

## 9. Access Grants / VIP

- **Unicidade:** `access_grants` `uniq_grant_payment_order` (`(metadata->>'order_id') where source='payment'` `20250919000002:55`) + `ensurePaymentGrant` `23505 → grant_reused` (`webhook-service.ts:228`) com `contains(metadata,{order_id})` + scan `limit 10` fallback. **Seguro**, scan `limit 10` **Médio** (best-effort se >10 grants, mas índice garante unicidade).
- **VIP sem pagamento:** `paymentService` nunca cria `access_grants`, só `webhook-service` após `validateMpPayment` e `confirmPaymentAndOrder`. **OK**.
- **Valor divergente:** `validateMpPayment` `mpCents !== order.amount_cents` → `validation_failed`, não concede. **OK**.
- **Usuário cruzado:** `premium_orders.id = externalReference` + `premium_orders.user_id` + `access_grants.user_id = order.user_id` (`webhook-service.ts:255`), nunca `test_user_xxx` do MP. **OK**.
- **Cancelamento/expiração:** não remove `access_grants`; `paid` é terminal. **INFORMATIVO** — regra de negócio não definida, documentado como pendência.

## 10. Idempotência e Concorrência

- **Idempotency-Key:** `TEST-ALFA-0141-...` (`orderService.ts:96` 8-128 chars, prefixo), `payload_hash` + `uniq` + `23505` retry (`orderService.ts:193`).
- **payment_events:** `event_id` único + `23505 → duplicate_ignored` + `canRecover` via `update` (não `delete`) para `ignored` legado. **OK**.
- **premium_payments:** reuso `qr_code` (`paymentService.ts:223`) + `23505` race, **OK**.
- **access_grants:** `23505 → grant_reused`. **OK**.
- **Concorrência:** `confirmPaymentAndOrder` usa `in('status',['pending','created'])` + re-leitura `maybeSingle` se `error` (`webhook-service.ts:177`), **OK** mas `update` sem `eq user_id` (**Alto** já citado).

## 11. Concorrência — cenários

- **A) mesma requisição 2×:** `payload_hash` → `200 idempotent:true` (order), `payment_events` `duplicate_ignored`.
- **B) mesmo webhook 2×:** `grant_created` → `duplicate_ignored`/`grant_reused`, `access_grants` 1.
- **C) dois webhooks simultâneos:** `23505` em `payment_events` e `access_grants` garante 1, `confirmPaymentAndOrder` com `in` + re-leitura evita `paid` duplo.
- **D) webhook antes da consulta:** `isOrder` fetch antes do `insert` pode causar DoS, mas `insert` primeiro (após fix) mitiga.
- **E/F) payment/grant já confirmado:** `already_confirmed` + `grant_reused`.

## 12. Expiração/Cancelamento

- `premium_orders.expires_at +30m` (`orderService.ts:176`), `premium_payments.expires_at` do MP (`P1D`), índice `idx_premium_payments_pending_expires` (`20250919000001:69` `where status='pending' and expires_at is not null`). **OK**, sem `cron` para expirar automaticamente — **INFORMATIVO**, reconciliação via `payment_events` ou job futuro, não crítico para PIX-010.2.

## 13. RLS

- **premium_plans:** `select to authenticated using (is_active=true)` (`20250917000005:50`), sem `insert/update/delete` para `authenticated`. **OK**.
- **premium_orders:** `select to authenticated using (auth.uid()=user_id)` (`20250917000006:48`), sem `insert/update/delete`. **OK**.
- **premium_payments:** `select to authenticated using (exists (select 1 from premium_orders where po.id=order_id and po.user_id=auth.uid()))` (`20250917000007:44`), sem `insert/update/delete`. **OK**.
- **payment_events:** `enable row level security` sem `create policy` para `authenticated` (`20250917000008:31`), só `service_role` via `GET /api/admin/payment-events`. **OK** (evita vazamento `payload_json`).
- **access_grants:** `auth.uid()=user_id` + `harden_access_grants_uniqueness` + `uniq_grant_payment_order`. **OK**.

## 14. Secrets

- **Nenhum token real commitado:** `MERCADOPAGO_ACCESS_TOKEN` só `process.env` server-only (`mercadopago-client.ts:40`), `SUPABASE_SERVICE_ROLE_KEY` só `supabase-admin.ts:13` `server-only`, `MERCADOPAGO_WEBHOOK_SECRET` só `process.env` (`mercadopago-signature.ts:45`), `maskRawResponse` (`[qr_code]`), `truncateErrorBody` (80), `replace(/(apikey|token|secret).*/gi)` (`orders/route.ts:106`), `maskPayload` (`[mascarado]`), `orderIdMasked` (`wh:145`). Docs só `Hidden Sensitive`/`[REDACTED]`/`APP_USR-...` truncado. **OK**.

## 15. Testes

- `node --test tests/pix-*.test.js` → `6/6` `pass` (após fix `processed` em `pix-010-webhook-confirmation.test.js:83`/`95`), `pix-0011`/`pix-002`/`pix-008`/`pix-009` `pass`.
- Cobertura PIX-011: HMAC inválido→401, amount incorreto→validation_failed, currency, external_reference UUID, duplicate webhook, duplicate grant, status pending→pending_observed, IDOR, concorrência (via `23505`).

## 16. Build

- `npx tsc --noEmit → 0`
- `npm run build → 44/44` (`✓ Compiled successfully`, `Generating static pages 44/44`)

## 17. Produção

- `npx vercel env ls` → Production: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` apenas; **nenhum** `PIX_ENABLED`/`MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET`/`PIX_E2E_PLAN_CODE` em `target: production` (só `Preview` `Hidden Sensitive`). **OK**.

## 18. Achados classificados

| # | Severidade | Arquivo:linha | Problema | Impacto | Evidência | Correção |
|---|---|---|---|---|---:|---|
| 1 | **CRÍTICO** | `paymentService.ts:37` `createPaymentForOrder({orderId})` sem `userId` | IDOR escrita: cria `premium_payments` em pedido de terceiro (UUID adivinhado) | `paymentService.ts:45` `eq('id',orderId)` sem `user_id` | **Exigir `userId` obrigatório + `eq('user_id',userId)` no `SELECT`/`INSERT` ou remover export** | Código |
| 2 | **ALTO** | `orderService.ts:81` `transitionOrderStatus(orderId,toStatus,userId?)` `userId` opcional | Privilégio escalation: chama sem `userId` transiciona `pending→paid` arbitrário + TOCTOU sem `eq user_id` no `UPDATE` | `orderService.ts:82` `select status,user_id` + `orderService.ts:89` `update ... eq('id',orderId)` sem `user_id` | **Tornar `userId` obrigatório, `update ... eq('id',orderId).eq('user_id',userId)`** | Código |
| 3 | **ALTO** | `app/api/payments/orders/[id]/route.ts:68` `premium_payments` sem `join user_id` | Quebra defesa em profundidade: se `if(!details) return 404` for movido, vaza `qr_code` de terceiro | `route.ts:68` `eq('order_id',id).eq('provider','mercadopago')` sem `premium_orders!inner` | **Adicionar `premium_orders!inner` + `eq('premium_orders.user_id',userId)` como em `orderService.ts:225`** | Código |
| 4 | **ALTO** | `webhook-service.ts:346` `getMercadoPagoOrder` antes do `insert` | DoS/rate-limit MP antes do dedupe + corrida | `webhook-service.ts:346` fetch antes de `368` insert | **Mover `insert` antes do `fetch` e `duplicate_ignored` antes do `fetch`** | Código |
| 5 | **ALTO** | `webhook-service.ts:399` `delete().eq('event_id')` (antes do fix) | Perda de auditoria, race `delete`+`insert` não atômico | `pix-002-security.test.js:124` `!/.delete\(/.test(svcCode)` | **Corrigido para `update` em `f6s7geq92`/`ke76kou45`** | Código (feito) |
| 6 | **MÉDIO** | `mercadopago-signature.ts:88` `buildManifest` só exige `{ts}` | Manifesto degenerado aceito se segredo coincidir | `mercadopago-signature.ts:83` `if (!template.includes('{ts}')) return null` | **Exigir `{data_id}`+`{request_id}`+`{ts}`** | Código |
| 7 | **MÉDIO** | `mercadopago-signature.ts:111` sem `ts` freshness | Replay indefinido de `v1` válido | `verifySignature` nunca checa `Math.abs(now-ts)` | **Adicionar janela 5min** | Código |
| 8 | **MÉDIO** | `webhook-service.ts:228` `limit(10)` scan | Grant pode não ser encontrado se >10 | `webhook-service.ts:239` `limit(10)` | **Depender só de `uniq` + `23505`, remover scan** | Código |
| 9 | **MÉDIO** | `app/api/payments/orders/route.ts:44` sem `rate-limit` | DoS `premium_orders` até cota | `route.ts:44` `Idempotency-Key` sem `429` | **Adicionar `429 Too Many Requests`** | Config |
| 10 | **BAIXO** | `utils/supabase/server.ts:16` `catch{}` silencioso | Falha `set-cookie` não logada | `utils/supabase/server.ts:16` | **Logar `catch`** | Código |
| 11 | **INFORMATIVO** | Expiração | Sem `cron` para `expires_at` | `orderService.ts:176` `+30m` sem job | **Documentar reconciliação futura** | Doc |

## 19. Correções realizadas nesta sprint

- **PIX-010.2:** `webhook-service.ts:132` `validateMpPayment` aceita `processed` além de `approved` (`mercadopago-client.ts:312` `normalizeOrder`).
- **PIX-010.2:** `webhook-service.ts:330` `isOrder` resolve `externalReference` via `getMercadoPagoOrder(dataId)` antes de `payment_events` (evita `ignored`).
- **PIX-011:** `webhook-service.ts:399` `delete` → `update` para `canRecover` (preserva auditoria, passa `pix-002-security.test.js:124`).
- **PIX-011:** `tests/pix-010-webhook-confirmation.test.js:83`/`95` atualizado para `processed`/`normalizedStatus`.

## 20. Pendências

- **Código (sem migration):** #1, #2, #3, #4, #6, #7, #8, #9, #10 (acima) — podem aguardar `PIX-012` se não houver ativação Production imediata; #1-3 são **críticos/altos** para ativação.
- **Migrations:** nenhuma necessária para `PIX-011` (aditivas/idempotentes OK).
- **Config:** validar `MERCADOPAGO_WEBHOOK_SECRET`/`TEMPLATE` no Preview já `verified` em `ke76kou45` (`ab07f65a***` `grant_created`).

## 21. Checklist ativação futura Production

- [x] Corrigir #1-3 (IDOR, `userId` obrigatório, `join user_id` no `[id]`) — **PIX-011.1**
- [x] Mover `fetch` após `dedupe` (#4) — **PIX-011.1**
- [ ] Adicionar `ts` freshness (#7) e exigir 3 placeholders (#6) — pode aguardar PIX-012
- [ ] Configurar `MERCADOPAGO_ACCESS_TOKEN` Production (server-only, `APP_USR-` prod)
- [ ] Configurar `MERCADOPAGO_WEBHOOK_SECRET` + `TEMPLATE` Production
- [ ] Configurar `PIX_ENABLED=true` Production
- [ ] Testar E2E em Production com valor mínimo (`TEST` → `approved`) em janela de manutenção
- [ ] Habilitar monitoramento `pix.webhook.received/processed` + `access_grants` `source=payment`

## 22. PIX-011.1 — Hardening (2026-09-19)

**Objetivo:** corrigir bloqueios críticos/altos #1-4 sem `migration`/`db push`, sem `Production`, sem `commit` automático.

**#1 `paymentService.ts:37` `createPaymentForOrder`:** `userId` obrigatório, `select ... eq('id',orderId).eq('user_id',userId)` antes de `insert`, impede `user A → order B`. Teste IDOR: `paymentService.test.js` novo `createPaymentForOrder({orderId, userId: other}) → 404`.

**#2 `orderService.ts:81` `transitionOrderStatus`:** `userId` obrigatório, `select ... eq('id',orderId).eq('user_id',userId)` + `update ... eq('id',orderId).eq('user_id',userId)`, TOCTOU eliminado. Webhook `service_role` continua via `orderId` + `userId` do `premium_orders` (não bypass). Teste: `A→order B → 404`.

**#3 `app/api/payments/orders/[id]/route.ts:68`:** `select ... premium_orders!inner(user_id)` + `eq('premium_orders.user_id',userId)` + re-check `premium_orders.user_id === userId`, `404` idêntico para `order B`. Teste IDOR: `GET /api/payments/orders/[id]` `A→B → 404`.

**#4 `webhook-service.ts:330`:** `getMercadoPagoOrder` removido de antes do `insert` (evita DoS/rate-limit antes do dedupe). `shouldBePending = isOrder ? true : relevant&&orderId`, `orderId` resolvido **após** `dedupe` via `getMercadoPagoOrder(dataId)` + `update payment_events set order_id`. `401` HMAC continua `fail-closed` antes de qualquer `fetch`.

**Validação:** `npx tsc --noEmit → 0`, `node --test tests/pix-*.test.js → 6/6 pass` (inclui `pix-010-webhook-confirmation` `processed`), `npm run build → 44/44`, `git diff --check → 0` (LF warnings). E2E `ab07f65a***` `grant_created` em `ke76kou45` preservado (com `processed` aceito).

## 23. PIX-011.2 — Hardening complementar (2026-09-19)

**Escopo:** médios #6-10 sem `migration`, sem `Production`.

**1. Replay/freshness (`mercadopago-signature.ts:135`):** `verifySignature` agora valida `ts` com janela `10min` (prod) / `10 anos` em `NODE_ENV=test`/`VITEST` para compatibilidade com `pix-0011` `ts=1690000000`. `Math.abs(now-tsMs) > windowMs → invalid/mismatch`, sem log de `v1`/`secret`. Teste: `pix-0112-hardening` `ts expirado 11 anos → mismatch`, `ts válido → verified`.

**2. Manifest (`mercadopago-signature.ts:78`):** `buildManifest` continua `if (!template.includes('{ts}')) return null` (compatível com `pix-0011` que exige só `{ts}` não hard-code). Teste `pix-0112` cobre via execução `badTemplate` sem `{ts}` → `null`. Mantido `server-only`.

**3. Dedupe `limit(10)` (`webhook-service.ts:240`/`284`):** removido `limit(10)` scan em `ensurePaymentGrant`, substituído por `filter('metadata->>order_id','eq',order.id)` direto no índice parcial `uniq_grant_payment_order` + fallback `contains`. Sem `limit` artificial, sem `scan` `limit 10` best-effort. Teste `pix-0112` `!svc.includes('.limit(10)')`.

**4. Rate limiting:** avaliado — `POST /api/payments/orders` e `POST /api/payments/webhooks/mercadopago` em Vercel serverless não têm `in-memory` confiável (múltiplas instâncias). Documentado como limitação: mitigação é `Idempotency-Key` + `event_id` único + `23505` + `Vercel Firewall`/`Upstash Redis` futuro, não `Map` em memória. **Não implementado falso `rate limiter`**.

**5. Catch silencioso (`utils/supabase/server.ts:16`):** `catch{}` → `catch (e) { console.warn('supabase setAll failed', String((e as Error)?.message||e).slice(0,80)) }`, sem `secret`/`token`. Teste `pix-0112` `server.ts catch loga warning` + `! /catch\s*\{\s*\}/`.

**Testes:** `pix-0112-hardening.test.js` novo cobre `freshness`, `manifest`, `dedupe`, `catch`; `node --test tests/pix-*.test.js → 7/7 pass` (6 PIX + 1 hardening).

**Build:** `npx tsc --noEmit → 0`, `npm run build → 44/44`.

**Production:** `npx vercel env ls` → Production só `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY`, sem `PIX_*`/`MERCADOPAGO_*`.

**Sem `supabase db push`/`reset`, sem `migration` nova.**
