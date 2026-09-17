# ALFA-012.1 — Relatório Observabilidade e Testes Reais VIP

> **Sprint:** ALFA-012.1 — Observabilidade segura + testes reais de banco
> **Data:** 2026-09-17
> **Base:** ALFA-012.0 `Pronto com pendências` (pendências: testes reais, observabilidade, sync não transacional, compensação deleteUser, VIP_CHECK false)
> **Flag:** `VIP_CHECK=false` (inalterado) — `access_grants` fonte primária, `user_state` cache
> **Status:** **Aprovado com pendências** — observabilidade implementada, testes reais parcialmente executados (migrations remotas não aplicadas)

---

## 1. Objetivo

Implementar observabilidade segura e validar modelo VIP contra Supabase remoto antes de `requireVip`.

## 2. Escopo

* Criar `app/lib/access/accessLogger.ts` com níveis e masking
* Integrar logs em convites, cadastro e grants (ciclo de vida)
* Verificar migrations remotas (`user_state` vip_*, `access_grants`, `access_events`, `invite_codes` cols, índices, RLS, RPCs)
* Testes reais com dados `TEST-*` isolados (sem `DELETE` destrutivo em reais, sem usuários reais)
* Testes concorrência/idempotência (estático/contratual)
* Revalidar segurança e executar suite completa + `tsc`/`build`

## 3. Arquivos alterados

| Arquivo | Ação | Detalhe |
|---|---|---|
| `app/lib/access/accessLogger.ts` | **criado** 95 linhas | `LogLevel info/warn/error`, `VipEvent` 22 eventos, `maskEmail/Code/UserId/GrantId/InviteId`, `sanitizeMeta` bloqueia `password/token/service_role/raw_data`, `nextCorrelationId`, `logVipEvent` JSON `timestamp/env/level/event/correlationId/userId/grantId/inviteId/email/code/result/reason/duration/errorCode/meta`, `accessLogger.info/warn/error` |
| `app/lib/access/accessService.ts` | **alterado** +30 linhas | `import accessLogger, mask*`, `ensureVipGrantForInvite` log `created/reprocessed/failed`, `recordAccessEvent` log `granted/renewed/revoked/expired`, `syncUserStateWithGrant` log `started/succeeded/failed`, `renewGrant/revokeGrant/expireOverdueGrants/reprocessMissingGrant` log `started` |
| `app/actions/signup.ts` | **alterado** +25 linhas | `import accessLogger, maskUserId/InviteId, nextCorrelationId`, `correlationId=nextCorrelationId(), t0`, `vip.signup.started` + `vip.signup.auth_created` + `vip.invite.consume.started/succeeded/failed` + `vip.signup.invite_consumed` + `vip.signup.compensation.started/succeeded/failed` + `vip.signup.grant_created/failed` + `vip.grant.sync.*`, logs `slice(0,80)` + `slice(0,8)***` |
| `app/api/admin/vip-invites/route.ts` | **alterado** +12 linhas | `import accessLogger`, `correlationId`, `vip.invite.created` `succeeded/failed` com `inviteIdMasked`, `durationMs`, `validityType` |
| `app/api/admin/vip-invites/[id]/revoke/route.ts` | **alterado** +10 linhas | `vip.invite.revoked` `succeeded/failed/warn` |
| `tests/alfa-012-1-observability.test.js` | **criado** 65 linhas | 22 eventos + integração + VIP_CHECK + masking |
| `tests/alfa-012-1-masking.test.js` | **criado** 35 linhas | `maskEmail/Code/UserId/GrantId` unit |
| `tests/alfa-012-1-integration.test.js` | **criado** 30 linhas | fluxo 7 etapas + ciclo vida + server-only |
| `docs/ALFA-012.1-RELATORIO-OBSERVABILIDADE-TESTES.md` | **criado** | este relatório |

Nenhuma `payments/orders/premium_plans`, nenhum `VIP_CHECK=true`, nenhum `requireVip` em Manager, nenhum `APK` rebuild.

## 4. Migrations verificadas (remoto)

**Método:** `node` com `supabaseAdmin` `createClient(SERVICE_ROLE)` — `SELECT` limitado, `INSERT TEST-*` + `DELETE` teste isolado (sem `DELETE` destrutivo em reais, sem `TRUNCATE`).

| Migration | Local | Remoto | Evidência |
|---|---|---|---|
| `vip_status, vip_expires_at, access_plan, access_grant_id` em `user_state` | existe `add column if not exists` | **não existe** `vip_status does not exist` | `SELECT vip_status LIMIT 1` → `column does not exist` |
| `access_grants` tabela | `create table if not exists` | **não existe** `Could not find table` | `SELECT id FROM access_grants` → `Could not find` |
| `access_events` | `create table if not exists` | **não verificada diretamente** (depende de `access_grants`) | — |
| `invite_codes` cols `expires_at, invite_type, used_by` | `add column if not exists` | **não existe** `expires_at does not exist` | `SELECT expires_at` → `column does not exist` (insert `code,is_used` OK) |
| Índices `uniq_grant_invite_user`, `idx_invite_codes_*` | `create index if not exists` | **não criados** (tabela ausente) | — |
| Policies `grants_select_own`, `user_state_update_own_restricted` | `create policy` | **não verificadas** (tabela ausente) | — |
| RPCs `consume_invite_code`, `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants` | `create or replace function security definer search_path=public` | **não existe** `Could not find function renew_access_grant` | `rpc renew_access_grant` → `not found` |
| `user_state` `update_user_profile` allowlist | `security definer` | **não verificada** | — |

**PostgREST:** reconhece `invite_codes (id, code, is_used, created_at)` básico, não reconhece colunas VIP — `notify pgrst` local não refletiu remoto porque `supabase db push` não executado (sem `SUPABASE_ACCESS_TOKEN`/`staging`).

**Conclusão:** migrations existem localmente (`supabase/migrations/20250917000001`..`00004` 4 arquivos, 20KB) mas **não aplicadas** no remoto `cycqigdywekfwwaspsus`. Não assumir aplicada.

## 5. Observabilidade implementada

**Arquivo:** `app/lib/access/accessLogger.ts:1` `import 'server-only'`

* **Níveis:** `info` (fluxo normal), `warn` (revoke/consume failed), `error` (grant_failed, compensation.failed, sync.failed) — `logVipEvent` `console.log/warn/error` JSON.
* **Eventos 22:** `vip.invite.created/revoked/consume.started/succeeded/failed` (inviteRoute + signup), `vip.signup.started/auth_created/invite_consumed/grant_created/grant_failed/compensation.started/succeeded/failed` (signup), `vip.grant.created/reprocessed/renewed/revoked/expired/sync.started/succeeded/failed` (accessService), `vip.access.denied` (accessService `requireVip` futuro).
* **Correlação:** `nextCorrelationId()` `vip-${Date.now().36}-${counter}` por `signup` e por `POST /vip-invites` (durationMs).
* **Sem DB adicional:** logs via `console.*` JSON — coletável por Vercel logs, sem tabela `logs`.

## 6. Eventos registrados (pontos críticos)

| Fluxo | Ponto | Evento | Payload mascarado |
|---|---|---|---|
| Convites criação | `POST /api/admin/vip-invites` sucesso | `vip.invite.created` `info` | `inviteIdMasked, userIdMasked, validityType, durationMs` |
| Convites revogação | `POST .../revoke` sucesso/falha | `vip.invite.revoked` `info/warn/error` | `inviteIdMasked, result` |
| Cadastro início | `signup.ts` topo | `vip.signup.started` `info` | `emailMasked, codeMasked` |
| Cadastro Auth | após `createUser` | `vip.signup.auth_created` `info` | `userIdMasked, emailMasked, durationMs` |
| Consumo invite | antes de `UPDATE` | `vip.invite.consume.started` `info` | `inviteIdMasked, userIdMasked` |
| Consumo sucesso | `update` retorna `id` | `vip.invite.consume.succeeded` `info` + `vip.signup.invite_consumed` | `inviteIdMasked, userIdMasked` |
| Consumo falha | `!consumed` | `vip.invite.consume.failed` `warn` | `reason` |
| Compensação | `deleteUser` | `vip.signup.compensation.started/succeeded/failed` `info/error` | `userIdMasked, reason` |
| Grant criação | `ensureVipGrantForInvite` `isNew true` | `vip.grant.created` `info` | `grantIdMasked, userIdMasked, inviteIdMasked` |
| Grant reprocess | `isNew false` | `vip.grant.reprocessed` `info` | `already_exists` |
| Grant renew/revoke/expire | `renewGrant`/`revokeGrant`/`expireOverdueGrants` | `vip.grant.renewed/revoked/expired` `info` | `grantIdMasked` |
| Sync | `syncUserStateWithGrant` | `vip.grant.sync.started/succeeded/failed` `info/error` | `grantIdMasked, userIdMasked` |

Sem alterar semântica — logs após `await` sucesso, antes de `return`, não mudam `is_used`/`grant`.

## 7. Regras de masking

| Dado | Helper | Saída | Nunca logado |
|---|---|---|---|
| `email` | `maskEmail` `slice(0,2)+'***'+slice(at)` | `jo***@hotmail.com` | `joelgonn@hotmail.com` completo |
| `code` | `maskCode` `slice(0,4)+'***'+slice(-2)` | `ALFA***D4` | `ALFA-A1B2-C3D4` |
| `userId` | `maskUserId` `slice(0,8)+'***'` | `12345678***` | `uuid` completo |
| `grantId`/`inviteId` | `maskGrantId/MaskInviteId` `slice(0,8)+'***'` | `bb5166e3***` | `uuid` completo |
| `metadata` | `sanitizeMeta` bloqueia `password, token, service_role, raw_data, code, email`, trunca >120 | `{invite_type: vip_30_days}` | `raw_data` |

`sanitizeMeta` + `slice(0,80)` para `err.message`. Testado em `tests/alfa-012-1-masking.test.js` 11 asserts.

## 8. Testes reais executados

**Ambiente:** Supabase `cycqigdywekfwwaspsus` com `SERVICE_ROLE_KEY` de `.env.local` — **staging não isolado**, então dados `TEST-*` apenas e `DELETE` apenas do próprio `TEST-*` criado (sem `DELETE` destrutivo, sem `TRUNCATE`, sem usuários reais).

| # | Cenário | Comando | Resultado | Evidência segura |
|---|---|---|---|---|
| 1 | Migration `vip_status` existe? | `SELECT vip_status FROM user_state LIMIT 1` via `supabaseAdmin` | **FAIL** — `column does not exist` | `vip_status col exists? column does not exist` |
| 2 | `access_grants` existe? | `SELECT id FROM access_grants` | **FAIL** — `Could not find table` | `access_grants Could not find` |
| 3 | `invite_codes` `expires_at` | `SELECT expires_at FROM invite_codes` | **FAIL** — `column does not exist` | `invite_codes cols column does not exist` |
| 4 | RPC `renew_access_grant` | `rpc('renew_access_grant', {p_grant_id: '0000...'})` | **FAIL** — `Could not find function` | `rpc renew exists? Could not find` |
| 5 | Criar convite `TEST-*` básico | `INSERT invite_codes(code='TEST-CYXT', is_used=false) SELECT` | **PASS** — `[{"id":"bb5166e3...","code":"TEST-CYXT"}]` | `TEST-CYXT` (isolado, `DELETE` após) |
| 6 | Limpeza `TEST-*` | `DELETE WHERE id=bb5166e3...` | **PASS** — `ok` | `cleanup delete ok` |

Testes 5-6 foram **únicos reais** com `TEST-*` prefixo, `DELETE` apenas do próprio id criado (não `DELETE FROM invite_codes WHERE code LIKE 'TEST-%'` sem `id`). Demais testes de convite (`vip_30_days`, `vip_lifetime`, `vip_custom`, limite 2y, consumir, revogar, expirado) **não executados** com dados reais porque colunas VIP ausentes no remoto — tentativas com `expires_at` falhariam.

**Conclusão REAL vs ESTÁTICO:** `2` testes reais `PASS` (insert básico + cleanup), `9` testes `vip_*` **não executados** por falta de migration remota — documentado como pendência, não simulado como aprovação.

## 9. Testes não executados (e por quê)

* Criação `vip_30_days`/`vip_lifetime`/`vip_custom` com `expires_at`/`invite_type` — remoto não tem `expires_at`, `invite_type` → `column does not exist` (requer `supabase db push`).
* Consumo válido/atômico (`UPDATE ... used_by`) — `expires_at` ausente, mas `is_used` básico funcionaria; não testado com `TEST-*` para não deixar `TEST-*` usado sem cleanup grant.
* Grant `access_grants` + `access_events` + `user_state` sync — tabela `access_grants` não existe remoto, impossível.
* Renovação/revogação/expiração/reprocessamento — RPCs não existem remoto.
* Concorrência real (`Promise.all` 2× `consume`) — requer `access_grants` + `invite_codes` VIP cols.

Todos declarados **não executados por migrations remotas não aplicadas**, não por falha de código.

## 10. Resultados por cenário (estático + real limitado)

| Cenário | Estático (contratual) | Real (Supabase) |
|---|---|---|
| Criação `vip_30_days` | PASS (`route.ts` `validityType 30_days` + `expires_at now+30d`) | **não executado** — `expires_at` missing |
| Criação `vip_lifetime` | PASS (`expires_at null`) | não executado |
| Criação `vip_custom` | PASS (`customExpiresAt` validada) | não executado |
| Rejeitar >2y | PASS (`max +2y` check) | não executado |
| Consumir válido | PASS (`UPDATE ... WHERE is_used=false`) | não executado (apenas `TEST-CYXT` básico is_used) |
| Consumir duplicado | PASS (`is_used true → ALREADY_USED`) | não executado |
| Revogar | PASS (`revoked_at` 409) | não executado |
| Consumir revogado | PASS (`revoked_at` check) | não executado |
| Expirado | PASS (`expires_at <= now()` → EXPIRED) | não executado |
| Inexistente/inválido | PASS (`INVITE_NOT_FOUND/INVALID`) | não executado |
| Cadastro Auth | PASS (`createUser` antes de consumir) | não executado real (sem TEST user) |
| Grant/event/sync | PASS (`ensureVipGrant` + `recordAccessEvent` + `syncUserState`) | não executado (tabela ausente) |

Evidências estáticas: `tests/alfa-011-*.js` 7 suites + `tests/alfa-012-1-*.js` 3 suites — todos `PASS` (ver Fase 7).

## 11. Evidências seguras (sem sensível)

* `TEST-CYXT` `bb5166e3-25fc-42a1-b650-1f0f280559a3` — `TEST-*` prefixo, `DELETE` por `id` específico, não `TRUNCATE`.
* `cycqigdywekfwwaspsus` URL já em `.env.local` (não nova).
* Nenhum `e-mail` completo em logs — `jo***@...` + `ALFA***` via `mask*`.

## 12. Riscos encontrados

* **Migrations não aplicadas remoto:** `vip_status`, `access_grants`, `expires_at` ausentes — `supabase db push` nunca executado (`supabase/.temp` existe mas sem deploy). Risco **médio** — local `supabase/migrations` 4 arquivos não refletem remoto; `PostgREST` não reconhece novas cols (select `vip_status` falha).
* **Observabilidade sem DB:** logs só `console` JSON — Vercel coleta, mas sem `access_events` query sem `access_grants` remoto.
* **Sincronização não transacional `access_grants→user_state`:** `syncUserStateWithGrant` `update` + fallback `upsert` — já documentado em ALFA-011.8, persiste.
* **Compensação `deleteUser` pode falhar:** `catch` loga `Incidente compensacao deleteUser falhou` com `masked`, mas sem `service_role` staging não testado.

## 13. Limitações

* Sem `staging` Supabase isolado — testes reais em `cycqigdywekfwwaspsus` (produção like) com `TEST-*` mínimo.
* Sem `supabase db push` — migrations locais não validadas remotamente; `PostgREST` schema cache desatualizado.
* Concorrência `23505` validada só por `includes('23505')` estático, não `Promise.all` real.

## 14. Situação do Supabase remoto

* URL `https://cycqigdywekfwwaspsus.supabase.co` (`NEXT_PUBLIC_SUPABASE_URL` em `.env.local`)
* `invite_codes` existe com `id, code, is_used, created_at` (insert `TEST-CYXT` OK)
* `user_state` existe sem `vip_*` (select `vip_status` fail)
* `access_grants` não existe
* RPCs `renew_access_grant` etc. não existem
* RLS `invite_codes` `invite_select_auth` (`authenticated` select) permanece (não verificada remotamente, mas local `20250914000001`)

## 15. Situação Web/APK

* Web `Vercel` `https://gpro-alfa-racing.vercel.app` + `capacitor.config.ts` `appId br.com.gproalfaracing` `server.url` igual — ambos `VIP_CHECK=false` (observabilidade apenas).
* APK não contém `service_role` (`server-only` em `supabase-admin.ts` + `accessService.ts`)
* Sem lógica local VIP — expiração `>now()` server-side (`invite_codes.expires_at` e `access_grants.expires_at` quando tabela existir)
* Usuário expirado ainda `login` `200` (`auth.admin` não bloqueia) — `hasAccess` só em `getAccessState` com `VIP_CHECK=false` → `allowed true`
* Admin bypass `isAdmin` via `user_state.role`
* Nenhuma funcionalidade administrativa no APK (`/dashboard/admin/*` `requireAdmin` 401/403 fora Web)

## 16. Recomendação para ALFA-012.2

**ALFA-012.2 — Validação remota completa + `VIP_CHECK` observability**

1. Aplicar `supabase db push` em staging (ou `npx supabase db push --linked` com `SUPABASE_ACCESS_TOKEN`) — verificar `supabase migration list` + `SELECT column_name FROM information_schema.columns WHERE table_name='user_state'` contém `vip_status`.
2. Re-executar Fase 4 real com `TEST-VIP-*` isolado: `POST /api/admin/vip-invites {validityType:30_days}` → `expires_at` + `invite_type vip_30_days` → `signup` com `TEST-VIP-...` → `SELECT access_grants, user_state, access_events` + `mask` logs.
3. Manter `VIP_CHECK=false`; não ativar `requireVip`; não `rebuild` APK.

## 17. Confirmação

* `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const`) — verificado `grep` 1 ocorrência, sem `VIP_CHECK=true`.
* `requireVip` **não** foi inserido em rotas Manager (`grep -r requireVip app/api/gpro/sync app/api/python app/api/market app/api/calendar app/api/manager/profile` → 0).
* Não houve `commit` (`git status --porcelain` mostra `M`/`??` mas `git log --oneline -1` ainda `a20eae3`), não houve `push` (`git remote -v` não executou `push`), não houve `deploy` (`vercel --prod` não executado), não houve `rebuild APK` (`npx cap build` não executado).

---

## Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Observabilidade | `node tests/alfa-012-1-observability.test.js` | `EXIT:0` 35 asserts |
| Masking | `node tests/alfa-012-1-masking.test.js` | `EXIT:0` 11 asserts |
| Integração | `node tests/alfa-012-1-integration.test.js` | `EXIT:0` 17 asserts |
| 011.2 | `node tests/alfa-011-2-access.test.js` | `EXIT:0` |
| 011.3 | `node tests/alfa-011-3-access-status.test.js` | `EXIT:0` |
| 011.4 | `node tests/alfa-011-4-security.test.js` | `EXIT:0` |
| 011.5 | `node tests/alfa-011-5-vip-invites.test.js` | `EXIT:0` |
| 011.6 | `node tests/alfa-011-6-signup.test.js` | `EXIT:0` |
| 011.7 | `node tests/alfa-011-7-transaction.test.js` | `EXIT:0` |
| 011.8 | `node tests/alfa-011-8-vip-grant.test.js` | `EXIT:0` |
| 011.9 | `node tests/alfa-011-9-grant-lifecycle.test.js` | `EXIT:0` |
| TypeScript | `npx tsc --noEmit` | `TSC:0` |
| Build | `npm run build` | `BUILD:0` 37/37 |

## Classificação

**Aprovado com pendências** — observabilidade segura implementada e validada estaticamente; testes reais de banco com `TEST-*` limitados a `invite_codes` básico (`TEST-CYXT` insert/delete OK) devido a migrations remotas não aplicadas (`vip_status`, `access_grants`, `expires_at` ausentes). Não classificado como `aprovado` pleno porque testes essenciais de grant com `TEST-VIP-*` não puderam ser executados sem `supabase db push`.

*Não houve commit, push, deploy ou rebuild APK nesta sprint. VIP_CHECK permanece false.*
