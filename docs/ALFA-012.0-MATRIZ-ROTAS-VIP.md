# ALFA-012.0 — Matriz de Rotas VIP

> **Data:** 2026-09-17 | **Flag:** `VIP_CHECK=false` — nenhuma rota com `requireVip` nesta sprint

| Rota | Método | Arquivo | Área | Deve exigir VIP? | Atualmente protegido? | Risco | Classificação |
|---|---|---|---|---|---|---|---|
| `/` | GET | `app/page.tsx` | Pública landing | Não | Não (pública) | Baixo | pública |
| `/login` | GET/POST | `app/login/page.tsx` + `app/actions/signup.ts` | Pública auth | Não (login sempre permitido, mesmo expirado) | `supabase.auth` + `signUpWithInviteCode` com invite validado | Baixo | pública |
| `/_not-found` | GET | `app/_not-found` | Pública | Não | Não | Baixo | pública |
| `/manifest.webmanifest` | GET | `app/manifest.webmanifest` | Pública | Não | Não | Baixo | pública |
| `/api/admin/access-status` | GET | `app/api/admin/access-status/route.ts` | Admin diagnóstico | Não (somente `requireAdmin`, sem `requireVip`) | `requireAdmin` 401/403, sem `userId` arbitrário | Baixo | administrativa (Web) |
| `/api/admin/vip-invites` | GET | `app/api/admin/vip-invites/route.ts` | Admin convites list | Não | `requireAdmin`, `supabaseAdmin` | Baixo | administrativa (Web) |
| `/api/admin/vip-invites` | POST | `app/api/admin/vip-invites/route.ts` | Admin convites create | Não | `requireAdmin`, `validityType` server, `crypto.randomUUID` | Baixo | administrativa (Web) |
| `/api/admin/vip-invites/[id]/revoke` | POST | `app/api/admin/vip-invites/[id]/revoke/route.ts` | Admin convites revoke | Não | `requireAdmin`, não apaga, idempotente 409 | Baixo | administrativa (Web) |
| `/api/admin/gpro-kb` | GET/POST/DELETE | `app/api/admin/gpro-kb/route.ts` | Admin knowledge | Não | `requireAdmin` | Baixo | administrativa (Web) |
| `/api/admin/research/fuel` | GET | `app/api/admin/research/fuel/route.ts` | Admin research | Não | `requireAdmin` | Baixo | administrativa (Web) |
| `/api/admin/research/tyres` | GET | `app/api/admin/research/tyres/route.ts` | Admin research | Não | `requireAdmin` | Baixo | administrativa (Web) |
| `/api/admin/research/driver-energy` | GET | `app/api/admin/research/driver-energy/route.ts` | Admin research | Não | `requireAdmin` | Baixo | administrativa (Web) |
| `/api/gpro-kb/explore` | POST | `app/api/gpro-kb/explore/route.ts` | Admin proxy | Não | `requireAdmin` | Baixo | administrativa (Web) |
| `/api/gpro/sync` | POST | `app/api/gpro/sync/route.ts` | Manager sync (crítico) | **Sim — futura VIP** | `resolveUserId` (IDOR 403) + `requireAuth`, **sem `requireVip`** | **Médio (quando VIP_CHECK=true)** | futura VIP — autenticada (Web + APK) |
| `/api/python` (get_state) | GET | `app/api/python/[[...route]]/route.ts:349` | Manager state | **Sim** | `requireAuth`/`resolveUserId`, **sem `requireVip`** | Médio | futura VIP — autenticada (Web + APK) |
| `/api/python` (update_state) | POST | `.../route.ts:530` | Manager update | **Sim** | `resolveUserId`, merge `driver_editable` só, **sem `requireVip`** | Médio | futura VIP — autenticada |
| `/api/python` (setup_calculate) | POST | `.../route.ts:681` | Manager cálculo | **Sim** | `resolveUserId`, **sem `requireVip`** | Médio | futura VIP |
| `/api/python` (strategy_calculate) | POST | `.../route.ts:910` | Manager cálculo | **Sim** | `resolveUserId` | Médio | futura VIP |
| `/api/python` (performance) | POST | `.../route.ts:846` | Manager cálculo | **Sim** | `resolveUserId` | Médio | futura VIP |
| `/api/python` (sponsors) | POST | `.../route.ts:489` | Manager | **Sim** | `resolveUserId` | Médio | futura VIP |
| `/api/calendar` | GET | `app/api/calendar/route.ts` | Manager calendário | **Sim** (quando com `userId`) | `resolveUserId` se `userId` header, **sem `requireVip`** | Médio | futura VIP — autenticada |
| `/api/manager/profile` | GET | `app/api/manager/profile/route.ts` | Manager profile | **Sim** | `resolveUserId`, **sem `requireVip`** | Médio | futura VIP — autenticada |
| `/api/market/update` | POST | `app/api/market/update/route.ts` | Manager market sync | **Sim** | `requireAuth` (POST), `market_select_all` público para GET, **sem `requireVip`** | Médio | futura VIP — autenticada (POST) / pública (GET) |
| `/api/market/update` | GET | `app/api/market/update/route.ts` | Pública market lista | Não | `market_select_all` `using (true)` | Baixo | pública |
| `/api/gpro/token` | GET | `app/api/gpro/token/route.ts` | Manager token check | **Parcial — futura VIP** para `POST`/`DELETE`, `GET hasToken` pode permanecer sem VIP para exibir aviso | `requireAuth` | Baixo/Médio | futura VIP (POST) / autenticada (GET) |
| `/api/manual` | POST | `app/api/manual/route.ts` | Pública cálculo bissecção | Não | sem `requireAuth` | Baixo | pública |
| `/api/test-calculator` | POST | `app/api/test-calculator/route.ts` | Pública | Não | sem `requireAuth` (legado) | Baixo | pública |
| `/dashboard` | GET | `app/dashboard/page.tsx` | Manager visão geral | **Futura VIP (quando ativado, redireciona para vip-expired)** | `GameProvider` `getUserState`, **sem `requireVip`** | Médio | futura VIP — autenticada (Web + APK) |
| `/dashboard/admin/gpro-kb` | GET | `app/dashboard/admin/gpro-kb/page.tsx` | Admin Web | Não | `AdminLayout` `role!=='admin'→redirect` | Baixo | administrativa (Web, fora APK) |
| `/dashboard/admin/research/*` | GET | `app/dashboard/admin/research/**` | Admin Web | Não | `AdminLayout` | Baixo | administrativa (Web) |
| `/dashboard/admin/vip-invites` | GET | `app/dashboard/admin/vip-invites/page.tsx` | Admin Web | Não | `AdminLayout` + `requireAdmin` API | Baixo | administrativa (Web, fora APK) |
| `/dashboard/calendar` | GET | `app/dashboard/calendar/page.tsx` | Manager | **Futura VIP** | `GameProvider`, **sem `requireVip`** | Médio | futura VIP — Web + APK |
| Outras `/dashboard/*` (setup, strategy, manual, tests, wear, sponsors, market, manager, configuracoes) | GET | `app/dashboard/**/page.tsx` | Manager | **Futura VIP** | **sem `requireVip`** | Médio | futura VIP |

**Administrativas:** `AdminLayout` `app/dashboard/admin/layout.tsx:26` verifica `supabaseAdmin.from('user_state').select('role') === 'admin'` — exclusiva Web, `app/dashboard/layout.tsx:264` `filter group.id !== 'administration' || localRole==='admin'` + `capacitor.config.ts` `appId br.com.gproalfaracing` sem `service_role` — fora do APK destinado a usuários comuns (pilotos/gerentes).

**Atualmente protegido?** Nenhuma rota Manager tem `requireVip` — confirmado `grep -r requireVip app/api` = `0` em Manager, só `accessService.ts` define `requireVip` sem uso. Risco quando `VIP_CHECK=true` sem observabilidade seria `403` inesperado para expirados.

**Classificação `futura VIP` = autenticada + será `requireVip` após `VIP_CHECK=true` (ver `docs/ALFA-012.0-PLANO-ATIVACAO-GRADUAL.md` Etapa 3).**
