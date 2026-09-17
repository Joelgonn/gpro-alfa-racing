# ALFA-012.3 — Relatório Correção Migration Remota

> **Sprint:** ALFA-012.3 — Corrigir migration VIP e concluir aplicação remota
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`)
> **Branch:** `main` | **CLI:** `2.109.1` | **Status:** **Aprovado**

---

## 1. Diagnóstico do erro

**Migration falha:** `supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql` — `supabase db push --linked` retornou:

```
ERROR: syntax error at or near "exception" (SQLSTATE 42601)
```

**Trecho problemático (linhas 30-44 antes da correção):**

```sql
do $$
begin
  begin
    create unique index if not exists uniq_grant_invite_user on public.access_grants (invite_code_id, user_id)
      where source = 'invite' and invite_code_id is not null;
  exception when duplicate_table then
    raise notice '...';
  exception when unique_violation then
    raise notice '...';
  when others then
    raise notice '...', SQLERRM;
  end;
end $$;
```

**Causa:** `CREATE INDEX IF NOT EXISTS` é idempotente e não lança `duplicate_table`; `unique_violation` só ocorreria no `CREATE` se duplicatas já existissem, mas o bloco `EXCEPTION` aninhado com `IF NOT EXISTS` é sintaticamente desnecessário e o `plpgsql` rejeitou o segundo `exception` sem `BEGIN` separado — erro de sintaxe `exception at or near "exception"` (duplo `exception when` sem bloco).

**Risco de dados:** nenhum — falha impediu criação do índice, mas não apagou dados.

## 2. Arquivo e trecho corrigido

**Arquivo:** `supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql:30`

**Correção (idempotente, sem exclusão):**

```sql
do $$
begin
  create unique index if not exists uniq_grant_invite_user
    on public.access_grants (invite_code_id, user_id)
    where source = 'invite'
      and invite_code_id is not null;

  raise notice 'ALFA-011.9: índice uniq_grant_invite_user verificado/criado';
end;
$$;
```

**Preservado:** auditoria de duplicatas (`FOR ... HAVING COUNT>1` com `RAISE NOTICE` sem `DELETE`), `FOR UPDATE` em `renew/revoke/expire`, `security definer`, `search_path=public`, `grant execute to service_role`, `notify pgrst`.

## 3. Migrations aplicadas antes e depois

**Antes (`supabase migration list --linked`):**

```
Local            | Remote           | Time
20250914000001   | 20250914000001   | 2025-09-14 00:00:01
20250915000002   | 20250915000002   | 2025-09-15 00:00:02
20250916000001   | 20250916000001   | 2025-09-16 00:00:01
20250917000001   | 20250917000001   | 2025-09-17 00:00:01
20250917000002   | 20250917000002   | 2025-09-17 00:00:02
20250917000003   | 20250917000003   | 2025-09-17 00:00:03
20250917000004   | (vazio)          | 2025-09-17 00:00:04  ← pendente
```

**Depois (`supabase migration list --linked` pós-push):**

```
20250917000004   | 20250917000004   | 2025-09-17 00:00:04  ← aplicada
```

Todas as 4 VIP migrations agora `Local | Remote` iguais.

## 4. Resultado do dry-run

```powershell
supabase db push --dry-run --linked
```

```
DRY RUN: migrations will *not* be pushed
Would push these migrations:
 • 20250917000004_harden_access_grants_uniqueness.sql
```

Somente `00004` pendente — confirmado projeto `cycqigdywekfwwaspsus`.

## 5. Resultado do `supabase db push --linked`

```powershell
supabase db push --linked
```

```
Connecting to remote database...
Do you want to push these migrations? • 20250917000004_harden_access_grants_uniqueness.sql [Y/n]
Applying migration 20250917000004_harden_access_grants_uniqueness.sql...
NOTICE: ALFA-011.9: nenhuma duplicata — prosseguindo para constraint
NOTICE: ALFA-011.9: índice uniq_grant_invite_user verificado/criado
Finished supabase db push.
```

**Sem `unique_violation`** — `0` duplicatas, índice criado com sucesso.

## 6. Validações remotas realizadas (somente leitura, sem segredos)

Executado via `supabaseAdmin` `service_role` com `select` limitado + `rpc` (sem `DELETE` destrutivo exceto `TEST-*` isolado com `id` específico):

| Objeto | Verificação | Resultado | Evidência |
|---|---|---|---|
| `public.access_grants` | `SELECT id FROM access_grants LIMIT 1` | **OK** `0 rows` (tabela existe, `PostgREST` reconhece) | `access_grants table: OK exists (0 rows)` |
| `public.access_events` | `SELECT id FROM access_events` | **OK** `0 rows` | `OK exists (0 rows)` |
| `user_state.vip_status` | `SELECT vip_status FROM user_state LIMIT 1` | **OK** `1 rows` (coluna existe) | `OK exists (1 rows)` |
| `user_state.vip_expires_at` | `SELECT vip_expires_at` | **OK** | `OK exists (1 rows)` |
| `user_state.access_plan` | `SELECT access_plan` | **OK** | `OK exists` |
| `user_state.access_grant_id` | `SELECT access_grant_id` | **OK** | `OK exists` |
| `invite_codes.expires_at` | `SELECT expires_at` | **OK** | `OK exists (1 rows)` |
| `invite_codes.invite_type` | `SELECT invite_type` | **OK** | `OK exists` |
| `invite_codes.metadata` | `SELECT metadata` | **OK** | `OK exists` |
| `uniq_grant_invite_user` | `CREATE INDEX` notice + `SELECT` não `unique_violation` | **OK** `verificado/criado` | `NOTICE: nenhuma duplicata — ... índice verificado/criado` |
| `consume_invite_code(p_code)` | `rpc('consume_invite_code', {p_code:'TEST-NONEXISTENT'})` | **OK** `0 rows` (função existe, retorna vazio para não existente) | `OK exists (0 rows)` |
| `renew_access_grant` | `rpc('renew_access_grant', {p_grant_id:'0000...'})` | **OK** `Grant não encontrado` (função existe, erro esperado `P0002`) | `Grant não encontrado` |
| `revoke_access_grant` | `rpc('revoke_access_grant', ...)` | **OK** `Grant não encontrado` | `Grant não encontrado` |
| `expire_overdue_grants` | `rpc('expire_overdue_grants')` | **OK** `number` (`0`) | `OK exists (number)` |
| `update_user_profile` | `rpc('update_user_profile', {p_track:'teste'})` | **OK** `Não autenticado` (função existe, `auth.uid()` null para `service_role` sem `auth` context, mas não `Could not find function`) | `Não autenticado` |
| `trg_user_state_privilege_guard` | Testado via `anon` `UPDATE user_state SET role='admin'` | **OK** `42501 role cannot be changed` | `update role as user role cannot be changed via client (42501)` |
| `invite_codes` RLS | `invite_select_auth` (`authenticated` select) permanece (não `service_role` exposed) | **OK** | `supabaseAdmin` select OK |
| `access_grants` RLS | `insert` como `authenticated` usuário | **OK** `42501 row-level security policy for table access_grants` | `insert grant as user new row violates row-level security policy (42501)` |

**Pós-migration:** `PostgREST` erros anteriores `Could not find table/column/function` **não ocorrem mais**.

## 7. Testes executados

### Testes de integração reais (dados `TEST-*` isolados, `DELETE` apenas do próprio `id`)

| Teste | Código | Resultado | Cleanup |
|---|---|---|---|
| Criar convite `vip_30_days` | `INSERT invite_codes(code='TEST-6KAY-BFYR', invite_type='vip_30_days', expires_at=now+30d)` | **PASS** `OK TEST-6KAY-BFYR vip_30_days` | `DELETE WHERE id=...` `ok` |
| Consumir via RPC | `rpc('consume_invite_code', {p_code: testCode})` | **PASS** `OK rows 1` | `DELETE` invite `ok` |
| Criar grant + renew + revoke | `INSERT access_grants` → `rpc('renew_access_grant')` → `rpc('revoke_access_grant')` | **PASS** `OK aa7134c8...` / `OK 2026-11-16...` / `OK revoked` | `DELETE access_events, access_grants, user_state` `ok` |
| RLS `user_state` `role` | `userClient UPDATE role='admin' WHERE user_id=testUserId` | **PASS** `42501 role cannot be changed` | `DELETE user_state, deleteUser` `ok` |
| RLS `vip_status` | `UPDATE vip_status='lifetime'` | **PASS** `42501 vip_status cannot be changed` | `ok` |
| RLS `access_grants` insert como user | `userClient INSERT access_grants` | **PASS** `42501 row-level security policy` | `ok` |

Usuário de teste: `test-alfa-0123-<timestamp>@test.local` (`78857fc4-f10b-4e43-a315-c50b82ef520b`) — criado via `admin.auth.admin.createUser`, `user_state` via `admin`, `signInWithPassword` via `anonKey`, todos `DELETE` e `admin.deleteUser(testUserId)` no `finally` (somente registros `TEST-*`, não dados reais).

### Testes automatizados (estáticos + build)

| Suite | Comando | Resultado |
|---|---|---|
| `alfa-011-2-access` | `node tests/alfa-011-2-access.test.js` | `EXIT:0` 10 cenários |
| `alfa-011-3-access-status` | `node .../alfa-011-3-*.js` | `EXIT:0` 35 |
| `alfa-011-4-security` | `node .../alfa-011-4-*.js` | `EXIT:0` 50+ |
| `alfa-011-5-vip-invites` | `node .../alfa-011-5-*.js` | `EXIT:0` 42 |
| `alfa-011-6-signup` | `node .../alfa-011-6-*.js` | `EXIT:0` 33 |
| `alfa-011-7-transaction` | `node .../alfa-011-7-*.js` | `EXIT:0` 35 |
| `alfa-011-8-vip-grant` | `node .../alfa-011-8-*.js` | `EXIT:0` 42 |
| `alfa-011-9-grant-lifecycle` | `node .../alfa-011-9-*.js` | `EXIT:0` 28 |
| `alfa-012-1-observability` | `node .../alfa-012-1-*.js` | `EXIT:0` 35 |
| `alfa-012-1-masking` | `node ...` | `EXIT:0` 11 |
| `alfa-012-1-integration` | `node ...` | `EXIT:0` 17 |
| `TypeScript` | `npx tsc --noEmit` | `TSC:0` |
| `Build` | `npm run build` | `BUILD:0` 37/37 |

## 8. Limitações

* Sem `staging` isolado — testes reais em `cycq***us` (produção-like) com `TEST-*` prefixo, `DELETE` apenas do próprio `id` (não `TRUNCATE`).
* Concorrência `23505` validada por `catch 23505` estático + `UPDATE ... WHERE is_used=false` atômico, não `Promise.all` 2× `consume` real (janela pequena, mas `uniq_grant_invite_user` agora garante DB-level).
* `reprocessMissingGrant` `used_by null` legado não testado com `invite` antigo real (nenhum `TEST-*` com `used_by null` criado).

## 9. Confirmação

* **Commit:** não executado (`git status --short` mostra `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` + `M supabase/migrations/20250917000004...` + `??` mas `git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked, `git log --oneline -1` ainda `a20eae3`)
* **Push:** não executado (`git remote -v` não `push`)
* **Deploy:** não executado (`vercel --prod` não executado)
* **VIP ativação:** `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const` — `grep -r VIP_CHECK` `1` ocorrência `false`, `VIP_CHECK=true` `0`), `requireVip` não em Manager (`grep -r requireVip app/api/gpro/sync app/api/python` `0`), `APK` não recompilado (`capacitor.config.ts` `appId br.com.gproalfaracing` sem `service_role`), `PostgREST` não bloqueando usuários comuns.

## 10. Status final

**Aprovado** — `20250917000004_harden_access_grants_uniqueness.sql` corrigida (`duplicate_table` syntax error removido) e aplicada com sucesso em `cycqigdywekfwwaspsus` (`NOTICE nenhuma duplicata`), 4/4 VIP migrations `Local | Remote` iguais, `access_grants`/`access_events`/`vip_*`/`invite_codes` VIP cols/RPCs reconhecidos por `PostgREST`, testes reais `TEST-*` `PASS`, `tsc`/`build` `0`, nenhum `commit`/`push`/`deploy`/`VIP_CHECK=true`.

*Próximo: ALFA-012.4 validação de bloqueio simulado (sem ativar `VIP_CHECK` em produção) ou ALFA-013 Pix — aguardar autorização.*
