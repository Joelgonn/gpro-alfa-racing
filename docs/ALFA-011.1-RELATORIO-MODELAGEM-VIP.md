# ALFA-011.1 — Relatório Modelagem VIP

> **Sprint:** Modelagem e Migration aditiva — sem ativação de bloqueio Premium
> **Data:** 2026-09-17
> **Migration:** `supabase/migrations/20250917000001_add_vip_model.sql`
> **Base:** `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` + auditoria `ALFA-011.0-AUDIT-VIP-30DIAS.md`
> **Tipo:** Somente leitura de código + migration aditiva — nenhum `DROP/TRUNCATE`, nenhum `requireVip`, nenhuma API alterada, sem commit/push/deploy

---

## 1. Arquivos criados ou alterados

| Arquivo | Ação | Descrição |
|---|---|---|
| `supabase/migrations/20250917000001_add_vip_model.sql` | **criado** | Migration aditiva VIP (colunas + 2 tabelas + RLS + índices + trigger) |
| `docs/ALFA-011.1-RELATORIO-MODELAGEM-VIP.md` | **criado** | Este relatório |
| `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md` | **já existente** (753 linhas, 2026-09-17) | Não alterado |
| `supabase/migrations/20250914000001_rls_hardening.sql` | **consultado** | Convenção de nomes e RLS existente |
| `supabase/migrations/20250915000002_add_car_characteristic.sql:6` | **consultado** | `ADD COLUMN IF NOT EXISTS car_characteristic jsonb` + `NOTIFY pgrst` |
| `supabase/migrations/20250916000001_gpro_sponsors_select.sql:4` | **consultado** | `gpro_sponsors` RLS |
| `app/lib/db.ts:30,142,237` | **consultado** | `UserState`, `getUserState`, `saveUserState` — sem alteração |
| `app/lib/auth.ts:33,61,77` | **consultado** | `requireAuth/requireAdmin/resolveUserId` — sem `requireVip` nesta sprint |
| `app/actions/admin.ts:12`, `app/actions/signup.ts:17` | **consultados** | `generateNewInvite` e `signUpWithInviteCode` — sem alteração |

Nenhum arquivo de código (`app/`, `components/`, `utils/`, `middleware.ts`, `capacitor.config.ts`, `package.json`) foi alterado.

## 2. Tabelas criadas

| Tabela | Método | Estado |
|---|---|---|
| `public.access_grants` | `create table if not exists` | Nova, histórico oficial de concessões Full Premium |
| `public.access_events` | `create table if not exists` | Nova, trilha auditável (granted/renewed/revoked/expired) |

Nenhuma tabela existente foi removida. `public.user_state` e `public.invite_codes` preservados.

## 3. Colunas adicionadas em `public.user_state`

Todas via `alter table ... add column if not exists` (idempotente, nullable):

| Coluna | Tipo | Nulabilidade | Comentário SQL |
|---|---|---|---|
| `vip_status` | `text` | `NULL` | `Estado resumido do acesso VIP: active | expired | lifetime | null` |
| `vip_expires_at` | `timestamptz` | `NULL` | `Data de expiração do acesso VIP; NULL para vitalício ou sem acesso` |
| `access_plan` | `text` | `NULL` | `Plano concedido atualmente: full_premium | premium | null` |
| `access_grant_id` | `uuid` | `NULL` | `Concessão (access_grants.id) atualmente associada; NULL se sem concessão` |

* Sem `NOT NULL` — registros existentes permanecem válidos com `NULL`
* Sem `DEFAULT` obrigatório — não assume plano para usuários legados
* Sem alteração em `role` — preservado `role:'admin'|'user'` (`app/lib/db.ts:31`)

## 4. Tipos e defaults utilizados

### `access_grants`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null
source text not null check (source in ('invite','manual','payment','admin'))
invite_code_id uuid -- nullable, FK opcional
plan text not null check (plan in ('premium','full_premium'))
status text not null check (status in ('active','expired','revoked','pending')) default 'pending'
starts_at timestamptz not null default now()
expires_at timestamptz -- NULL = vitalício
revoked_at timestamptz
revoked_by uuid
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now() -- via trigger before update
```

### `access_events`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null
access_grant_id uuid -- nullable
event_type text not null check (event_type in ('granted','renewed','revoked','expired','manually_adjusted'))
source text -- invite | manual | payment | admin
actor_user_id uuid
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
```

`metadata` sempre `jsonb NOT NULL DEFAULT '{}'` — evita `NULL` e permite extensão sem nova migration. `expires_at NULL` = vitalício (regra 9 do plano).

## 5. Índices criados

Somente úteis, `if not exists`, parciais quando nullable:

| Índice | Tabela(coluna) | Justificativa |
|---|---|---|
| `idx_access_grants_user_id` | `access_grants(user_id)` | `getEffectiveAccess(userId)` e `requireVip` |
| `idx_access_grants_status` | `access_grants(status)` | filtros admin `status=active/pending` |
| `idx_access_grants_expires_at` | `access_grants(expires_at)` | varredura expirados, `expires_at > now()` |
| `idx_access_grants_invite_code_id` | `access_grants(invite_code_id) WHERE not null` | auditoria `invite_code_id → invite_codes` |
| `idx_access_events_user_id` | `access_events(user_id)` | timeline por usuário |
| `idx_access_events_grant_id` | `access_events(access_grant_id) WHERE not null` | histórico por concessão |
| `idx_access_events_created_at` | `access_events(created_at desc)` | ordenação timeline |

Sem excesso — 7 índices totais. Nenhum índice em `user_state` além dos existentes (evita overhead até ALFA-011.5).

## 6. Políticas RLS criadas

Analisada RLS existente em `20250914000001_rls_hardening.sql:6-74` — `user_state` com `select/insert/update/delete_own` (`auth.uid()=user_id`), `invite_codes` com `invite_select_auth` (`auth.role()='authenticated'` select).

Para novas tabelas (inicial segura, escrita só `service_role`):

```sql
alter table public.access_grants enable row level security;
alter table public.access_events enable row level security;

drop policy if exists "grants_select_own" on public.access_grants;
create policy "grants_select_own" on public.access_grants
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.access_events;
create policy "events_select_own" on public.access_events
  for select to authenticated using (auth.uid() = user_id);
```

* **Sem** `insert/update/delete` para `authenticated` — `service_role` bypassa RLS e será usado por `app/lib/access/accessService.ts` futuro (regra `service_role` em `app/lib/supabase-admin.ts:17`)
* Leitura limitada aos próprios registros (`auth.uid()=user_id`) — sem `authenticated can do everything`
* `metadata` não exposto indiscriminadamente — `select_own` retorna, mas sem `raw` financeiro (que só existirá em `payments` futuro, fora desta sprint)

## 7. Decisões sobre FKs

| Relação | FK criada? | Decisão |
|---|---|---|
| `access_grants.invite_code_id → invite_codes.id` | **Tenta criar, com fallback silencioso** | `do $$ if exists invite_codes then alter table add constraint fkey on delete set null exception when others then null end if $$` — `invite_codes.id` é `uuid` (`app/actions/signup.ts:30`), então FK é compatível; se já existir constraint ou tipo incompatível, mantém **sem FK** e não falha migration (registrado aqui) |
| `access_events.access_grant_id → access_grants.id` | **Tenta criar, com fallback** | `on delete set null` para preservar `access_events` se `access_grants` deletado (histórico não pode sumir) |
| `access_grants.user_id → auth.users(id)` | **Não criado como FK** | `user_id` é `uuid not null` sem `references auth.users` — evita quebra se `auth` schema diferir entre ambientes (Supabase local vs Dashboard); `auth.users` sempre existe, mas sem FK o `user_id` ainda é validado por `supabaseAdmin` em `accessService` futuro |
| `access_grants.revoked_by, access_events.actor_user_id` | **Sem FK** | `uuid` nullable, sem `references` — admin pode ser deletado sem cascata |
| `user_state.access_grant_id → access_grants.id` | **Sem FK** | Cache em `user_state`, não fonte; FK causaria ciclo e lock desnecessário |

## 8. Confirmação de ausência de dependência com `payments`

Validado via `Select-String` no arquivo de migration:

* `payments`: 0 ocorrências — **não criado**
* `orders`: 0 ocorrências — **não criado**
* `premium_plans`: 0 ocorrências — **não criado**
* `DROP TABLE` / `TRUNCATE`: 0 — **nenhuma operação destrutiva**
* `webhook Pix` / `gateway`: 0

A parte financeira fica para `ALFA-011.6-8` conforme `docs/ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md:12`.

## 9. Comandos de validação executados

```bash
npx tsc --noEmit
npm run build
git diff --check
git status --porcelain=v1
git diff --stat
Select-String -Pattern "payments|orders|premium_plans|DROP TABLE|TRUNCATE" supabase/migrations/20250917000001_add_vip_model.sql
```

## 10. Resultados de cada validação

| Validação | Resultado | Detalhe |
|---|---|---|
| `npx tsc --noEmit` | **PASS** (`EXIT:0`) | Nenhum erro de tipos — migration não altera `app/lib/db.ts`, então `UserState` permanece compatível |
| `npm run build` | **PASS** (`EXIT:0`, 21.8s, `Compiled successfully in 21.8s`, 34/34 static pages) | `Next.js 16.1.1 (Turbopack)`, sem regressão; aviso `middleware → proxy` é pré-existente, não relacionado |
| `git diff --check` | **PASS** (`DIFFCHECK_EXIT:0`) | Sem whitespace errors |
| `git status --porcelain=v1` | **PASS** | Só `?? supabase/migrations/20250917000001_add_vip_model.sql` e `?? docs/ALFA-011.1-RELATORIO-MODELAGEM-VIP.md` como untracked + `?? docs/` (já existente) — nenhum tracked modificado |
| `git diff --stat` | **PASS** | Vazio — nenhum arquivo versionado alterado |
| `Select-String payments` | **PASS** | `OK no payments` — 0 ocorrências, confirma 8 |
| Nomes tabelas | **PASS** | `access_grants`, `access_events` exatas |
| Nomes colunas | **PASS** | `vip_status, vip_expires_at, access_plan, access_grant_id` exatas |
| Tipos | **PASS** | `text`, `timestamptz`, `uuid`, `jsonb` conforme spec |
| Defaults | **PASS** | `gen_random_uuid()`, `now()`, `'{}'::jsonb`, `'pending'` — idempotentes |
| Nulabilidade | **PASS** | `user_state` cols `NULL` (sem `NOT NULL`), `expires_at NULL` para vitalício |
| Índices | **PASS** | 7 índices `if not exists`, parciais onde `is not null` |
| RLS | **PASS** | `enable row level security` + `grants_select_own`/`events_select_own` (`auth.uid()=user_id`), sem `insert/update/delete` para `authenticated` |
| Ausência FK `payments` | **PASS** | nenhuma FK para `payments` |

## 11. Riscos ou pendências

| Risco | Severidade | Status | Mitigação futura |
|---|---|---|---|
| **RLS `user_state_update_own` permissivo** (`20250914000001:33` `using (auth.uid()=user_id) with check (auth.uid()=user_id)`) permite `supabase.from('user_state').update({role:'admin', vip_expires_at:'2099-01-01'})` | **Alto** | **Registrado, não corrigido nesta sprint** (escopo restrito, instrução 5) — será corrigido em ALFA-011.4 com policy restrita + trigger `BEFORE UPDATE` |
| **FK `invite_code_id` pode ficar sem constraint** se `exception` silenciosa | **Baixo** | Registrado | Não quebra — `access_grants` funciona sem FK; auditoria em `access_events` preserva `invite_code_id` mesmo sem FK |
| **Usuários legados com `vip_status NULL`** — após ativação futura `requireVip`, serão tratados como `sem acesso` (403) exceto `role=admin` | **Médio** | Pendente decisão ALFA-011.5 | Backfill opcional `access_grants` com `30d` a partir de `created_at` ou allowlist temporária + `VIP_CHECK` flag |
| **Migration ainda não aplicada no Supabase remoto** (repo só versiona, não `supabase db push`) | **Informativo** | Pendente deploy | Aplicar via `supabase db push` ou Dashboard SQL Editor quando ambiente permitir; `notify pgrst` já incluso |
| **Sem validação de `payments`/`orders`** — proposital | **Informativo** | OK | ALFA-011.6-8 |

## 12. Próximos passos sugeridos para ALFA-011.2

**ALFA-011.2 — Serviço central de acesso (sem bloqueio ainda)**

1. Criar `app/lib/access/accessService.ts` (`import 'server-only'`) com `grantAccess`, `getEffectiveAccess`, `hasFullPremium`, `renewAccess`, `revokeAccess`, `calculateExpiration`, `recordAccessEvent` — escrita só via `supabaseAdmin` (`app/lib/supabase-admin.ts:17`)
2. Estender `app/lib/db.ts` (`UserState` + `getUserState` select) para ler `vip_status, vip_expires_at, access_plan, access_grant_id` com fallback `NULL` (sem quebrar `saveUserState` — adicionar branch `if (data.vip_status !== undefined) payload.vip_status = data.vip_status` com `42703` fallback como `tyre_suppliers:282`)
3. Adicionar `requireVip()` em `app/lib/auth.ts` mas com `VIP_CHECK=false` (feature flag em `lib/featureFlags.ts` ou `env`) — não bloquear `gpro/sync`, `python`, `calendar`, `manager/profile`, `market/update` ainda
4. Atualizar `app/actions/signup.ts:59` para chamar `grantAccess({userId, source:'invite', inviteCodeId, plan:'full_premium', validityType:'fixed_days', validityDays:30})` dentro da `signUpWithInviteCode` (após `update is_used`) — ainda sob flag `VIP_CHECK=false` para não afetar login existente, mas já preencher `access_grants` + `access_events` + `user_state` cache
5. Testes: `calculateExpiration('fixed_days',30) == now+30d`, `granted lifetime` com `expires_at null`, `hasFullPremium` com `status active` vs `expired`
6. Não criar ainda: página admin (`ALFA-011.3`), renovação/revogação (`ALFA-011.4`), ativação `requireVip` (`ALFA-011.5`), `premium_plans` (`ALFA-011.6`), `orders/payments` (`ALFA-011.7`)

---

## Anexos

* **Convenção de nomes:** `20250917000001_add_vip_model.sql` segue `YYYYMMDDNNNNN_descricao.sql` como `20250914000001_rls_hardening.sql`, `20250915000002_add_car_characteristic.sql`, `20250916000001_gpro_sponsors_select.sql`
* **Idempotência:** todas `ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`, `DROP POLICY IF EXISTS`, `CREATE POLICY`, `NOTIFY` são reexecutáveis
* **Comportamento atual preservado:** login/signup (`app/login/page.tsx`, `app/actions/*`), Sidebar (`app/dashboard/layout.tsx:352`), Manager (`app/dashboard/manager`), APIs (`app/api/**`), APK (`capacitor.config.ts:7`) — nenhum alterado, novas cols permanecem `NULL` sem uso

*Fim ALFA-011.1 — aguardar autorização para ALFA-011.2.*
