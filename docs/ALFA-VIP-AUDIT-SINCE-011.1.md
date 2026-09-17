# ALFA — Auditoria completa do módulo Convites VIP (desde ALFA-011.1)

> **Data da auditoria:** 2026-09-17
> **Branch auditada:** `main` | **HEAD:** `a20eae3` — `feat: add Android APK download to landing` (2026-09-16 13:26:40 -0300)
> **Worktree:** 74 entradas em `git status --short` — **todo o trabalho ALFA-011.x → ALFA-015.2 está NÃO COMITADO** (2 modificados pré-existentes + dezenas de untracked)
> **Escopo:** histórico dos sprints, telas, APIs, banco/migrations, segurança, regras de negócio e testes do módulo Convites VIP
> **Modo:** **somente leitura**. Nenhum arquivo de código/banco/migration/configuração foi alterado. Nenhuma migration aplicada, nenhum SQL remoto, nenhum commit/push/deploy/APK.
> **Único artefato criado:** este relatório.

---

## 1. Resumo executivo

O módulo Convites VIP tem **9 de 13 sprints comprovadamente implementados em código** (ALFA-011.1 → 011.9), com **424 asserções de teste passando** e arquitetura coerente (criação admin → consumo atômico no signup → concessão idempotente → resumo em `user_state`).

Cinco conclusões dominantes:

1. **A criação e o aceite funcionam e são seguros no essencial.** Código gerado no servidor com `crypto.randomUUID`, consumo por `UPDATE … WHERE is_used=false AND revoked_at IS NULL AND (expires_at IS NULL OR > now)` (atômico, com compensação via `deleteUser`), concessão idempotente por `(user_id, invite_code_id, source)`.
2. **O ciclo de vida VIP está ÓRFÃO.** `renewGrant`, `revokeGrant` e `reprocessMissingGrant` existem em `accessService.ts` mas **não têm nenhum consumidor**: não há página, endpoint ou botão. Pior: **`expireOverdueGrants()` nunca é chamada por ninguém** — nenhum cron, nenhum endpoint, nenhum "lazy" em `getAccessState`.
3. **Nada disso existe no banco remoto.** O export de referência do schema `public` (`docs/reference/public-schema-export.sql`, 14 tabelas) **não contém `access_grants` nem `access_events`** (criadas pela migration `20250917000001`), e sondagem REST read-only registrou `PGRST205 Could not find the table`. Logo o fluxo de convite→VIP **não pode funcionar em produção**: falha ao ler `invite_codes`/`access_grants` com `PGRST205`.
4. **Contradição documental grave e não resolvida.** `ALFA-012.4` afirma "Migrations: 4/4 VIP aplicadas Local|Remote iguais" e "PostgREST sem Could not find table/column/function"; `ALFA-012.2` afirma o oposto ("nenhuma das 4 migrations VIP aplicada no remoto", última aplicada `20250916000001`); a evidência independente (export de schema + sondagem) **confirma ALFA-012.2**.
5. **O `pix_txid` não é o único bloqueio do APK: a configuração mudou.** O `capacitor.config.ts` atual tem `server.url: 'https://gpro-alfa-racing.vercel.app'` + `webDir: 'public'` — o APK carrega o app hospedado, e o `android/app/src/main/assets/public/` contém **apenas assets estáticos** (compound, flags, icons, images, screenshots, splash, tyres). Não há UI admin embarcada. *(O relatório da ALFA-015 descrevia uma config sem `server`; a config real tem — divergência documental registrada.)*

---

## 2. Estado do Git (item 8)

| Item | Valor |
|---|---|
Branch | `main` |
HEAD | `a20eae3` — 2026-09-16 13:26:40 -0300 |
`git status --short` | **74 entradas** |
Modificados (tracked) | `app/actions/signup.ts` (+286/−25), `app/dashboard/layout.tsx`, `app/dashboard/manager/components/SyncBanner.tsx`, `app/dashboard/manager/page.tsx`, `app/dashboard/wear/page.tsx`, `app/globals.css`, `app/layout.tsx` |
Untracked relevantes | `app/api/admin/vip-invites/`, `app/dashboard/admin/vip-invites/`, `app/lib/access/`, `supabase/migrations/20250917000001..000008`, `docs/` (27 relatórios), `tests/alfa-011-*.test.js` (8), `tests/alfa-012-1-*.test.js` (3), `tests/alfa-013-*.test.js` (2), `app/api/payments/`, `app/lib/payments/`, `tests/_alfa0143-harness.cjs` |
Último commit com VIP no assunto | `e0d9b85 feat: add login e convite` (histórico antigo) |
**Commits de ALFA-011.1 em diante** | **NENHUM.** Nada do módulo VIP foi commitado. |

**Divergência histórico × documentação:** os relatórios declaram aprovação por sprint (`ALFA-011.9` → `ALFA-014.3`), mas o repositório não tem um único commit dessas entregas. Todo o módulo VIP vive **exclusivamente na working tree**.

---

## 3. Histórico por sprint (item 1)

| Sprint | Doc | Prometeu | Implementado de fato | Situação |
|---|---|---|---|---|
**ALFA-011.1** | `ALFA-011.1-RELATORIO-MODELAGEM-VIP.md` | Migration aditiva: `access_grants`, `access_events`, colunas VIP em `user_state` | `20250917000001_add_vip_model.sql` (135 linhas): 2 tabelas + 4 colunas + 4 índices + RLS + policies + trigger | ✅ **implementado** (não aplicado no remoto) |
**ALFA-011.2** | `ALFA-011.2-RELATORIO-SERVICO-ACESSO-VIP.md` | Serviço central `accessService` sem enforcement | `accessService.ts` 935 linhas, `VIP_CHECK=false`, `interpretGrant`, `pickBestGrant`, `getAccessState` | ✅ **implementado** |
**ALFA-011.3** | `ALFA-011.3-RELATORIO-INTEGRACAO-CONTROLADA-VIP.md` | 1 ponto de integração, sem bloqueio | `app/api/admin/access-status/route.ts` (74 linhas) com `requireAdmin` | ✅ **implementado** |
**ALFA-011.4** | `ALFA-011.4-RELATORIO-SEGURANCA-USER-STATE.md` | Bloquear escalada de privilégio via REST | `20250917000002` (178 linhas): trigger `trg_user_state_privilege_guard`, RPC `update_user_profile` allowlist | ✅ **implementado** — mas ⚠️ referência a `tyre_suppliers` que **não existe no remoto** |
**ALFA-011.5** | `ALFA-011.5-RELATORIO-GERENCIADOR-CONVITES-VIP.md` | Gerenciador admin de convites (criar/listar/revogar) | `app/api/admin/vip-invites/route.ts` (178) + `[id]/revoke/route.ts` (105) + `app/dashboard/admin/vip-invites/page.tsx` (235) + migration `20250917000003` (80) | ⚠️ **implementado** — sem reenvio, sem filtro, sem busca, sem paginação |
**ALFA-011.6** | `...INTEGRACAO-SIGNUP-CONVITES.md` | Signup consome convite atomicamente | `app/actions/signup.ts` — preCheck + `createUser` + `UPDATE` atômico + validação de todos os estados | ✅ **implementado** |
**ALFA-011.7** | `...TRANSACAO-SIGNUP-CONVITES.md` | Transação definitiva signup+convite | `signup.ts:109-190` — compensação `deleteUser` com 2 tentativas e logs | ✅ **implementado** |
**ALFA-011.8** | `...CONCESSAO-VIP-CONVITE.md` | Concessão VIP idempotente por convite | `signup.ts:236-324` → `ensureVipGrantForInvite` + `recordAccessEvent` + `syncUserStateWithGrant` | ✅ **implementado** — **sem RPC no banco**: a concessão é feita no código server-side, não em transação SQL |
**ALFA-011.9** | `...CICLO-VIDA-VIP.md` | Renovação, revogação, expiração, reprocessamento | Migration `20250917000004` (157 linhas: RPCs `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants` + índice único) e `accessService.ts:730-920` (`renewGrant`, `revokeGrant`, `expireOverdueGrants`, `reprocessMissingGrant`) | 🔴 **implementado PORÉM ÓRFÃO** — nenhum consumidor (ver §8) |
**ALFA-012.0–012.4** | 5 docs | Auditoria integrada, observabilidade, migrations em staging, ativação gradual | `accessLogger.ts`, endpoints `access-status`/`access-would-block` | ⚠️ **parcial** — auditoria OK; **aplicação remota contraditória** |
**ALFA-013.0–013.3** | 4 docs | Observabilidade `wouldBlock`, seed de planos | `app/api/admin/access-would-block/route.ts` (137 linhas), `supabase/seed.sql` | ✅ **implementado** |
**ALFA-014.0–014.3** | 4 docs | Premium plans, orders/payments, Pix de teste | `app/lib/payments/**`, `app/api/payments/orders/**`, migrations `000005..000008` | ✅ **implementado** (fora do escopo VIP por convite) |

**Itens apenas documentados / abandonados:**
- **Venda de VIP por Pix** (`ALFA-011-PLANO-CONVITES-VIP-VENDAS-PIX.md`, 65 KB): planejado; só infraestrutura de teste (`provider: 'test'`), **sem gateway, sem cobrança, sem QR** — como exigido.
- **Reenvio de convite:** nunca implementado (nenhuma referência no código).
- **Paginação/filtro/busca na lista de convites:** ausente; `GET` tem `limit(100)` fixo.
- **Cron de expiração:** explicitamente adiado em ALFA-011.9 ("endpoint administrativo protegido"); **o endpoint nunca foi criado**.

---

## 4. Mapa de telas (item 2)

| Rota | Arquivo | Acesso | Estado |
|---|---|---|---|
`/dashboard/admin/vip-invites` | `app/dashboard/admin/vip-invites/page.tsx` (235 linhas) | **Admin** — guard server-side em `app/dashboard/admin/layout.tsx` (redireciona não-admin para `/dashboard?error=admin_required`) + menu filtrado em `app/dashboard/layout.tsx:265` (`.filter(group => group.id !== 'administration' \|\| localRole === 'admin')`) e `app/components/AdminInviteButton.tsx:14` | ✅ funcional |
`/login` (modo cadastro) | `app/login/page.tsx:44-83` | público | ✅ funcional |

**Funcionalidades da tela admin:** criar convite (select 30 dias / vitalício / data personalizada), listar (código, tipo, status, criado em, expira em), copiar código, revogar (só se `disponivel`), atualizar lista, contador.

**Ausente na tela:** reenvio, filtro por status, busca, paginação, confirmação acessível, `aria-live` para `message`/`error`, exibição de quem usou (`used_by`/`used_at` vêm na API mas **não são renderizados**), visualização de detalhe do convite.

| Verificação de UX | Resultado | Severidade |
|---|---|---|
Estado de loading | ✅ "Carregando..." (`page.tsx:176`) | — |
Estado vazio | ✅ "Nenhum convite criado ainda." (`page.tsx:177-181`) | — |
Estado de erro | ✅ bloco `error` (`page.tsx:166`) — **sem `aria-live`** | BAIXO |
`alert()` | ✅ ausente | — |
`confirm()` nativo | ❌ `handleRevoke` (`page.tsx:95`) usa `confirm()` — bloqueante, título "localhost" no WebView | MÉDIO |
`reload()` | ✅ ausente | — |
Acessibilidade | ❌ sem `role`/`aria-live`/foco em mensagens; tabela sem `<caption>`; botão "Copiar" sem `aria-label` | BAIXO |
Responsividade | ✅ `max-w-6xl p-4 md:p-6`, tabela com `overflow-x-auto` | — |
Link quebrado | ✅ nenhum (menu → rota existe) | — |
Acesso pelo perfil correto | ✅ admin-only, dupla checagem (server + UI) | — |
Diferença admin × manager | ✅ **correta** — nenhuma rota de convite acessível ao manager | — |
Incluída indevidamente no APK | ✅ **não** — `capacitor.config.ts` usa `server.url` (app hospedado) e `android/app/src/main/assets/public/` só tem assets estáticos | — |

---

## 5. Mapa de APIs (item 3)

### 5.1 `GET /api/admin/vip-invites`

| Campo | Valor |
|---|---|
Arquivo | `app/api/admin/vip-invites/route.ts:36-60` |
Finalidade | Listar até 100 convites com status calculado |
Autenticação | `requireAdmin()` → 401 sem sessão |
Autorização | papel `admin` via `user_state.role` (service role) → 403 |
Validação de entrada | **nenhuma** — não aceita parâmetros (não há `?status`, `?page`) |
Isolamento | catálogo global (admin vê todos) — correto por design |
Tratamento de erro | `throw error.message` → status mapeado por string match (`'admin'` → 403) — frágil |
Exposição | retorna `code` completo, `used_by`, `created_by`, `revoked_by` — adequado a admin |

### 5.2 `POST /api/admin/vip-invites`

| Campo | Valor |
|---|---|
Arquivo | `:62-167` |
Finalidade | Criar convite |
Autenticação/Autorização | `requireAdmin()` |
Validação | ✅ `validityType ∈ {30_days, lifetime, custom}`; `custom` exige ISO válida, **futura** e **≤ 2 anos** |
Geração do código | `crypto.randomUUID()` (CSPRNG), 4+4 hex maiúsculos → `ALFA-XXXX-XXXX`; até 3 tentativas contra `23505` |
Controle do cliente | ✅ código **nunca** vem do body; `created_by` vem da sessão |
Erro | 400 (validação), 401/403, 500; loga `vip.invite.created` com IDs mascarados |
Observabilidade | ✅ `nextCorrelationId()`, `durationMs` |

### 5.3 `POST /api/admin/vip-invites/[id]/revoke`

| Campo | Valor |
|---|---|
Arquivo | `app/api/admin/vip-invites/[id]/revoke/route.ts` (105 linhas) |
Finalidade | Marcar convite como revogado **sem apagar** |
Validação de entrada | ⚠️ só `typeof id !== 'string'` — **não valida formato UUID** |
Validação de estado | ✅ 404 se não existe; 409 `ALREADY_REVOKED`; 409 `ALREADY_USED` (decisão explícita de não revogar usado) |
Atomicidade | ✅ `UPDATE … .is('revoked_at', null).eq('is_used', false)` — protege corrida |
IDOR | ✅ admin-only; `id` é de catálogo global — sem vazamento cross-user |
Erro | 409 com mensagem do banco **repassada ao cliente** (`updateError?.message`) — vazamento de detalhe interno |

### 5.4 `GET /api/admin/access-status`

`app/api/admin/access-status/route.ts` (74 linhas) — `requireAdmin`, consulta **somente o próprio admin** (`getAccessState(adminUser.id)`), sem `?userId`, resposta mínima (sem `service_role`/`gpro_token`/`raw_data`). ✅ Robusto. 405 nos demais verbos.

### 5.5 `GET /api/admin/access-would-block`

`app/api/admin/access-would-block/route.ts` (137 linhas) — `requireAdmin`; **somente SELECT**; agrega contagens de grants/convites/eventos; calcula `wouldBlock` como se `VIP_CHECK=true`; responde `flags: { vipCheck: false }`. ✅ Robusto. **Nota:** usa rótulo de log `vip.access.denied` para um diagnóstico **bem-sucedido** — semântica enganosa (INFORMATIVO).

### 5.6 Fluxo de aceite — Server Action (não é API route)

`app/actions/signup.ts` (`signUpWithInviteCode`, 333 linhas):

| Caso | Comportamento | Evidência |
|---|---|---|
Não autenticado | n/a (cadastro público) | — |
Campos ausentes | `INVITE_INVALID` | `:23-24` |
Código normalizado | `.trim().toUpperCase().replace(/\s+/g,'')`, 4–64 chars | `:28-30` |
Não existe | `INVITE_NOT_FOUND` | `:65-67` |
Revogado | `INVITE_REVOKED` | `:69-71` |
Já utilizado | `INVITE_ALREADY_USED` | `:73-75` |
Expirado | `INVITE_EXPIRED` | `:77-83` |
**Race condition** | ✅ `UPDATE … .eq('is_used', false).is('revoked_at', null).or('expires_at.is.null,expires_at.gt.<now>')` + `.maybeSingle()`; se não retornar linha → **compensação** `auth.admin.deleteUser` (2 tentativas, log de incidente) | `:118-190` |
Reutilização indevida | ✅ impossível sem burlar o `WHERE` |
Manipulação de IDs/códigos | ✅ código vem do formulário mas o **estado** vem do banco; `expires_at`/`used_by` do cliente nunca são usados | `:92` |

**Dependências de banco:** `invite_codes` (migration `000001`/`000003`), `access_grants`/`access_events` (migration `000001`), `user_state` (baseline remoto + `000002`).

---

## 6. Mapa de banco e migrations (item 4)

### 6.1 Tabelas e objetos VIP (arquivos locais)

| Migration | Objetos | Linhas |
|---|---|---|
`20250914000001_rls_hardening.sql` | RLS em `invite_codes` + policy `invite_select_auth` (`auth.role()='authenticated'`) + policies de `user_state`/`api_knowledge_base`/`gpro_import_snapshots`/`energy_observations`/`user_planning`/`market_drivers` | 114 |
`20250917000001_add_vip_model.sql` | **CREATE** `access_grants` (14 col), `access_events` (8 col), 4 colunas VIP em `user_state`, 7 índices, RLS + 2 policies, trigger `trg_access_grants_updated_at`, FK `access_grants.invite_code_id → invite_codes(id) ON DELETE SET NULL`, FK `access_events.access_grant_id → access_grants(id) ON DELETE SET NULL` | 135 |
`20250917000002_harden_user_state_update.sql` | Trigger `trg_user_state_privilege_guard` + `prevent_user_state_privilege_escalation()` + policy `user_state_update_own_restricted` + RPC `update_user_profile(...)` (19 params) | 178 |
`20250917000003_extend_invite_codes.sql` | 8 colunas em `invite_codes` (`used_by`, `used_at`, `created_by`, `expires_at`, `revoked_at`, `revoked_by`, `invite_type`, `metadata`), 6 índices parciais, CHECK `invite_codes_invite_type_check`, RPC `consume_invite_code(text)` security definer | 80 |
`20250917000004_harden_access_grants_uniqueness.sql` | Índice único parcial `uniq_grant_invite_user (invite_code_id, user_id) WHERE source='invite'`, RPCs `renew_access_grant`, `revoke_access_grant`, `expire_overdue_grants` (todas security definer, `grant execute … to service_role`) | 157 |

**Colunas VIP em `user_state`:** `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id`.

**Relações:** `invite_codes.id` ← `access_grants.invite_code_id`; `access_grants.id` ← `access_events.access_grant_id`; `auth.users.id` → `user_state.user_id` (FK, no baseline remoto); `user_state.access_grant_id` → resumo do grant ativo (sem FK).

### 6.2 Verificações exigidas

| Verificação | Resultado | Severidade |
|---|---|---|
Migrations em ordem | ✅ timestamps crescentes, sem colisão | — |
Dependem de tabelas ausentes no baseline | 🔴 **SIM** — `20250914000001:6` faz `alter table public.user_state enable row level security` sem nenhum `CREATE TABLE` de `user_state` no repositório. **Reproduzido:** `supabase start` → `ERROR: relation "public.user_state" does not exist (42P01)`. 7 das 11 migrations falham em banco vazio | **ALTO** |
Referências a tabelas/colunas inexistentes | 🔴 `20250917000002:136` referencia `tyre_suppliers` (ausente no schema remoto de 14 tabelas) ⇒ `update_user_profile` cria com sucesso e **falha com 42703 no primeiro uso** | **ALTO** |
Divergência código × migrations | ⚠️ `db.ts:263-296` tem fallbacks para `42703` (`tyre_suppliers`, `car_characteristic`, `car_totals`) — indica drift esperado | MÉDIO |
Divergência relatórios × migrations | 🔴 `ALFA-012.4:7,38` afirma 4/4 aplicadas + "PostgREST sem Could not find table"; `ALFA-012.2:46,54` afirma o contrário; a evidência confirma **ALFA-012.2** | **ALTO** |
Fluxo depende de tabelas não confirmadas no remoto | 🔴 **SIM** — `access_grants`/`access_events` **não constam** do export do schema remoto e a sondagem retornou `PGRST205`. O fluxo convite→VIP falha em produção | **CRÍTICO** |
FK `access_grants.invite_code_id` | ⚠️ o export remoto mostra a FK **sem `ON DELETE SET NULL`**; a migration declara com `SET NULL` — divergência não confirmada (o gerador do export pode omitir a ação) | MÉDIO |
CHECK duplicado possível | ⚠️ o remoto já tem CHECK inline de `invite_type`; `20250917000003:35` cria outro guardado por nome ⇒ pode gerar **dois CHECKs equivalentes** | BAIXO |

**Nenhuma migration foi aplicada. Nenhum SQL remoto foi executado.**

---

## 7. Matriz de segurança (item 5)

| # | Vetor | Avaliação | Evidência | Severidade |
|---|---|---|---|---|
1 | **Enumeração de convites** | 🔴 **Existe.** A policy `invite_select_auth` (`20250914000001:70-71`) permite `SELECT` **de toda a tabela** `invite_codes` para **qualquer usuário autenticado** (`using (auth.role() = 'authenticated')`). Um único convite válido basta para cadastrar-se e então **listar todos os códigos** via REST/anon-key, contornando a intenção de "apenas verificar se o código existe" | `20250914000001:69-71` | **CRÍTICO** |
2 | **Previsibilidade de token** | 🟡 Código = 8 hex derivados de `crypto.randomUUID()` (2^32 espaço) — CSPRNG correto, mas **curto**; combinado com o item 1 (leitura da tabela) a entropia é irrelevante | `vip-invites/route.ts:109-112` | MÉDIO (isolado) / CRÍTICO (combinado) |
3 | **Replay / reutilização** | ✅ Bloqueado pelo `UPDATE` atômico com `is_used=false`; segundo uso recebe `INVITE_ALREADY_USED` ou aciona compensação | `signup.ts:118-127` | INFORMATIVO |
4 | **Race condition no aceite** | ✅ Tratada (condicional atômica + compensação `deleteUser` com 2 tentativas e log de incidente) | `signup.ts:143-190` | INFORMATIVO |
5 | **Duplicidade de grant** | ✅ Idempotência por `(user_id, invite_code_id, source='invite')` + índice único parcial `uniq_grant_invite_user` | `accessService.ts:530-560`, `20250917000004:32-35` | INFORMATIVO |
6 | **Expiração** | ⚠️ **Não há reconhecimento automático.** `expireOverdueGrants()` (e a RPC SQL homônima) **nunca é chamada**. O acesso é negado por cálculo de data em `interpretGrant`, mas `status` permanece `'active'` e o evento `expired` nunca é gravado | `accessService.ts:846-848` (definição, 0 chamadas) | **ALTO** |
7 | **Revogação** | ⚠️ Existe (`revokeGrant` + RPC) mas **sem UI/endpoint**; revogar um **grant** só é possível por SQL manual | busca de consumidores: 0 | **ALTO** |
8 | **IDOR** | ✅ Sólido. `access-status` consulta só a si; convites são catálogo admin; `resolveUserId()` rejeita userId divergente; nenhuma rota aceita `userId` de terceiro | `auth.ts:77-85`, `access-status/route.ts:22-25` | INFORMATIVO |
9 | **Autorização por papel / separação admin×manager** | ✅ Dupla checagem: guard server-side (`admin/layout.tsx`) + API `requireAdmin()`; menu filtrado no cliente (defesa em profundidade, não a única barreira) | `admin/layout.tsx:20-23`, `layout.tsx:265` | INFORMATIVO |
10 | **RLS** | ⚠️ `invite_codes`: RLS + policy permissiva de leitura (item 1). `access_grants`/`access_events`: RLS + policy `*_select_own` (select-only, escrita só service_role) — ✅. **Não confirmado no remoto** | `20250917000001:90-103` | MÉDIO |
11 | **Exposição de dados sensíveis** | ✅ Nenhum `gpro_token`/`raw_data`/`service_role` nas respostas VIP; logs usam máscaras (`maskCode`, `maskInviteId`, `maskUserId`, `maskEmail`). ⚠️ `revoke` repassa `updateError.message` ao cliente | `accessLogger.ts`, `revoke/route.ts:63` | BAIXO |
12 | **Logs com tokens/dados privados** | ✅ Código de convite sempre mascarado; `accessLogger.info('vip.signup.started', …, code: maskCode(inviteCode))`. ⚠️ `console.error` de falha de grant expõe `inviteId.slice(0,8)` (ID, não segredo) | `signup.ts:45-49,322` | BAIXO |
13 | **Rate limiting / força bruta** | 🔴 **Inexistente em todo o projeto** (`rateLimit|throttle|429` = 0 ocorrências). `POST` de criação de convite e o aceite no signup são ilimitados | busca global: 0 | **ALTO** |
14 | **Validação de formato de ID** | ⚠️ `revoke` valida apenas `typeof id === 'string'` — um ID não-UUID chega ao banco (`.single()` retorna erro → 404, sem injeção, mas sem validação explícita) | `revoke/route.ts:19-21` | BAIXO |
15 | **Concessão automática de VIP** | ✅ **Implementada por design e explicitamente registrada nas regras**: consumir convite válido concede grant via `ensureVipGrantForInvite`. Não é RPC no banco (não existe `grant_access_from_invite`) — é código server-side. Compatível com a regra "nenhum access_grants automático sem regra explicitamente existente" | `signup.ts:236-252` | INFORMATIVO |
16 | **`VIP_CHECK=false` / `requireVip`** | ✅ Preservados: `VIP_CHECK = false as const`; `requireVip` existe mas não é chamado em nenhuma rota | `accessService.ts:24,461` | INFORMATIVO |
17 | **Pix/gateway/webhook/QR/confirmação** | ✅ Nenhum real — só `provider: 'test'`, `status: 'created'`, sem chamada externa | `app/lib/payments/**` | INFORMATIVO |

---

## 8. Ciclo de vida VIP — órfão (achado central)

| Função | Definida em | Consumidores | Consequência |
|---|---|---|---|
`renewGrant` | `accessService.ts:730` | **0** | não há como renovar VIP pela aplicação |
`revokeGrant` | `accessService.ts:798` | **0** | não há como revogar o **acesso** (só o convite) |
`expireOverdueGrants` | `accessService.ts:846` | **0** | grants vencidos ficam `status='active'` para sempre |
`reprocessMissingGrant` | `accessService.ts:880` | **0** | recuperação de grant ausente é manual |
RPC `renew_access_grant` | `20250917000004:42` | **0** | idem |
RPC `revoke_access_grant` | `20250917000004:89` | **0** | idem |
RPC `expire_overdue_grants` | `20250917000004:124` | **0** | idem |
`consume_invite_code` (RPC) | `20250917000003:43` | **0** — `signup.ts:111` documenta "Equivalente à RPC…, mas com `used_by` explícito (service_role não tem `auth.uid()`)" | **duas implementações do mesmo consumo** (uma em SQL, uma em TS), mantidas em paralelo |

**Atenuante:** `getAccessState` calcula expiração por **data** (`interpretGrant`), então o **acesso** é corretamente negado mesmo com `status='active'`. O dano é a **divergência de dados + ausência de trilha de auditoria + contadores admin inflados**, não um bypass de acesso.

**Risco decorrente:** `access-would-block` conta `grantsActive` por `status='active'` e mede `divergences` — hoje reportaria ativos que já venceram.

---

## 9. Regras de negócio (item 6)

| Regra | Status | Evidência |
|---|---|---|
Plano VIP | ✅ `plan ∈ {premium, full_premium}` (CHECK na tabela + `planForInvite`) | `20250917000001:23` |
Convite mensal (30 dias) | ✅ `validityType='30_days'` → `expires_at = +30d`, `invite_type='vip_30_days'` | `vip-invites/route.ts:79-83` |
Convite vitalício | ✅ `lifetime` → `expires_at = null`, `vip_lifetime`; `renewGrant` preserva vitalício | `route.ts:84-86`, `accessService.ts:730+` |
Convite customizado | ✅ com validação de futuro + teto de 2 anos | `route.ts:87-106` |
Quantidade de convites | ⚠️ **sem limite** por admin/período (lista limitada a 100, criação ilimitada) | `route.ts:44` |
Validade do convite | ✅ verificada no preCheck **e** no `UPDATE` atômico | `signup.ts:77-83,124` |
Aceite | ✅ exige código; novo usuário consome e é logado | `login/page.tsx:44-83` |
Concessão de acesso | ✅ automática ao consumir, idempotente, `expires_at` derivado de `invite_type` (nunca do cliente) | `signup.ts:238-252` |
Revogação | ⚠️ do **convite** pela UI ✅; do **grant** sem UI ❌ | §8 |
Expiração | ⚠️ negada por cálculo ✅; reconhecimento persistido ❌ | §8 |
Duplicidade | ✅ índice único parcial + idempotência no código | `20250917000004:32` |
Vínculo convite ↔ usuário | ✅ `used_by` gravado no consumo com o **newUserId** (não `auth.uid()`, que seria null sob service_role) | `signup.ts:120` |
Ausência de pagamento real | ✅ nada de Pix/gateway real; `provider: 'test'` | `app/lib/payments/**` |

---

## 10. Testes executados (item 7)

**39 suites existentes, executadas por `node tests/*.test.js` (estáticas, não destrutivas, sem rede, sem banco):**

| Métrica | Valor |
|---|---|
Suites | **39** |
Asserções PASS | **785** |
Asserções FAIL | **3** |
Suites com falha real | **3** |

**Suites VIP — todas verdes:**

| Suite | PASS | FAIL |
|---|---|---|
`alfa-011-2-access` | 38 | 0 |
`alfa-011-3-access-status` | 41 | 0 |
`alfa-011-4-security` | 62 | 0 |
`alfa-011-5-vip-invites` | 42 | 0 |
`alfa-011-6-signup` | 39 | 0 |
`alfa-011-7-transaction` | 40 | 0 |
`alfa-011-8-vip-grant` | 41 | 0 |
`alfa-011-9-grant-lifecycle` | 45 | 0 |
`alfa-012-1-integration` | 17 | 0 |
`alfa-012-1-masking` | 11 | 0 |
`alfa-012-1-observability` | 46 | 0 |
`alfa-013-would-block` | 15 | 0 |
**Subtotal VIP** | **437** | **0** |

**As 3 falhas reais (nenhuma é do módulo VIP):**

| Suite | Assert | Diagnóstico |
|---|---|---|
`alfa-013-pix.test.js` | "1. nenhuma migration orders/payments criada" | 🟡 **FALSO POSITIVO** — a asserção proíbe `'orders'`/`'payments'` no nome das migrations, mas `20250917000006_create_premium_orders.sql` e `..._payment_payments.sql` foram legitimamente criadas pela **ALFA-014.1**. Teste desatualizado, precisa de ajuste |
`alfa-003-regression.test.js` | "1. página tem fallback AGUARDANDO" | 🟡 Fora do escopo VIP — regressão de UI da página de wear/planejamento |
`sponsors-library-0095.test.js` | "nome truncate + title", "categoria title" | 🟡 Fora do escopo VIP — atributos de acessibilidade dos cards de patrocinadores |

**Cobertura de cenários exigida pelo escopo:**

| Cenário | Coberto? | Onde |
|---|---|---|
Convite inválido | ✅ | `alfa-011-6-signup` (INVITE_INVALID/NOT_FOUND) |
Convite expirado | ✅ | `alfa-011-6-signup` (`expires_at`) |
Convite revogado | ✅ | `alfa-011-6-signup`, `alfa-011-9-grant-lifecycle` |
Convite já utilizado | ✅ | `alfa-011-6-signup` (INVITE_ALREADY_USED) |
Usuário não autenticado | ✅ | `alfa-011-3-access-status` (401) |
Usuário sem permissão | ✅ | `alfa-011-4-security`, `alfa-011-5-vip-invites` (403) |
Acessar convite de outro usuário | ✅ | `alfa-011-4-security` (IDOR) |
Duplicidade | ✅ | `alfa-011-9-grant-lifecycle` (uniq parcial) |
**Concorrência** | ⚠️ **não há teste de corrida real** — coberto apenas por asserção estática do `WHERE` atômico | `alfa-011-6-signup:56` |
Testes de banco real | ❌ **impossíveis** — as tabelas não existem no remoto (§6.2) |

**TypeScript:** `npx tsc --noEmit` → **exit 0**.
**Build:** não executado nesta auditoria (não é necessário para o diagnóstico; foi verde em ALFA-015.2 com o mesmo código).

---

## 11. Conclusão (item 9)

### A. Comprovadamente implementado
1. Modelagem aditiva (`access_grants`, `access_events`, 4 colunas VIP, índices, RLS, policies, trigger, FKs) — migration `20250917000001`.
2. `accessService.ts` completo: `interpretGrant`, `pickBestGrant`, `getAccessState`, `hasVipAccess`, `ensureVipGrantForInvite`, `recordAccessEvent`, `syncUserStateWithGrant`.
3. Gerenciador admin de convites: criar (3 tipos, com validações), listar, copiar código, revogar — telas + 2 endpoints.
4. Consumo atômico no signup com tratamento explícito de **todos** os estados do convite e **compensação** em concorrência.
5. Concessão VIP idempotente por convite, com evento `granted` e sincronização de `user_state`.
6. Hardening de `user_state` (trigger anti-escalada + RPC allowlist) — migration `20250917000002`.
7. Observabilidade com máscaras (`accessLogger`) e 2 endpoints de diagnóstico protegidos.
8. 437 asserções de teste VIP passando.

### B. Parcialmente implementado
1. **Reconhecimento de expiração:** função existe, **nunca é chamada**; acesso é negado só por cálculo.
2. **Revogação de acesso:** código existe, **sem UI/endpoint**; revogação UI cobre apenas o convite.
3. **Renovação e reprocessamento:** idem — código e RPCs prontos, zero consumidores.
4. **`consume_invite_code`:** RPC em SQL **reimplementada** em TypeScript; duas fontes para a mesma regra.
5. **Gerenciador:** sem reenvio, filtro, busca, paginação e sem exibir `used_by`/`used_at` (que a API já devolve).
6. **Acessibilidade da tela admin:** sem `aria-live`, sem confirmação acessível.
7. **Aplicação remota das migrations:** contradição entre relatórios; evidência aponta para **não aplicadas**.

### C. Apenas documentado
1. Venda de VIP por Pix (`ALFA-011-PLANO…`, 65 KB) — só infraestrutura `provider: 'test'`.
2. Cron/agendamento de expiração (a ALFA-011.9 escolheu "endpoint administrativo protegido" — **nunca criado**).
3. Reenvio de convite.
4. Ativação gradual de `VIP_CHECK` (`ALFA-012.0-PLANO-ATIVACAO-GRADUAL.md`).
5. Limite de convites por admin.

### D. Quebrado
1. 🔴 **Fluxo convite→VIP em produção:** `access_grants`/`access_events` não existem no schema remoto → `PGRST205`.
2. 🔴 **`update_user_profile`:** referencia `tyre_suppliers`, ausente no remoto → `42703` na primeira chamada.
3. 🔴 **Cadeia de migrations:** 7 das 11 falham em banco vazio (`42P01` em `user_state`) — `supabase start`/`db reset` impossíveis.
4. 🟡 **`alfa-013-pix.test.js`:** falso positivo (teste desatualizado desde ALFA-014.1).
5. 🟡 **Contradição `ALFA-012.4` × `ALFA-012.2`** sobre a aplicação remota.

### E. Não confirmável sem acesso ao Supabase remoto
1. Existência e definição exata de policies RLS/policies de `invite_codes`, `access_grants`, `access_events` (o export não traz RLS).
2. Índices, triggers e funções efetivamente criados no remoto.
3. Ações referenciais (`ON DELETE`) das FKs.
4. Se as migrations `000001`–`000004` foram algum dia aplicadas (e revertidas) — explicação para o uso de `access_grants` documentado em ALFA-013.2.
5. Entropia efetiva e unicidade do catálogo de códigos em produção.
6. Contagens reais de grants/convites/eventos.

### F. Riscos de segurança (ordenados)
1. **CRÍTICO — Enumeração total de convites:** policy `invite_select_auth` permite a qualquer autenticado ler toda a tabela `invite_codes`. Um convite próprio → todos os códigos.
2. **ALTO — Ausência de rate limiting** em criação de convites e no aceite (todo o projeto).
3. **ALTO — Expiração não reconhecida:** `status='active'` permanente, sem evento `expired`, contadores admin divergentes.
4. **ALTO — Revogação de acesso sem superfície:** incidente exigiria SQL manual.
5. **MÉDIO — Código curto (8 hex)** e fallback legado `invite_type = null → 30 dias` (presunção documentada, mas ainda uma presunção).
6. **MÉDIO — `revoke` repassa `updateError.message`** ao cliente (detalhe interno).
7. **BAIXO — `confirm()` nativo** na tela admin; ausência de `aria-live`; sem validação de formato UUID no `revoke`.
8. **BAIXO — rótulo de log enganoso** `vip.access.denied` para diagnóstico bem-sucedido em `access-would-block`.

### G. Riscos de banco/migrations
1. **Baseline ausente:** nenhuma migration cria `user_state`, `invite_codes`, `api_knowledge_base`, `gpro_import_snapshots`, `energy_observations`, `user_planning`, `market_drivers`, `gpro_sponsors`, `gpro_sponsors_metadata`, `calendario_temporada` — todas existem só no remoto (provado em `ALFA-014.4`).
2. Ordem de dependência obrigatória: `invite_codes` → `access_grants` → `access_events` (já respeitada).
3. `tyre_suppliers` inexistente no remoto.
4. Possível CHECK duplicado em `invite_type`.
5. Nada aplicado no remoto; `db push` proibido sem autorização.

### H. Pendências reais
1. Resolver a política RLS de `invite_codes` (enumeração) — exige migration **nova**.
2. Criar superfície para revogação/renovação de **grant** (endpoint admin protegido).
3. Criar o endpoint protegido de expiração (`expireOverdueGrants`) — ou aceitar formalmente o cálculo lazy.
4. Aplicar o baseline de schema + migrations `000001`–`000008` no remoto (requer autorização).
5. Decidir sobre `tyre_suppliers`: criar a coluna (migration) **ou** remover da RPC.
6. Corrigir `alfa-013-pix.test.js` (falso positivo).
7. Reconhecer/padronizar `consume_invite_code` (SQL) × implementação TS.
8. Completar UX admin: `aria-live`, confirmação acessível, exibir `used_by`/`used_at`, filtros.
9. Adicionar rate limiting.
10. Commit do trabalho ALFA-011→015 (nada está versionado).

### I. Dependências entre pendências
```
(Baseline + migrations no remoto)
        └─> desbloqueia teste real de banco
              └─> desbloqueia validação de RLS/policies
                    └─> permite fechar (1) enumeração com migration nova
(4) aplicar migrations ──> pré-requisito de (2) revogação e (3) expiração funcionarem de fato
(5) tyre_suppliers ──> bloqueia chamadas de `update_user_profile`, que é caminho do perfil
(10) commit ──> independente das demais, mas é risco de perda total do trabalho
(6) teste falso positivo ──> independente
```

### J. Recomendação de próxima sprint (NÃO executar agora)

**ALFA-016 — Fechamento do ciclo VIP e desbloqueio de infraestrutura**, em ordem:

1. **P0 — Baseline de schema + aplicação autorizada** das migrations `000001`–`000008` (local via Docker primeiro, remoto só com autorização). Sem isso, todo o resto é inverificável.
2. **P0 — Migration nova para RLS de `invite_codes`:** substituir `invite_select_auth` por política de escopo (ex.: leitura apenas do próprio registro via RPC `consume_invite_code` security definer, sem `SELECT` de tabela). Elimina a enumeração.
3. **P1 — Superfície administrativa de grant:** endpoint `POST /api/admin/access-grants/[id]/revoke` + `/renew` (via `requireAdmin` → `revokeGrant`/`renewGrant`), e endpoint de expiração. Fecha as pendências 2, 3 e 7.
4. **P1 — Corrigir `tyre_suppliers`** (decidir coluna × RPC).
5. **P2 — Rate limiting** mínimo em `POST /api/admin/vip-invites` e no aceite.
6. **P2 — UX admin:** `aria-live`, `FeedbackDialog` (reusar `app/dashboard/manager/components/feedback.tsx`), exibir `used_by`/`used_at`, filtro por status.
7. **P2 — Corrigir `alfa-013-pix.test.js`** e adicionar teste de concorrência real do consumo.
8. **P3 — Commit** de todo o trabalho ALFA-011→015 (em commits pequenos e lógicos, como manda o `AGENTS.md`).

---

## 12. Comandos executados nesta auditoria

Somente leitura / não destrutivos:

```
git rev-parse --abbrev-ref HEAD ; git log -1 ; git log -12 ; git status --short ; git diff --stat
Get-ChildItem / Select-String (inventário de arquivos, docs, migrations, refs no código)
node tests/*.test.js                 (39 suites, 785 PASS / 3 FAIL)
npx tsc --noEmit                     (exit 0)
```

**NÃO executados:** `supabase start`, `db reset`, `db push`, `db pull`, `migration new`, qualquer SQL remoto, `git commit`, `git push`, deploy, build de APK, instalação de dependência.

## 13. Arquivos inspecionados

**APIs:** `app/api/admin/vip-invites/route.ts`, `app/api/admin/vip-invites/[id]/revoke/route.ts`, `app/api/admin/access-status/route.ts`, `app/api/admin/access-would-block/route.ts`
**UI:** `app/dashboard/admin/vip-invites/page.tsx`, `app/dashboard/admin/layout.tsx`, `app/login/page.tsx`, `app/dashboard/layout.tsx`, `app/components/AdminInviteButton.tsx`
**Serviço/negócio:** `app/lib/access/accessService.ts`, `app/lib/access/accessLogger.ts`, `app/lib/auth.ts`, `app/actions/signup.ts`
**Banco:** `supabase/migrations/20250914000001`, `20250917000001`–`000004`, `supabase/seed.sql`, `docs/reference/public-schema-export.sql`
**Config:** `capacitor.config.ts`, `next.config.ts`, `package.json`
**Docs:** os 27 relatórios `docs/ALFA-011*` → `docs/ALFA-014.7*`
**Testes:** as 13 suites `alfa-011-*`, `alfa-012-1-*`, `alfa-013-*` e as 26 restantes

**Nenhum arquivo foi alterado. Nenhuma migration foi criada ou aplicada. Nenhum commit, push, deploy ou APK.**
