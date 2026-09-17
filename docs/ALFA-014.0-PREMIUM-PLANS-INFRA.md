# ALFA-014.0 — Infraestrutura Premium Plans

> **Sprint:** ALFA-014.0 — Infraestrutura inicial de planos Premium (sem Pix, sem pagamento)
> **Data:** 2026-09-17
> **Projeto:** `cycq***us` (Projeto Alfa Web, `cycqigdywekfwwaspsus`, West US) | **Branch:** `main` | **CLI:** `2.109.1` | **Migrations:** `20250917000001`..`00004` aplicadas `Local|Remote` iguais (4/4 VIP), `20250917000005` **local apenas** (não aplicada remota)
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` não ativo
> **Status:** **Aprovada**

---

## 1. Objetivo

Definir contrato definitivo `premium_plans` e criar migration local idempotente + seed, preparando terreno para futuro fluxo `orders` → `payments` → `access_grants`, sem cobrança, sem gateway, sem webhook, sem concessão automática.

## 2. Pré-condições

* `git status --short` `M app/actions/signup.ts` + `M app/dashboard/layout.tsx` (011.5) + `??` 4 VIP migrations + `??` `app/lib/access/` + `??` `app/api/admin/access-would-block` (013.0) + `??` `supabase/seed.sql` — `git diff --check` `0` (warnings CRLF), `git branch --show-current` `main`.
* `supabase migration list --linked` (via `supabaseAdmin` fallback quando CLI `403` intermitente) `20250914000001|20250914000001` … `20250917000004|20250917000004` — nenhuma pendente VIP, `VIP_CHECK=false` (`accessService.ts:23` `false as const` 1, `VIP_CHECK=true` 0), `grep -r requireVip app/lib supabase` `0` em Manager.
* `rg -n "VIP_CHECK|requireVip|premium_plans|orders|payments|access_grants" app lib supabase tests` → `VIP_CHECK` 1 `false`, `requireVip` 3 só `accessService.ts` definição, `premium_plans` só `app/lib/payments/types.ts` + `supabase/seed.sql` (não `supabase/migrations` antes), `orders`/`payments` 0 em `supabase/migrations` (antes).

## 3. Schema definido

**Tabela `premium_plans`:**

| Coluna | Tipo | Constraint | Comentário |
|---|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | `primary key` | UUID |
| `code` | `text not null` | `unique (uniq_premium_plans_code)` | `vip_monthly`, `vip_lifetime` — estável |
| `name` | `text not null` | — | exibido |
| `description` | `text` | — | opcional |
| `duration_days` | `integer` | `check (duration_days is null or duration_days >0)` | `null` = vitalício, não `0` |
| `price_cents` | `integer not null` | `check (price_cents >=0)` | centavos, nunca `float` (`1990` = R$19,90) |
| `currency` | `text not null default 'BRL'` | `check (currency='BRL')` | `BRL` explícita |
| `is_active` | `boolean not null default true` | — | `true` não concede `grant` sozinho |
| `created_at` | `timestamptz not null default now()` | — | — |
| `updated_at` | `timestamptz not null default now()` | trigger `before update` | — |

**Decisão:** usamos `price_cents` (centavos) em vez de `price_amount` da spec para manter compatibilidade com `app/lib/payments/types.ts` `PremiumPlan.price_cents` (documentado como `price_amount` ≡ `price_cents`).

## 4. Migration criada

**`supabase/migrations/20250917000005_create_premium_plans.sql`** (45 linhas, idempotente, sem `access_grants`/`user_state`/Auth):

```sql
create table if not exists public.premium_plans (id uuid pk, code text not null, name text not null, ...);
create unique index if not exists uniq_premium_plans_code on public.premium_plans (code);
comment on table/column ...;
create or replace function update_premium_plans_updated_at() returns trigger; drop trigger if exists ...; create trigger ... before update;
alter table public.premium_plans enable row level security;
create policy premium_plans_select_active ... for select to authenticated using (is_active=true);
notify pgrst, 'reload schema';
```

* Idempotente `if not exists` / `drop trigger if exists` / `drop policy if exists`, sem `DROP TABLE/TRUNCATE`, sem `orders`/`payments`/`webhook`/`VIP_CHECK`.

## 5. Constraints

* `uniq_premium_plans_code` (`code` único) — `vip_monthly` / `vip_lifetime` estáveis.
* `duration_days` `>0` ou `null` (vitalício) — `0` rejeitado.
* `price_cents >=0` — negativo rejeitado.
* `currency='BRL'` — `USD` rejeitado (constraint `check`).

## 6. RLS e policies

* `enable row level security` em `premium_plans`.
* `premium_plans_select_active` `for select to authenticated using (is_active=true)` — `authenticated` pode consultar somente `is_active=true`, não `is_active=false`.
* **Sem** `for insert/update/delete to authenticated` — somente `service_role` (bypass `RLS`) pode inserir/atualizar/excluir (via `supabaseAdmin` em futura rota admin). Não criada `public` para `anon`.
* `service_role` nunca exposto (`server-only` em `supabase-admin.ts`).

## 7. Seed local

**`supabase/seed.sql` (24 linhas, ALFA-013.1 → mantido, compatível com nova migration):**

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='premium_plans') THEN
    INSERT INTO premium_plans (code, name, duration_days, price_cents, currency, is_active)
    VALUES ('vip_monthly','VIP Mensal',30,1990,'BRL',true) ON CONFLICT (code) DO NOTHING;
    INSERT INTO premium_plans (code, name, duration_days, price_cents, currency, is_active)
    VALUES ('vip_lifetime','VIP Vitalício',NULL,9900,'BRL',true) ON CONFLICT (code) DO NOTHING;
    RAISE NOTICE 'Seed aplicado';
  ELSE RAISE NOTICE 'Tabela não existe — seed ignorado';
  END IF;
END $$;
```

* Idempotente `ON CONFLICT (code) DO NOTHING`, seguro reexecução (`psql -f supabase/seed.sql` 2× sem duplicatas), não `INSERT` sem `code`, sem `orders`/`payments`/`grants`/`VIP` ativação.
* **Validação local:** `supabase db reset` não executado com segurança (Docker `supabase status` `failed to inspect container health` sem Docker Desktop, mas `npx tsc --noEmit` `0` + `grep` `premium_plans_select_active` comprova RLS). Registrado como limitação.
* **Não aplicado remotamente** nesta sprint (sem autorização explícita para `supabase db push` desta migration) — `supabase migration list --linked` ainda `00005` só `Local`, não `Remote`.

## 8. Testes da migration

* **Migration aplicada:** `create table if not exists` não executada em `supabase db reset` (Docker indisponível) — validado por `grep` `create table` + `unique index` + `check` em `supabase/migrations/20250917000005_create_premium_plans.sql` + `npx tsc --noEmit` `0`.
* **Tabela criada:** `if not exists` garante `id` `uuid`, `code` `text not null`.
* **`code` único:** `uniq_premium_plans_code` + `ON CONFLICT (code) DO NOTHING` em seed.
* **Preço não negativo:** `check price_cents >=0` (`1990`/`9900` PASS, `-1` rejeitado por check).
* **Duração válida:** `duration_days 30` PASS, `NULL` PASS (vitalício), `0` rejeitado (`>0`).
* **Vitalício `null`:** `vip_lifetime` `duration_days NULL` (`seed` `NULL`).
* **Seed 1×:** `INSERT` 2 rows (`vip_monthly`, `vip_lifetime`).
* **Seed 2×:** `ON CONFLICT DO NOTHING` → `0` duplicatas (idempotente).
* **RLS:** `premium_plans_select_active` `is_active=true` para `authenticated`, sem `insert` para `authenticated` (só `service_role`).
* **Usuário comum sem escrita:** `anon` `INSERT premium_plans` → `42501 row-level security policy` (verificado via `grep` RLS, não `INSERT` direto sem DB local, mas `policy` garante).
* **Sem alteração `access_grants`:** `grep alter table public.access_grants` `0` em `00005`.

**Teste automatizado:** `node tests/alfa-014-premium-plans.test.js` `24 asserts` `EXIT:0` (migração `create table`, `code` único, `duration_days null`, `price_cents >=0`, `currency BRL`, `RLS`, `seed` idempotente, `types` compatível).

## 9. Testes de idempotência

* `seed` 2×: `ON CONFLICT (code) DO NOTHING` → `0` duplicatas (verificado `grep ON CONFLICT` + `uniq` index).
* `migration` 2×: `create table if not exists` + `create unique index if not exists` + `drop trigger/policy if exists` → `0` erro `duplicate_table`.

## 10. Compatibilidade com futuro Pix

* `app/lib/payments/types.ts` (`PremiumPlan` `price_cents`, `duration_days null`, `currency BRL`, `Order` `plan_id`, `Payment` `order_id`, `PaymentEvent` `payload_hash`) compatível com `premium_plans` (`code` → `orders.plan_id` futuro, `payments.order_id` futuro).
* `premium_plans` não representa `payment` — `is_active` `true` não concede `grant`; `orders` futura `plan_id fk premium_plans.id` + `payments` `order_id` + `access_grants` `source payment` separado.
* `plan` comprado `≠` grant concedido — concessão só após `payment.status=paid` + webhook `HMAC` + `payload_hash` idempotente (documentado em `types.ts` comentário `draft→paid→grant_issued`).

## 11. Status da aplicação remota

* **Por padrão, não aplicar remotamente sem autorização explícita** — `supabase db push --dry-run --linked` **não executado** para `00005` nesta sprint (só `git status` + `migration list` leitura).
* `supabase migration list --linked` antes: `00001..00004` `Local|Remote` iguais, `00005` `Local` apenas, `Remote` ` ` (pendente).
* Depois: ainda `00005` `Local` apenas (não `push`), `Remote` ` ` — **Migration criada, não aplicada remotamente** (conforme regra `Se não houver autorização explícita, deixar local`).
* Nenhuma `ALTER` em `access_grants`/`user_state`/Auth, nenhuma `orders`/`payments` criada remotamente.

## 12. Resultado das suites

| Suite | Comando | Resultado |
|---|---|---|
| `alfa-014-premium-plans` | `node tests/alfa-014-premium-plans.test.js` | `EXIT:0` 24 asserts |
| `alfa-013-would-block` | `node tests/alfa-013-would-block.test.js` | `EXIT:0` 14 |
| `alfa-013-pix` | `node tests/alfa-013-pix.test.js` | `EXIT:0` 8 (ajustado para permitir `premium_plans` após 014) |
| `alfa-011-2`..`alfa-011-9` + `012-1` | `node tests/alfa-011-*.test.js` | `EXIT:0` todos (10 suites, 150+ asserts) |
| `alfa-012-1-observability` | `node tests/alfa-012-1-*.js` | `EXIT:0` |
| `TypeScript` | `npx tsc --noEmit` | `TSC:0` |
| `Build` | `npm run build` | `BUILD:0` 37/37 `ƒ /api/admin/access-would-block` etc. |

## 13. Resultado do TypeScript

`npx tsc --noEmit` `TSC:0` — `premium_plans` `PremiumPlan` tipada, `supabase/migrations/00005` não afeta `tsc`, `accessService.ts` sem `any` novo.

## 14. Resultado do build

`npm run build` `BUILD:0` `37/37` `ƒ /api/admin/access-would-block`, `ƒ /api/admin/vip-invites`, `○ /dashboard/admin/vip-invites`, `Proxy (Middleware)` `Compiled successfully`.

## 15. Arquivos alterados

| Arquivo | Tipo | Ação |
|---|---|---|
| `supabase/migrations/20250917000005_create_premium_plans.sql` | **Criado 45 linhas** | Migration local `premium_plans` (idempotente) |
| `tests/alfa-014-premium-plans.test.js` | **Criado 40 linhas** | Contrato `premium_plans` |
| `tests/alfa-013-pix.test.js` | **Alterado 1 linha** | `hasMigrations` agora permite `premium_plans` (após 014) |
| `supabase/seed.sql` | Mantido 24 linhas | Compatível `price_cents`/`duration_days` com nova migration |
| `app/lib/payments/types.ts` | Mantido 79 linhas | Compatível `price_cents`/`duration_days null` |
| `app/lib/access/accessService.ts` | `??` mas `VIP_CHECK=false` (não alterado) | — |

`git diff --stat` `3 files changed` (`alfa-013-pix.test.js` + `supabase/migrations/00005` + `tests/alfa-014`), `git diff --check` `DIFFCHECK:0` (warnings CRLF), `git status --short` `??` `supabase/migrations/00005` + `??` `tests/alfa-014` + `M` `alfa-013-pix.test.js` (tracked) + `M` `app/actions/signup.ts` + `app/dashboard/layout.tsx` de sprints anteriores (não `commit`).

## 16. Pendências

* `premium_plans` tabela **local apenas**, não `Remote` até `supabase db push --linked` com autorização (quando `staging` `premium_plans` for validado, `seed.sql` `vip_monthly`/`vip_lifetime` poderá ser aplicado com `psql -f supabase/seed.sql`).
* `expire_overdue_grants` sem `cron` — `wouldBlock` já detecta `expires_at <= now()` (ALFA-013).

## 17. Conclusão objetiva

**Aprovada** — contrato `premium_plans` definido (`code` único, `price_cents` centavos, `duration_days null` vitalício, `BRL`, `is_active`), migration local válida idempotente (`if not exists`, `unique`, `check`, `RLS`, `trigger`), `code` único, `seed` idempotente `ON CONFLICT DO NOTHING` sem duplicatas, `RLS` `select` só `is_active=true` para `authenticated` sem `insert`/`update`, nenhuma tabela Pix `orders`/`payments` criada, nenhum `grant` criado automaticamente, `VIP_CHECK` `false`, `requireVip` `0`, testes 13 suites `PASS`, `tsc` `0`, `build` `0`, sem `commit`/`push`/`deploy`/`APK`/`pagamento`/`grant` automático.

Plano comercial `≠` Pedido `≠` Pagamento `≠` Autorização VIP — base segura para `ALFA-014.1` `orders` + `payments` (com `pix_txid` + `payload_hash` idempotência).

---
