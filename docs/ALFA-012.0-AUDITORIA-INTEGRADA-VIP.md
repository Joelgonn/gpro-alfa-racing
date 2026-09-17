# ALFA-012.0 — Auditoria Integrada VIP

> **Sprint:** ALFA-012.0 — Auditoria integrada e preparação para ativação gradual
> **Data:** 2026-09-17
> **Stack:** Next.js 16, TypeScript, Supabase (Postgres + Auth + RLS), Capacitor Android `br.com.gproalfaracing`, Vercel
> **Flag:** `VIP_CHECK=false` (inalterada) — fonte primária `access_grants`, `user_state` só cache
> **Sprints base:** ALFA-011.1 (modelagem) → 011.9 (ciclo de vida)

---

## Resumo executivo

Arquitetura VIP concluída em 9 sprints sem `VIP_CHECK` ativo. Convites com `vip_30_days/vip_lifetime/vip_custom` (2 anos max), consumo atômico com compensação `deleteUser(newUserId)`, concessão idempotente `ensureVipGrantForInvite` + `uniq_grant_invite_user` parcial, ciclo de vida `renew/revoke/expire/reprocess` via `security definer` `search_path=public`, `user_state` protegido por `prevent_user_state_privilege_escalation` + `user_state_update_own_restricted` + RPC `update_user_profile` allowlist. Nenhum `premium_plans/orders/payments` criado, nenhuma rota Manager com `requireVip`, nenhum `service_role` no bundle, nenhum Pix. Auditoria integrada classifica **pronto com pendências** — pendências são observabilidade de expiração e validação com DB real (sem `supabase db push` nesta sprint).

---

## Arquivos auditados

| Área | Arquivo | Situação | Risco | Ação |
|---|---|---|---|---|
| **Acesso central** | `app/lib/access/accessService.ts` (686→~850 linhas) | OK — `server-only`, `supabaseAdmin` + `createClient` SSR, `VIP_CHECK=false`, `interpretGrant/pickBestGrant/calculateGrantExpiration/planForInvite/vipStatusForGrant/ensureVipGrantForInvite/recordAccessEvent/syncUserStateWithGrant/renewGrant/revokeGrant/expireOverdueGrants/reprocessMissingGrant` tipados, sem `payments/orders` | Baixo | Manter `server-only` |
| **Cadastro** | `app/actions/signup.ts` (181→168 linhas após hardening) | OK — normalização `trim/toUpperCase/replace`, preCheck `revoked/is_used/expires_at`, `createUser` antes de consumir, `UPDATE ... WHERE is_used=false AND revoked_at null AND (expires_at null OR >now)` + `deleteUser(newUserId)` compensação com `masked` logs, `user_state` insert/upsert, grant `ensureVipGrant`/`recordAccessEvent`/`sync` em `try/catch` separado | Baixo | ALFA-012 pode adicionar `reprocessMissingGrant` fallback se grant falhar |
| **Geração convite** | `app/actions/admin.ts` (38 linhas) | OK — `supabaseAdmin` `select role` + `crypto.randomUUID` `ALFA-XXXX` + `insert code,is_used:false` (legado, mantido para compatibilidade) | Baixo | Não alterar; novas criações via `POST /api/admin/vip-invites` |
| **APIs convites** | `app/api/admin/vip-invites/route.ts` (GET/POST) + `.../[id]/revoke/route.ts` (POST) | OK — `requireAdmin` 401/403, `supabaseAdmin`, `validityType 30_days/lifetime/custom` server calcula `expires_at` (30d/null/custom com limite 2y), `crypto.randomUUID` server, retry `23505`, `DB invite.expires_at` não cliente | Baixo | Manter |
| **Diagnóstico** | `app/api/admin/access-status/route.ts` (74 linhas) | OK — `GET` com `requireAdmin`, `getAccessState(admin.id)` sem `?userId`, `405` para outros métodos, resposta mínima sem `service_role/token/raw_data` | Baixo | Manter |
| **Auth** | `app/lib/auth.ts` (85 linhas) | OK — `requireAuth:401`, `isAdmin` via `supabaseAdmin select role`, `requireAdmin:403`, `resolveUserId` IDOR 403 | Baixo | Manter |
| **Supabase admin** | `app/lib/supabase-admin.ts` (26 linhas) | OK — `server-only` + `SERVICE_ROLE_KEY` nunca `NEXT_PUBLIC` | Baixo | Manter |
| **DB helper** | `app/lib/db.ts` (336 linhas) | OK — `getUserState` select explícito sem `gpro_token`, `saveUserState` `service_role` server / `browserSupabase` client com fallback `42703`, `updateTyreSuppliers` | Médio | ALFA-012 pode migrar `GameContext` para `update_user_profile` RPC para não depender de RLS direta |
| **Middleware** | `middleware.ts` + `utils/supabase/middleware.ts` | OK — `updateSession` apenas, sem `requireVip`/`VIP_CHECK` | Baixo | Não ativar `requireVip` aqui |
| **Layout/Sidebar** | `app/dashboard/layout.tsx` (482 linhas) + `app/dashboard/admin/layout.tsx` (31 linhas) | OK — `localRole==='admin'` filter, `AdminInviteButton` + novo `Convites VIP /dashboard/admin/vip-invites` filtrado `administration` só admin, `admin/layout` `role!=='admin' → redirect` | Baixo | Manter fora APK |
| **Página convites** | `app/dashboard/admin/vip-invites/page.tsx` (191 linhas, `'use client'`) | OK — form `30_days/lifetime/custom` + tabela `disponivel/utilizado/expirado/revogado` + Copiar/Revogar, loading/vazio/erro, sem conceder VIP | Baixo | Manter admin-only |
| **Migrations** | `20250914000001_rls_hardening.sql` (114) + `20250915000002` + `20250916000001` + `20250917000001_add_vip_model.sql` (135) + `20250917000002_harden_user_state_update.sql` (164) + `20250917000003_extend_invite_codes.sql` (80) + `20250917000004_harden_access_grants_uniqueness.sql` (140) | OK — aditivas `IF NOT EXISTS`, sem `DROP TABLE/TRUNCATE/DELETE`, `uniq_grant_invite_user` parcial `WHERE source='invite'` com `RAISE NOTICE` sem delete | Baixo | Aplicar via `supabase db push` quando ambiente permitir |
| **Testes** | `tests/alfa-011-*.test.js` (7 arquivos, 150+ asserts) | OK — estáticos `fs.readFileSync` + `includes`, sem DB real, cobrem convite/cadastro/transação/grant/lifecycle/security | Médio | ALFA-012 pode adicionar teste real com `service_role` staging |
| **Ausentes** | `premium_plans`, `orders`, `payments` | OK — 0 ocorrências (`grep -r` 0) | Baixo | Não criar até Pix |

**Duplicação perigosa:** `signup.ts` vs `consume_invite_code` RPC (`used_by=auth.uid()` vs `used_by=newUserId`) — documentado, não é duplicação destrutiva; `signup` usa `UPDATE` explícito para `service_role`. **Dependência circular:** `accessService` importa `auth isAdmin`, `auth` importa `supabaseAdmin`, sem ciclo (`supabaseAdmin` não importa `accessService`). **Referência inexistente:** nenhuma `from('premium_plans')`. **Acesso Admin no cliente:** 0 (`grep supabaseAdmin` só server).

---

## Migrations auditadas

| Migration | Objeto | Situação |
|---|---|---|
| `20250914000001_rls_hardening.sql` | `user_state` `select/insert/update/delete_own` `auth.uid()=user_id`, `invite_codes` `invite_select_auth` (`authenticated` select) | OK, porém `update_own` ampla — corrigida em 00002 |
| `20250917000001_add_vip_model.sql` | `user_state` cols `vip_status, vip_expires_at, access_plan, access_grant_id` nullable + `access_grants` (`source, plan, status, starts_at, expires_at, revoked_at, metadata`) + `access_events` + `grants_select_own` sem `insert/update/delete` | OK |
| `20250917000002_harden_user_state_update.sql` | `drop policy user_state_update_own` → `prevent_user_state_privilege_escalation()` (`auth.role()='authenticated'` + `IS DISTINCT` em 5 campos → `42501`) + `user_state_update_own_restricted` + `update_user_profile` allowlist 19 params + `grant execute` | OK, `service_role` bypass |
| `20250917000003_extend_invite_codes.sql` | `invite_codes` cols `used_by, used_at, created_by, expires_at, revoked_at, revoked_by, invite_type check, metadata` + `consume_invite_code` (`security definer`, `search_path public`, `where is_used=false and revoked_at null and (expires_at null or >now)`) | OK, `used_by=auth.uid()` limita uso `service_role` — por isso `signup` usa `UPDATE` explícito |
| `20250917000004_harden_access_grants_uniqueness.sql` | `uniq_grant_invite_user` parcial `WHERE source='invite' AND invite_code_id IS NOT NULL` + `renew_access_grant` (`FOR UPDATE`, `expires_at null→return`, `max(now,expires_at)+30d`), `revoke_access_grant`, `expire_overdue_grants` | OK, `DO` com `RAISE NOTICE` sem `DELETE` se duplicatas |

---

## Fluxo completo (sem `VIP_CHECK`)

```
Admin POST /api/admin/vip-invites {validityType:30_days|lifetime|custom}
 → server calcula expires_at (30d/null/custom+2y limite), gera ALFA-XXXX via crypto.randomUUID, insert invite_codes (created_by=admin.id, is_used false) via supabaseAdmin
 → GET lista: compute status disponivel/utilizado/expirado/revogado
 → POST revoke: update revoked_at/by where not revoked and not used

Usuário POST signup (FormData email+password+inviteCode)
 → normaliza inviteCode trim/toUpperCase/replace (4-64)
 → SELECT maybeSingle invite WHERE code → 404/REVOKED/USED/EXPIRED early
 → auth.admin.createUser({email,password}) → USER_CREATE_FAILED se falhar (convite intacto)
 → UPDATE invite_codes SET is_used,used_at,used_by WHERE is_used=false AND revoked_at null AND (expires_at null OR >now) RETURNING — se 0 linhas → recheck + deleteUser(newUserId) compensação (log Inconsistencia, masked) → 409
 → INSERT user_state track:Interlagos + upsert retry → USER_STATE_FAILED se falhar (não reverte is_used)
 → ensureVipGrantForInvite(userId, {id, invite_type, expires_at}) — SELECT invite_code_id+user_id → se existe isNew false, senão INSERT full_premium active starts_at now expires_at calculateGrantExpiration (30d/null/custom) + catch 23505→re-select (idempotente, concorrência)
 → if isNew → recordAccessEvent granted (source invite, metadata invite_code_id/type, não duplica)
 → syncUserStateWithGrant (vip_status lifetime/active, vip_expires_at, access_plan, access_grant_id via supabaseAdmin update/upsert, preserva lifetime)

GET /api/admin/access-status (requireAdmin) → getAccessState(admin.id) → interpretGrant + pickBestGrant (active mais futuro, vitalício Infinity) + fallback user_state, enforcementEnabled=false, allowed=true (VIP_CHECK=false)

Ciclo de vida (service): renewGrant(grantId) max(now,expires_at)+30d preserva lifetime, revokeGrant, expireOverdueGrants (active→expired where expires_at<=now), reprocessMissingGrant
```

---

## Pontos aprovados

* `crypto.randomUUID` server, não cliente
* `validityType` enum + `customExpiresAt` validada + limite 2y + `invite_type` check
* `consume` atômico `WHERE is_used=false` + `revoked_at null` + `expires_at` + compensação `deleteUser(newUserId)` só recém-criado
* `ensureVipGrantForInvite` idempotente `SELECT` + `INSERT` + `catch 23505`
* `user_state` só `supabaseAdmin` (`service_role` bypass trigger), `role` nunca alterado
* `search_path=public` e `security definer` + `grant execute to service_role` em 3 RPCs lifecycle
* `uniq_grant_invite_user` parcial sem `DELETE`
* `VIP_CHECK=false`, nenhuma rota Manager com `requireVip`
* Logs `slice(0,80)` + `slice(0,8)***` sem senha/token/e-mail completo/código completo
* `capacitor.config.ts` `server.url https://gpro-alfa-racing.vercel.app`, sem `service_role` no bundle (`server-only`)
* 7 suites testes estáticos PASS, `tsc --noEmit` 0, `build` 37/37

---

## Pontos reprovados

*Nenhum bloqueante.* Pendências abaixo são observabilidade, não reprovação de segurança.

---

## Riscos

### Críticos
Nenhum.

### Médios
* **Sem `UNIQUE` em produção se duplicatas existirem:** migration `RAISE NOTICE` sem `DELETE` — índice não criado até limpeza manual (`SELECT ... HAVING COUNT>1`). Mitigação: `ensureVipGrantForInvite` `SELECT` reduz janela, `pickBestGrant` escolhe maior `expires_at` se duplicata.
* **`user_state` sync não transacional com `access_grants`:** sync falha deixa `user_state` stale, mas `getAccessState` lê `access_grants` primeiro então `hasAccess` correto. Mitigação: `reprocessMissingGrant` ou retry.
* **Compensação `deleteUser` pode falhar (rede):** deixa usuário órfão com convite consumido correto, mas usuário existe. Mitigação: log `Incidente compensacao deleteUser falhou` com `maskedEmail` + manual `listUsers`.

### Baixos
* **Convite antigo `invite_type null` → `full_premium` 30d por compatibilidade:** se legado não era VIP, concederá VIP inesperado. Alternativa documentada: trocar `calculateGrantExpiration` para `if invite_type null → skip grant`.
* **`expire_overdue_grants` não é cron automático:** expiração `active→expired` precisa ser chamada via endpoint admin ou lazy (`getAccessState` já calcula `isExpired` via `expires_at <= now()` sem marcar DB). Baixo impacto operacional com `VIP_CHECK=false`.
* **Sem teste real com DB:** todos estáticos `fs.readFileSync` + `includes` + `grep`. Concorrência real (`Promise.all` signup) requer staging `service_role`.

---

## Testes executados

| Suite | Arquivo | Asserts | Comando | Resultado |
|---|---|---|---|---|
| 011.2 | `alfa-011-2-access.test.js` | 10 cenários (interpretGrant, pickBestGrant) | `node tests/alfa-011-2-access.test.js` | `EXIT:0` (ajustado 011.8+ para permitir `ensureVipGrant` inserts) |
| 011.3 | `alfa-011-3-access-status.test.js` | 35 | `node .../alfa-011-3-*.js` | `EXIT:0` |
| 011.4 | `alfa-011-4-security.test.js` | 50+ | `node .../alfa-011-4-*.js` | `EXIT:0` |
| 011.5 | `alfa-011-5-vip-invites.test.js` | 42 | `node .../alfa-011-5-*.js` | `EXIT:0` |
| 011.6 | `alfa-011-6-signup.test.js` | 33 | `node .../alfa-011-6-*.js` | `EXIT:0` |
| 011.7 | `alfa-011-7-transaction.test.js` | 35 | `node .../alfa-011-7-*.js` | `EXIT:0` |
| 011.8 | `alfa-011-8-vip-grant.test.js` | 42 (24 blocos) | `node .../alfa-011-8-*.js` | `EXIT:0` (corrigido 24/35 → 42) |
| 011.9 | `alfa-011-9-grant-lifecycle.test.js` | 28/42 | `node .../alfa-011-9-*.js` | `EXIT:0` |

## Testes não executados

* Integração real com Supabase (`service_role` staging) — criação convite `vip_30_days` + signup + `SELECT access_grants` + `user_state` + expiração `>now`.
* `npm run build` já valida `37/37` pages, `tsc --noEmit` `0`, mas não roda `supabase db push` (sem credenciais).

---

## Limitações

* Sem `supabase db push` nesta sprint — migrations `20250917000001`..`00004` ainda não aplicadas em produção (ver `supabase/.temp`).
* Concorrência `23505` estática, não `Promise.all` real.
* `reprocessMissingGrant` não testado com `used_by null` legado real.

---

## Recomendações

1. **Antes de ALFA-012.1 (ativação observabilidade):** aplicar `supabase db push` em staging, verificar `uniq_grant_invite_user` criado (`\d access_grants`), testar `POST /api/admin/vip-invites` + `signup` + `SELECT access_grants, user_state`.
2. **ALFA-012.1:** endpoint `GET /api/admin/vip-observability` com `count would-be-blocked` (quantos `requireVip` retornariam 403) sem bloquear, logs com `x-request-id`.
3. **ALFA-012.2:** ativar `VIP_CHECK=true` só em staging para `userId` teste, validar Web + APK `br.com.gproalfaracing` (sem `service_role` no bundle, expiração depende de servidor, login expirado ainda funciona).
4. **ALFA-012.3:** ativação gradual por rota (`/api/gpro/sync` primeiro), `featureFlag per route` + rollback `VIP_CHECK=false`.

---

## Decisão técnica

**Pronto com pendências** — pronto para ativação observabilidade, **não pronto** para `VIP_CHECK=true` em produção sem `supabase db push` + teste real com `service_role` staging.

*Nenhum `commit`/`push`/`deploy`/`VIP_CHECK=true`/`requireVip` nesta sprint.*
