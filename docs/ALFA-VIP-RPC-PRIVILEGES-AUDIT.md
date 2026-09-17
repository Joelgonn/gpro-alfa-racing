# ALFA — Auditoria de privilégios das RPCs VIP

> **Data:** 2026-09-17 | **Branch:** `main` | **HEAD:** `a20eae3`
> **Método:** metadados locais (`supabase/migrations`) + OpenAPI do PostgREST (`service_role`) + sondagens **não destrutivas** (`GET`/`OPTIONS`/`HEAD` — **nenhum `POST` com dados válidos**).
> **Modo:** somente leitura. Nenhum código, migration ou banco alterado. Sem `REVOKE`, `GRANT`, DDL, DML, `db push|pull|reset|start`, commit, push, deploy ou APK.
> **Único artefato criado:** este relatório.

---

## 1. Resumo executivo

🔴 **Exposição CONFIRMADA de duas funções ao `anon`:**

1. **`public.expire_overdue_grants()`** — executável **sem autenticação**. Prova: `GET /rest/v1/rpc/expire_overdue_grants` com a anon key **executou a função** (retornou `405` com `{"code":"25006","message":"cannot execute SELECT FOR UPDATE in a read-only transaction"}`). O PostgREST executa RPC via `GET` em **transação READ ONLY**, então a execução foi interrompida no `FOR UPDATE` — mas isso **prova que o privilégio EXECUTE existe e que todas as linhas anteriores do corpo rodaram**. Um `POST` (writeable) executaria a mutação completa.
2. **`public.consume_invite_code(text)`** — executável por `anon` via `POST` (registrado na tarefa anterior: `POST` com `{"p_code":"__ALFA_PROBE_NAO_EXISTE__"}` → **HTTP 200 `[]`**, código inexistente, nada consumido). Função `SECURITY DEFINER` com `UPDATE` que marca `is_used=true`.

**Agravante estrutural:** as **5 funções auditadas são `SECURITY DEFINER`** com `owner = postgres` (equivalente a `BYPASSRLS`). Portanto qualquer chamador com `EXECUTE` **contorna a RLS** — a RLS ativa (confirmada em `ALFA-VIP-REMOTE-METADATA-AUDIT.md`) **não** é barreira para esses caminhos.

**Divergência confirma out-of-band grants:** os 3 arquivos de migration concedem `EXECUTE` **apenas** a `authenticated` e `service_role` (`000002:161-162`, `000003:72-73`, `000004:152-154`) — **nenhum `GRANT … TO anon` existe no repositório**. Mesmo assim `anon` executa. Conclusão: **os privilégios no remoto foram concedidos fora do controle de migrations** (provavelmente `GRANT … TO PUBLIC`, que é o comportamento mais comum em Supabase/`ALTER DEFAULT PRIVILEGES`).

---

## 2. Metadados encontrados

### 2.1 Assinatura, corpo e privilégios declarados (fonte local: `supabase/migrations`)

| Função | Assinatura | Retorno | Linguagem | Security | search_path | Grants declarados no repo |
|---|---|---|---|---|---|---|
`consume_invite_code` | `(p_code text)` | `table(id uuid, code text, invite_type text, expires_at timestamptz)` | plpgsql | **DEFINER** | `public` | `000003:72-73` → `authenticated`, `service_role` |
`expire_overdue_grants` | `()` | `int` | plpgsql | **DEFINER** | `public` | `000004:154` → `service_role` |
`renew_access_grant` | `(p_grant_id uuid, p_actor_user_id uuid default null)` | `public.access_grants` | plpgsql | **DEFINER** | `public` | `000004:152` → `service_role` |
`revoke_access_grant` | `(p_grant_id uuid, p_actor_user_id uuid default null)` | `public.access_grants` | plpgsql | **DEFINER** | `public` | `000004:153` → `service_role` |
`update_user_profile` | `(p_track text default null, … 19 parâmetros …)` | `public.user_state` | plpgsql | **DEFINER** | `public` | `000002:161-162` → `authenticated`, `service_role` |

**Nenhum `REVOKE` explícito em nenhuma migration** (0 ocorrências de `revoke` em `supabase/migrations/**`).
**Nenhum `GRANT … TO anon` e nenhum `GRANT … TO PUBLIC`** declarado no repositório.

### 2.2 Owner, volatility e privilégios reais (remoto)

| Item | Resultado |
|---|---|
Owner | 🔴 **NÃO VERIFICÁVEL** — catálogo não exposto; as funções foram criadas por `postgres` via migration ⇒ owner `postgres` (BYPASSRLS) |
Volatility | 🔴 **NÃO VERIFICÁVEL** in loco; nenhuma função declara `volatile`/`stable`/`immutable` ⇒ **`VOLATILE` por padrão** |
`search_path` | ✅ **`public`** declarado em todas as 5 (mitiga hijacking) |
EXECUTE para `anon` | 🔴 **CONFIRMADO PRESENTE** em `expire_overdue_grants` (execução) e `consume_invite_code` (POST 200) |
EXECUTE para `authenticated` | ✅ declarado em `000003:72` e `000002:161` (2 funções); **provável por herança de `PUBLIC`** nas demais |
EXECUTE para `service_role` | ✅ declarado nas 5 |
Grant público (`PUBLIC`) | 🔴 **PROVÁVEL** — é a única explicação para `anon` executar funções sem `GRANT … TO anon` |
REVOKE explícito | ❌ **INEXISTENTE** no repositório e, pela evidência de execução, **também ausente no remoto** |

### 2.3 Sondagens não destrutivas — resultados

**OpenAPI do PostgREST (`/rest/v1/`, `Accept: application/openapi+json`):**

| Chave | Resultado |
|---|---|
anon | ⛔ **HTTP 401** `{"message":"Invalid API key","hint":"Only the service_role API key can be used for this endpoint."}` |
service_role | ✅ HTTP 200 — spec completa (86.365 bytes, `title: "standard public schema"`, `version: 14.5`) |

**18 paths expostos** (13 tabelas + **5 RPCs**): `/`, `/access_grants`, `/access_events`, `/api_knowledge_base`, `/calendario_temporada`, `/energy_observations`, `/gpro_import_snapshots`, `/gpro_sponsors`, `/gpro_sponsors_metadata`, `/invite_codes`, `/market_drivers`, `/user_planning`, `/user_state`, **`/rpc/consume_invite_code`**, **`/rpc/expire_overdue_grants`**, **`/rpc/renew_access_grant`**, **`/rpc/revoke_access_grant`**, **`/rpc/update_user_profile`**.

> As 5 RPCs estão em `paths` — significa que a **direção `service_role` as expõe**. A spec do PostgREST lista funções por *schema* (`public`), não por role; a verificação de `EXECUTE` ocorre em runtime.

**`GET /rpc/<fn>` (PostgREST exige `POST`: um `405`/execução indica que a função resolveu; `404 PGRST202` é ambíguo entre "não existe" e "sem privilégio"):**

| Função | anon | service_role | Leitura |
|---|---|---|---|
`expire_overdue_grants` | **405** `25006 cannot execute SELECT FOR UPDATE in a read-only transaction` | **405** (idêntico) | 🔴 **EXECUTOU** — privilégio presente; a transação READ ONLY do `GET` impediu a mutação |
`consume_invite_code` | 404 `PGRST202 … without parameters` | 404 (idêntico) | ⚠️ **ambíguo** — falta de overload sem parâmetros, não prova de falta de privilégio |
`renew_access_grant` | 404 `PGRST202` | 404 (idêntico) | ⚠️ ambíguo (requer `p_grant_id`) |
`revoke_access_grant` | 404 `PGRST202` | 404 (idêntico) | ⚠️ ambíguo |
`update_user_profile` | 401 `42501 "Não autenticado"` | 403 `42501 "Não autenticado"` | ✅ **EXECUTOU e recusou o chamador** dentro do corpo (`auth.uid()` nulo) — **autorização interna presente** |
**Controle:** `rpc/nao_existe_alfa_probe` → 404 `PGRST202` em anon **e** em service_role (confirma que o método não distingue privilégio).

**`OPTIONS /rpc/<fn>`:** HTTP 200 nas 5 com anon — **não discriminante** (handlers de API respondem a OPTIONS), registrado como limitação.

### 2.4 Dependências e tabelas acessadas (por leitura do corpo das funções)

| Função | Tabelas tocadas | Operações |
|---|---|---|
`consume_invite_code` | `invite_codes` | `SELECT … INTO v_row` + **`UPDATE`** (`is_used=true`, `used_at=now()`, `used_by=auth.uid()`) |
`expire_overdue_grants` | `access_grants`, `access_events`, `user_state` | `SELECT … FOR UPDATE` + **`UPDATE`** `status='expired'` + **`INSERT`** evento `expired` + **`UPDATE`** `user_state.vip_status='expired'` |
`renew_access_grant` | `access_grants`, `access_events`, `user_state` | `SELECT … FOR UPDATE` + **`UPDATE`** `expires_at`/`status='active'` + **`INSERT`** evento `renewed` + **`UPDATE`** `user_state` |
`revoke_access_grant` | `access_grants`, `access_events`, `user_state` | `SELECT … FOR UPDATE` + **`UPDATE`** `status='revoked'` + **`INSERT`** evento `revoked` + **`UPDATE`** `user_state` |
`update_user_profile` | `user_state` | **`UPDATE`** (allowlist de 19 campos) com fallback **`INSERT`** |

**Todas as 5 são funções de MUTAÇÃO** (exceto o ramo "não encontrado").

---

## 3. Confirmação do fluxo (verificação no código)

| Verificação | Resultado | Evidência |
|---|---|---|
`consume_invite_code` é chamada por algum endpoint? | ❌ **NÃO** — 0 chamadas a `rpc('consume_invite_code')` em todo o `app/**` | busca global |
`expire_overdue_grants` é chamada por endpoint, job ou UI? | ❌ **NÃO** — a RPC é invocada **apenas** em `app/lib/access/accessService.ts:848` (`expireOverdueGrants()`), que por sua vez **não tem nenhum consumidor** em rotas/páginas | `accessService.ts:846,848` + busca de consumidores: 0 |
O fluxo atual usa implementação TypeScript? | ✅ **SIM** — `app/actions/signup.ts:118-127` faz o consumo atômico direto via `supabaseAdmin` (`UPDATE … .eq('is_used', false) …`), e `signup.ts:111` documenta: *"Equivalente à RPC `consume_invite_code`, mas com `used_by` explícito (service_role não tem `auth.uid()`)"* | `signup.ts:111,118-127` |
Alguma função pode ser chamada diretamente pelo PostgREST? | ✅ **SIM** — as 5 estão expostas em `/rpc/*`; `expire_overdue_grants` e `consume_invite_code` **comprovadamente executáveis por `anon`** | §2.3 |
Existe autenticação/autorização dentro da própria função? | 🔶 **PARCIAL** — apenas `update_user_profile` valida o chamador (`if v_user_id is null then raise exception 'Não autenticado' using errcode='42501'`). **`expire_overdue_grants` (0 args) e `consume_invite_code` NÃO têm nenhuma verificação de papel ou de identidade.** `renew`/`revoke` recebem `p_actor_user_id` como **parâmetro**, sem validar quem chama | `000002:113-115`, `000004:124-148`, `000003:43-68` |

**Conclusão do fluxo:** **nenhuma** das 5 RPCs é necessária ao funcionamento atual do produto. Duas estão expostas a `anon`, uma delas (`expire_overdue_grants`) é **puramente administrativa** e existe para ser chamada por um endpoint que **nunca foi criado**.

---

## 4. Classificação por função

| Função | Classificação | Fundamento |
|---|---|---|
`expire_overdue_grants()` | 🔴 **EXPOSIÇÃO CONFIRMADA** — **deve ser restrita** | Executada por `anon` (prova §2.3); `SECURITY DEFINER`; mutação em 3 tabelas; 0 argumentos (sem barreira); 0 consumidor no app |
`consume_invite_code(text)` | 🔴 **EXPOSIÇÃO CONFIRMADA** — **deve ser restrita** | `POST` anônimo retornou 200; `SECURITY DEFINER`; grava `is_used=true`; 0 consumidor no app |
`update_user_profile(19 args)` | 🟠 **EXPOSIÇÃO PROVÁVEL, com autorização interna** — seguro para `anon` **na prática** | Executa e recusa por `42501` quando não há `auth.uid()`. Correto por design; ainda assim é `SECURITY DEFINER` alcançável sem autenticação |
`renew_access_grant(uuid,uuid)` | ⚫ **NÃO VERIFICÁVEL** — tratar como **restrita** | `GET` dá `404 PGRST202` ambíguo (falta de overload sem parâmetros, não falta de privilégio). Dado que `anon` executa as outras, **assumir exposição** até prova em contrário |
`revoke_access_grant(uuid,uuid)` | ⚫ **NÃO VERIFICÁVEL** — tratar como **restrita** | idem |

---

## 5. Respostas A–H

**A. `expire_overdue_grants` pode ser executada por `anon`?** 🔴 **SIM — confirmado.** `GET` com anon retornou `405` + `25006 cannot execute SELECT FOR UPDATE in a read-only transaction`, ou seja: PostgREST **resolveu, autorizou e executou** a função; a falha veio do `FOR UPDATE` em transação de leitura. Um `POST` anônimo executaria a mutação completa (loop `active → expired`, `INSERT` em `access_events`, `UPDATE` em `user_state`). *(A chamada `POST` registrada em tarefa anterior retornou `0` porque não havia grants vencidos — nenhuma linha foi alterada.)*

**B. `consume_invite_code` pode ser executada por `anon`?** 🔴 **SIM — confirmado.** `POST` anônimo com código inexistente retornou **HTTP 200 `[]`**. Com um código **válido**, a função marcaria `is_used=true`, `used_at=now()`, `used_by=auth.uid()` (**NULL** sob `anon`) — **queimando o convite sem deixar rastro de quem o usou** e sem autenticação.

**C. Alguma função é `SECURITY DEFINER`?** ✅ **TODAS as 5.** `consume_invite_code` (`000003:46`), `expire_overdue_grants` (`000004:127`), `renew_access_grant` (`000004:45`), `revoke_access_grant` (`000004:92`), `update_user_profile` (`000002:106`). Executam com os privilégios do owner (`postgres`, `BYPASSRLS`) ⇒ **a RLS ativa não protege esses caminhos**.

**D. Alguma função possui `search_path` inseguro?** ✅ **NÃO.** As 5 declaram `set search_path = public`. Problema **ausente** — o padrão correto foi seguido. *(Residual: fixar em `public` permite dependência de objetos do schema `public`; o endurecimento ideal é `SET search_path = ''` com nomes totalmente qualificados — melhoria, não vulnerabilidade.)*

**E. Quais privilégios precisam ser revogados?**

```sql
-- proposta, NÃO executada
revoke execute on function public.expire_overdue_grants()            from public, anon, authenticated;
revoke execute on function public.consume_invite_code(text)          from public, anon, authenticated;
revoke execute on function public.renew_access_grant(uuid, uuid)     from public, anon, authenticated;
revoke execute on function public.revoke_access_grant(uuid, uuid)    from public, anon, authenticated;
-- manter intencionalmente:
--   update_user_profile → authenticated (é o caminho legítimo de perfil)
--   todas as 5 → service_role
```
O `from public` é essencial: é a origem provável do `EXECUTE` que o `anon` herda.

**F. Quais funções devem ficar exclusivas de `service_role`?** `expire_overdue_grants`, `consume_invite_code`, `renew_access_grant`, `revoke_access_grant` — as quatro são administrativas/internas e **nenhuma tem consumidor no app**. `update_user_profile` deve permanecer em `authenticated` + `service_role` (é o único caminho de perfil com validação interna).

**G. Alguma função é necessária no fluxo atual?** ❌ **Nenhuma das 5.** O signup usa implementação TypeScript direta (`signup.ts:118-127`); a atualização de perfil usa o cliente; e não há endpoint, job ou UI chamando as RPCs. Removendo o `EXECUTE` de `anon`/`authenticated`, **nada quebra**.

**H. Há risco de mutação, enumeração ou bypass de autorização?** 🔴 **SIM, nos três eixos:**
- **Mutação sem autenticação:** `expire_overdue_grants()` (marca grants vencidos como `expired`, altera `user_state`, insere eventos) e `consume_invite_code(text)` (queima convites válidos).
- **Enumeração:** `consume_invite_code` é **oráculo de existência** (resposta vazia × resposta com dados) e retorna `code`, `invite_type` e `expires_at` — combinado com a policy `invite_select_auth` (SELECT amplo para `authenticated`), permite enumerar **e destruir** convites alheios.
- **Bypass de autorização:** `SECURITY DEFINER` + owner com `BYPASSRLS` + ausência de checagem de papel ⇒ a RLS e as policies **não são aplicadas** nesses caminhos. `renew`/`revoke` aceitam `p_actor_user_id` **como parâmetro**, sem validar quem invoca — permitindo forjar o autor da ação na trilha de auditoria.

---

## 6. Limitações

1. **`pg_proc.proacl` inacessível** (catálogo não exposto) — os privilégios efetivos foram **inferidos por comportamento**, não lidos. Não é possível listar `owner`, `provolatile`, `prosecdef` nem o ACL textual néo remoto.
2. **`GET`/`POST` não distinguem** "função inexistente" de "sem privilégio" (`PGRST202` é idêntico) — `renew_access_grant` e `revoke_access_grant` ficaram **não verificáveis** por este método.
3. **`OPTIONS` não é discriminante** (responde 200 para tudo).
4. **`anon` é bloqueado no endpoint OpenAPI** (401) — a spec só pôde ser lida com `service_role`, que **não** reflete os privilégios do `anon`.
5. **Não executei `POST` com argumentos válidos** (proibido pela tarefa e seria mutação real) — a exposição de `renew`/`revoke` permanece **provável**, não confirmada.
6. Nenhum dado, token ou ID de usuário foi extraído ou registrado.

---

## 7. Comandos executados

**Sondagens HTTP — somente `GET` / `OPTIONS` (nenhum `POST` com dados válidos):**

```
GET  /rest/v1/                                       (Accept: application/openapi+json)  → anon: 401 | service_role: 200
GET  /rest/v1/rpc/{consume_invite_code, expire_overdue_grants, renew_access_grant,
                  revoke_access_grant, update_user_profile}   → anon e service_role
GET  /rest/v1/rpc/nao_existe_alfa_probe                          → controle
OPTIONS /rest/v1/rpc/<as 5 funções>                              → anon
```
Scripts em `%TEMP%` (fora do repositório), **todos removidos** ao final (0 restantes).

**Análise estática (leitura):** `supabase/migrations/20250917000002, 000003, 000004`; `app/lib/access/accessService.ts`; `app/actions/signup.ts`; busca global de chamadas `rpc(...)`.

**Não executados:** `REVOKE`, `GRANT`, qualquer DDL/DML, `supabase db push|pull|reset|start`, `migration new`, `git commit`, `git push`, deploy, build de APK.

**Registro de chamadas anteriores (de tarefa prévia, para contexto):** `POST /rpc/consume_invite_code` com `{"p_code":"__ALFA_PROBE_NAO_EXISTE__"}` → 200 `[]` (anon e service_role); `POST /rpc/renew_access_grant` e `/revoke_access_grant` com UUID zerado → 500 `P0002 "Grant não encontrado"` (**com service_role**); `POST /rpc/expire_overdue_grants` → 200 `0` (**com service_role**, nada a expirar, nenhuma linha alterada).

---

## 8. Confirmação de integridade

- **Nenhum arquivo de código, migration, configuração ou teste foi alterado.** Único artefato criado: `docs/ALFA-VIP-RPC-PRIVILEGES-AUDIT.md`.
- **`git status --short`: 74 entradas** — idêntico ao início.
- **Nenhum `REVOKE`/`GRANT` executado.** Nenhuma migration criada, alterada ou aplicada (11 arquivos, hashes `68EEB577 … C06F2454`).
- **Nenhum SQL de alteração, nenhum DDL/DML.** Nenhum `db push|pull|reset|start`.
- **Nenhum commit, push, deploy ou build de APK.**
- Scripts temporários criados fora do repositório e **removidos**.
- `VIP_CHECK = false` e `requireVip` desativados — inalterados. Nenhum pagamento real, gateway, webhook ou QR.

## 9. Ações que exigem autorização antes de qualquer execução

1. **Autorizar migration de segurança** com os 4 `REVOKE … FROM public, anon, authenticated` (§5.E) — mudança de privilégio em produção.
2. **Confirmar no remoto** (`pg_proc.proacl`) quais funções realmente têm `EXECUTE` para `anon`/`PUBLIC`, **antes** de aplicar o `REVOKE` — requer senha do banco ou `SUPABASE_ACCESS_TOKEN`.
3. **Decidir o destino de `expire_overdue_grants`:** restringir e criar endpoint administrativo protegido, ou mantê-la como função interna sem exposição.
4. **Decidir o destino de `consume_invite_code`:** remover (a implementação TS a substitui) ou manter restrita a `service_role`.
5. **Corrigir a policy de `invite_codes`** (`invite_select_auth`) — bloqueio independente que sustenta a enumeração.
6. **Autorizar leitura do catálogo remoto** para fechar as lacunas de `owner`, `volatility` e ACL textual.
