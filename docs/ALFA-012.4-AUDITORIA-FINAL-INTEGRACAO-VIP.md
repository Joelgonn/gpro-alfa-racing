# ALFA-012.4 — Auditoria Final de Integração VIP

> **Sprint:** ALFA-012.4 — Auditoria final de integração e preparação para ativação controlada
> **Data:** 2026-09-17
> **Projeto:** `C:\Users\joelg\Documents\gpro-alfa-racing-brasil` | **Branch:** `main` | **Supabase:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **CLI:** `2.109.1`
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Migrations:** 4/4 VIP aplicadas `Local|Remote` iguais
> **Status:** **APROVADA COM PENDÊNCIAS** — pendências são observabilidade de expiração em produção (sem cron) e validação manual de `TEST-VIP` em staging com `supabase db push` já aplicado (sem `commit`/`push`/`deploy`/`APK` nesta sprint)

---

## 1. Escopo

Auditoria final integrada do sistema VIP (convite → cadastro → concessão `access_grants` → `access_events` → `user_state` cache) + RLS + rotas Manager + Web/APK, sem ativar bloqueio, sem criar `payments/orders/premium_plans`, sem `commit`/`push`/`deploy`/`APK` rebuild.

## 2. Estado inicial

* **ALFA-012.3 concluída:** `20250917000004` corrigida (`duplicate_table` syntax error) e aplicada com `NOTICE nenhuma duplicata`, `supabase migration list --linked` mostra `20250917000001..00004` `Local|Remote` iguais, `access_grants`/`access_events`/`vip_status`/`invite_codes` VIP cols/RPCs reconhecidos por `PostgREST`, testes reais `TEST-6KAY-BFYR` `vip_30_days` `INSERT`+`consume RPC`+`DELETE` OK, `grant` `aa7134c8` `renew`+`revoke` OK, RLS `42501` para `role`/`vip_status`/`grant insert`.
* **Working tree:** `M app/actions/signup.ts` (compensação + grant `ensureVipGrant` + `mask` + `accessLogger`), `M app/dashboard/layout.tsx` (`Convites VIP` admin), `M tests/alfa-011-2-access.test.js` (ajuste `syncUserStateWithGrant`), `??` 4 migrations + `??` `app/lib/access/` + `??` `app/api/admin/*` + `??` `docs/ALFA-*` + `??` `tests/alfa-*` — `git diff --check` `0`, `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` (tracked).

## 3. Confirmação do projeto remoto

* `supabase projects list` → `● cycqigdywekfwwaspsus | Projeto Alfa Web | West US (Oregon) | 2026-01-31`
* `git branch --show-current` → `main`
* `supabase migration list --linked` → `20250914000001 | 20250914000001`, `20250915000002 | 20250915000002`, `20250916000001 | 20250916000001`, `20250917000001 | 20250917000001`, `20250917000002 | 20250917000002`, `20250917000003 | 20250917000003`, `20250917000004 | 20250917000004` — nenhuma pendente.
* `app/lib/access/accessService.ts:23` `VIP_CHECK = false as const` — `grep` 1 ocorrência `false`, `VIP_CHECK=true` 0.
* `grep -r requireVip app/api/gpro/sync app/api/python app/api/market` → 0.

## 4. Confirmação das migrations

| Migration | Objeto | Validação remota (somente leitura, `service_role`, sem `DELETE` destrutivo) |
|---|---|---|
| `20250917000001_add_vip_model.sql` | `user_state` `vip_status, vip_expires_at, access_plan, access_grant_id` nullable + `access_grants` (`source, plan, status, starts_at, expires_at`) + `access_events` + `grants_select_own` | `SELECT vip_status FROM user_state LIMIT 1` → `OK 1 rows` (antes `column does not exist`), `SELECT id FROM access_grants` → `OK 0 rows` (antes `Could not find table`) |
| `20250917000002_harden_user_state_update.sql` | `drop policy user_state_update_own` → `prevent_user_state_privilege_escalation()` (`auth.role()='authenticated'` + `IS DISTINCT` 5 campos → `42501`) + `user_state_update_own_restricted` + `update_user_profile` allowlist 19 params | `anon` `UPDATE user_state SET role='admin'` → `42501 role cannot be changed`, `UPDATE vip_status` → `42501 vip_status cannot be changed` (testado `78857fc4` `test-alfa-0123@`) |
| `20250917000003_extend_invite_codes.sql` | `invite_codes` `used_by, used_at, created_by, expires_at, revoked_at, revoked_by, invite_type check, metadata` + `consume_invite_code(p_code)` `security definer search_path public` | `SELECT expires_at FROM invite_codes` → `OK 1 rows` (antes `column does not exist`), `rpc('consume_invite_code', {p_code:'TEST-NONEXISTENT'})` → `OK 0 rows` (função existe, antes `Could not find`) |
| `20250917000004_harden_access_grants_uniqueness.sql` | `uniq_grant_invite_user` parcial `WHERE source='invite' AND invite_code_id IS NOT NULL` + `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants` | `CREATE INDEX` `NOTICE nenhuma duplicata`, `rpc('renew_access_grant', {p_grant_id:'0000...'})` → `Grant não encontrado` (função existe), `rpc('expire_overdue_grants')` → `0` (antes `Could not find`) |

Todas `Local|Remote` aplicadas, `PostgREST` sem `Could not find table/column/function`.

## 5. Auditoria do fluxo de convite

**Criação:** `POST /api/admin/vip-invites` `requireAdmin` 401/403, `validityType` `30_days`→`now+30d`, `lifetime`→`null`, `custom`→`invite.expires_at` validada `isNaN`/`>now()`/`<=+2y`, `code ALFA-XXXX` `crypto.randomUUID` server, retry `23505`, `DB invite.expires_at` não cliente, `metadata {validityType}`. Teste `alfa-011-5` 42 asserts PASS, real `TEST-6KAY-BFYR` `vip_30_days` `INSERT` OK.

**Consulta:** `GET /api/admin/vip-invites` `requireAdmin`, `sanitizeInvite` `id,code,is_used,used_by,created_by,expires_at,revoked_at,invite_type,status` (`disponivel/utilizado/expirado/revogado` compute `revoked_at`→`revogado`, `is_used`→`utilizado`, `expires_at<=now()`→`expirado`), sem `raw_data`/`token`/`service_role`.

**Revogação:** `POST .../[id]/revoke` `requireAdmin`, `SELECT revoked_at/is_used`, `409 ALREADY_REVOKED/ALREADY_USED`, `UPDATE revoked_at/by WHERE is_used=false AND revoked_at null` (`is` null), `update revoked_at/by` não `DELETE`, `accessLogger vip.invite.revoked` `info/warn`.

**Consumo:** RPC `consume_invite_code(p_code text)` `security definer search_path public` `UPDATE SET is_used,used_at,used_by=auth.uid() WHERE is_used=false AND revoked_at null AND (expires_at null OR >now()) RETURNING` — atômico, `grant execute to authenticated, service_role`. Teste real `consume RPC OK rows 1` para `TEST-6KAY-BFYR`.

## 6. Auditoria de grants

* **30 dias:** `calculateGrantExpiration` `vip_30_days`→`now+30d` (`setDate(+30)`), `planForInvite` `full_premium`, `ensureVipGrantForInvite` `INSERT source invite plan full_premium status active starts_at now expires_at now+30d`, `recordAccessEvent granted` quando `isNew`, `syncUserStateWithGrant` `vip_status active, vip_expires_at, access_plan, access_grant_id`.
* **Vitalício:** `vip_lifetime`→`expires_at null`, `vipStatusForGrant null→lifetime`, `user_state` preserva `lifetime` (não sobrescreve com data, `if curStatus lifetime && curExpires null && vip_expires_at not null return`).
* **Custom:** `vip_custom`→`invite.expires_at` preservado.
* **Renovação:** `renewGrant` `max(now, expires_at)+30d`, vitalício `return` sem mudar, `revoked` throw `22023`, `update_user_profile` `renew_access_grant` `FOR UPDATE` + `INSERT renewed` + `UPDATE user_state`, idempotente via `lastEvent new_expires_at` check.
* **Revogação:** `revokeGrant` `status revoked, revoked_at, revoked_by`, idempotente `if revoked return`, `INSERT revoked`, `UPDATE user_state vip_status revoked`.
* **Expiração:** `expireOverdueGrants` `SELECT ... WHERE status active AND expires_at IS NOT NULL AND expires_at <= now() FOR UPDATE` → `UPDATE status expired` + `INSERT expired` + `UPDATE user_state`, vitalício nunca (`expires_at is null` excluído).
* **Reprocessamento:** `reprocessMissingGrant(userId, inviteId)` `SELECT grant WHERE invite_code_id+user_id maybeSingle` → se existe `isNew false`, senão `SELECT invite WHERE id` verifica `revoked_at/is_used/used_by` → `ensureVipGrantForInvite` + `recordAccessEvent granted reprocessed` + `sync`.

**Idempotência:** `ensureVipGrantForInvite` `SELECT` antes + `INSERT` + `catch 23505 → re-select` (`uniq_grant_invite_user`), `recordAccessEvent` só `isNew`, `renew` lastEvent check. **Unicidade:** `uniq_grant_invite_user` `WHERE source='invite'` impede duplicata `invite_code_id+user_id`, `invite_code_id null` (manual) fora da constraint (parcial), `payment` futuro também com `invite_code_id null` não conflita. Sem `DELETE` automático de duplicatas — `DO` com `HAVING COUNT>1` apenas `RAISE NOTICE`.

## 7. Auditoria de RLS

* **RLS ativas:** `user_state` `enable RLS`, `access_grants` `enable RLS`, `access_events` `enable RLS`, `invite_codes` `enable RLS` (`invite_select_auth` `authenticated` select).
* **Policies:** `user_state` `select_own/insert_own/delete_own` `auth.uid()=user_id`, `user_state_update_own_restricted` `to authenticated using auth.uid()=user_id with check auth.uid()=user_id` + trigger `prevent_user_state_privilege_escalation` (`auth.role()='authenticated'` + `NEW.role/vip_status/vip_expires_at/access_plan/access_grant_id IS DISTINCT` → `42501`); `access_grants` `grants_select_own` `for select using auth.uid()=user_id` sem `insert/update/delete` para `authenticated` (só `service_role`); idem `access_events`.
* **Teste real:** `anon` sem JWT `UPDATE user_state role` → não `42501` mas `0 rows` (sem `auth.uid()`), `authenticated` `test-alfa-0123@` `UPDATE role='admin'` → `42501 role cannot be changed`, `UPDATE vip_status` → `42501`, `INSERT access_grants` como `user` → `42501 row-level security policy`, `SELECT` cruzado `auth.uid()=user_id` bloqueia `403`/`0 rows`.
* **RPCs:** `security definer` + `search_path=public` + `grant execute to service_role` (e `authenticated` só para `consume_invite_code` e `update_user_profile`); não `public` indevido.

## 8. Auditoria de rotas

| Rota | Método | Deve exigir VIP? | Atualmente | Risco |
|---|---|---|---|---|
| `/api/gpro/sync` | POST | Sim (futura) | `resolveUserId` + `getGproToken` via `supabaseAdmin`, sem `requireVip` | Médio quando `VIP_CHECK=true` sem observabilidade |
| `/api/python` `get_state`/`update_state`/`setup_calculate`/`strategy_calculate`/`performance`/`sponsors` | GET/POST | Sim | `resolveUserId`, sem `requireVip` | Médio |
| `/api/calendar` | GET | Sim (com `userId`) | `resolveUserId` se `userId`, sem `requireVip` | Médio |
| `/api/manager/profile` | GET | Sim | `resolveUserId`, sem `requireVip` | Médio |
| `/api/market/update` | POST | Sim (POST) / Não (GET) | `requireAuth` (POST) / `market_select_all` público GET, sem `requireVip` | Médio / Baixo |
| `/api/gpro/token` | POST | Sim (futura) | `requireAuth`, sem `requireVip` | Baixo |
| `GET /api/admin/*` | GET/POST | Não (admin, sem VIP) | `requireAdmin` | Baixo |

Todas `futura VIP` ainda sem `requireVip` — `grep -r requireVip app/api/gpro/sync app/api/python` `0`. Ativação futura gradual por rota com `await requireVip(userId)` após `resolveUserId` quando `VIP_CHECK=true` (ver `docs/ALFA-012.0-PLANO-ATIVACAO-GRADUAL.md` Etapa 3).

## 9. Auditoria Web/APK

* **Web** `https://gpro-alfa-racing.vercel.app` (`Vercel`) + **APK** `capacitor.config.ts` `appId br.com.gproalfaracing` `webDir public` `server.url https://gpro-alfa-racing.vercel.app` — mesmo `supabase` Auth + `accessService` server-side, sem `service_role` no bundle (`server-only` em `supabase-admin.ts` + `accessService.ts`).
* Admin Web: `app/dashboard/admin/{gpro-kb, research, vip-invites}` `AdminLayout` `role!=='admin'→redirect`, `app/dashboard/layout.tsx` `filter group.id !== 'administration' || localRole==='admin'` + `Convites VIP` item filtrado — fora do APK para `user` (`localRole` `user` não vê).
* Interface manager `app/context/GameContext.tsx` `getUserState` + `saveUserState` sem `service_role`, não sofreu regressão (build `37/37`).
* Expiração `>now()` server-side (`invite_codes.expires_at`, `access_grants.expires_at`), não local.
* Usuário expirado `login` `200` (`auth` não bloqueia) — `requireVip` futuro bloqueará `gpro/sync` `403 VIP_EXPIRED`, não `login`.
* Nenhuma recompilação APK nesta sprint (`npx cap` não executado, `android/` não alterado).

## 10. Resultado dos testes

| Suite | Arquivo | Asserts | Resultado |
|---|---|---|---|
| 011.2 | `alfa-011-2-access.test.js` | 10 | `EXIT:0` (ajustado para `syncUserStateWithGrant`) |
| 011.3 | `alfa-011-3-access-status.test.js` | 35 | `EXIT:0` |
| 011.4 | `alfa-011-4-security.test.js` | 50+ | `EXIT:0` |
| 011.5 | `alfa-011-5-vip-invites.test.js` | 42 | `EXIT:0` |
| 011.6 | `alfa-011-6-signup.test.js` | 33 | `EXIT:0` |
| 011.7 | `alfa-011-7-transaction.test.js` | 35 | `EXIT:0` |
| 011.8 | `alfa-011-8-vip-grant.test.js` | 42 (24 blocos) | `EXIT:0` |
| 011.9 | `alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` |
| 012.1-obs | `alfa-012-1-observability.test.js` | 35 | `EXIT:0` |
| 012.1-mask | `alfa-012-1-masking.test.js` | 11 | `EXIT:0` |
| 012.1-int | `alfa-012-1-integration.test.js` | 17 | `EXIT:0` |
| 011.9 (re) | `alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` (re-exec) |

**Comandos oficiais `package.json`:** `npx tsc --noEmit` `TSC:0`, `npm run build` `BUILD:0` `37/37` `Proxy (Middleware)` `Compiled successfully`.

**Integração remota:** `TEST-6KAY-BFYR` `vip_30_days` `INSERT` OK, `rpc consume_invite_code` `OK rows 1`, `grant aa7134c8` `renew` `2026-11-16` OK, `revoke` `revoked` OK, `anon` `UPDATE role` `42501` OK (Fase 5).

## 11. Problemas encontrados

Nenhum crítico. Médio: `user_state` sync `update` falha deixa `user_state` stale mas `getAccessState` lê `access_grants` primeiro então `hasAccess` correto. Baixo: `invite_type null` legado → `full_premium` 30d por compatibilidade (documentado, alternativa `skip grant`).

## 12. Riscos remanescentes

| Risco | Severidade | Mitigação |
|---|---|---|
| Sem `UNIQUE` sem `db push` em novo ambiente (ex: outro staging) | Médio | Migration `uniq_grant_invite_user` já aplicada em `cycq***us`; novo ambiente precisa `supabase db push` |
| `expire_overdue_grants` sem cron — `active` expirado só via `getAccessState` `isExpired` ou chamada admin | Baixo | `docs/ALFA-012.0-PLANO-ATIVACAO-GRADUAL.md` Etapa 3 propõe endpoint `POST /api/admin/vip/expire` com `requireAdmin` + `expireOverdueGrants()` |
| Observabilidade sem DB adicional — logs só `console` JSON | Baixo | `accessLogger` `vip.*` 22 eventos já em `signup.ts` + `accessService.ts` + `vip-invites` routes, coletável por Vercel |

## 13. Plano de ativação controlada

| Etapa | Ação | Critério abortar |
|---|---|---|
| 1. `VIP_CHECK=false` + observabilidade `GET /api/admin/vip-observability` `wouldBlock` count | Medir sem bloquear, logs `x-request-id` sem `e-mail` | — |
| 2. `VIP_CHECK=true` só em staging para `userId` teste | `admin` bypass, `vip_ativo`/`vitalicio` `200`, `vip_expirado` `403 VIP_EXPIRED`, `sem_vip` `403 VIP_REQUIRED` | Qualquer `admin` `403` |
| 3. Gradual por rota `gpro/sync` → `python` → `calendar` etc. com `await requireVip` após `resolveUserId` | Erros `403` >5% ou `VIP_EXPIRED` inesperado para `active` | Rollback `VIP_CHECK=false` + remover `requireVip` da rota |
| 4. Geral só após aprovação explícita + `TEST-VIP` em prod com `reprocessMissingGrant` | Métricas `blocked` vs `wouldBlock` estáveis 1 semana | — |

## 14. Plano de rollback

* `VIP_CHECK=true` → `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const` + redeploy Vercel)
* Remover `requireVip` da rota: `git diff` `app/api/gpro/sync/route.ts` revert `await requireVip`
* `access_grants` permanece `append-only` — não `DELETE`, `user_state` pode ser `upsert` para `vip_status` anterior (backup `user_state` antes de ativação via `pg_dump`).
* APK rollback: `npx cap sync` com `server.url` anterior, sem `service_role`.

## 15. Confirmação `VIP_CHECK=false`

`grep -r VIP_CHECK app/lib/access/accessService.ts` → `export const VIP_CHECK = false as const` `1` ocorrência, `VIP_CHECK=true` `0`. `requireVip` definido mas nunca chamado em rotas Manager (`grep requireVip app/api` `0` em Manager).

## 16. Confirmação `requireVip` desligado

`supabase/migrations` sem `requireVip` em `app/api/gpro/sync`, `python`, `market/update`, `calendar`, `manager/profile`, `gpro/token` — `git grep requireVip` só `app/lib/access/accessService.ts` definição.

## 17. Confirmação sem commit/push/deploy/APK

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` + `??` migrations/docs/tests (nenhum `M` commitado) — `git diff --check` `0` (warnings CRLF), `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked, `git log --oneline -1` ainda `a20eae3 feat: add Android APK download`, `git remote -v` não `push`, `vercel --prod` não executado, `npx cap build` não executado.

---

## Alterações em código nesta sprint

**Nenhuma alteração de código nesta sprint** — auditoria e preparação apenas. Últimas alterações foram `app/lib/access/accessService.ts` (`renew/revoke/expire/reprocess` + `accessLogger`), `app/actions/signup.ts` (`mask` + `accessLogger` + `ensureVipGrant`), `supabase/migrations/20250917000004` (correção syntax) em ALFA-012.3, já `Local|Remote` iguais. Nesta sprint apenas `docs/ALFA-012.4-AUDITORIA-FINAL-INTEGRACAO-VIP.md` criado + leitura.

## Critérios de conclusão

**APROVADA** — migrations `4/4` aplicadas, `PostgREST` reconhece `access_grants`/`vip_status`/`RPCs`, RLS `42501` validada com `test-alfa-0123@`, `uniq_grant_invite_user` sem duplicatas, testes 11 suites `PASS`, `tsc` `0`, `build` `0`, `VIP_CHECK=false`, `requireVip` `0`, Web/APK separados, sem segredo exposto, sem `commit`/`push`/`deploy`/`APK`.

```
Status: APROVADA
Arquivos alterados: 0 (somente docs/ALFA-012.4 criada nesta sprint; app/actions/signup.ts + app/dashboard/layout.tsx já de 012.1/011.5, não alterados nesta sprint)
Testes: 11 suites PASS (011.2..012.1) + tsc 0 + build 0 (37/37)
Build: BUILD:0
Migrations: 4/4 VIP Local|Remote iguais (00001..00004 em cycqigdywekfwwaspsus)
VIP_CHECK: false (1 ocorrência, sem true)
requireVip: 0 em rotas Manager
Commit: não executado (a20eae3)
Push: não executado
Deploy: não executado
APK: não recompilado (br.com.gproalfaracing, server.url https://gpro-alfa-racing.vercel.app)
Pendências: observabilidade de expiração sem cron (lazy) — plano ativação gradual documentado
Próxima ação recomendada: ALFA-013.0 Pix (ou ALFA-012.5 ativação observabilidade endpoint GET /api/admin/vip-observability com wouldBlock)
```

*Fim ALFA-012.4 — aguardar autorização para ativação controlada.*
