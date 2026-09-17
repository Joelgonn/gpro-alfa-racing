# ALFA-011.3 — Relatório Integração Controlada VIP

> **Sprint:** ALFA-011.3 — Integração controlada do serviço VIP (1 ponto, sem bloqueio)
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + `docs/ALFA-011.2-RELATORIO-SERVICO-ACESSO-VIP.md`
> **Flag:** `VIP_CHECK=false` (inalterada) — nenhum usuário perde acesso

---

## 1. Ponto de integração escolhido

**`GET /api/admin/access-status`** — rota server-side administrativa, somente leitura, sem página UI nesta sprint.

Criada em `app/api/admin/access-status/route.ts:1` (85 linhas). Nenhum outro ponto foi integrado (login, signup, middleware, Manager, `gpro/sync`, `python`, `market/update`, `gpro/token` permanecem inalterados).

## 2. Justificativa da escolha

| Opção avaliada | Por que não |
|---|---|
| Login/signup | Crítico, autenticação — risco de travar acesso se `VIP_CHECK` mudasse |
| Middleware global | Afetaria todas as rotas + APK, sem reversão granular |
| `gpro/sync` / `python` / `market/update` | Fluxos core do Manager, usados a cada sync — bloquear agora violaria `VIP_CHECK=false` |
| Página diagnóstico admin | Preferência 1 da task, mas criar UI ampliaria escopo (Sidebar, sem tela vazia) — API já é suficiente para validar `accessService` sem tocar frontend |
| **API admin exclusiva `access-status`** | **Escolhida:** menor blast radius, reversível (deletar pasta), só admin, não lista terceiros, não escreve, não expõe sensível, testável via contrato estático |

## 3. Arquivos criados/alterados

| Arquivo | Ação | Linhas |
|---|---|---|
| `app/api/admin/access-status/route.ts` | **criado** | 85 — `GET` com `requireAdmin`, `PUT/POST/PATCH/DELETE` 405 |
| `tests/alfa-011-3-access-status.test.js` | **criado** | 140 — contrato estático + lógica pura 10 cenários |
| `docs/ALFA-011.3-RELATORIO-INTEGRACAO-CONTROLADA-VIP.md` | **criado** | este relatório |
| `app/lib/access/accessService.ts` | **auditado, não reescrito** | 485 linhas — `VIP_CHECK=false`, `server-only`, `supabaseAdmin`, `interpretGrant`, `pickBestGrant`, `getAccessState`, `hasVipAccess`, `requireVip` intocado |
| `app/lib/auth.ts` | **auditado, não alterado** | `requireAuth:33`, `isAdmin:47`, `requireAdmin:61`, `resolveUserId:77` — `isAdmin` intacto, não virou plano comercial |
| `app/lib/supabase-admin.ts` | **auditado, não alterado** | `server-only` service_role |
| `app/lib/db.ts` | **auditado, não alterado** | `UserState` sem `vip_*` no select principal (fallback só em `accessService`) |
| `supabase/migrations/20250917000001_add_vip_model.sql` | **não alterado** | 135 linhas de ALFA-011.1 |
| `middleware.ts`, `app/login/page.tsx`, `app/actions/signup.ts` | **não alterados** | verificado via `git diff` |

Nenhuma migration nova. Nenhuma tabela financeira (`payments/orders/premium_plans`).

## 4. Endpoint ou página criada

**`GET /api/admin/access-status`** (`app/api/admin/access-status/route.ts:14`)

```ts
// Trecho essencial
export async function GET(_request: NextRequest) {
  const adminUser = await requireAdmin() // 401/403
  const state = await getAccessState(adminUser.id) // só próprio admin, sem enumeração
  return NextResponse.json({
    success: true,
    userId, isAdmin, status, plan, hasAccess, isLifetime, isExpired, isRevoked, isPending,
    startsAt, expiresAt, grantId, source, enforcementEnabled, allowed, vipCheck: VIP_CHECK
  })
}
// POST/PUT/PATCH/DELETE → 405 Método não permitido
```

Sem página UI — apenas API. Sem Sidebar, sem APK.

## 5. Regras de autorização

| Caso | Comportamento | Código |
|---|---|---|
| Não autenticado | `requireAdmin` → `requireAuth` lança | `401 Não autenticado` |
| Usuário comum (`role=user`) | `isAdmin` false → `requireAdmin` lança | `403 Acesso negado: requer papel admin` |
| Admin (`role=admin`) | `getAccessState(adminUser.id)` | `200` com payload acima |
| Método ≠ GET | `POST/PUT/PATCH/DELETE` handlers | `405 Método não permitido. Use GET.` |
| `?userId=xxx` ou `header user-id` | **Ignorado** — não lido (`searchParams.get`, `headers.get`, `request.json` não usados) | Sempre consulta `adminUser.id` |

Reutiliza padrão `app/api/admin/gpro-kb/route.ts:25` e `app/api/admin/research/fuel/route.ts:44` (`headerUserId` check), mas aqui **não aceita** header — mais restritivo.

## 6. Formato da resposta

```json
{
  "success": true,
  "userId": "uuid",
  "isAdmin": true,
  "status": "active|expired|revoked|pending|none",
  "plan": "full_premium|premium|null",
  "hasAccess": true,
  "isLifetime": false,
  "isExpired": false,
  "isRevoked": false,
  "isPending": false,
  "startsAt": "2026-09-17T12:00:00.000Z"|null,
  "expiresAt": "2026-10-17T12:00:00.000Z"|null,
  "grantId": "uuid"|null,
  "source": "invite|manual|payment|admin"|null,
  "enforcementEnabled": false,
  "allowed": true,
  "vipCheck": false
}
```

* Sem `service_role`/`SERVICE_ROLE_KEY`
* Sem `gpro_token`
* Sem `raw_data`
* Sem `metadata` financeiro
* Sem objeto Supabase completo (`data` bruto)
* Erro: `{success:false, error:string}` com `status 401/403/500`

## 7. Confirmação de ausência de enumeração

* Não lê `request.nextUrl.searchParams.get('userId'|'user_id')`
* Não lê `request.headers.get('user-id'|'userId')`
* Não lê `await request.json()` para `userId`
* Sempre `getAccessState(adminUser.id)` — o `adminUser` vem de `requireAdmin()` via `cookies` (`utils/supabase/server.ts:4`), não do cliente
* Auditoria futura para consultar terceiros exigirá endpoint separado com validação explícita e log (fora desta sprint)

Verificado em `tests/alfa-011-3-access-status.test.js:24-30` (9 asserts).

## 8. Confirmação de `VIP_CHECK=false`

* `app/lib/access/accessService.ts:23` `export const VIP_CHECK = false as const` — inalterado
* `route.ts:5` importa `VIP_CHECK` e retorna `vipCheck: VIP_CHECK` (observabilidade, sem ativar)
* `tests/alfa-011-3-access-status.test.js:1` `assert(service.includes('VIP_CHECK = false'))` PASS
* Nenhum `process.env.VIP_CHECK` ou toggle escondido

## 9. Confirmação de que nenhum fluxo crítico foi bloqueado

| Fluxo | Arquivo | Contém `requireVip`? | Status |
|---|---|---|---|
| `gpro/sync` | `app/api/gpro/sync/route.ts:387` | Não | `resolveUserId` apenas |
| `python` | `app/api/python/[[...route]]/route.ts:271` | Não | `resolveUserId` |
| `market/update` | `app/api/market/update/route.ts:92` | Não | `requireAuth` |
| `calendar` | `app/api/calendar/route.ts:256` | Não | `resolveUserId` |
| `manager/profile` | `app/api/manager/profile/route.ts:117` | Não | `resolveUserId` |
| `gpro/token` | `app/api/gpro/token/route.ts:8` | Não | `requireAuth` |
| `middleware.ts` | `middleware.ts:4` | Não | `updateSession` |
| `login` | `app/login/page.tsx` | Não | `signInWithPassword` |
| `signup` | `app/actions/signup.ts` | Não | `createUser` |

`getAccessState` separa `hasAccess` (cálculo real) vs `allowed` (`enforcementEnabled ? hasAccess : true`). Com `VIP_CHECK=false`, `allowed` sempre `true` — diagnóstico mostra `hasAccess:false, allowed:true, enforcementEnabled:false`.

## 10. Testes executados

| Comando | Resultado |
|---|---|
| `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` — 35 asserts: `VIP_CHECK=false`, `server-only`, `GET+405`, sem enumeração (3), resposta mínima (5), sem `insert/update/delete`, enforcement separado, nenhuma rota crítica `requireVip`, middleware/login/signup inalterados, sem migration/Pix, reutiliza `isAdmin`, lógica pura 10 cenários (none/pending/lifetime/futura/expirada/revogada/inválida + `allowed`) |
| `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` — 35 asserts ALFA-011.2 preservados |
| `npx tsc --noEmit` | **PASS** `TSC_EXIT:0` |
| `npm run build` | **PASS** `BUILD_EXIT:0` — `Compiled successfully in 13.4s`, 34/34 pages, rota `ƒ /api/admin/access-status` aparece no manifest |
| `git diff --check` | **PASS** `0` |
| `git status --porcelain=v1` | Só untracked `app/api/admin/access-status/`, `app/lib/access/`, `supabase/migrations/20250917000001...`, `tests/alfa-011-*.js`, `docs/` — `git diff --stat` vazio |
| `Select-String` payments/orders | **PASS** 0 em `accessService.ts` e `route.ts` |
| `Get-ChildItem app/api | Select-String requireVip` | **PASS** 0 |

## 11. Resultados de TypeScript e build

* `npx tsc --noEmit` `TSC_EXIT:0` — `accessService.ts` `server-only` + `NextRequest/NextResponse` tipados, sem `any` injustificado
* `npm run build` `BUILD_EXIT:0` — `Next.js 16.1.1 (Turbopack)` `✓ Compiled successfully in 13.4s` `Generating static pages 34/34 in 1300ms` `Route (app) … ƒ /api/admin/access-status` listado

## 12. Riscos e limitações

| Risco | Severidade | Detalhe | Próximo |
|---|---|---|---|
| `user_state_update_own` permissivo (`20250914000001:33`) | Alto (herdado) | Usuário pode `update({role:'admin', vip_expires_at:'2099-01-01'})` — `getAccessState` recalcula `expiresAt` mas `isAdmin` leria `role` forjado antes de RLS fix | ALFA-011.4 policy restrita + trigger |
| `getAccessState` fallback `user_state` com `fromCache:true` | Médio | Se `access_grants` vazia, `hasAccess` vem de `user_state` cache — pode divergir de `access_grants` futuro se não sincronizado | ALFA-011.5 sync `grantAccess` |
| Endpoint só para próprio admin | Informativo | Não permite admin consultar outro usuário — intencional nesta sprint; futura `GET /api/admin/access-status?userId=` exigirá auditoria | ALFA-011.4+ |
| Sem UI | Informativo | Admin precisa `curl -H Cookie ... /api/admin/access-status` — sem Sidebar, sem APK (requisito 13) | ALFA-011.3 cumpre; UI em backlog |
| Sem escrita | Informativo | `accessService` não cria concessões — `hasAccess` sempre `false` exceto admin/lifetime cache — correto para diagnóstico | ALFA-011.5 |

## 13. Próximos passos da ALFA-011.4

**ALFA-011.4 — Renovação, revogação, vitalício + hardening RLS**

1. Corrigir `user_state_update_own` — `drop policy` + `create policy ... with check (auth.uid()=user_id AND NEW.role = OLD.role)` ou trigger `BEFORE UPDATE` que `RAISE EXCEPTION` se `NEW.vip_*`/`NEW.role` diferente e `auth.role()='authenticated'` — escrita `vip_*` só `service_role`
2. Criar `POST /api/admin/vip-invites` + `app/dashboard/admin/vip-invites/page.tsx` (cards/tabela/busca/filtros/modal criação 7/30/60/90/until/lifetime) — `requireAdmin` + `supabaseAdmin` insert `invite_codes` + `access_events granted`
3. Criar `POST /api/admin/vip-invites/[id]/renew` e `/revoke` e `GET /history` + `accessService.renewAccess/revokeAccess` — `select for update` + idempotência + `access_events` + `user_state` sync + tornar vitalício (`expires_at null`)
4. Não ativar `VIP_CHECK` ainda; não proteger rotas críticas; manter `docs/ALFA-011-PLANO` fases
5. Testes: renovar ativo (`max(now, prev)+30d`), expirado (`now+30d`), revogar, vitalício, `RLS 42501` para `update vip_expires_at` client

---

## Anexos

* **Auditoria `app/lib/access/accessService.ts:1-485`:** `isAdmin` reutilizado (`checkIsAdmin`), `server-only`, `createClient().auth.getUser()` + `isAdmin` para `isAdmin`, `supabaseAdmin.from('access_grants')` + `from('user_state')` fallback, sem `localStorage`, sem `service_role` no bundle, sem `gpro_token`/`raw_data`/`payments`
* **Padrão reutilizado:** `app/api/admin/access-status/route.ts` segue `app/api/admin/gpro-kb/route.ts:25` (`requireAdmin` + `adminUser.id`) e `app/api/admin/research/fuel/route.ts:44`, mas mais restritivo (não lê header)
* **Idempotência:** endpoint `GET` puro, sem `insert/update/delete` (`Select-String .insert(` 0)
* **Build:** `supabase/migrations/20250917000001_add_vip_model.sql` não tocada; `npm run build` lista `ƒ /api/admin/access-status` sem erro

*Fim ALFA-011.3 — aguardar autorização para ALFA-011.4.*
