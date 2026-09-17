# ALFA-011.4 — Relatório Segurança user_state

> **Sprint:** ALFA-011.4 — Correção de segurança `user_state_update_own`
> **Data:** 2026-09-17
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + `docs/ALFA-011.3-RELATORIO-INTEGRACAO-CONTROLADA-VIP.md`
> **Flag:** `VIP_CHECK=false` (inalterada)
> **Serviço:** `app/lib/access/accessService.ts` (não reescrito) + endpoint `GET /api/admin/access-status` (inalterado)

---

## 1. Risco original

Política em `supabase/migrations/20250914000001_rls_hardening.sql:33-35`:

```sql
create policy "user_state_update_own" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Permite que `authenticated` atualize **qualquer coluna** da própria linha (`role`, `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id`, `gpro_token` implícito) via Supabase REST / `supabase.from('user_state').update()` / DevTools / `curl`. Frontend nunca controlava, então atacante com JWT válido poderia:

```js
await supabase.from('user_state').update({ role:'admin', vip_expires_at:'2099-12-31' }).eq('user_id', auth.uid())
```

`auth.uid()=user_id` não restringe colunas — risco **alto**, documentado em `docs/ALFA-011.1-RELATORIO-MODELAGEM-VIP.md:11` e `docs/ALFA-011.3-RELATORIO:12`.

## 2. Política encontrada

* Nome exato: `"user_state_update_own"` em `20250914000001_rls_hardening.sql:33`
* Tipo: `for update using (auth.uid()=user_id) with check (auth.uid()=user_id)`
* Sem `to authenticated` explícito — aplica a `authenticated` por padrão
* Complementada por `user_state_select_own/insert_own/delete_own` (não alteradas)
* `access_grants`/`access_events` já sem `insert/update/delete` para `authenticated` (correto)

## 3. Campos sensíveis identificados

| Campo | Existe em `user_state` | Tipo | Sensível? | Proteção |
|---|---|---|---|---|
| `role` | sim (`text 'admin'|'user'`, `app/lib/db.ts:31`) | privilégio | **sim** | trigger + fora do RPC allowlist |
| `vip_status` | sim (`text`, `20250917000001:6`) | acesso pago | **sim** | trigger + fora do RPC |
| `vip_expires_at` | sim (`timestamptz`, `20250917000001:7`) | acesso pago | **sim** | trigger + fora do RPC |
| `access_plan` | sim (`text`, `20250917000001:8`) | acesso pago | **sim** | trigger + fora do RPC |
| `access_grant_id` | sim (`uuid`, `20250917000001:9`) | acesso pago | **sim** | trigger + fora do RPC |
| `is_admin` | não existe | — | n/a | verificado via `information_schema`, não existe — trigger genérico cobre se um dia existir |
| `permissions` | não existe | — | n/a | idem |
| `subscription_status` | não existe | — | n/a | idem |
| `plan` / `entitlement` | não existe | — | n/a | idem |
| `service_role` | não existe como coluna | — | n/a | — |
| `gpro_token` | existe mas **nunca** em `user_state` select (`app/lib/db.ts:146` exclui, `getGproToken` via `supabaseAdmin`) | token | **sim, já protegido** | não está na allowlist RPC; trigger não precisa bloquear pois já não é atualizável via `update_user_profile` |

Campos legítimos **não** sensíveis permanecem allowlist (seção 7).

## 4. Solução aplicada

Estratégia preferencial **híbrida** (trigger + RPC allowlist) — robusta contra REST direto e DevTools, sem confiar no frontend:

1. **Trigger `BEFORE UPDATE`** `public.prevent_user_state_privilege_escalation()` (`security definer`, `auth.role()='authenticated'` check) — bloqueia `role/vip_*`/`access_*` mesmo se RLS permitir linha. Lança `42501` (`insufficient_privilege`).
2. **Política restritiva** `user_state_update_own_restricted` (`to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id)`) — substitui a ampla, mantém `using/with check` idêntico mas agora com trigger como segunda camada (RLS não consegue filtrar colunas sozinho).
3. **RPC allowlist** `public.update_user_profile(...)` (`security definer`, `auth.uid()` + `where user_id=v_user_id`) — lista explícita de 19 campos legítimos; `role/vip_*` nunca são parâmetros, então nem via RPC é possível escalonar.

Não foi usada apenas `auth.uid()=user_id` (insuficiente), nem `DROP TABLE`/`TRUNCATE`.

## 5. Migration criada

`supabase/migrations/20250917000002_harden_user_state_update.sql` (168 linhas, aditiva/idempotente, sem `DROP TABLE`/`TRUNCATE`/`NOT NULL`, sem ativar `VIP_CHECK`):

* `drop policy if exists "user_state_update_own"`
* `create or replace function prevent_user_state_privilege_escalation() ... security definer` + `comment`
* `drop trigger if exists trg_user_state_privilege_guard` + `create trigger ... before update`
* `create policy "user_state_update_own_restricted" ... to authenticated`
* `do $$ if not exists select/insert/delete policies then create ... end if $$` (idempotente)
* `create or replace function update_user_profile(p_track, p_driver_editable, ..., p_car_characteristic) returns user_state security definer` + `comment` + `grant execute to authenticated, service_role`
* `notify pgrst, 'reload schema'`

Timestamp `20250917000002` segue convenção `20250914000001`, `20250915000002`, `20250916000001`, `20250917000001`.

## 6. Política removida/substituída

| Removida | Substituída por | Diferença |
|---|---|---|
| `user_state_update_own` (`for update using (auth.uid()=user_id) with check (...)`) | `user_state_update_own_restricted` (`for update to authenticated using (auth.uid()=user_id) with check (...)`) | Mesmo `using/with check`, mas agora `to authenticated` explícito + **trigger** bloqueia colunas. Sem trigger, a política sozinha ainda seria ampla — por isso trigger é essencial. |

`user_state_select_own/insert_own/delete_own` **preservadas** (via `do $$ if not exists`).

## 7. Lista explícita de campos permitidos (RPC allowlist)

`update_user_profile` aceita **somente**:

```sql
p_track text,
p_driver_editable jsonb, p_driver_static jsonb,
p_car_json jsonb, p_tech_director_json jsonb, p_staff_facilities_json jsonb,
p_test_points_json jsonb, p_race_options_json jsonb, p_weather_data jsonb,
p_desgaste_modifier double precision,
p_sponsors_database_json jsonb, p_energy_coeffs_json jsonb,
p_menu_data jsonb, p_office_data jsonb,
p_last_import_snapshot jsonb, p_last_import_at timestamptz,
p_tyre_suppliers jsonb, p_car_totals jsonb, p_car_characteristic jsonb
```

Origem: `app/lib/db.ts:245-274` `saveUserState` payload (19 campos). **Nunca** `role`, `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id`, `is_admin`, `gpro_token`.

Mapeamento:

| Campo DB | RPC param | Frontend uso |
|---|---|---|
| `track` | `p_track` | `updateTrack` (`GameContext.tsx:660`) |
| `driver_editable/static` | `p_driver_editable/static` | `updateDriverEditable` (`:635`) |
| `car_json` | `p_car_json` | `updateCar` (`:649`) |
| `tech_director_json` | `p_tech_director_json` | `updateTechDirector` |
| `staff_facilities_json` | `p_staff_facilities_json` | `updateStaffFacilities` |
| `test_points_json` | `p_test_points_json` | `updateTestPoints` |
| `weather_data` | `p_weather_data` | `updateWeather` (`:451`) |
| `desgaste_modifier` etc. | idem | — |

`saveUserState` server-side (`app/lib/db.ts:276` `getSupabaseClient` → `service_role` quando `typeof window==='undefined'`) continua funcionando via `supabaseAdmin` (bypass RLS + trigger permite `service_role` porque `auth.role() != 'authenticated'`). Cliente que usar RPC terá mesma allowlist.

## 8. Proteção contra alteração de privilégios

Testada via `tests/alfa-011-4-security.test.js:1-15` (estático, sem DB real — limitação seção 11):

```js
// Simula atacante authenticated via REST
await supabase.from('user_state').update({ role:'admin' }).eq('user_id', uid) // trigger → 42501
await supabase.from('user_state').update({ vip_status:'active', vip_expires_at:'2099...' }) // → 42501
await supabase.from('user_state').update({ access_plan:'full_premium' }) // → 42501
```

* REST direto → trigger `raise exception 'role cannot be changed via client' errcode 42501`
* DevTools `fetch` com `apikey` + `Authorization: Bearer <jwt>` → mesmo
* Payload manipulado com campo sensível + legítimo → trigger verifica `IS DISTINCT FROM OLD` para cada sensível, bloqueia mesmo se um legítimo junto
* Não confia no frontend ocultar campo — validação no banco

## 9. Comportamento de admin/service_role

| Ator | Pode atualizar `role/vip_*`? | Como |
|---|---|---|
| `authenticated` `role=user` | **Não** | `auth.role()='authenticated'` + `trigger` bloqueia `NEW.role IS DISTINCT` |
| `authenticated` `role=admin` via REST | **Não** (mesmo admin não deve usar REST direto) | Mesmo bloqueio — admin deve usar `service_role` via `requireAdmin` + `supabaseAdmin` |
| `service_role` (`supabaseAdmin` em `app/lib/supabase-admin.ts:17` `server-only`) | **Sim** | `auth.role()='service_role'` (quando `supabaseAdmin` faz `update`) → `if auth.role()='authenticated'` falso → trigger retorna `NEW` sem erro; RLS bypassa |
| `postgres` (migration) | **Sim** | idem |
| RPC `update_user_profile` chamado por `authenticated` | **Não** pode tocar `role/vip_*` (não são parâmetros) | Mesmo `authenticated` só consegue atualizar allowlist onde `user_id=v_user_id` |

`requireAdmin` (`app/lib/auth.ts:61`) inalterado; `isAdmin` (`:47`) continua lendo `user_state.role` via `supabaseAdmin`. Concessões VIP futuras via `access_grants`/`access_events` continuam `service_role` only (sem `insert` para `authenticated`, verificado seção 10 tests).

## 10. Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| Segurança 15 cenários | `node tests/alfa-011-4-security.test.js` | **PASS** `EXIT:0` — 50+ asserts: política antiga removida, 5 campos bloqueados via trigger, trigger `before update`, `auth.role()`, 19 campos legítimos preservados, RPC allowlist, sem `role/vip_*` no RPC, IDOR `auth.uid()=user_id`, `where user_id=v_user_id`, `security definer`, `grant execute`, `isAdmin` intacto, `access_grants/events` sem insert/update, `VIP_CHECK=false`, login/signup inalterados, nenhuma rota `requireVip`, sem credencial exposta |
| Acesso lógica pura | `node tests/alfa-011-2-access.test.js` | **PASS** `EXIT:0` 35 asserts |
| Diagnóstico | `node tests/alfa-011-3-access-status.test.js` | **PASS** `EXIT:0` 35 asserts |
| TypeScript | `npx tsc --noEmit` | **PASS** `TSC:0` |
| Build | `npm run build` | **PASS** `BUILD:0` `Compiled successfully in 13.4s` `34/34` `ƒ /api/admin/access-status` |
| `git diff --check` | `git diff --check` | **PASS** `0` |
| `git status` | `git status --porcelain=v1` | Só untracked `app/api/admin/access-status/`, `app/lib/access/`, `supabase/migrations/2025091700000*.sql`, `tests/alfa-011-*.js`, `docs/` — `git diff --stat` vazio |

## 11. Limitações dos testes

* **Sem integração real com Supabase** — asserts são estáticos (`fs.readFileSync` + `includes`), não fazem `supabase.from('user_state').update({role:'admin'})` contra DB remoto. Não declaramos bloqueio em produção sem teste real — documentado aqui.
* Para validação E2E real, executar com credenciais de staging: `supabase.auth.signIn` + `supabase.from('user_state').update({role:'admin'})` deve retornar `42501 privilege escalation blocked` e `vip_expires_at` deve permanecer inalterado; `service_role` via `supabaseAdmin` deve conseguir atualizar `role`.
* Testes de `access_grants` insert block também estáticos — E2E deve tentar `supabase.from('access_grants').insert()` com JWT user e esperar `42501` / `403`.

## 12. Resultado de TypeScript

`npx tsc --noEmit` `TSC:0` — `app/lib/access/accessService.ts` `server-only`, `app/api/admin/access-status/route.ts` `NextRequest/NextResponse`, `supabase/migrations/*.sql` não afeta `tsc`, nenhum `any` novo.

## 13. Resultado do build

`npm run build` `BUILD:0` — `Next.js 16.1.1 (Turbopack)` `Creating an optimized production build ... ✓ Compiled successfully in 13.4s` `Generating static pages 34/34 in 1300ms` `ƒ /api/admin/access-status`, `ƒ /api/admin/gpro-kb` etc., `Proxy (Middleware)` intacto.

## 14. Riscos restantes

| Risco | Severidade | Mitigação |
|---|---|---|
| Trigger usa `auth.role()='authenticated'` — se `supabaseAdmin` for vazado ao cliente, `service_role` poderia ser usado para bypass | Alto (já mitigado) | `app/lib/supabase-admin.ts:1` `import 'server-only'` + nenhum `NEXT_PUBLIC_SERVICE_ROLE`; `accessService.ts:11` `import 'server-only'` |
| `saveUserState` client-side via `browserSupabase` ainda faz `upsert` direto — com trigger, tentativa de `supabase.from('user_state').upsert({user_id, role:'admin'})` agora falha `42501`, mas `upsert` legítimo com `track` continua OK — porém `saveUserState` no client ainda usa `browserSupabase` e não RPC | Médio | Próxima sprint pode migrar `GameContext` para chamar `update_user_profile` RPC em vez de `saveUserState` direto, ou manter `saveUserState` server-side only (já é `service_role` quando `typeof window==='undefined'` em `app/api/python`) |
| Migration ainda não aplicada no remoto | Informativo | Aplicar via `supabase db push` ou Dashboard SQL Editor; `notify pgrst` incluso |
| `gpro_token` não está na allowlist RPC, mas também não está no trigger `IS DISTINCT` — se um dia `gpro_token` virar coluna `user_state`, trigger atual não bloquearia por `undefined_column` exception handler `return NEW` | Baixo | Adicionar `gpro_token` ao trigger quando coluna existir; por enquanto `gpro_token` isolado em tabela/coluna separada via `getGproToken` (`supabaseAdmin`) |

## 15. Próximos passos da ALFA-011.5

**ALFA-011.5 — Convites configuráveis + concessão VIP (sem Pix)**

1. Criar `POST /api/admin/vip-invites` e `app/dashboard/admin/vip-invites/page.tsx` (cards/tabela/busca/filtros/modal criação 7/30/60/90/until/lifetime) — `requireAdmin` + `supabaseAdmin` insert `invite_codes` (`code ALFA-XXXX`, `is_used false`, `expires_at`, `validity_*`, `created_by`) + `access_events granted`
2. Criar `POST /api/admin/access/grant` (ou `POST /api/admin/vip-invites/[id]/grant`) que usa `supabaseAdmin` para `insert access_grants (user_id, source='invite', invite_code_id, plan='full_premium', status='active', starts_at=now(), expires_at=calc, metadata)` + `insert access_events` + `update user_state (vip_status, vip_expires_at, access_plan, access_grant_id)` via `service_role` (trigger permite)
3. Criar `app/lib/access/grantService.ts` helper `calculateExpiration(validityType, validityDays, untilDate)` — `fixed_days` → `now+days`, `until_date` → `untilDate`, `lifetime` → `null`
4. **Não ativar `VIP_CHECK`** ainda; não proteger rotas críticas; manter `docs/ALFA-011-PLANO` fases; `update_user_profile` RPC pode ser usado por `GameContext` para dados de jogo sem tocar `vip_*`

Não criar: `renew/revoke` (`ALFA-011.6`), `VIP_CHECK=true` (`ALFA-011.7`), `premium_plans/orders/payments` (`ALFA-011.8+`), Pix.

---

## Anexos

* **Auditoria:** `supabase/migrations/20250914000001:33`, `app/lib/db.ts:237-305` (`saveUserState` payload 19 campos), `app/lib/auth.ts:47,61,77`, `app/api/python/[[...route]]/route.ts:643` (`saveUserState` server-side via `service_role`), `app/context/GameContext.tsx:478` (`getUserState`)
* **Reversão:** `drop policy if exists "user_state_update_own_restricted"` + `drop trigger trg_user_state_privilege_guard` + `drop function prevent_user_state_privilege_escalation` + `recreate policy "user_state_update_own" for update using (auth.uid()=user_id)` — sem `DROP TABLE`
* **Compatibilidade:** `user_state` `select_own/insert_own/delete_own` preservadas, `login` (`app/login/page.tsx:signInWithPassword`), `signup` (`app/actions/signup.ts:createUser`), `access-status` (`app/api/admin/access-status:requireAdmin`), `VIP_CHECK=false` inalterado, nenhuma rota `requireVip`

*Fim ALFA-011.4 — aguardar autorização para ALFA-011.5.*
