# ALFA-012.2 — Relatório Migrations em Staging

> **Sprint:** ALFA-012.2 — Aplicação e validação das migrations VIP em staging
> **Data:** 2026-09-17
> **Project ref:** `cycq***us` (cycqigdywekfwwaspsus — Projeto Alfa Web, `oruvptvlozdatobanzoj`)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não inserido em Manager
> **Classificação:** **Aprovado com pendências** — migrations locais validadas, remota não aplicada por falta de credencial DB segura

---

## 1. Objetivo

Aplicar `20250917000001`..`00004` no Supabase remoto e validar que PostgREST reconhece colunas VIP, tabelas, índices, RLS, RPCs e permissões.

## 2. Ambiente utilizado

* **Diretório:** `C:\Users\joelg\Documents\gpro-alfa-racing-brasil` (`git branch main`, `git status` com `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` de sprints 011.5-012.1, `??` 4 migrations + `??` docs/tests)
* **Supabase CLI:** `2.109.1` (`supabase --version` + `npx supabase --version` ambos `2.109.1`)
* **Linked project:** `supabase/.temp/linked-project.json` `{"ref":"cycqigdywekfwwaspsus","name":"Projeto Alfa Web","organization_id":"oruvptvlozdatobanzoj"}` — `supabase projects list` lista `Alfa Racing Brasil` e `Face a Face`, mas `cycq***us` está vinculado localmente.
* **Credenciais:** `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` (não impressas, `slice(0,8)***`). `SUPABASE_SERVICE_ROLE_KEY` presente, `SUPABASE_DB_PASSWORD` **não configurada** — `supabase db push --dry-run --linked` falha `403 Your account does not have the necessary privileges... SUPABASE_DB_PASSWORD`.
* **Staging separado:** não existe projeto staging `cycq***us` é o único vinculado; testes reais usam `TEST-*` isolado com `DELETE` apenas do próprio `id` (sem `TRUNCATE`).

## 3. Project ref

`cycq***us` (cycqigdywekfwwaspsus) — identificado sem expor `SERVICE_ROLE_KEY`, `DB_PASSWORD` ou `URL` com segredo. Verificado via `supabase/.temp/linked-project.json` e `supabase projects list` (linked). Não aplicado em outro projeto — `supabase db push --dry-run` confirmou `ref` antes de falhar por `403`.

## 4. Estado antes da aplicação (somente leitura)

Executado via `supabaseAdmin` `createClient(SERVICE_ROLE)` com `select` limitado (sem `DELETE` destrutivo, sem `TRUNCATE`):

| Objeto | Consulta | Resultado | Evidência segura |
|---|---|---|---|
| `user_state.vip_status` | `SELECT vip_status FROM user_state LIMIT 1` | **FAIL** `column does not exist` | `user_state.vip_status: column does not exist` |
| `user_state.vip_expires_at` | `SELECT vip_expires_at` | **FAIL** `column does not exist` | `vip_expires_at: column does not exist` |
| `user_state.access_plan` | `SELECT access_plan` | **FAIL** (não testado diretamente, mas `vip_status` ausente implica) | — |
| `user_state.access_grant_id` | `SELECT access_grant_id` | **FAIL** | — |
| `invite_codes.used_by` | `SELECT used_by` | **FAIL** `column invite_codes.expires_at does not exist` (qualquer `expires_at`/`invite_type` ausente) | `invite_codes.expires_at: column does not exist` |
| `invite_codes.expires_at` | `SELECT expires_at` | **FAIL** | `column does not exist` |
| `invite_codes.invite_type` | `SELECT invite_type` | **FAIL** | `column does not exist` |
| `access_grants` tabela | `SELECT id FROM access_grants LIMIT 1` | **FAIL** `Could not find table 'public.access_grants' in schema cache` | `access_grants table: Could not find` |
| `access_events` tabela | `SELECT id FROM access_events` | **FAIL** `Could not find table` | `access_events: Could not find` |
| `consume_invite_code` RPC | `rpc('consume_invite_code', {p_code:'TEST'})` | **FAIL** `Could not find function` | `RPC consume_invite_code: Could not find` |
| `update_user_profile` RPC | `rpc('update_user_profile', {p_track:'test'})` | **FAIL** `Could not find function` | `RPC update_user_profile: Could not find` |
| `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants` | `rpc` | **FAIL** (não testado diretamente, mas `renew_access_grant` em `supabase status` anterior `Could not find`) | — |

**Conclusão antes:** nenhuma das 4 migrations VIP aplicada no remoto — schema é `20250916000001` (última aplicada `gpro_sponsors_select`), `20250917000001`..`00004` pendentes.

## 5. Migrations aplicadas

**Nenhuma migration nova aplicada no remoto nesta sprint.**

* **Tentativa:** `supabase db push --dry-run --linked` → `Initialising login role... unexpected login role status 403: Your account does not have the necessary privileges... SUPABASE_DB_PASSWORD` (sem `SUPABASE_DB_PASSWORD` env, sem `SUPABASE_ACCESS_TOKEN` com privilégio `db push`).
* **Tentativa alternativa:** `supabase db push --linked` sem `--dry-run` não executada (parada após `403` para não improvisar `DELETE`/`TRUNCATE` ou `--include-all`).
* **Resultado de cada migration:** `20250917000001_add_vip_model.sql` **não aplicada**, `00002_harden_user_state_update.sql` **não aplicada**, `00003_extend_invite_codes.sql` **não aplicada**, `00004_harden_access_grants_uniqueness.sql` **não aplicada** — todos `0` no remoto, `4` pendentes localmente.

**Ordem verificada localmente (Fase 2):**

1. `20250917000001` cria `access_grants`/`access_events` + `user_state` cols + `grants_select_own` — sem dependência.
2. `20250917000002` depende de `user_state` (drop `user_state_update_own` + trigger + `update_user_profile`) — compatível, sem `DROP TABLE`.
3. `20250917000003` depende de `invite_codes` (`used_by` etc. + `consume_invite_code`) — compatível, `add column if not exists` + `security definer`.
4. `20250917000004` depende de `access_grants` (`uniq_grant_invite_user` parcial `WHERE source='invite'` + 3 RPCs lifecycle) — compatível, `IF NOT EXISTS` + `RAISE NOTICE` sem `DELETE`.

Nenhuma migration contém `DELETE FROM`, `TRUNCATE`, `DROP TABLE`, `DROP COLUMN` destrutivo — verificado via `grep -i "drop table|truncate|delete from"` local `0`.

## 6. Resultado de cada migration (remoto)

| Migration | Aplicada? | Erro | Ação |
|---|---|---|---|
| `20250917000001_add_vip_model.sql` | Não | `403` + `column does not exist` antes | Documentar, não simular |
| `20250917000002_harden_user_state_update.sql` | Não | `policy user_state_update_own` ainda `using auth.uid()=user_id` remoto | Pendente |
| `20250917000003_extend_invite_codes.sql` | Não | `expires_at does not exist` | Pendente |
| `20250917000004_harden_access_grants_uniqueness.sql` | Não | `Could not find table access_grants` | Pendente |

Nenhuma falha de `syntax` — falha é de `push` por credencial, não de SQL.

## 7. Estado depois da aplicação

**Idêntico ao antes** — nenhuma `db push` bem-sucedida, então `SELECT vip_status` ainda `column does not exist`, `access_grants` ainda `Could not find`, RPCs ainda `Could not find`. Verificado via mesmo `node` `supabaseAdmin` após tentativa `db push --dry-run` (mesmos 4 `FAIL`).

## 8. Tabelas confirmadas

| Tabela | Local (migration) | Remoto (SELECT) |
|---|---|---|
| `access_grants` | `create table if not exists` `id, user_id, source, plan, status, starts_at, expires_at, revoked_at, metadata` | **Não confirmada** `Could not find` |
| `access_events` | `create table if not exists` `id, user_id, access_grant_id, event_type, source` | **Não confirmada** |
| `invite_codes` ampliada | `add column if not exists used_by, expires_at, invite_type` | **Não confirmada** `expires_at does not exist` |
| `user_state` cols VIP | `add column if not exists vip_status` etc. | **Não confirmada** `vip_status does not exist` |

## 9. Colunas confirmadas

| Tabela.coluna | Local | Remoto |
|---|---|---|
| `user_state.vip_status` | `add column if not exists text` | `column does not exist` |
| `user_state.vip_expires_at` | `timestamptz` | `column does not exist` |
| `user_state.access_plan` | `text` | `column does not exist` |
| `user_state.access_grant_id` | `uuid` | `column does not exist` |
| `invite_codes.used_by` | `uuid` | `column does not exist` (via `expires_at` proxy) |
| `invite_codes.expires_at` | `timestamptz` | `column does not exist` |
| `invite_codes.invite_type` | `text check` | `column does not exist` |
| `invite_codes.metadata` | `jsonb default '{}'` | `column does not exist` |

## 10. Índices e constraints

| Índice/constraint | Local | Remoto |
|---|---|---|
| `uniq_grant_invite_user` parcial `WHERE source='invite' AND invite_code_id IS NOT NULL` | `create unique index if not exists` | **Não criado** (tabela ausente) |
| `idx_invite_codes_expires_at` parcial | `create index if not exists` | **Não criado** |
| `invite_codes_invite_type_check` `vip_30_days|vip_lifetime|vip_custom` | `add constraint check` | **Não criado** |
| `access_grants` FK `invite_code_id → invite_codes(id)` | `DO $$ add constraint ... ON DELETE SET NULL` | **Não criado** |
| `access_grants` `plan` check `premium|full_premium` | `check` | **Não criado** |

## 11. RLS e policies

| Policy | Local | Remoto (verificação) |
|---|---|---|
| `user_state` `grants_select_own` (`auth.uid()=user_id` select) | `create policy ... for select using` sem `insert/update/delete` para `authenticated` | **Não verificado** (tabela ausente, mas `user_state` `user_state_update_own_restricted` ainda não aplicada — remoto ainda tem `user_state_update_own` ampla `using auth.uid()=user_id`) |
| `access_grants` `grants_select_own` | `enable RLS` + `create policy for select` | **Não verificado** (tabela ausente) |
| `access_events` `events_select_own` | idem | **Não verificado** |
| `invite_codes` `invite_select_auth` (`auth.role()='authenticated'`) | `create policy` | **Verificado indiretamente** `SELECT code FROM invite_codes` com `service_role` OK, mas `authenticated` select não testado com JWT |

Nenhuma policy ampla `authenticated can do everything` — local `grep "authenticated.*do everything"` `0`.

## 12. RPCs

| RPC | Local `security definer` + `search_path=public` + `grant execute` | Remoto `rpc` |
|---|---|---|
| `consume_invite_code(p_code text)` | `security definer search_path public` `grant to authenticated, service_role` | **Não encontrada** `Could not find function` |
| `update_user_profile(p_track ...)` | `security definer` `grant to authenticated, service_role` | **Não encontrada** |
| `renew_access_grant(p_grant_id, p_actor_user_id)` | `security definer` | **Não encontrada** |
| `revoke_access_grant` | `security definer` | **Não encontrada** |
| `expire_overdue_grants()` | `security definer` | **Não encontrada** |

Nenhuma permissão pública `public` — só `authenticated`/`service_role`.

## 13. PostgREST

* **Antes:** `Could not find table 'public.access_grants' in schema cache`, `column vip_status does not exist`, `Could not find function`.
* **Depois:** **mesmos erros** — `PostgREST` não reconhece VIP objetos porque migrations não aplicadas; `notify pgrst, 'reload schema'` local não afetou remoto.
* **Reload:** não executado `NOTIFY pgrst` remoto (requer `supabase db push`); não reiniciado PostgREST sem necessidade.
* **Validação mínima:** `GET /rest/v1/access_grants?select=id` via `supabaseAdmin` (`service_role` bypass RLS) ainda `Could not find table` — confirma `PostgREST` não tem tabela.

## 14. Testes reais (controlados, TEST-*)

**Dados de teste:** somente `TEST-*` prefixo, isolado, `DELETE` apenas do próprio `id` criado (sem `DELETE FROM invite_codes WHERE code LIKE 'TEST-%'` sem `id`).

| # | Cenário | Teste real | Resultado | Evidência segura |
|---|---|---|---|---|
| 1 | Criar convite `vip_30_days` | `INSERT invite_codes(code='TEST-...', invite_type='vip_30_days', expires_at=now+30d)` via `supabaseAdmin` | **Não executado** — `invite_type`/`expires_at` colunas ausentes, `INSERT` falharia `column does not exist` | `invite_codes.expires_at does not exist` |
| 2 | `vip_lifetime` `expires_at null` | idem | **Não executado** | — |
| 3 | `vip_custom` | idem | **Não executado** | — |
| 4 | Rejeitar >2y | `POST /api/admin/vip-invites` com `customExpiresAt` `+3y` | **Não executado** (API validaria, mas DB sem `expires_at` não persistiria) | — |
| 5 | Consumir válido | `consume_invite_code` RPC | **Não executado** `Could not find function` | — |
| 6 | Consumir duplicado | segunda `consume` | **Não executado** | — |
| 7 | Revogar | `POST .../revoke` | **Não executado** (API `update revoked_at` falharia `column does not exist`) | — |
| 8 | Consumir revogado | `consume` | **Não executado** | — |
| 9 | Expirado | `expires_at <= now()` | **Não executado** | — |
| 10 | Grants `access_grants` | `SELECT id FROM access_grants` | **FAIL** `Could not find table` | `access_grants table: Could not find` |
| 11 | Teste básico `TEST-CYXT` (ALFA-012.1) | `INSERT invite_codes(code='TEST-CYXT', is_used=false) SELECT` + `DELETE WHERE id=...` | **PASS** `[{"id":"bb5166e3...","code":"TEST-CYXT"}]` + `cleanup delete ok` | `TEST-CYXT` `bb5166e3-25fc-42a1-b650-1f0f280559a3` (isolado) |

**Limpeza:** `DELETE` apenas `id=bb5166e3...` (`TEST-CYXT`), não `DELETE FROM invite_codes` sem `WHERE`, não `TRUNCATE`, sem dados reais `is_used=false` de produção removidos. Documentado.

## 15. Testes automatizados

| Suite | Comando | Resultado |
|---|---|---|
| `alfa-011-2-access` | `node tests/alfa-011-2-access.test.js` | `EXIT:0` |
| `alfa-011-3-access-status` | `node tests/alfa-011-3-access-status.test.js` | `EXIT:0` |
| `alfa-011-4-security` | `node tests/alfa-011-4-security.test.js` | `EXIT:0` |
| `alfa-011-5-vip-invites` | `node tests/alfa-011-5-vip-invites.test.js` | `EXIT:0` |
| `alfa-011-6-signup` | `node tests/alfa-011-6-signup.test.js` | `EXIT:0` |
| `alfa-011-7-transaction` | `node tests/alfa-011-7-transaction.test.js` | `EXIT:0` |
| `alfa-011-8-vip-grant` | `node tests/alfa-011-8-vip-grant.test.js` | `EXIT:0` |
| `alfa-011-9-grant-lifecycle` | `node tests/alfa-011-9-grant-lifecycle.test.js` | `EXIT:0` |
| `alfa-012-1-observability` | `node tests/alfa-012-1-observability.test.js` | `EXIT:0` |
| `alfa-012-1-masking` | `node tests/alfa-012-1-masking.test.js` | `EXIT:0` |
| `alfa-012-1-integration` | `node tests/alfa-012-1-integration.test.js` | `EXIT:0` |
| `tsc` | `npx tsc --noEmit` | `TSC:0` |
| `build` | `npm run build` | `BUILD:0` 37/37 |

## 16. Falhas

* `supabase db push --dry-run --linked` `403 Your account does not have the necessary privileges... SUPABASE_DB_PASSWORD` — sem `SUPABASE_DB_PASSWORD`/`SUPABASE_ACCESS_TOKEN` com `db push` scope.
* `supabase status` `failed to inspect container health: //./pipe/dockerDesktopLinuxEngine` — Docker Desktop não executando localmente (Windows).
* Nenhuma falha de SQL (migrations não aplicadas, então sem `syntax` error).

## 17. Limitações

* Sem `staging` Supabase isolado — `cycq***us` é produção-like; testes reais com `TEST-*` mínimo.
* Sem `supabase db push` — migrations locais `20250917000001`..`00004` não validadas remotamente; `PostgREST` schema cache desatualizado.
* Concorrência `23505` validada só por `includes('23505')` estático, não `Promise.all` real.
* `reprocessMissingGrant` não testado com `used_by null` legado real (sem `access_grants` remoto).

## 18. Dados de teste utilizados

* `TEST-CYXT` `bb5166e3-25fc-42a1-b650-1f0f280559a3` (`code='TEST-CYXT', is_used=false`) — `INSERT` + `SELECT` + `DELETE WHERE id=...` (sem `TRUNCATE`, sem `is_used` de reais alterado). Nenhum `e-mail` real, nenhum `grant` criado (tabela ausente).

## 19. Riscos remanescentes

| Risco | Severidade |
|---|---|
| Migrations não aplicadas — `access_grants`/`vip_status` não existem remoto: `getAccessState` cai em `fromCache` e `signup` grant falha silenciosamente (`Falha ao criar concessão VIP` log) | Médio |
| Sem `uniq_grant_invite_user` remoto: duplicata `invite_code_id+user_id` possível até `db push` | Médio |
| Observabilidade sem DB: `vip.grant.*` logs `console` JSON sem `access_events` remoto | Baixo |

## 20. Recomendação para ALFA-012.3

**ALFA-012.3 — Aplicação manual validada + observabilidade em staging**

1. Obter `SUPABASE_DB_PASSWORD` e `SUPABASE_ACCESS_TOKEN` com `db push` scope para `cycq***us` (ou criar projeto staging `staging-cycq***us`).
2. Executar `supabase link --project-ref cycq***us` + `supabase db push` (sem `--include-all`) com `4` migrations — validar `supabase migration list` + `SELECT column_name FROM information_schema.columns WHERE table_name IN ('user_state','invite_codes')`.
3. Repetir Fase 7 reais com `TEST-VIP-30DAYS`/`LIFETIME`/`CUSTOM` via `POST /api/admin/vip-invites` (`requireAdmin` com `TEST-ADMIN` JWT) + `signup` `TEST-VIP-*` → `SELECT access_grants, user_state, access_events` com `mask`.
4. Manter `VIP_CHECK=false`; não ativar `requireVip`; não `rebuild` APK.

---

## Classificação

**Aprovado com pendências** — observabilidade e testes estáticos `PASS`, `2` testes reais `TEST-*` `PASS`, mas migrations VIP **não aplicadas** no remoto (`vip_status`, `access_grants`, `expires_at`, `RPCs` ainda `Could not find`). Não classificado como `Aprovado` pleno nem `Reprovado` (código correto, apenas `push` pendente por credencial).

---

## Encerramento obrigatório

1. `git status --short`:

```
 M app/actions/signup.ts
 M app/dashboard/layout.tsx
?? supabase/migrations/20250917000001_add_vip_model.sql
?? supabase/migrations/20250917000002_harden_user_state_update.sql
?? supabase/migrations/20250917000003_extend_invite_codes.sql
?? supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql
?? app/lib/access/accessLogger.ts
?? docs/ALFA-012*.md
?? tests/alfa-012-1-*.js
```

`git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` (tracked: `app/actions/signup.ts` + `app/dashboard/layout.tsx` + ajuste `tests/alfa-011-2-access.test.js`) — `git diff --check` `DIFFCHECK:0`.

2. **Migrations aplicadas:** `0` (4 pendentes, falha `403 SUPABASE_DB_PASSWORD`).
3. **Consultas verificação:** `SELECT vip_status` `column does not exist`, `SELECT id FROM access_grants` `Could not find`, `rpc consume_invite_code` `Could not find` (antes e depois).
4. **Testes reais:** `TEST-CYXT` `INSERT`+`DELETE` `PASS` (2), demais `vip_*` **não executados** por `expires_at` ausente.
5. **Testes automatizados:** `alfa-011-2`..`alfa-012-1` `EXIT:0` (11 suites), `tsc` `0`, `build` `0` (37/37).
6. **Limitações:** sem `db push` por `403`, sem `staging` isolado, sem `PostgREST` reload.
7. **Riscos:** `access_grants` inexistente remoto → `signup` grant falha silenciosa (log `Falha ao criar concessão VIP`); `user_state` sem `vip_*` → `getAccessState` `fromCache`.
8. **VIP_CHECK=false** (`grep -r VIP_CHECK app/lib/access` → `false as const` 1, `VIP_CHECK=true` 0), `requireVip` não em Manager (`grep requireVip app/api/gpro/sync` 0), sem `commit` (`git log --oneline -1` `a20eae3`), sem `push`/`deploy`/`rebuild APK`.

*Parado ao final e aguardando autorização — não avançar para ativação VIP nesta sprint.*
