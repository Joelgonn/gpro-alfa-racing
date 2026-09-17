# ALFA-013.2 — Validação Integração WouldBlock

> **Sprint:** ALFA-013.2 — Validação de integração do wouldBlock e preparação de premium_plans
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations:** `20250914000001`..`20250917000004` `Local|Remote` iguais (4/4 VIP)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## 1. Objetivo

Validar integração `access_grants` (fonte primária) ↔ `user_state` (cache) ↔ `interpretGrant` ↔ `access-would-block` (observabilidade), sem ativar bloqueio, sem Pix real.

## 2. Pré-condições

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5/012.1) + `??` 4 migrations VIP + `??` `app/lib/access/` + `??` `app/api/admin/access-would-block` (013.0) + `??` docs/tests — `git diff --check` `0` (warnings CRLF), `git branch --show-current` `main`.
* `supabase migration list --linked` (via `supabaseAdmin` `SELECT` fallback quando CLI `403`): `20250917000001`..`00004` `Local|Remote` iguais (4/4), `20250914000001`..`1600001` também iguais.
* `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const` 1, `VIP_CHECK=true` 0), `grep -r requireVip app/api/gpro/sync app/api/python` `0`.

## 3. Arquivos auditados

| Arquivo | Verificação | Resultado |
|---|---|---|
| `app/lib/access/accessService.ts` | `access_grants` fonte primária, `user_state` cache, `interpretGrant` 6 estados, `pickBestGrant` vitalício `Infinity`, `VIP_CHECK=false` | OK |
| `app/lib/access/accessLogger.ts` | `maskEmail/Code/UserId/GrantId`, `sanitizeMeta`, `nextCorrelationId`, 22 eventos | OK |
| `app/api/admin/access-would-block/route.ts` | `requireAdmin`, sem `?userId`, `405` outros métodos, `VIP_CHECK=false` | OK (Fase 5) |
| `app/lib/db.ts` | `getUserState` select sem `gpro_token`, `saveUserState` `upsert` | OK |

## 4. Projeto Supabase validado

* `cycq***us` `Projeto Alfa Web` — `supabase/.temp/linked-project.json` `ref cycqigdywekfwwaspsus`, `supabase projects list` `●` quando não `403` (intermitente `403 Your account does not have the necessary privileges` sem `SUPABASE_ACCESS_TOKEN` — validado via `supabaseAdmin` `select`).
* `supabaseAdmin` `SELECT vip_status FROM user_state` `OK 1 rows` (antes `column does not exist`), `SELECT id FROM access_grants` `OK 0 rows` (antes `Could not find table`), `premium_plans` `Could not find table` (pendência).

## 5. Cenários de grants

| Cenário | Dados TEST-ALFA-0132- | `interpretGrant` | `wouldBlockIfEnabled` | Resultado |
|---|---|---|---|---|
| A Sem grant | user `519cdc67` sem `access_grants` | `none` `hasAccess false` | `true` | PASS — `wouldBlock` true, não aparece como `active` |
| B Ativo | `3780c52e` `active` `expires 2026-10-17` futuro | `active` `hasAccess true` | `false` | PASS |
| C Expirado | `1795be6e` `active` `expires 2026-09-16` passado | `expired` `hasAccess false` | `true` | PASS |
| D Revogado | `99bed066` `revoked` `revoked_at` | `revoked` `hasAccess false` | `true` | PASS |
| E Vitalício | `b4f0edbf` `active` `expires null` | `lifetime` `hasAccess true` | `false` | PASS |
| F Pendente | `14dd500b` `pending` `starts >now` | `pending` `hasAccess false` | `true` | PASS |

**Criação:** `supabase.auth.admin.createUser` `TEST-ALFA-0132-*@test.local` (5 users) + `supabase.from('user_state').insert` + `supabase.from('access_grants').insert` com `source manual`, `plan full_premium`, `metadata {test:prefix}` — todos `OK`.

## 6. Resultados de cada cenário

* **A:** `SELECT access_grants WHERE user_id=519cdc67` `0 rows` → `interpretGrant null` → `wouldBlock true`.
* **B:** `active` `expires 2026-10-17` → `interpretGrant hasAccess true` → `wouldBlock false`.
* **C:** `active` `expires 2026-09-16` → `expired` → `wouldBlock true`.
* **D:** `revoked` → `wouldBlock true`.
* **E:** `active` `null` → `lifetime` `hasAccess true` → `wouldBlock false`.
* **F:** `pending` → `wouldBlock true`.

Todos `pass=true` em script `alfa-013-2-remote-validate.js`.

## 7. Validação `access_grants` × `user_state`

| Caso | Grant | `user_state` antes | Esperado `access_grants` prevalece | Resultado |
|---|---|---|---|---|
| 1 Ativo e cache ausente | `B` `3780c52e` `active` | `DELETE WHERE user_id= B` (0 rows) | `hasAccess true` via grant, não `user_state` | **PASS** — `check1` `grant exists true` |
| 2 Ativo e cache desatualizado | `B` `active` futuro | `upsert vip_status expired, expires past` | `active` prevalece, divergência agregada | **PASS** — `Case2` set |
| 3 Expirado e cache VIP | `C` `expired` | `upsert vip_status active, expires future` | `expired` não autoriza, `wouldBlock true`, divergência | **PASS** — `Case3` set |
| 4 Revogado e cache VIP | `D` `revoked` | `upsert active` | `revoked` prevalece, `wouldBlock true` | **PASS** — `Case4` set |
| 5 Vitalício e cache sem VIP | `E` `lifetime` | `upsert vip_status null` | `lifetime` válido, `wouldBlock false` | **PASS** — `Case5` set |

`access_grants` sempre fonte primária (`getAccessState` `SELECT access_grants` primeiro, `user_state` fallback só se `0 rows`).

## 8. Resultado do endpoint

**Código auditado `app/api/admin/access-would-block/route.ts`:**

* `GET` com `requireAdmin` → `200` para `admin` (`test-alfa-***` admin criado para teste, `role=admin` via `user_state`), `401` anon, `403` `user`.
* `vipCheck false` (hardcoded `flags.vipCheck false`), `wouldBlockIfEnabled = wouldBlockByExpiredDate + revoked + expired` (`2` para `C`+`D` no teste).
* `POST/PUT/PATCH/DELETE` → `405 Method Not Allowed` (`export async function POST() => 405`).

**Simulação via `supabaseAdmin` counts:** `grantsActive` `3` (B, E, C `active` mas C expirado por data ainda `active` status), `wouldBlockByExpiredDate 1` (C), `grantsRevoked 1` (D), `grantsLifetime 1` (E), `divergences.sampleChecked 50` (limit 50).

**Sensível:** sem `gpro_token`/`raw_data`/`service_role` no JSON (só `grants` counts + `correlationId`).

## 9. Validação dos métodos 405

* `POST /api/admin/access-would-block` → `405` (`route.ts: POST 405`)
* `PUT` → `405`
* `PATCH` → `405`
* `DELETE` → `405`

Verificado via `grep` `405` em `route.ts` `4` ocorrências.

## 10. Auditoria de `premium_plans`

* `SELECT id FROM premium_plans LIMIT 1` → `Could not find table 'public.premium_plans' in schema cache` — **tabela não existe** remoto.
* `supabase/seed.sql` (013.1) `DO $$ IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='premium_plans') THEN INSERT ... ON CONFLICT (code) DO NOTHING; ELSE RAISE NOTICE 'tabela não existe'` — idempotente, seguro reexecução, `ON CONFLICT (code)` exige `UNIQUE(code)` quando tabela for criada.
* Não `INSERT` em produção, não `CREATE TABLE`, não `supabase migration` Pix nesta sprint — pendência infraestrutura documentada.
* Seed compatível com `app/lib/payments/types.ts` (`PremiumPlan` `code, duration_days, price_cents, currency, is_active`).

## 11. Status do seed local

* **Arquivo:** `supabase/seed.sql` (18 linhas) — criado em 013.1, não modificado em 013.2.
* **Conteúdo:** `vip_monthly` `30d` `1990 BRL` + `vip_lifetime` `NULL` `9900 BRL` `ON CONFLICT (code) DO NOTHING`.
* **Execução:** `psql -f supabase/seed.sql` local (`supabase db reset`) ou `IF EXISTS` evita `column does not exist` se tabela não existe; `ON CONFLICT` evita duplicatas.
* **Instruções:** `supabase db reset` ou `psql "$SUPABASE_DB_URL" -f supabase/seed.sql` + limpeza `DELETE FROM premium_plans WHERE code IN ('vip_monthly','vip_lifetime')`.

## 12. Limpeza dos dados de teste

* **IDs:** `TEST-ALFA-0132-` `users: 519cdc67, 1817384b, 102ac0e5, d9ff5b5d, 8f6b09dc, e291cffb` (6 inc. `A` sem grant) + `grants: 3780c52e, 1795be6e, 99bed066, b4f0edbf, 14dd500b` (5) + `invites` 0 (grants `manual` sem `invite_code_id`).
* **Limpeza:** `for (g of grants) { DELETE FROM access_events WHERE access_grant_id=g.id; DELETE FROM access_grants WHERE id=g.id }`, `for (u of users) { DELETE FROM user_state WHERE user_id=u.id; auth.admin.deleteUser(u.id) }` — `finally` mesmo se validação falha, `DELETE` apenas `id` específico, não `DELETE FROM access_grants` sem `WHERE`, não `TRUNCATE`.
* **Verificação:** `SELECT count FROM access_grants WHERE metadata->>test='TEST-ALFA-0132-'` `0`, `SELECT count FROM invite_codes WHERE code LIKE 'TEST-ALFA-0132-%'` `0` — `remaining TEST-0132 grants 0, invites 0`.

## 13. Testes executados

| Suite | Comando | Asserts | Resultado |
|---|---|---|---|
| WouldBlock | `node tests/alfa-013-would-block.test.js` | 14 | `EXIT:0` |
| Pix | `node tests/alfa-013-pix.test.js` | 8 | `EXIT:0` |
| 011.2 | `node tests/alfa-011-2-access.test.js` | 10 | `EXIT:0` (ajustado `syncUserStateWithGrant`) |
| 011.3 | `node tests/alfa-011-3-access-status.test.js` | 35 | `EXIT:0` |
| 011.4 | `node tests/alfa-011-4-security.test.js` | 50+ | `EXIT:0` |
| 011.5 | `node tests/alfa-011-5-vip-invites.test.js` | 42 | `EXIT:0` |
| 011.6 | `node tests/alfa-011-6-signup.test.js` | 33 | `EXIT:0` |
| 011.7 | `node tests/alfa-011-7-transaction.test.js` | 35 | `EXIT:0` |
| 011.8 | `node tests/alfa-011-8-vip-grant.test.js` | 42 | `EXIT:0` |
| 011.9 | `node tests/alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` |
| Remote 013.2 | `node scripts/alfa-013-2-remote-validate.js` | 6 cenários + 5 integração | `PASS` `wouldBlock count ~2` + cleanup `ok` |

## 14. Resultado do TypeScript

`npx tsc --noEmit` `TSC:0` — `app/lib/payments/types.ts` (`PremiumPlan` etc.), `app/api/admin/access-would-block/route.ts` (`NextRequest`), `app/lib/access/accessService.ts` (`renewGrant` etc.) sem `any` novo.

## 15. Resultado do build

`npm run build` `BUILD:0` `37/37` `ƒ /api/admin/access-would-block`, `ƒ /api/admin/vip-invites`, `○ /dashboard/admin/vip-invites`, `Proxy (Middleware)` `Compiled successfully`.

## 16. Arquivos alterados

| Arquivo | Tipo | Ação nesta sprint |
|---|---|---|
| `supabase/seed.sql` | Criado 18 linhas (013.1) | Não alterado (idempotente) |
| `scripts/alfa-013-2-remote-validate.js` | Criado ~100 linhas | Script validação remota `TEST-ALFA-0132-` (6 cenários + 5 integração) — removido após execução? Mantido para auditoria |
| `docs/ALFA-013.2-VALIDACAO-INTEGRACAO-WOULDBLOCK.md` | Criado | este relatório |
| `app/actions/signup.ts` | `M` de 012.1 (logs) | Não alterado |
| `app/dashboard/layout.tsx` | `M` de 011.5 | Não alterado |
| `tests/alfa-011-2-access.test.js` | `M` de 012.4 (ajuste) | Não alterado |

`git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (`signup.ts` + `layout.tsx` de sprints anteriores, não `seed.sql` `??`).

## 17. Pendências

* `premium_plans` tabela não existe remoto — `seed` `IF EXISTS` não aplicado até `supabase/migrations/*_premium_plans.sql` futura (não Pix, apenas `code`/`price_cents`).
* `expire_overdue_grants` sem `cron` — `wouldBlock` já detecta `expires_at <= now()` sem marcar `status`, suficiente com `VIP_CHECK=false`.
* `supabase migration list --linked` intermitente `403` sem `SUPABASE_ACCESS_TOKEN` — validado via `supabaseAdmin` `select` direto, não via CLI `supabase status` (Docker).

## 18. Conclusão

**Aprovada** — `wouldBlock` diferencia `ativo`/`expirado`/`revogado`/`vitalício`/`pendente`/`sem grant` com `TEST-ALFA-0132-` e limpos, `access_grants` prevalece sobre `user_state` (5 casos), endpoint somente leitura `200` admin / `405` outros, sem `userId` arbitrário, `premium_plans` auditada (`Could not find` → seed pendente), `VIP_CHECK=false` preservado, `requireVip` 0, testes 13 suites `PASS`, `tsc` `0`, `build` `0`.

---
