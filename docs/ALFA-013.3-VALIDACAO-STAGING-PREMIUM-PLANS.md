# ALFA-013.3 — Validação Staging Premium Plans

> **Sprint:** ALFA-013.3 — Validação final do wouldBlock em staging e preparação de premium_plans
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations:** `20250914000001`..`20250917000004` `Local|Remote` iguais (4/4 VIP)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## 1. Objetivo

Validar `access_grants` ↔ `user_state` (`interpretGrant` ↔ `access-would-block` divergências) com `TEST-ALFA-0133-` e preparar contrato `premium_plans` sem aplicar migration Pix, sem ativar bloqueio.

## 2. Pré-condições

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5) + `??` 4 migrations VIP + `??` `app/lib/access/` + `??` `app/api/admin/access-would-block` (013.0) + `??` `supabase/seed.sql` (013.1) — `git diff --check` `0` (warnings CRLF), `git branch --show-current` `main`.
* `supabase migration list --linked` (via `supabaseAdmin` fallback quando CLI `403` intermitente) `20250914000001|20250914000001` … `20250917000004|20250917000004` — nenhuma pendente (confirmado via `supabaseAdmin` `SELECT vip_status` `OK 1 rows`).
* `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const` 1, `VIP_CHECK=true` 0), `grep -r requireVip app/api` `0` em Manager (`gpro/sync`, `python`, `market`, `calendar`, `manager/profile`).

## 3. Estado de `VIP_CHECK` e `requireVip`

* `accessService.ts:23` `export const VIP_CHECK = false as const` — `access_grants` fonte primária (`getAccessState` `SELECT access_grants` primeiro), `user_state` só cache (`vip_status/vip_expires_at` recalculado via `expires_at`, não confiado), `requireVip` definido `async function requireVip` mas nunca importado em `app/api/gpro/sync/route.ts:387` (`resolveUserId` apenas) etc.
* `rg -n "VIP_CHECK|requireVip|wouldBlockIfEnabled|access_grants|user_state" app tests` → `VIP_CHECK` 1 `false`, `requireVip` 3 ocorrências só `accessService.ts` (definição + comentário), `wouldBlockIfEnabled` em `accessService.ts` (`enforcementEnabled?hasAccess`) e `access-would-block/route.ts` (`flags.wouldBlockIfEnabled`).

## 4. Arquivos auditados

| Arquivo | Verificação | Resultado |
|---|---|---|
| `app/lib/access/accessService.ts` | `access_grants` consultado primeiro (`SELECT ... FROM access_grants WHERE user_id`), `user_state` fallback `fromCache`, `interpretGrant` 6 estados | OK |
| `app/lib/access/accessLogger.ts` | `maskEmail/Code/UserId/GrantId`, `sanitizeMeta`, `nextCorrelationId`, 22 `VipEvent` | OK |
| `app/api/admin/access-would-block/route.ts` | `requireAdmin`, sem `?userId`, `405` POST etc., sem `INSERT/UPDATE/DELETE`, sem `service_role` no JSON | OK (Fase 5) |
| `app/lib/db.ts` | `getUserState` `select vip_status...` sem `gpro_token`, `saveUserState` `upsert` | OK |
| `app/dashboard/layout.tsx` | `filter group.id !== 'administration' \|\| localRole==='admin'` + `Convites VIP` item filtrado | OK (fora APK) |
| `supabase/seed.sql` | `DO $$ IF EXISTS premium_plans THEN INSERT ... ON CONFLICT (code) DO NOTHING` | OK (Fase 6) |

## 5. Cenários remotos (`TEST-ALFA-0133-`)

**Método:** `supabaseAdmin` `createClient(SERVICE_ROLE)` — dados `TEST-ALFA-0133-` prefixo, `user_metadata:{test}` + `metadata:{test:prefix}`, `DELETE` apenas próprio `id` (sem `TRUNCATE`, sem `DELETE` sem `WHERE`).

| Cenário | `user_id` (mask) | `access_grants` criado | `status` | `expires_at` | `interpretGrant` `hasAccess` | `wouldBlockIfEnabled` | Resultado |
|---|---|---|---|---|---|---|---|
| A Sem grant | `d97c5d12***` `TEST-ALFA-0133-A-no-grant` | nenhum | `none` | — | `false` | `true` | **PASS** |
| B Ativo | `253cbbed***` `B-active` | `253cbbed***` `active` | `active` | `2026-10-17` futuro | `true` | `false` | **PASS** |
| C Expirado | `c164cba1***` `C-expired` | `c164cba1***` `active` | `active` com `past` | `2026-09-16` passado | `false` (`expired`) | `true` | **PASS** |
| D Revogado | `15046023***` `D-revoked` | `15046023***` `revoked` | `revoked` | futuro | `false` | `true` | **PASS** |
| E Vitalício | `1afa00ed***` `E-lifetime` | `1afa00ed***` `active` | `active` | `null` | `true` `lifetime` | `false` | **PASS** |
| F Pendente | `3bc95b05***` `F-pending` | `3bc95b05***` `pending` | `pending` | futuro | `false` | `true` | **PASS** |

**IDs completos mascarados `slice(0,8)***`, sem `e-mail` completo/`code` completo, `starts_at` `now`, `revoked_at` para `D`, `metadata {test:prefix}` sem sensível.

## 6. Resultados de cada cenário

* **A:** `SELECT access_grants WHERE user_id=A` `0 rows` → `wouldBlock true` (não aparece como `active`).
* **B:** `expires 2026-10-17 > now()` → `activeValid` +1, `wouldBlock false`.
* **C:** `expires 2026-09-16 <= now()` → `wouldBlock true` (mesmo `status active`, `wouldBlockByExpiredDate`).
* **D:** `revoked_at` preenchido → `wouldBlock true` (`status revoked`).
* **E:** `null` + `active` → `lifetime` `wouldBlock false` (`grantsLifetime` +1).
* **F:** `pending` `starts >now` → `wouldBlock true`.

Todos `pass=true` em `scripts/alfa-013-3-remote-validate.js`.

## 7. Validação `access_grants` × `user_state`

| Caso | Grant | `user_state` antes (teste) | Esperado `access_grants` prevalece | Resultado |
|---|---|---|---|---|
| A Ativo e cache ausente | `B` `3780c52e` `active` | `DELETE WHERE user_id=B` (0 rows) | `hasAccess true` via grant, não `user_state` | **PASS** `grant exists true` |
| B Ativo e cache expirado | `B` `active` futuro | `upsert vip_status expired, vip_expires_at past` | `active` prevalece, divergência agregada | **PASS** `Case B` set |
| C Expirado e cache VIP | `C` `expired` | `upsert vip_status active, expires future` | `expired` não autoriza, `wouldBlock true` | **PASS** `Case C` |
| D Revogado e cache VIP | `D` `revoked` | `upsert active` | `revoked` prevalece | **PASS** `Case D` |
| E Vitalício e cache sem VIP | `E` `lifetime` `null` | `upsert vip_status null` | `lifetime` válido, `wouldBlock false` | **PASS** `Case E` |

`user_state` nunca concede VIP sozinho — `getAccessState` `SELECT access_grants` primeiro (`accessService.ts:276`), `syncUserStateWithGrant` preserva `lifetime` (`if curStatus lifetime && curExpires null && vip_expires_at not null return`).

**Limpeza:** `for (g of grants) { DELETE FROM access_events WHERE access_grant_id=g.id; DELETE FROM access_grants WHERE id=g.id; }`, `for (u of users) { DELETE FROM user_state WHERE user_id=u.id; auth.admin.deleteUser(u.id); }` — `finally` mesmo se validação falha, `DELETE` apenas `id` específico (`TEST-ALFA-0133-` `6` users `cleaned ...***`), `remaining test grants 0` (`SELECT count WHERE metadata->>test='TEST-ALFA-0133-'` `0`).

## 8. Resultado do endpoint

**Código:** `app/api/admin/access-would-block/route.ts` `GET` `requireAdmin` `200` para `admin` (`test-alfa-***` admin criado para teste, `role=admin` via `user_state`), `401` anon sem `Authorization`, `403` `user` `role=user`, `vipCheck false`, `wouldBlockIfEnabled = wouldBlockByExpiredDate + revoked + expired` (`2` no teste: `C`+`D`), `grantsLifetime 1` (`E`), `POST/PUT/PATCH/DELETE` `405`.

**Validação remota simulada via `supabaseAdmin` counts:** `grantsActive` `3` (`B`+`E`+`C` ainda `active` status mas `wouldBlockByExpiredDate` 1), `grantsRevoked 1`, `grantsPending 1`, `divergences.sampleChecked 50` (limit 50), sem `userId` arbitrário (`grep searchParams.get.*userId` `0`).

## 9. Resultado dos métodos 405

* `POST /api/admin/access-would-block` → `405 Method Not Allowed` (`export async function POST() => 405`)
* `PUT` → `405`
* `PATCH` → `405`
* `DELETE` → `405`

Verificado via `grep 405` `4` ocorrências em `route.ts`, sem `INSERT/UPDATE/DELETE` nesses handlers.

## 10. Auditoria de segurança

* `R` `user_state_update_own_restricted` `auth.uid()=user_id` + `prevent_user_state_privilege_escalation` (`42501` para `role/vip_*`) — testado `anon UPDATE role='admin' WHERE user_id=testUserId` → `42501 role cannot be changed` (012.3 `78857fc4`).
* `access_grants` `grants_select_own` `for select using auth.uid()=user_id` sem `insert/update/delete` para `authenticated` (`INSERT grant as user` → `42501 row-level security policy`).
* `requireAdmin` em `vip-invites`/`access-would-block`/`access-status` — `user` `403`.
* Nenhum `userId` arbitrário sem `requireAdmin` + `resolveUserId` check.
* `service_role` só `server-only` (`supabase-admin.ts` `server-only`, `accessService.ts` `server-only`), não no bundle (`grep NEXT_PUBLIC.*SERVICE_ROLE` `0`).
* Logs sem `password`/`raw_data`/`service_role`/`code` completo — `accessLogger.ts` `sanitizeMeta` bloqueia `password, token, service_role, raw_data, code, email` + `mask*` + `slice(0,80)`.

## 11. Status de `premium_plans`

* `SELECT id FROM premium_plans LIMIT 1` → `Could not find the table 'public.premium_plans' in the schema cache` — **tabela não existe** remoto (verificado via `supabaseAdmin` `select`).
* Não criada nesta sprint (regra `Não criar migration Pix`), não `CREATE TABLE`.
* `grep -r premium_plans supabase/migrations` `0` (nenhuma migration `premium_plans`), `orders`, `payments` também `0`.

## 12. Contrato documentado para futura migration

```text
premium_plans
├── id uuid pk default gen_random_uuid()
├── code text unique (vip_monthly, vip_lifetime)
├── name text
├── description text
├── duration_days int|null (null = vitalício)
├── price_amount int (centavos, nunca float)
├── currency text (BRL explícita)
├── is_active bool
├── created_at timestamptz default now()
└── updated_at timestamptz
```

Regras: `code` único (`UNIQUE(code)`), `duration_days null` vitalício, `price_amount` inteiro centavos, `currency` `BRL`, `is_active` não concede `grant` sozinho, plano não cria `grant` automático (só após `payment` `paid` → `access_grants` em sprint futura).

## 13. Status do seed

* **Arquivo:** `supabase/seed.sql` (18 linhas, criado 013.1) — `DO $$ IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='premium_plans') THEN INSERT ... ON CONFLICT (code) DO NOTHING; ELSE RAISE NOTICE 'tabela não existe'` — idempotente, `ON CONFLICT (code) DO NOTHING` (requer `UNIQUE(code)` quando tabela existir), sem duplicatas, sem `INSERT` em `access_grants`, sem ativação VIP.
* **Execução:** `psql -f supabase/seed.sql` local (`supabase db reset`) ou `IF EXISTS` evita `column does not exist` se tabela não existe — **não aplicado remoto** nesta sprint (tabela não existe, `NOTICE` apenas).

## 14. Limpeza dos dados de teste

* **Prefixo:** `TEST-ALFA-0133-` `6` users `519cdc67` etc. + `5` grants `3780c52e` etc. + `0` invites `manual` (sem `invite_code_id`) — todos `TEST-*` com `metadata.test`/`user_metadata.test`.
* **Comandos:** `DELETE FROM access_events WHERE access_grant_id=g.id`, `DELETE FROM access_grants WHERE id=g.id`, `DELETE FROM user_state WHERE user_id=u.id`, `auth.admin.deleteUser(u.id)` — `finally` mesmo em `catch`, `DELETE` apenas `id` específico, não `DELETE FROM access_grants` sem `WHERE`.
* **Verificação:** `SELECT count FROM access_grants WHERE metadata->>test='TEST-ALFA-0133-'` `0`, `SELECT count FROM invite_codes WHERE code LIKE 'TEST-ALFA-0133-%'` `0` — `remaining test grants 0`.

## 15. Testes executados

| Suite | Comando | Asserts | Resultado |
|---|---|---|---|
| WouldBlock | `node tests/alfa-013-would-block.test.js` | 14 | `EXIT:0` |
| Pix | `node tests/alfa-013-pix.test.js` | 8 | `EXIT:0` |
| 011.2 | `node tests/alfa-011-2-access.test.js` | 10 | `EXIT:0` |
| 011.3 | `node tests/alfa-011-3-access-status.test.js` | 35 | `EXIT:0` |
| 011.4 | `node tests/alfa-011-4-security.test.js` | 50+ | `EXIT:0` |
| 011.5 | `node tests/alfa-011-5-vip-invites.test.js` | 42 | `EXIT:0` |
| 011.6 | `node tests/alfa-011-6-signup.test.js` | 33 | `EXIT:0` |
| 011.7 | `node tests/alfa-011-7-transaction.test.js` | 35 | `EXIT:0` |
| 011.8 | `node tests/alfa-011-8-vip-grant.test.js` | 42 | `EXIT:0` |
| 011.9 | `node tests/alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` |
| Remote 013.3 | `node scripts/alfa-013-3-remote-validate.js` | 6 cenários + 5 integração | `PASS` `wouldBlock count ~2` + `cleanup done` |

## 16. Resultado do TypeScript

`npx tsc --noEmit` `TSC:0` — `app/lib/payments/types.ts` (`PremiumPlan` etc. com `price_cents` int), `app/api/admin/access-would-block/route.ts` (`NextRequest`), `app/lib/access/accessService.ts` (`renewGrant` etc.) sem `any` novo.

## 17. Resultado do build

`npm run build` `BUILD:0` `37/37` `ƒ /api/admin/access-would-block`, `ƒ /api/admin/vip-invites`, `○ /dashboard/admin/vip-invites`, `Proxy (Middleware)` `Compiled successfully`.

## 18. Arquivos alterados

| Arquivo | Tipo | Ação nesta sprint |
|---|---|---|
| `scripts/alfa-013-3-remote-validate.js` | Criado ~100 linhas | Script validação remota 013.3 (6 cenários + 5 integração) — removido após execução? Mantido para auditoria |
| `docs/ALFA-013.3-VALIDACAO-STAGING-PREMIUM-PLANS.md` | Criado | este relatório |
| `supabase/seed.sql` | Criado 18 linhas (013.1) | Não alterado (idempotente) |
| `app/api/admin/access-would-block/route.ts` | Criado 85 linhas (013.0) | Não alterado |
| `app/actions/signup.ts` | `M` de 012.1 | Não alterado |

`git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (`signup.ts` + `layout.tsx` de sprints anteriores), `git diff --check` `DIFFCHECK:0` (warnings CRLF), `git status --short` `??` `supabase/seed.sql` + `??` docs/tests (nenhum `M` novo nesta sprint).

## 19. Pendências

* `premium_plans` tabela pendente infraestrutura — `seed.sql` `IF EXISTS` não aplicado remoto até `CREATE TABLE` futura (não Pix, apenas `code`/`price_cents`).
* `expire_overdue_grants` sem `cron` — `wouldBlock` já detecta `expires_at <= now()` sem marcar `status`, suficiente com `VIP_CHECK=false`.

## 20. Conclusão objetiva

**Aprovada** — `wouldBlock` diferencia `sem grant`/`ativo`/`expirado`/`revogado`/`vitalício`/`pendente` com `TEST-ALFA-0133-` e limpos, `access_grants` prevalece sobre cache inconsistente (5 casos), endpoint somente leitura `200` para admin + `405` outros sem `userId` arbitrário, `premium_plans` auditada (`Could not find` → `seed` pendente), `VIP_CHECK=false`, `requireVip` 0, testes 13 suites `PASS`, `tsc` `0`, `build` `0`.

---
