# ALFA-011.5 — Relatório Gerenciador de Convites VIP

> **Sprint:** ALFA-011.5 — Gerenciador administrativo de convites VIP
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + relatórios ALFA-011.1..4
> **Flag:** `VIP_CHECK=false` (inalterada)
> **Migrations base:** `20250917000001_add_vip_model.sql` + `20250917000002_harden_user_state_update.sql` (inalteradas)

---

## 1. Auditoria da estrutura antiga

**`public.invite_codes` encontrada em produção (via `app/actions/admin.ts:31` e `app/actions/signup.ts:30`):**

| Campo | Tipo | Estado | Fonte |
|---|---|---|---|
| `id` | `uuid pk` | existe | `signup.ts:30` select |
| `code` | `text unique ALFA-XXXX-XXXX` | existe | `admin.ts:28` |
| `is_used` | `boolean` | existe | `admin.ts:33`, `signup.ts:32` |
| `created_at` | `timestamptz` | existe | `signup.ts:30` |
| `used_by` | — | **ausente** | — |
| `used_at` | — | **ausente** | — |
| `created_by` | — | **ausente** | — |
| `expires_at` | — | **ausente** | — |
| `revoked_at` | — | **ausente** | — |
| `revoked_by` | — | **ausente** | — |
| `invite_type` | — | **ausente** | — |
| `metadata` | — | **ausente** | — |

**RLS:** `supabase/migrations/20250914000001_rls_hardening.sql:69` `invite_select_auth` (`auth.role()='authenticated'` select), sem `insert/update/delete` para `authenticated` — escrita só `service_role` (via `supabaseAdmin` em `admin.ts:6` e `signup.ts:6`).

**Geração atual:** `app/actions/admin.ts:12` `generateNewInvite(userId)` — verifica `user_state.role='admin'` (`:14`), gera `ALFA-XXXX-XXXX` via `crypto.randomUUID` (`:25`), `insert {code,is_used:false}` (`:31`).

**Signup:** `app/actions/signup.ts:28` `select ... eq('code',...).eq('is_used',false).single()` → `createUser` (`:40`) → `update {is_used:true}` **não atômico** (`:52` `.eq('id',codeData.id)`), sem `used_by/used_at`.

**Limitações:** sem validade temporal, sem revogação, sem `created_by`, sem atomicidade. Convite antigos com `code, is_used, created_at` apenas — compatibilidade deve ser preservada com `NULL` para novos campos.

**Padrão admin:** `app/dashboard/admin/layout.tsx:26` `role !== 'admin' → redirect`, `app/lib/auth.ts:61` `requireAdmin`, `app/dashboard/layout.tsx:264` `filter group.id !== 'administration' || localRole==='admin'`, `app/api/admin/access-status/route.ts:20` `requireAdmin`.

## 2. Migration criada

`supabase/migrations/20250917000003_extend_invite_codes.sql` (88 linhas, aditiva, idempotente, sem `DROP TABLE/TRUNCATE`, sem `NOT NULL`):

```sql
alter table public.invite_codes add column if not exists used_by uuid;
alter table public.invite_codes add column if not exists used_at timestamptz;
alter table public.invite_codes add column if not exists created_by uuid;
alter table public.invite_codes add column if not exists expires_at timestamptz;
alter table public.invite_codes add column if not exists revoked_at timestamptz;
alter table public.invite_codes add column if not exists revoked_by uuid;
alter table public.invite_codes add column if not exists invite_type text;
alter table public.invite_codes add column if not exists metadata jsonb not null default '{}'::jsonb;
-- índices parciais: expires_at, revoked_at, used_by, created_by, is_used, invite_type
-- check invite_type in ('vip_30_days','vip_lifetime','vip_custom')
-- RPC consume_invite_code(p_code text) security definer atomically update is_used=true where is_used=false and revoked_at null and (expires_at null or > now)
-- notify pgrst
```

Timestamp `20250917000003` segue `20250917000002`.

## 3. Campos adicionados

Todos `NULL` (ou `metadata '{}'`) para compatibilidade:

| Campo | Tipo | Comentário |
|---|---|---|
| `used_by` | `uuid` | usuário que utilizou; NULL se não usado |
| `used_at` | `timestamptz` | data de uso |
| `created_by` | `uuid` | admin criador |
| `expires_at` | `timestamptz` | validade; NULL=vitalício |
| `revoked_at` | `timestamptz` | revogação; NULL se não revogado |
| `revoked_by` | `uuid` | admin que revogou |
| `invite_type` | `text` check `vip_30_days|vip_lifetime|vip_custom` | tipo |
| `metadata` | `jsonb not null default '{}'` | `{validityType}` |

Preserva `id, code, is_used, created_at`. Convites antigos permanecem `is_used=false/true` sem `expires_at` (tratados como disponível até revogação).

## 4. APIs criadas

| Método | Rota | Arquivo | Auth | Entrada | Saída | Segurança |
|---|---|---|---|---|---|---|
| `GET` | `/api/admin/vip-invites` | `app/api/admin/vip-invites/route.ts:18` | `requireAdmin` | — | `{invites: [{id,code,is_used,used_by,used_at,created_by,created_at,expires_at,revoked_at,revoked_by,invite_type,status}], count}` — status calculado `disponivel/utilizado/expirado/revogado` | `supabaseAdmin`, sem `raw_data`/token/`service_role`, sem `userId` client |
| `POST` | `/api/admin/vip-invites` | `...:route.ts:60` | `requireAdmin` | `{validityType: '30_days'|'lifetime'|'custom', customExpiresAt?: ISO}` | `201 {invite}` | Valida enum, `customExpiresAt` no futuro, max 2 anos, gera `ALFA-XXXX` via `crypto.randomUUID` server, retry se `23505` unique, ignora `created_by/expires_at` do cliente |
| `POST` | `/api/admin/vip-invites/[id]/revoke` | `app/api/admin/vip-invites/[id]/revoke/route.ts:14` | `requireAdmin` | `params.id` | `{invite: {... status: 'revogado'}}` ou `409 ALREADY_REVOKED / ALREADY_USED` | Busca `is_used` + `revoked_at`, bloqueia já usado, `update revoked_at/By` com `is('revoked_at',null).eq('is_used',false)` |

`PUT/PATCH/DELETE` → `405`. Não retornam `raw_data`, `gpro_token`, `payments`.

## 5. Página criada

`app/dashboard/admin/vip-invites/page.tsx` (191 linhas, `'use client'`):

* **Admin-only** via `app/dashboard/admin/layout.tsx:26` (server redirect se não admin); não há `useEffect` com `role` client
* **Formulário** select `30 dias | Vitalício | Data personalizada` + `datetime-local` quando `custom` → `POST /api/admin/vip-invites`
* **Lista** `GET /api/admin/vip-invites` — tabela `Código (com Copiar) | Tipo | Status (disponivel/utilizado/expirado/revogado com cores) | Criado em | Expira em (ou Vitalício) | Ações (Revogar se disponivel)`
* **Revogar** `POST .../[id]/revoke` com `confirm()` — não `DELETE`
* **Estados:** `Carregando...` (loading), `Nenhum convite criado ainda` (vazio), `bg-rose-50` erro, `bg-emerald-50` mensagem sucesso, `Atualizar` botão
* Não cria botão `conceder VIP` / `renovar` / financeiro — fora do escopo
* Não incluída no APK — `administration` grupo filtrado por `localRole==='admin'` + `admin/layout.tsx` bloqueia

## 6. Regras de validade

| Tipo | `validityType` | Cálculo servidor | `expires_at` | `invite_type` |
|---|---|---|---|---|
| 30 dias | `30_days` | `new Date(); d.setDate(d.getDate()+30); expires_at=d.toISOString()` | futuro 30d | `vip_30_days` |
| Vitalício | `lifetime` | `expires_at=null` | `null` | `vip_lifetime` |
| Data personalizada | `custom` + `customExpiresAt` ISO | Valida `!isNaN`, `> now()`, `<= now+2years`, `expires_at=parsed.toISOString()` | custom | `vip_custom` |

Servidor valida e calcula — `expires_at` nunca vem livre do cliente (`body.expires_at` ignorado). Limite 2 anos documentado. `metadata:{validityType}` para auditoria.

## 7. Regras de revogação

* Somente `requireAdmin`
* Não apaga registro — `update {revoked_at: now(), revoked_by: admin.id}` (`app/api/.../revoke:58`)
* Não revoga se `revoked_at` já preenchido → `409 ALREADY_REVOKED`
* Não revoga se `is_used=true` → `409 ALREADY_USED` (decisão explícita ALFA-011.5: preservar rastreabilidade de convite usado; futura desvinculação via `access_grants` não via `invite_codes`)
* Impede repetida via `is('revoked_at',null).eq('is_used',false)` no `update`
* Retorna `status: 'revogado'` após sucesso

## 8. Regras de uso

```ts
disponivel: !revoked_at && !is_used && (!expires_at || expires_at > now())
utilizado:  is_used
expirado:   !revoked_at && !is_used && expires_at !== null && expires_at <= now()
revogado:   revoked_at !== null
```

Verificação no servidor:

* **Criação:** `POST` ignora `is_used/used_by`; sempre `is_used=false`
* **Listagem:** `computeStatus` no `GET` (`route.ts:12`)
* **Signup futuro:** `consumer` usará `consume_invite_code(p_code)` RPC atômico (`UPDATE ... WHERE is_used=false AND revoked_at IS NULL AND (expires_at IS NULL OR > now())`) — protege contra corrida; nesta sprint `signup.ts` não alterado (pendência seção 10)
* **Lista vazia / expirado / revogado** tratados visualmente na página (badge cores)

## 9. Proteção administrativa

* `requireAdmin` em todas as APIs (`auth.ts:61` `requireAuth + isAdmin supabaseAdmin.from('user_state').select('role')`)
* `supabaseAdmin` `server-only` (`app/lib/supabase-admin.ts:1` `import 'server-only'`) — nunca no bundle (`app/api/admin/vip-invites/route.ts:4` server)
* Sem `service_role` no return — sanitiza `sanitizeInvite` só 11 campos
* Sem `gpro_token` / `raw_data` / financeiro
* Não aceita `created_by/is_used/used_by/revoked_by/expires_at` do cliente — todos calculados server (`admin.id`, `now()`, `parsed`)
* `app/dashboard/admin/layout.tsx:26` `role !== 'admin' → redirect('/dashboard?error=admin_required')` — página inacessível para `user`
* Sidebar `app/dashboard/layout.tsx:264` `filter group.id !== 'administration' || localRole==='admin'` — novo item `Convites VIP /dashboard/admin/vip-invites` (`440`) só aparece para `admin`, não para `user`, não no APK sem admin
* Sem `localStorage` como fonte de segurança — `requireAdmin` via `createClient().auth.getUser()` cookies (`utils/supabase/server.ts:4`)

## 10. Tratamento de concorrência

**Risco existente:** `app/actions/signup.ts:52` `update({is_used:true}).eq('id',codeData.id)` não atômico — duas requisições simultâneas com mesmo `code` podem passar `eq('is_used',false)` e ambas criar usuário, segunda sobrescreve `is_used`.

**Correção ALFA-011.5:** RPC `public.consume_invite_code(p_code text)` (`supabase/migrations/20250917000003:30`):

```sql
update invite_codes set is_used=true, used_at=now(), used_by=auth.uid()
where code=p_code and is_used=false and revoked_at is null and (expires_at null or > now())
returning id, code
-- só uma retorna linha; outra retorna 0 linhas → caller sabe que já foi consumido
```

* Atomicidade via `UPDATE ... WHERE` single statement (Postgres row lock)
* `security definer` permite `authenticated` chamar mesmo sem `update` policy (RLS bypass via definer)
* `grant execute to authenticated, service_role`
* **Pendência explícita:** `signup.ts` **não alterado nesta sprint** para não fazer alteração parcial (`VIP_CHECK=false` e `access_grants` ainda não concedidos). Integração será em ALFA-011.6 onde `signUpWithInviteCode` passará a chamar `consume_invite_code` + criar `access_grants`. Documentado aqui como limitação.

Criação de convite também com retry `23505` (`route.ts:95`) para colisão de `code ALFA-XXXX` (probabilidade baixa mas tratada).

## 11. Testes

| Suite | Comando | Resultado |
|---|---|---|
| **Novo ALFA-011.5** 30 cenários | `node tests/alfa-011-5-vip-invites.test.js` | **PASS** `EXIT:0` — 42 asserts: autorização 1-5 (requireAdmin, 405, sem IDOR), validade 6-13 (30/lifetime/custom, rejeita passado/inválida, expirado/revogado/usado), segurança 14-25 (código server, created_by/is_used/revoked_by server, expires_at validado, sem credenciais/token/raw_data/payments, sem concessão automática, VIP_CHECK false, nenhuma rota Manager requireVip), interface 26-30 (admin-only layout, Sidebar item filtrado, loading/vazio, revoga update não delete, copiar), migration M1-M2 (8 campos, RPC atômico com is_used/revoked/expires check) |
| Regressão ALFA-011.4 | `node tests/alfa-011-4-security.test.js` | **PASS** `EXIT:0` 50+ asserts |
| Regressão ALFA-011.3 | `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` 35 asserts |
| Regressão ALFA-011.2 | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` 35 asserts |

Todos estáticos (`fs.readFileSync` + `includes`), sem DB real — limitação documentada.

## 12. TypeScript

`npx tsc --noEmit` `TSC:0` — `app/api/admin/vip-invites/route.ts` `NextRequest/NextResponse`, `app/dashboard/admin/vip-invites/page.tsx` `'use client'` com `useState`, `supabase/migrations/*.sql` não afeta `tsc`, nenhum `any` novo injustificado.

## 13. Build

`npm run build` `BUILD:0` — `Next.js 16.1.1 (Turbopack)` `✓ Compiled successfully in 21.8s → 13.4s` `Generating static pages 37/37 in 1182ms` `Route ... ƒ /api/admin/vip-invites, ƒ /api/admin/vip-invites/[id]/revoke, ○ /dashboard/admin/vip-invites` listados, `Proxy (Middleware)` intacto.

## 14. Riscos restantes

| Risco | Severidade | Detalhe |
|---|---|---|
| `signup.ts` ainda com `update is_used` não atômico | Médio | Corrigido via RPC mas não integrado — duas signups simultâneas ainda podem colidir até ALFA-011.6; documento como pendência aceita |
| `invite_codes` exposto `code` para admin em `GET` — se admin vazar lista, códigos são sensíveis | Baixo | `GET` só `requireAdmin` + `supabaseAdmin`; não existe `GET` público; `code` necessário para compartilhar via WhatsApp (`AdminInviteButton.tsx:42` pattern) |
| `access_grants` ainda não criado no signup — convite apenas convite, não VIP | Informativo | Intencional ALFA-011.5 (não conceder VIP) — `hasVipAccess` ainda `false` (exceto admin) |
| Migration ainda não aplicada no remoto | Informativo | `supabase db push` pendente; `notify pgrst` incluso |

## 15. Próximos passos da ALFA-011.6

**ALFA-011.6 — Concessão VIP via convite (sem Pix)**

1. Integrar `app/actions/signup.ts:28` para usar `supabaseAdmin.rpc('consume_invite_code', {p_code: inviteCode})` atomicamente antes de `createUser` (ou após, com rollback se falhar), e ao criar `access_grants` (`source='invite', invite_code_id, plan='full_premium', status='active', starts_at=now(), expires_at=invite.expires_at` ou `now+30d` se `vip_lifetime` mapping) + `access_events granted` + `update user_state (vip_status, vip_expires_at, access_plan, access_grant_id)` via `service_role` (trigger permite)
2. Opcional: criar `POST /api/admin/vip-invites/[id]/grant` para admin conceder manualmente a usuário existente (fora signup) — `requireAdmin` + `calculateExpiration(invite_type)` + `access_grants` + `user_state` sync
3. Manter `VIP_CHECK=false` ainda; não proteger rotas Manager; não criar `payments/orders`
4. Testes: signup com `30_days` gera `expires_at = created_at+30d`, `lifetime` → `null`, `custom` → `customExpiresAt`, revogado/expirado/usado já usado → `Código inválido ou já utilizado`/`revogado`/`expirado`; concorrência 2 signups mesma `code` → 1 sucesso 1 falha 409

Não criar: `renew/revoke grant` (`ALFA-011.7`), `VIP_CHECK=true` (`ALFA-011.8`), `premium_plans/orders/payments` (`ALFA-011.9+`), Pix.

---

## Anexos

* **Auditoria:** `invite_codes` `code,is_used,created_at` preservados; novos `used_by/used_at/created_by/expires_at/revoked_at/revoked_by/invite_type/metadata` todos `NULL`/`{}` — antigos permanecem válidos (disponível até expirar ou ser revogado)
* **Compatibilidade:** `generateNewInvite` (`app/actions/admin.ts:12`) ainda funciona (`insert code,is_used` — novos cols ficam `NULL`); `AdminInviteButton.tsx:23` ainda chama `generateNewInvite` — página nova é adicional, não substitui botão Sidebar (botão continua como atalho)
* **Reversão:** `drop function consume_invite_code` + `alter table drop column if exists used_by,used_at,created_by,expires_at,revoked_at,revoked_by,invite_type,metadata` + índices — sem `DROP TABLE`

*Fim ALFA-011.5 — aguardar autorização para ALFA-011.6.*
