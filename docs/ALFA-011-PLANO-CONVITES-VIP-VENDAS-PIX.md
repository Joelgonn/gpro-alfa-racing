# ALFA-011 — Plano Técnico: Convites VIP, Full Premium e Vendas Pix

> **Tipo:** Documentação somente leitura — nenhum código, migration, RLS, API, middleware, Sidebar, APK, `package.json` ou teste foi alterado nesta tarefa.
> **Data:** 2026-09-17
> **Base:** Auditoria `ALFA-011.0-AUDIT-VIP-30DIAS.md` (2026-09-16) + varredura do código real em 2026-09-17
> **Regra preservada:** `invite_codes` (validade do convite) permanece intacto; nova validade é do **acesso VIP**, contada a partir da concessão.

---

## Índice

1. [Estado atual](#1-estado-atual)
2. [Arquitetura futura](#2-arquitetura-futura)
3. [Modelo de dados proposto](#3-modelo-de-dados-proposto)
4. [Tipos de validade](#4-tipos-de-validade)
5. [Página administrativa](#5-pagina-administrativa)
6. [APIs administrativas](#6-apis-administrativas)
7. [Camada central de acesso](#7-camada-central-de-acesso)
8. [Proteção Full Premium](#8-protecao-full-premium)
9. [Fluxo futuro de vendas Pix](#9-fluxo-futuro-de-vendas-pix)
10. [Compatibilidade Web e APK](#10-compatibilidade-web-e-apk)
11. [Segurança](#11-seguranca)
12. [Plano incremental de sprints](#12-plano-incremental-de-sprints)
13. [Estratégia de migração](#13-estrategia-de-migracao)
14. [Matriz de testes](#14-matriz-de-testes)
15. [Pendências e decisões futuras](#15-pendencias-e-decisoes-futuras)

---

## 1. Estado atual

### 1.1 Tabela `invite_codes`

**Localização versionada:** não existe `CREATE TABLE public.invite_codes` no repositório. As 3 migrations versionadas são:

* `supabase/migrations/20250914000001_rls_hardening.sql` — habilita RLS e cria `invite_select_auth`
* `supabase/migrations/20250915000002_add_car_characteristic.sql:5` — `ADD COLUMN car_characteristic jsonb` em `user_state`
* `supabase/migrations/20250916000001_gpro_sponsors_select.sql` — RLS `gpro_sponsors`

A criação física de `invite_codes` foi feita manualmente via Dashboard Supabase (confirmado em `ALFA-011.0-AUDIT-VIP-30DIAS.md:23,27`). `supabase/migrations/20250914000001_rls_hardening.sql:9` apenas faz `alter table public.invite_codes enable row level security`.

**Campos atuais (inferidos de uso real):**

| Campo | Tipo inferido | Fonte | Observação |
|---|---|---|---|
| `id` | `uuid` PK | `app/actions/signup.ts:30` `select('id, code, is_used, created_at')` | Usado como `vip_invite_id` futuro |
| `code` | `text UNIQUE` ex `ALFA-A1B2-C3D4` | `app/actions/admin.ts:26-28` `ALFA-${part1}-${part2}` | 8 hex chars, sem `expires_at` |
| `is_used` | `boolean` | `app/actions/signup.ts:32` `eq('is_used', false)` / `app/actions/admin.ts:33` `insert({is_used:false})` | Única validade hoje: uso único |
| `created_at` | `timestamptz` | `app/actions/signup.ts:30` | Não usado como expiração |

Campos **ausentes:** `expires_at`, `used_by`, `used_at`, `created_by`, `invite_type`, `validity_*`, `is_revoked`, `description`, `metadata` — confirmado em `ALFA-011.0-AUDIT:41-43`.

### 1.2 Fluxo de geração

**Server Action:** `app/actions/admin.ts:12` `export async function generateNewInvite(userId: string)`

* `app/actions/admin.ts:6-10` — `supabaseAdmin` local via `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})` — não importa `app/lib/supabase-admin.ts`
* `app/actions/admin.ts:14-21` — verifica `supabaseAdmin.from('user_state').select('role').eq('user_id', userId).single()` → se `role !== 'admin'` retorna `Acesso negado`
* `app/actions/admin.ts:25-28` — `crypto.randomUUID().replace(/-/g,'').toUpperCase()` → `ALFA-XXXX-XXXX` (formato fixo)
* `app/actions/admin.ts:31-33` — `insert({code, is_used:false})` via `service_role` (bypass RLS)

**Componente:** `app/components/AdminInviteButton.tsx:1` `'use client'`

* `app/components/AdminInviteButton.tsx:9` `if (userRole !== 'admin') return null` — gating visual, barreira real é `admin.ts:20`
* `app/components/AdminInviteButton.tsx:18-31` — `supabase.auth.getUser()` (client `app/lib/supabase.ts`) → `generateNewInvite(user.id)` → `setGeneratedCode`
* `app/components/AdminInviteButton.tsx:42-54` — `copyToClipboard` + `wa.me/?text=`
* Uso: `app/dashboard/layout.tsx:352` `<AdminInviteButton userRole={localRole||''} />` no footer do Sidebar, visível quando `localRole==='admin'` (`layout.tsx:264` filter)

### 1.3 Fluxo de aceite

**Server Action:** `app/actions/signup.ts:17` `signUpWithInviteCode(formData: FormData)` — `'use server'`

* `app/actions/signup.ts:22-24` — valida `email/password/inviteCode` presentes
* `app/actions/signup.ts:28-33` — `select('id, code, is_used, created_at').eq('code', inviteCode).eq('is_used', false).single()` — sem `expires_at`
* `app/actions/signup.ts:40-45` — `supabaseAdmin.auth.admin.createUser({email, password, email_confirm:true, user_metadata:{invite_code:inviteCode}})`
* `app/actions/signup.ts:52-55` — `update({is_used:true}).eq('id', codeData.id)` — **não atômico** (race se 2 signups simultâneos)
* `app/actions/signup.ts:58-64` — `insert({user_id:userData.user.id, track:'Interlagos'})` em `user_state` — sem `access_plan`/`vip_*`

**Caller:** `app/login/page.tsx:8` `import { signUpWithInviteCode }`

* `app/login/page.tsx:49-83` — `handleSignUp` exige `inviteCode` (`required={!isLoginMode}` `:258`)
* `app/login/page.tsx:259-275` — input `inviteCode` visível só no Cadastro, `toUpperCase()`
* Login (`app/login/page.tsx:20-42`) não exige convite

### 1.4 Uso de `supabaseAdmin`

Definição canônica `app/lib/supabase-admin.ts:1` `import 'server-only'` + `app/lib/supabase-admin.ts:17` `createClient(URL, SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}})`.

Usos mapeados (55 ocorrências):

* `app/actions/signup.ts:6,28,40,52,59` — validação, `auth.admin.createUser`, `update is_used`, `insert user_state`
* `app/actions/admin.ts:6,14,31` — `select role` + `insert invite_codes`
* `app/lib/auth.ts:12,48` — `isAdmin` via `supabaseAdmin`
* `app/lib/gpro-token.ts:60,74,85`, `app/lib/db.ts:8`, `app/dashboard/admin/layout.tsx:20`, `app/api/gpro/sync/route.ts:390`, `app/api/python/[[...route]]/route.ts:337`, `app/api/market/update/route.ts:146` etc.

`admin.ts` e `signup.ts` recriam cliente local ao invés de importar `supabase-admin.ts` (duplicação funcional, evita `server-only` em alguns bundlers).

### 1.5 RLS atual

`supabase/migrations/20250914000001_rls_hardening.sql:114` (aditiva, idempotente):

* `sql:6-9` `enable row level security` em `user_state`, `api_knowledge_base`, `gpro_import_snapshots`, `invite_codes`
* `sql:24-39` `user_state_select_own/insert_own/update_own/delete_own` — `auth.uid()=user_id` para todas operações
* `sql:67-74` `invite_codes` — `create policy "invite_select_auth" for select using (auth.role()='authenticated')` — escrita só `service_role`
* `sql:104-111` `market_drivers` `for select using (true)` — leitura pública

Estado remoto pendente: `docs/ALFA-003-RELATORIO.md:9` indica migration local ainda não aplicada via Dashboard SQL Editor (sem `SUPABASE_ACCESS_TOKEN`, Docker indisponível para `supabase status`).

### 1.6 `user_state` e `role`

* `app/lib/db.ts:30` `interface UserState { role:'admin'|'user'; track; driver_static; driver_editable; ... }`
* `app/lib/db.ts:142-152` `getUserState` select explícito sem `gpro_token` (`:146` comentário `Fase 3.1 nunca selecionar token`)
* `app/lib/db.ts:157,212` default `role:'user'`
* `app/lib/db.ts:237-305` `saveUserState` via `upsert(payload,{onConflict:'user_id'})`
* Sem `vip_*`/`access_plan` — `ALFA-011.0-AUDIT:52`

### 1.7 Middleware

* `middleware.ts:4-6` `return await updateSession(request)` + `config.matcher: '/((?!_next/static|...).*)'`
* `utils/supabase/middleware.ts:30` `await supabase.auth.getUser()` — comenta `Não bloqueia por erro de auth; apenas atualiza sessão`
* Proteção real é `requireAuth`/`requireAdmin` por API, não middleware.

**Admin layout:** `app/dashboard/admin/layout.tsx:10-27` — `supabase.auth.getUser()` → `supabaseAdmin.from('user_state').select('role')` → `redirect('/dashboard?error=admin_required')` se `!==admin`

### 1.8 `requireAuth` / `requireAdmin`

`app/lib/auth.ts:9` `import 'server-only'`

* `auth.ts:23` `getAuthenticatedUser()` → `createClient().auth.getUser()` → `null` se `error`
* `auth.ts:33` `requireAuth()` → `401`
* `auth.ts:47` `isAdmin(userId)` → `supabaseAdmin.from('user_state').select('role')` → `role==='admin'`
* `auth.ts:61` `requireAdmin()` → `requireAuth + isAdmin` → `403`
* `auth.ts:77` `resolveUserId(requestedUserId)` → IDOR `403` se `requestedUserId !== auth.id`

Cobertura atual (grep):

* `requireAuth` — `app/api/gpro/token:8,20,43`, `app/api/gpro/sync:387`, `app/api/python:271,386`, `app/api/market/update:92`, `app/api/manager/profile:117`, `app/api/calendar:256`
* `requireAdmin` — `app/api/admin/gpro-kb:28`, `app/api/gpro-kb/explore:71`, `app/api/admin/research/*:26,46,52`

### 1.9 APIs que futuramente precisarão validar Full Premium

Mapeadas em `ALFA-011.0-AUDIT:58,234`:

| API | Arquivo | Auth atual | Futuro `requireVip` |
|---|---|---|---|
| `POST /api/gpro/sync` | `app/api/gpro/sync/route.ts:387` | `resolveUserId` | `requireVip` após `requireAuth` |
| `GET/POST /api/python` (6 actions) | `app/api/python/[[...route]]/route.ts:271,386` | `requireAuth/resolveUserId` | `requireVip` |
| `GET /api/calendar` | `app/api/calendar/route.ts:256` | `resolveUserId` | `requireVip` |
| `GET /api/manager/profile` | `app/api/manager/profile/route.ts:117` | `resolveUserId` | `requireVip` |
| `POST /api/market/update` | `app/api/market/update/route.ts:92` | `requireAuth` | `requireVip` |
| `GET/POST /api/gpro/token` | `app/api/gpro/token/route.ts:8,20,43` | `requireAuth` | `requireVip` (avaliar se GET `hasToken` permanece público) |
| Públicas | `GET tracks, tyre_suppliers` | sem auth | manter público |
| Admin | `app/api/admin/*` + `gpro-kb/explore` | `requireAdmin` | skip se `isAdmin` |

### 1.10 Relação com Web e APK

* `capacitor.config.ts:4,7` — `appId:'br.com.gproalfaracing'`, `server:{url:'https://gpro-alfa-racing.vercel.app'}` — APK não empacota backend, usa mesmo Vercel prod.
* `docs/ALFA-001-APK-STRATEGY.md:38,82` — `generateNewInvite` e `/dashboard/admin/*` exclusivos Web, não embarcados no APK (`requireAdmin` retornará 403 no APK se tentado)
* `ALFA-011.0-AUDIT:164-174` — VIP deve ser server-side para valer igual Web/APK. Login sucede mesmo expirado, mas `requireVip` bloqueia `get_state/sync` → tela expirada pós-login. Offline: APK cache `vip_expires_at` e bloqueia localmente se `cached <= now()`.

### 1.11 O que não existe hoje

Verificado via grep `very thorough` (2026-09-17):

* `premium_plans`, `access_grants`, `access_events`, `orders`, `payments`, `payment_id` — 0 ocorrências fora de `ALFA-011.0-AUDIT`
* `app/lib/access` / `accessService` — inexistente (`Glob app/lib/**` 34 arquivos, nenhum `access*`)
* `vip_*`/`access_plan` — apenas em `ALFA-011.0-AUDIT` (9-12 ocorrências), zero em `app/lib/*`, `supabase/migrations/*`, `app/api/*`

---

## 2. Arquitetura futura

### 2.1 Separação de conceitos

```
Convite          → credencial de entrada (quem convidou, quanto vale, quando expira o convite)
Pedido (Order)   → intenção de compra (usuário escolheu plano, valor, status pending/paid/cancelled)
Pagamento        → tentativa concreta via gateway (Pix txid, QR, status pending/paid/expired/refunded)
Concessão        → fato imutável de que acesso foi concedido (access_grants: user_id, plan, started_at, expires_at, source)
Estado atual     → cache derivado em user_state (vip_started_at, vip_expires_at, access_plan) para leitura rápida
Histórico        → trilha auditável em access_events (granted, renewed, revoked, expired, lifetime)
```

```
[invite_codes] ──1:N──> [access_grants] <──1:1── [user_state cache]
                              ^
[premium_plans] ──1:N──> [orders] ──1:N──> [payments] ─┘
                              |
                      [access_events] (append-only)
```

### 2.2 Por que não usar apenas `user_state` como histórico

`user_state` é **mutável** (`upsert` em `app/lib/db.ts:237`), guarda apenas **último estado** (sobrescreve `vip_expires_at`), não preserva **quem concedeu**, **quando**, **por qual convite/pagamento**, **por quanto tempo**, **se foi renovação ou revogação**. Exigências 5,6,7,8,16,17 exigem trilha imutável.

* `user_state` → leitura rápida (`getUserState` já centralizada, 1 query, sem join), ideal para `requireVip` e UI.
* `access_grants` → fonte histórica oficial (append, nunca `UPDATE` do período já concedido; revogação cria novo registro com `revoked_at`, não apaga anterior).
* `access_events` → auditoria fina (ex: `previous_expires_at → new_expires_at`, `admin_id`, `reason`).

Sem `access_grants`, renovação de VIP ativo perderia data anterior; sem `access_events`, Pix duplicado não teria `raw_event_hash` para idempotência.

### 2.3 Fluxo de leitura

1. `requireVip` consulta `access_grants` ativo (`status='active' AND (expires_at IS NULL OR expires_at > now())` ordenado por `expires_at DESC NULLS FIRST`) via `supabaseAdmin`.
2. Sincroniza `user_state` se divergente (lazy sync) — `user_state` é **cache**, não fonte.
3. Frontend lê `user_state.vip_expires_at` apenas para exibir banner; bloqueio real é server-side.

---

## 3. Modelo de dados proposto

### 3.1 `invite_codes` — evoluir, não recriar

**Campos atuais preservados:** `id, code, is_used, created_at`

**Novos campos possíveis (todos nullable, aditivos):**

```sql
invite_type    text        -- 'vip' | 'lifetime' | null (default 'vip')
access_plan    text        -- 'full_premium' (fixo por regra 1, mas coluna permite evoluir)
validity_type  text        -- 'fixed_days' | 'until_date' | 'lifetime'
validity_days  integer     -- 7 | 30 | 60 | 90 | null (quando until_date/lifetime)
expires_at     timestamptz -- validade DO CONVITE (regra 4: não confundir com validade do acesso)
created_by     uuid references auth.users(id)
used_by        uuid references auth.users(id)
used_at        timestamptz
is_revoked     boolean default false
revoked_at     timestamptz
revoked_by     uuid references auth.users(id)
description    text
metadata       jsonb       -- ex: {campaign:"lobo-alfa-2026", notes:"..."}
```

**Chaves/índices:**

* `code UNIQUE` (já existe), `code` índice `btree` para `eq('code', ...)`
* `expires_at` índice `btree` para varredura de expirados
* `used_by`, `created_by` índices `btree` para auditoria
* `is_revoked` parcial `where is_revoked=true`

**Sensíveis:** nenhum financeiro; `metadata` nunca conter Pix.

**Não editável pelo cliente:** todos novos campos — escrita só `service_role` (RLS `invite_codes` já sem `insert/update` para `authenticated` em `sql:73`).

**Compatibilidade:** aditivo nullable → registros existentes continuam `is_used=false/true` sem `expires_at` (convite perpétuo até uso, que é comportamento atual). Backfill: `invite_type='vip'`, `validity_type='fixed_days'`, `validity_days=30` apenas em documentação, não no banco (evita assumir intenção do criador).

**Riscos migration:** `ADD COLUMN IF NOT EXISTS` é seguro; `NOT NULL` quebraria existentes → manter `NULL`. `REFERENCES` sem `NOT NULL` não valida existentes. Recomendar `NOTIFY pgrst, 'reload schema'` como em `20250915000002`.

**Pode ser adiada?** Não — é base da ALFA-011.1. Sem ela, não há convites configuráveis.

### 3.2 `access_grants` — proposta (necessária)

```sql
create table public.access_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  access_plan     text not null check (access_plan in ('full_premium')),
  access_source   text not null check (access_source in ('invite','payment','admin','migration')),
  started_at      timestamptz not null default now(),
  expires_at      timestamptz, -- NULL = vitalício
  status          text not null check (status in ('active','expired','revoked','lifetime')) default 'active',
  invite_id       uuid references public.invite_codes(id) on delete set null,
  payment_id      uuid references public.payments(id) on delete set null,
  created_by      uuid references auth.users(id), -- admin que concedeu (ou null se Pix)
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id),
  revoke_reason   text,
  metadata        jsonb
);
create index on public.access_grants (user_id, status, expires_at);
create index on public.access_grants (expires_at) where status='active';
```

**Relacionamentos:** `user_id` → `auth.users`, `invite_id` → `invite_codes`, `payment_id` → `payments`.

**Sensíveis:** `revoke_reason` pode conter motivo interno — não expor ao cliente sem filtro.

**Não editável pelo cliente:** toda tabela — RLS `enable` + `for select using (auth.uid()=user_id)` para leitura própria, **sem** `insert/update/delete` para `authenticated` — escrita só `service_role`.

**Compatibilidade:** tabela nova, sem impacto em existentes. Migração de VIPs legados (se houver `user_state.vip_*` pós-ALFA-011.0) deve inserir 1 `access_grants` por usuário via backfill script server-side (idempotente, `where not exists`).

**Risco:** sem `access_grants`, `user_state` vira única fonte e perde histórico (viola regras 6,7,8,16). Adiar além de ALFA-011.2 aumenta retrabalho.

**Pode ser adiada?** Parcialmente — pode começar com `user_state` cache na ALFA-011.1 e adicionar `access_grants` na ALFA-011.2, mas recomendado já na `.1` como tabela vazia (sem leitura obrigatória) para evitar re-migração.

### 3.3 `premium_plans` — proposta (adiável até ALFA-011.6)

```sql
create table public.premium_plans (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null, -- ex: 'vip-7d','vip-30d','vip-lifetime'
  name            text not null,
  description     text,
  access_plan     text not null default 'full_premium',
  validity_type   text not null check (validity_type in ('fixed_days','until_date','lifetime')),
  validity_days   integer, -- 7/30/60/90 ou null
  price_cents     integer not null check (price_cents >= 0),
  currency        text not null default 'BRL',
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.premium_plans (is_active, display_order);
```

**Relacionamentos:** `premium_plans.id` → `orders.product_id`.

**Sensíveis:** `price_cents` é exibido (não sensível), mas `is_active` controla venda.

**Não editável:** só `service_role` escreve; `authenticated` `select where is_active=true`.

**Compatibilidade:** tabela nova, sem impacto. Seed inicial pode ser via migration `insert` com `on conflict slug do nothing`.

**Pode ser adiada?** Sim — até sprints de vendas (ALFA-011.6). Convites VIP não precisam de `premium_plans`.

### 3.4 `orders` — proposta (adiável até ALFA-011.7)

```sql
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_id        uuid references public.premium_plans(id) on delete set null,
  amount_cents      integer not null,
  status            text not null check (status in ('pending','paid','cancelled','expired')) default 'pending',
  provider          text not null, -- ex: 'mercadopago','pagarme','gerencianet'
  provider_order_id text, -- id no gateway
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  metadata          jsonb
);
create index on public.orders (user_id, status);
create unique index on public.orders (provider, provider_order_id) where provider_order_id is not null;
```

**Pode ser adiada?** Sim — até Pix. Convites não precisam.

### 3.5 `payments` — proposta (adiável até ALFA-011.7)

```sql
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  provider            text not null,
  provider_payment_id text, -- id do pagamento no gateway
  pix_txid            text, -- TXID Pix (único por cobrança)
  amount_cents        integer not null,
  status              text not null check (status in ('pending','paid','expired','refunded','cancelled')) default 'pending',
  qr_code             text, -- base64 ou URL — sensível, não expor raw
  qr_code_text        text, -- copia-e-cola — sensível
  expires_at          timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  raw_event_hash      text unique -- sha256 do payload bruto para idempotência (regra 16)
);
create unique index on public.payments (pix_txid) where pix_txid is not null;
create index on public.payments (order_id, status);
```

**Sensíveis:** `qr_code`, `qr_code_text`, `raw_event_hash` — nunca expor integral ao frontend (regra 17). Frontend recebe apenas `qr_code` temporário e `status`.

**Não editável:** só `service_role` escreve; `authenticated` pode `select` onde `user_id=auth.uid()` para `status` (sem `raw`).

**Pode ser adiada?** Sim — até integração Pix.

### 3.6 `access_events` — proposta (necessária com `access_grants`)

```sql
create table public.access_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  invite_id           uuid references public.invite_codes(id) on delete set null,
  access_grant_id     uuid references public.access_grants(id) on delete set null,
  payment_id          uuid references public.payments(id) on delete set null,
  admin_id            uuid references auth.users(id) on delete set null,
  event_type          text not null check (event_type in ('granted','renewed','revoked','expired','lifetime','payment_confirmed')),
  previous_expires_at timestamptz,
  new_expires_at      timestamptz, -- NULL = vitalício
  reason              text,
  created_at          timestamptz not null default now(),
  metadata            jsonb
);
create index on public.access_events (user_id, created_at desc);
create index on public.access_events (access_grant_id);
```

**Pode ser adiada?** Não além de ALFA-011.4 — renovação/revogação/vitalício e Pix idempotente exigem histórico.

---

## 4. Tipos de validade

### 4.1 Definições

| Tipo | `validity_type` | `validity_days` | `expires_at` do convite | `expires_at` do acesso |
|---|---|---|---|---|
| `fixed_days` | `fixed_days` | `7,30,60,90` | `created_at + validity_days` (validade do convite) | `started_at + validity_days` (regra 3) |
| `until_date` | `until_date` | `null` | data personalizada absoluta | `until_date` absoluta (ex: `2026-12-31T23:59:59Z`) |
| `lifetime` | `lifetime` | `null` | `null` (nunca expira) | `null` + `status='lifetime'` (regra 9) |

**Diferença crítica (regra 4):** `invite_codes.expires_at` = até quando o **convite** pode ser aceito. `access_grants.expires_at` / `user_state.vip_expires_at` = até quando o **acesso** é válido. São colunas distintas.

### 4.2 Comportamentos

| Estado | Condição | Efeito |
|---|---|---|
| **Convite disponível** | `is_used=false AND is_revoked=false AND (expires_at IS NULL OR expires_at > now())` | Aceito via `signUpWithInviteCode` ou `POST /api/admin/vip-invites/[id]/renew` |
| **Convite aceito** | `is_used=true` → `used_by, used_at` preenchidos | `access_grants` criado, `user_state` sincronizado, convite nunca reutilizável (regra 5) e nunca editável (regra 6) |
| **Convite expirado** | `expires_at <= now() AND is_used=false` | `409 INVITE_EXPIRED` ao tentar aceitar |
| **Convite revogado** | `is_revoked=true` | `409 INVITE_REVOKED`, não pode ser aceito mesmo se `is_used=false`; revogação não apaga `access_grants` já concedidos (só impede novos) |
| **VIP ativo** | `expires_at IS NULL (lifetime) OR expires_at > now()` | `requireVip` 200 |
| **VIP expirado** | `expires_at <= now()` | `403 VIP_EXPIRED`, login permitido (regra 12), mas APIs protegidas bloqueadas (regra 13) |
| **VIP vitalício** | `expires_at IS NULL AND status='lifetime'` | `requireVip` sempre 200, mesmo sem `expires_at` |
| **Renovação de VIP ativo** | Admin `POST .../renew` com novo `expires_at` | `new_expires_at = GREATEST(now(), previous_expires_at) + days` (ou `until_date`/`NULL` se lifetime) — não perde dias restantes |
| **Renovação de VIP expirado** | Mesmo endpoint | `new_expires_at = now() + days` — reativa a partir de agora |

Regras 7,8,9: admin pode renovar, revogar, tornar vitalício — sempre via `access_grants` + `access_events`, nunca edição direta de `user_state` pelo cliente.

---

## 5. Página administrativa

**Rota:** `app/dashboard/admin/vip-invites/page.tsx` (nova, protegida por `app/dashboard/admin/layout.tsx:26` `role !== 'admin'`)

> **Nota:** `AdminInviteButton` (`app/dashboard/layout.tsx:352`) permanece como **atalho** (`Link href="/dashboard/admin/vip-invites"`), não como gerenciador completo.

### 5.1 Layout

* **Cards de resumo** (4): `Total convites` | `Ativos` (`is_used=false, is_revoked=false, expires_at > now()`) | `VIPs ativos` (`access_grants status=active`) | `Vitalícios` (`status=lifetime`) — cada card com `count` via `supabaseAdmin` count head
* **Tabela:** colunas `Código` (mascarado `ALFA-****-****` com olho), `Tipo` (`invite_type`), `Validade` (`7d/30d/lifetime/2026-12-31`), `Status` badge (`disponível/usado/expirado/revogado`), `Criado por`, `Usado por`, `Criado em`, `Ações` (copiar, detalhes, revogar)
* **Busca:** `code ILIKE %query%` + `description ILIKE`
* **Filtros:** `status` (todos/disponível/usado/expirado/revogado), `validity_type` (todos/fixed/until/lifetime), `invite_type`, `período` (created_at range)
* **Paginação:** `limit 20` com cursor `created_at`

### 5.2 Criação

Modal `Criar convite VIP`:

* Campos: `validity_type` radio (`7 dias / 30 dias / 60 dias / 90 dias / Data personalizada / Vitalício`), `expires_at` (se `until_date`), `description` textarea, `invite_type` select (default `vip`)
* Ao confirmar: `POST /api/admin/vip-invites` → retorna `code` → toast + card `Código gerado` com `Copiar` + `WhatsApp` (reuso de `AdminInviteButton.tsx:42` pattern)
* Validação: `validity_days` obrigatório se `fixed_days`, `expires_at > now()` se `until_date`, `price` não aqui (só em `premium_plans`)

### 5.3 Detalhes

Drawer ao clicar linha: `GET /api/admin/vip-invites/[id]` → mostra `code` completo (só admin), `created_by`, `used_by`, `used_at`, `is_revoked`, `access_grants` vinculados, `access_events` timeline.

### 5.4 Ações

* **Copiar código:** `navigator.clipboard.writeText(code)` + toast (igual `AdminInviteButton.tsx:33`)
* **Renovação:** `POST /api/admin/vip-invites/[id]/renew` com body `{validity_type, validity_days, until_date, reason}` → modal confirma `Estender de {prev} para {next}?`
* **Revogação:** `POST /api/admin/vip-invites/[id]/revoke` com `reason` → confirmação `Revogar convite ALFA-****? Isso não revoga acessos já concedidos.` + segunda confirmação se `is_used=true` (revoga convite, não acesso; para revogar acesso usar revoke do grant)
* **Tornar vitalício:** `PATCH /api/admin/vip-invites/[id]` com `{validity_type:'lifetime'}` ou `POST .../renew {validity_type:'lifetime'}` → confirmação `Tornar vitalício? Não poderá ser desfeito sem revogação.`
* **Histórico:** `GET /api/admin/vip-invites/[id]/history` renderiza timeline `access_events` (`granted → renewed → revoked`)

### 5.5 Estados

* **Vazio:** `Nenhum convite ainda. Crie o primeiro VIP.`
* **Loading:** skeleton table + shimmer cards
* **Erros:** `403 admin_required` → redirect `/dashboard?error=admin_required` (já em `admin/layout.tsx:26`), `409 INVITE_REVOKED`, `500` com retry
* **Confirmações:** `Dialog` com `reason` input para `revoke/renew/lifetime` (audit trail)

### 5.6 Proteção

* Server Component `admin/layout.tsx` + `requireAdmin` em cada API — Web exclusiva, papel `admin` (`docs/ALFA-001-APK-STRATEGY.md:38`). APK nunca acessa (regra 18).

---

## 6. APIs administrativas

Todas sob `app/api/admin/vip-invites` — padrão `app/api/admin/gpro-kb/route.ts:28` `await requireAdmin()`.

### 6.1 `GET /api/admin/vip-invites`

* **Objetivo:** listar convites com filtros
* **Método:** `GET`
* **Entrada:** query `?q=&status=&validity_type=&invite_type=&from=&to=&limit=20&cursor=`
* **Saída:** `{items: InviteRow[], nextCursor, total}`
* **Permissão:** `requireAdmin` (`403` se não admin)
* **Validações:** `limit <= 100`, `validity_type` enum, datas ISO
* **Erros:** `401`, `403`, `400 invalid params`
* **IDOR:** não há `user_id` client — admin vê todos; sem `resolveUserId`
* **Cliente Supabase:** `supabaseAdmin` (bypass RLS, mas já `requireAdmin`)
* **Transacional:** não

### 6.2 `POST /api/admin/vip-invites`

* **Objetivo:** criar convite configurável
* **Entrada:** `{invite_type:'vip', validity_type:'fixed_days'|'until_date'|'lifetime', validity_days?:7|30|60|90, until_date?:ISO, description?:string}`
* **Saída:** `{id, code, expires_at, validity_type}`
* **Permissão:** `requireAdmin`
* **Validações:** `validity_days` ∈ `7,30,60,90` se `fixed_days`; `until_date > now()` se `until_date`; `description` max 280
* **Erros:** `400`, `401`, `403`, `500 insert failed`
* **IDOR:** `created_by = auth.id` server-side, nunca client
* **Cliente:** `supabaseAdmin` `insert`
* **Transacional:** `insert invite_codes + insert access_events {event_type:'granted', created: invite_id}` em transação (ou 2 inserts sequenciais com rollback se segundo falhar)

### 6.3 `GET /api/admin/vip-invites/[id]`

* **Objetivo:** detalhes + grants vinculados
* **Saída:** `{invite, grants: AccessGrant[], events: AccessEvent[]}`
* **Permissão:** `requireAdmin`
* **Erros:** `404`, `401`, `403`
* **Validações:** `id` uuid
* **Transacional:** não

### 6.4 `PATCH /api/admin/vip-invites/[id]`

* **Objetivo:** editar `description/metadata` ou tornar vitalício (não altera `code/is_used/used_by` se já usado — regra 6)
* **Entrada:** `{description?, metadata?, validity_type?:'lifetime'}` — nunca `code/is_used/used_by`
* **Saída:** `{invite}`
* **Permissão:** `requireAdmin`
* **Validações:** se `is_used=true` rejeita `validity_type` != `lifetime` com `409 INVITE_ALREADY_USED`
* **Erros:** `400`, `404`, `409`
* **Transacional:** `update invite + insert event` se lifetime

### 6.5 `POST /api/admin/vip-invites/[id]/renew`

* **Objetivo:** renovar/estender acesso do usuário vinculado ao convite (regra 7)
* **Entrada:** `{validity_type, validity_days, until_date, reason}`
* **Saída:** `{grant, previous_expires_at, new_expires_at}`
* **Permissão:** `requireAdmin`
* **Validações:** convite `is_used=true` (renova grant, não convite); `reason` obrigatório
* **Erros:** `404`, `409 INVITE_NOT_USED`, `400`
* **IDOR:** `admin_id = auth.id`
* **Transacional:** **sim** — `select grant for update → calculate new_expires_at → update access_grants → update user_state cache → insert access_events` (idempotente via `reason` + timestamp não duplicar se mesmo `new_expires_at` em <60s)

### 6.6 `POST /api/admin/vip-invites/[id]/revoke`

* **Objetivo:** revogar convite (regra 8) e opcionalmente acesso concedido
* **Entrada:** `{revoke_grant?:boolean, reason}`
* **Saída:** `{invite, grant?}`
* **Permissão:** `requireAdmin`
* **Validações:** `reason` obrigatório
* **Erros:** `404`, `409 ALREADY_REVOKED`
* **Transacional:** **sim** — `update invite_codes set is_revoked=true, revoked_at=now(), revoked_by=auth.id` + se `revoke_grant` então `update access_grants set status='revoked', revoked_at=now()` + `update user_state set vip_expires_at=null` + `insert events`

### 6.7 `GET /api/admin/vip-invites/[id]/history`

* **Objetivo:** timeline auditável
* **Saída:** `{events: AccessEvent[]}` ordenado `created_at desc`
* **Permissão:** `requireAdmin`
* **Transacional:** não

---

## 7. Camada central de acesso

**Arquivo proposto:** `app/lib/access/accessService.ts` — `import 'server-only'`

**Responsabilidade:** única fonte para conceder, consultar, renovar, revogar e calcular expiração. Toda API e server action deve chamar este serviço em vez de escrever `user_state` diretamente.

```ts
// app/lib/access/accessService.ts (proposta)
export async function grantAccess(params: {
  userId: string; accessPlan: 'full_premium';
  validityType: 'fixed_days'|'until_date'|'lifetime';
  validityDays?: number; untilDate?: string;
  source: 'invite'|'payment'|'admin'; inviteId?: string; paymentId?: string;
  createdBy?: string;
}): Promise<AccessGrant>

export async function getEffectiveAccess(userId: string): Promise<{
  hasFullPremium: boolean; isLifetime: boolean; expiresAt: string|null; grant: AccessGrant|null;
}>

export async function hasFullPremium(userId: string): Promise<boolean>
export async function renewAccess(params: { userId: string; validityType; validityDays?; untilDate?; reason: string; adminId: string }): Promise<AccessGrant>
export async function revokeAccess(params: { userId: string; grantId: string; reason: string; adminId: string }): Promise<void>
export function calculateExpiration(input: { validityType; validityDays?; untilDate?; from?: Date }): Date|null // null = lifetime
export async function recordAccessEvent(event: AccessEventInput): Promise<void>
```

**Sincronização `user_state`:**

* `access_grants` é fonte; `user_state` (`vip_started_at`, `vip_expires_at`, `vip_invite_id`, `access_plan`) é **cache** para `getUserState` rápido.
* Após `grantAccess/renewAccess/revokeAccess`, serviço faz `supabaseAdmin.from('user_state').upsert({user_id, access_plan, vip_started_at: grant.started_at, vip_expires_at: grant.expires_at, vip_invite_id: grant.invite_id}, {onConflict:'user_id'})` — nunca client escreve.
* `getEffectiveAccess` pode fazer lazy sync se `user_state.vip_expires_at` divergir de `access_grants` (ex: backfill pendente).

**Onde registrar VIP hoje:** `app/actions/signup.ts:59` `insert user_state` é o ponto exato futuro — trocar para `await grantAccess({userId: newUser.id, validityType:'fixed_days', validityDays:30, source:'invite', inviteId: codeData.id})` dentro da mesma server action, server-side, `now()` calculado no serviço (regra 3).

---

## 8. Proteção Full Premium

**Helper proposto:** `app/lib/auth.ts: requireVip()` (ao lado de `requireAuth:33`/`requireAdmin:61`)

```ts
// app/lib/auth.ts (adição proposta)
export async function requireVip(): Promise<AuthUser> {
  const user = await requireAuth(); // 401 se não logado (regra 12: login sempre permitido)
  if (await isAdmin(user.id)) return user; // regra 11: admin nunca bloqueado
  const access = await getEffectiveAccess(user.id); // via supabaseAdmin, bypass RLS
  if (!access.hasFullPremium) { const e:any=new Error('VIP requerido'); e.status=403; e.code='VIP_REQUIRED'; throw e; }
  if (access.expiresAt && new Date(access.expiresAt) <= new Date()) {
    const e:any=new Error('VIP expirado'); e.status=403; e.code='VIP_EXPIRED'; throw e;
  }
  return user; // vitalício (expiresAt null) cai aqui como permitido
}
```

**Comportamentos:**

```
admin                    → permitido (bypass)
Full Premium vitalício   → permitido (expiresAt null)
Full Premium válido      → permitido (expiresAt > now())
VIP expirado             → 403 {code:'VIP_EXPIRED'}
sem acesso               → 403 {code:'VIP_REQUIRED'}
não autenticado          → 401 (requireAuth)
```

**APIs reais que exigirão `requireVip` (não aplicar nesta tarefa, apenas mapear):**

* `app/api/gpro/sync/route.ts:387` — `POST /api/gpro/sync`
* `app/api/python/[[...route]]/route.ts:271,386` — `GET tracks` permanece público, resto (`get_state`, `update_state`, `setup_calculate`, `strategy_calculate`, `performance`, `planning_calculate`, `get_planning/save_planning`) → `requireVip`
* `app/api/calendar/route.ts:256` — `GET /api/calendar?userId=` → `requireVip` quando `userId` presente
* `app/api/manager/profile/route.ts:117` — `GET /api/manager/profile`
* `app/api/market/update/route.ts:92` — `POST /api/market/update` (GET lista permanece público `market_drivers` `select using true` em `sql:107`)
* `app/api/gpro/token/route.ts:8,20,43` — `GET hasToken`/`POST setGproToken`/`DELETE` — avaliar manter `GET hasToken` sem `requireVip` para exibir aviso, resto com `requireVip`

**Bloqueio:** no servidor e nas APIs protegidas (regra 13) — nunca só no client. Frontend (`app/dashboard/layout.tsx`, `GameContext`) apenas exibe `403` como tela `VipExpired.tsx`.

---

## 9. Fluxo futuro de vendas Pix

### 9.1 Fluxo ponta a ponta

```
Usuário escolhe plano (premium_plans is_active=true)
  → POST /api/payments/orders {planSlug} → orders {status:pending} + payments {status:pending, pix_txid, qr_code, expires_at}
  → QR Code exibido (qr_code + qr_code_text copia-e-cola)
  → pagamento realizado no banco
  → webhook recebido POST /api/payments/webhook (raw body preservado, hash sha256 → raw_event_hash)
  → webhook validado (assinatura HMAC com secret do gateway)
  → consulta direta ao gateway (GET /payments/{txid}) para confirmar amount/status
  → pagamento confirmado (payments status=paid, orders status=paid, paid_at=now())
  → acesso concedido via grantAccess({source:'payment', paymentId, validity do plano}) → access_grants + user_state sync + access_events
  → histórico registrado (access_events payment_confirmed)
```

### 9.2 APIs futuras

| Método | Rota | Objetivo | Auth |
|---|---|---|---|
| `POST` | `/api/payments/orders` | criar pedido + cobrança Pix | `requireAuth` |
| `GET` | `/api/payments/orders/[id]` | consultar pedido (sem `raw`) | `requireAuth` + `order.user_id === auth.id` |
| `GET` | `/api/payments/[id]/status` | polling status `pending/paid/expired` | `requireAuth` + `payment.user_id === auth.id` |
| `POST` | `/api/payments/webhook` | receber confirmação do gateway — **sem** `requireAuth`, com validação HMAC | `x-signature` header |

### 9.3 Detalhes

* **Gateway:** não escolhido nesta tarefa — comparar Mercado Pago, Pagar.me, Gerencianet/Efi. Critérios: QR dinâmico com `txid`, expiração configurável, webhook HMAC, consulta `GET /pix/{txid}`, taxa Pix, suporte `BRL`, `BRL` único (`premium_plans.currency`). Registrar decisão como pendência (seção 15).
* **Pedido:** `orders.amount_cents` snapshot do `premium_plans.price_cents` no momento da criação (preço pode mudar depois sem afetar pedido).
* **Pagamento:** `payments.pix_txid` único por cobrança (gateway gera ou Lobo Alfa gera `txid` = `ALFA-{uuid}` com `is_unique` check).
* **QR Code:** `payments.qr_code` (base64) e `qr_code_text` (BR Code) — exibidos temporariamente, depois `null` ou expirados (`expires_at` do Pix, ex: 30 min).
* **Status:** `pending → paid | expired | cancelled | refunded` — `expired` quando `payments.expires_at <= now()` sem confirmação.
* **Assinatura webhook:** `HMAC-SHA256(raw_body, WEBHOOK_SECRET)` comparado com `x-signature` header — rejeita `401` se inválida (regra 15).
* **Consulta direta:** mesmo com webhook válido, fazer `GET gateway/pix/{txid}` para confirmar `status=paid` e `amount_cents` — evita webhook falso.
* **Idempotência (regra 16):** `raw_event_hash = sha256(raw_body)` `UNIQUE` em `payments` — segundo `POST /webhook` com mesmo hash retorna `200 already_processed` sem novo `grantAccess`.
* **Valor divergente:** se `gateway.amount_cents !== orders.amount_cents` → `422 AMOUNT_MISMATCH`, não concede, registra `access_events` com `reason:'amount_mismatch'`, admin investiga.
* **Pagamento duplicado:** idempotência acima; se `orders.status='paid'` e novo `paid` chegar, retorna `200`.
* **Estorno:** `payments.status='refunded'` → `access_grants` permanece? Regra a definir: pode `revokeAccess` com `reason:'refund'` se política for revogar (listar em pendências).
* **Cancelamento:** `orders.status='cancelled'` via `POST /api/payments/orders/[id]/cancel` (antes de pagar) → `payments` cancelados.
* **Pagamento expirado:** `payments.expires_at <= now()` sem `paid` → `expired`, usuário pode criar novo `order`.

### 9.4 Conteúdo bruto e dados sensíveis

Regra 17: `raw_body` nunca exposto ao frontend; `qr_code` exposto apenas ao `user_id` dono do `order` e por tempo limitado; `provider_payment_id`, `pix_txid`, `raw_event_hash` não listados em `GET /api/payments/orders` público — apenas `status`, `amount_cents`, `expires_at`.

---

## 10. Compatibilidade Web e APK

### 10.1 Web Admin (exclusivo Web, papel `admin`)

* Convites: `GET/POST /api/admin/vip-invites` + `.../[id]/renew|revoke|history` — só Web (`app/dashboard/admin/layout.tsx:26`), nunca APK (regra 18)
* Planos: `premium_plans` CRUD admin (`is_active`, `price_cents`, `display_order`) — Web
* Vendas: `orders`/`payments` listagem admin com filtros `status/provider`
* Pagamentos: `webhook` admin log (sem expor `raw`)
* Auditoria: `access_events` timeline por usuário

### 10.2 Web do usuário

* Login: `supabase.auth.signInWithPassword` (`app/login/page.tsx:20`) sempre permitido (regra 12), mesmo expirado — não bloqueia `auth`
* Manager: `app/dashboard/manager/page.tsx` e `app/api/manager/profile` protegidos por `requireVip` — se `VIP_EXPIRED`, exibe `components/VipExpired.tsx` com `Renovar` CTA
* Status Premium: `GameContext` lê `user_state.vip_expires_at` via `getUserState` (`app/lib/db.ts:142`) para banner `Expira em 3 dias`
* Expiração: `403 VIP_EXPIRED` de qualquer API gerente deve redirecionar para tela expirada (não logout)
* Pagamento futuro: `app/dashboard/vip/page.tsx` (nova) — escolha `premium_plans` → `orders` → QR → polling `GET /api/payments/[id]/status`

### 10.3 APK (`capacitor.config.ts:7`)

* Login: idêntico Web — `server.url` aponta para mesmo backend, `supabase.auth` compartilhado
* Manager: mesmas APIs `requireVip` — APK recebe `403` igual Web
* Full Premium: validado server-side, não no APK
* Status de acesso: `GameContext` no APK lê mesmo `user_state` — cache local `vip_expires_at` para modo offline (se `cached <= now()` bloqueia Manager mesmo sem rede, revalida ao voltar online)
* Aviso de expiração: banner nativo igual Web
* Nenhuma área administrativa: `app/dashboard/admin/**` não embarcado ou `requireAdmin` retorna `403` (regra 18, `docs/ALFA-001-APK-STRATEGY.md:38`)

---

## 11. Segurança

| Risco | Origem | Impacto | Mitigação proposta |
|---|---|---|---|
| **RLS `user_state_update_own` permissivo** | `supabase/migrations/20250914000001_rls_hardening.sql:33` `using (auth.uid()=user_id)` permite `update role/vip_*` | Usuário vira `admin` ou `vip_expires_at='2099-01-01'` via `supabase.from('user_state').update(...)` | Sem `update` para `authenticated` em `vip_*`/`role`/`access_plan` — só `service_role` escreve; `select_own` mantém leitura; implementar via 2 policies `FOR UPDATE USING (false)` para `authenticated` em colunas sensíveis ou trigger `BEFORE UPDATE` que `RAISE EXCEPTION` se `NEW.role != OLD.role` e `auth.role()='authenticated'` |
| **`role` alterável** | `app/lib/db.ts:31` `role` sem RLS coluna-level | `update({role:'admin'})` | Mesmo acima + `isAdmin` sempre via `supabaseAdmin` (já é) |
| **`access_plan`/`vip_*` alterável** | futuro `user_state` cols | `update({vip_expires_at: far})` | Idem — só `app/lib/access/accessService.ts` via `supabaseAdmin` |
| **`vip_invite_id`/`invite_id`/`payment_id` forjado** | `resolveUserId` não cobre `invite_id` | Usuário tenta `POST /api/admin/vip-invites/[id]/renew` com `id` alheio | Todas APIs admin `requireAdmin` + `supabaseAdmin` valida `invite_id` existe; não há `user_id` client para IDOR em admin |
| **IDOR em `orders`/`payments`** | `GET /api/payments/orders/[id]` | Usuário A lê pedido de B | `resolveUserId` + `where user_id=auth.id` em cada `select` — `403` se `order.user_id !== auth.id` |
| **Alteração pelo cliente** | qualquer `supabase.from('user_state').update` | bypass `accessService` | RLS acima + `app/lib/db.ts:237` `saveUserState` só via `supabaseAdmin` quando `vip_*` presente (checar `auth` server-side) |
| **`service_role` vazado** | `SUPABASE_SERVICE_ROLE_KEY` em client bundle | bypass total RLS | `app/lib/supabase-admin.ts:1` `import 'server-only'` + nunca importar em client; `app/actions/*` recria cliente mas também `'use server'` — ok; auditar `NEXT_PUBLIC_*` nunca conter `SERVICE_ROLE` |
| **Webhooks falsos** | `POST /api/payments/webhook` sem HMAC | acesso concedido sem pagamento | Validar `x-signature` HMAC + consulta direta `GET gateway/pix/{txid}` + `raw_event_hash` único |
| **Webhooks repetidos** | gateway reenvia `paid` 3x | `grantAccess` duplicado, `vip_expires_at` estendido 2x | `raw_event_hash UNIQUE` + `if orders.status='paid' return 200 already_processed` antes de `grantAccess` |
| **Exposição de dados financeiros** | `GET /api/payments/orders` retorna `qr_code/raw` | Pix e valores expostos | Só `user_id` dono vê `qr_code` temporário; admin vê sem `raw`; `qr_code` nulado após `expires_at` |
| **Revogação inconsistente** | `revoke` só `invite_codes` sem `access_grants` | Convite revogado mas acesso permanece | `POST .../revoke {revoke_grant:true}` transacional `invite + grant + user_state + event` |
| **Renovação duplica** | `renew` chamado 2x rápido | `vip_expires_at` soma 2x | `select ... for update` + idempotência `reason + new_expires_at` dedup 60s |
| **Race `is_used`** | `app/actions/signup.ts:52` `update is_used` não-atômico | 2 signups com mesmo `code` criam 2 usuários | `update ... where is_used=false returning` + checar `count==1` → se `0` retorna `409 ALREADY_USED`; ou `unique partial index where is_used=false` + `on conflict` |
| **Convites usados simultaneamente** | 2 `POST /api/payments/webhook` com `txid` igual | 2 `grantAccess` | `raw_event_hash` + `orders.status` check antes de conceder |

**Auditoria RLS futura (migration):**

```sql
-- Revogar update amplo e criar política restrita (exemplo, não aplicar nesta tarefa)
drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own_restricted" on public.user_state
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Trigger que bloqueia vip_*/role escrito por authenticated (implementação real em migration ALFA-011.2)
```

---

## 12. Plano incremental de sprints

> Cada sprint preserva compatibilidade (regra 19) e evita retrabalho Pix (regra 20). `Strangler Fig`: novo fluxo convive com legado até validação.

### ALFA-011.1 — Modelagem e migration

* **Objetivo:** criar base de dados sem quebrar fluxo atual
* **Escopo:** `invite_codes` aditiva (10 cols nullable) + `access_grants` vazia + `access_events` vazia; sem `premium_plans/orders/payments` ainda
* **Arquivos prováveis:** `supabase/migrations/20250917000001_vip_invites.sql` (aditiva), `app/lib/access/accessService.ts` (esqueleto `calculateExpiration` + `grantAccess` flag off)
* **Migration:** `ADD COLUMN IF NOT EXISTS` em `invite_codes` + `CREATE TABLE access_grants, access_events` + índices + `RLS enable` + `comment` + `NOTIFY pgrst`
* **Riscos:** `REFERENCES` sem `NOT NULL` seguro; `NOTIFY` necessário para PostgREST; sem `NOT NULL` não quebra existentes
* **Testes:** `invite_codes` still `is_used` funciona; `generateNewInvite` ainda cria `is_used=false`; `signUpWithInviteCode` ainda valida
* **Aceite:** `select invite_codes` retorna novas cols `null` para antigos; `supabase status` sem erro
* **Não alterar:** `app/actions/*`, `app/api/*`, `middleware`, `Sidebar`, `APK`, `user_state`

### ALFA-011.2 — Serviço central de acesso

* **Objetivo:** implementar `accessService` sem ativar bloqueio
* **Escopo:** `grantAccess`, `getEffectiveAccess`, `hasFullPremium`, `calculateExpiration`, `recordAccessEvent` + `user_state` cache sync
* **Arquivos:** `app/lib/access/accessService.ts`, `app/lib/auth.ts` (add `requireVip` mas `VIP_CHECK=false` flag), `app/lib/db.ts` (add `access_plan/vip_*` ao `UserState` + `select`)
* **Migration:** `ALTER TABLE user_state ADD COLUMN IF NOT EXISTS access_plan text, vip_started_at timestamptz, vip_expires_at timestamptz, vip_invite_id uuid references invite_codes(id)` — nullable, aditiva
* **Riscos:** `user_state_update_own` permissivo → `accessService` deve ser único escritor `vip_*` via `supabaseAdmin`
* **Testes:** `calculateExpiration('fixed_days',30) == now+30d`, `getEffectiveAccess` com `lifetime` retorna `isLifetime`
* **Aceite:** `VIP_CHECK=false` → nenhuma API bloqueia; `grantAccess` em `signup.ts` ainda não chamado (feature flag)

### ALFA-011.3 — Página administrativa de convites

* **Objetivo:** CRUD admin de convites configuráveis
* **Escopo:** `GET/POST /api/admin/vip-invites`, `GET /api/admin/vip-invites/[id]`, `PATCH .../[id]`, `app/dashboard/admin/vip-invites/page.tsx` com cards/tabela/busca/filtros/modal criação
* **Arquivos:** `app/api/admin/vip-invites/route.ts`, `app/api/admin/vip-invites/[id]/route.ts`, `app/dashboard/admin/vip-invites/**`, `components/AdminInviteCard.tsx`
* **Migration:** sem
* **Riscos:** `AdminInviteButton` vira atalho — manter compatibilidade `generateNewInvite` legado
* **Testes:** criar `7d/30d/lifetime` → `code` `ALFA-XXXX-XXXX`, copiar, `GET` lista paginada
* **Aceite:** admin cria convite com validade distinta; `invite_codes.expires_at` respeitado

### ALFA-011.4 — Renovação, revogação e histórico

* **Objetivo:** regras 7,8,9 e auditoria
* **Escopo:** `POST .../[id]/renew`, `POST .../[id]/revoke`, `GET .../[id]/history`, `revokeAccess/renewAccess` no serviço, RLS `user_state` restrita
* **Arquivos:** `app/api/admin/vip-invites/[id]/renew/route.ts`, `.../revoke/route.ts`, `.../history/route.ts`, `supabase/migrations/20250917*_rls_vip.sql` (trigger/policy)
* **Migration:** RLS `user_state_update_own_restricted` + trigger `before update` para `vip_*`/`role`
* **Riscos:** race `renew` duplo → `for update`; revogar convite não deve apagar `grants` sem `revoke_grant=true`
* **Testes:** renovar ativo mantém dias restantes; revogar expirado; tornar vitalício → `expires_at null`
* **Aceite:** `access_events` registra `previous/new_expires_at` + `admin_id`

### ALFA-011.5 — Ativação do Full Premium

* **Objetivo:** ligar bloqueio server-side
* **Escopo:** ativar `requireVip` em 7 APIs gerente + `VipExpired.tsx` em `dashboard/layout.tsx`/`GameContext` + `app/actions/signup.ts:59` passar a usar `grantAccess`
* **Arquivos:** `app/lib/auth.ts` (`VIP_CHECK=true`), `app/api/gpro/sync/route.ts`, `app/api/python/[[...route]]/route.ts`, `app/api/calendar/route.ts`, `app/api/manager/profile/route.ts`, `app/api/market/update/route.ts`, `app/api/gpro/token/route.ts`, `app/dashboard/layout.tsx`, `contexts/GameContext.tsx`
* **Migration:** índice `user_state(vip_expires_at)` para `requireVip` rápido
* **Riscos:** admin bypass deve funcionar; login não pode bloquear (regra 12) — só APIs
* **Testes:** `VIP_EXPIRED` 403 em `get_state`, admin 200, expirado login 200 mas manager 403
* **Aceite:** `invite_codes` intacto; `user_state` cache sincronizado

### ALFA-011.6 — Planos comerciais

* **Objetivo:** catálogo sem pagamento ainda
* **Escopo:** `premium_plans` + `GET /api/plans` público + `GET/POST /api/admin/plans` admin + `app/dashboard/admin/plans/page.tsx`
* **Arquivos:** `supabase/migrations/*_premium_plans.sql`, `app/api/plans/route.ts`, `app/api/admin/plans/**`
* **Migration:** `CREATE TABLE premium_plans` + seed `vip-7d/30d/60d/90d/lifetime`
* **Riscos:** `price_cents` snapshot em `orders` — preço mudar não afeta pedidos antigos
* **Testes:** listar `is_active=true`, criar plano `lifetime` sem `validity_days`
* **Aceite:** convites continuam funcionando sem `premium_plans`

### ALFA-011.7 — Pedidos e pagamentos

* **Objetivo:** `orders` + `payments` sem gateway real
* **Escopo:** `POST /api/payments/orders`, `GET /api/payments/orders/[id]`, `GET /api/payments/[id]/status`, `app/dashboard/vip/page.tsx` (escolha plano → pedido)
* **Arquivos:** `supabase/migrations/*_orders_payments.sql`, `app/api/payments/orders/**`, `app/lib/payments/orderService.ts`
* **Migration:** `CREATE TABLE orders, payments` + índices + RLS
* **Riscos:** `pix_txid` único, `provider_order_id` único, `qr_code` sensível
* **Testes:** criar order `pending` → `GET` retorna sem `raw`; usuário A não lê order de B
* **Aceite:** sem Pix ainda, `payments.status` permanece `pending`

### ALFA-011.8 — Integração Pix

* **Objetivo:** webhook validado + concessão automática
* **Escopo:** `POST /api/payments/webhook` (HMAC + consulta gateway + idempotência + `grantAccess`) + comparação gateways
* **Arquivos:** `app/api/payments/webhook/route.ts`, `app/lib/payments/gateway.ts`, `app/lib/access/accessService.ts` (source `payment`)
* **Migration:** `raw_event_hash UNIQUE` + `pix_txid UNIQUE`
* **Riscos:** webhook falso, repetido, valor divergente, expirado — todos mitigados na seção 9.3
* **Testes:** webhook duplicado não duplica `grant`; `amount_mismatch` 422; `HMAC invalid` 401
* **Aceite:** pagamento `paid` → `access_grants` criado → `user_state` sync → `hasFullPremium true`

### ALFA-011.9 — Painel de vendas

* **Objetivo:** admin vê vendas e auditoria
* **Escopo:** `app/dashboard/admin/sales/page.tsx` com `orders`/`payments`/`access_events` + filtros `status/provider` + export
* **Arquivos:** `app/dashboard/admin/sales/**`, `app/api/admin/sales/route.ts`
* **Migration:** sem
* **Riscos:** não expor `raw_event_hash`/`qr_code` integral
* **Testes:** admin lista vendas, usuário comum 403
* **Aceite:** nenhuma regressão em `ALFA-011.1-8`

---

## 13. Estratégia de migração

### Preservação

* **Convites existentes:** `invite_codes (id, code, is_used, created_at)` inalterados; novas cols `NULL` → convite antigo mantém `sem expiração` (perpétuo até uso), `is_used` boolean preservado, `code` único intacto
* **Usuários existentes:** `user_state` sem `vip_*` → `access_plan null`, `vip_expires_at null` → tratado como `sem acesso` após ativação `requireVip`, exceto `role=admin` (bypass). Para não bloquear base legada na virada, política: migração inicial pode backfill `access_grants` com `30d` a partir de `created_at` para usuários `role=user` existentes **ou** manter `allowlist` temporária — decisão a registrar em `feature flag` (ver abaixo)
* **Convites já utilizados:** `is_used=true` permanece, `used_by=null` (histórico limitado a `auth.users.user_metadata.invite_code` em `signup.ts:44`) — novo `used_by` só para novos aceite
* **Registros antigos:** nunca `DELETE`/`TRUNCATE`; apenas `ADD COLUMN`
* **RLS:** migrations aditivas com `drop policy if exists` + `create policy` idempotente (padrão `20250914`)
* **Admin:** `role=admin` nunca afetado por `vip_expires_at` (bypass em `requireVip`)
* **Compatibilidade com fluxo atual:** `generateNewInvite` legado continua `insert {code,is_used:false}` — novas cols default `null` → convite legado funciona; `signUpWithInviteCode` antigo valida `is_used=false` igual; após `grantAccess` ativado, `signUpWithInviteCode` passa a chamar serviço mas mantém validação `is_used=false`

### Backfill

* **Não obrigatório na `.1`** — convites antigos sem `validity_type` tratados como `fixed_days 30d` apenas em documentação, não no banco
* **Opcional na `.5`:** script server-side `supabaseAdmin` que para cada `user_state where role='user' and vip_expires_at is null` cria `access_grants` com `started_at = user_state.created_at`, `expires_at = created_at + 30d`, `source='migration'` — idempotente `where not exists (select 1 from access_grants where user_id=...)`

### Valores padrão

* `invite_codes.invite_type='vip'`, `access_plan='full_premium'`, `validity_type='fixed_days'`, `validity_days=30` — apenas como default em `accessService.calculateExpiration` quando `null`, não como `DEFAULT` no banco (evita assumir intenção)

### Feature flag

* `VIP_CHECK` (`env` ou `lib/featureFlags.ts`): `false` em ALFA-011.1-4 (schema + admin UI sem bloqueio), `true` em ALFA-011.5 (bloqueio ativo)
* `PIX_ENABLED`: `false` até ALFA-011.8

### Ativação gradual

* ALFA-011.1-4: escrita dupla (legado `is_used` + novo `access_grants` se `VIP_CHECK=false` ainda não lê `access_grants` para bloqueio)
* ALFA-011.5: leitura `access_grants`/`user_state` para `requireVip` — monitorar `403 VIP_EXPIRED` rate

### Rollback

* Cada migration aditiva reversível: `ALTER TABLE ... DROP COLUMN IF EXISTS` + `DROP TABLE IF EXISTS access_grants, access_events` (nunca `DROP` de `invite_codes`/`user_state` originais)
* Flag `VIP_CHECK=false` reverte bloqueio sem reverter schema
* `access_grants` vazia pode ser truncada se sprint abortado (sem perda de `invite_codes`)

---

## 14. Matriz de testes

### Convites

| Caso | Entrada | Esperado | Tipo |
|---|---|---|---|
| Criar 7d | `POST /api/admin/vip-invites {fixed_days,7}` | `code ALFA-XXXX, expires_at=now+7d` | API |
| Criar 30d | `fixed_days,30` | `expires_at=now+30d` | API |
| Criar 60d | `fixed_days,60` | `now+60d` | API |
| Criar 90d | `fixed_days,90` | `now+90d` | API |
| Criar data personalizada | `until_date:2026-12-31` | `expires_at=2026-12-31` | API |
| Criar vitalício | `lifetime` | `expires_at null, status lifetime` | API |
| Aceitar válido | `signUpWithInviteCode` com `is_used=false, expires_at>now` | `user created, is_used=true, grant active, vip_expires_at=now+days` | E2E |
| Reutilizar | segundo `signUp` com mesmo `code` | `409 ALREADY_USED` | API |
| Revogar antes de usar | `POST .../revoke` com `is_used=false` | `is_revoked=true`, aceitar → `409 INVITE_REVOKED` | API |
| Expirar convite | `expires_at=now-1d` | aceitar → `409 INVITE_EXPIRED` | API |
| Vitalício aceito | `lifetime` convite | `access_grants expires_at null, status lifetime` | API |
| IDOR convite | usuário A tenta `GET .../[id]` de convite de B | `200` (admin vê todos) ou `403` se não admin | API |
| Race is_used | 2 `signUp` simultâneos com mesmo `code` | 1 `200`, 1 `409` | Concorrência |

### Acesso

| Caso | Estado | Requisição | Esperado |
|---|---|---|---|
| Ativo | `vip_expires_at > now()` | `GET /api/manager/profile` | `200` |
| Expirado | `vip_expires_at <= now()` | `GET /api/manager/profile` | `403 VIP_EXPIRED` |
| Vitalício | `expires_at null, status lifetime` | `GET /api/gpro/sync` | `200` |
| Renovado ativo | `renew {30d}` com `expires_at > now()` | `new_expires_at = max(now, prev)+30d` | `200` |
| Renovado expirado | `renew {30d}` com `expires_at <= now()` | `new_expires_at = now()+30d` | `200` |
| Revogado | `revoke {revoke_grant:true}` | `status revoked, user_state null, 403` | `200` |
| Admin expirado | `role=admin, vip_expires_at <= now()` | `GET /api/gpro/sync` | `200` (bypass) |
| Usuário comum tenta `role=admin` | `supabase.from('user_state').update({role:'admin'})` | `RLS 42501` ou trigger ignora | `403` |
| IDOR access | usuário A tenta `POST .../renew` do grant de B | `404` ou `403` | `403` |

### Pix

| Caso | Entrada | Esperado |
|---|---|---|
| Pedido pending | `POST /api/payments/orders {slug vip-30d}` | `orders pending, payments pending, qr_code` |
| Pagamento pendente | `GET /api/payments/[id]/status` antes de pagar | `pending` |
| Pagamento confirmado | `POST /api/payments/webhook {valid HMAC, txid}` | `paid, grant created, VIP ativo` |
| Webhook duplicado | segundo `POST /webhook` com mesmo `raw_event_hash` | `200 already_processed` |
| Assinatura inválida | `x-signature` errado | `401 invalid signature` |
| Valor divergente | `gateway amount != order amount` | `422 AMOUNT_MISMATCH`, sem grant |
| Estorno | `gateway refund` | `refunded, revokeAccess?` (política pendente) |
| Cancelamento | `POST /orders/[id]/cancel` antes de pagar | `cancelled` |
| Expirado | `payments.expires_at <= now()` sem `paid` | `expired` |

### Plataforma

| Caso | Comando | Esperado |
|---|---|---|
| TypeScript | `npm run typecheck` / `tsc --noEmit` | sem erro |
| Build | `npm run build` | sem erro |
| Testes | `node tests/alfa-001-auth.test.js` etc. (13 arquivos) | todos `PASS` |
| Web | login expirado → manager | tela `VipExpired` sem logout |
| APK | `npx cap sync` + `supabase.auth` expirado | mesmo `403` que Web, banner offline se `cached <= now()` |
| Regressão Dashboard | `app/dashboard/manager, calendar, market` | sem 500, `requireVip` só onde esperado |

---

## 15. Pendências e decisões futuras

| # | Decisão | Opções | Status | Owner |
|---|---|---|---|---|
| 1 | **Gateway Pix** | Mercado Pago, Pagar.me, Gerencianet/Efi — comparar taxa Pix, QR dinâmico `txid`, HMAC, consulta `GET /pix/{txid}`, suporte | **Pendente** — não escolher sem comparar | Produto |
| 2 | **Compra com ou sem cadastro** | exigir `auth` (recomendado: `requireAuth` em `POST /orders`) vs guest checkout (complexo: `user_id null` até pagar) | **Pendente** — recomendar com cadastro | Produto |
| 3 | **Compra única ou assinatura** | `fixed_days` única (7/30/60/90) vs recorrência Pix Automático | **Pendente** — MVP única, recorrência futura | Produto |
| 4 | **Planos iniciais** | 7/30/60/90/lifetime — quais ativos no lançamento | **Pendente** | Produto |
| 5 | **Preços** | `price_cents` por `slug` | **Pendente** | Produto |
| 6 | **Cupons** | `coupon_code` em `orders` → desconto | **Pendente** — adiar pós-MVP | Produto |
| 7 | **Afiliados** | `affiliate_id` em `orders` → comissão | **Pendente** — adiar | Produto |
| 8 | **Estornos** | revoga acesso automaticamente? prazo reembolso? | **Pendente** — definir política | Produto/Jurídico |
| 9 | **Recorrência** | Pix Automático (BACEN) vs cobrança manual mensal | **Pendente** — adiar | Produto |
| 10 | **Pix Automático** | idem | **Pendente** | Produto |
| 11 | **Emissão de recibos** | NFSe? recibo simples? | **Pendente** | Financeiro |
| 12 | **Regras fiscais** | imposto sobre venda digital, `BRL` único | **Pendente** | Financeiro |
| 13 | **Política de reembolso** | 7 dias? vitalício reembolsável? | **Pendente** | Jurídico |

Nenhuma pendência bloqueia ALFA-011.1-5 (convites + VIP). Gate Pix (1) bloqueia apenas ALFA-011.8.

---

## Apêndice A — Arquivos consultados (2026-09-17)

* `supabase/migrations/20250914000001_rls_hardening.sql:9,67-74` — RLS `invite_codes`
* `supabase/migrations/20250915000002_add_car_characteristic.sql:5`, `20250916000001_gpro_sponsors_select.sql:4-11`
* `app/actions/admin.ts:12-37` — `generateNewInvite`
* `app/actions/signup.ts:17-72` — `signUpWithInviteCode`
* `app/components/AdminInviteButton.tsx:9-100` — botão Sidebar
* `app/login/page.tsx:8,49-83,259-275` — fluxo aceite
* `app/lib/supabase-admin.ts:1,17` — `supabaseAdmin`
* `app/lib/supabase.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts:4-33`, `middleware.ts:4-6`
* `app/lib/auth.ts:33-85` — `requireAuth/requireAdmin/resolveUserId`
* `app/lib/db.ts:30,142-305` — `UserState, getUserState, saveUserState`
* `app/lib/gpro-token.ts:60,74,85`
* `app/dashboard/layout.tsx:162-352`, `app/dashboard/admin/layout.tsx:19-27`
* `app/api/gpro/sync/route.ts:387`, `app/api/gpro/token/route.ts:8,20,43`, `app/api/python/[[...route]]/route.ts:271,386`, `app/api/calendar/route.ts:256`, `app/api/manager/profile/route.ts:117`, `app/api/market/update/route.ts:92`, `app/api/admin/**:23-52`
* `capacitor.config.ts:4,7`, `package.json`, `ALFA-011.0-AUDIT-VIP-30DIAS.md:1-280`, `docs/ALFA-001-APK-STRATEGY.md:38,82`
* Grep `very thorough` 2026-09-17 confirmou 0 ocorrências de `premium_plans, access_grants, access_events, orders, payments, accessService, vip_*` fora da auditoria

## Apêndice B — Critérios de conclusão atendidos

1. Estado atual mapeado com código real e `file:line`
2. Arquitetura futura documentada (Convite/Pedido/Pagamento/Concessão/Estado/Histórico + por que não só `user_state`)
3. Modelo de dados detalhado (6 tabelas, chaves, índices, sensíveis, RLS, compatibilidade, riscos, adiável)
4. Página administrativa planejada (`/dashboard/admin/vip-invites` com cards/tabela/busca/filtros/criação/detalhes/copiar/renovar/revogar/vitalício/histórico)
5. Renovação e revogação especificadas (APIs + `accessService`)
6. Fluxo Pix documentado (pedido→QR→webhook validado→idempotência→concessão)
7. Web e APK considerados (Web Admin, Web user, APK offline cache)
8. Segurança e RLS auditados (12 riscos + mitigação)
9. Plano de sprints definido (9 sprints ALFA-011.1-.9 com objetivo/escopo/arquivos/migration/riscos/testes/aceite)
10. Matriz de testes criada (convites/acesso/Pix/plataforma)
11. Nenhum código ou banco alterado
12. Nenhum commit, push ou deploy executado

---

*Fim do documento. Próximo passo: aguardar autorização para iniciar **ALFA-011.1 — Modelagem e migration**.*
