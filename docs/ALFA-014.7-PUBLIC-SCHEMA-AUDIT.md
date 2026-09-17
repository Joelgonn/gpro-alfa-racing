# ALFA-014.7 — Auditoria do schema `public` remoto × migrations locais

> **Sprint:** ALFA-014.7 — Auditoria comparativa do schema `public` remoto
> **Data:** 2026-09-17 | **Branch:** `main`
> **Fonte de referência:** `docs/reference/public-schema-export.sql` (9.527 bytes, 219 linhas, 14 `CREATE TABLE`, 0 `CREATE INDEX`, 0 `CREATE POLICY`, 0 `CREATE FUNCTION`, 0 `CREATE TRIGGER`, 0 `ALTER TABLE`)
> **Escopo:** análise comparativa. **Nenhuma** migration criada ou alterada, **nenhum** código alterado, **nenhum** SQL executado no remoto, `supabase start|db reset|db push|db pull` **não executados**, `public.query` **não criado**, sem commit/push/deploy/APK.
> **Status:** **Auditoria concluída** — 3 achados bloqueantes identificados.

---

## 1. Resumo executivo

O export de referência contém **apenas DDL de tabelas** — 14 tabelas do schema `public` com colunas, PKs, CHECKs e 3 FKs. **Não contém** `ENABLE ROW LEVEL SECURITY`, policies, índices, funções, triggers nem `COMMENT`. Consequência: só é possível auditar integralmente as seções **A–F**; as seções **G–K** permanecem **parcialmente não confirmadas** por limitação da fonte.

Fatos centrais:

1. **O schema-base remoto = 14 tabelas. As migrations locais documentam apenas parte dele.**
2. **7 das 11 migrations não têm DDL de criação** para as tabelas que alteram → falham em banco vazio. Já reproduzido: `supabase start` morreu em `42P01 relation "public.user_state" does not exist` na **primeira** migration.
3. **3 colunas/objetos divergem entre o que o código escreve e o que existe no remoto** — sendo a mais grave `tyre_suppliers`, que fará `update_user_profile` falhar em produção.
4. **4 tabelas premium (`premium_plans`, `premium_orders`, `premium_payments`, `payment_events`) existem nas migrations locais e estão AUSENTES no remoto.**
5. **4 tabelas remotas (`calendario_temporada`, `gpro_sponsors_metadata`, `access_events`, `access_grants`) nunca são referenciadas pelo código** — e 2 delas são remotas-only.

---

## 2. Tabelas confirmadas no remoto (seção A) — 14

| # | Tabela | PK | Tipo de PK | Colunas | FK no export | Referenciada pelo código |
|---|---|---|---|---|---|---|
1 | `invite_codes` | `id` | uuid, default `gen_random_uuid()` | 13 | — | **sim** (12 usos) |
2 | `market_drivers` | `id` | **bigint sem identity/default** | 22 | — | sim (4) |
3 | `calendario_temporada` | `id` | uuid, default | 8 | `user_id → auth.users(id)` | **não** (0 usos) |
4 | `user_planning` | `id` | uuid, default | 4 | `user_id → auth.users(id)` | sim (2) |
5 | `energy_observations` | `id` | bigint GENERATED ALWAYS AS IDENTITY | 34 | — | sim (1) |
6 | `gpro_sponsors` | `sponsor_id` | bigint | 14 | — | sim (2) |
7 | `gpro_sponsors_metadata` | `key` | text | 3 | — | **não** (0 usos) |
8 | `api_knowledge_base` | `id` | uuid, default | 20 | — | sim (5) |
9 | `gpro_import_snapshots` | `id` | uuid, default | 7 | — | sim (4) |
10 | `user_state` | `user_id` | uuid | 30 | `user_id → auth.users(id)` | **sim (27 usos)** |
11 | `access_grants` | `id` | uuid, default | 14 | `invite_code_id → invite_codes(id)` | **sim (18)** |
12 | `access_events` | `id` | uuid, default | 8 | `access_grant_id → access_grants(id)` | sim (6) |
13 | `premium_plans` | — | **AUSENTE** | — | — | sim (4) |
14 | `premium_orders` / `premium_payments` / `payment_events` | — | **AUSENTES** | — | — | sim (10/7/1) |

> **Nota:** `avatars` (4 usos em `app/dashboard/sponsors/page.tsx:207,213,926,932`) **não aparece** no export — não é possível afirmar se é tabela de schema não exportado, bucket de Storage ou apenas nome de caminho. **Não confirmada.**

### Matriz das 16 tabelas exigidas na tarefa

| Tabela | Remoto | Migration local cria? | Situação |
|---|---|---|---|
`invite_codes` | ✅ | ❌ (só `ALTER`: 000003) | **divergente** (7 colunas a mais no local) |
`market_drivers` | ✅ | ❌ | **remota-only** |
`calendario_temporada` | ✅ | ❌ | **remota-only**, sem uso no código |
`user_planning` | ✅ | ❌ | **remota-only** |
`energy_observations` | ✅ | ❌ | **remota-only** |
`gpro_sponsors` | ✅ | ❌ (só `ALTER`/RLS: 000016? → `20250916000001`) | **remota-only** |
`gpro_sponsors_metadata` | ✅ | ❌ | **remota-only**, sem uso no código |
`api_knowledge_base` | ✅ | ❌ | **remota-only** |
`gpro_import_snapshots` | ✅ | ❌ | **remota-only** |
`user_state` | ✅ | ❌ (só `ALTER` 000002/000004) | **divergente** |
`access_grants` | ✅ | ✅ `20250917000001` | **divergente em FK** |
`access_events` | ✅ | ✅ `20250917000001` | **conforme** |
`premium_plans` | ❌ | ✅ `20250917000005` | **local-only** |
`premium_orders` | ❌ | ✅ `20250917000006` | **local-only** |
`premium_payments` | ❌ | ✅ `20250917000007` | **local-only** |
`payment_events` | ❌ | ✅ `20250917000008` | **local-only** |

---

## 3. Tabelas criadas pelas migrations locais (seção B)

| Migration | Cria | Resultado |
|---|---|---|
`20250917000001_add_vip_model.sql` | `access_grants`, `access_events` | ✅ **existem no remoto** — alinhadas |
`20250917000005_create_premium_plans.sql` | `premium_plans` | ⚠️ **ausente no remoto** |
`20250917000006_create_premium_orders.sql` | `premium_orders` | ⚠️ **ausente** |
`20250917000007_create_premium_payments.sql` | `premium_payments` | ⚠️ **ausente** |
`20250917000008_create_payment_events.sql` | `payment_events` | ⚠️ **ausente** |

## 4. Tabelas ausentes nas migrations locais (seção C) — 8

`invite_codes` · `market_drivers` · `calendario_temporada` · `user_planning` · `energy_observations` · `gpro_sponsors` · `gpro_sponsors_metadata` · `api_knowledge_base` · `gpro_import_snapshots` · **`user_state`** *(a mais crítica: 27 usos no código, nenhum `CREATE TABLE` no repositório)*

---

## 5. Divergências de colunas (seção D)

### 5.1 `invite_codes` — remoto tem 13 colunas; a migration 000003 **presume 6** e adiciona 7

**Já presentes no remoto e na migration 000003 (`add column if not exists` → no-op):** `used_by`, `used_at`, `created_by`, `expires_at`, `revoked_at`, `revoked_by`, `invite_type`, `metadata`.

**Não confirmadas no remoto** (o export já as lista, portanto existem): nenhuma pendência — a migration é **aditiva e compatível**.

> Divergência real: o remoto **já possui** as 6 colunas que a migration considerava novas. Isso indica que a migration 000003 foi desenhada contra um estado anterior do remoto — o remoto evoluiu. **Não é erro**, mas confirma drift histórico.

### 5.2 `user_state` — remoto tem 30 colunas; 4 colunas dependem de migrations

| Coluna | Remoto | Origem local | Divergência |
|---|---|---|---|
`car_characteristic` | ✅ linha 183 | `20250915000002` | conforme (migration é no-op no remoto) |
`vip_status` | ✅ 184 | `20250917000001` | conforme (no-op) |
`vip_expires_at` | ✅ 185 | `20250917000001` | conforme (no-op) |
`access_plan` | ✅ 186 | `20250917000001` | conforme (no-op) |
`access_grant_id` | ✅ 187 | `20250917000001` | conforme (no-op) |
**`tyre_suppliers`** | ❌ **AUSENTE** | ❌ **não existe em nenhuma migration** | 🔴 **BLOQUEANTE** — ver §5.4 |
`gpro_token` | ✅ linha 173 | não citada nas migrations | presente no remoto; código **nunca seleciona** (`db.ts:146` documenta: "nunca selecionar token em consultas gerais") |

**Colunas do remoto ausentes na projeção do código** (`db.ts:150`): `gpro_token` (intencional). Nenhuma outra.

**Colunas do código ausentes no remoto:** `tyre_suppliers` (única).

### 5.3 `access_grants` × migration 000001 — 14 colunas, idênticas

Todas as colunas coincidem em nome, tipo, nulidade e default (`source`, `plan`, `status` com `DEFAULT 'pending'`, `starts_at DEFAULT now()`, `metadata DEFAULT '{}'`, `created_at`/`updated_at NOT NULL DEFAULT now()`). **Única divergência: a FK de `user_id`** (ver §7).

### 5.4 🔴 ACHADO BLOQUEANTE — `tyre_suppliers`

- **Código:** `app/lib/db.ts:86` (`tyre_suppliers: string[]`), `:263-265` (envia a coluna no payload), `:281-284` (fallback para erro `42703`).
- **Migration:** `20250917000002_harden_user_state_update.sql:136` → `tyre_suppliers = coalesce((p_tyre_suppliers #>> '{}')::text, tyre_suppliers::text)::jsonb` — a função `update_user_profile` **referencia a coluna**.
- **Remoto:** **não existe** (export de 219 linhas, nenhuma ocorrência).
- **Impacto:** quando a 000002 for aplicada, **a criação da função sucede** (corpo PL/pgSQL não é validado na criação), mas **qualquer chamada a `update_user_profile` falha com `42703`** — quebra o fluxo de perfil do gerente. O fallback do `db.ts` cobre o `upsert` direto, **não** o RPC.
- **Também:** `grant execute … to authenticated` na linha 161 executa imediatamente, mas a falha só aparece no primeiro uso.

### 5.5 `gpro_sponsors` — 14 colunas; **divergência de dados, não de schema**

`backup-gpro_sponsors-20250916.json` (261.388 bytes) confirma que a tabela é populada com a mesma forma do DDL (`sponsor_id, name, country, category, finances, expectations, patience, reputation, image, negotiation, raw_data`). Nenhuma migration altera suas colunas — a migration `20250916000001` só liga RLS e cria policy de leitura. **Conforme.**

### 5.6 Tabelas sem qualquer divergência de colunas

`access_events` (8 colunas idênticas), `energy_observations` (34), `market_drivers` (22), `calendario_temporada` (8), `user_planning` (4), `gpro_sponsors_metadata` (3), `api_knowledge_base` (20), `gpro_import_snapshots` (7) — todas **remota-only**, portanto sem contraparte local para divergir.

---

## 6. Divergências de tipos (seção D) e defaults (seção E)

**Colunas com tipo divergente entre remoto e migration local: NENHUMA.** As colunas compartilhadas (`invite_codes` 000003, `user_state` 000002/000004, `access_grants`/`access_events` 000001) usam exatamente os mesmos tipos: `uuid`, `text`, `jsonb`, `timestamptz`, `numeric`, `bigint`, `integer`, `boolean`.

**Defaults divergentes: NENHUM** nas colunas compartilhadas — verificado para `metadata '{}'::jsonb`, `status 'pending'`, `starts_at now()`, `created_at/updated_at now()`, `is_used false`.

**Defaults remotos dignos de nota (sem contraparte local):**

| Tabela.coluna | Default | Risco na reconstrução |
|---|---|---|
`market_drivers.id` | **nenhum** (bigint puro) | reconstrução precisa de `bigserial`/`identity` **ou** de fornecimento explícito de id |
`user_state.role` | `'user'::text` | ✅ |
`user_state.track` | `'Selecionar Pista'::text` | ✅ |
`user_state.test_points_json` | `'{"accel":0,"power":0,"handling":0}'::jsonb` | ✅ (objeto com 3 chaves, não `{}`) |
`energy_observations.xp/stamina/idade/peso/ctr` | `NOT NULL` **com** `CHECK (… IS NULL OR …)` — contraditório mas válido | reconstrução fiel deve reproduzir a contradição |

---

## 7. CHECK constraints e chaves estrangeiras (seções F)

### 7.1 CHECKs confirmados no remoto

| Tabela | Constraint | Definição |
|---|---|---|
`invite_codes` | `invite_type` | `NULL OR = ANY('vip_30_days','vip_lifetime','vip_custom')` |
`invite_codes` | `code` | `UNIQUE` (inline) |
`user_planning` | `user_id` | `UNIQUE` (inline) |
`energy_observations` | 6 numéricos | `energia_inicial/final 0..100`, `xp 0..300`, `stamina 0..250`, `idade 0..50`, `peso 0..100`, `ctr 0..100` |
`energy_observations` | 11 peças de setup | `chassis…electronics 0..9` |
`energy_observations` | `reliability` | `>=1 AND <=5` |
`energy_observations` | `weather_condition` | `ANY('SECA','MOLHADA','MISTA')` |
`energy_observations` | `validation_status` | `ANY('VALIDA','SUSPEITA','DESCARTADA')` |
`access_grants` | `source` | `ANY('invite','manual','payment','admin')` |
`access_grants` | `plan` | `ANY('premium','full_premium')` |
`access_grants` | `status` | `ANY('active','expired','revoked','pending')` + default `pending` |
`access_events` | `event_type` | `ANY('granted','renewed','revoked','expired','manually_adjusted')` |

**Comparação com a migration 000003:** o CHECK de `invite_type` remoto **já existe**; a migration o adiciona como `invite_codes_invite_type_check` **guardado por `if not exists (select 1 from pg_constraint where conname='invite_codes_invite_type_check')`** — se o nome no remoto for outro (o export mostra CHECK **inline/sem nome declarado**), a migration cria um **segundo CHECK equivalente**. Não é erro (semântica idêntica), mas gera **constraint duplicada** — anotado em §10.

### 7.2 FKs — apenas 3 no export; 2 exigidas pelo código **não confirmadas**

| FK | No export? | Observação |
|---|---|---|
`calendario_temporada.user_id → auth.users(id)` | ✅ | — |
`user_planning.user_id → auth.users(id)` | ✅ | — |
`user_state.user_id → auth.users(id)` | ✅ | — |
`access_grants.invite_code_id → invite_codes(id)` | ✅ | **sem `ON DELETE SET NULL`** (migration 000001: `on delete set null`) |
`access_events.access_grant_id → access_grants(id)` | ✅ | **sem `ON DELETE SET NULL`** (migration: `on delete set null`) |
**`access_grants.user_id → auth.users(id)`** | ❌ **ausente** | comentário da migration 000001 justifica: "sem FK obrigatória para não quebrar se auth schema diferir" — **deliberado** |
`api_knowledge_base.user_id → auth.users` | ❌ não exportado | não confirmado |
`gpro_import_snapshots.user_id → auth.users` | ❌ não exportado | não confirmado |
`energy_observations.user_id → auth.users` | ❌ não exportado | não confirmado |

> As 3 divergências de FK que **existem** são de ação referencial (`ON DELETE`), não de existência. Como o export não mostra `ON DELETE` nas 2 FKs que a migration declara com `SET NULL`, **não é possível afirmar** se o remoto tem ou não a ação — o gerador do export pode omiti-la. **Recomenda-se confirmar no catálogo antes de gerar baseline.**

---

## 8. Policies RLS (seção G) — **NÃO CONFIRMADAS pela fonte**

O export **não contém uma única linha** `ENABLE ROW LEVEL SECURITY` ou `CREATE POLICY`. Logo:

- **Não é possível confirmar** quais tabelas têm RLS no remoto nem quais policies existem.
- O que as migrations locais **pretendem** criar (20 policies na 000001 + 2 na 000001-VIP + 1 em `gpro_sponsors` + 4 na 000002 + 1 na 000005/6/7):
  - `user_state`: `user_state_select_own`, `user_state_insert_own`, `user_state_update_own` (revogada depois), `user_state_delete_own` → **substituída** por `user_state_update_own_restricted` (000002)
  - `api_knowledge_base`: `kb_select_own`, `kb_insert_own`, `kb_update_own`, `kb_delete_own`
  - `gpro_import_snapshots`: `snapshots_select_own`, `snapshots_insert_own`
  - `invite_codes`: `invite_select_auth`
  - `energy_observations`: `energy_select_own`, `energy_insert_own`, `energy_update_own`, `energy_delete_own`
  - `user_planning`: `planning_select_own`, `planning_insert_own`, `planning_update_own`, `planning_delete_own`
  - `market_drivers`: `market_select_all` (leitura pública)
  - `gpro_sponsors`: `gpro_sponsors_select_authenticated`
  - `access_grants`: `grants_select_own` · `access_events`: `events_select_own`
  - `premium_plans` (`premium_plans_select_active`), `premium_orders` (`premium_orders_select_own`), `premium_payments` (`premium_payments_select_own`)

**Tabelas remotas que as migrations locais NUNCA cobrem com RLS**: `calendario_temporada` e `gpro_sponsors_metadata`. Em ambas, **RLS pode estar desligada ou sem policy** — exposição potencial via `anon`/`authenticated`. 🔴 **Recomenda-se verificar com prioridade** (a ALFA-001 identificou "P4 Sem RLS versionada" e o remoto segue com 2 tabelas fora de qualquer controle).

---

## 9. Índices, triggers e funções não confirmados (seção K)

- **Índices:** o export não contém `CREATE INDEX` nem `UNIQUE` além dos implícitos de PK/`code`/`user_id`. Índices declarados nas migrations (`idx_invite_codes_*` ×6, `idx_access_grants_*` ×4, `idx_access_events_*` ×3, `uniq_grant_invite_user`, `uniq_premium_*`) **não confirmados no remoto**.
- **Triggers:** `trg_user_state_privilege_guard`, `trg_access_grants_updated_at` e os 4 `premium_*` — **não confirmados**.
- **Funções:** `consume_invite_code`, `update_user_profile`, `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants`, `prevent_user_state_privilege_escalation`, `update_access_grants_updated_at` — **não confirmadas**.
  - **Achado de risco independente da confirmação:** `consume_invite_code` (`20250917000003:54`) faz `used_by = auth.uid()`. Chamado via `service_role` (como no signup), **`auth.uid()` é NULL** → convite fica com `used_by` nulo, perdendo a trilha de auditoria do convite consumido. Registrado como risco de dados, não de schema.

---

## 10. Migrations que falham em banco vazio (seção I) — **7 de 11**

| Migration | Comando que falha | Erro |
|---|---|---|
**`20250914000001_rls_hardening.sql`** | `alter table public.user_state enable row level security` (linha 6) | **`42P01`** — *reproduzido por medição:* `supabase start` → `relation "public.user_state" does not exist`. Ponto exato de parada de toda a cadeia. |
`20250915000002_add_car_characteristic.sql` | `alter table public.user_state add column …` | `42P01` |
`20250916000001_gpro_sponsors_select.sql` | `alter table public.gpro_sponsors enable row level security` | `42P01` |
`20250917000001_add_vip_model.sql` | `alter table public.user_state add column …` (linha 6) | `42P01` |
`20250917000002_harden_user_state_update.sql` | `drop policy … on public.user_state` / `create trigger` | `42P01` |
`20250917000003_extend_invite_codes.sql` | `alter table public.invite_codes add column …` (linha 6) | `42P01` |
`20250917000004_harden_access_grants_uniqueness.sql` | `select … from public.access_grants` (linha 12) | `42P01` (se 000001 também falhou) |
`premium_plans/orders/payments/payment_events` | — | ✅ **funcionariam** — são as únicas que trazem `CREATE TABLE` próprio |

**Sequência de dependências (ordem correta de bootstrap):**
`user_state`, `invite_codes`, `api_knowledge_base`, `gpro_import_snapshots`, `energy_observations`, `user_planning`, `market_drivers`, `gpro_sponsors`, `gpro_sponsors_metadata`, `calendario_temporada` → **depois** `access_grants` (FK `invite_code_id` exige `invite_codes`) → **depois** `access_events` (FK exige `access_grants`) → **depois** `premium_*`.

---

## 11. Informações ainda faltantes para reconstrução local (seção H)

1. **Policies RLS reais** do remoto: por tabela, comando, papéis, `USING` e `WITH CHECK`.
2. **Estado de RLS por tabela** (`relrowsecurity`/`relforcerowsecurity`) — inclusive para `calendario_temporada` e `gpro_sponsors_metadata`.
3. **Índices reais** (nome, colunas, unicidade, predicado parcial) — sem isso, reconstrução perde performance e o `uniq_grant_invite_user`.
4. **Triggers e funções reais** com corpo-fonte, incluindo se `consume_invite_code`/`update_user_profile`/`renew_access_grant`/`revoke_access_grant`/`expire_overdue_grants` já existem e em qual versão.
5. **Ações referenciais (`ON DELETE`/`ON UPDATE`)** das FKs existentes — o export as omite.
6. **Existência de `tyre_suppliers`** — confirmar se realmente falta no remoto (todo o §5.4 depende disso).
7. **Natureza de `avatars`** (tabela de outro schema, bucket de Storage ou caminho).
8. **Extensões instaladas** (`pgcrypto` para `gen_random_uuid()`, `uuid-ossp`) e **grants/REVOKE** por tabela.
9. **Comentários** (`COMMENT ON`) — o export não os traz; as migrations adicionam 12 comentários.
10. **Origem de `calendario_temporada` e `gpro_sponsors_metadata`**: 0 referências no código — são legado, uso futuro ou geridos por ferramenta externa?
11. **`UNIQUE` de `market_drivers.id` e ausência de `created_at`** — confirmar se é intencional.

---

## 12. Recomendação técnica para o schema-base

**Estratégia: baseline único e idempotente, derivado do remoto, inserido antes de todas as migrations existentes — sem tocar nas 11 atuais.**

1. **Coletar o que falta primeiro** (seções 1–9 de §11) via leitura de catálogo: `pg_policies`, `pg_indexes`, `pg_trigger`, `pg_proc`, `pg_constraint` (`confdeltype`/`confupdtype`), `pg_extension`, `information_schema.columns`/`role_table_grants`. **Sem isso, o baseline repete o erro de inventar schema.**
2. **Criar UMA migration de bootstrap** com timestamp anterior a `20250914000001` (ex.: `20250913000000_baseline_schema.sql`), contendo:
   - `create table if not exists` para as **10 tabelas-base** (não para `access_*`/`premium_*`, que já têm `CREATE TABLE` nas migrations);
   - colunas, tipos, defaults e CHECKs **exatamente como no remoto** — inclusive `market_drivers.id` como `bigint` sem identity (fidelidade > elegância) e a contradição `NOT NULL` + `CHECK (… IS NULL OR …)` de `energy_observations`;
   - as 3 FKs do remoto + as 3 não exportadas **após confirmação**;
   - **`ENABLE ROW LEVEL SECURITY` + as policies reais** — ou deixar explicitamente para as migrations 000001/000016, documentando a escolha;
   - **não** incluir `tyre_suppliers`: ele não existe no remoto, e adicioná-lo no baseline mudaria o schema de produção. A decisão correta é **tratar `tyre_suppliers` como drift a resolver** (§5.4): ou criar a coluna por migration autorizada, ou remover a referência da função `update_user_profile`.
3. **Ordem de dependências:** `invite_codes` antes de `access_grants`; `access_grants` antes de `access_events` (já respeitado pelas migrations 000001).
4. **Resolver a duplicação de CHECK:** antes do baseline, confirmar o nome do CHECK de `invite_type` no remoto para que a 000003 não crie um segundo check equivalente.
5. **Não renomear, mover nem editar** nenhum dos 11 migrations (AGENTS.md).
6. **Validação:** `supabase start` → `supabase db reset` → conferir que as 14 tabelas + funções + triggers + policies existem → só então rodar as 13 suites e os testes HTTP da ALFA-014.3.
7. **Riscos de produção:** o baseline é **aditivo e idempotente** (`if not exists`), portanto seguro se algum dia for aplicado ao remoto — mas neste sprint **não deve ser aplicado** (`db push --linked` proibido).

**Contraindicação explícita:** derivar o baseline inferindo colunas a partir de `app/lib/db.ts`. Já produziu este problema uma vez: o código referencia `tyre_suppliers`, que o remoto não tem.

---

## 13. Anexo — evidências

| Evidência | Local |
|---|---|
DDL de referência (14 tabelas, 219 linhas) | `docs/reference/public-schema-export.sql` |
Falha real da cadeia em banco vazio | `supabase start` → `ERROR: relation "public.user_state" does not exist (SQLSTATE 42P01)` |
Ausência remota das tabelas premium | sondagem REST read-only: `PGRST205 Could not find the table 'public.premium_plans'` (registrado em `docs/ALFA-014.3-ORDERS-GET-PIX-TXID.md` §14) |
Origem do schema-base (nunca versionado) | `docs/ALFA-001-DIAGNOSTICO.md:24,30` — "`supabase/migrations` — não existia" |
Drift de migração remota | `docs/ALFA-012.2-RELATORIO-MIGRATIONS-STAGING.md:46,54` — última aplicada `20250916000001` |
Uso de `tyre_suppliers` | `app/lib/db.ts:86,263-265,281-284` · `20250917000002:136` |
Projeção de colunas do código | `app/lib/db.ts:150` |
Tabelas usadas pelo código | `user_state` (27), `access_grants` (18), `invite_codes` (12), `premium_orders` (10), `premium_payments` (7), `access_events` (6), `api_knowledge_base` (5), `market_drivers`/`gpro_import_snapshots`/`avatars`/`premium_plans` (4), `gpro_sponsors`/`user_planning` (2), `energy_observations`/`payment_events` (1) |

**Nenhuma migration criada ou alterada. Nenhum código alterado. Nenhum SQL remoto executado.**
