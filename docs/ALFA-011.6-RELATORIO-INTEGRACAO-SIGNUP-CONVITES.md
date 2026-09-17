# ALFA-011.6 — Relatório Integração Signup com Convites

> **Sprint:** ALFA-011.6 — Integração segura do cadastro com convites (consumo atômico)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + relatório ALFA-011.5
> **Flag:** `VIP_CHECK=false` (inalterada, sem concessão automática)
> **RPC base:** `supabase/migrations/20250917000003_extend_invite_codes.sql` `consume_invite_code(p_code)` (existente, documentado limitação)

---

## 1. Auditoria do fluxo anterior

**`app/actions/signup.ts:17` `signUpWithInviteCode` (72 linhas, antes):**

```ts
// 1. Verifica is_used=false via select eq(code).eq(is_used,false).single()
const {data:codeData} = await supabaseAdmin.from('invite_codes')
  .select('id, code, is_used, created_at').eq('code', inviteCode).eq('is_used',false).single()
// 2. Cria usuário auth.admin.createUser({email,password, user_metadata:{invite_code}})
// 3. Marca usado: update({is_used:true}).eq('id',codeData.id) — não atômico, sem where is_used=false, sem revoked/expires check
// 4. Insert user_state (user_id, track:'Interlagos')
```

**Problemas:**

* Confiava em `is_used` lido previamente; duas requisições simultâneas com mesmo `code` passavam `eq(is_used,false)` e ambas criavam usuário, segunda sobrescrevia `is_used` sem erro (corrida).
* Não verificava `revoked_at` nem `expires_at` — convite revogado/expirado com `is_used=false` ainda passava.
* Aceitava `inviteCode` sem normalização (`" alfa-a1b2-c3d4 "` falhava ou bypass por caixa).
* Mensagem única `Código inválido ou já utilizado` — não distinguia `not_found / already_used / revoked / expired`.
* Não registrava `used_by/used_at` — sem auditoria.
* Criava `user_state` com `insert` sem `upsert` retry.

**`app/login/page.tsx:44` `handleSignUp`:**

* Validava `if (!inviteCode)`, fazia `formData.append('inviteCode', inviteCode)` com `toUpperCase()` client-side, chamava `signUpWithInviteCode`, depois `signInWithPassword` e `router.push('/dashboard/manager')`. Sem limite de tamanho client, sem normalização server.

**`consume_invite_code(p_code)` existente (20250917000003:43):**

* `update set is_used=true, used_at=now(), used_by=auth.uid() where code=p_code and is_used=false and revoked_at null and (expires_at null or > now())` — atômico, mas `used_by=auth.uid()` é `null` quando chamado via `service_role` (signup é `service_role`). Por isso não usada diretamente no signup `service_role`.

**Tipos:** convite `invite_type` `vip_30_days|vip_lifetime|vip_custom`, `expires_at null=vitalício`.

## 2. Arquivos alterados

| Arquivo | Ação | Detalhe |
|---|---|---|
| `app/actions/signup.ts` | **alterado** 72→160 linhas (+88) | Normalização, validação prévia com `expires_at/revoked_at`, ordem segura (createUser antes de consumir), consumo atômico com `used_by` explícito, compensação `deleteUser`, tratamento erro distinto, `user_state` upsert retry, sem VIP |
| `tests/alfa-011-6-signup.test.js` | **criado** 95 linhas | 18 cenários estáticos + extras |
| `docs/ALFA-011.6-RELATORIO-INTEGRACAO-SIGNUP-CONVITES.md` | **criado** | este relatório |
| `app/login/page.tsx` | **não alterado** | Mantido `toUpperCase()` client, mas servidor renorma |
| `supabase/migrations/20250917000003_extend_invite_codes.sql` | **não alterado** | RPC já existia, limitação documentada |
| `app/lib/access/accessService.ts` | **não alterado** | `VIP_CHECK=false` |
| `app/api/admin/vip-invites/**` | **não alterado** | — |
| `app/dashboard/layout.tsx` | **não alterado nesta sprint** | Já tinha `Convites VIP` de ALFA-011.5 (2 linhas) |

`git diff --stat` mostra `app/actions/signup.ts 138 +++++++++- , app/dashboard/layout.tsx 3 +-` (segundo já de ALFA-011.5).

## 3. Estratégia adotada

**Princípio:** não consumir convite antes de validar e criar usuário; consumo atômico após criação com compensação.

```
FormData → normaliza inviteCode (trim, toUpperCase, remove espaços, 4-64 chars, email toLowerCase)
  → pre-check SELECT id, is_used, revoked_at, expires_at WHERE code=normalized (maybeSingle)
       → se !found → INVITE_NOT_FOUND
       → se revoked_at → INVITE_REVOKED
       → se is_used → INVITE_ALREADY_USED
       → se expires_at <= now() → INVITE_EXPIRED
  → auth.admin.createUser({email,password}) → se falhar → USER_CREATE_FAILED (convite intacto)
  → atomic UPDATE invite_codes SET is_used=true, used_at=nowIso, used_by=newUserId
       WHERE id=preCheck.id AND is_used=false AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > nowIso)
       SELECT id maybeSingle
       → se 0 linhas → recheck + deleteUser(newUserId) compensação → INVITE_ALREADY_USED/REVOKED/EXPIRED
  → insert user_state (user_id, track:Interlagos) → se falhar → upsert retry → se ainda falhar → USER_STATE_FAILED (conta criada, convite já consumido corretamente)
  → return success (sem access_grants)
```

**Por que não `consume_invite_code` RPC diretamente:** RPC faz `used_by=auth.uid()` que é `null` para `service_role` (signup roda como `service_role` via `supabaseAdmin`). Para registrar `used_by` corretamente (auditoria), fizemos `UPDATE` explícito com `used_by=newUserId`. RPC permanece útil para fluxo futuro `authenticated` (cliente consumindo seu próprio convite via `POST /api/invite/consume`), mas não para `service_role`.

**Equivalência atômica:** `UPDATE ... WHERE is_used=false ... RETURNING` tem mesma garantia de corrida que RPC (single statement, row-level lock).

## 4. Comportamento transacional

**Limitação documentada (arquitetura atual não permite transação única):**

* `auth.users` (via `auth.admin.createUser`) e `public.invite_codes` são em schemas/bancos separados; Supabase não oferece `BEGIN; createUser; update invite_codes; COMMIT` transacional via JS.
* `supabaseAdmin` REST não é transacional entre `auth` e `public`.

**Solução compensatória (mais segura compatível):**

| Ordem | Por que |
|---|---|
| Validar invite **antes** de criar usuário | Evita criar usuário órfão se convite já inválido; não consome ainda |
| Criar usuário **antes** de consumir | Se consumisse antes e `createUser` falhasse (email duplicado, senha fraca), convite seria inutilizado sem usuário — pior que usuário órfão |
| Consumir **após** criar usuário com `WHERE is_used=false` atômico | Garante que só 1 das N concorrentes consome; outras falham e compensam com `deleteUser` |
| Compensar com `deleteUser` se consumo falhar | Remove conta órfã criada na concorrência; recheck distingue `revoked/expired/used` para mensagem correta |

**Não simulamos transação inexistente:** não usamos `BEGIN` falso. Documentamos que ideal seria RPC `create_user_with_invite` em PL/pgSQL que faça `auth.users` insert + `invite_codes` update em mesma transação DB (requer extensão `supabase_auth_admin` ou trigger), proposta para ALFA-011.7.

## 5. Limitações conhecidas

* **Sem transação ACID entre `auth.users` e `invite_codes`:** compensação `deleteUser` pode falhar (ex: rede), deixando usuário órfão com convite não consumido (inconsistência aceitável, manual cleanup via `auth.admin.listUsers`). Risco baixo em ALFA-011.6 porque `VIP_CHECK=false` e convite já consumido não gera VIP.
* **RPC `consume_invite_code` não usado no signup `service_role`:** permanece para futuro `authenticated` flow; diferença `used_by` documentada.
* **`.or('expires_at.is.null,expires_at.gt.nowIso')` no `supabase-js`:** pode não filtrar corretamente se sintaxe Supabase mudar; fallback é recheck após `update` sem filtro de expiração — mas atual `or` está presente e recheck cobre.
* **Sem teste de concorrência real** — asserts estáticos; E2E com `Promise.all([signup, signup])` requer Supabase staging com `service_role`.

## 6. Tratamento de erros

| Condição | Código | Mensagem usuário | Detalhe |
|---|---|---|---|
| Campos vazios / invite <4 ou >64 | `INVITE_INVALID` | `Preencha todos os campos.` / `Código inválido.` | Normalização falha |
| `select maybeSingle` null | `INVITE_NOT_FOUND` | `Código não encontrado.` | Invite não existe |
| `revoked_at` not null | `INVITE_REVOKED` | `Convite revogado.` | Revogado |
| `is_used=true` | `INVITE_ALREADY_USED` | `Convite já utilizado.` | Usado |
| `expires_at <= now()` | `INVITE_EXPIRED` | `Convite expirado.` | Expirado |
| `select` error | `INVITE_INVALID` | `Erro ao verificar convite.` | Supabase erro |
| `authError` de `createUser` | `USER_CREATE_FAILED` | `authError.message` | Email duplicado etc. |
| `!userData.user` | `USER_CREATE_FAILED` | `Falha ao criar usuário.` | — |
| `update` não retornou linha (concorrência) | `INVITE_ALREADY_USED` (após compensação) | `já utilizado (concorrência)` | + `deleteUser` compensação |
| `insert user_state` falha, retry `upsert` falha | `USER_STATE_FAILED` | `Conta criada, mas falha ao inicializar perfil. Tente fazer login.` | Conta OK, `user_state` pendente |
| `catch` geral | `INVITE_INVALID` | `Erro interno no servidor.` | Log `console.error` server apenas |

**Não expõe:** `service_role`, tokens, `raw_data`, `stack trace` (só `console.error` server), detalhes `supabase` (`error.message` só para `USER_CREATE_FAILED` onde é `Email already exists` útil).

## 7. Medidas de segurança

* **Validação server-side:** tudo em `'use server'` `app/actions/signup.ts:1`, nunca confia em `login/page.tsx` `toUpperCase()` client.
* **Normalização:** `trim().toUpperCase().replace(/\s+/g,'')`, `length 4-64`, `email trim toLowerCase`.
* **Limite tamanho:** 64 chars (código real `ALFA-XXXX-XXXX` 13 chars, limite evita payload abusivo).
* **Não confia em cliente:** ignora `body.expires_at`, `body.used_by`, `body.invite_type` — todos calculados server (`admin.id`, `nowIso`, `invite_type` do DB).
* **IDOR:** não há `userId` client — `invite_code` é público (precisa ser), mas `used_by` é `newUserId` server, não `body.used_by`.
* **Cliente Supabase apropriado:** só `supabaseAdmin` (`createClient SERVICE_ROLE_KEY`) — `supabaseAdmin.auth.admin.createUser/deleteUser`, `supabaseAdmin.from('invite_codes').update`, `supabaseAdmin.from('user_state').insert` — nenhum `supabase.from` anon.
* **Reutilização bloqueada:** `WHERE is_used=false` atômico + `used_by` único.
* **Não vaza existência excessiva:** `INVITE_NOT_FOUND` vs `INVITE_ALREADY_USED` distingue, mas aceitável para UX (admin precisa saber); não vaza `user_id` de quem usou (só `used_by` interno, não retornado).

## 8. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| **ALFA-011.6** 18+3 cenários | `node tests/alfa-011-6-signup.test.js` | **PASS** `EXIT:0` 33 asserts: válido atômico, inexistente→NOT_FOUND, vazio→INVALID, espaços normalizados, expirado→EXPIRED, revogado→REVOKED, usado→ALREADY_USED, vitalício null, 30_days, custom, concorrência atômica+deleteUser, falha usuário→USER_CREATE_FAILED sem consumir, falha user_state→USER_STATE_FAILED+retry, sem concessão VIP, VIP_CHECK false, nenhuma rota Manager requireVip, sem service_role/raw_data, compatível antigos, extra normalização |
| ALFA-011.2 | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` 10 cenários |
| ALFA-011.3 | `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` 35 asserts |
| ALFA-011.4 | `node tests/alfa-011-4-security.test.js` | **PASS** `EXIT:0` 50+ asserts |
| ALFA-011.5 | `node tests/alfa-011-5-vip-invites.test.js` | **PASS** `EXIT:0` 42 asserts |

Sem integração Supabase real — concorrência documentada como limitação.

## 9. Resultado de TypeScript

`npx tsc --noEmit` `TSC:0` — `app/actions/signup.ts` tipagens `FormData`, `supabaseAdmin` métodos `auth.admin.createUser/deleteUser`, `from('invite_codes').update(...).select().maybeSingle()`, `from('user_state').insert/upsert`, sem `any` novo.

## 10. Resultado do build

`npm run build` `BUILD:0` — `Next.js 16.1.1` `✓ Compiled successfully in 21.8s` `Generating static pages 37/37 in 1182ms` `ƒ /api/admin/vip-invites`, `ƒ /api/admin/vip-invites/[id]/revoke`, `○ /dashboard/admin/vip-invites`, `○ /login`, `Proxy (Middleware)` intacto.

## 11. Resultado do `git diff --check`

`git diff --check` `DIFFCHECK:0` — warning `LF will be replaced by CRLF` em `app/actions/signup.ts` e `app/dashboard/layout.tsx` (CRLF pré-existente), sem whitespace errors.

## 12. Resultado do `git status`

```
 M app/actions/signup.ts        // 138 +++++++++- (ALFA-011.6)
 M app/dashboard/layout.tsx     // 3 +- (ALFA-011.5 Convites VIP, já existente)
?? supabase/migrations/20250917000001_add_vip_model.sql
?? supabase/migrations/20250917000002_harden_user_state_update.sql
?? supabase/migrations/20250917000003_extend_invite_codes.sql
?? app/api/admin/access-status/
?? app/api/admin/vip-invites/
?? app/dashboard/admin/vip-invites/
?? app/lib/access/
?? tests/alfa-011-*.js
?? docs/ALFA-011*.md
```

`git diff --stat` `2 files changed, 116 insertions(+), 25 deletions(-)` — só `signup.ts` + `layout.tsx` (layout de 011.5). Nenhum `supabase/migrations` novo nesta sprint.

## 13. Riscos remanescentes

| Risco | Severidade | Mitigação |
|---|---|---|
| Sem transação ACID `auth.users` ↔ `invite_codes` | Médio | Compensação `deleteUser`; proposta RPC transacional `create_user_with_invite` em ALFA-011.7 que faça `insert auth.users` via `auth` schema dentro de `BEGIN` + `update invite_codes` |
| RPC `consume_invite_code` com `auth.uid()` null para `service_role` | Baixo | Documentado, uso direto `UPDATE ... used_by=newUserId` no signup `service_role`; RPC fica para futuro `authenticated` flow |
| `.or` filter Supabase pode não cobrir `expires_at` em todos SDK versions | Baixo | Recheck após update garante mensagem correta; alternativa é remover `or` e só checar `is_used/revoked_at` no UPDATE, deixando expiração só no pre-check (concorrência expiração rara) |
| Convites antigos sem `expires_at/revoked_at` — tratados como `NULL` → disponivel até usado | Informativo | Correto, compatibilidade preservada (`add column if not exists` null) |
| Usuário órfão se `deleteUser` falhar na compensação | Baixo | Manual cleanup via Dashboard `auth.users`; log `console.error` server |

## 14. Recomendação para ALFA-011.7

**ALFA-011.7 — Concessão VIP via convite (sem Pix, com `access_grants`)**

1. Criar RPC `public.create_user_with_invite(p_email text, p_password text, p_code text)` `security definer` que em `BEGIN` faça: `SELECT invite WHERE code and is_used=false ... FOR UPDATE`, `INSERT auth.users`, `UPDATE invite_codes SET used ...`, `INSERT access_grants (user_id, source='invite', invite_code_id, plan='full_premium', status='active', starts_at=now(), expires_at=invite.expires_at_or_calculated, metadata)`, `INSERT access_events`, `UPDATE user_state (vip_status, vip_expires_at, access_plan, access_grant_id)` — tudo transacional; ou manter compensação mas mover lógica para `supabaseAdmin.rpc`.
2. Reutilizar `consume_invite_code` corrigido para aceitar `p_user_id uuid` param quando `service_role` (alterar migration para `COALESCE(auth.uid(), p_user_id)`).
3. Manter `VIP_CHECK=false` ainda; não proteger rotas Manager; não criar `payments/orders`.
4. Testes: `npm run build` + `tests/alfa-011-7-grant.test.js` verificando `access_grants` criado, `user_state` sync, `invite` vitalício → `expires_at null` vira `lifetime` em `accessService`.

Não criar: `renew/revoke grant`, `VIP_CHECK=true`, `premium_plans/orders/payments`, Pix, APK.

---

## Anexos

* **Ordem das operações:** validar (select maybeSingle) → criar usuário (auth) → consumir atômico (update where) → inserir user_state (insert + upsert retry) — sem conceder VIP.
* **Compatibilidade:** convites antigos `is_used=false` sem `expires_at/revoked_at` continuam válidos; normalização `ALFA-A1B2-C3D4` com `trim/toUpperCase` preserva `AdminInviteButton.tsx:42` + `login/page.tsx:268` `toUpperCase()` client.
* **Reversão:** `git checkout -- app/actions/signup.ts` volta aos 72 linhas originais; RPC e colunas permanecem (aditivas).

*Fim ALFA-011.6 — aguardar autorização para ALFA-011.7.*
