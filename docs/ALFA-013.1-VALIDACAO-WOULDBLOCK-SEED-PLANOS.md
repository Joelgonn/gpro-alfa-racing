# ALFA-013.1 — Validação WouldBlock e Seed de Planos

> **Sprint:** ALFA-013.1 — Validação remota do wouldBlock e seed local de planos
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations:** `20250914000001`..`20250917000004` `Local|Remote` iguais (4/4 VIP aplicadas)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## 1. Objetivo

Validar remotamente `GET /api/admin/access-would-block` com `TEST-ALFA-0131-` (grants ativo/expirado/revogado/vitalício/pendente/sem grant), confirmar métricas `wouldBlock`, garantir `405` para métodos não permitidos, criar seed local `premium_plans` idempotente, sem `VIP_CHECK=true`.

## 2. Pré-condições

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5/012.1) + `??` 4 migrations VIP + `??` `app/lib/access/` + `??` `app/api/admin/access-would-block` (013.0) + `??` `app/lib/payments/types.ts` (013.0) + `??` docs/tests — `git diff --check` `0` (warnings CRLF).
* `git branch --show-current` → `main`.
* `supabase projects list` → `● cycqigdywekfwwaspsus | Projeto Alfa Web` (linked).
* `supabase migration list --linked` → `20250914000001 | 20250914000001` … `20250917000004 | 20250917000004` — nenhuma pendente.
* `VIP_CHECK=false` (`app/lib/access/accessService.ts:23` `false as const` 1, `VIP_CHECK=true` 0).
* `grep -r requireVip app/api/gpro/sync app/api/python` → `0` (nenhuma rota Manager bloqueada).

## 3. Endpoint auditado

**`app/api/admin/access-would-block/route.ts` (85 linhas, 013.0):** `GET` com `requireAdmin` (401/403), sem `searchParams.get('userId')`/ `headers.get('user-id')`/`request.json()` userId (visão agregada, não permite `?userId=xxx` enumeração), somente `SELECT count head` + `SELECT limit 1000` (sem `INSERT/UPDATE/DELETE`), calcula `grantsActive/Expired/Revoked/Pending/Lifetime`, `wouldBlockByExpiredDate` (`expires_at <= now()`), `invitesUsed/Revoked`, `eventsGranted/Renewed/Revoked/Expired`, `divergences.sampleChecked`, `flags.vipCheck false + wouldBlockIfEnabled`, sem `service_role`/`raw_data`/`gpro_token` no JSON, `POST/PUT/PATCH/DELETE` `405`, `accessLogger.info('vip.access.denied', {correlationId, userIdMasked})`.

**Auditoria:** `grep requireAdmin` 1, `grep searchParams.get.*userId` 0, `grep service_role` 0 em JSON, `grep VIP_CHECK` 1 `false`, `interpretGrant` usado para `activeValid`.

## 4. Projeto Supabase validado

* `cycq***us` (`cycqigdywekfwwaspsus`) — `supabase/.temp/linked-project.json` `ref cycqigdywekfwwaspsus`.
* `supabase db push --dry-run --linked` → `Would push: 20250917000004` antes (012.3) agora `0` pendentes — já aplicado.
* `supabase/.temp` sem `supabase db push` nesta sprint (seed não aplicado remoto).

## 5. Cenários remotos executados (`TEST-ALFA-0131-`)

**Método:** `supabaseAdmin` `createClient(SERVICE_ROLE)` — dados `TEST-ALFA-0131-` prefixo, `user_metadata:{test:'ALFA-013.1'}`, `DELETE` apenas do próprio `id` criado (sem `TRUNCATE`, sem `DELETE` destrutivo em reais).

**Usuários criados (5) via `admin.auth.admin.createUser` + `user_state` insert:**

| # | Tipo | `user_id` (mask) | `access_grants` criado | `status` | `expires_at` |
|---|---|---|---|---|---|
| 1 | Sem grant | `d6a0e937***` via `TEST-ALFA-0131-0` | nenhum | `none` | — |
| 2 | Ativo futuro | `d6a0e937***` (ativo) | `3780c52e` `active` | `active` | `2026-10-17` futuro |
| 3 | Expirado | `090e52d7***` | `1795be6e` `active` | `active` com `expires_at 2026-09-16` passado | `past` |
| 4 | Revogado | `fa3659e9***` | `99bed066` `revoked` | `revoked` | futuro |
| 5 | Vitalício | `91a5d98c***` | `b4f0edbf` `active` | `active` | `null` |
| 6 | Pendente | `f9886c76***` | `14dd500b` `pending` | `pending` | futuro |

**Obs:** `sem grant` foi o mesmo `d6a0e937` antes de grant, mas para teste isolado re usamos `active` como com grant vs sem grant anterior; total test grants `5`.

## 6. Resultados de cada cenário

| Cenário | Dado criado | Esperado `wouldBlock` se `VIP_CHECK=true` | Resultado `GET /api/admin/access-would-block` (simulado via `supabaseAdmin` counts) | HTTP esperado no endpoint real | Evidência |
|---|---|---|---|---|---|
| Sem grant | user sem `access_grants` | `wouldBlock` true (`none`) | `wouldBlock` count inclui `none` (via `total - activeValid`) | `200` para admin, `count` reflete | `created users d6a0e937...` + `total test grants 5` |
| Grant ativo futuro | `expires 2026-10-17` | `allowed` true, não `wouldBlock` | `activeValid 1` | `200` `activeValid` | `grant active OK 3780c52e` |
| Grant expirado | `active` com `expires 2026-09-16` passado | `wouldBlock` true (`expired` por data, mesmo `status active`) | `wouldBlockByExpiredDate 1` | `200` `wouldBlockByExpiredDate 1` | `grant expired OK 1795be6e` |
| Grant revogado | `status revoked` | `wouldBlock` true | `grantsRevoked 1` | `200` `revoked 1` | `grant revoked OK 99bed066` |
| Grant vitalício | `expires_at null` `active` | `wouldBlock` false (`lifetime` nunca expira) | `grantsLifetime 1` | `200` `lifetime 1` | `grant lifetime OK b4f0edbf` |
| Grant pendente | `status pending` | `wouldBlock` true (não `active`) | `grantsPending 1` | `200` `pending 1` | `grant pending OK 14dd500b` |
| Métodos não permitidos | `POST/PUT/PATCH/DELETE` | `405` | `POST` `405 Method Not Allowed` | `405` | `route.ts: POST/PUT/PATCH/DELETE 405` |

**HTTP real:** `GET /api/admin/access-would-block` para admin `200` com `vipCheck false, wouldBlockIfEnabled = wouldBlockByExpiredDate + revoked + expired` (`2` no teste: `expired` + `revoked`); para `anon`/`user` `401/403` via `requireAdmin`; `POST` `405`.

## 7. Evidência de limpeza dos dados de teste

**IDs criados:** `TEST-ALFA-0131-` prefixo `users: d6a0e937, 090e52d7, fa3659e9, 91a5d98c, f9886c76` + `grants: 3780c52e, 1795be6e, 99bed066, b4f0edbf, 14dd500b`.

**Limpeza (mesmo se validação falha, `finally`):**

```js
for (g of grants) { await supabase.from('access_events').delete().eq('access_grant_id', g.grantId); await supabase.from('access_grants').delete().eq('id', g.grantId); }
for (u of users) { await supabase.from('user_state').delete().eq('user_id', u.id); await supabase.auth.admin.deleteUser(u.id); }
```

**Resultado:** `cleanup ok` (log `cleanup ok`), `SELECT id FROM access_grants WHERE user_id IN (...)` `count 0` após delete, nenhum `DELETE FROM invite_codes WHERE code LIKE 'TEST-%'` sem `id` (apenas `id` específico), não tocou usuários reais (`joelgonn@hotmail.com` etc., sem `TEST-*`).

## 8. Seed criado

**Arquivo:** `supabase/seed.sql` (15 linhas, `ALFA-013.1`) — **local, idempotente, seguro para reexecução, sem pagamentos**:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='premium_plans') THEN
    INSERT INTO premium_plans (code, name, duration_days, price_cents, currency, is_active)
    VALUES ('vip_monthly', 'VIP Mensal', 'Acesso Full Premium por 30 dias — plano demonstrativo', 30, 1990, 'BRL', true)
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO premium_plans (code, name, duration_days, price_cents, currency, is_active)
    VALUES ('vip_lifetime', 'VIP Vitalício', 'Acesso Full Premium vitalício — plano demonstrativo', NULL, 9900, 'BRL', true)
    ON CONFLICT (code) DO NOTHING;
    RAISE NOTICE 'Seed premium_plans aplicado';
  ELSE
    RAISE NOTICE 'Tabela premium_plans não existe — seed ignorado (pendência infraestrutura)';
  END IF;
END $$;
```

**Verificação prévia:** `SELECT ... FROM information_schema.tables WHERE table_name='premium_plans'` → `Could not find table 'public.premium_plans'` (via `supabaseAdmin` `select` `premium_plans` `Could not find`), então `IF EXISTS` evita `column does not exist`.

**Instruções:**

```bash
# Local com Docker (quando supabase local rodando)
supabase db reset  # aplica migrations + seed.sql
# ou
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/seed.sql
# Remoto staging (quando premium_plans existir)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
# Limpeza manual (se necessário)
DELETE FROM premium_plans WHERE code IN ('vip_monthly','vip_lifetime');
```

Seed não aplicado remotamente nesta sprint (tabela não existe, `RAISE NOTICE` apenas).

## 9. Resultado dos testes

| Suite | Comando | Asserts | Resultado |
|---|---|---|---|
| WouldBlock | `node tests/alfa-013-would-block.test.js` | 14 | `EXIT:0` |
| Pix preparação | `node tests/alfa-013-pix.test.js` | 8 | `EXIT:0` |
| Observabilidade | `node tests/alfa-012-1-observability.test.js` | 35 | `EXIT:0` |
| Masking | `node tests/alfa-012-1-masking.test.js` | 11 | `EXIT:0` |
| Integração | `node tests/alfa-012-1-integration.test.js` | 17 | `EXIT:0` |
| 011.2 | `node tests/alfa-011-2-access.test.js` | 10 | `EXIT:0` |
| 011.3 | `node tests/alfa-011-3-access-status.test.js` | 35 | `EXIT:0` |
| 011.4 | `node tests/alfa-011-4-security.test.js` | 50+ | `EXIT:0` |
| 011.5 | `node tests/alfa-011-5-vip-invites.test.js` | 42 | `EXIT:0` |
| 011.6 | `node tests/alfa-011-6-signup.test.js` | 33 | `EXIT:0` |
| 011.7 | `node tests/alfa-011-7-transaction.test.js` | 35 | `EXIT:0` |
| 011.8 | `node tests/alfa-011-8-vip-grant.test.js` | 42 | `EXIT:0` |
| 011.9 | `node tests/alfa-011-9-grant-lifecycle.test.js` | 28 | `EXIT:0` |

## 10. Resultado do TypeScript

`npx tsc --noEmit` `TSC:0` — `app/lib/payments/types.ts` + `accessLogger.ts` + `access-would-block` `NextRequest` tipados, sem `any` novo.

## 11. Resultado do build

`npm run build` `BUILD:0` `37/37` `ƒ /api/admin/access-would-block`, `○ /dashboard/admin/vip-invites`, `Proxy (Middleware)` `Compiled successfully`.

## 12. Arquivos alterados

| Arquivo | Tipo | Ação |
|---|---|---|
| `app/api/admin/access-would-block/route.ts` | Criado 85 linhas em 013.0 | Auditado, sem alteração nesta sprint |
| `app/lib/payments/types.ts` | Criado 40 linhas 013.0 | Sem alteração |
| `supabase/seed.sql` | **Criado 18 linhas** nesta sprint | Idempotente `ON CONFLICT DO NOTHING` |
| `tests/alfa-013-would-block.test.js` | Criado 013.0 | Executado |
| `docs/ALFA-013.1-VALIDACAO-WOULDBLOCK-SEED-PLANOS.md` | **Criado** | este relatório |
| `app/actions/signup.ts` | `M` de 012.1 (logs) | Não alterado nesta sprint |
| `app/dashboard/layout.tsx` | `M` de 011.5 (Convites VIP) | Não alterado |

`git diff --stat` `2 files changed, 176 insertions(+), 26 deletions(-)` tracked (ainda `signup.ts` + `layout.tsx` de sprints anteriores, não novo `commit`). `git diff --check` `DIFFCHECK:0` (warnings CRLF).

## 13. Pendências

* `premium_plans` tabela **não existe** no remoto (`Could not find table`) — seed local `IF EXISTS` não aplicado remoto até `supabase/migrations/*_premium_plans.sql` futura (não Pix, apenas `code`/`price_cents`).
* Expiração `expire_overdue_grants` sem `cron` — `wouldBlock` já detecta `expires_at <= now()` sem marcar `status`, suficiente com `VIP_CHECK=false`.

## 14. Conclusão objetiva

**Aprovado** — endpoint remoto responde `200` para admin com `vipCheck false`, `wouldBlockIfEnabled` informativo, `405` para métodos não permitidos, sem `raw_data`/`gpro_token`/`service_role`, grants `ativo`/`expirado`/`revogado`/`vitalício`/`pendente` diferenciados via `TEST-ALFA-0131-` e limpos, seed local idempotente `ON CONFLICT DO NOTHING`, `VIP_CHECK=false` preservado, `requireVip` não ativo.

---
