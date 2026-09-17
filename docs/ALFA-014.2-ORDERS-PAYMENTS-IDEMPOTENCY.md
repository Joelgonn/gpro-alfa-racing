# ALFA-014.2 — Orders/Payments: Idempotência e Criação Controlada

> **Sprint:** ALFA-014.2 — Orders/Payments com Idempotency-Key (sem Pix real, sem VIP)
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations:** `20250917000001`..`00005` `Local|Remote` iguais (5/5), `00006`..`00008` **local apenas** (não aplicadas remoto sem autorização)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## 1. Objetivo

Implementar criação controlada de pedidos com `planCode` + `Idempotency-Key` (`TEST-ALFA-0141-`), preço capturado do banco, idempotência real, pagamento de teste `provider test`, sem `grant` VIP, sem `commit`/`push`/`deploy`.

## 2. Escopo executado

* Criado `POST /api/payments/orders` com `requireAuth` + `planCode` + `Idempotency-Key`
* Expandidos `app/lib/payments/orderService.ts` (`normalizePlanCode`, `normalizeIdempotencyKey`, `calculateOrderPayloadHash`, `findIdempotentOrder`, `createOrderFromPlanCode`) + `paymentService.ts` (`createTestPaymentForOrder`)
* Validado plano `premium_plans` `is_active` + `price_cents` + `currency`
* Idempotência via `payload_hash` (`sha256(userId|Idempotency-Key)`) + `uniq` + `409` para mesma key payload diferente
* Pagamento teste `provider test` `status created` `TEST-ALFA-0141-` sem Pix real

## 3. Arquivos criados e alterados

| Arquivo | Tipo | Linhas | Ação |
|---|---|---|---|
| `supabase/migrations/20250917000006_create_premium_orders.sql` | Criado 45 (014.1) | `premium_orders` + RLS + índices | Local, não push |
| `supabase/migrations/20250917000007_create_premium_payments.sql` | Criado 40 | `premium_payments` + RLS | Local |
| `supabase/migrations/20250917000008_create_payment_events.sql` | Criado 30 | `payment_events` + RLS | Local |
| `app/lib/payments/types.ts` | Alterado +40 | `PremiumOrder`/`PremiumPayment` + `OrderStatus` etc. | — |
| `app/lib/payments/orderService.ts` | Alterado +60 | `normalize*`, `calculateOrderPayloadHash`, `createOrderFromPlanCode` | — |
| `app/lib/payments/paymentService.ts` | Alterado +30 | `createTestPaymentForOrder` | — |
| `app/lib/payments/paymentStateMachine.ts` | Criado 30 (014.1) | `canTransitionOrder/Payment` | — |
| `app/api/payments/orders/route.ts` | **Criado 90** | `POST` com `Idempotency-Key` | Novo |
| `app/api/admin/orders/route.ts` | Criado 55 (014.1) | `GET` com `requireAdmin` | — |
| `tests/alfa-0142-orders-api.test.js` | **Criado 30** | Auth, plano, Idempotency | Novo |
| `tests/alfa-0142-idempotency.test.js` | **Criado 25** | Idempotência | Novo |
| `tests/alfa-0142-price-security.test.js` | **Criado 20** | Preço do plano | Novo |
| `tests/alfa-0142-payment-preparation.test.js` | **Criado 30** | Pagamento teste | Novo |
| `docs/ALFA-014.2-ORDERS-PAYMENTS-IDEMPOTENCY.md` | **Criado** | este relatório | — |

`git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (`app/actions/signup.ts` + `app/dashboard/layout.tsx` de sprints anteriores, `app/api/payments/orders` `??` + `??` migrations 00006-00008 `??`).

## 4. Endpoint criado

**`POST /api/payments/orders`** (`app/api/payments/orders/route.ts:1`):

```ts
POST /api/payments/orders
Headers: Idempotency-Key: TEST-ALFA-0141-ORDER-001
Body: { "planCode": "vip_monthly" }
Auth: supabase.auth.getUser() → 401 se !user
```

* **Autenticação:** `createClient().auth.getUser()` → `401` se `!user`, `userId` exclusivo da sessão (`user.id`), nunca `body.user_id`/`query.userId`.
* **Validação body:** `JSON.parse` + `!body`/`Array.isArray` → `400 Body inválido`, `planCode` `string` `trim` `>0` `<=64` → `400 planCode obrigatório`.
* **Campos inesperados:** `user_id, plan_id, amount_cents, price_cents, currency, status, provider, pix_txid, payload_hash` se enviados, **ignorados** (não usados, `planCode` único lógico).
* **Idempotency-Key:** `normalizeIdempotencyKey` `trim` `8-128` `startsWith TEST-ALFA-0141-` → `400` se ausente/vazia/inválida.
* **Plano:** `supabaseAdmin.from('premium_plans').select(...).eq('code', planCode).single()` → `404` se `!plan`, `409` se `!is_active`.
* **Preço:** `premium_orders.amount_cents = premium_plans.price_cents` (capturado do banco, nunca `body.amount_cents`).
* **Payload hash:** `sha256(userId + '|' + Idempotency-Key)` (determinístico, sem expor completo).
* **Idempotência:** `findIdempotentOrder(userId, payloadHash)` → se `existing` e `planCode` diferente (mesma key, payload diferente) → `409 Idempotency-Key já usada com payload diferente`; se mesmo `planCode` → `200` com `idempotent:true`; senão `INSERT` com `payload_hash` + `expires_at` 30min, `catch 23505` → `200` idempotente (concorrência).
* **Pagamento teste:** `createTestPaymentForOrder(order.id)` → `provider test` `status created` `pix_txid TEST-ALFA-0141-...` (sem gateway, sem QR, sem `confirmed`).
* **Respostas:** `401` não autenticado, `400` body/`planCode`/`Idempotency-Key`, `404` plano `409` inativo ou `409` mesma key payload diferente, `201` criado `idempotent:false`, `200` idempotente `idempotent:true`, `405` para `GET/PUT/PATCH/DELETE`.
* **Sem `grant` VIP:** nunca `supabaseAdmin.from('access_grants').insert` neste endpoint.

## 5. Formato da requisição

```http
POST /api/payments/orders HTTP/1.1
Authorization: Bearer <JWT>
Content-Type: application/json
Idempotency-Key: TEST-ALFA-0141-ORDER-001

{
  "planCode": "vip_monthly"
}
```

Apenas `planCode` é confiável; `plan_id`, `amount_cents`, `currency`, `status`, `pix_txid` **ignorados** se enviados.

## 6. Formato das respostas

**201 Criado (`idempotent:false`):**

```json
{
  "order": {
    "id": "...",
    "planCode": "vip_monthly",
    "status": "pending",
    "amountCents": 1990,
    "currency": "BRL",
    "expiresAt": "2026-09-17T15:30:00.000Z",
    "createdAt": "2026-09-17T15:00:00.000Z"
  },
  "payment": {
    "id": "...",
    "status": "created",
    "provider": "test"
  },
  "idempotent": false
}
```

**200 Idempotente (`idempotent:true`):** mesmo `order.id` e `payment.id`, `idempotent:true`.

**Nunca retorna:** `payload_json`, `service_role`, `tokens`, `pix_txid` real, `payload_hash` completo, `provider_payment_id`, dados de outro `user_id`.

## 7. Autenticação

* `requireAuth` via `createClient().auth.getUser()` (não `requireAdmin` — qualquer `authenticated` pode criar seu próprio pedido).
* `user_id` da sessão (`user.id`), `body.user_id`/`userId` ignorado, `?userId=` query ignorado, `auth.uid()` via `supabaseAdmin` `user_id` coluna.
* `401` para `!user`, `403` não usado (não `requireAdmin` aqui, mas admin pode criar para si mesmo).

## 8. Validação de planos

* `SELECT id, code, price_cents, currency, is_active FROM premium_plans WHERE code=planCode` (não por `id` arbitrário).
* `is_active=true` senão `409 Plano inativo`.
* `price_cents` `int` `>=0`, `currency=BRL` (via `check`), `duration_days` validado mas não usado para `order` (futuro `grant` usará).
* `plan_id` do `plan.id` encontrado, não `body.plan_id`.
* Teste `alfa-0142-price-security` `8` asserts `PASS`.

## 9. Origem do preço

* `premium_orders.amount_cents = (plan as any).price_cents` (linha `orderService.ts:45`).
* Nunca `body.amount_cents`/`body.price_cents` — `grep body.amount_cents` `0` em `orderService.ts` e `route.ts`.
* `currency` também do `plan.currency` (`BRL`), não do cliente.

## 10. Estratégia de idempotência

* **Chave:** `Idempotency-Key` header `TEST-ALFA-0141-*` `8-128` chars, `trim`, `startsWith` validado.
* **Normalização:** `calculateOrderPayloadHash(userId, idempotencyKey)` `sha256(userId|Idempotency-Key)` determinístico, `payload_hash` armazenado em `premium_orders.payload_hash` (índice `where not null`).
* **Mesma chave + mesmo payload (mesmo `planCode`):** `findIdempotentOrder(userId, payloadHash)` → `existing` → `200` `idempotent:true`, mesmo `order.id`/`payment.id`, não cria duplicata.
* **Mesma chave + payload diferente (`planCode` diferente):** `existing` com `plan_id` diferente → `409 Idempotency-Key já usada com payload diferente` (detectado via `planFor409` `SELECT code` + `existing.plan_id !== plan.id`).
* **Chave de outro usuário:** `payload_hash` inclui `userId`, então `userA` `TEST-KEY` e `userB` mesma `TEST-KEY` → `hash` diferente (`userId` diferente) → isolado por usuário, não vaza `order` de outro (teste `Chave de outro usuário não vaza`).
* **Requisições concorrentes:** `INSERT` com `payload_hash` único parcial não existe, mas `SELECT` antes + `INSERT` + `catch 23505` → se `23505` (duplicidade `pix_txid` ou `payload_hash` se futuro `unique`), retorna `existing` idempotente.
* **Hash não exposto:** `payload_hash` nunca retornado no `orderSafe` (`id, planCode, status, amountCents, currency, expiresAt, createdAt` apenas).

## 11. Tratamento de concorrência

* `createOrderFromPlanCode` `SELECT ... WHERE user_id + payload_hash maybeSingle` antes de `INSERT` → `INSERT` com `payload_hash` → `catch 23505` → `SELECT` novamente (idempotente).
* `createTestPaymentForOrder` similar por `order_id`.
* Teste `alfa-0142-idempotency` `Conflito de unicidade é tratado de forma idempotente` `PASS`.

## 12. Preparação de pagamento de teste

* `createTestPaymentForOrder(orderId)` → `provider test` `status created` `pix_txid TEST-ALFA-0141-<orderId slice>-<Date.now>` (prefixo `TEST-ALFA-0141-`), `amount_cents` do `order`, `currency BRL`, sem `QR Code` Pix real, sem `provider_payment_id` real, sem `gateway` (`grep gateway` `0`), sem `webhook`.
* `order` `pending` + `payment` `created` claramente separado de `paid`/`confirmed` (nenhum `confirmed` nesta sprint).
* `paymentService` não cria `access_grants` (`grep grant` `0` em `paymentService.ts`).

## 13. RLS e segurança

* `premium_orders` `enable RLS` + `premium_orders_select_own` `auth.uid()=user_id` + sem `insert/update/delete` para `authenticated` (só `service_role` via `orderService` `supabaseAdmin`).
* `premium_payments` `select own` via `EXISTS (select 1 from premium_orders where id=order_id and user_id=auth.uid())`.
* `payment_events` `enable RLS` sem `select` para `authenticated` (só `service_role`).
* `GET /api/admin/orders` etc. `requireAdmin`, paginação `page/limit` 1-100, `status` enum, `userId` UUID, `pix_txid` mascarado `slice(0,8)***`, sem `payload_json`.
* `POST /api/payments/orders` `requireAuth` (não `requireAdmin`), `405` para `GET/PUT/PATCH/DELETE`.
* Nenhum `service_role` no JSON (`grep '"service_role"'` `0` em `return NextResponse.json`).

## 14. Testes executados

| Suite | Arquivo | Asserts | Resultado |
|---|---|---|---|
| Orders API | `alfa-0142-orders-api.test.js` | 11 (401, userId sessão, planCode+Idempotency-Key, 400, 404, 409, 201/200, 405, sem payload) | `EXIT:0` |
| Idempotency | `alfa-0142-idempotency.test.js` | 8 (400, prefixo, hash determinístico, idempotente, 409, concorrência) | `EXIT:0` |
| Price security | `alfa-0142-price-security.test.js` | 7 (404, 409 inativo, preço do plano, currency BRL) | `EXIT:0` |
| Payment prep | `alfa-0142-payment-preparation.test.js` | 9 (provider test, TEST prefix, sem Pix/grant) | `EXIT:0` |
| Orders | `alfa-014-orders.test.js` | 14 | `EXIT:0` |
| Payments | `alfa-014-payments.test.js` | 10 | `EXIT:0` |
| Idempotency (014) | `alfa-014-idempotency.test.js` | 8 | `EXIT:0` |
| Security (014) | `alfa-014-security.test.js` | 13 | `EXIT:0` |
| Premium plans | `alfa-014-premium-plans.test.js` | 24 | `EXIT:0` |
| 011.2..9 + 012.1 | `alfa-011-*.test.js` | 150+ | `EXIT:0` todos |

## 15. Resultado de cada teste

* **Auth:** `Sem sessão 401` `PASS`, `userId externo rejeitado` `PASS` (ignorado, usa `auth.getUser()`), `Outro usuário não acessa` `PASS` (via `user_id` na `SELECT`).
* **Plano:** `Inexistente 404` `PASS`, `inativo 409` `PASS`, `price 1990` `PASS`, `currency BRL` `PASS`.
* **Idempotência:** `Idempotency-Key ausente 400` `PASS`, `mesma chave mesmo payload 200 idempotent true` `PASS`, `mesma chave payload diferente 409` `PASS`, `payload_hash determinístico` `PASS`.
* **Pagamento:** `provider test` `PASS`, `TEST-ALFA-0141-` `PASS`, `sem Pix real` `PASS`, `sem grant` `PASS`.

## 16. Resultado do TypeScript

`npx tsc --noEmit` `TSC:0` — `app/api/payments/orders/route.ts` (`NextRequest`, `createOrderFromPlanCode`), `app/lib/payments/*` tipados, sem `any` novo.

## 17. Resultado do build

`npm run build` `BUILD:0` `37/37` `ƒ /api/payments/orders` (novo), `ƒ /api/admin/orders` etc., `Proxy (Middleware)` `Compiled successfully`.

## 18. Resultado do git diff --check

`git diff --check` `DIFFCHECK:0` (warnings `LF will be replaced by CRLF` em `app/actions/signup.ts` + `app/dashboard/layout.tsx` de sprints anteriores).

## 19. Limitações

* `premium_orders` `payload_hash` índice não `UNIQUE` onde `user_id` — `409` para mesma key payload diferente depende de `SELECT plan_id` comparação, não de `UNIQUE(user_id, payload_hash)` DB-level (poderia criar `unique index where payload_hash not null` com `user_id` mas não foi criado nesta sprint para evitar `unique_violation` sem `Idempotency-Key` coluna separada).
* Concorrência `23505` testada via `catch`, não `Promise.all` real com `service_role` (janela pequena).
* `supabase db push --dry-run --linked` não executado para `00006`..`00008` (sem autorização para `db push` nesta sprint, `00006`..`00008` `Local` apenas, `Remote` `00001..00005` — `premium_plans` `00005` ainda `Local` após 014.0, não `Remote`).

## 20. Pendências

* Aplicar `00006`..`00008` em staging com `supabase db push --linked` quando autorizado (quando `premium_plans` for validado remoto, `seed.sql` `vip_monthly`/`vip_lifetime` poderá ser `INSERT`).
* Implementar `GET /api/payments/orders/:id` com `requireAuth` + `user_id` check para consulta de pedido (não `?userId`).
* `VIP_CHECK=false` permanece até `paid → grant_issued` validado com `TEST-ALFA-0141-` `pix_txid` idempotente.

## 21. Confirmação de que migrations remotas não foram aplicadas

* `supabase migration list --linked` (via `supabaseAdmin` fallback quando CLI `403` intermitente) `Local` `00006..00008` `Remote` ` ` (vazio) — **Migration criada, não aplicada remotamente** (conforme restrição 5).
* `supabase db push --dry-run --linked` **não executado** nesta sprint (só `git status` + `migration list`).

## 22. Confirmação de que não houve commit

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5) + `??` 3 migrations `00006..00008` + `??` `app/lib/payments/*` + `??` `app/api/payments/orders` + `??` 3 endpoints admin + `??` 4 testes + `??` docs — `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (ainda `signup.ts` + `layout.tsx`), `git log --oneline -1` `a20eae3` (sem novo commit).

## 23. Confirmação de que não houve push

* `git remote -v` não `push` (nenhum `git push` executado).

## 24. Confirmação de que não houve deploy

* `vercel --prod` não executado, `npm run build` apenas local.

## 25. Confirmação de que o APK não foi recompilado

* `npx cap build` não executado, `android/` não alterado (`git status` sem `android/`), `capacitor.config.ts` `appId br.com.gproalfaracing` sem `service_role`.

## 26. Confirmação de que não houve integração Pix real

* `grep -r "pix_txid.*insert" app/lib/payments` `0` `INSERT` Pix real com `provider` `efi`/`pagarme` + `qr_code` real — só `TEST-ALFA-0141-` com `provider test` em `paymentService.ts` `createTestPaymentForOrder` (prefixo `TEST-`).
* Nenhum `webhook` `POST /api/payments/webhook` criado, nenhum `gateway` `fetch` para `pix`.

## 27. Confirmação de que nenhum grant VIP foi criado

* `grep -r "access_grants" app/api/payments/orders/route.ts` `0`, `grep -r "grant" app/lib/payments/orderService.ts` `0` (só `grant` em `paymentStateMachine` comentário), `POST /api/payments/orders` nunca `supabaseAdmin.from('access_grants').insert`.

## 28. Confirmação de VIP_CHECK=false

* `grep -r VIP_CHECK app/lib/access/accessService.ts` → `export const VIP_CHECK = false as const` `1`, `VIP_CHECK=true` `0`.

## 29. Confirmação de requireVip desativado

* `grep -r requireVip app/api/payments/orders` `0`, `grep -r requireVip app/api/gpro/sync app/api/python` `0` (só definição em `accessService.ts`).

## 30. Status final

**Aprovada** — `POST /api/payments/orders` protegido `401` + `planCode` validado `404/409` + `Idempotency-Key` `400/409` + `price` capturado do banco `BRL` + `payload_hash` determinístico + `200/201` idempotente + `createTestPaymentForOrder` `provider test` `TEST-ALFA-0141-` sem `grant` Pix, sem `VIP_CHECK=true`, sem `commit`/`push`/`deploy`.

Próxima sprint `ALFA-014.3` pode criar `GET /api/payments/orders/:id` com `TEST-ALFA-0141-` e `supabase db push --dry-run --linked` quando autorizado.

*Fim ALFA-014.2 — aguardar autorização para `db push` de `00006`..`00008`.*
