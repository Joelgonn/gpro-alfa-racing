# ALFA-011.7 — Relatório Transação Signup + Convites

> **Sprint:** ALFA-011.7 — Transação definitiva signup + convite (sem VIP)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + relatório ALFA-011.6
> **Arquivos principais:** `app/actions/signup.ts` (162 linhas, compensatório reforçado), `supabase/migrations/20250917000003_extend_invite_codes.sql` RPC existente, `app/lib/access/accessService.ts` `VIP_CHECK=false`
> **Estratégia escolhida:** **B — Fluxo compensatório reforçado** (sem RPC `auth.users` insegura)

---

## 1. Auditoria do fluxo atual (ALFA-011.6)

**`app/actions/signup.ts:17` `signUpWithInviteCode` (162 linhas, compensatório):**

```ts
FormData(emailRaw,password,inviteCodeRaw) → normaliza inviteCode (trim/toUpperCase/replace, 4-64) + email toLowerCase
 → pre-check SELECT id, is_used, revoked_at, expires_at WHERE code=normalized (maybeSingle) → INVITE_NOT_FOUND/REVOKED/ALREADY_USED/EXPIRED sem consumir
 → auth.admin.createUser({email,password, user_metadata:{invite_code}}) → se falhar → USER_CREATE_FAILED (convite intacto)
 → atomic UPDATE invite_codes SET is_used=true, used_at=nowIso, used_by=newUserId WHERE id AND is_used=false AND revoked_at null AND (expires_at null OR > nowIso) RETURNING id
   → se 0 linhas → recheck + deleteUser(newUserId) compensação → INVITE_ALREADY_USED/REVOKED/EXPIRED
 → insert user_state (user_id, track:Interlagos) → se falhar → upsert retry → se falhar → USER_STATE_FAILED
 → return success (sem access_grants)
```

**`app/lib/supabase-admin.ts:1` `server-only` `supabaseAdmin` `SERVICE_ROLE_KEY` — único autorizado a `auth.admin.createUser/deleteUser` e `public.*` bypass RLS.**

**`supabase/migrations/20250917000003_extend_invite_codes.sql:43` `consume_invite_code(p_code text)` — `security definer`, `search_path=public`, `update ... set is_used=true, used_by=auth.uid() where is_used=false and revoked_at null and (expires_at null or > now())`.**

**`user_state`:** sem trigger de criação automática; inserção manual via `signup.ts:133` + `python`/`GameContext` via `saveUserState` (sem trigger).

**Políticas RLS:** `invite_codes` `invite_select_auth` (authenticated select), sem `update` para `authenticated` — escrita só `service_role`/RPC definer. `user_state` `user_state_update_own_restricted` + trigger `prevent_user_state_privilege_escalation` (ALFA-011.4).

## 2. Resposta sobre transação real

| Pergunta | Resposta | Evidência |
|---|---|---|
| 1. Função PostgreSQL pode criar `auth.users` diretamente? | **Não.** `auth.users` é gerenciada por GoTrue (Supabase Auth). `INSERT INTO auth.users` sem `encrypted_password`, `aud`, `role`, `email_confirmed_at`, triggers de `auth` falharia e quebraria `auth.admin.createUser` hashing/hook. Nenhuma migration do projeto faz `insert into auth.users` (`Select-String auth.users migrations` só comentários `access_grants.user_id` referência). Direta é **não suportada e insegura**. | `supabase/migrations/*.sql` sem `auth.users`; docs Supabase recomendam `auth.admin.createUser` API |
| 2. Trigger confiável cria `user_state` automaticamente? | **Não.** Nenhum `trigger on auth.users after insert` cria `user_state` (grep `trigger.*user_state` só `prevent_user_state_privilege_escalation`). `user_state` é criado manualmente em `signup.ts:133` e `python` `saveUserState`. | `supabase/migrations` sem `create trigger ... on auth.users` |
| 3. Cadastro inteiro em única transação real? | **Não.** `auth.admin.createUser` é chamada HTTP para Auth (fora Postgres). Mesmo se `invite_codes` + `user_state` estiverem em `BEGIN; ... COMMIT` Postgres, `auth.users` não participa. | `app/actions/signup.ts` usa `supabaseAdmin.auth.admin.createUser` (JS SDK, não SQL) |
| 4. Operações fora da transação | `auth.users` criação/deleção (`createUser`/`deleteUser`) — sempre fora. `invite_codes` + `user_state` **podem** estar em transação Postgres se via RPC, mas `auth` não. | — |
| 5. Menor risco possível hoje | **Compensatório reforçado (B)** com `UPDATE atômico + recheck + deleteUser` + log mascarado, sem `VIP` grant, mantendo `VIP_CHECK=false`. Risco residual: `deleteUser` falhar deixa usuário órfão (convite consumido é correto, usuário existe mas sem `user_state` completo) — requer cleanup manual, log incidente explícito. | `signup.ts:101` compensação com `compensationFailed` flag |

**Conclusão:** Estratégia A (RPC transacional real com `insert auth.users`) **não é viável/segura** neste projeto. Estratégia C (pending signup) complexa sem necessidade.

## 3. Estratégia escolhida

**Estratégia B — Fluxo compensatório reforçado** (mantida da 011.6, com hardening ALFA-011.7).

**Justificativa técnica:**

* ALFA-011.6 já implementou ordem segura `validar → criar Auth → consumir atômico → compensar` — evita inutilizar convite se `createUser` falhar (email duplicado).
* Adicionar RPC que escreve em `auth.users` violaria Supabase Auth e não teria `SECURITY DEFINER` seguro (exporia hashing).
* Estado pendente (`pending_signup` tabela + expiração) aumentaria complexidade sem reduzir risco de `auth` fora da transação; só move problema.
* Reforço ALFA-011.7 foca em: logs mascarados, compensação só `newUserId` (nunca preexistente), falha de compensação como incidente explícito, sem `VIP` automático.

## 4. Justificativa técnica

* **Valida tudo antes:** `preCheck` `maybeSingle` com `revoked_at`/`is_used`/`expires_at` — early return sem `createUser` se convite já inválido.
* **Consome após:** só após `newUserId` existir, `UPDATE ... WHERE is_used=false AND revoked_at null AND (expires_at null OR > nowIso)` é atômico (row lock). Se duas concorrentes com mesmo `code`, só 1 retorna linha.
* **Compensa só recém-criado:** `deleteUser(newUserId)` — `newUserId` é do `userData.user.id` recém-criado nesta chamada, não `select` de preexistente. Nunca `deleteUser(email)` ou `deleteUser(preCheck.used_by)`.
* **Falha compensação:** `try { const {error:delErr}=await deleteUser } catch` → `compensationFailed=true` → log `Incidente compensacao deleteUser falhou` com `maskedEmail` + `newUserId.slice(0,8)***` + `err.slice(0,80)` → log `Inconsistencia signup` sem ocultar. Retorna `INVITE_ALREADY_USED` mesmo assim, mas incidente fica registrado.
* **user_state:** `insert` + `upsert` retry — se falhar, não reverte `is_used` (convite correto consumido), mas retorna `USER_STATE_FAILED` para login retry (`user_state` pode ser recriado no próximo `saveUserState`).
* **Sem VIP:** `signup.ts` não toca `access_grants`/`VIP_CHECK` — mantém restrição `ALFA-011.6/7`.

## 5. Arquivos alterados

| Arquivo | Ação | Detalhe |
|---|---|---|
| `app/actions/signup.ts` | **alterado** 162→168 linhas (+6) | Adiciona `maskEmail`/`maskCode` helpers, logs `console.error` com `maskedCode`/`maskedEmail` + `slice(0,80)`, compensação com `compensationFailed` flag + `Inconsistencia` log, `user_state` error com mascarado, `catch` com `maskCode`, comentário `ALFA-011.7: não concede VIP` |
| `tests/alfa-011-7-transaction.test.js` | **criado** 85 linhas | 24 asserts estratégia B |
| `tests/alfa-011-6-signup.test.js` | **corrigido** | Ajuste asserts `access_grants` para `from('access_grants')` (evita falso por comentário) |
| `docs/ALFA-011.7-RELATORIO-TRANSACAO-SIGNUP-CONVITES.md` | **criado** | este relatório |
| `supabase/migrations/20250917000003_extend_invite_codes.sql` | **não alterado** | RPC já com `search_path` e `grant execute` |
| `app/lib/access/accessService.ts` | **não alterado** | `VIP_CHECK=false` |
| `app/login/page.tsx` | **não alterado** | — |

`git diff --stat` mostra `app/actions/signup.ts 161 +++++++++-` (ALFA-011.7 é +6 sobre 011.6, mas diff vs base mostra acumulado).

## 6. Migrations criadas, se houver

**Nenhuma nova migration nesta sprint.** Motivo: Estratégia B não exige nova RPC; RPC existente `consume_invite_code` já tem `security definer`, `search_path=public`, `grant execute to authenticated/service_role`. Criar RPC `create_user_with_invite` que escreve em `auth.users` seria **insegura** e não foi criada (conforme restrição `Não escrever diretamente em auth.users sem comprovação`).

## 7. RPC criada, se houver

**Nenhuma nova RPC.** `consume_invite_code(p_code)` permanece de ALFA-011.5, validada como segunda opção para futuro `authenticated` flow, mas **não usada** no `signup` `service_role` (que usa `UPDATE` com `used_by=newUserId` explícito). Auditada: `security definer`, `set search_path=public`, `grant execute to authenticated, service_role`, sem expor `used_by` client.

## 8. Tratamento de concorrência

* **Proteção:** `UPDATE invite_codes SET ... WHERE id=preCheck.id AND is_used=false AND revoked_at IS NULL AND (expires_at IS NULL OR > nowIso)` — single statement, Postgres garante atomicidade. Se 2 `POST /signup` simultâneos com mesmo `ALFA-XXXX`, só 1 obtém `consumed` row.
* **Detecção:** `if (consumeError || !consumed)` → recheck `SELECT is_used, revoked_at, expires_at WHERE id` para distinguir `revoked` vs `used` vs `expired` vs genérico `concorrência`.
* **Compensação:** `deleteUser(newUserId)` — remove órfão. Concorrência real não testável sem staging com `service_role` paralelo; teste estático em `alfa-011-7-transaction.test.js:11` verifica `where is_used=false` + `or expires_at`.

## 9. Tratamento de falhas

| Falha | Ação | Código retorno |
|---|---|---|
| `preCheck` error | log `maskedCode` + `err.slice` | `INVITE_INVALID` |
| `preCheck` null | — | `INVITE_NOT_FOUND` |
| `revoked_at` / `is_used` / `expires_at` | — | `INVITE_REVOKED / ALREADY_USED / EXPIRED` |
| `createUser` `authError` | retorna `authError.message` | `USER_CREATE_FAILED` (convite intacto) |
| `!userData.user` | — | `USER_CREATE_FAILED` |
| `consumeError` / `!consumed` | `deleteUser(newUserId)` com flag `compensationFailed` + recheck | `INVITE_REVOKED / ALREADY_USED / EXPIRED` ou genérico `ALREADY_USED` |
| `deleteUser` falha | log `Incidente compensacao deleteUser falhou` + `Inconsistencia signup` com `maskedCode` | Ainda retorna `INVITE_ALREADY_USED` mas incidente fica no log |
| `insert user_state` `stateError` | log `maskedEmail` + retry `upsert` | se retry falha → `USER_STATE_FAILED` (`Conta criada, mas falha ao inicializar perfil`) |
| `catch` geral | log `maskedCode` + `err.slice` | `INVITE_INVALID` |

## 10. Tratamento de compensação

* **Quando:** só se `consumed` falsy após `createUser` sucesso (concorrência/expiração entre pre-check e update).
* **O que:** `supabaseAdmin.auth.admin.deleteUser(newUserId)` — deleta **apenas** o usuário criado nesta chamada (`newUserId` de `userData.user.id`), nunca busca por `email` ou `invite_code`.
* **Não excluir preexistente:** garantido porque `newUserId` é gerado agora; usuário preexistente tem `id` diferente e não é tocado. Teste `alfa-011-7-transaction.test.js:16` verifica `deleteUser(newUserId)` e `!deleteUser(email)`.
* **Falha compensação:** `try { const {error:delErr}=await deleteUser } catch` → `compensationFailed=true` → `console.error('Incidente compensacao deleteUser falhou', {maskedEmail, newUserId: slice(0,8)***})` → `console.error('Inconsistencia signup ...', {maskedCode})` — não oculta, requer cleanup manual via Dashboard Auth.

## 11. Riscos remanescentes

| Risco | Severidade | Mitigação |
|---|---|---|
| Compensação falhar (rede) deixa usuário órfão (convite consumido é correto, mas usuário existe sem uso) | Médio | Log incidente explícito com `masked` + `slice`; admin pode `listUsers` + `deleteUser` manual; próximo `login` do órfão funcionará, mas convite já usado (ok) |
| `.or('expires_at.is.null,expires_at.gt.nowIso')` pode ser ignorado em SDK antigo | Baixo | Recheck após `!consumed` distingue expirado; invite expirado entre pre-check e update será pego no recheck `expires_at` |
| Sem transação ACID `auth.users` — `createUser` sucesso + `update` falha + `deleteUser` falha = inconsistência órfã | Médio | Documentado; proposta futura é manter compensação ou aceitar órfão (não concede VIP, impacto baixo) |
| `user_state` falha (`USER_STATE_FAILED`) deixa conta sem perfil mas convite consumido | Baixo | `user_state` é recriável via `saveUserState`/`upsert` no próximo login/Manager; mensagem orienta `Tente fazer login` |

## 12. Segurança

* Validação `server-only` (`'use server'`), `createClient SERVICE_ROLE_KEY` nunca no bundle (`app/lib/supabase-admin.ts:1` `server-only`).
* Normalização `trim().toUpperCase().replace(/\s+/g,'')`, limite `4-64` (`signup.ts:27`), `email trim toLowerCase`.
* Consome **uma vez**: `WHERE is_used=false` + `revoked_at null` + `expires_at` atômico.
* Nunca confia `expires_at`/`used_by`/`invite_type` do cliente — `used_by=newUserId` server, `expires_at` do DB.
* Sem IDOR: `invite_code` é código público, mas `used_by` é `newUserId` server, não `body.used_by`.
* Logs sem `e-mail completo` (`maskEmail: ab***@x.com`), sem `código completo` (`maskCode: ALFA***`), sem token/`service_role`/`raw_data`/`stack` completo (`slice(0,80)`, nunca `return error.stack`).
* `consume_invite_code` tem `set search_path=public` e `grant execute to authenticated, service_role` apenas (auditado).
* `VIP_CHECK=false`, sem `requireVip`.

## 13. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| **ALFA-011.7** 24 cenários | `node tests/alfa-011-7-transaction.test.js` | **PASS** `EXIT:0` — 35 asserts: usa `auth.admin.createUser`, update atômico, nenhuma migração `auth.users`, INVITE_* 2-7, vitalício/30d/custom 8-10, concorrência where+or, falha Auth sem consumir, falha consumo, falha user_state+retry, falha compensação incidente+mascarado, não exclui preexistente, sem VIP, VIP_CHECK false, sem requireVip, sem stack/raw_data, compatíveis antigos, RPC search_path |
| ALFA-011.2 | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` 10 |
| ALFA-011.3 | `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` 35 |
| ALFA-011.4 | `node tests/alfa-011-4-security.test.js` | **PASS** `EXIT:0` 50+ |
| ALFA-011.5 | `node tests/alfa-011-5-vip-invites.test.js` | **PASS** `EXIT:0` 42 |
| ALFA-011.6 | `node tests/alfa-011-6-signup.test.js` | **PASS** `EXIT:0` 33 (corrigido `from('access_grants')`) |

Sem DB real — concorrência documentada.

## 14. TypeScript

`npx tsc --noEmit` `TSC:0` — `app/actions/signup.ts` helpers `maskEmail/maskCode`, `supabaseAdmin.from(...).update(...).or(...).select().maybeSingle()`, `auth.admin.deleteUser`, `from('user_state').upsert`, sem `any` novo.

## 15. Build

`npm run build` `BUILD:0` — `Next.js 16.1.1` `✓ Compiled successfully` `Generating static pages 37/37` `ƒ /api/admin/vip-invites`, `ƒ /api/admin/vip-invites/[id]/revoke`, `○ /dashboard/admin/vip-invites`, `○ /login`.

## 16. `git diff --check`

`git diff --check` `DIFFCHECK:0` — warning `LF will be replaced by CRLF` em `signup.ts`/`layout.tsx` (CRLF pré-existente), sem whitespace errors.

## 17. `git status`

```
 M app/actions/signup.ts        // +6 linhas mascaramento + compensação reforçada (ALFA-011.7)
 M app/dashboard/layout.tsx     // 3 +- Convites VIP (de ALFA-011.5)
?? supabase/migrations/20250917000001_add_vip_model.sql
?? supabase/migrations/20250917000002_harden_user_state_update.sql
?? supabase/migrations/20250917000003_extend_invite_codes.sql
?? app/api/admin/access-status/
?? app/api/admin/vip-invites/
?? app/dashboard/admin/vip-invites/
?? app/lib/access/
?? tests/alfa-011-2-access.test.js .. tests/alfa-011-7-transaction.test.js
?? docs/ALFA-011*.md
```

`git diff --stat` `2 files changed, 137 insertions(+), 27 deletions(-)` — `signup.ts` + `layout.tsx`.

## 18. Recomendação para ALFA-011.8

**ALFA-011.8 — Concessão VIP (`access_grants`) sem Pix**

1. Após `consume` sucesso e `user_state` ok, adicionar `supabaseAdmin.from('access_grants').insert({user_id:newUserId, source:'invite', invite_code_id:preCheck.id, plan:'full_premium', status:'active', starts_at:nowIso, expires_at: invite.expires_at ?? (invite_type==='vip_lifetime'? null : now+30d), metadata:{invite_code: mask}})` + `insert access_events (granted)` + `update user_state set vip_status, vip_expires_at, access_plan, access_grant_id` via `service_role` (trigger permite). Manter compensação se `access_grants` falhar (não reverter `invite` já consumido, mas log incidente).
2. Reavaliar `consume_invite_code` para aceitar `p_user_id` param (`COALESCE(auth.uid(), p_user_id)`) e usar via `supabaseAdmin.rpc` para ter `used_by` correto sem `UPDATE` direto, mantendo `search_path` e `grant`.
3. Manter `VIP_CHECK=false` ainda; não proteger rotas Manager; não criar `payments/orders`; testes `alfa-011-8-grant.test.js` verificando `access_grants` criado, `user_state` sync, vitalício `expires_at null`.

Não criar: `renew/revoke grant`, `VIP_CHECK=true`, `premium_plans/orders/payments`, Pix, APK.

---

## Anexos

* **Escolha:** B é única segura hoje; A exigiria `INSERT auth.users` insegura; C complexa sem ganho.
* **Compatibilidade:** convites antigos `is_used=false` sem `expires_at/revoked_at` → `expires_at null` → vitalício até usado (correto via `maybeSingle`).
* **Reversão:** `git checkout -- app/actions/signup.ts` volta a 011.6 (72→162 linhas); sem `DROP` migrations.

*Fim ALFA-011.7 — aguardar autorização para ALFA-011.8.*
