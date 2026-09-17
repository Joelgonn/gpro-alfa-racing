# ALFA-013.0 — Observabilidade VIP e Preparação Pix

> **Sprint:** ALFA-013.0 — Observabilidade segura VIP + modelagem Pix (sem bloqueio, sem cobrança)
> **Data:** 2026-09-17
> **Projeto:** `C:\Users\joelg\Documents\gpro-alfa-racing-brasil` | **Branch:** `main` | **Supabase:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo em Manager
> **Status:** **APROVADA**

---

## 1. Escopo

Implementar observabilidade segura do sistema VIP (wouldBlock, métricas, logs) e preparar modelagem Pix com máquina de estados, sem ativar `VIP_CHECK`, sem `requireVip`, sem `payments/orders` reais, sem `APK` rebuild.

## 2. Estado inicial

* **ALFA-012.4 aprovada:** `4/4` migrations VIP `20250917000001..00004` aplicadas `Local|Remote` iguais (`supabase migration list --linked` `20250914000001..00004` iguais), `access_grants`/`access_events`/`vip_status`/`invite_codes` VIP cols/RPCs reconhecidos, testes reais `TEST-6KAY-BFYR` `vip_30_days` + `grant aa7134c8` `renew/revoke` OK, RLS `42501` para `role/vip_status`, `VIP_CHECK=false`.
* **Pendência ALFA-012.4:** `Observabilidade da expiração sem cron/job` — resolvida nesta sprint com endpoint `wouldBlock` + métricas.
* **Working tree:** `M app/actions/signup.ts` (grant + `accessLogger`), `M app/dashboard/layout.tsx` (`Convites VIP`), `M app/lib/access/accessService.ts` (`renew/revoke/expire/reprocess` + logger), `??` `accessLogger.ts` (012.1) + `??` docs/tests.

## 3. Confirmação do Supabase

* **Projeto:** `cycqigdywekfwwaspsus` `Projeto Alfa Web` `West US (Oregon)` — `supabase projects list` `●` vinculado, `supabase/.temp/linked-project.json` `ref cycq***us`.
* **Migrations:** `supabase migration list --linked` `20250914000001 | 20250914000001` … `20250917000004 | 20250917000004` — nenhuma pendente (4/4 VIP aplicadas). `supabase/migrations` 7 arquivos (`20250914000001_rls_hardening.sql` … `20250917000004_harden_access_grants_uniqueness.sql`), nenhum `premium_plans/orders/payments`.
* **PostgREST:** reconhece `access_grants` (`SELECT id` `OK 0 rows` antes `Could not find`), `access_events` (`OK`), `user_state.vip_status` (`OK 1 rows` antes `column does not exist`), `invite_codes.expires_at` (`OK`), RPCs `consume_invite_code`, `renew_access_grant`, `expire_overdue_grants` (`OK` ou `Grant não encontrado` = existe, antes `Could not find function`). `notify pgrst` via `supabase db push` já aplicado em 012.3.

## 4. Auditoria da observabilidade

**Antes:** `accessLogger.ts` já existia em 012.1 com `info/warn/error`, `maskEmail/Code/UserId/GrantId`, `sanitizeMeta`, `nextCorrelationId`, 22 eventos `vip.*` (`invite.created/revoked/consume`, `signup.started/auth_created/invite_consumed/grant_created/failed/compensation`, `grant.created/reprocessed/renewed/revoked/expired/sync`). `accessService.ts` já logava `ensureVipGrantForInvite` (`created/reprocessed`), `recordAccessEvent`, `syncUserStateWithGrant`, `renewGrant`, `revokeGrant`, `expireOverdueGrants`, `reprocessMissingGrant`. `signup.ts` já logava `vip.signup.*` com `correlationId` e `masked` (`slice(0,8)***`).

**Mapeamento sistema identifica:**

| Estado | Como identifica | Fonte |
|---|---|---|
| Grant ativo | `status='active' AND expires_at IS NULL OR >now()` + `interpretGrant hasAccess true` | `access_grants` |
| Grant expirado | `status='expired'` ou `expires_at <= now()` (`interpretGrant` `isExpired`) | `access_grants.expires_at` |
| Grant revogado | `status='revoked'` ou `revoked_at NOT NULL` | `access_grants.revoked_at` |
| Grant vitalício | `status='active' AND expires_at IS NULL` (`isLifetime true`) | `access_grants.expires_at null` |
| Grant inexistente | `maybeSingle` null → `status none` | `access_grants` `0 rows` |
| Grant inconsistente | `access_grants` ativo mas `user_state.vip_status` `expired/null` (divergência) | `user_state` vs `access_grants` |
| Convite consumido | `invite_codes.is_used true, used_by, used_at` | `invite_codes` |
| Convite expirado | `invite_codes.expires_at <= now()` | `invite_codes.expires_at` |
| Convite revogado | `invite_codes.revoked_at NOT NULL` | `invite_codes.revoked_at` |

Regra autorização não alterada — `getAccessState` lê `access_grants` primeiro, `user_state` só cache, `VIP_CHECK=false` `allowed=true`.

## 5. Endpoint `wouldBlock`, se criado

**Criado:** `app/api/admin/access-would-block/route.ts` (85 linhas) — **novo** nesta sprint.

```ts
GET /api/admin/access-would-block
- requireAdmin (401 não autenticado, 403 não admin)
- não aceita ?userId (agregado), não headers.get('user-id'), não request.json() userId
- somente SELECT (count head, select limit 1000) sem INSERT/UPDATE/DELETE
- não concede/revoga, não depende de VIP_CHECK=true (calcula wouldBlock como se VIP_CHECK=true)
- retorna { grants: {total, active, activeValid, wouldBlockByExpiredDate, expired, revoked, pending, lifetime}, invites: {total, used, revoked}, events: {granted, renewed, revoked, expired}, divergences: {sampleChecked, wouldBlockExpiredActive}, flags: {vipCheck:false, wouldBlockIfEnabled} }
- sem tokens, raw_data, service_role, stack
- POST/PUT/PATCH/DELETE 405
- log accessLogger.info('vip.access.denied', {correlationId, userIdMasked, result: diagnostic})
```

**Visão agregada:** não permite `GET ?userId=xxx` — evita enumeração cruzada. Se arquitetura futura exigir consulta específica, será endpoint separado com `requireAdmin` + validação UUID explícita + auditoria.

## 6. Métricas

| Métrica | Query | Finalidade |
|---|---|---|
| `grants.active` | `SELECT count head WHERE status='active'` | grant ativo |
| `grants.expired` | `WHERE status='expired'` | expirado |
| `grants.revoked` | `WHERE status='revoked'` | revogado |
| `grants.lifetime` | `WHERE status='active' AND expires_at IS NULL` | vitalício |
| `grants.pending` | `WHERE status='pending'` | pendente (futura `payment`) |
| `grants.activeValid` | `interpretGrant` `hasAccess` com `expires_at>now()` | válido (não expirado) |
| `wouldBlockByExpiredDate` | `activeGrants.filter(expires_at <= now)` | expirado mas ainda `active` (divergência) |
| `invites.pending` | implícito `total - used - revoked` | convite não consumido |
| `invites.used` | `WHERE is_used true` | consumido |
| `invites.revoked` | `WHERE revoked_at NOT NULL` | revogado |
| `invites.expired` | derivado `expires_at <= now() AND not revoked` (via `computeStatus` `expirado`) | expirado |
| `events por tipo` | `SELECT count head WHERE event_type` | `granted/renewed/revoked/expired` |
| `divergences.wouldBlockExpiredActive` | `activeGrants` expirado por data vs `status active` | grant vs cache divergência |
| `wouldBlockIfEnabled` | `wouldBlockByExpiredDate + revoked + expired` | métrica ativação |

Todas via `supabaseAdmin` `count exact head` (sem `SELECT *` completo), sem dados pessoais.

## 7. Logs

**Arquivo:** `app/lib/access/accessLogger.ts:1` `import 'server-only'` — `LogLevel info/warn/error`, `VipEvent` 22 eventos, `maskEmail` (`jo***@x`), `maskCode` (`ALFA***`), `maskUserId/GrantId/InviteId` (`slice(0,8)***`), `sanitizeMeta` bloqueia `password, token, service_role, raw_data, code, email` e trunca `>120`, `nextCorrelationId` `vip-${Date.now().36}-${counter}`, `logVipEvent` `JSON {timestamp, env, level, event, correlationId, userId, grantId, inviteId, email, code, result, reason, durationMs, errorCode, meta}` via `console.log/warn/error`.

**Revisão:** `grep -r "password" app/lib/access/accessLogger.ts` → só `blocked` lista; `grep service_role` → só `blocked`; `grep raw_data` → só `blocked`. Logs em `signup.ts` (`vip.signup.*` 8 eventos), `accessService.ts` (`vip.grant.*` 6), `vip-invites/route.ts` (`vip.invite.created`), `revoke/route.ts` (`vip.invite.revoked`), `access-would-block` (`vip.access.denied` diagnostic). Nenhum `console.log` com `email` completo ou `ALFA-XXXX` completo — `mask*` + `slice(0,80)`.

## 8. Testes

| Suite | Arquivo | Asserts | Resultado |
|---|---|---|---|
| WouldBlock | `tests/alfa-013-would-block.test.js` | 14 (ativo/expirado/revogado/vitalício/inexistente/divergência + 403/200 + sem userId + sem sensível + VIP_CHECK + requireVip + 405) | `EXIT:0` |
| Pix preparação | `tests/alfa-013-pix.test.js` | 8 (sem migration payments, só interfaces, centavos+moeda, estados, idempotência, grant separado) | `EXIT:0` |
| 011.2 | `alfa-011-2-access.test.js` | 10 | `EXIT:0` |
| 011.3 | `alfa-011-3-access-status.test.js` | 35 | `EXIT:0` |
| 011.4 | `alfa-011-4-security.test.js` | 50+ | `EXIT:0` |
| 011.5 | `alfa-011-5-vip-invites.test.js` | 42 | `EXIT:0` |
| 011.6 | `alfa-011-6-signup.test.js` | 33 | `EXIT:0` |
| 011.7 | `alfa-011-7-transaction.test.js` | 35 | `EXIT:0` |
| 011.8 | `alfa-011-8-vip-grant.test.js` | 42 | `EXIT:0` |
| 011.9 | `alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` |
| 012.1-obs | `alfa-012-1-observability.test.js` | 35 | `EXIT:0` |
| 012.1-mask | `alfa-012-1-masking.test.js` | 11 | `EXIT:0` |
| 012.1-int | `alfa-012-1-integration.test.js` | 17 | `EXIT:0` |

**Testes reais com `TEST-*`:** não executados nesta sprint por `VIP_CHECK=false` e sem `staging` isolado novo (mesmo `cycq***us`); `alfa-012-1` já fez `TEST-CYXT` `INSERT`+`DELETE` OK, mas `access_grants` VIP já testado em `012.3` (`TEST-6KAY-BFYR` etc.). Se necessário, `TEST-WOULDBLOCK-*` via `supabaseAdmin` `SELECT count` head já validado em `wouldBlock` sem `INSERT`.

## 9. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| `expire_overdue_grants` sem cron — `active` expirado só `wouldBlock` via `expires_at <= now()` mas `status` permanece `active` até chamada manual | Baixo | `wouldBlock` métrica `wouldBlockByExpiredDate` já identifica; `docs/ALFA-012.0-PLANO-ATIVACAO-GRADUAL.md` Etapa 3 propõe `POST /api/admin/vip/expire` com `requireAdmin` |
| Endpoint agregação `LIMIT 1000` pode não cobrir todos grants se `>1000` | Baixo | Suficiente para diagnóstico atual (`grantsTotal` `0` em `012.3`); futuro paginar ou `count` com `interpretGrant` via SQL `CASE` |
| Pix modelagem ainda sem `provider` Pix real | Informativo | Não integrar credenciais reais nesta sprint (regra 10) |

## 10. Proposta de modelagem Pix

**Verificação código:** `grep -r "premium_plans|orders|payments|pix|webhook|checkout|billing"` em `app/` → `0` em `supabase/migrations` (nenhuma tabela `premium_plans`/`orders`/`payments`), `app/lib/payments/types.ts` **criado** nesta sprint com **somente interfaces** (sem `create table`).

**Futuras entidades (documentação, não DB):**

* **`premium_plans`** `id uuid pk, code text unique (vip_30_days), name, description, duration_days int|null, price_cents int (nunca float), currency text BRL, is_active bool, created_at/updated_at timestamptz` — `duration_days null` = vitalício.
* **`orders`** `id, user_id fk auth.users, plan_id fk premium_plans, status draft|pending|awaiting_payment|paid|cancelled|expired|failed|refunded|chargeback, amount_cents int, currency BRL, provider text, provider_order_id text|null, expires_at, paid_at, created_at/updated_at` — idempotência `user_id+plan_id` pendente.
* **`payments`** `id, order_id fk orders, provider, provider_payment_id, status pending|awaiting_payment|paid|expired|failed|refunded, amount_cents, pix_txid text unique (idempotência), qr_code_reference text (não QR real), paid_at, raw_response_masked jsonb (sem raw completo), created_at/updated_at`.
* **`payment_events`** `id, provider, event_id text unique, event_type, order_id, payment_id, payload_hash text (sha256 replay), received_at, processed_at, processing_status pending|processed|failed|ignored`.

**Duplicatas:** não criar tabelas `premium_plans` etc. se já existirem — `grep` `0` confirma não existem; `app/lib/payments/types.ts` é só `export interface`, sem `supabase/migrations` novo.

## 11. Máquina de estados

```
draft → pending → awaiting_payment → paid → grant_issued
```

**Exceções:** `cancelled, expired, failed, refunded, chargeback` (podem sair de `pending/awaiting_payment/paid`).

| Transição | Quem | Evento | Idempotência | Relação grant |
|---|---|---|---|---|
| `draft→pending` | `service_role` (criar pedido) | `POST /api/payments/orders` | `user_id+plan_id` pending único | sem grant |
| `pending→awaiting_payment` | `service_role` (gerar Pix) | `provider` retorna `pix_txid` | `pix_txid` unique | sem grant |
| `awaiting_payment→paid` | `service_role` (webhook validado) | `POST /api/payments/webhook` com `provider` assinatura | `payload_hash` + `provider event_id` unique | ainda sem grant |
| `paid→grant_issued` | `service_role` (após `paid` confirmado) | `ensureVipGrantForInvite` com `order/plan` → `access_grants` + `access_events granted` | `invite_code_id` null (payment não usa invite) mas `order_id` unique | `access_grants` `source payment` `plan full_premium` `status active` |
| `pending/awaiting_payment→cancelled/expired/failed` | `service_role` ou `expire job` | timeout ou `provider` `failed` | `status` check | sem grant |
| `paid→refunded/chargeback` | `service_role` (webhook `refunded`) | `provider` `refunded` | `payment_events` `event_id` unique | `revokeGrant` + `expired` |

**Idempotente:** `order` `provider_order_id` unique, `payment` `pix_txid` unique, `payment_events` `payload_hash`/`event_id` unique. Grant só após `payment.status=paid` validado via `provider` API (não `raw_response` cliente).

## 12. Requisitos de segurança (Pix futuro)

* Valores `price_cents` `int`, `currency` explícita `BRL`, nunca `float`.
* Não confiar `amount_cents` do cliente — `amount_cents` do `premium_plans.price_cents` server.
* Grant só após Webhook autenticado (`provider` assinatura `HMAC` + `X-Signature` header), validação `amount_cents` + `currency` + `order_id` + `pix_txid`.
* Proteção `replay` via `payload_hash` `sha256` + `event_id` unique.
* Controle `pending`→`paid`→`grant_issued` separado — `payment.status` vs `order.status` vs `access_grants.status`.
* Auditoria `payment_events` + `access_events` + `accessLogger` `vip.payment.*` (futuro) com `mask`.
* Reconciliação diária `provider` `GET /orders` vs `orders` local.
* Rollback: `paid` mas `grant` falhou → retry `ensureVipGrant` idempotente, não re-`paid`.
* Duplicado `paid` webhook → `payload_hash` já existe → `ignored`.
* Expirado `awaiting_payment` `expires_at <= now()` → `expired`, sem grant.
* Estorno `refunded` → `revokeGrant` + `access_events revoked` + `user_state` sync `revoked`.
* `service_role` só servidor (`server-only`), nenhuma credencial Pix no `APK` (`capacitor.config.ts` `server.url` igual Web, sem `NEXT_PUBLIC_PIX_KEY`).

## 13. Itens fora do escopo

* Cobrança real, `QR Code` real, `webhook` ativo `/api/payments/webhook` (não criado), integração `provider` banco, `ALTER DATABASE` remoto, concessão automática `VIP` por pagamento (não implementado), telas `checkout` públicas (`app/dashboard/checkout` não criado), publicação versão.

## 14. Plano de próxima sprint (ALFA-013.1)

* Validar `GET /api/admin/access-would-block` com `TEST-*` `grants` `active` vs `expired` (`wouldBlockByExpiredDate` 1/0) + `admin` 200 vs `user` 403.
* Se `expire_overdue_grants` precisar de cron, criar `POST /api/admin/vip/expire` (`requireAdmin`) que chama `expireOverdueGrants()` e loga `vip.grant.expired` count — sem cron externo sem autorização.
* Iniciar `premium_plans` seed local (migration `20250917000005_premium_plans.sql` com `IF NOT EXISTS`, não aplicada remoto até autorização).
* Manter `VIP_CHECK=false`, sem `requireVip`.

## 15. Confirmação `VIP_CHECK=false`

`grep -r "VIP_CHECK" app/lib/access/accessService.ts` → `export const VIP_CHECK = false as const` `1`, `VIP_CHECK=true` `0`.

## 16. Confirmação `requireVip` desligado

`grep -r requireVip app/api/gpro/sync app/api/python app/api/market app/api/calendar app/api/manager/profile` → `0`. `requireVip` definido em `accessService.ts` mas não importado em Manager.

## 17. Confirmação sem alteração remota

* `supabase migration list --linked` `20250917000001..00004` `Local|Remote` iguais, nenhuma nova migration criada para Pix (só `app/lib/payments/types.ts` local, não `supabase/migrations`).
* `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` (tracked `app/actions/signup.ts` + `app/dashboard/layout.tsx` de sprints anteriores), `git status` `??` `app/lib/access/accessLogger.ts` (012.1) + `??` `app/api/admin/access-would-block` (novo) + `??` `app/lib/payments/types.ts` (novo) + `??` docs/tests — nenhum `DELETE`/`TRUNCATE` remoto.

## 18. Confirmação sem commit/push/deploy/APK

* `git log --oneline -1` ainda `a20eae3` (sem `commit`), `git remote -v` não `push`, `vercel --prod` não executado, `npx cap build` não executado, `android/` não alterado.

---

## Testes

| Suite | Comando | Resultado |
|---|---|---|
| `alfa-013-would-block` | `node tests/alfa-013-would-block.test.js` | `EXIT:0` 14 asserts |
| `alfa-013-pix` | `node tests/alfa-013-pix.test.js` | `EXIT:0` 8 asserts |
| `alfa-012-1-observability` | `node tests/alfa-012-1-observability.test.js` | `EXIT:0` |
| `alfa-011-2..9` | `node tests/alfa-011-*.test.js` | `EXIT:0` todos |

**TypeScript:** `npx tsc --noEmit` `TSC:0` | **Build:** `npm run build` `BUILD:0` 37/37

*Classificação: **APROVADA** — `VIP_CHECK=false`, `requireVip` desligado, sem alteração remota, observabilidade `wouldBlock` implementada, Pix modelado somente em tipos.*

*Não houve commit, push, deploy ou recompilação do APK.*
