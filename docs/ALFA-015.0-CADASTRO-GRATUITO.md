# ALFA-015.0 — Cadastro gratuito + redirecionamento para planos

Sprint: criar a porta de entrada **gratuita** do produto (`/cadastro`), com usuário **FREE**
autenticado pelo Supabase Auth existente, direcionado a `/planos` e capaz de iniciar a compra
Pix já existente. **Premium continua sendo concedido exclusivamente pelo fluxo de pagamento
confirmado.**

Data: 2026-09-19 · Status: implementado, **sem commit, sem push, sem deploy, sem migration aplicada**.

---

## 1. Diagnóstico da arquitetura anterior (FASE 1 — auditoria)

### 1.1 Como o usuário era criado antes

Existia **um único** caminho de criação de conta: a aba "Cadastro" de `/login`, que **exigia um
código de convite VIP**.

`app/login/page.tsx` → `app/actions/signup.ts` (`signUpWithInviteCode`):

1. valida o convite em `invite_codes`;
2. `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })` — service_role;
3. consome o convite atomicamente (`is_used`, `used_by`);
4. cria `user_state` (perfil) com `track = 'Interlagos'`;
5. `ensureVipGrantForInvite()` → **cria `access_grant` + `access_event`** e sincroniza
   `user_state.vip_status / vip_expires_at / access_plan / access_grant_id`.

Consequência: **toda conta criada no sistema já nascia com acesso Premium**. Não existia
usuário gratuito — o produto não tinha porta de entrada comercial.

### 1.2 Configuração real do Supabase Auth (verificada por leitura, não alterada)

Consulta somente-leitura em `GET /auth/v1/settings` do projeto `cycqigdywekfwwaspsus`:

| Setting | Valor | Efeito |
|---|---|---|
| `disable_signup` | **true** | `signUp` público está **desabilitado** |
| `mailer_autoconfirm` | **false** | **confirmação de e-mail é obrigatória** |
| `external.email` | true | provedor de e-mail habilitado |

Isso explica, de forma independente, por que não existia fluxo free: o único caminho viável era
`auth.admin.createUser` com `email_confirm: true` (service_role), que **ignora** `disable_signup`
e **pula** a confirmação de e-mail.

### 1.3 Auth, middleware e proteção de rotas

| Peça | Situação encontrada |
|---|---|
| Client do browser | `app/lib/supabase.ts` — `createBrowserClient` (@supabase/ssr) |
| Client do servidor | `utils/supabase/server.ts` — `createServerClient` + cookies |
| Client admin | `app/lib/supabase-admin.ts` — `server-only`, service_role |
| Middleware (`middleware.ts`) | só chama `updateSession` |
| `updateSession` | **apenas atualiza a sessão**; não redireciona nem bloqueia nada |
| Helper de auth | `app/lib/auth.ts` — `getAuthenticatedUser`, `requireAuth`, `isAdmin`, `requireAdmin` |
| Proteção real | só `/dashboard/admin/*` (`app/dashboard/admin/layout.tsx`: sessão + `user_state.role === 'admin'`) |
| Enforcement VIP | `app/lib/access/accessService.ts` com `VIP_CHECK = false` → **não bloqueia ninguém** |

**O middleware NÃO assume Premium.** Não havia nada a corrigir nesse ponto.

### 1.4 "profiles", `access_grants` e regras de Premium

- **Não existe tabela `profiles`** e **não existe trigger `auth.users → profiles`**.
- O perfil do usuário é `public.user_state` (`role`, `track`, `driver_*`, `vip_status`,
  `vip_expires_at`, `access_plan`, `access_grant_id`, `gpro_token`, ...). **Não há coluna de nome.**
- Premium: `access_grants` (fonte) + `user_state` (resumo) — `interpretGrant` / `pickBestGrant`.
- Escalada de privilégio já bloqueada em **UPDATE** (`20250917000002_harden_user_state_update.sql`,
  trigger `trg_user_state_privilege_guard`) — mas **não em INSERT**.

### 1.5 `/planos`, PIX e preços

- `/planos` (`app/planos/page.tsx`) é **pública**, lê `premium_plans` no servidor (service_role,
  somente `is_active = true`) e mostra o `CheckoutButton`.
- `POST /api/payments/orders` exige **apenas autenticação** — já não exigia Premium.
- Sem sessão, o `CheckoutButton` envia para `/login?next=/planos&plan=CODE` — mas **`/login`
  ignorava o `?next=`** e mandava todo mundo para `/dashboard/manager`.
- Gate de cobrança: `PIX_ENABLED` (lido só no servidor). Preços vigentes (VIP Mensal R$ 1,99 /
  VIP Vitalício R$ 99,00) são administrados pelo painel `/api/admin/plans` — **não foram tocados**.

### 1.6 Causa-raiz do "não existe free"

1. cadastro público dependia de convite (todo convite concedia Premium);
2. `disable_signup = true` bloqueava qualquer `signUp` público;
3. `/login` sempre terminava em `/dashboard/manager`, sem alternativa para quem não tem Premium.

---

## 2. Arquivos criados

| Arquivo | Papel |
|---|---|
| `app/cadastro/page.tsx` | Página `/cadastro` (padrão visual do `/login`): Nome, E-mail, Senha, Confirmação, estados enviando/erro/sucesso/confirmação pendente, "Já tenho uma conta" |
| `app/actions/freeSignup.ts` | Server Action `signUpFreeUser` — **autoridade** do cadastro (valida, cria no Supabase Auth, inicializa perfil, nunca concede benefício) |
| `app/lib/auth-flow.ts` | Módulo puro: validação, tradução de erros do Auth, anti-enumeração, `safeInternalPath`, `resolvePostLoginDestination` |
| `app/auth/confirmar/route.ts` | Retorno do link de confirmação de e-mail (PKCE `?code=` ou `?token_hash=`) → sessão → `/planos` |
| `supabase/migrations/20260919000001_harden_user_state_insert.sql` | **PREPARADA, NÃO APLICADA** — BEFORE INSERT em `user_state` contra escalada de privilégio |
| `tests/alfa-015-cadastro-free.test.js` | TESTE 1..6, 10, 11, 12 + segurança (comportamental + estrutural) |
| `tests/alfa-015-jornada-free.test.js` | TESTE 7, 8, 9 + regressão (preços, webhook, PIX, middleware) |

## 3. Arquivos modificados

| Arquivo | Mudança | Motivo |
|---|---|---|
| `app/login/page.tsx` | passou a honrar `?next=` (caminho interno validado), resolve destino pós-login (free sem plano → `/planos`; admin, com plano ou desconhecido → `/dashboard/manager`, como antes) + CTA "Criar conta grátis" | o checkout já enviava `?next=/planos` e era ignorado; free precisa sair do login no funil comercial |
| `app/planos/page.tsx` | "Entrar" → `/login?next=/planos`; link "Não tem conta? Criar conta grátis" | manter o visitante no funil; preços/planos/CTA Pix inalterados |
| `app/page.tsx` | 4 CTAs "Criar conta grátis" (header, menu mobile, hero, CTA final) | porta de entrada precisa ser alcançável |
| `app/lib/access/accessLogger.ts` | +8 eventos `free.signup.*` (aditivo) | observabilidade com mascaramento, sem eventos VIP falsos |

**Não foram tocados:** `mercadopago-client.ts`, `paymentService.ts`, `orderService.ts`, webhook,
`app/api/payments/**`, `PIX_ENABLED`, `Idempotency-Key`, preços, `premium_plans`, `accessService.ts`.
As modificações pendentes em `app/api/payments/orders/route.ts`, `mercadopago-client.ts` e
`paymentService.ts` que aparecem em `git status` **já existiam antes desta sprint**.

---

## 4. Fluxo final

```
/cadastro  (Nome, E-mail, Senha, Confirmar senha)
   ↓ Server Action signUpFreeUser  (validação no servidor)
supabase.auth.signUp  →  Supabase Auth
   ↓ (cria user_state: role 'user', sem VIP)          ↓ se confirmação de e-mail exigida
usuário FREE — sessão válida                          e-mail → /auth/confirmar → sessão
   ↓                                                        ↓
/planos  (VIP Mensal R$ 1,99 / VIP Vitalício R$ 99,00)  ←────┘
   ↓ Comprar com Pix
POST /api/payments/orders (autenticado, preço do banco)
   ↓ Mercado Pago / Pix  (fluxo existente, intocado)
webhook confirmado → premium_payments + access_grant (source 'payment')
   ↓
Premium/VIP liberado nas regras atuais
```

---

## 5. Como o sistema diferencia Free / Premium / Admin

| Estado | Como é determinado | Criado pelo cadastro? |
|---|---|---|
| **Free** | autenticado + **sem** `access_grants` ativo e sem `access_plan`/`vip_expires_at` válido | ✅ sim |
| **Premium/VIP** | `access_grants` com `status='active'` e (`expires_at` nulo = vitalício **ou** futuro) — `interpretGrant`/`pickBestGrant`; `user_state` é só resumo | ❌ nunca |
| **Admin** | `user_state.role = 'admin'` (`isAdmin()`); área `/dashboard/admin` protegida no layout | ❌ nunca |

Destino pós-login (`resolvePostLoginDestination`, regra pura e testada):

```
?next= interno  >  acesso desconhecido (sem linha/consulta falhou, comportamento atual)
                >  admin (comportamento atual)
                >  possui access_plan registrado — ativo, vitalício ou vencido (comportamento atual)
                >  usuário gratuito (sem plano)  →  /planos
```

Decisão deliberada: quem **já tem plano registrado** (inclusive vencido) mantém o destino atual
`/dashboard/manager`. Só o usuário **sem plano** — o usuário gratuito — é conduzido ao funil
comercial. Isso evita qualquer regressão de UX para quem já comprou.

## 6. Como o cadastro impede privilégio indevido

1. **Só 4 campos são lidos** de `FormData` (`name`, `email`, `password`, `confirmPassword`).
   `role`, `premium`, `access_grant`, `plan`, `planCode`, `status` **não são lidos** — não há como
   o cliente enviá-los.
2. **A Server Action é a autoridade**: revalida formato/força de senha no servidor; a validação do
   cliente é apenas UX.
3. **Perfil criado no servidor** com `role: 'user'` explícito e
   `upsert(..., { ignoreDuplicates: true })` → `ON CONFLICT DO NOTHING`: **nunca** sobrescreve uma
   linha existente (não apaga/degrada VIP nem admin).
4. `user_state` nasce sem `vip_status`, `vip_expires_at`, `access_plan`, `access_grant_id`.
5. Nenhuma escrita em `access_grants`, `access_events`, `premium_orders`, `premium_payments`,
   `payment_events`.
6. Defesa em profundidade no banco: UPDATE já bloqueado (ALFA-011.4); **INSERT** coberto pela
   migration preparada nesta sprint.
7. `service_role` permanece `server-only`; nenhum token/segredo chega ao cliente; e-mail e id
   mascarados nos logs.
8. Anti-enumeração respeitada: quando o GoTrue responde "sucesso sem sessão" com `identities`
   vazio, o cadastro é tratado como **e-mail já cadastrado** (mensagem clara ao usuário).

## 7. Alterações necessárias no Supabase (ação manual)

### 7.1 Obrigatória para o cadastro público funcionar

`disable_signup = true` → **habilitar cadastro público**:

> Supabase Dashboard → Authentication → **Sign In / Providers** → *Email* →
> **Allow new users to sign up** = ON
> (equivalente: `disable_signup = false` na config do projeto)

**Impacto da mudança:** a partir daí qualquer visitante pode criar conta no Supabase Auth
(sem convite). Não concede Premium em nenhum caso — o grant continua vindo só do pagamento
confirmado. Mitigações recomendadas no mesmo painel (avaliar antes de ligar):
captcha/Turnstile, rate limit de e-mail e templates de confirmação.

### 7.2 Confirmação de e-mail (`mailer_autoconfirm = false`)

O fluxo **respeita** a configuração atual: `signUp` não devolve sessão, o Supabase envia o e-mail,
a rota `/auth/confirmar` troca o código/token por sessão e segue para `/planos`.
Sem `mailer_autoconfirm = true`, **nada mais é necessário** além de:

> Authentication → URL Configuration → **Redirect URLs**: incluir
> `https://<dominio>/auth/confirmar` (e o equivalente de preview/local)

Se a URL não estiver na allowlist, o Supabase usa o `Site URL` e o usuário cai na home sem sessão
(ele ainda consegue entrar por `/login`).

### 7.3 Migration

Nenhuma migration é **obrigatória** para o cadastro gratuito funcionar (não há `profiles`,
não há trigger novo, `user_state` já existe e é reutilizado).
A migration `20260919000001_harden_user_state_insert.sql` é **hardening recomendado**
(habilitação do cadastro público aumenta a exposição do INSERT em `user_state`) e está
**preparada e NÃO aplicada**. Nenhum `supabase db push` / `db reset` foi executado.

---

## 8. Testes executados

| Comando | Resultado |
|---|---|
| `node tests/alfa-015-cadastro-free.test.js` | ✅ TESTE 1..6, 10, 11, 12 + segurança |
| `node tests/alfa-015-jornada-free.test.js` | ✅ TESTE 7, 8, 9 + regressão |
| `node --test tests/pix-*.test.js` | ✅ 8/8 arquivos |
| `node --test tests/alfa-*.test.js` | ⚠️ 25/33 — 8 falhas **pré-existentes** (ver 8.1) |

### 8.1 Falhas pré-existentes (não causadas por esta sprint)

`alfa-002`, `alfa-003-regression`, `alfa-014-idempotency`, `alfa-014-security`,
`alfa-0142-payment-preparation`, `alfa-0143-isolation`, `alfa-0143-pix-txid`, `alfa-0143-security`.

Evidência: esses arquivos leem **somente** `app/lib/payments/**`, `app/api/payments/**`,
`app/api/admin/**`, `app/api/sponsors/route.js`, `app/dashboard/**` — **nenhum** arquivo criado ou
modificado nesta sprint. As asserções que falham são de sprints anteriores ("sem gateway externo",
"nenhum QR Code gerado", "sem grant VIP automático") e foram invalidadas pela implementação real
do PIX (PIX-009/010), cujas alterações já estavam **não commitadas** no working tree antes desta
sessão (`git diff --stat` em `orders/route.ts`, `mercadopago-client.ts`, `paymentService.ts`).

## 9. TypeScript

`npx tsc --noEmit` → **sem erros**.

## 10. Build

`npm run build` → **✅ compilado com sucesso** (`✓ Compiled successfully in 16.6s`, exit 0).
Rotas novas presentes: `○ /cadastro` (estática) e `ƒ /auth/confirmar` (dinâmica).

## 11. `git diff --check`

→ **✅ sem erros** (exit 0). Apenas avisos informativos de CRLF do Git em arquivos já existentes.

## 12. Pendências / ação manual

1. **Ligar o cadastro público** no Supabase (`disable_signup = false`) — sem isso `/cadastro`
   responde de forma honesta: *"O cadastro público está desativado no momento…"*
   (`code: SIGNUP_DISABLED`) e **nada é criado**.
2. **Incluir `/auth/confirmar` nas Redirect URLs** do projeto Supabase.
3. Revisar e, se aprovado, **aplicar** a migration de hardening de INSERT (fora desta sprint).
4. Revisar o destino pós-login de usuários **legados sem linha em `user_state`** (mantido em
   `/dashboard/manager` de propósito, para não regredir ninguém).
5. Os 8 testes pré-existentes em falha merecem sprint própria (atualização das asserções
   ALFA-014.x para o comportamento real do PIX).
6. Não há commit, push, deploy, migration aplicada, alteração de credenciais, de preço, de
   webhook ou de configuração de Production nesta entrega.
