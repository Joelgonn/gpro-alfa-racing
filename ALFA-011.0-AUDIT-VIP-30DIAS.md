# ALFA-011.0 — Auditoria do Acesso VIP com Expiração de 30 Dias

> **Tipo:** Auditoria somente leitura — nenhuma migration, código ou push foi realizado.
> **Data:** 2026-09-16
> **Regra preservada:** validade do convite (`invite_codes`) permanece intacta; nova validade de 30 dias é do **acesso VIP**, contada a partir da concessão.

---

## 1. Arquivos e Tabelas Analisados

| Área | Arquivo/Tabela | Evidência |
|---|---|---|
| **Convites — código** | `app/actions/signup.ts:29-32` `supabaseAdmin.from('invite_codes').select('id,code,is_used,created_at').eq('code',...).eq('is_used',false)` | Campos `id, code, is_used, created_at` — sem `expires_at` |
| **Convites — criação** | `app/actions/admin.ts:24-33` `code=ALFA-XXXX-XXXX`, `insert {code,is_used:false}` | Sem validade, uso único |
| **Convites — uso** | `app/actions/signup.ts:52-55` `update {is_used:true}` | Marca usado após criação do usuário |
| **Convites — RLS** | `supabase/migrations/20250914000001_rls_hardening.sql:9,69` `enable RLS`, `invite_select_auth` para `authenticated` select, sem insert/update/delete para `authenticated` | Escrita só `service_role` (admin.ts/signup.ts) |
| **Convites — UI** | `app/login/page.tsx:18,259` `inviteCode` input, `app/components/AdminInviteButton.tsx:46` geração | Fluxo convite → cadastro |
| **Usuário — estado** | `app/lib/db.ts:30,142,150` `UserState.role:'admin'|'user'`, `getUserState` select explícito | Sem `access_plan/vip_*`, role única |
| **Usuário — auth** | `app/lib/auth.ts:33-84` `requireAuth/isAdmin/requireAdmin/resolveUserId` via `@supabase/ssr` + `supabaseAdmin` | Sessão validada por cookies, IDOR 403 |
| **Usuário — admin layout** | `app/dashboard/admin/layout.tsx:19-26` `select role` + `redirect` se `!==admin` | Admin preservado |
| **Manager — APIs** | `app/api/gpro/sync:387` `app/api/python:269,386` `app/api/calendar` `app/api/manager/profile` `app/api/market/update` | Todas usam `requireAuth/resolveUserId`, 7 APIs gerente |
| **Manager — dashboard** | `app/dashboard/layout.tsx:162-182` `select role` para filtrar menu admin | Frontend filtra, backend valida |
| **Migrations** | `supabase/migrations/20250914000001_rls_hardening.sql` (114 linhas) | Única migration versionada; criação de `invite_codes` não versionada no repo (criada manualmente) |
| **Capacitor** | `capacitor.config.ts:4,7` `appId br.com.gproalfaracing`, `server.url https://gpro-alfa-racing.vercel.app` | Web e APK compartilham mesmo backend |

**Tabelas encontradas:**
- `public.invite_codes` (`id, code, is_used, created_at` inferidos; criação fora do repo)
- `public.user_state` (`user_id, role, track, driver_json, car_json, tech_director_json, staff_facilities_json, test_points_json, race_options_json, weather_data, sponsors_database_json, energy_coeffs_json, menu_data, office_data, desgaste_modifier, last_import_snapshot, last_import_at, car_development_json, driver_info, driver_editable, driver_static, car_totals, car_characteristic, tyre_suppliers` — ver `db.ts:150`)

Nenhuma tabela `profiles` separada; `user_state` é a fonte única.

---

## FASE 1 — Mapeamento do Sistema Atual

**1. Tabela de convites:** `public.invite_codes`
- **Migration responsável:** não versionada no repo (ausência de `create table invite_codes` em `supabase/migrations`). RLS em `20250914000001_rls_hardening.sql:9`.
- **Campos:** `id (uuid/pk), code (text unique, ex ALFA-A1B2-C3D4), is_used (bool), created_at (timestamptz)` — ver `signup.ts:30`.
- **Validade:** **não existe coluna de validade** (`expires_at` ausente); verificação é `is_used = false` apenas. Validade atual é "uso único, sem expiração temporal" — deve permanecer assim.
- **Status:** `is_used` boolean.
- **Usuário que aceitou:** não há `used_by`/`accepted_by` no select; histórico é indireto via `auth.users.user_metadata.invite_code` (`signup.ts:44`) e `user_state` criado após.
- **Data de aceite:** não gravada em `invite_codes`; `created_at` do usuário é proxy.
- **Criador:** não gravado (geração verifica `user_state.role='admin'` em `admin.ts:14` mas não salva `created_by`).
- **Uso único:** sim, `is_used` garante 1 uso; `admin.ts:32` sempre `false` ao inserir.

**2. Rotas de convite:**
- **Validar:** inline em `signup.ts:28-32` (select `is_used=false`). Sem rota dedicada `validate`.
- **Aceitar:** `signUpWithInviteCode` em `app/actions/signup.ts:17` — server action (`'use server'`), usa `supabaseAdmin` (service_role) para bypass RLS.
- **Fluxo cadastro/login:** `app/login/page.tsx:18` coleta `inviteCode` → `FormData.append('inviteCode')` → `signUpWithInviteCode`. Cadastro **exige** convite; login não exige (módulo `login/page.tsx` tab login/cadastro). Convite é aceito **antes** da criação do usuário (`auth.admin.createUser` em `signup.ts:40`).

**3. Plano/permissão do usuário:**
- `user_state.role` (`admin|user`) em `db.ts:31`. Sem `access_plan`, `vip_*`. `role=user` é o padrão (`db.ts:157,212`). Admin é `role=admin` e bypassa VIP.

**4. Middleware / liberação Manager:**
- `app/dashboard/admin/layout.tsx:10-26` (admin) e `app/lib/auth.ts:33-84` (gerente). Manager **não tem middleware dedicado** além de `requireAuth` nas APIs; `dashboard/layout.tsx:264` filtra menu admin via `localRole`, mas APIs são a barreira real.

**5. APIs que precisariam bloquear VIP expirado:**
- Todas as 7 gerente + 3 admin: `gpro/sync`, `python` (get_state, sponsors, update_state, setup, strategy, performance), `calendar`, `manager/profile`, `market/update`, `gpro/token`, `admin/*`. Hoje usam `requireAuth`/`requireAdmin` sem checar expiração.

**6. Componentes frontend exibindo acesso:**
- `dashboard/layout.tsx:162` mostra `role`, `dashboard/admin/layout.tsx:26` redireciona, `AdminInviteButton` gera convite. Nenhum componente exibe `vip_expires_at` (inexistente).

---

## FASE 2 — Modelo de Autorização

**Onde registrar VIP? Recomendação: `public.user_state` (menor impacto).**

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **`user_state` (recomendado)** | Tabela já é `user_id PK`, RLS `auth.uid()=user_id`, `getUserState/saveUserState` já centralizam; 1 query para auth+VIP; sem join; já tem `role` | Adiciona colunas ao estado (aditivo, sem breaking) | **✓ Menor impacto** |
| `profiles` separada | Isolamento | Duplicaria `user_state` (duas fontes), `db.ts` teria que juntar; migração nova tabela + RLS + sync | Desnecessário |
| Tabela própria `vip_access`/`subscriptions` | Histórico multi-linhas, auditoria | Join obrigatório, 2 tabelas, complexidade, RLS extra | Só se precisar de histórico multi-VIP; hoje basta último VIP |
| `auth.users` metadata | Sem migration | `auth.users` não tem RLS custom, leitura só via service_role, não ideal para regras de negócio | Não |

**Campos recomendados (todos em `user_state`, additivo, nullable):**
```
access_plan text      -- 'vip' | 'common' | null (compatível com role, mas separado)
vip_started_at timestamptz
vip_expires_at timestamptz
vip_invite_id uuid references invite_codes(id) -- rastreia convite que gerou VIP, sem FK obrigatória para não quebrar histórico
```
- `access_plan` permite `admin` permanecer `role=admin` + `access_plan=vip` sem conflito; expiração não afeta `role`.
- `vip_started_at` = `now()` server-side no momento da concessão.
- `vip_expires_at` = `vip_started_at + interval '30 days'` (server calculada).
- `vip_invite_id` preserva auditoria sem alterar `invite_codes`.

**Por que não em `invite_codes`?** `invite_codes` é do **convite**, não do **usuário**. Validade do convite (inexistente hoje) deve continuar `is_used` sem expiração. VIP é do usuário, 1:N convites → 1 usuário pode ter múltiplos VIPs ao longo do tempo; guardar no usuário evita poluir convites.

---

## FASE 3 — Momento Correto da Ativação

**Respostas auditadas:**

- **Convite é aceito antes ou depois do cadastro?** Antes: `signup.ts:28` valida código → `40` cria usuário → `52` marca usado → `59` cria `user_state`. Sem validação prévia não há usuário.
- **Usuário já existe quando resgatado?** Não. `auth.admin.createUser` cria. Reuso para usuário existente não previsto (não há rota `redeem` para logado).
- **Acesso concedido em rota server-side?** Sim, `app/actions/signup.ts:17` server action com `supabaseAdmin`. Frontend não concede.
- **É possível ativar VIP duas vezes?** Hoje não há VIP, mas convite só pode ser usado 1x (`is_used`). Sem proteção, se criar rota de `renew`, poderia chamar duas vezes; precisa de `upsert` idempotente com `where`.
- **Risco de reiniciar 30 dias ao atualizar página?** Se VIP for derivado de `localStorage` ou client, sim. Se for `user_state.vip_expires_at` server-side e só escrito em `signup.ts`, recarregar não reinicia. Risco só se frontend escrever `vip_expires_at` diretamente (RLS `user_state_update_own` permitiria `auth.uid()=user_id` update — **risco real** hoje para qualquer coluna `user_state`).
- **Manipular data pelo frontend?** Sim, `user_state_update_own` (`sql:33`) permite `update` onde `auth.uid()=user_id`. Usuário autenticado poderia `supabase.from('user_state').update({vip_expires_at: '2099-01-01'})` se coluna existir e RLS for `update_own`. **Deve ser bloqueado:** RLS para `vip_*` deve ser `service_role` only ou trigger que ignora client write.
- **Como impedir alteração de `vip_expires_at`?** (1) Sem política `update` para `authenticated` em `vip_*` (apenas `service_role` bypass), (2) ou trigger `before update` que sobrescreve com valor server, (3) ou coluna com `grant` só service_role. Recomendado: **sem RLS update para VIP columns para `authenticated`**, apenas `service_role` + `select_own` para leitura.

**Regra desejada server-side:**
```sql
vip_started_at = now()  -- em signup.ts após createUser
vip_expires_at = vip_started_at + interval '30 days'
```
Calculado em `signup.ts:59` no `insert` de `user_state`, nunca no client.

---

## FASE 4 — Segurança

**RLS atual:**
- `user_state_select_own/insert_own/update_own/delete_own` (`sql:25-39`) — `auth.uid()=user_id` para todas as operações. Isso permite que usuário edite **qualquer** coluna de sua linha `user_state`, incluindo `role` se não houver proteção extra. Hoje `role` é protegido apenas por convenção (frontend não edita), mas RLS tecnicamente permite `update role`.
- `invite_codes` `invite_select_auth` (`sql:70`) — `auth.role()='authenticated'` select; **nenhuma** insert/update/delete para `authenticated` → escrita só `service_role`. Correto.

**Riscos VIP:**
- **Alterar plano pelo navegador:** `supabase.from('user_state').update({role:'admin'})` ou `{vip_expires_at: far}` seria permitido pelo RLS atual. Mitigação: RLS para VIP deve ser **service_role only**; `role` já deveria ser assim, mas hoje não é. Recomendação: criar política que bloqueia `role` e `vip_*` para `authenticated` update, ou mover VIP para tabela separada com RLS restrita.
- **IDOR:** já mitigado por `resolveUserId` (`auth.ts:77`) que compara `requestedUserId === auth.id` (403). Todas as 7 APIs gerente usam `resolveUserId` (`grep 90 matches`).
- **Middleware:** `app/dashboard/admin/layout.tsx:19` server component valida `role` via `supabaseAdmin`; `dashboard/layout.tsx:264` apenas filtra menu (não é barreira). Admin continua `role=admin` e deve ser `if role=admin → skip VIP check`.
- **APIs Manager:** precisam adicionar `requireVipOrAdmin` após `requireAuth` (ver Fase 5).
- **Reutilizar convite para reiniciar prazo:** convite já `is_used=true` impede reuso; mas se criar rota `renew` sem validar novo convite, poderia. Deve exigir novo `invite_code` válido.

**Papel admin:** `isAdmin` (`auth.ts:47`) lê `user_state.role`. Expiração VIP **não deve** afetar `role=admin`. Laboratórios `admin` (`/dashboard/admin/*`, `/api/admin/*` com `requireAdmin`) devem permanecer fora do APK (já documentado `ALFA-001-APK-STRATEGY.md:38`).

---

## FASE 5 — Comportamento após Expiração

**Condição:**
```
vip_expires_at <= now()
```

**Proposta (server + client):**

1. **Middleware/API:** novo helper `requireVip` em `app/lib/auth.ts`:
   ```ts
   export async function requireVip(): Promise<AuthUser> {
     const user = await requireAuth();
     if (await isAdmin(user.id)) return user; // admin skip
     const {data} = await supabaseAdmin.from('user_state').select('vip_expires_at').eq('user_id',user.id).single();
     if (!data?.vip_expires_at || new Date(data.vip_expires_at) <= new Date()) {
       const err:any=new Error('VIP expirado'); err.status=403; err.code='VIP_EXPIRED'; throw err;
     }
     return user;
   }
   ```
   - Usado em todas as APIs Manager (`gpro/sync`, `python`, `calendar`, `market/update`, `gpro/token`). Retorna `403 VIP_EXPIRED` (não 401) para diferenciar de não autenticado.

2. **Bloqueio Manager:** `app/dashboard/layout.tsx` ou `GameContext` após `getUserState` verifica `vip_expires_at`; se expirado e `role !== admin`, renderiza tela `Acesso VIP expirado — renove com novo convite` (mantém login, não apaga usuário, preserva `last_import_snapshot`).

3. **Preservação:** não `delete` usuário nem `invite_codes`; histórico intacto. `sponsors_database_json` etc. permanecem.

4. **Renovação futura:** rota `POST /api/vip/renew` com `inviteCode` válido (novo) → `update user_state set vip_started_at=now(), vip_expires_at=now()+30d, vip_invite_id=:id`.

5. **Frontend não controla:** expiração validada em **cada API**; frontend apenas exibe mensagem baseada no `403` ou no `select vip_expires_at` (leitura via `select_own` permitida).

---

## FASE 6 — Impacto no APK

**Funciona igual web/APK?** Sim, se lógica for server-side (`requireVip` em APIs). APK usa mesmo `supabase.auth` e mesmo `server.url` (`capacitor.config.ts:7`).

**Pontos específicos:**

- **Login:** `supabase.auth.signIn` + `getUserState` — se VIP expirado, login ainda sucede (auth ok), mas `requireVip` bloqueia `get_state`/`sync`. APK deve mostrar tela expirada após login, não bloquear login.
- **Reabertura:** `GameContext` refetch `getUserState` → verifica `vip_expires_at`; mesma lógica.
- **Token já existente:** `getUser()` valida JWT; expiração VIP é **independente** de JWT expiry, checada a cada API call. Token válido mas VIP expirado → 403.
- **Expira enquanto aberto:** próxima chamada API (ex `fetchSponsorData`) retornará 403 → `GameContext` detecta `VIP_EXPIRED` e redireciona para tela expirada. Polling não necessário; validação sob demanda é suficiente. Se quiser UX instantânea, adicionar `setInterval` que verifica `vip_expires_at` a cada 5 min (opcional).
- **Offline:** sem conexão, não há como validar expiração server-side; APK deve cachear `vip_expires_at` localmente (lido no último online) e bloquear Manager se `cached vip_expires_at <= now()` mesmo offline (defesa em profundidade). Ao voltar online, revalida via API. Não há tratamento especial além de cache.
- **Tratamento especial APK?** Não, exceto garantir que `AdminInviteButton` e rotas `/admin/*` não sejam embarcadas ou retornem 403 (já é `requireAdmin`).

---

## FASE 7 — Testes Necessários

1. **Convite válido aceito** — `generateNewInvite` → `signUpWithInviteCode` com `is_used=false` → usuário criado, `invite_codes.is_used=true`, `user_state` criado.
2. **Convite expirado (regra atual)** — hoje sem expiração, mas se `is_used=true` → `Código inválido ou já utilizado` (403).
3. **Convite já utilizado** — segundo `signUp` com mesmo código → 403.
4. **Ativação VIP 30 dias** — `signUpWithInviteCode` com novo convite → `user_state.vip_started_at` ~ `now()` (±5s), `vip_expires_at` = `started + 30d` (±5s), `vip_invite_id` = `invite.id`, `access_plan='vip'`.
5. **Conferência `vip_started_at`** — tipo `timestamptz`, não nulo, `>= now()-10s`.
6. **Conferência `vip_expires_at`** — `= started + 30d` (diferença 30*24*60*60*1000 ms ±1000).
7. **VIP ativo** — `vip_expires_at > now()` → `requireVip` retorna 200, `GET /api/python?action=get_state` 200, Manager renderiza.
8. **VIP expirado** — mock `vip_expires_at = now()-1d` → `requireVip` 403 `VIP_EXPIRED`, `GET get_state` 403, Manager mostra tela expirada.
9. **Manipular data no frontend** — `supabase.from('user_state').update({vip_expires_at: '2099-01-01'})` como `authenticated` deve falhar (RLS 42501) ou ser ignorado.
10. **Alterar plano pelo navegador** — `update({role:'admin'})` ou `{access_plan:'vip'}` deve falhar (RLS) ou ser sobrescrito por trigger.
11. **API protegida após expiração** — `POST /api/python?action=sponsors` com VIP expirado → 403.
12. **Admin permanece** — `role=admin` com `vip_expires_at` expirado → `requireVip` bypass → 200.
13. **Convite não reinicia prazo** — reusar mesmo `vip_invite_id` → rejeitado; segundo `signup` com mesmo código → 403, sem update de `vip_expires_at`.
14. **Renovação sem duplicar** — `POST /api/vip/renew` com novo código → `vip_started_at` atualizado, `vip_expires_at` novo, sem nova linha `user_state` (upsert).
15. **Web e APK** — login, `cap sync`, reabertura, offline cache, expiração durante sessão — testes E2E com `@capacitor` + `supabase.auth`.

---

## FASE 8 — Entrega

### 1. Arquivos analisados
`app/actions/signup.ts:17-72`, `app/actions/admin.ts:12-37`, `app/login/page.tsx:18`, `app/lib/db.ts:30-336`, `app/lib/auth.ts:33-84`, `app/dashboard/admin/layout.tsx:19`, `app/dashboard/layout.tsx:162`, `supabase/migrations/20250914000001_rls_hardening.sql:9-73`, `capacitor.config.ts:4`, `app/api/*` (7 gerente, 5 admin).

### 2. Tabelas e Migrations
- `invite_codes` (`id, code, is_used, created_at`) — sem `expires_at`, sem migration versionada, RLS `invite_select_auth`.
- `user_state` (`user_id PK, role, track, ... sponsors_database_json` — `db.ts:150`) — RLS `user_state_*_own` (`auth.uid()=user_id`), sem VIP cols.
- Migration única `20250914000001_rls_hardening.sql` (aditiva, sem destructive).

### 3. Fluxo atual do convite
`AdminInviteButton → generateNewInvite (ALFA-XXXX) → invite_codes (is_used=false) → login/signup → signUpWithInviteCode (valida is_used=false) → auth.admin.createUser → invite_codes.is_used=true → user_state insert (track=Interlagos)`.

### 4. Ponto exato onde VIP é concedido
Hoje **não há VIP**; a concessão futura deve ser **dentro de `signUpWithInviteCode` após `createUser` e `update is_used`**, no `insert user_state` (`signup.ts:59`) — server-side, com `now()`.

### 5. Estrutura recomendada
Adicionar a `public.user_state`:
```sql
access_plan text,
vip_started_at timestamptz,
vip_expires_at timestamptz,
vip_invite_id uuid references public.invite_codes(id)
```
Sem nova tabela, sem `profiles`.

### 6. Campos necessários
`access_plan, vip_started_at, vip_expires_at, vip_invite_id` (nullable, aditivos).

### 7. Riscos
- **RLS `user_state_update_own` permite cliente sobrescrever `vip_*`/`role`** — mitigar com RLS `FOR UPDATE` restrita a `service_role` para essas colunas ou trigger.
- **Convite sem `used_by`/`expires_at`** — auditoria limitada; `vip_invite_id` resolve para VIP, mas histórico de quem criou convite não existe.
- **Admin bloqueado por engano** — `requireVip` deve fazer `if isAdmin → skip`.
- **Reinício de prazo via refresh** — só se VIP for escrito no client; server-side evita.

### 8. APIs e Componentes Alterados
- **APIs:** `gpro/sync`, `python` (6 actions), `calendar`, `manager/profile`, `market/update`, `gpro/token` → adicionar `requireVip` após `requireAuth`.
- **Auth:** `app/lib/auth.ts` → novo `requireVip`.
- **DB:** `app/lib/db.ts` → `UserState` + `select` + `saveUserState` para 4 cols.
- **Frontend:** `dashboard/layout.tsx`, `GameContext`, novo `components/VipExpired.tsx`, `login/page.tsx` mensagem renovação.
- **Nova rota:** `app/api/vip/renew` (opcional futura).

### 9. Estratégia RLS/Autorização
- `user_state` `select_own` mantém leitura `vip_expires_at` para UI.
- **Sem** `update_own` para `vip_*`/`access_plan`/`role` para `authenticated`; apenas `service_role` (bypass) escreve. Implementar via 2 políticas: `user_state_update_own` com `using`/`with check` que exclui essas colunas ou via `REVOKE` + `GRANT` coluna-level (ou tabela `vip_access` separada se RLS coluna-level muito complexo).
- `invite_codes` permanece `select` para `authenticated`, escrita só `service_role`.

### 10. Plano por Fases (menor impacto)

**Fase 11.1 — Schema + Auth (1 sprint, sem quebrar):**
- Migration aditiva `20250917000001_add_vip_access.sql` com 4 colunas + índice `vip_expires_at` + `comment`.
- `db.ts` `UserState` + `select` + `saveUserState` (somente `supabaseAdmin` escreve VIP).
- `auth.ts` `requireVip` + testes 9-12.
- **Sem** bloquear Manager ainda (feature flag `VIP_CHECK=false`).

**Fase 11.2 — Bloqueio Manager + UI expirado (1 sprint):**
- Ativar `requireVip` nas 7 APIs gerente (flag `true`).
- `dashboard/layout.tsx` tela expirada + `GameContext` 403 handler.
- Testes 7-11.

**Fase 11.3 — Renovação (1 sprint):**
- `POST /api/vip/renew` + UI renovação + testes 13-15.
- APK cache offline + testes 15.

### 11. Testes Recomendados
Ver Fase 7 (15 cenários).

### 12. Estimativa de Impacto
- **Baixo:** 1 migration aditiva, 2 arquivos `auth.ts`/`db.ts`, 7 APIs + 2 layouts, sem alteração de `invite_codes`, `fórmulas patrocinadores`, `Capacitor` (mesmo backend). ~2-3 dias por fase.

### 13. Confirmação Validade Convite Intacta
**Confirmado:** `invite_codes` (`code, is_used, created_at`) e `signup.ts:28-32` (`is_used=false` sem `expires_at`) **não serão alterados**. Nova validade de 30 dias é **exclusiva de `user_state.vip_expires_at`**, calculada no servidor em `vip_started_at`. Histórico `invite_codes.is_used=true` preservado, sem segundo sistema de convites.

---

## Restrições Atendidas

- Sem alteração de código nesta auditoria; sem migration/commit/push; sem exposição de segredos; sem operação destrutiva; `invite_codes` validade intacta; nenhuma alteração em patrocinadores/Manager sem impacto documentado.

## Resultado Esperado — Próximo Sprint

**ALFA-011.1 — Implementação do acesso VIP com validade de 30 dias** — implementar Fase 11.1 (schema + `requireVip` flag off) após aprovação deste plano.
