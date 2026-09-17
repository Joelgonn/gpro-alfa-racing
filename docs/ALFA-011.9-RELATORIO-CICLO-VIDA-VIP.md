# ALFA-011.9 — Relatório Ciclo de Vida VIP

> **Sprint:** ALFA-011.9 — Ciclo de vida da concessão VIP (renovação, revogação, expiração, reprocessamento)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + relatórios ALFA-011.2..8
> **Flag:** `VIP_CHECK=false` (inalterada, nenhuma rota Manager com `requireVip`)
> **Migrations:** `20250917000001_add_vip_model.sql` + `20250917000002_harden_user_state_update.sql` + `20250917000003_extend_invite_codes.sql` + `20250917000004_harden_access_grants_uniqueness.sql` (nova)

---

## 1. Auditoria da ALFA-011.8

**`app/lib/access/accessService.ts:478-686` (ALFA-011.8):** `calculateGrantExpiration` (`vip_30_days→now+30d`, `vip_lifetime→null`, `vip_custom→invite.expires_at`, `null→30d`), `ensureVipGrantForInvite` (idempotente `SELECT invite_code_id+user_id` + `INSERT` + `catch 23505`), `recordAccessEvent` (`granted`), `syncUserStateWithGrant` (`vip_status, vip_expires_at, access_plan, access_grant_id` via `supabaseAdmin`, preserva `lifetime`), `planForInvite` `full_premium`.

**`app/actions/signup.ts:173-210`:** `ensureVipGrantForInvite` + `recordAccessEvent granted` quando `isNew` + `syncUserStateWithGrant` com `try/catch` separado, falha grant logada com `masked`.

**`tests/alfa-011-8-vip-grant.test.js:42`:** 24 blocos descritos (`// 1.` até `// 24.`), 42 `assert(` calls. Relatório ALFA-011.8 descreveu `24/35 asserts` — impreciso (contagem de asserts é 42, blocos 24). Código correto, apenas descrição incorreta.

## 2. Contagem corrigida dos testes

| Arquivo | Blocos | `assert(` count | Execução | Resultado |
|---|---|---|---|---|
| `tests/alfa-011-8-vip-grant.test.js` | 24 | **42** | `node tests/alfa-011-8-vip-grant.test.js` | `EXIT:0` — `✅ Todos os 24 cenários ... 35 asserts` (mensagem antiga imprecisa, agora `42`) |
| Correção | — | `42` asserts, não `35` | `grep -c "assert("` | Documentado |

Teste de concorrência `10. corrida: catch 23505` é **contratual/estático** (verifica `23505` string), não executa concorrência real com Supabase (requer staging com `service_role` paralelo).

## 3. Análise de duplicidades

**Auditoria constraint única:** `SELECT invite_code_id, user_id, COUNT(*) FROM access_grants WHERE invite_code_id IS NOT NULL AND source='invite' GROUP BY 1,2 HAVING COUNT(*) >1`.

* **Resultado local sem DB:** não foi possível conectar ao Supabase remoto (sem `SUPABASE_ACCESS_TOKEN`/`db push`), mas migration `20250917000004` lista duplicatas via `RAISE NOTICE` sem `DELETE`.
* **Decisão:** não executar `DELETE` destrutivo. Se `dup_count >0`, migration **não cria** índice e apenas `RAISE NOTICE 'duplicata detectada ... count=%'` — preserva dados, documenta para limpeza manual. Se `dup_count==0`, cria índice.
* **Verificação:** `DO $$ SELECT COUNT(*) ... HAVING COUNT(*)>1` + `CREATE UNIQUE INDEX IF NOT EXISTS uniq_grant_invite_user ON access_grants (invite_code_id, user_id) WHERE source='invite' AND invite_code_id IS NOT NULL` dentro de `BEGIN ... EXCEPTION WHEN unique_violation THEN NOTICE`.
* **Compatibilidade:** considera `invite_code_id null` (manual/payment) **fora** da constraint (parcial `WHERE`), `source` diferente não conflita. PostgreSQL `UNIQUE` parcial respeita `NULL` não indexado.

## 4. Migration criada

`supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql` (140 linhas, aditiva, sem `DELETE`/`TRUNCATE`):

1. `DO $$` loop `SELECT ... HAVING COUNT(*)>1` + `RAISE NOTICE` sem `DELETE`.
2. `DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS uniq_grant_invite_user ... WHERE source='invite' AND invite_code_id IS NOT NULL; EXCEPTION WHEN unique_violation THEN NOTICE; END $$;`
3. `create or replace function renew_access_grant(p_grant_id uuid, p_actor_user_id uuid) returns access_grants security definer search_path=public` — `SELECT ... FOR UPDATE`, se `status='revoked'` raise, se `expires_at null` return (preserva lifetime), `v_new_expires = (expires_at > now ? expires_at : now) + 30d`, `UPDATE status=active, expires_at=v_new_expires`, `INSERT access_events renewed`, `UPDATE user_state vip_status/expires`.
4. `revoke_access_grant` — idempotente (`if status='revoked' return`), `UPDATE status=revoked, revoked_at=now(), revoked_by`, `INSERT revoked`, `UPDATE user_state vip_status=revoked`.
5. `expire_overdue_grants() returns int` — loop `SELECT ... WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= now() FOR UPDATE`, `UPDATE status=expired`, `INSERT expired`, `UPDATE user_state`.
6. `grant execute to service_role` para 3 funções, `notify pgrst`.

Timestamp `20250917000004` segue `20250917000003`.

## 5. Constraint única

* Nome: `uniq_grant_invite_user` em `public.access_grants (invite_code_id, user_id) WHERE source='invite' AND invite_code_id IS NOT NULL`.
* Impede `2 grants` para mesma `(invite_code_id, user_id, source='invite')` — protege `ensureVipGrantForInvite` corrida sem `SELECT FOR UPDATE` (segunda `INSERT` falha `23505` → JS re-`SELECT`).
* Não afeta `source='manual'` com `invite_code_id null` (manual grants podem ter null), nem `payment` futuro com `invite_code_id null`.
* Não apaga dados existentes — `IF dup_count>0` interrompe criação e documenta.

## 6. Renovação

**`renewGrant(grantId, actorUserId)` em `app/lib/access/accessService.ts:690`:**

* Tenta `supabaseAdmin.rpc('renew_access_grant', {p_grant_id, p_actor_user_id})` — transacional `FOR UPDATE` + evento + sync dentro da SQL.
* Fallback JS se RPC não existir (ambiente sem migration aplicada): `SELECT grant WHERE id`, se `revoked` throw, se `expires_at null` return (preserva lifetime, não transforma vitalício em temporário), se `active` válido `newExp = max(now, expires_at)+30d`, `UPDATE`, `recordAccessEvent renewed` com `previous/new_expires_at`, `syncUserStateWithGrant`.
* **Idempotência:** verifica último `access_events` `renewed` com mesmo `new_expires_at` — se repetição rápida com mesmo `newExp`, retorna `grant` sem novo `UPDATE`/evento (não duplica).
* **Regra explícita:** `+30d a partir de max(now, expires_at)` — preserva dias restantes se ainda válido, estende a partir de agora se expirado. Vitalício nunca muda.
* Não permite renovar `revogado` (raise `22023`), não permite `grant inexistente` (raise `P0002`).

## 7. Revogação

**`revokeGrant(grantId, actorUserId)` (`accessService.ts:740`):**

* `RPC revoke_access_grant` — `SELECT FOR UPDATE`, `if status='revoked' return` (idempotente), `UPDATE status=revoked, revoked_at=now(), revoked_by`, `INSERT revoked`, `UPDATE user_state vip_status=revoked`.
* Fallback JS idem: `SELECT`, se `revoked` return, `UPDATE`, `recordAccessEvent revoked`, `UPDATE user_state` só se `access_grant_id==grantId` (não limpa outro grant ativo).
* Somente via `service_role` (`requireAdmin` futuro ou `actorUserId` passado por admin) — `grant execute to service_role`, não `authenticated`.
* Não exclui registro, `revoked_at/by` preenchidos, `status revoked`.
* Sincroniza `user_state` (`vip_status=revoked`, `vip_expires_at=null`).

## 8. Expiração

**`expireOverdueGrants()` (`accessService.ts:780` + RPC):**

* `RPC expire_overdue_grants()` — `SELECT ... WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= now() FOR UPDATE`, loop `UPDATE status=expired`, `INSERT expired`, `UPDATE user_state`.
* Regras: só `active` com `expires_at <= now()`, nunca `null` (vitalício), não `revoked` (já `revoked`), registra `expired`, não duplica (só `active` → `expired` uma vez).
* Escolhida estratégia **endpoint administrativo protegido** (RPC chamada via `service_role`, não `cron` externo): `expireOverdueGrants()` pode ser chamada por `POST /api/admin/vip-invites/expire` futuro ou `getAccessState` lazy (já calcula `expired` via `expires_at` sem marcar DB). Por simplicidade ALFA-011.9 mantém RPC + JS fallback, sem `pg_cron` externo (compatível com projeto — `supabase/.temp` sem `cron`).
* JS fallback loop `SELECT ... .lte('expires_at', nowIso)` + `UPDATE`.
* Sincroniza `user_state` só se `access_grant_id==grantId` (não sobrescreve outro grant ativo).

## 9. Reprocessamento

**`reprocessMissingGrant(userId, inviteId)` (`accessService.ts:815`):**

* Localiza `access_grants WHERE user_id + invite_code_id maybeSingle` — se existe retorna `isNew:false` (idempotente).
* Verifica `invite_codes WHERE id=inviteId` — se `revoked_at` / `!is_used` / `used_by != userId` (quando `used_by` preenchido) → `return null` (não concede para revogado/expirado/inválido).
* Se `used_by` null (convite antigo), permite reprocessamento via `userId` admin passado (ex: `ALFA-011.6` com `used_by` null).
* Chama `ensureVipGrantForInvite` + `recordAccessEvent granted` com `reprocessed:true` + `syncUserState`.
* Idempotente: segunda chamada com mesmo `userId+inviteId` retorna mesmo grant sem novo `insert`.
* Logs sem `e-mail/código completo` — `userId.slice(0,8)***`, `inviteId.slice(0,8)***`.
* Sem conceder com base em dados manipulados pelo cliente — `invite` lido via `supabaseAdmin` (service_role), não `body`.

## 10. Sincronização de `user_state`

* `syncUserStateWithGrant` (`accessService.ts:623`) já existente, usado por `renewGrant`, `revokeGrant`, `expireOverdueGrants`, `reprocessMissingGrant`.
* Regras: `vip_status` (`lifetime` se `null` else `active`/`expired`/`revoked`), `vip_expires_at`, `access_plan`, `access_grant_id` via `supabaseAdmin` `update`/`upsert` (bypass trigger ALFA-011.4 que só bloqueia `authenticated`).
* `access_grants` é fonte primária — `getAccessState` lê `access_grants` primeiro (`accessService.ts:276`), fallback `user_state` só se `grants` vazio (`fromCache`).
* Grant ativo mais relevante via `pickBestGrant` (`interpretGrant`): `active` não expirado > `pending` > `expired` > `revoked` + vitalício `Infinity` prioridade.
* `role` nunca alterado — `sync` nunca toca `role`, só 4 campos VIP (teste 20).

## 11. Eventos

* `granted` (signup), `renewed` (renew), `revoked` (revoke), `expired` (expire), `manually_adjusted` (reservado). Todos `event_type check` em `20250917000001:64` (`granted|renewed|revoked|expired|manually_adjusted`).
* `recordAccessEvent` `try/catch` — não falha fluxo se `insert` falhar.
* Idempotência: `renewed` verifica `lastEvent metadata.new_expires_at == newExpIso` antes de inserir; `granted` só quando `isNew true` (`signup.ts:190`); `revoked`/`expired` só quando `status` muda (`FOR UPDATE` + `if status='revoked' return`).
* `metadata` sem `senha/token/service_role`, só `{invite_code_id, invite_type, new_expires_at, reprocessed}`.

## 12. Autorização

* Renovação/revogação/expiração: `service_role` only (`grant execute to service_role`, não `authenticated`). Futuras APIs `POST /api/admin/vip-invites/[id]/renew` e `/revoke` usarão `requireAdmin` (`app/lib/auth.ts:61`) e passarão `actorUserId=admin.id`.
* `reprocessMissingGrant` exige `userId` derivado de `auth` ou admin passado, não `body.user_id` arbitrário sem `requireAdmin`.
* Validação UUID via `supabaseAdmin` `eq('id', grantId)` — `grantId` deve ser `uuid`.
* Respostas mínimas: `renewGrant` retorna `grant` sem `metadata` completo; `revokeGrant` retorna `revoked_at/by`; expiração retorna `count` int.

## 13. Segurança

* `import 'server-only'` em `accessService.ts:10`, `supabaseAdmin` `server-only` (`app/lib/supabase-admin.ts:1`), nenhum `localStorage`/`cookie` cliente como fonte.
* `VIP_CHECK=false` (`accessService.ts:23`), nenhuma rota Manager com `requireVip` (`grep` 0 em `app/api/gpro/sync`, `python`, `market/update`, `calendar`, `manager/profile`).
* Sem Pix/`orders`/`payments`/`premium_plans` — `grep` 0.
* `search_path=public` em 3 funções SQL, `security definer`, `grant execute to service_role` apenas.
* Logs `slice(0,80)` + `slice(0,8)***`, sem `e-mail completo`/`código completo`/`token`/`service_role`/`raw_data`/`stack`.

## 14. Testes executados

| Suite | Comando | Asserts | Resultado |
|---|---|---|---|
| **ALFA-011.9** 28 cenários | `node tests/alfa-011-9-grant-lifecycle.test.js` | 42 | **PASS** `EXIT:0` — auditoria 011.8 42 asserts, constraint `uniq_grant_invite_user`, duplicatas sem DELETE, renovação vitalício/expirado/revogado idempotente, revogação/revogado, expiração vitalício, eventos renewed/revoked/expired não duplica, user_state sync, role, reprocess, VIP_CHECK, sem Pix |
| ALFA-011.2 | `node tests/alfa-011-2-access.test.js` | 10 | **PASS** `EXIT:0` (ajustado para permitir inserts via ensureVipGrant) |
| ALFA-011.3 | `node tests/alfa-011-3-access-status.test.js` | 35 | **PASS** `EXIT:0` |
| ALFA-011.4 | `node tests/alfa-011-4-security.test.js` | 50+ | **PASS** `EXIT:0` |
| ALFA-011.5 | `node tests/alfa-011-5-vip-invites.test.js` | 42 | **PASS** `EXIT:0` |
| ALFA-011.6 | `node tests/alfa-011-6-signup.test.js` | 33 | **PASS** `EXIT:0` |
| ALFA-011.7 | `node tests/alfa-011-7-transaction.test.js` | 35 | **PASS** `EXIT:0` |
| ALFA-011.8 | `node tests/alfa-011-8-vip-grant.test.js` | 42 | **PASS** `EXIT:0` |

## 15. TypeScript

`npx tsc --noEmit` `TSC:0` — `accessService.ts` novas `renewGrant`, `revokeGrant`, `expireOverdueGrants`, `reprocessMissingGrant` tipadas, `supabase/migrations/*.sql` não afeta `tsc`.

## 16. Build

`npm run build` `BUILD:0` — `Next.js 16.1.1` `✓ Compiled successfully` `Generating static pages 37/37` `ƒ /api/admin/vip-invites`, `ƒ /api/admin/vip-invites/[id]/revoke`, `○ /dashboard/admin/vip-invites`, `○ /login`.

## 17. `git diff --check`

`git diff --check` `DIFFCHECK:0` — warnings `LF will be replaced by CRLF` em `app/actions/signup.ts` e `app/dashboard/layout.tsx` (CRLF pré-existente), sem whitespace errors.

## 18. `git status`

```
 M app/actions/signup.ts
 M app/dashboard/layout.tsx                 // Convites VIP (011.5)
 M tests/alfa-011-2-access.test.js          // ajuste syncUserStateWithGrant
?? app/lib/access/accessService.ts           // + ~150 linhas ciclo vida (renew/revoke/expire/reprocess)
?? supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql
?? app/api/admin/access-status/              // 011.3
?? app/api/admin/vip-invites/                // 011.5
?? app/dashboard/admin/vip-invites/          // 011.5
?? docs/ALFA-011*.md
?? tests/alfa-011-*.js
```

`git diff --stat` `3 files changed, 250+ insertions(+), 30 deletions(-)` — `signup.ts` não alterado nesta sprint (011.9 só `accessService` + migration + testes), mas `diff` anterior já incluía `signup.ts` (mantido).

## 19. Riscos remanescentes

| Risco | Severidade | Mitigação |
|---|---|---|
| Sem cron automático — `expire_overdue_grants` precisa ser chamado via endpoint admin ou lazy em `getAccessState` | Médio | `getAccessState` já calcula `isExpired` via `expires_at <= now()` sem marcar DB; expiração DB pode ser chamada por admin `POST /api/admin/vip-invites/expire` futuro ou `pg_cron` quando configurado |
| Índice único falha se duplicatas pré-existentes | Baixo | Migration `RAISE NOTICE` sem `DELETE`, documenta para limpeza manual `SELECT ... HAVING COUNT>1` antes de re-`CREATE INDEX` |
| `renewGrant` JS fallback sem `FOR UPDATE` pode ter corrida | Baixo | `SELECT ... maybeSingle` + `UPDATE` com re-check `lastEvent`; produção usará RPC com `FOR UPDATE` (transacional) |
| Reprocessamento com `invite_type null` concede 30d — pode ser inesperado se antigo não era VIP | Baixo | Documentado fallback 30d; alternativa `skip grant` se produto decidir `invite_type null → não-VIP` |

## 20. Recomendação para ALFA-012.0

**ALFA-012.0 — Ativação operacional VIP (com `VIP_CHECK=false` ainda)**

1. Criar `POST /api/admin/vip-invites/[id]/renew` e `/revoke` e `POST /api/admin/vip/expire` que chamam `renewGrant`/`revokeGrant`/`expireOverdueGrants` com `requireAdmin` e `actorUserId`, sem `requireVip` ainda.
2. Criar painel `app/dashboard/admin/vip-grants/page.tsx` listando `access_grants` com `status` e botões `Renovar`/`Revogar` e `Reprocessar` (usa `reprocessMissingGrant`).
3. Manter `VIP_CHECK=false`; não proteger rotas Manager; não criar `payments/orders`; testes `alfa-012-renew.test.js` verificando `renew` vitalício preservado, `revoke` idempotente, `expire` só `active` com `expires_at`.

Não criar: `VIP_CHECK=true`, `orders/payments`, Pix, APK, `requireVip` nas Manager.

---

## Anexos

* **Auditoria 011.8 corrigida:** `tests/alfa-011-8-vip-grant.test.js` tem 42 `assert(`, não 24/35 — `grep -c` comprova. Teste concorrência é **estático** (string `23505`), não `Promise.all` real.
* **Fonte primária:** `access_grants` (`SELECT ... order created_at desc`), `user_state` só cache.
* **Reversão:** `drop index if exists uniq_grant_invite_user` + `drop function renew_access_grant, revoke_access_grant, expire_overdue_grants` + `git checkout -- app/lib/access/accessService.ts`.

*Fim ALFA-011.9 — aguardar autorização para ALFA-012.0.*
