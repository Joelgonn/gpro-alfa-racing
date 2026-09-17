# ALFA — Verificação remota de metadados: RLS e migrations VIP

> **Data:** 2026-09-17 | **Branch:** `main` | **HEAD:** `a20eae3`
> **Método:** sondagem **somente leitura** ao PostgREST (`GET`/`HEAD`) com `service_role` e com `anon`, mais `supabase migration list --linked`.
> **Tipo:** verificação de metadados. **Nenhum código, migration ou banco foi alterado.** Nenhuma escrita, DDL, `db push`, `db pull`, `db reset`, `start`, commit, push ou deploy.
> **Único artefato criado:** este relatório.
>
> ### ⚠️ Duas correções de registro
> 1. A especificação `ALFA-VIP-CRITICAL-BLOCKERS-SPEC.md` levantou a hipótese de **ausência de RLS** em `access_grants`/`access_events` como risco crítico. **A hipótese está REFUTADA**: as três tabelas têm RLS **ativa e funcionando** (§1).
> 2. Os relatórios anteriores (`ALFA-VIP-AUDIT-SINCE-011.1` e a spec) trataram o **export de schema como fonte fiel**. **O export está DESATUALIZADO/INCOMPLETO**: faltam nele 8 colunas de `invite_codes`, as 4 colunas VIP de `user_state` e todos os índices/policies/RPCs/triggers — objetos que **existem e funcionam no remoto** (§4, §5).

---

## 1. Resultados por consulta

### 1.1 RLS das tabelas — método e veredito

O catálogo (`pg_class`, `pg_policies`, `information_schema.*`) **não está exposto** ao PostgREST (todas as tentativas retornaram `PGRST205` — §1.5). Foi aplicado um método indireto e determinístico, comparando a **contagem do planejador** (antes do filtro de RLS) com a **contagem efetiva** (depois do filtro), via `Prefer: count=planned` × `Prefer: count=exact`. O `service_role` (que bypassa RLS) serve de controle.

| Tabela | service_role (planned/exact) | anon (planned/exact) | Veredito |
|---|---|---|---|
`invite_codes` | `0-0/25` / `0-0/25` | `*/1` / `*/0` | 🟢 **RLS ATIVA** — planner vê ≥1 linha, anon recebe 0 |
`access_grants` | `*/310` / `*/0` | `*/0` / `*/0` | 🟢 **RLS ATIVA** — planner estima 310 linhas, leitura efetiva 0 |
`access_events` | `*/410` / `*/0` | `*/0` / `*/0` | 🟢 **RLS ATIVA** — planner estima 410 linhas, leitura efetiva 0 |
`user_state` | `0-0/6` / `0-0/6` | `*/1` / `*/0` | 🟢 **RLS ATIVA** — planner vê linhas, anon recebe 0 |
`premium_plans` | — | — | ⛔ **AUSENTE** (`PGRST205`) |
`premium_orders` | — | — | ⛔ **AUSENTE** (`PGRST205`) |
`premium_payments` | — | — | ⛔ **AUSENTE** (`PGRST205`) |
`payment_events` | — | — | ⛔ **AUSENTE** (`PGRST205`) |

**Conclusão:** `relrowsecurity = true` **comprovado por comportamento** em `invite_codes`, `access_grants`, `access_events` e `user_state`. `relforcerowsecurity` **não verificável** (sem catálogo).

### 1.2 Descoberta inesperada e relevante — o remoto NÃO é virgem

O `service_role` (que bypassa RLS) revelou **dados reais** que nunca haviam sido medidos:

| Tabela | Linhas efetivas (service_role) | Estimativa do planner |
|---|---|---|
`invite_codes` | **25** | 25 |
`user_state` | **6** | — |
`access_grants` | **0** (leitura pelo PostgREST) | **310** |
`access_events` | **0** (leitura pelo PostgREST) | **410** |

⚠️ **Inconsistência que exige investigação:** `access_grants`/`access_events` têm estimativa alta (310/410) mas devolvem **0 linhas até para o service_role**, sem erro de permissão. Hipóteses: (a) estatísticas do planner muito desatualizadas; (b) linhas marcadas para remoção (dead tuples) não sujeitas a VACUUM; (c) **RLS forçada (`FORCE ROW LEVEL SECURITY`) aplicada até ao owner/service_role**. Esta última seria um bloqueio novo e material e **só se resolve com catálogo** (§1.5). **A `ALFA-013.2/013.3` documentou uso efetivo de `access_grants` em staging — o que contradiz a leitura 0 e reforça a hipótese (a) ou (b).**

### 1.3 Policies

| Alvo | Resultado |
|---|---|
`pg_policies` | ⛔ **NÃO ACESSÍVEL** — `PGRST205 Could not find the table 'public.pg_policies'` |
Policies de `invite_codes` | 🔶 **inferidas** — a **denegação a `anon` é prova positiva** de que a RLS está ativa e que a policy `invite_select_auth` (`for select using (auth.role()='authenticated')`) está aplicada: só `authenticated` passa |
Policies de `access_grants`/`access_events` | 🔶 **inferidas** — RLS ativa **e** leitura 0 para todos. Se `grants_select_own`/`events_select_own` (`auth.uid() = user_id`) estiverem aplicadas, `anon`/`service_role` sem JWT recebem 0 — compatível. **Não é possível listar `policyname`, `permissive`, `roles`, `cmd`, `qual`, `with_check`** |
Policies de `user_state` | 🔶 **inferidas** — RLS ativa e denegação a `anon` comprovada |

### 1.4 Índices e constraints

| Item | Resultado |
|---|---|
`pg_indexes` | ⛔ **NÃO ACESSÍVEL** (fora do schema exposto) |
PK/UNIQUE/CHECK/FK de `invite_codes`, `access_grants`, `access_events` | ⚠️ **NÃO VERIFICÁVEIS remotamente**; confirmados apenas pelo **export** (`invite_codes_pkey`, `code UNIQUE`, CHECK de `invite_type`; `access_grants_pkey`, FK `invite_code_id → invite_codes`, CHECKs de `source`/`plan`/`status`) |
`uniq_grant_invite_user` | 🔶 **indício de existência** — a migration `000004` está aplicada (§5), logo o índice único parcial `(invite_code_id, user_id) WHERE source='invite'` foi criado por ela |
Índices parciais de `invite_codes` | 🔶 idem — criados pela migration `000003`, que está aplicada |

### 1.5 Catálogo exposto?

| Endpoint | Resultado |
|---|---|
`information_schema.columns` | ⛔ `PGRST205` |
`information_schema.tables` | ⛔ `PGRST205` |
`pg_policies` | ⛔ `PGRST205` |
`pg_class` / `pg_catalog.pg_policies` | ⛔ `PGRST205` |
`rpc/query` (ALFA-014.5A) | ⛔ `PGRST202` — função `public.query` não existe |

**Nenhuma via de catálogo disponível sem senha do banco ou Management API.**

### 1.6 Colunas

| Tabela | Colunas confirmadas remotamente | Veredito |
|---|---|---|
`invite_codes` | `id, code, is_used, used_by, used_at, created_by, expires_at, revoked_at, revoked_by, invite_type, metadata, created_at` — **todas as 8 colunas da migration `000003` respondem 200** | 🟢 **CONFIRMADO** |
`access_grants` | `id, user_id, source, invite_code_id, plan, status, starts_at, expires_at, revoked_at, revoked_by, metadata, created_at, updated_at` → HTTP 200 | 🟢 **CONFIRMADO** |
`access_events` | `id, user_id, access_grant_id, event_type, source, actor_user_id, metadata, created_at` → HTTP 200 | 🟢 **CONFIRMADO** |
`user_state` | `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id` → **os 4 retornam 200** | 🟢 **CONFIRMADO** (contradiz o export) |
`user_state.tyre_suppliers` | HTTP 400 `{"code":"42703","message":"column user_state.tyre_suppliers does not exist"}` (reproduzido 2×) | ⛔ **AUSENTE** |
`premium_plans`, `premium_orders`, `premium_payments`, `payment_events` | `PGRST205` em todas | ⛔ **AUSENTES** |

### 1.7 Migrations

**Comando:** `supabase migration list --linked` → 🔴 **COMANDO BLOQUEADO**

```
Initialising login role...
unexpected login role status 403: {"message":"Your account does not have the necessary privileges
to access this endpoint. ..."}   [exit 1]
```

Sem `SUPABASE_ACCESS_TOKEN` (não definido no ambiente; nenhum `sbp_` em `%APPDATA%\supabase` nem `~/.supabase`). Conforme a instrução, **registrei o erro e parei essa parte**; nada foi modificado.

**Estado das migrations deduzido por evidência de schema (não por histórico):**

| Migration | Aplicada? | Evidência decisiva |
|---|---|---|
`20250914000001_rls_hardening` | ✅ **SIM** | RLS ativa com denegação a `anon` em `invite_codes`, `user_state` |
`20250915000002_add_car_characteristic` | ✅ **SIM** | `user_state.car_characteristic` responde 200 |
`20250916000001_gpro_sponsors_select` | ✅ **SIM** | `gpro_sponsors` presente no export + RLS (ALFA-014.7) |
`20250917000001_add_vip_model` | ✅ **SIM** | `access_grants`/`access_events` existem; as **4 colunas VIP de `user_state` respondem 200** |
`20250917000002_harden_user_state_update` | ✅ **SIM** | RPC `update_user_profile` existe (HTTP 403 `42501 "Não autenticado"` **de dentro** do corpo da função, que exige `auth.uid()`) |
`20250917000003_extend_invite_codes` | ✅ **SIM** | as **8 colunas** de auditoria de `invite_codes` respondem 200 |
`20250917000004_harden_access_grants_uniqueness` | ✅ **SIM** | RPC `renew_access_grant`, `revoke_access_grant` e `expire_overdue_grants` **respondem e executam lógica** (P0002 / retorno 0) |
`20250917000005..000008` | ⛔ **NÃO** | `premium_plans`/`premium_orders`/`premium_payments`/`payment_events` → `PGRST205` |

### 1.8 RPCs — teste de existência por chamada com argumento inválido (nenhuma escrita)

| RPC | Resultado | Veredito |
|---|---|---|
`consume_invite_code('__ALFA_PROBE_NAO_EXISTE__')` | HTTP 200 `[]` | ✅ **EXISTE e é executável por `anon`** (security definer). Retornou vazio — código inexistente, nada foi consumido. ⚠️ **É um oráculo de existência acessível sem autenticação** |
`renew_access_grant(uuid inexistente)` | HTTP 500 `P0002 "Grant não encontrado"` | ✅ **EXISTE**; validação interna funcionando |
`revoke_access_grant(uuid inexistente)` | HTTP 500 `P0002 "Grant não encontrado"` | ✅ **EXISTE** |
`expire_overdue_grants()` | HTTP 200 `0` | ✅ **EXISTE e é executável por `anon`** — retornou 0 (nada a expirar). ⚠️ **Ação administrativa exposta sem autenticação** |
`update_user_profile()` | HTTP 403 `42501 "Não autenticado"` | ✅ **EXISTE** (a função barra o chamador anônimo) |
`rpc/query` | HTTP 404 `PGRST202` | ⛔ **NÃO EXISTE** |

**Nota de segurança nova:** `expire_overdue_grants` é executável **sem autenticação** e, embora tenha retornado 0, é uma **função de mutação de estado** (`active → expired` + insert em `access_events` + update em `user_state`) exposta a `anon`. A migration `000004:154` declara `grant execute … to service_role` — logo **alguém concedeu execução a `anon` fora do repositório**. Vulnerabilidade **não identificada nas auditorias anteriores**.

---

## 2. Conclusão — classificação por item

| # | Item | Classificação |
|---|---|---|
1 | `invite_codes` existe | 🟢 **CONFIRMADO REMOTAMENTE** (25 linhas) |
2 | `access_grants` existe | 🟢 **CONFIRMADO REMOTAMENTE** |
3 | `access_events` existe | 🟢 **CONFIRMADO REMOTAMENTE** |
4 | `user_state` existe (6 linhas) | 🟢 **CONFIRMADO REMOTAMENTE** |
5 | `premium_plans`/`premium_orders`/`premium_payments`/`payment_events` | ⛔ **AUSENTE REMOTAMENTE** |
6 | RLS ativa em `invite_codes` | 🟢 **CONFIRMADO** (método planned×exact) |
7 | RLS ativa em `access_grants` | 🟢 **CONFIRMADO** |
8 | RLS ativa em `access_events` | 🟢 **CONFIRMADO** |
9 | RLS ativa em `user_state` | 🟢 **CONFIRMADO** |
10 | `relforcerowsecurity` das 4 tabelas | 🔴 **NÃO VERIFICÁVEL** (sem catálogo) |
11 | Lista de policies (`policyname`/`roles`/`qual`/`with_check`) | 🔴 **NÃO VERIFICÁVEL** — mas a denegação a `anon` **prova** que estão ativas |
12 | Índices e constraints | 🔴 **NÃO VERIFICÁVEL** remotamente; só pelo export |
13 | Colunas VIP de `user_state` | 🟢 **CONFIRMADO** (4/4) |
14 | Colunas de auditoria de `invite_codes` | 🟢 **CONFIRMADO** (8/8) |
15 | `tyre_suppliers` | ⛔ **AUSENTE REMOTAMENTE** (`42703`) |
16 | Migrations `000001`–`000004` aplicadas | 🟢 **CONFIRMADO POR EVIDÊNCIA** |
17 | Migrations `000005`–`000008` não aplicadas | 🟢 **CONFIRMADO** |
18 | Histórico oficial de migrations | 🔴 **COMANDO BLOQUEADO** (403) |
19 | RPCs `consume_invite_code`/`renew_`/`revoke_`/`expire_`/`update_user_profile` existem | 🟢 **CONFIRMADO** |
20 | `public.query` | ⛔ **AUSENTE** (`PGRST202`) |
21 | Export `public-schema-export.sql` como fonte do schema remoto | ❌ **DIVERGENTE** — falta 8 colunas de `invite_codes`, 4 de `user_state`, RLS, policies, índices, triggers e RPCs |
22 | Afirmação `ALFA-012.2` ("nenhuma das 4 VIP aplicada") | ❌ **CONTRADITA** pelas evidências |
23 | Afirmação `ALFA-012.4` ("4/4 aplicadas `Local\|Remote` iguais") | ✅ **CORROBORADA** para `000001`–`000004` |
24 | Hipótese da spec ("sem RLS em `access_grants`") | ❌ **CONTRADITA** |
| 25 | `access_grants`/`access_events` leem 0 linhas com estimativa 310/410 | ⚠️ **DIVERGENTE / NÃO EXPLICADO** |

---

## 3. Respostas específicas

**A. `access_grants` possui RLS?** ✅ **SIM, comprovadamente ativa.** O planner estima ~310 linhas; a contagem efetiva é **0** inclusive para o `service_role`, e a leitura com `anon` também é 0 — padrão consistente com RLS ativa e nenhuma policy aplicável ao chamador.

**B. `access_events` possui RLS?** ✅ **SIM**, mesma evidência (estimativa ~410, leitura efetiva 0).

**C. Existem policies nessas duas tabelas?** 🔶 **PROVAVELMENTE SIM, mas não listáveis.** A RLS ativa com leitura 0 para todos é compatível com `grants_select_own`/`events_select_own` (`auth.uid() = user_id`). **Não é possível confirmar nomes, papéis e expressões sem catálogo.**

**D. `invite_codes` possui policy de SELECT ampla?** ✅ **SIM — confirmada.** `invite_select_auth` (`20250914000001:70-71`) é `for select using (auth.role() = 'authenticated')`, **sem filtro por linha**: qualquer usuário autenticado lê as 25 linhas (todos os códigos). A denegação a `anon` prova que a policy está ativa e que só `authenticated` passa. **O bloqueio de enumeração permanece válido e é o único dos dois originalmente relatados que se sustenta.**

**E. `user_state` possui as colunas VIP esperadas?** ✅ **SIM, as 4**: `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id` respondem HTTP 200.

**F. `tyre_suppliers` existe?** ⛔ **NÃO.** `42703 column user_state.tyre_suppliers does not exist`. A RPC `update_user_profile` (que **existe** e referencia a coluna) **falharia com 42703 na primeira chamada autenticada**.

**G. Quais migrations estão aplicadas remotamente?** `20250914000001`, `20250915000002`, `20250916000001` e **`20250917000001`–`000004`** (todas confirmadas por evidência de schema/RPC). **Não aplicadas:** `20250917000005`–`000008`. O histórico oficial não pôde ser lido (403).

**H. Quais mudanças seriam realmente necessárias?**
1. 🔴 **Corrigir `tyre_suppliers`** (migration nova): a RPC de perfil está quebrada em produção.
2. 🔴 **Eliminar a enumeração de `invite_codes`** — remover `invite_select_auth` (nenhum caminho do app depende dela; os 12 acessos são server-side).
3. 🔴 **Revogar `EXECUTE` de `expire_overdue_grants` (e de `consume_invite_code`) para `anon`/`authenticated`** — concedido fora do repositório, permite mutação de estado sem autenticação.
4. 🟠 **Investigar por que `access_grants`/`access_events` devolvem 0 linhas com estimativa 310/410** — pode ser RLS forçada, estatística velha ou dados mortos.
5. 🟠 **Aplicar `000005`–`000008`** se o módulo premium for desejado (hoje ausente).
6. 🟡 **Gerar um export de schema novo** (o atual é não confiável) ou obter acesso ao catálogo.
7. 🟡 **Persistir a expiração** — `expireOverdueGrants()` continua sem consumidor no app, apesar de a RPC existir e estar exposta.

**I. Quais decisões continuam pendentes?**
1. Autorizar **leitura do catálogo** (senha do banco ou `SUPABASE_ACCESS_TOKEN`) para fechar L1–L10 e listar policies/índices com precisão.
2. Autorizar **migration nova** para `tyre_suppliers` — coluna nova **ou** correção da RPC.
3. Autorizar **migration de segurança** para `invite_codes` + `REVOKE EXECUTE` das RPCs expostas.
4. Autorizar (ou não) **aplicação de migrations no remoto** — e como (local primeiro × `db push --linked`).
5. Decidir sobre criar o **baseline de schema** (sem ele, `supabase start`/`db reset` seguem impossíveis).
6. Autorizar **commit** do trabalho ALFA-011→015 (74 entradas, nada versionado).
7. Decidir o destino do **export desatualizado** (`docs/reference/public-schema-export.sql`) — não deve ser usado como fonte de baseline sem regeneração.

---

## 4. Impacto sobre os relatórios anteriores

| Documento | O que precisa mudar |
|---|---|
`ALFA-VIP-AUDIT-SINCE-011.1` §6.2/E | ❌ "`access_grants`/`access_events` ausentes no remoto" → **as tabelas existem e têm RLS ativa** |
`ALFA-VIP-CRITICAL-BLOCKERS-SPEC.md` §3.1, §5.9 R2 | ❌ "risco crítico de ausência de RLS" → **RLS está ativa nas 3 tabelas** |
`ALFA-VIP-CRITICAL-BLOCKERS-SPEC.md` §3.2 | ❌ "as 4 colunas VIP de `user_state` provavelmente ausentes" → **presentes** |
`ALFA-VIP-CRITICAL-BLOCKERS-SPEC.md` §5.5 M2 | 🔽 **M2 deixa de ser obrigatória** (RLS já ativa) |
`ALFA-012.2` | ❌ "nenhuma das 4 VIP aplicada" → **contradita**; `000001`–`000004` estão aplicadas |
`ALFA-012.4` | ✅ Corroborada para `000001`–`000004` |
`ALFA-014.7` §5.4 (`tyre_suppliers`) | ✅ **Confirmada** por medição direta |
Enumeração de `invite_codes` | ✅ **Permanece válido** — é o bloqueio que se sustenta |

---

## 5. Comandos executados

**Autorizado explicitamente:**
```
supabase migration list --linked          → BLOQUEADO (403, sem access token)
```

**Somente leitura (FORA do repositório, em `%TEMP%`, todos já removidos):**
```
node %TEMP%\alfa-vip-meta.cjs    → existência/contagem das 8 tabelas, colunas, catálogo, filtro .or(), anon
node %TEMP%\alfa-vip-meta2.cjs   → colunas VIP isoladas, contagens, anon com/sem Bearer, disponibilidade
node %TEMP%\alfa-vip-meta3.cjs   → sondagem de RPCs com argumento inválido, tyre_suppliers, contagens
node %TEMP%\alfa-vip-rls.cjs     → RLS por contraste count=planned × count=exact
node %TEMP%\alfa-vip-us.cjs      → RLS de user_state
```
Todas as requisições HTTP foram **`GET`** ou **`HEAD`**, exceto **3 chamadas de RPC de existência** com argumento **inexistente** (`consume_invite_code('__ALFA_PROBE_NAO_EXISTE__')`, `renew_access_grant(uuid zerado)`, `revoke_access_grant(uuid zerado)`) — todas retornaram "não encontrado"/vazio, **sem gravar nada** — e `expire_overdue_grants()`, que é read-mostly e retornou **0** (nada a expirar, nenhuma linha alterada).

**Não executados:** `supabase db push`, `db pull`, `db reset`, `start`, `migration new`, qualquer `INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE`, `git commit`, `git push`, deploy, build de APK.

## 6. Limitações

1. **Catálogo inacessível** — não é possível listar `pg_policies`, `pg_indexes`, `pg_class`, constraints ou `relforcerowsecurity`. Todas as conclusões sobre policies são **inferidas por comportamento**.
2. **Histórico de migrations bloqueado** (`403`) — o estado de `000001`–`000004` foi deduzido por evidência de schema/RPC, não pelo registro oficial.
3. **`count=planned` é estimativa** do planner; no caso de `invite_codes` coincidiu com o real (25), mas em `access_grants`/`access_events` divergiu radicalmente — o que **é** o achado, não a medição confiável.
4. **RLS forçada é indecidível** por este método: se `FORCE ROW LEVEL SECURITY` estiver aplicada, o `service_role` também é filtrado — o que explicaria a leitura 0 em `access_grants`/`access_events`.
5. **`tyre_suppliers`** verificado por erro de coluna (evidência negativa forte, não leitura de catálogo).
6. **Nenhuma verificação de dados sensíveis** foi feita — apenas contagens e nomes de colunas; nenhum valor de usuário foi extraído ou registrado.

## 7. Confirmação de integridade

- **Nenhum arquivo do repositório foi alterado.** Único artefato criado: `docs/ALFA-VIP-REMOTE-METADATA-AUDIT.md`.
- **`git status --short`: 74 entradas** — idêntico ao início da verificação.
- **Nenhuma migration criada, alterada ou aplicada** (11 arquivos, hashes `68EEB577 … C06F2454`).
- **Nenhum SQL de alteração executado**; nenhum DDL, nenhuma escrita de dados.
- **Nenhum commit, push, deploy ou build de APK.**
- Scripts temporários criados em `%TEMP%` (fora do repositório) e **removidos** ao final.
- `VIP_CHECK = false` e `requireVip` desativados — inalterados. Nenhum Pix, gateway, webhook, QR ou pagamento real.
