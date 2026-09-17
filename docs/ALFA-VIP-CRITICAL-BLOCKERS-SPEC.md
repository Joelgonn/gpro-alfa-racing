# ALFA — Bloqueios críticos do módulo Convites VIP: análise técnica e especificação

> **Data:** 2026-09-17 | **Branch:** `main` | **HEAD:** `a20eae3` (2026-09-16 13:26:40)
> **Tipo:** análise técnica + especificação de sprint futura. **Nada foi corrigido, criado ou aplicado.**
> **Modo:** somente leitura. Nenhum arquivo de código/migration/configuração alterado; nenhum SQL remoto; sem `supabase start|db reset|db push|db pull`; sem commit/push/deploy/APK.
> **Único artefato criado:** este documento.
> **Correção de registro:** a auditoria anterior (`ALFA-VIP-AUDIT-SINCE-011.1`) afirmou que `access_grants`/`access_events` **não existem** no remoto. **Essa afirmação está ERRADA** e é corrigida na §3 deste documento, com evidência direta.

---

## 1. Resumo executivo

**I. Enumeração de convites — CONFIRMADA e com escopo corrigido.**
A policy `invite_select_auth` (`supabase/migrations/20250914000001_rls_hardening.sql:70-71`) é `for select using (auth.role() = 'authenticated')` — **sem filtro por linha**. Qualquer portador de sessão válida pode ler **a tabela inteira** `invite_codes` (todos os `code`, `is_used`, `expires_at`, `used_by`) via PostgREST com a anon key pública (`app/lib/supabase.ts:4,12`). **Não é enumeração anônima** (o público-alvo precisa de sessão), é **enumeração por qualquer usuário autenticado** — ou seja, **um único convite legítimo expõe todo o catálogo**.

**II. "Tabelas VIP ausentes" — REFUTADO.**
O export do schema remoto (`docs/reference/public-schema-export.sql`) **contém `access_grants` (linha 191) e `access_events` (linha 208)**, com todas as colunas, PKs, CHECKs e 2 FKs. Os erros `PGRST205` documentados referem-se a **`premium_orders`/`premium_plans`/`premium_payments`** (ALFA-014.3 §14.2), **não** às tabelas VIP. Logo, **o fluxo convite → VIP não está quebrado por ausência de tabela**.

**III. O bloqueio real é outro — `access_grants` não tem RLS habilitada e `user_id` não tem FK.**
O export não traz **nenhuma** instrução `enable row level security` nem `create policy` (0 ocorrências). Como a migration `20250917000001` — que habilita RLS e cria `grants_select_own`/`events_select_own` — **não foi aplicada no remoto** (evidência independente em §3), é altamente provável que **`access_grants` e `access_events` estejam sem RLS ativa no remoto**, expostas a `anon`/`authenticated` por padrão de tabela sem RLS. **Isto é potencialmente mais grave que a enumeração de convites** e é a verdadeira prioridade.

**IV. Contradição documental resolvida.** `ALFA-012.4:7,38,168` ("4/4 aplicadas, PostgREST sem Could not find") é **contradita** por `ALFA-012.2:46,54`, pelo export de schema e pelo comportamento observado. Classificação detalhada na §4.

---

## 2. ANÁLISE 1 — Enumeração de invites

### 2.1 Inventário do objeto `invite_codes`

| Aspecto | Situação |
|---|---|
Tabela | `public.invite_codes` — **existe no remoto** (export linha 2) |
Colunas no remoto (11 do DDL + `used_by`,`used_at`,`created_by`,`expires_at`,`revoked_at`,`revoked_by`,`invite_type`,`metadata`) | export linha 2-16 |
PK | `invite_codes_pkey (id)` |
UNIQUE | `code` (inline) |
CHECK | `invite_type IS NULL OR invite_type = ANY('vip_30_days','vip_lifetime','vip_custom')` |
RLS | `enable row level security` na migration `20250914000001:9` (**aplicada no remoto**, conforme `ALFA-012.2:46`) |
Policies | **apenas uma**: `invite_select_auth` (`20250914000001:69-71`) — `for select using (auth.role() = 'authenticated')` |
Colunas adicionais locais | `20250917000003` (8 colunas) — **não aplicada no remoto** |
RPC | `consume_invite_code(p_code text)` (migration `000003`, **não aplicada no remoto**) |
Índices | 6 parciais (`000003`) + UNIQUE de `code` — os de `000003` **não aplicados** |

### 2.2 Todas as ocorrências de acesso a `invite_codes` no código (12, todas server-side)

| # | Arquivo:linha | Operação | Cliente |
|---|---|---|---|
1 | `app/actions/admin.ts:32` | (ação admin legada) | `supabaseAdmin` |
2 | `app/actions/signup.ts:55` | **SELECT por code** (preCheck) | `supabaseAdmin` |
3 | `app/actions/signup.ts:119` | **UPDATE condicional** (consumo atômico) | `supabaseAdmin` |
4 | `app/actions/signup.ts:193` | SELECT de re-verificação (concorrência) | `supabaseAdmin` |
5-7 | `app/api/admin/access-would-block/route.ts:50,51,52` | `count` total/used/revoked | `supabaseAdmin` |
8-9 | `app/api/admin/vip-invites/[id]/revoke/route.ts:25,47` | SELECT por id + UPDATE | `supabaseAdmin` |
10-11 | `app/api/admin/vip-invites/route.ts:41,120` | **lista (limit 100)** + INSERT | `supabaseAdmin` |
12 | `app/lib/access/accessService.ts:898` | SELECT por id (reprocessamento) | `supabaseAdmin` |

**Nenhum componente, página ou client de browser lê `invite_codes`.** Verificação: varredura em `app/**/*.tsx` fora de `api/` e `actions/` → 1 resultado, que é o próprio `accessService.ts` (server-side). O `AdminInviteButton` (`app/components/AdminInviteButton.tsx`) **não** consulta a tabela.

**Conclusão sobre o vetor:** o acesso legítimo é 100% server-side via `supabaseAdmin` (service role, que **bypassa RLS**). Portanto a policy `invite_select_auth` **não serve a nenhum caminho do aplicativo** — ela existe apenas para o client. O vetor de ataque é **direto ao PostgREST** (`https://<ref>.supabase.co/rest/v1/invite_codes?select=*`) usando a anon key pública (`app/lib/supabase.ts:4,12`) + o JWT de sessão do próprio atacante.

### 2.3 Respostas A–J

**A. Quais operações precisam consultar `invite_codes`?**
Sete caminhos, todos admin/privilegiados: (1) preCheck do signup; (2) consumo atômico; (3) re-verificação de concorrência; (4–6) três contagens de diagnóstico; (7) listagem admin; (8) revogação (SELECT por id + UPDATE); (9) reprocessamento em `accessService`. **Todos via service role.**

**B. Quais precisam consultar por código/token específico?**
Apenas `app/actions/signup.ts:55` (preCheck) e `:119` (UPDATE). Ambos server-side. A consulta é por **igualdade exata de `code`** — nunca por prefixo, nunca por lista.

**C. Quais precisam listar convites?**
Apenas `app/api/admin/vip-invites/route.ts:41` (`order by created_at desc limit 100`), atrás de `requireAdmin()`. Nenhum outro ponto lista.

**D. Quem pode listar convites?**
**Somente admin.** Dupla barreira já existente: guard server-side (`app/dashboard/admin/layout.tsx:20-23`) + `requireAdmin()` na API (`app/lib/auth.ts:61-70`, papel lido de `user_state.role`).

**E. O manager deve conseguir consultar algum convite?**
**Não.** Não existe requisito, tela, rota ou teste que dê ao manager qualquer acesso a convites. A separação admin×manager é intencional e verificada (`tests/alfa-011-4-security.test.js` → 62 PASS).

**F. O usuário convidado precisa consultar `invite_codes` diretamente?**
**Não.** O aceite acontece em `app/actions/signup.ts` — Server Action — que usa `supabaseAdmin`. O usuário envia o código como texto de formulário (`app/login/page.tsx:58`) e **recebe apenas uma mensagem** (`INVITE_NOT_FOUND`/`INVITE_EXPIRED`/…). Ele **nunca** lê a tabela. Existe a RPC `consume_invite_code(text)` como alternativa `security definer`, mas:
- **não está aplicada no remoto** (migration `000003` não aplicada);
- **não tem consumidor** — `signup.ts:111` documenta explicitamente que a implementação TS a substitui ("Equivalente à RPC `consume_invite_code`, mas com `used_by` explícito (service_role não tem `auth.uid()`)");
- a migration `000003:72` faz `grant execute … to authenticated`, o que **criaria um novo vetor** (oráculo de existência/estado por código) se algum dia fosse aplicada.

**G. Qual policy mínima recomendada?**
**Nenhuma policy de `SELECT` em `invite_codes` para `authenticated`.** A policy mínima correta é a **ausência** de policy de leitura para `anon`/`authenticated`, mantendo a RLS habilitada (tabela fecha para todos os clientes; o service role continua bypassando). Isso **é** o mínimo necessário — explicado pelo fluxo exato: como os 9 pontos de acesso legítimos usam service role, não há **nenhuma** operação de cliente que precise passar por RLS.

**H. A policy deve ser substituída por acesso server-side, RPC protegida ou filtro por owner?**
**Acesso server-side** (o que já existe) — com as seguintes decisões:

| Alternativa | Veredito | Razão |
|---|---|---|
Acesso server-side puro (`supabaseAdmin`) | ✅ **recomendado** | Já é o que 100% do código faz; zero mudança de fluxo |
RPC `security definer` dedicada (ex.: `verify_invite_code(p_code)`) retornando **apenas** `{exists, reason}` | 🔶 aceitável como endurecimento extra | Útil se algum dia houver verificação pelo cliente; **hoje não há demanda** |
RPC `consume_invite_code` exposta a `authenticated` | ❌ **não usar** | Cria oráculo por código; conflita com a implementação TS vigente |
Filtro por owner (`used_by = auth.uid()`) | ❌ **impossível** | `used_by` é `NULL` antes do uso — o convidado não é dono de nada; não há coluna de owner |
Manter a policy atual | ❌ **inaceitável** | Enumeração total (§2.2) |

**I. Existe risco de quebrar o fluxo atual ao remover o SELECT amplo?**
**Não para o aplicativo.** Justificativa item a item:
- os 12 acessos são service role (bypassa RLS) → **intangíveis**;
- **zero** leituras client-side comprovadas (§2.2);
- a tela admin usa `fetch('/api/admin/vip-invites')` (API route com service role), **não** leitura direta;
- o login/signup usa Server Action, **não** leitura direta.

**Riscos residuais (a mitigar na spec):** (a) algum código fora de `app/**` (scripts em `scripts/`, `tests/`) que dependa de leitura anon — verificado: nenhum; (b) a policy é a única barreira de `invite_codes`, então removê-la sem habilitar RLS antes seria inócuo — **a RLS já está habilitada** (`20250914000001:9`); (c) se o remoto divergir do repositório, uma operação manual de `DROP POLICY` pode não encontrar a policy — usar `drop policy if exists`.

**J. Quais testes devem provar que a enumeração foi eliminada?**

| # | Teste | Como provar | Tipo |
|---|---|---|---|
J1 | `SELECT` em `invite_codes` como `authenticated` retorna **0 linhas** ou erro | requisição REST com JWT de usuário comum | integração |
J2 | `SELECT` como `anon` retorna **0 linhas**/erro | requisição REST sem JWT | integração |
J3 | Admin continua listando normalmente | `GET /api/admin/vip-invites` → 200 com N convites | integração |
J4 | Aceite de convite continua funcionando ponta a ponta | `signUpWithInviteCode` com convite válido → sucesso e `is_used=true` | integração |
J5 | Estados de erro do aceite preservados | `INVITE_NOT_FOUND`/`EXPIRED`/`REVOKED`/`ALREADY_USED` | unitário (já existe em `alfa-011-6-signup`, 39 PASS) |
J6 | `pg_policies` **não** contém policy de `SELECT` para `authenticated`/`anon` em `invite_codes` | consulta ao catálogo | banco |
J7 | Nenhuma rota/componente introduz leitura client-side de `invite_codes` | asserção estática (grep) | unitário |
J8 | Manager (não-admin) recebe 403 em todas as rotas de convite | `requireAdmin` + teste de integração | integração |
J9 | Regressão: contagens de `access-would-block` permanecem corretas para admin | 200 com totais | integração |

---

## 3. ANÁLISE 2 — `access_grants` e `access_events` (com correção de registro)

### 3.1 Correção obrigatória

A auditoria anterior concluiu que as tabelas **não existem** no remoto. **Está incorreto.** Evidência direta — `docs/reference/public-schema-export.sql`:

```
L191: CREATE TABLE public.access_grants (   ← 14 colunas, PK, CHECKs, FK para invite_codes
L208: CREATE TABLE public.access_events (   ← 8 colunas, PK, CHECK, FK para access_grants
```

A origem do erro: os erros `PGRST205` registrados (ALFA-014.3 §14.2, linhas 293-303) são de **`premium_orders`**, **`premium_plans`** e **`premium_payments`** — tabelas da ALFA-014, **não** do módulo VIP. Uma sondagem pontual de `access_grants` feita antes da entrega do export foi extrapolada indevidamente para todo o módulo.

**Consequência:** o bloqueio #2 como enunciado ("tabelas ausentes → fluxo convite→VIP indisponível") **não se sustenta**. O fluxo não está bloqueado pela existência das tabelas.

### 3.2 O que permanece não confirmado (e é o risco real)

| Objeto | No export? | Situação |
|---|---|---|
`access_grants` / `access_events` (tabelas, colunas, PK, CHECK, 2 FKs) | ✅ **confirmado** | presentes no remoto |
Rows/RLS/policies | ❌ | export tem **0** `enable row level security` e **0** `create policy` |
Índices (`idx_access_grants_user_id`, `…_status`, `…_expires_at`, `…_invite_code_id`, `uniq_grant_invite_user`, 3 de `access_events`) | ❌ | migration `000001`/`000004` **não aplicadas** |
Trigger `trg_access_grants_updated_at` | ❌ | idem |
4 colunas VIP em `user_state` (`vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id`) | ❌ | idem — **ausentes no export de `user_state`** (linha 157-190: não há nenhuma das quatro) |
RPCs `consume_invite_code`, `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants`, `update_user_profile`, `prevent_user_state_privilege_escalation` | ❌ | idem |
8 colunas de auditoria em `invite_codes` | ❌ | idem (o export linha 2-16 **não** tem `revoked_at`, `revoked_by`, `created_by`, `used_by`, `used_at`, `invite_type`, `metadata`) |
FKs `access_grants.invite_code_id` / `access_events.access_grant_id` | ✅ existem | **sem `ON DELETE SET NULL`** no export (a migration declara `set null`) |

**⚠️ Risco mais grave identificado nesta análise:** `access_grants` e `access_events` existem no remoto **criadas fora das migrations**. Se foram criadas por SQL manual (como o restante do schema-base), **a RLS provavelmente NÃO foi habilitada** — e tabela `public` sem RLS é **legível por `anon` e `authenticated`** por padrão. Isso significaria exposição de `user_id`, `plan`, `status`, `starts_at`, `expires_at`, `revoked_by` e `metadata` de **todos os usuários**. **Não confirmável sem acesso remoto; prioridade máxima de verificação.**

### 3.3 Respostas A–L

**A. Schema mínimo para o fluxo convite → VIP**
1. `invite_codes` (existente): `id`, `code`, `is_used`, `used_by`, `used_at`, `expires_at`, `revoked_at`, `invite_type`, `metadata`, `created_at`.
2. `access_grants` (existente): `id`, `user_id`, `source`, `invite_code_id`, `plan`, `status`, `starts_at`, `expires_at`, `revoked_at`, `metadata`, timestamps.
3. `access_events` (existente): `id`, `user_id`, `access_grant_id`, `event_type`, `source`, `actor_user_id`, `metadata`, `created_at`.
4. `user_state` com `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id` (**ausentes no remoto**).
5. Índice único parcial `(invite_code_id, user_id) WHERE source='invite'` (**ausente no remoto**) — garante idempotência no banco, hoje garantida só por código.

**B. Colunas obrigatórias**
`access_grants.user_id` (uuid, NOT NULL), `.source` (NOT NULL, CHECK 4 valores), `.plan` (NOT NULL, CHECK 2 valores), `.status` (NOT NULL, default `pending`), `.starts_at` (NOT NULL default `now()`), `.metadata` (NOT NULL default `{}`). `access_events.user_id` (NOT NULL), `.event_type` (NOT NULL, CHECK 5 valores). As 4 colunas VIP em `user_state` são **nullable** (aditivas).

**C. Valores de status utilizados em `access_grants`**
`active`, `expired`, `revoked`, `pending` (CHECK confirmado no export). **Não existe `cancelled`.** Em `access_events.event_type`: `granted`, `renewed`, `revoked`, `expired`, `manually_adjusted`. Em `access_grants.source`: `invite`, `manual`, `payment`, `admin`. Em `access_grants.plan`: `premium`, `full_premium`.

**D. Índices únicos necessários**
1. `uniq_grant_invite_user (invite_code_id, user_id) WHERE source='invite' AND invite_code_id IS NOT NULL` — **crítico para idempotência** (migration `000004:32-35`, ausente no remoto);
2. `invite_codes.code` UNIQUE (existente, confirmado);
3. PKs `access_grants.id`, `access_events.id`, `invite_codes.id` (confirmadas).
Não-únicos recomendados: `access_grants(user_id)`, `(status)`, `(expires_at)`, `invite_code_id WHERE NOT NULL`, `access_events(user_id)`, `(access_grant_id WHERE NOT NULL)`, `(created_at DESC)`.

**E. FKs necessárias**
1. `access_grants.invite_code_id → invite_codes(id)` — **existe**; a migration pede `ON DELETE SET NULL` (**não confirmado** no export);
2. `access_events.access_grant_id → access_grants(id)` — **existe**; idem `SET NULL`;
3. `access_grants.user_id → auth.users(id)` — **NÃO existe** (decisão documentada em `20250917000001:36`: "sem FK obrigatória para não quebrar se auth schema diferir");
4. `user_state.user_id → auth.users(id)` — existe (baseline).
Integridade referencial de `user_id` em `access_grants` fica **sem garantia de banco** — risco de órfãos aceito por design.

**F. Policies necessárias**

| Ator | Necessidade | Policy |
|---|---|---|
**Admin** | listar convites, criar, revogar, ver grants/eventos agregados | ❌ **nenhuma policy** — admin opera via `requireAdmin()` + service role (bypassa RLS). Correto e já implementado |
**Manager** | **nada** | ❌ nenhuma. Confirmado: zero requisito/rota/teste |
**Usuário convidado** | ler **apenas o próprio** grant/evento (tela de status futura) | ✅ `grants_select_own` (`using (auth.uid() = user_id)`, `for select to authenticated`) e `events_select_own` (idem) — migration `000001:94-103`, **não aplicadas**. **Nota:** enquanto não existir tela, são antecipação legítima mas opcional |
**any/anon** | nada | ❌ nenhuma |

**G. RPCs realmente utilizadas (têm consumidor)**

| RPC | consumidor | Situação |
|---|---|---|
`renew_access_grant` | `accessService.ts:738` | definida; consumidor **sem superfície pública** (nenhuma rota/página chama `renewGrant`) |
`revoke_access_grant` | `accessService.ts:805` | idem |
`expire_overdue_grants` | `accessService.ts:848` | idem |
`update_user_profile` | (migration `000002`, RPC de perfil) | **referencia `tyre_suppliers` que não existe no remoto → falharia com 42703** |

**Nenhuma RPC tem consumidor a partir de uma rota HTTP.** Todas são camada interna sem porta de entrada.

**H. RPCs existentes sem consumidor**

| RPC | Linha | Consumidores |
|---|---|---|
`consume_invite_code(text)` | `20250917000003:43` | **0** — substituída por implementação TS (`signup.ts:111`) |
`renew_access_grant(uuid, uuid)` | `20250917000004:42` | 0 (só via `accessService`, que ninguém chama) |
`revoke_access_grant(uuid, uuid)` | `20250917000004:89` | 0 |
`expire_overdue_grants()` | `20250917000004:124` | 0 |
`prevent_user_state_privilege_escalation()` | `20250917000002:11` | 0 (é função de **trigger**, não RPC) |
`update_access_grants_updated_at()` | `20250917000001:119` | 0 (trigger) |
`update_premium_*_updated_at()` | `000005-000008` | 0 (triggers) |

Também órfãos no lado TS: `renewGrant`, `revokeGrant`, `expireOverdueGrants`, `reprocessMissingGrant` (`accessService.ts:730,798,846,880`) — **0 chamadas**.

**I. Quais migrations falham em banco vazio e por quê**

| Migration | Falha? | Comando/erro |
|---|---|---|
`20250914000001_rls_hardening` | 🔴 **SIM** | `alter table public.user_state enable row level security` (L6) → **`42P01 relation "public.user_state" does not exist`** (reproduzido em `supabase start`) |
`20250915000002_add_car_characteristic` | 🔴 SIM | `alter table public.user_state …` → `42P01` |
`20250916000001_gpro_sponsors_select` | 🔴 SIM | `alter table public.gpro_sponsors …` → `42P01` |
`20250917000001_add_vip_model` | 🔴 SIM | L6 `alter table public.user_state add column …` → `42P01` |
`20250917000002_harden_user_state_update` | 🔴 SIM | `drop policy … on public.user_state` → `42P01` |
`20250917000003_extend_invite_codes` | 🔴 SIM | L6 `alter table public.invite_codes add column …` → `42P01` |
`20250917000004_harden_access_grants_uniqueness` | 🔴 SIM | L12 `select … from public.access_grants` → `42P01` (se `000001` também falhou) |
`20250917000005..000008` | ✅ **NÃO** | são as únicas com `create table` próprio |

**Causa raiz única:** **não existe migration de baseline.** Nenhum arquivo no repositório cria `user_state`, `invite_codes`, `api_knowledge_base`, `gpro_import_snapshots`, `energy_observations`, `user_planning`, `market_drivers`, `gpro_sponsors`, `gpro_sponsors_metadata`, `calendario_temporada` — todas existem **somente no remoto** (confirmado por `ALFA-014.4` e pelas 12 tabelas do export que não têm DDL local).

**J. Sequência mínima e segura de migrations**

```
(0) BASELINE — 10 tabelas-base, create table if not exists, DDL fiel ao export:
    invite_codes, calendar/planning/energy/market/sponsors*/
    api_knowledge_base, gpro_import_snapshots, user_state
    + enable row level security nas tabelas do baseline
    (timestamp anterior a 20250914000001)
(1) 20250914000001_rls_hardening            → policies (já roda após o baseline)
(2) 20250915000002_add_car_characteristic
(3) 20250916000001_gpro_sponsors_select
(4) 20250917000001_add_vip_model            → access_grants + access_events + 4 col em user_state
(5) 20250917000002_harden_user_state_update → corrigir `tyre_suppliers` ANTES de aplicar
(6) 20250917000003_extend_invite_codes      → remover/reequilibrar o `grant execute to authenticated`
(7) 20250917000004_harden_access_grants_uniqueness
(8) 20250917000005..000008                  → premium_* (independentes)
(9) NOVA migration — endurecimento de invite_codes (drop policy invite_select_auth)
(10) NOVA migration — RLS + policies de access_grants/access_events (se ausentes no remoto)
```

Ordem obrigatória de dependência: `invite_codes` → `access_grants` → `access_events` (já respeitada pelas migrations).

**K. O fluxo pode ser validado sem conceder VIP automaticamente?**
**Sim, em grande parte — e vale separar as duas metades:**
- **Consumo do convite:** validável sem VIP. `is_used`/`used_at`/`used_by` mudam, o grant **não**. Basta criar convite de teste com prefixo `TEST-ALFA-…` e verificar o consumo.
- **Concessão:** hoje é **automática por design** (`signup.ts:236-252` chama `ensureVipGrantForInvite` ao consumir). Para validar **sem** conceder, é necessário um caminho de teste que **não** atravesse o signup completo (ex.: chamar `ensureVipGrantForInvite` isoladamente em teste unitário com "dry-run", ou criar grant para usuário `TEST-` e removê-lo em seguida). **Não implementar flag de bypass em produção** — seria mudança de regra de negócio.
- **Estado final obrigatório preservado:** `VIP_CHECK=false`, `requireVip` inativo, nenhum Pix/gateway/QR/webhook/confirmação.

**L. Quais partes exigem validação no Supabase remoto**

| # | Verificação | Por quê |
|---|---|---|
L1 | `relrowsecurity`/`relforcerowsecurity` de `access_grants` e `access_events` | **risco de exposição (prioridade máxima)** |
L2 | `pg_policies` de `invite_codes` (confirmar que só existe `invite_select_auth`) | base da correção §2 |
L3 | Nomes reais e presença do CHECK/índices de `access_grants` | decidir `if not exists` vs. criação |
L4 | Existência das 4 colunas VIP em `user_state` | condição do fluxo |
L5 | Existência de `uniq_grant_invite_user` | idempotência no banco |
L6 | `ON DELETE` efetivo das 2 FKs | fidelidade do baseline |
L7 | RPCs existentes no remoto e seus `proacl` | vetores de `grant execute` |
L8 | Trigger `trg_access_grants_updated_at` | `updated_at` confiável |
L9 | Grants de tabela (`information_schema.role_table_grants`) para `anon`/`authenticated` | exposição real |
L10 | Histórico de migrations aplicadas | resolver a contradição da §4 |

**Nenhuma delas foi executada.** Todas exigem autorização (SQL remoto / `migration list --linked`).

---

## 4. ANÁLISE 3 — Consistência documental

| # | Afirmação | Fonte | Classificação | Evidência |
|---|---|---|---|---|
1 | "nenhuma das 4 migrations VIP aplicada no remoto; schema é `20250916000001`" | `ALFA-012.2:46,54` | ✅ **CONFIRMADA** | Export: `user_state` sem as 4 colunas VIP (L157-190); `invite_codes` sem as 8 colunas de auditoria (L2-16) |
2 | "Migrations: 4/4 VIP aplicadas `Local\|Remote` iguais" | `ALFA-012.4:7,168` | ❌ **CONTRADITA** | Export não contém as colunas que `000001`/`000003` adicionam nem os índices de `000004` |
3 | "Todas `Local\|Remote` aplicadas, PostgREST sem `Could not find table/column/function`" | `ALFA-012.4:38` | ❌ **CONTRADITA** | `PGRST205` observado para `premium_*`; ausência das colunas VIP no export |
4 | "`access_grants` e `access_events` ausentes no remoto" | `ALFA-VIP-AUDIT-SINCE-011.1` §6.2/E | ❌ **CONTRADITA** | Export L191, L208 — **erro meu, corrigido na §3.1** |
5 | "Fluxo convite → VIP indisponível em produção por ausência de tabelas" | enunciado da tarefa | ❌ **CONTRADITA** | Tabelas presentes; o que falta são **colunas** (`vip_*` em `user_state`) e objetos de `000001`/`000003` |
6 | "Policy `invite_select_auth` permite enumeração" | `ALFA-VIP-AUDIT-SINCE-011.1` §7.1 | ✅ **CONFIRMADA** | `20250914000001:70-71` — `for select using (auth.role()='authenticated')`, sem filtro |
7 | "Enumeração é anônima/pública" | implícito no resumo da tarefa | ⚠️ **PARCIALMENTE CONTRADITA** | Exige sessão válida (`auth.role()='authenticated'`); é **enumeração por qualquer usuário autenticado** |
8 | "7 das 11 migrations falham em banco vazio (`42P01`)" | `ALFA-VIP-AUDIT-SINCE-011.1` §6.2/I | ✅ **CONFIRMADA** | Reproduzido: `supabase start` → `relation "public.user_state" does not exist`; `ALFA-014.4` |
9 | "`expireOverdueGrants` nunca é chamada" | `ALFA-VIP-AUDIT-SINCE-011.1` §8 | ✅ **CONFIRMADA** | Busca global de consumidores: 0 |
10 | "`update_user_profile` referencia `tyre_suppliers` inexistente" | `ALFA-014.7` §5.4 | ✅ **CONFIRMADA** | `20250917000002:136` vs. export `user_state` (L157-190) sem a coluna |
11 | "RLS/policies de `access_grants` existem e protegem" | `ALFA-011.1`/`012.4` | 🟠 **DEPENDENTE DE ACESSO REMOTO** | Export tem **0** `enable row level security` e **0** `create policy` → **provável que NÃO existam** |
12 | "Idempotência garantida por `uniq_grant_invite_user`" | `ALFA-011.9` | 🟠 **DEPENDENTE** | Índice é da migration `000004` (não aplicada); hoje só o código garante |
13 | "Sem FK `access_grants.user_id` por decisão explícita" | `20250917000001:36` | ✅ **CONFIRMADA** | Comentário na migration + export sem a FK |
14 | "`consume_invite_code` substituída por implementação TS" | `signup.ts:111` | ✅ **CONFIRMADA** | RPC com 0 consumidores; TS com `used_by` explícito |
15 | "Convite concedeu VIP em staging" (implícito em `ALFA-013.2`) | `ALFA-013.2:33,46` | 🟠 **NÃO VERIFICÁVEL** | Requer `access_grants` populado; contradiz a ausência de colunas VIP em `user_state` |
16 | "Nenhuma migration criada desde ALFA-011.9 além de premium_*" | implícito | ✅ **CONFIRMADA** | 11 arquivos em `supabase/migrations`, último `20250917000008` |

---

## 5. ANÁLISE 4 — Especificação da futura sprint (proposta, **não executar**)

### 5.1 Nome sugerido
**ALFA-011.10 — Endurecimento de RLS/objetos VIP e baseline de schema** *(alternativas: `ALFA-016 — Fechamento de segurança VIP`)*. Recomendo `ALFA-011.10` por manter a numeração do módulo ao qual as correções pertencem.

### 5.2 Objetivo
Eliminar a **enumeração de convites** e fechar a **superfície RLS** de `access_grants`/`access_events`, garantindo que o fluxo convite → VIP continue íntegro, **sem ativar `VIP_CHECK`**, sem Pix e sem concessão automática indevida.

### 5.3 Escopo permitido
**Dentro:** migrations novas (RLS/policies + baseline, se autorizado); endurecimento de `invite_codes`; verificação/ criação de policies de `access_grants`/`access_events`; testes de segurança e de regressão; documentação.
**Fora (explícito):** ativar `VIP_CHECK`/`requireVip`; criar superfície de revogação/renovação de grant; Pix/gateway/webhook/QR/confirmação; alterar regras de concessão (mensal/vitalício/custom); alterar `app/lib/db.ts`; tocar em `app/api/payments/**`; mexer na área admin além do necessário.

### 5.4 Arquivos provavelmente envolvidos

| Arquivo | Ação |
|---|---|
`supabase/migrations/<ts>_harden_invite_codes_rls.sql` | **criar** — `drop policy if exists "invite_select_auth" on public.invite_codes;` (+ comentário explicando por que nenhuma policy de SELECT é necessária) |
`supabase/migrations/<ts>_ensure_grants_rls.sql` | **criar** — `alter table public.access_grants enable row level security;` (idempotente) + policies `grants_select_own`/`events_select_own` **guardadas por `if not exists`** |
`supabase/migrations/20250913000000_baseline_schema.sql` | **criar SOMENTE se autorizado** — 10 tabelas-base fieis ao export |
`supabase/migrations/20250917000002_harden_user_state_update.sql` | ⚠️ **NÃO alterar** (regra do AGENTS.md: migrations antigas não são alteradas) — a correção de `tyre_suppliers` deve ser uma **migration nova** |
`tests/alfa-011-10-invite-enumeration.test.js` | **criar** — J1–J9 |
`tests/alfa-011-10-rls-grants.test.js` | **criar** — policies de `access_grants`/`access_events` |
`tests/alfa-011-5-vip-invites.test.js` | reforçar (assertiva da policy removida) |
`docs/ALFA-011.10-RELATORIO-*.md` | criar relatório |
`app/lib/access/accessService.ts` | ⚠️ **somente se necessário** — preferir não tocar |

### 5.5 Migrations necessárias

| # | Nome proposto | Conteúdo | Obrigatória? |
|---|---|---|---|
M1 | `20250918000001_harden_invite_codes_rls.sql` | `drop policy if exists "invite_select_auth" on public.invite_codes;` + `comment on table` documentando que leitura é server-side | ✅ **sim** |
M2 | `20250918000002_ensure_access_grants_rls.sql` | `enable row level security` (idempotente) + `create policy "grants_select_own"`/`"events_select_own"` com guarda `if not exists` | ✅ **sim** (fecha o risco §3.2) |
M3 | `20250918000003_fix_user_state_tyre_suppliers.sql` | adicionar `tyre_suppliers jsonb` **ou** recriar `update_user_profile` sem a coluna — **decisão pendente (§5.10 D2)** | 🔶 condicional |
M4 | `20250913000000_baseline_schema.sql` | 10 tabelas-base fieis ao export | 🔶 só com autorização (D1) |
Nada é aplicado no remoto nesta sprint sem autorização explícita separada.

### 5.6 Alterações de policy

| Tabela | Antes | Depois |
|---|---|---|
`invite_codes` | `invite_select_auth` — `for select using (auth.role()='authenticated')` | **DROPADA.** RLS permanece habilitada; nenhum `SELECT` para `anon`/`authenticated`; escrita só service role |
`access_grants` | (presumido) sem RLS | RLS habilitada + `grants_select_own` (`auth.uid() = user_id`, `to authenticated`) |
`access_events` | (presumido) sem RLS | RLS habilitada + `events_select_own` (idem) |
Outras tabelas | inalteradas | inalteradas |

### 5.7 Testes necessários
J1–J9 da §2.3 + L1–L3 da §3.3 (verificação de catálogo) + regressão completa das 13 suites `alfa-011-*`/`alfa-012-1-*`/`alfa-013-*` (hoje 437 PASS) + `npx tsc --noEmit` + `npm run build`.

### 5.8 Critérios de aceite
1. `SELECT` em `invite_codes` por `authenticated` e por `anon` retorna **0 linhas** ou erro de permissão.
2. `pg_policies` **não** lista policy de `SELECT` em `invite_codes` para `anon`/`authenticated`.
3. Fluxo de aceite ponta a ponta **idêntico**: criar convite → cadastrar com o código → `is_used=true`, `used_by` preenchido, grant criado, evento `granted` gravado.
4. Admin continua listando/criando/revogando normalmente (200/201).
5. Manager recebe **403** em toda rota de convite.
6. `access_grants`/`access_events` com RLS habilitada e sem leitura cross-user.
7. `VIP_CHECK=false` e `requireVip` desativado **inalterados**.
8. Regressão `alfa-011-*` **verde**; `tsc` exit 0; `build` exit 0.
9. Nenhum Pix/gateway/webhook/QR/confirmação introduzido.
10. Relatório criado com evidências.

### 5.9 Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
R1 | **Remover a policy não basta** se o remoto tiver outra policy de SELECT criada fora do repositório | **ALTO** | verificar `pg_policies` **antes** de considerar concluído |
R2 | `access_grants` pode estar **sem RLS** no remoto — exposição de dados de todos os usuários | **CRÍTICO** | M2 é urgente; verificar `relrowsecurity` no mesmo passo |
R3 | Basear o baseline no export, que **não traz RLS/policies/índices/triggers** | ALTO | baseline apenas com `create table` (estrutura); RLS vem das migrations |
R4 | `tyre_suppliers`: adicionar coluna muda o schema de produção | MÉDIO | decisão explícita (D2) |
R5 | `000002` cria RPC quebrada se aplicada antes da correção | ALTO | corrigir via migration **nova** antes de aplicar `000002` |
R6 | Aplicar migrations no remoto sobre estado desconhecido | ALTO | ler histórico (D5) antes de qualquer push |
R7 | `invite_codes` sem UNIQUE adicional em `code`? (existe, inline) | BAIXO | confirmado |
R8 | Perder o histórico do trabalho não commitado (74 entradas) | **ALTO** | commit antes de qualquer migration — ver D6 |

### 5.10 Decisões que precisam de autorização explícita

| # | Decisão | Opções | Impacto |
|---|---|---|---|
D1 | Aplicar (ou não) migrations no **remoto** | (a) não aplicar; (b) aplicar local primeiro; (c) `db push --linked` | Sem (b)/(c), todos os testes de integração ficam pendentes |
D2 | `tyre_suppliers` | (a) adicionar coluna `jsonb`; (b) remover a referência da RPC | (a) altera schema de produção; (b) altera comportamento da RPC |
D3 | Criar o baseline local (M4) | sim / não | Sem ele, `supabase start`/`db reset` continuam impossíveis |
D4 | Manter ou remover a RPC `consume_invite_code` e seu `grant execute to authenticated` | manter+revogar grant / remover | Afeta superfície de ataque |
D5 | Autorizar leitura do catálogo remoto (`pg_policies`, `relrowsecurity`, `pg_indexes`, `migration list --linked`) | sim / não | Sem isso, L1–L10 permanecem não verificáveis |
D6 | Autorizar **commit** do trabalho ALFA-011→015 (74 entradas, nada versionado) | sim / não | Risco de perda total |
D7 | Criar policies `grants_select_own`/`events_select_own` agora (sem tela que as use) ou só habilitar RLS | RLS-only / RLS+policies | RLS-only fecha exposição com menor superfície |

---

## 6. Evidências (arquivo:linha)

| # | Evidência | Local |
|---|---|---|
E1 | Policy de enumeração | `supabase/migrations/20250914000001_rls_hardening.sql:69-71` |
E2 | RLS habilitada em `invite_codes` | `…20250914000001:9` |
E3 | Escrita permitida só a service role | `…20250914000001:73-74` |
E4 | 8 colunas de auditoria (não aplicadas) | `…20250917000003:6-13` |
E5 | RPC de consumo + `grant execute to authenticated` | `…20250917000003:43,72` |
E6 | Implementação TS substitui a RPC | `app/actions/signup.ts:111` |
E7 | Consumo atômico real | `app/actions/signup.ts:118-127` |
E8 | Compensação por concorrência | `app/actions/signup.ts:143-190` |
E9 | Lista admin (limit 100) | `app/api/admin/vip-invites/route.ts:40-44` |
E10 | Geração do código (CSPRNG, 8 hex) | `app/api/admin/vip-invites/route.ts:109-118` |
E11 | `requireAdmin` (401/403) | `app/lib/auth.ts:61-70` |
E12 | Guard server-side do admin | `app/dashboard/admin/layout.tsx:20-23` |
E13 | Menu admin filtrado | `app/dashboard/layout.tsx:265` |
E14 | Cliente anon público (vetor) | `app/lib/supabase.ts:4,12` |
E15 | `db.ts` usa browser client no runtime | `app/lib/db.ts:4,24` |
E16 | Tabelas VIP **presentes** no remoto | `docs/reference/public-schema-export.sql:191,208` |
E17 | `user_state` remoto **sem** as 4 colunas VIP | `docs/reference/public-schema-export.sql:157-190` |
E18 | `invite_codes` remoto **sem** as 8 colunas de auditoria | `docs/reference/public-schema-export.sql:2-16` |
E19 | Export sem RLS/policies | 0 ocorrências de `enable row level security` e `create policy` |
E20 | `PGRST205` de `premium_*` (não VIP) | `docs/ALFA-014.3-ORDERS-GET-PIX-TXID.md:293,302-303` |
E21 | Contradição 012.2 × 012.4 | `docs/ALFA-012.2-…md:46,54` vs. `docs/ALFA-012.4-…md:7,38,168` |
E22 | `tyre_suppliers` inexistente | `supabase/migrations/20250917000002:136` |
E23 | Baselines ausentes | `docs/ALFA-014.4-…` (nenhum `create table` de `user_state` em todo o git) |
E24 | Idempotência por `uniq_grant_invite_user` | `supabase/migrations/20250917000004:32-35` |
E25 | RPCs sem consumidor | busca global: 0 chamadas para `renew_access_grant`/`revoke_access_grant`/`expire_overdue_grants`/`consume_invite_code` |

---

## 7. Comandos executados

Somente leitura / não destrutivos:

```
git rev-parse --abbrev-ref HEAD ; git log -1 ; git log -12 ; git status --short ; git diff --stat
Get-ChildItem / Select-String   (inventário de arquivos, docs, migrations, refs no código)
Get-Content                     (leitura de rotas, telas, serviço, migrations, export de schema)
node tests/*.test.js            (39 suites — 785 PASS / 3 FAIL, em ALFA-VIP-AUDIT-SINCE-011.1)
npx tsc --noEmit                (exit 0)
```

**Não executados:** `supabase start`, `db reset`, `db push`, `db pull`, `migration new`, `migration list --linked`, qualquer SQL remoto, `git commit`, `git push`, deploy, build de APK, instalação de dependências.

## 8. Confirmação de integridade

- **Nenhum arquivo de código, migration, configuração ou teste foi alterado.**
- **Nenhuma migration foi criada ou aplicada.**
- **Nenhum SQL remoto foi executado.**
- **Nenhum commit, push, deploy ou build de APK.**
- `VIP_CHECK = false` e `requireVip` desativados — inalterados.
- Nenhum Pix, gateway, webhook, QR ou confirmação automática de pagamento foi implementado.
- **Único artefato criado:** `docs/ALFA-VIP-CRITICAL-BLOCKERS-SPEC.md`.

## 9. Itens que exigem autorização antes de qualquer ação futura

1. **D1 — aplicação de migrations** (local e/ou remoto).
2. **D5 — leitura do catálogo remoto** (`pg_policies`, `relrowsecurity`, `pg_indexes`, `migration list --linked`) — **necessária para L1–L10 e para confirmar o risco crítico de RLS em `access_grants`**.
3. **D2 — decisão sobre `tyre_suppliers`** (coluna nova × correção da RPC).
4. **D3 — criação do baseline de schema.**
5. **D4 — destino da RPC `consume_invite_code` e do `grant execute to authenticated`.**
6. **D6 — commit do trabalho ALFA-011→015** (74 entradas não versionadas).
7. **D7 — escopo das policies de `access_grants`/`access_events`** (RLS-only × RLS+policies).
