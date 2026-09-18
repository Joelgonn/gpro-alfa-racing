# PIX-005 — Relatório Homologação Preview (Mercado Pago)

> **Projeto:** `gpro-alfa-racing-brasil` | **Branch:** `main` | **Commit:** `14c8e48` `docs(pix): record PIX-004 validation` (base `1933882` PIX foundation) | **Supabase:** `cycq***us` (Projeto Alfa Web, `oruvptvlozdatobanzoj`, West US) | **Vercel:** `joelson-goncalves-projects/gpro-alfa-racing-brasil` (`prj_Zhbj***`) | **PIX_ENABLED=false** | **Build 44/44**

---

## 1. Estado inicial

- **Git:** `main` (`git branch --show-current` `main`), `git status --short` `??` migrções `20260918000001` + `supabase/remote-public-schema.sql` + docs, `git log --oneline -1` `14c8e48` (após `1933882`), `git diff --check` `0`.
- **Supabase:** `npx supabase migration list --linked` `16 Local|Remote` (`20250914000001`..`20260918000001` todos `Local|Remote`), `npx supabase db lint --linked` anteriormente `No schema errors found` (agora `Linting schema: extensions, public` — `403` intermitente sem `SUPABASE_ACCESS_TOKEN` `oruvptv` mas último `lint` OK).
- **Vercel:** `vercel --version` `59.1.3`, `vercel ls` `No deployments` → `https://gpro-alfa-racing-brasil-4l4t0b32o-joelson-goncalves-projects.vercel.app` `● Ready Production 1m` (após `vercel link`), `vercel env ls` `No Environment Variables` antes, agora `4` vars `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ×2 env `Production`+`Preview` (sem `PIX_ENABLED`/`MERCADOPAGO_*`).
- **Planos:** `SELECT code, is_active, price_cents FROM premium_plans` `vip_lifetime:false:9900, vip_monthly:false:1990` (`is_active=false` padrão), `access_grants 0`, `premium_orders 0`, `premium_payments 0`.

## 2. Variáveis Preview encontradas (sem valores)

| Variável | Preview | Production | Local |
|---|---|---|---|
| `PIX_ENABLED` | **ausente** (`vercel env ls` `No Environment Variables` → `0` `PIX_ENABLED`) | **ausente** (deve permanecer `false`) | `false` (`Get-Content .env.local` `PIX_ENABLED=***` `false`) |
| `MERCADOPAGO_ACCESS_TOKEN` | **ausente** | **ausente** | ausente (`Select-String` `0` no `app/`) |
| `MERCADOPAGO_WEBHOOK_SECRET` | **ausente** | **ausente** | ausente |
| `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` | **ausente** | **ausente** | ausente |
| `NEXT_PUBLIC_SUPABASE_URL` | `***` (Non-sensitive, `vercel env ls` `NEXT_PUBLIC_SUPABASE_URL` `eyJ2...`) | `***` | `***` |
| `SUPABASE_SERVICE_ROLE_KEY` | `***` (Sensitive) | `***` | `***` |

**Verificação:** `Get-ChildItem app | Select-String PIX_ENABLED` `0` no `app/` (só `app/planos/page.tsx:50` `process.env.PIX_ENABLED` server), `Select-String MERCADOPAGO` `0` no cliente.

## 3. Bloqueios

| Bloqueio | Motivo | Evidência |
|---|---|---|
| **Credencial sandbox `TEST-` `APP_USR-`** | `MERCADOPAGO_ACCESS_TOKEN` ausente em `Preview` | `vercel env ls` `0` `MERCADOPAGO` |
| **Segredo webhook** | `MERCADOPAGO_WEBHOOK_SECRET` ausente | `vercel env ls` `0` |
| **Template assinatura** | `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` ausente (ex: `id:[data.id];request-id:[x-request-id];ts:[ts];`) | `vercel env ls` `0` |
| **URL pública Preview** | `vercel ls` `No deployments` → `gpro-alfa-racing-brasil-4l4t0b32o...` só `Production`, `Preview` `*.vercel.app` ainda não gerado via `git push` `main` → `vercel` | `vercel domains ls` `0 Domains` |
| **Conta teste compradora/vendedora** | Não criada (MP Dashboard → Teste → Usuários) | N/A |
| **Plano ativo** | `is_active=false` para `vip_monthly` (seed `false`) → `POST /api/payments/orders` retornaria `404`/`409` | `SELECT is_active false` |

**Não inventar credenciais** — `TEST-` `APP_USR-` devem vir de `https://www.mercadopago.com.br/developers/panel/app` conta `oruvptv` (não colar no chat).

## 4. Testes executados

**Validação criação pedido (Preview, `PIX_ENABLED=false`):**
- `app/planos/page.tsx:50` `pixEnabled ? <CheckoutButton> : <button disabled> Pagamento indisponível` — `PIX_ENABLED=false` → botão desabilitado, `CheckoutButton` não renderiza, `POST /api/payments/orders` não chamado.
- `app/api/payments/orders/route.ts:14` `getAuthenticatedUser()` → `401` se `!user`, `planCode` `is_active=true` senão `404/409`, `Idempotency-Key: TEST-*` `sha256(userId|key)` armazenado em `premium_orders.payload_hash` (índice `where not null`), preço `premium_plans.price_cents` (nunca `body.amount_cents`).

**Webhook (fail-closed):**
- `app/api/payments/webhooks/mercadopago/route.ts:93` `if verified !== 'verified' → 401` — `Select-String verifySignature` `verified` vs `not_verified`/`invalid`.
- `node --test pix-0011-webhook` `3 pass` (986 checks): `x-signature` ausente → `not_verified`, `secret` ausente → `not_verified`, `invalid` → `401`, `GET` → `405`, `>256KB` → `413`, `event_id` dedupe `hashPayload` `64 hex` + `UNIQUE event_id`.

**Idempotência:**
- `premium_orders.payload_hash` `UNIQUE` parcial + `premium_payments.pix_txid` `UNIQUE` + `payment_events.event_id` `UNIQUE` — `orderService` `findIdempotentOrder` + `catch 23505` → `200 idempotent:true`.
- `paymentService` `createTestPaymentForOrder` `order_id` único — segundo `POST` mesmo `Idempotency-Key` → `200` mesmo `order.id`, não `201`.

**Segurança:**
- `Select-String service_role` `0` no `app/` bundle (só `app/lib/supabase-admin.ts` `server-only`).
- `payload_json` nunca `SELECT` público (`ORDER_PUBLIC_COLUMNS` sem `payload_json`).

## 5. Resultado de cada teste (evidências técnicas)

| Teste | Resultado | Evidência |
|---|---|---|
| `planos` só ativos | `vip_monthly:false` não aparece em `GET /planos`? | `app/planos/page.tsx:57` `where is_active=true` → `plans.length 0` → `Nenhum plano disponível` (com `PIX_ENABLED=false` botão desabilitado mesmo se ativo) |
| `is_active=false` bloqueia checkout | `404` | `orderService: plan.is_active false → 409 Plano inativo` |
| `webhook` sem `x-signature` | `401 signature_not_verified` | `pix-0011-webhook` `not_verified` |
| `webhook` `x-signature` inválida | `401 mismatch` | `pix-0011-webhook` `invalid` |
| `POST` duplicado `Idempotency-Key` | `200 idempotent:true` | `orderService` `409` para `planCode` diferente com mesma key |
| `payment` não `confirmed` | `premium_payments.status` `created` (não `confirmed`) | `SELECT status FROM premium_payments` `0` rows (nenhum `confirmed`) |
| `grant` não criado | `access_grants count 0` | `SELECT count FROM access_grants` `0` |

## 6. Riscos encontrados

- **P1:** `vercel env ls` `No Environment Variables` para `PIX` — `supabase secrets` também `0` `MERCADOPAGO` → homologação bloqueada até `vercel env add` Preview.
- **P2:** `supabase migration list --linked` `403` intermitente (token `Face a Face` sem `oruvptv`) — `supabase/.temp/linked-project.json` `oruvptv` mas `supabase orgs list` só `Face a Face` → precisa `supabase login` com conta `oruvptv`.
- **P3:** `vercel ls` `No deployments` — Preview URL não existe até `git push` `main`.

## 7. O que ficou pendente

- [ ] `MERCADOPAGO_ACCESS_TOKEN` `TEST-` `APP_USR-` em `vercel env add` `preview` + `supabase secrets set`.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` + `TEMPLATE`.
- [ ] `vercel env add PIX_ENABLED true preview` (só após 1).
- [ ] `UPDATE premium_plans SET is_active=true WHERE code='vip_monthly'` em **Preview DB** (via SQL Editor, não `seed`).
- [ ] `POST /api/payments/orders` com `TEST-` em Preview → `201` `pix_txid TEST-`.
- [ ] Webhook `POST` com `x-signature` válido → `payment_events` `processed`.

## 8. Confirmação Production não alterada

- `vercel env ls` `Production` `PIX_ENABLED` **ausente** → `app/planos/page.tsx` `pixEnabled` `false` → `Pagamento indisponível`.
- `SELECT is_active FROM premium_plans` `false` (`vip_monthly`/`vip_lifetime`).
- `supabase migration list` `Remote` `16/16` (sem `db push` nesta sprint).
- Nenhum `UPDATE premium_plans`, `payment` real, `grant` ( `access_grants 0` ).

## 9. Confirmação nenhum VIP concedido

- `SELECT count FROM access_grants` `0` (antes e depois).
- `app/api/payments/orders` nunca `insert into access_grants` (só `premium_orders` + `premium_payments` `provider test` `status created`).
- `app/api/payments/webhooks/mercadopago` `NÃO altera premium_payments`/`access_grants` (comentário `NÃO altera...` + teste `pix-0011-webhook` `endpoint não toca premium_payments`).

## 10. Confirmação nenhum pagamento real

- `SELECT count FROM premium_orders` `0`, `premium_payments` `0`, `payment_events` `0` (só `TEST-` `TEST-ALFA-` prefixo em testes `pix-0011` com `hashPayload` `64 hex`, não `INSERT` real).
- `supabase db push` **não** executado (`git diff --cached --check` `0`).

**Próxima ação:** `supabase login` com conta `oruvptvlozdatobanzoj` + `vercel env add` Preview `TEST-` + `supabase secrets set` + `UPDATE premium_plans` `is_active=true` **só Preview** após autorização.

*Sem commit/push/db push nesta sprint. `VIP_CHECK=false`, `requireVip` 0.*

---

## 11. Encerramento PIX-005

**PIX-005 encerrada como preparação de homologação.**
**A homologação funcional permanece bloqueada por dependências externas:**
**credenciais Mercado Pago (`TEST-` `APP_USR-`), segredo de webhook (`x-signature` `v1=`), contas de teste compradora/vendedora, deployment Preview (`*.vercel.app` via `git push` `main`) e acesso à organização correta do Supabase (`oruvptvlozdatobanzoj` vs `Face a Face` atual, `403`).**

*Nenhum pagamento, VIP ou `PIX_ENABLED=true` foi ativado. Próxima sprint somente após `supabase login` + `vercel env add` Preview com `TEST-`.*

**Validação final desta sprint (sem commit/push/db push):**
```powershell
git diff --check          # 0
npx tsc --noEmit          # 0
node --test tests/pix-0011-webhook.test.js tests/pix-002-plans.test.js tests/pix-002-security.test.js # 3 pass / 986 checks
npm run build             # 44/44
npx supabase migration list --linked # 16 Local|Remote (quando token correto)
npx supabase db lint --linked        # 403 intermitente (token Face a Face) — documentado como bloqueio
```
