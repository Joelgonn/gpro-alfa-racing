# ALFA-012.0 — Plano de Ativação Gradual VIP

> **Objetivo:** preparar ativação sem `VIP_CHECK=true` nesta sprint
> **Stack:** Vercel (Web) + Capacitor `br.com.gproalfaracing` (APK `server.url https://gpro-alfa-racing.vercel.app`)

---

## Etapa 1 — `VIP_CHECK=false` + Observabilidade (atual)

**Estado:** `app/lib/access/accessService.ts:23` `export const VIP_CHECK = false as const` — `getAccessState` calcula `hasAccess` real mas `allowed=true`, `requireVip` retorna `state` sem `throw 403`.

**Ações:**

* Manter `VIP_CHECK=false`.
* Não adicionar `requireVip` em `app/api/gpro/sync`, `python`, `calendar`, `manager/profile`, `market/update`, `gpro/token` (`POST`).
* Adicionar endpoint observabilidade (proposta ALFA-012.1): `GET /api/admin/vip-observability` (`requireAdmin`) que retorna `count: { totalActive, wouldBlock: 0, byRoute: { "gpro/sync": 0, "python/get_state": 0 } }` — calcula `hasAccess` sem bloquear, loga `x-request-id` sem `e-mail completo`/`código completo` (`slice`).
* Logs: `console.warn`/`console.error` com `slice(0,80)` já em `signup.ts` (`maskEmail`, `maskCode`), `accessService` (`userId.slice(0,8)***`).
* Métrica: `access_grants` `status active` com `expires_at <= now()` vs `lifetime` (`null`) — via `SELECT` sem `UPDATE`, não marca `expired` ainda (função `expire_overdue_grants` existe mas não é cron).
* Web (`Vercel`) e APK (`br.com.gproalfaracing`) ambos usam mesmo `supabase` Auth + `accessService` server-side — sem `service_role` no bundle (`server-only`).

**Critério saída:** dashboard de observabilidade em staging com 0 `wouldBlock` fora de teste.

---

## Etapa 2 — Ativação somente em ambiente de teste

**Pré-requisitos:** `supabase db push` aplicado em staging (migrations `20250917000001`..`00004`), `uniq_grant_invite_user` criado, `expire_overdue_grants` testado manualmente (`SELECT expire_overdue_grants()`).

**Configuração:**

* `VIP_CHECK=true` apenas em `env` staging (`NEXT_PUBLIC_VIP_CHECK` ou `VIP_CHECK` via `process.env.VIP_CHECK === 'true'` com `as const` trocado para `process.env` com default `false` — mudança mínima em `accessService.ts:23`).
* **Nunca** `VIP_CHECK=true` em produção sem aprovação.

**Usuários de teste:**

| Usuário | Grant | Esperado `GET /api/admin/access-status` | Esperado `POST /api/gpro/sync` |
|---|---|---|---|
| `admin` (`role=admin`) | sem grant ou expirado | `isAdmin true, hasAccess true, status active, allowed true` (bypass) | `200` |
| `vip_ativo` (`full_premium` `expires_at` futuro) | `active` `expires_at 2030` | `hasAccess true, isLifetime false, allowed true` | `200` |
| `vip_vitalicio` (`expires_at null`) | `active` `null` | `hasAccess true, isLifetime true` | `200` |
| `vip_expirado` (`expires_at 2026-09-01`) | `active` mas `expires_at <= now()` → `expired` | `hasAccess false, status expired, allowed false` quando `VIP_CHECK=true` | `403 VIP_EXPIRED` quando `VIP_CHECK=true` |
| `sem_vip` (sem grant) | `none` | `hasAccess false, status none` | `403 VIP_REQUIRED` |
| `user comum` | `none` | `403` em `/api/admin/access-status` (requireAdmin) | `403 VIP_REQUIRED` após |

**Validação Web:** `login` expirado ainda `200` (`auth.admin` não bloqueia), `dashboard/manager` após login com expirado mostra `VipExpired` (quando `VIP_CHECK=true` futuro), `fetch` `gpro/sync` retorna `403` com `code VIP_EXPIRED`.

**Validação APK:** instalar APK staging apontando `server.url` staging, `login` expirado `→` mesma `403` em `gpro/sync`; expiração `>now` no servidor, não local; `admin` bypass igual Web; nenhuma `Função admin` no APK (`/dashboard/admin/*` `requireAdmin` retorna `403` em WebView).

**Rollback:** `VIP_CHECK=false` (env) + redeploy Vercel + rebuild APK `npx cap sync` — instantâneo.

---

## Etapa 3 — Ativação gradual por rota

**Ordem (menor risco primeiro):**

1. `POST /api/gpro/token` (`setGproToken`) — baixo impacto, pode manter `GET hasToken` sem `requireVip` para exibir aviso.
2. `GET /api/manager/profile` — leitura, sem `write`.
3. `POST /api/gpro/sync` — sync crítico, mas já tem `resolveUserId` + `getGproToken` server-side; adicionar `await requireVip(userId)` após `resolveUserId`.
4. `app/api/python` `get_state` + `update_state` + `setup_calculate` + `strategy_calculate` — cálculos, mas protegidos por `requireVip` após `resolveUserId`.
5. `GET /api/calendar` (com `userId`) + `POST /api/market/update` — último.

**Implementação:**

```ts
// Exemplo: app/api/gpro/sync/route.ts:387
const userId = await resolveUserId(requestedUserId)
if (VIP_CHECK) await requireVip(userId) // só quando flag true
```

Ou centralizar em `requireVip` que já respeita `VIP_CHECK=false` (retorna sem `throw`). Gradual = ativar `VIP_CHECK=true` mas com `allowListRoutes` env que lista rotas já migradas; rotas fora da lista ainda não chamam `requireVip`.

**Monitoramento:**

* `access_events` `expired` + `granted` + `revoked` dashboards (admin `SELECT count(*) WHERE event_type`).
* Erros `403 VIP_EXPIRED/VIP_REQUIRED` por rota (`x-request-id` log, sem `e-mail`).
* Métrica `wouldBlock` vs `blocked` (observabilidade vs real).

**Rollback:** remover `requireVip` da rota + `VIP_CHECK=false`.

---

## Etapa 4 — Ativação geral somente após aprovação explícita

**Critérios:**

* Staging com `VIP_CHECK=true` passou 1 semana sem `403` inesperado para `admin` e `vip_ativo`/`vitalicio`.
* `expire_overdue_grants` cron ou chamada manual diária em produção (ou lazy em `getAccessState` já calcula `expired` sem `UPDATE` — suficiente com `VIP_CHECK=true`).
* `uniq_grant_invite_user` criado sem `RAISE NOTICE` de duplicata.
* Testes reais com `service_role` staging: criação `vip_30_days` + `vip_lifetime` + `vip_custom`, consumo, concessão, `user_state` sync, renovação `max(now,expires_at)+30d`, revogação, expiração, reprocessamento — todos `PASS`.
* Aprovação do time + janela de deploy Vercel + rebuild APK com mesmo `server.url` prod (sem `service_role`).

**Ação final:**

* `VIP_CHECK=true` em produção (env ou `accessService.ts:23` `true as const`).
* Todas rotas `futura VIP` da Matriz com `requireVip`.
* Documentar `docs/ALFA-012.1-ATIVACAO-PROD.md` com data, rotas, métricas `blocked`.

**Pós-ativação:**

* Usuário expirado continua `login` `200`, mas `GET /api/manager/profile` `403 VIP_EXPIRED` — UI mostra `VipExpired` com botão renovar (futura `POST /api/admin/vip-invites/[id]/renew`).
* Admin bypass permanente (`isAdmin` via `user_state.role`).
* Nenhuma concessão por pagamento nesta fase (Pix fora de escopo).

---

## Checklist de preparação (ALFA-012.0)

* [x] `VIP_CHECK=false` mantido
* [x] `src` sem `requireVip` em Manager
* [x] `supabase db push` pendente (documentado, não executado)
* [x] `access_grants` como fonte primária, `user_state` só cache (com `syncUserStateWithGrant`)
* [x] `service_role` só server (`server-only`)
* [x] `capacitor.config.ts` `appId br.com.gproalfaracing` sem segredos
* [ ] Endpoint observabilidade (proposta ALFA-012.1) — não criado nesta sprint (auditoria apenas)
* [ ] Teste real com `service_role` staging — não executado (sem credenciais)

*Fim Plano Ativação Gradual — aguardar ALFA-012.1.*
