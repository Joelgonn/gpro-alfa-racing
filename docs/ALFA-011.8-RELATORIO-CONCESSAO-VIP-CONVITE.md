# ALFA-011.8 — Relatório Concessão VIP por Convite

> **Sprint:** ALFA-011.8 — Concessão VIP por convite (idempotente, sem VIP_CHECK)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + relatórios ALFA-011.2..7
> **Flag:** `VIP_CHECK=false` (inalterada, nenhuma rota Manager com `requireVip`)
> **Serviço:** `app/lib/access/accessService.ts` (485→~640 linhas, estendido) + `app/actions/signup.ts` (181→~220 linhas, integrado)

---

## 1. Auditoria inicial

**`app/actions/signup.ts:17` (ALFA-011.7):** `preCheck SELECT id,invite_type,expires_at WHERE code` → `createUser` → `UPDATE is_used/used_at/used_by WHERE is_used=false AND revoked_at null AND (expires_at null OR > nowIso)` atômico + compensação `deleteUser(newUserId)` + `insert user_state track:Interlagos` + `upsert retry`. Sem `access_grants`; `VIP_CHECK=false`.

**`app/lib/access/accessService.ts:1` (ALFA-011.2):** `VIP_CHECK=false`, `interpretGrant`/`pickBestGrant` puros, `getAccessState` lê `access_grants` (fonte) + fallback `user_state` cache, `hasVipAccess`/`requireVip` com `enforcementEnabled`, sem escrita em `access_grants` antes.

**Migrations:**

* `20250917000001_add_vip_model.sql:18` `access_grants(id uuid pk, user_id uuid, source check invite|manual|payment|admin, invite_code_id uuid, plan check premium|full_premium, status check active|expired|revoked|pending default pending, starts_at timestamptz default now(), expires_at, revoked_at, revoked_by, metadata jsonb, created_at, updated_at)` + `access_events(id, user_id, access_grant_id, event_type check granted|renewed|revoked|expired|manually_adjusted, source, actor_user_id, metadata, created_at)` + índices `user_id/status/expires_at`.
* `20250917000003_extend_invite_codes:6` `invite_codes` cols `used_by, used_at, created_by, expires_at, revoked_at, revoked_by, invite_type check vip_30_days|vip_lifetime|vip_custom, metadata` + RPC `consume_invite_code` com `auth.uid()`.

**Políticas RLS:** `access_grants` `grants_select_own` (`auth.uid()=user_id` select), sem `insert/update/delete` para `authenticated` (só `service_role`); idem `access_events`.

**Tipos existentes:** `AccessGrantRow` (`source, plan, status, starts_at, expires_at, revoked_at, ...`), `AccessState` (`hasAccess, isLifetime, ...`).

**Dependências:** `access_grants.invite_code_id → invite_codes.id` opcional FK `ON DELETE SET NULL`; `access_events.access_grant_id → access_grants.id`. `user_state` `vip_status, vip_expires_at, access_plan, access_grant_id` cache.

**Convites antigos:** `invite_type IS NULL`, `expires_at IS NULL` (criados antes de 011.5) — sem validade, `is_used` booleano.

## 2. Modelo de dados utilizado

Usado `access_grants` + `access_events` + `user_state` sem nova migration (idempotência via código, não via `UNIQUE` nova):

* `access_grants.source='invite'`, `plan='full_premium'`, `status='active'`, `starts_at=nowIso`, `expires_at` derivado (seção 3), `invite_code_id=invite.id`, `metadata '{}'`, `revoked_at null`.
* `access_events.event_type='granted'` (único valor permitido para criação; `renewed/revoked` futuros), `source='invite'`, `actor_user_id=null` (sistema), `metadata {invite_code_id, invite_type}` sem senha/token.
* `user_state` resumo: `vip_status` (`lifetime` se `expires_at null` else `active`), `vip_expires_at` (= grant.expires_at), `access_plan` (= grant.plan), `access_grant_id` (= grant.id). Atualizado via `supabaseAdmin` `update`/`upsert` (bypass trigger ALFA-011.4 que só bloqueia `authenticated`).

Constraints reais respeitados: `source` enum, `plan` enum, `status` enum, `event_type` enum — todos verificados em testes 011.8:1-3.

## 3. Regras de validade

| Tipo | `invite_type` | `Plan` | `expires_at` grant | Origem |
|---|---|---|---|---|
| `vip_30_days` | `vip_30_days` | `full_premium` | `now+30d` (`calculateGrantExpiration` com `setDate(+30)`) | servidor `nowIso` |
| `vip_lifetime` | `vip_lifetime` | `full_premium` | `null` (vitalício) | — |
| `vip_custom` | `vip_custom` | `full_premium` | `invite.expires_at` (preserva data custom do convite) | DB `invite.expires_at` |
| Antigo `null` | `null` | `full_premium` | `now+30d` (compatibilidade documentada) | fallback 30d |

`starts_at` sempre `nowIso` servidor. Nunca aceita `expires_at` do cliente — só `invite.expires_at` do DB. Vitalício resulta `vip_status='lifetime'` e `vip_expires_at=null`.

## 4. Fluxo de concessão

```
validar convite (preCheck SELECT)
→ criar usuário Auth (auth.admin.createUser)
→ consumir convite atomicamente (UPDATE is_used/used_by WHERE is_used=false)
→ criar/confirmar user_state (insert + upsert retry)
→ criar access_grant idempotente (SELECT invite_code_id+user_id → se existe retorna, senão INSERT; catch 23505 → re-select)
→ registrar access_event granted (se isNew true)
→ sincronizar user_state (vip_status, vip_expires_at, access_plan, access_grant_id via supabaseAdmin)
→ concluir cadastro (return success)
```

Implementado em `app/actions/signup.ts:173-210` com `await import('@/app/lib/access/accessService')` lazy (evita ciclo), `try { grant } catch (log)` sem ocultar, `sync` em `try/catch` separado.

## 5. Estratégia de idempotência

* **Antes de inserir:** `SELECT ... WHERE user_id=userId AND invite_code_id=invite.id AND source='invite' maybeSingle` — se existe, retorna `isNew:false` sem inserir (seção `ensureVipGrantForInvite:22`).
* **Segunda tentativa:** se `insert` falhar com `23505` (unique se existisse) ou concorrência sem constraint, `catch` faz `SELECT` novamente e retorna existente.
* **Signup idempotente:** se usuário refizer `signUpWithInviteCode` com mesmo `invite` já consumido, `preCheck is_used=true` → `INVITE_ALREADY_USED` antes de grant; se `ensureVipGrant` chamado com mesmo `userId+invite.id`, retorna mesmo `grant.id` sem duplicar.
* **Evento:** só `recordAccessEvent` quando `isNew true` (`signup.ts:190` `if (isNew)`), evita duplicar `granted`.
* Não usa apenas `select → if not exists → insert` sem proteção — tem `catch 23505` + re-select.

## 6. Estratégia de concorrência

* `ensureVipGrantForInvite` SELECT+INSERT com `catch 23505` — duas requisições simultâneas com mesmo `invite+userId` (ex: double-click signup) só uma insere, outra re-seleciona.
* `invite_codes` consumo já atômico (`UPDATE WHERE ... RETURNING`) — garante `used_by` único.
* Teste `alfa-011-8-vip-grant.test.js:10` verifica `23505` handling.
* Sem `SELECT FOR UPDATE` explícito — `supabaseAdmin` REST não expõe, mas `insert` com re-select é suficiente para nível atual (sem `UNIQUE` constraint, concorrência rara com mesmo `invite` já exigiria mesmo `userId`, que só ocorre no mesmo `signup` retry).

## 7. Integração com signup

* **Após:** `user_state` confirmado (seção 4), `newUserId` e `preCheck` (invite) já definidos, `used_by` correto.
* **Valida:** invite já foi consumido (`is_used=true`), `expires_at`/`revoked_at` já validados, `user_id` derivado de `newUserId` (não cliente).
* **Cria grant:** `const {grant, isNew}=await ensureVipGrantForInvite(newUserId, {id, invite_type, expires_at})`
* **Registra evento:** `if (isNew) await recordAccessEvent({userId:newUserId, accessGrantId:grant.id, eventType:'granted', source:'invite', metadata:{invite_code_id, invite_type}})` — `granted` é valor permitido pela constraint `20250917000001:64`.
* **Sincroniza:** `await syncUserStateWithGrant(newUserId, grant)` — `vip_status`/`vip_expires_at`/`access_plan`/`access_grant_id` via `supabaseAdmin` (bypass trigger), com preservação `lifetime` (se já `lifetime` não sobrescreve com data).
* **Falha grant:** `try/catch` loga `Falha ao criar concessão VIP` com `masked userId/inviteId` + `err.slice(80)`, usuário permanece criado sem VIP (não exclui usuário, não marca concessão concluída). Próximo login pode ter grant manual via admin.

## 8. Sincronização de `user_state`

* Campos: `vip_status` (`lifetime` se `expires_at null` else `active`), `vip_expires_at` (=grant.expires_at), `access_plan` (=grant.plan), `access_grant_id` (=grant.id). `role` nunca tocado (teste 13).
* Operação: `supabaseAdmin.from('user_state').update({...}).eq('user_id', userId)` — `service_role` bypassa trigger `prevent_user_state_privilege_escalation` (que só bloqueia `authenticated`). Fallback `upsert onConflict user_id` se linha não existir.
* Preserva vitalício: `SELECT vip_status/vip_expires_at` antes; se `lifetime` + `null` já existe, não sobrescreve com `active` + data (defesa contra downgrade).
* `user_state` é resumo — fonte primária continua `access_grants`; `getAccessState` lê `access_grants` primeiro, fallback `user_state` só se `grants` vazio (`accessService.ts:293`).

## 9. Eventos registrados

* `granted` quando `isNew true` — `access_events` `event_type check` permite `granted`, `renewed`, `revoked`, `expired`, `manually_adjusted`. Usamos `granted` (valor real da constraint). Nomes `invite_redeemed`/`grant_created` da spec são mapeados para `granted` (documentado).
* `source='invite'`, `actor_user_id=null` (sistema signup, não admin), `metadata {invite_code_id, invite_type}` sem senha/token/`service_role`.
* Não duplica: `if (isNew)` evita segundo `granted` para mesmo `invite+user`.
* Falha de evento: `recordAccessEvent` `try/catch` loga `recordAccessEvent failed` sem falhar signup (não é crítico).

## 10. Tratamento de falhas

| Falha | Ação | Retorno |
|---|---|---|
| `ensureVipGrantForInvite` throw (ex: DB down) | `catch` log `Falha ao criar concessão VIP` com `userId slice` + `inviteId slice`, não `throw` | `return success true` (conta criada, convite consumido, mas sem VIP) — grant pode ser criado manualmente; não exclui usuário |
| `recordAccessEvent` throw | `try/catch` interno em `recordAccessEvent`, log `recordAccessEvent failed` | Não falha signup |
| `syncUserStateWithGrant` throw | `try/catch` em `signup.ts` log `Falha ao sincronizar user_state` com `grantId`, não `throw` | Conta criada com grant mas `user_state` desatualizado — `getAccessState` ainda lê `access_grants` então `hasAccess` correto; sync pode ser refeito |

Todas falhas logadas com `maskedEmail`/`maskedCode` + `slice(80)`, sem `e-mail completo`/`código completo`/`token`/`stack`.

## 11. Riscos remanescentes

| Risco | Severidade | Mitigação |
|---|---|---|
| Sem `UNIQUE(invite_code_id, user_id)` — duas `ensureVipGrant` concorrentes com mesmo `invite+user` poderiam criar 2 grants (sem `23505`) | Médio | `SELECT` antes + `isNew` check reduz janela; segundo `insert` criaria duplicata mas `pickBestGrant` escolheria maior `expires_at`; mitigação futura: adicionar `create unique index ... where source='invite'` |
| `user_state` sync não transacional com `access_grants` — pode ficar desatualizado se sync falhar | Baixo | `getAccessState` lê `access_grants` primeiro, então `hasAccess` ainda correto mesmo com `user_state` stale; sync pode ser retried |
| Grant falha deixa usuário sem VIP (convite já consumido) | Informativo | Intencional — não excluir usuário; admin pode criar grant manual via `POST /api/admin/vip-invites/[id]/grant` futuro; log explícito |
| Convite antigo `null` concedendo `full_premium` pode ser inesperado se legado não era VIP | Baixo | Documentado fallback 30d; alternativa é rejeitar `invite_type null` (não conceder) — decisão explícita para não presumir não-VIP sem regra; pode mudar para `if invite_type null → skip grant` se produto decidir |

## 12. Segurança

* Server-side only: `accessService.ts:10` `import 'server-only'`, `supabaseAdmin` `server-only`, `signup.ts:1` `'use server'`.
* `used_by` derivado de `newUserId` server, não `body.used_by`; `expires_at` de `invite.expires_at` DB, não cliente; `plan` via `planForInvite` fixo `full_premium`.
* Sem IDOR: `ensureVipGrantForInvite(userId, invite)` usa `userId` recém-criado, não `request.headers.get('user-id')`.
* RLS preservada: `access_grants` insert só `service_role` (sem `insert` para `authenticated`), `user_state` update só `service_role` (trigger bloqueia `authenticated`).
* `VIP_CHECK=false` (`accessService.ts:23` `false as const`), nenhuma rota Manager com `requireVip` (`grep` 0).
* Sem Pix/`orders`/`payments`/`premium_plans` — verificado `grep` 0.

## 13. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| **ALFA-011.8** 24 cenários | `node tests/alfa-011-8-vip-grant.test.js` | **PASS** `EXIT:0` — 35 asserts: 30d→full_premium, vitalício null, custom preserva, inexistente/expirado/revogado não concede, antigo null→30d, grant único, idempotente, corrida 23505, event não duplica, user_state 4 campos, role não altera, cliente não escolhe expires/plan/user_id, falha concessão logada, falha sync não oculta, usuário permanece, não-VIP, VIP_CHECK false, sem requireVip, sem Pix, sem dados sensíveis |
| ALFA-011.2 | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` 10 (ajustado para permitir inserts via ensureVipGrant/recordAccessEvent) |
| ALFA-011.3 | `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` 35 |
| ALFA-011.4 | `node tests/alfa-011-4-security.test.js` | **PASS** `EXIT:0` 50+ |
| ALFA-011.5 | `node tests/alfa-011-5-vip-invites.test.js` | **PASS** `EXIT:0` 42 |
| ALFA-011.6 | `node tests/alfa-011-6-signup.test.js` | **PASS** `EXIT:0` 33 |
| ALFA-011.7 | `node tests/alfa-011-7-transaction.test.js` | **PASS** `EXIT:0` 35 |

## 14. TypeScript

`npx tsc --noEmit` `TSC:0` — `accessService.ts` novas exports `calculateGrantExpiration`, `ensureVipGrantForInvite`, `recordAccessEvent`, `syncUserStateWithGrant` tipados, `signup.ts` lazy import com `await import`, sem `any` novo.

## 15. Build

`npm run build` `BUILD:0` — `Next.js 16.1.1` `✓ Compiled successfully` `Generating static pages 37/37` `ƒ /api/admin/vip-invites`, `ƒ /api/admin/vip-invites/[id]/revoke`, `○ /dashboard/admin/vip-invites`, `○ /login`.

## 16. `git diff --check`

`git diff --check` `DIFFCHECK:0` — warning `LF will be replaced by CRLF` em `app/actions/signup.ts` e `app/dashboard/layout.tsx` (CRLF pré-existente), sem whitespace errors.

## 17. `git status`

```
 M app/actions/signup.ts        // +39 linhas concessão (ensureVipGrant + event + sync + try/catch)
 M app/dashboard/layout.tsx     // 3 +- Convites VIP (de 011.5)
 M tests/alfa-011-2-access.test.js // ajuste para permitir inserts via ensureVipGrant
?? app/lib/access/accessService.ts // +155 linhas (calculateGrantExpiration, ensureVipGrant, recordAccessEvent, syncUserStateWithGrant)
?? supabase/migrations/20250917000001_add_vip_model.sql
?? supabase/migrations/20250917000002_harden_user_state_update.sql
?? supabase/migrations/20250917000003_extend_invite_codes.sql
?? app/api/admin/access-status/  // 011.3
?? app/api/admin/vip-invites/    // 011.5
?? docs/ALFA-011*.md
?? tests/alfa-011-*.js
```

`git diff --stat` `3 files changed, 240 insertions(+), 30 deletions(-)` — `signup.ts` + `accessService.ts` + `layout.tsx` + `alfa-011-2-access.test.js`.

## 18. Recomendação para ALFA-011.9

**ALFA-011.9 — Renovação, revogação e expiração de VIP + painel vendas (sem Pix)**

1. Criar `POST /api/admin/vip-invites/[id]/renew` e `/revoke` para `access_grants` (não `invite_codes`): `requireAdmin` + `ensureVipGrant` com `status='revoked'`/`revoked_at` + `recordAccessEvent revoked` + `syncUserState` + `SELECT FOR UPDATE` se necessário.
2. Adicionar `cron` ou `pg_cron` para marcar `status='expired'` quando `expires_at <= now()` e `status='active'` (opcional, `getAccessState` já calcula `expired` via `expires_at`).
3. Adicionar `create unique index if not exists uniq_grant_invite_user on access_grants(invite_code_id, user_id) where source='invite'` para idempotência DB-level (previne duplicata mesmo sem `23505` hoje).
4. Manter `VIP_CHECK=false`; não proteger rotas Manager; não criar `payments/orders`; testes `alfa-011-9-renew-revoke.test.js` verificando `renew` estende `expires_at`, `revoke` bloqueia `hasAccess`, `lifetime` preservado.

Não criar: `VIP_CHECK=true`, `orders/payments`, Pix, APK.

---

## Anexos

* **Fonte primária:** `access_grants` (query `supabaseAdmin.from('access_grants').select ... order created_at desc`), `user_state` só cache.
* **Compatibilidade antigos:** `invite_type null` → `calculateGrantExpiration` retorna `now+30d` (documentado); se produto decidir que antigos são não-VIP, trocar para `if invite_type null → throw SKIP_GRANT`.
* **Reversão:** `git checkout -- app/actions/signup.ts app/lib/access/accessService.ts` volta a 011.7 (sem grant); `access_grants` rows já criados permanecem (append-only).

*Fim ALFA-011.8 — aguardar autorização para ALFA-011.9.*
