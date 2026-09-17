# ALFA-011.2 — Relatório Serviço Central de Acesso VIP

> **Sprint:** ALFA-011.2 — Serviço central de acesso (sem enforcement)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + `docs/ALFA-011.1-RELATORIO-MODELAGEM-VIP.md`
> **Migration base:** `supabase/migrations/20250917000001_add_vip_model.sql` (já criada em ALFA-011.1, não alterada)
> **Status:** Serviço existe, bloqueio permanece desativado (`VIP_CHECK=false`), nenhuma rota protegida

---

## 1. Arquivos criados/alterados

| Arquivo | Ação | Descrição |
|---|---|---|
| `app/lib/access/accessService.ts` | **criado** (320 linhas) | Serviço central Server-only: tipos, `VIP_CHECK`, `interpretGrant`, `pickBestGrant`, `getAccessState`, `hasVipAccess`, `requireVip` |
| `tests/alfa-011-2-access.test.js` | **criado** (120 linhas) | Testes determinísticos lógica pura (10 cenários, sem Supabase remoto) |
| `docs/ALFA-011.2-RELATORIO-SERVICO-ACESSO-VIP.md` | **criado** | Este relatório |
| `app/lib/access/` | **criado** (diretório) | Novo domínio observacional (não altera domínio do jogo) |
| `supabase/migrations/20250917000001_add_vip_model.sql` | **não alterado** | 135 linhas, mantida idempotente de ALFA-011.1 |
| `app/lib/auth.ts` | **consultado, não alterado** | `requireAuth:33`, `isAdmin:47`, `requireAdmin:61`, `resolveUserId:77` — reutilizado |
| `app/lib/supabase-admin.ts` | **consultado, não alterado** | `server-only` service_role |
| `app/lib/db.ts` | **consultado, não alterado** | `UserState`, `getUserState` — fallback cache para `accessService` |
| `utils/supabase/server.ts` | **consultado, não alterado** | `createClient()` SSR cookies |
| `middleware.ts` | **consultado, não alterado** | `updateSession` apenas |
| `app/api/**` (6 rotas) | **consultado, não alterado** | Nenhuma recebeu `requireVip` |
| `app/dashboard/**`, `app/login/page.tsx` | **não alterados** | Login/signup/Sidebar/Manager intactos |

Nenhuma migration criada nesta sprint. Nenhum `DROP/TRUNCATE`. Nenhuma tabela financeira (`payments/orders/premium_plans`).

## 2. Funções públicas criadas (`app/lib/access/accessService.ts:1`)

| Função | Assinatura | Propósito |
|---|---|---|
| `getAccessState(requestedUserId?)` | `Promise<AccessState>` | Consulta server-side via `supabaseAdmin`, resolve `userId` com `auth.getUser()` + `isAdmin`, lê `access_grants` (fonte) com fallback `user_state` cache, retorna `AccessState` completo |
| `hasVipAccess(requestedUserId?)` | `Promise<boolean>` | Wrapper boolean `getAccessState → allowed` |
| `requireVip(requestedUserId?)` | `Promise<AccessState>` | Guard futuro: se `VIP_CHECK=false` retorna `state` sem bloquear; se `true` lança `403 VIP_EXPIRED/VIP_REVOKED/VIP_REQUIRED` |
| `interpretGrant(grant, now)` | `AccessState` parcial | **Pura** (sem Supabase), determinística, testável — não confia em `vip_status`, recalcula `expires_at` vs `now` |
| `pickBestGrant(grants, now)` | `AccessGrantRow | null` | **Pura**, escolhe ativa mais futura (vitalício = Infinity) > pending > expired > revoked |

Helper interno: `resolveUserIdSecure(requestedUserId)` reutiliza `createClient().auth.getUser()` + check `IDOR 403` (mesmo padrão `app/lib/auth.ts:77`).

Export puro para testes: `export const _pure = { interpretGrant, pickBestGrant }`.

## 3. Tipos criados

```ts
// app/lib/access/accessService.ts:18-55
export type AccessStatus = 'active' | 'expired' | 'revoked' | 'pending' | 'none'
export type AccessPlan = 'premium' | 'full_premium' | string
export interface AccessGrantRow {
  id, user_id, source ('invite'|'manual'|'payment'|'admin'), invite_code_id, plan,
  status ('active'|'expired'|'revoked'|'pending'), starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at
}
export interface AccessState {
  userId, isAdmin, hasAccess, status, plan, isLifetime, isExpired, isRevoked, isPending,
  startsAt, expiresAt, grantId, source,
  enforcementEnabled, allowed, fromCache
}
```

Sem `any` injustificado — `metadata` é `Record<string,unknown>|null`, `plan` é `string` extensível mas tipada.

## 4. Comportamento de `VIP_CHECK`

```ts
// app/lib/access/accessService.ts:14
export const VIP_CHECK = false as const
```

* **Explícita:** const nomeada, exportada, documentada no cabeçalho do arquivo
* **Default `false`:** sem env, sem fallback obscuro — `as const` impede reatribuição acidental
* **Não depende de config ausente:** zero `process.env` para flag
* **Mantém comportamento atual:** `getAccessState` calcula `hasAccess` real mas `allowed = enforcementEnabled ? hasAccessWithAdmin : true` — quando `false`, sempre `allowed=true`
* **Fácil ativar:** trocar para `true` em `ALFA-011.5` (único ponto)
* **Não ativável pelo frontend:** `server-only` + nunca exposto via API — `enforcementEnabled` só retornado para debug server-side, não para client `localStorage`

Documentado em `accessService.ts:8-12` e neste relatório.

## 5. Regras de interpretação de acesso (`interpretGrant` + `getAccessState`)

| Regra | Implementação | Arquivo:linha |
|---|---|---|
| **Não confiar em `user_state.vip_status`** | Recalcula via `expires_at` vs `now`; se `vip_status='lifetime'` mas `access_plan` nulo → `none` | `accessService.ts:125-190` |
| **Sem concessão** | `grant==null` → `hasAccess false, status none` | `interpretGrant:48-62` |
| **Pendente não libera** | `status==='pending'` → `hasAccess false, isPending true` | `interpretGrant:74-88` |
| **Revogado não libera** | `revoked_at !== null` ou `status==='revoked'` → `hasAccess false, status revoked` | `interpretGrant:64-72` |
| **Vitalício** | `expires_at === null && status==='active'` → `hasAccess true, isLifetime true` | `interpretGrant:90-108` |
| **Com validade futura** | `expires_at > now && status==='active'` → `hasAccess true` | `interpretGrant:126-142` |
| **Expirado** | `expires_at <= now` → `hasAccess false, status expired` | `interpretGrant:110-124` |
| **Data inválida** | `isNaN(exp)` → `hasAccess false, status none` | `interpretGrant:112` |
| **Múltiplas concessões** | `pickBestGrant` prefere `active` mais futura (`Infinity` para vitalício) > `pending` > `expired` > `revoked` | `accessService.ts:148-180` |

## 6. Regra para administradores

* Não altera `isAdmin` (`app/lib/auth.ts:47` `supabaseAdmin.from('user_state').select('role')` permanece fonte).
* `getAccessState` faz `const isAdminUser = await checkIsAdmin(userId)` (`accessService.ts:195`) e `hasAccessWithAdmin = isAdminUser ? true : interpreted.hasAccess` (`accessService.ts:275`).
* `statusWithAdmin = isAdminUser ? 'active' : interpreted.status` — admin aparece como `active` mesmo sem `access_grants`.
* Não transforma `admin` em `plan` — `isAdmin` é booleano separado, `plan` permanece `null` para admin sem concessão (evita `access_plan='admin'`).

## 7. Regra para acesso vitalício

```ts
if (grant.expires_at === null) {
  const isActiveLike = status === 'active'
  return { hasAccess: isActiveLike, isLifetime: isActiveLike, expiresAt: null, ... }
}
```

* `expires_at = null` + `status='active'` → `hasAccess true, isLifetime true, expiresAt null`
* `user_state` fallback: `vip_status='lifetime' && access_plan` → `isLifetime true` (recalculado, não confiado cegamente)
* Trigger futuro `ALFA-011.4` não necessário nesta sprint — vitalício já interpretado

## 8. Regra para expiração/revogação

* **Expiração:** `new Date(expires_at).getTime() <= Date.now()` → `expired` — autoritativa sobre `status` (evita `status='active'` com `expires_at` passado liberar)
* **Revogação:** `grant.revoked_at !== null` prevalece sobre `expires_at` futuro — `revoked` nunca libera, mesmo `active`
* **Pendente:** `status='pending'` nunca libera, mesmo com `expires_at` futuro (aguarda confirmação Pix ou manual)

Todas via `interpretGrant` pura, sem `user_state`.

## 9. Confirmação de que nenhuma rota foi protegida

Verificado via `Get-ChildItem -Recurse app/api | Select-String requireVip` → 0 ocorrências.

Rotas auditadas (mantidas com `requireAuth/resolveUserId`, sem `requireVip`):

* `app/api/gpro/sync/route.ts:387` — `resolveUserId`
* `app/api/python/[[...route]]/route.ts:271,386` — `resolveUserId`
* `app/api/calendar/route.ts:256` — `resolveUserId`
* `app/api/manager/profile/route.ts:117` — `resolveUserId`
* `app/api/market/update/route.ts:92` — `requireAuth`
* `app/api/gpro/token/route.ts:8,20,43` — `requireAuth`

`middleware.ts:4` mantém `updateSession` apenas (sem `requireVip`). `app/dashboard/**` sem guard.

## 10. Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| Lógica pura 10 cenários | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` — 35 asserts: `VIP_CHECK=false`, `server-only`, sem `insert user_state/access_grants`, tipos presentes, `isAdmin`, `server-side`, nenhuma rota `requireVip`, sem `payments/orders/pix`, sem `localStorage.getItem`, sem concessão→`none`, pending→`false`, vitalício→`true`, futura→`true`, expirada→`expired`, revogada→`revoked`, admin preservado, `VIP_CHECK=false→allowed true`, múltiplas→vitalícia vence, data inválida→`none` |
| TypeScript | `npx tsc --noEmit` | **PASS** `EXIT:0` |
| Build | `npm run build` | **PASS** `EXIT:0`, `Compiled successfully in 13.4s`, 34/34 pages |
| `git diff --check` | `git diff --check` | **PASS** `0` |
| `git status` | `git status --porcelain=v1` | **PASS** — só untracked `app/lib/access/`, `supabase/migrations/20250917000001`, `tests/alfa-011-2-access.test.js`, `docs/`; `git diff --stat` vazio (nenhum tracked modificado) |
| Ausência `payments/orders` | `Select-String payments` em `accessService.ts` | **PASS** 0 |
| Ausência `requireVip` em rotas | `Select-String requireVip` em `app/api` | **PASS** 0 |
| `middleware.ts` inalterado | `git diff -- middleware.ts` | **PASS** vazio |

## 11. Resultados de TypeScript e build

* `npx tsc --noEmit` `TSC_EXIT:0` — sem `any` injustificado, `server-only` + `supabaseAdmin` tipados
* `npm run build` `BUILD_EXIT:0` — `Next.js 16.1.1 (Turbopack)` `Creating an optimized production build ... ✓ Compiled successfully in 13.4s` `Generating static pages 34/34 in 1300.2ms` — aviso `middleware → proxy` pré-existente, não relacionado

## 12. Riscos e limitações

| Risco | Severidade | Mitigação nesta sprint | Próximo |
|---|---|---|---|
| **RLS `user_state_update_own` permissivo** (`20250914000001:33`) ainda permite `update({role:'admin', vip_expires_at:'2099-01-01'})` | Alto | **Registrado, não corrigido** (escopo ALFA-011.4) — `getAccessState` não confia em `vip_status` mas ainda lê `user_state` como fallback; atacante poderia forjar `vip_expires_at` e `getAccessState` recalculado daria `hasAccess true` quando `VIP_CHECK=true` futuro | ALFA-011.4 policy restrita + trigger |
| **Fallback `user_state` sem `access_grants`** — se `access_grants` vazia, `getAccessState` usa cache `user_state` com `fromCache:true` — pode divergir de `access_grants` se ambos existirem mas `user_state` desatualizado | Médio | Documentado `fromCache` flag; `pickBestGrant` prioriza `access_grants` quando existir; `user_state` será sincronizado em ALFA-011.5 via `grantAccess` | ALFA-011.5 `accessService.grantAccess` + sync |
| **`isAdmin` via `user_state.role`** — se RLS permissivo for explorado para `role='admin'`, `getAccessState` daria `isAdmin true` | Alto (herdado) | Mesma mitigação RLS acima; não ampliado nesta sprint | ALFA-011.4 |
| **Sem escrita** — `accessService` não cria `access_grants` nesta sprint, então `hasAccess` sempre `false` (exceto admin ou `user_state` cache) — correto para `VIP_CHECK=false` mas limita testes E2E | Informativo | Limitação intencional — escrita virá em `ALFA-011.5` (`app/actions/signup.ts` chamará `grantAccess`) | ALFA-011.5 |
| **Sem índice novo** — não criado índice em `user_state(vip_expires_at)` | Baixo | Adiado para ALFA-011.5 quando `requireVip` ativar e precisar performance | ALFA-011.5 |

## 13. Próximos passos da ALFA-011.3

**ALFA-011.3 — Página administrativa de convites (`/dashboard/admin/vip-invites`)**

1. Criar `app/dashboard/admin/vip-invites/page.tsx` (Server Component com `requireAdmin` + client table) — cards `Total/Ativos/VIPs ativos/Vitalícios`, tabela `code (mascarado) | validity | status | created_by | used_by | created_at | ações`
2. Criar APIs `GET/POST /api/admin/vip-invites` e `GET/PATCH /api/admin/vip-invites/[id]` — `requireAdmin` + `supabaseAdmin` insert `invite_codes` (`code ALFA-XXXX, is_used false, expires_at, validity_type, created_by`) + `access_events` `granted`
3. Modal criação com `validity_type` (`7/30/60/90/until_date/lifetime`) + `description` — validação `zod`, `until_date > now()`
4. Manter `AdminInviteButton` (`app/dashboard/layout.tsx:352`) como atalho `Link → /dashboard/admin/vip-invites` (compatibilidade)
5. Sem `renew/revoke/history` ainda (fica para ALFA-011.4), sem `requireVip` em rotas públicas

Não criar: `renew/revoke` (`ALFA-011.4`), `requireVip` ativo (`ALFA-011.5`), `premium_plans` (`ALFA-011.6`), `orders/payments` (`ALFA-011.7`).

---

## Anexos

* **Padrões reutilizados:** `auth.ts: isAdmin/requireAuth/resolveUserId`, `supabase-admin.ts: server-only`, `utils/supabase/server.ts: createClient()` — nenhum segundo sistema de auth criado
* **Sem localStorage/cookie cliente:** `accessService.ts` nunca lê `cookieStore` direto além de `createClient().auth.getUser()` (SSR oficial)
* **Sem dados sensíveis:** retorna só `plan/status/expiresAt/grantId/source` — nunca `gpro_token`, `raw_data`, `payments`
* **Sem credencial exposta:** `SUPABASE_SERVICE_ROLE_KEY` só em `supabase-admin.ts` `server-only`, não em `NEXT_PUBLIC`
* **Idempotência preserved:** `interpretGrant` sem escrita, sem `DROP/TRUNCATE`, sem `NOT NULL`

*Fim ALFA-011.2 — aguardar autorização para ALFA-011.3.*
