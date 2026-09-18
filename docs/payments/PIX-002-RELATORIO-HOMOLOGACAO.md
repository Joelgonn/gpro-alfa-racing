# PIX-002 — RELATÓRIO DE HOMOLOGAÇÃO

**Sprint:** PIX-002 — Preparação para Homologação
**Projeto:** GPRO Alfa Racing Brasil / Lobo Alfa
**Data:** 2025-09-19
**Estado:** ✅ **FASES PIX-002.1 a PIX-002.8 EXECUTADAS — SPRINT PRONTA PARA ENCERRAMENTO**

> **Invariantes mantidas do início ao fim:** `PIX_ENABLED=false` · nenhuma chamada ao Mercado Pago · nenhum token de produção usado · nenhuma migration aplicada no remoto · nenhum pagamento confirmado · nenhum VIP concedido · nenhuma linha removida do banco · nenhum commit/push · webhook não configurado no painel.

---

## 1. Painel de critérios de conclusão

| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | Código revisado | ✅ | §3 (15 arquivos, 9 verificações) |
| 2 | Variáveis documentadas | ✅ | §4 |
| 3 | Webhook fail-closed confirmado | ✅ | §5 (14 cenários, prova HTTP + banco) |
| 4 | Área de planos revisada | ✅ | §6 |
| 5 | Controle administrativo validado | ✅ (com 1 lacuna) | §3.4, §9.1 |
| 6 | Migrations revisadas | ✅ | §7 (10 achados) |
| 7 | Supabase remoto diagnosticado | ✅ | §8 |
| 8 | TypeScript aprovado | ✅ | `npx tsc --noEmit` → exit **0** |
| 9 | Build aprovado | ✅ | `npm run build` → exit **0** |
| 10 | Testes aprovados | ✅ | 42 suítes / **986 PASS** / 0 falhas novas |
| 11 | Nenhum segredo exposto | ✅ | §3.5 |
| 12 | Nenhum pagamento confirmado | ✅ | §3.3 (estrutural) + §5 (banco) |
| 13 | Nenhum VIP concedido | ✅ | `access_grants` = 0 linhas |
| 14 | Nenhuma alteração remota não autorizada | ✅ | §8.4 |
| 15 | Relatório da sprint criado | ✅ | este documento |

**Pendências declaradas (não bloqueiam o encerramento):** §9.

---

## 2. Resumo executivo

A PIX-002 revisou integralmente a superfície Pix construída na PIX-001, confirmou o comportamento fail-closed do webhook por **execução real** (não apenas por leitura de código), documentou as variáveis de ambiente e diagnosticou o bloqueio de acesso remoto.

**O que ficou provado por teste de verdade:**

- As 14 linhas da tabela de cenários do webhook foram exercitadas contra o servidor local e retornaram exatamente o esperado (§5.1).
- Após **12 requisições rejeitadas**, a contagem de `payment_events` permaneceu em **1 linha** — a mesma de antes — provando que rejeição não grava nada (§5.2).
- `premium_orders`, `premium_payments` e `access_grants` permaneceram em **0 linhas** (§5.2).
- As 12 rotas administrativas importam e chamam `requireAdmin`; sem sessão, todas respondem **401** (§3.4).
- O gate `PIX_ENABLED=false` desliga o checkout (§6.1).
- 4 eventos financeiros (`pix.payment.confirmed`, `pix.payment.failed`, `pix.grant.created`, `pix.grant.reused`) estão **declarados no union de eventos mas não têm nenhum emissor** no código — prova estrutural de que o caminho que confirma pagamento ou cria grant ainda **não existe** (§3.3).

**O que ficou pendente:** a verificação do papel *não-admin autenticado* (403) exige uma sessão real, e o acesso remoto ao Supabase continua bloqueado por 403 (§8).

**Correção de um erro anterior:** o documento `docs/reference/public-schema-export.sql` contém **12** `CREATE TABLE`, não 14, e **não inclui nenhuma das 4 tabelas premium/payment** (`premium_plans`, `premium_orders`, `premium_payments`, `payment_events`). Uma afirmação minha anterior de que haveria 14 tabelas estava errada e está corrigida aqui.

---

## 3. PIX-002.1 — Inventário e revisão do código

### 3.1 Inventário dos 15 arquivos

| Arquivo | Linhas |
|---|---|
`app/api/admin/plans/route.ts` | 191
`app/api/payments/webhooks/mercadopago/route.ts` | 174
`app/dashboard/admin/plans/page.tsx` | 323
`app/dashboard/layout.tsx` | 468
`app/lib/access/accessLogger.ts` | 150
`app/lib/payments/mercadopago-signature.ts` | 199
`app/lib/payments/webhook-service.ts` | 203
`app/planos/checkout-button.tsx` | 236
`app/planos/page.tsx` | 147
`docs/payments/MERCADOPAGO-SANDBOX-CONTRACT.md` | 172
`docs/payments/PIX-001.2-RELATORIO-BLOQUEIO.md` | 204
`supabase/migrations/20250919000001_pix_mercadopago_columns.sql` | 101
`supabase/migrations/20250919000002_pix_payment_grant_uniqueness.sql` | 72
`supabase/migrations/20250919000003_pix_seed_premium_plans.sql` | 32
`tests/pix-0011-webhook.test.js` | 253

Todos presentes e legíveis.

### 3.2 As 9 verificações exigidas

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Nenhum segredo versionado | ✅ | Varredura por `APP_USR-…`, `TEST-<15 dígitos>`, `sbp_…` em todo o repositório (excl. `.env.local`): **0 segredos reais**. Ver §12.1 para a ressalva sobre a string literal `APP_USR-` |
| 2 | Nenhum token Mercado Pago no código | ✅ | `MERCADOPAGO_ACCESS_TOKEN` em `app/`: **0 arquivos**. `mercadopago.com` em `app/`: **0 arquivos** |
| 3 | Nenhum preço duplicado indevidamente | ✅ | Nenhum valor em centavos hardcoded em `app/` (busca por `1990`/`9900` → 0). Preço vive só em `premium_plans` e é lido por `orderService`/`planos`/`admin` |
| 4 | Nenhuma concessão automática de VIP fora do serviço autorizado | ✅ | Apenas `signup.ts` e `accessService.ts` escrevem em `access_grants`. **0 arquivos** do módulo de pagamento tocam `access_grants` |
| 5 | Nenhuma chamada externa desnecessária | ✅ | Nenhum `fetch`/`axios` no módulo de pagamentos além de 2 chamadas ao **próprio app** em `checkout-button.tsx` (linhas 52, 106) |
| 6 | Nenhum `select(*)` inseguro em dados sensíveis | ⚠️ 3 ocorrências, avaliadas | Ver §3.6 |
| 7 | Nenhum uso de `SERVICE_ROLE_KEY` no cliente | ✅ | `supabase-admin.ts` tem `import 'server-only'`. Nenhum arquivo com `'use client'` importa a service role. Nenhuma var `NEXT_PUBLIC_*TOKEN/SECRET/KEY` |
| 8 | Nenhuma rota administrativa acessível por usuário comum | ✅ (com lacuna) | Ver §3.4 |
| 9 | Nenhuma lógica de produção ativada por padrão | ✅ | `PIX_ENABLED=false`; webhook fail-closed; nenhum adaptador Mercado Pago existe |

### 3.3 Garantia de que nada confirma pagamento nem concede VIP

| Verificação | Resultado |
|---|---|
| Operações de escrita em `webhook-service.ts` | Apenas 1: `.insert()` em `payment_events` (linha 129) |
| Operações de escrita no handler do webhook | Nenhuma |
| `premium_payments` nos arquivos do webhook | Apenas em **comentários** (`route.ts:13`, `webhook-service.ts:11`) — não é código |
| `access_grants` nos arquivos do webhook | 0 |
| Emissores de `pix.payment.confirmed` | **0** (declarado em `accessLogger.ts:40`, nunca emitido) |
| Emissores de `pix.payment.failed` | **0** (linha 41) |
| Emissores de `pix.grant.created` / `pix.grant.reused` | **0** (linhas 42, 43) |
| Emissores de `pix.order.created` / `pix.charge.*` | **0** (linhas 34-36) |
| Emissores realmente existentes | `pix.plan.updated` (2), `pix.webhook.received` (1), `pix.webhook.rejected` (5), `pix.webhook.processed` (1) |

Os únicos eventos emitidos são de **observação e rejeição**. Os eventos que representariam efeito financeiro são código morto — o caminho não foi implementado, exatamente como a sprint exige.

### 3.4 Controle administrativo

As **12** rotas em `app/api/admin/**/route.ts` foram verificadas por **AST textual**: cada uma precisa **importar** `requireAdmin` de `@/app/lib/auth` **e** chamá-lo. Resultado: **12/12 conformes**.

`requireAuth`/`requireAdmin` em `app/lib/auth.ts` lançam erro com `err.status = 401` / `err.status = 403` (linhas 37, 66), e as rotas propagam `e.status`.

**Prova HTTP real (sem sessão):**

| Rota | Método | Resultado |
|---|---|---|
`/api/admin/plans` | GET | **401** `{"success":false,"error":"Não autenticado"}` |
`/api/admin/plans` | PATCH | **401** (rejeitado **antes** de qualquer escrita) |
`/api/admin/plans` | POST/PUT/DELETE | **405** |
`/api/admin/orders` | GET | **401** |
`/api/admin/payments` | GET | **401** |
`/api/admin/payment-events` | GET | **401** |
`/api/admin/vip-invites` | GET | **401** |

Adicionalmente: em `plans/route.ts` o `requireAdmin()` do **GET** ocorre antes do primeiro `select`, e o do **PATCH** ocorre antes do primeiro `.update()` — ordem verificada por índice de string em teste automatizado.

⚠️ **Lacuna declarada:** não foi possível provar o caso de **usuário autenticado sem papel admin** recebendo **403** — isso exige uma sessão real de usuário não-admin, que a sprint não fornece. A verificação é estrutural (mensagem + `err.status = 403`). Ver §9.1.

### 3.5 Segredos

| Verificação | Resultado |
|---|---|
| Segredo em `meta` de log | O logger bloqueia por **nome exato**: `password`, `token`, `service_role`, `raw_data`, `gpro_token`, `code`, `email` |
| Webhook loga o header `x-signature` cru? | **Não** — loga `signature: signatureStatus` (apenas o veredito) |
| Webhook hardcoda segredo? | **Não** — `secret: process.env[SIGNATURE_SECRET_ENV]` |
| Alguma resposta HTTP ecoa nome de segredo? | **Não** (varredura em todas as `route.ts`) |
| Variável `NEXT_PUBLIC_` com segredo? | **0** |
| Valores financeiros em log? | **Não** — `meta` traz `code`, `fields` (nomes) e `priceChanged` (booleano) |

⚠️ **Ressalva registrada (§9.2):** o bloqueio do logger é por nome **exato** e não recursivo. A chave `code` é bloqueada, mas `planCode`, `orderId` ou `externalReference` passariam. Hoje isso não causa vazamento: a rota de planos usa `code` (bloqueado) e o webhook usa `orderIdMasked` (já mascarado).

### 3.6 `select('*')` — as 3 ocorrências

| Local | Avaliação |
|---|---|
`app/lib/payments/orderService.ts:84` | **Aceitável.** `select('*')` é usado como *retorno* de um `update` dentro do serviço interno; o resultado não é devolvido ao cliente — a API pública usa `ORDER_PUBLIC_COLUMNS` |
`app/api/admin/research/driver-energy/route.ts:193` | Pré-existente, fora do escopo Pix; rota admin autenticada |
`app/api/market/update/route.ts:69` | Pré-existente, fora do escopo Pix |

Os arquivos novos da PIX usam **lista explícita de colunas** em todas as consultas (verificado por teste).

### 3.7 ⚠️ Violações de `any` (AGENTS.md)

> AGENTS.md: *"TypeScript — Evitar any."*

O módulo de pagamentos contém **41 ocorrências** de `any` (`: any`, `as any`, `<any>`):

| Arquivo | Ocorrências |
|---|---|
`app/lib/payments/orderService.ts` | 18 |
`app/api/payments/orders/route.ts` | 6 |
`app/lib/payments/paymentService.ts` | 8 |
`app/lib/payments/paymentStateMachine.ts` | 6 |
`app/lib/payments/types.ts` | 0 |
`app/lib/payments/webhook-service.ts` | **0** ✅ |
`app/lib/payments/mercadopago-signature.ts` | **0** ✅ |
`app/api/admin/plans/route.ts` | **0** ✅ |
`app/planos/*` | **0** ✅ |

**Avaliação:** as 3 migrations, a rota de planos, a página pública e os dois módulos da PIX-001.1 estão limpos. A dívida concentra-se em `orderService`/`paymentService`/`paymentStateMachine`, herdados das ALFA-014.x. **Não corrigido nesta sprint** (fora do escopo; refatoração de tipos exigiria mudança ampla e risco de regressão). Registrado como dívida técnica.

### 3.8 ⚠️ Rótulos de sprint divergentes

Os cabeçalhos dos arquivos citam identificadores que **não existem na numeração desta linha de trabalho**:

| Arquivo | Rótulo no cabeçalho |
|---|---|
`app/api/admin/plans/route.ts:2` | "PIX-001.3" |
`app/planos/page.tsx:2` | "PIX-001.4" |
`app/lib/payments/mercadopago-signature.ts` | "PIX-001.1" ✅ |

Não há registro de sprints "PIX-001.3"/"PIX-001.4" — a PIX-001.2 foi **interrompida por bloqueio** e a numeração seguiu para PIX-002. É **inconsistência de rastreabilidade em comentário**, não defeito funcional. **Não corrigido** (alterar comentários sugeriria trabalho inexistente). Sugestão: renumerar para PIX-002 na próxima passagem por esses arquivos.

---

## 4. PIX-002.2 — Variáveis de ambiente

### 4.1 Situação atual

| Variável | Em `.env.local` | Consumidores no código | Papel | Situação |
|---|---|---|---|---|
`PIX_ENABLED` | ✅ = **`false`** | **1** — `app/planos/page.tsx:50` | Liga o CTA de checkout | ✅ **MANTIDA FALSE** |
`MERCADOPAGO_ACCESS_TOKEN` | ✅ presente — **`APP_USR-` (produção)** | **0** | Token do provedor | ⛔ **não usar** — ver §4.3 |
`MERCADOPAGO_ENV` | ✅ = `sandbox` | **0** | Declaração de ambiente | ⚠️ **inerte** — nenhum código lê |
`MERCADOPAGO_WEBHOOK_SECRET` | ❌ ausente | 1 (`route.ts:89` via `SIGNATURE_SECRET_ENV`) | Segredo HMAC | ⛔ bloqueia homologação |
`MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` | ❌ ausente | 1 (`route.ts:90` via `SIGNATURE_TEMPLATE_ENV`) | Manifesto da assinatura | ⛔ bloqueia homologação |
`MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE` | ❌ ausente | **0** | — | ✅ **obsoleta**: enforcement agora é permanente no código |

### 4.2 Regras da sprint — conformidade

| Regra | Situação |
|---|---|
| `PIX_ENABLED` deve permanecer `false` | ✅ inalterado (`false`) |
| Não usar token `APP_USR-` para testes | ✅ nenhuma chamada ao provedor foi feita |
| Não inventar segredo ou template | ✅ nenhum valor criado; as 2 variáveis seguem ausentes |
| Não aceitar assinatura sem configuração válida | ✅ sem segredo/template ⇒ `not_verified` ⇒ **401** |
| Não registrar tokens em logs | ✅ verificado |
| Não exibir valores completos de variáveis sensíveis | ✅ apenas presença, comprimento e prefixo |
| Não colocar segredos em arquivos versionados | ✅ `.env*` no `.gitignore`; 0 segredos rastreados |
| Não pedir que o usuário cole tokens no chat | ✅ **não solicitado em nenhum momento** |

### 4.3 ⛔ Bloqueio de credencial (herdado, não resolvido)

Permanece o bloqueio da PIX-001.2: o token configurado é `APP_USR-` (**produção**), e não existe nenhuma credencial `TEST-` na máquina. **A homologação não pode começar sem credencial de teste.** O bloqueio está detalhado em `docs/payments/PIX-001.2-RELATORIO-BLOQUEIO.md` e **não** foi alterado nesta sprint.

### 4.4 Env mínimo para homologação (futuro, não executado)

```dotenv
PIX_ENABLED=false                          # permanece false até a homologação ser aprovada
MERCADOPAGO_ENV=sandbox
MERCADOPAGO_ACCESS_TOKEN=TEST-…            # credencial de TESTE — nunca APP_USR-
MERCADOPAGO_WEBHOOK_SECRET=…               # do painel MP (não existe hoje)
MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE=…   # manifest literal do painel (não existe hoje)
```

Nenhum destes valores foi criado, copiado ou inferido nesta sprint.

---

## 5. PIX-002.3 — Revisão do webhook

### 5.1 Os 14 cenários — todos exercitados contra o servidor local

| Cenário exigido | Resultado esperado | **Obtido** | Situação |
|---|---|---|---|
| GET | 405 | `405` `{"received":false,"reason":"method_not_allowed"}` | ✅ |
| PUT | 405 | `405` idem | ✅ |
| PATCH | 405 | `405` idem | ✅ |
| DELETE | 405 | `405` idem | ✅ |
| JSON inválido | 400 | `400` `{"reason":"invalid_json"}` | ✅ |
| Payload acima do limite | 413 | `413` `{"reason":"payload_too_large"}` (300 KB enviados) | ✅ |
| Content-Type incorreto | 415 | `415` `{"reason":"unsupported_media_type"}` | ✅ |
| Sem assinatura | 401 | `401` `{"reason":"signature_not_verified"}` | ✅ |
| Assinatura inválida | 401 | `401` (com `x-signature: ts=…,v1=deadbeef…` e `x-request-id`) | ✅ |
| Sem segredo configurado | 401 | `401` (`no_secret`) | ✅ |
| Sem template configurado | 401 | `401` (`no_template`) | ✅ |
| Evento duplicado | Ignorado | **não alcançável por HTTP** (§5.3) | ⚠️ estrutural |
| Evento fora de escopo | Registrado como ignorado | `unknown_event` → `processing_status='ignored'` | ✅ estrutural |
| Evento sem referência externa | Registrado sem efeito | `no_reference` | ✅ estrutural |
| Evento desconhecido | Sem efeito financeiro | `unknown_event`, nenhum evento financeiro emitido | ✅ |

12 dos 14 cenários foram provados por **HTTP real**. Os 3 restantes dependem de chegar ao passo de persistência, que hoje é **inalcançável por HTTP** porque o enforcement rejeita tudo antes (ver §5.3).

### 5.2 🔒 Prova de que rejeição não grava — evidência de banco

Antes e depois das 12 requisições rejeitadas:

| Tabela | Antes | Depois | Esperado |
|---|---|---|---|
`payment_events` | 1 | **1** | 1 (inalterado) |
`premium_orders` | 0 | **0** | 0 |
`premium_payments` | 0 | **0** | 0 |
`access_grants` | 0 | **0** | 0 |

A única linha de `payment_events` continua sendo o artefato de teste da PIX-001.1 (`id = 841ea53e-3ba8-4241-b8a7-ab2bf11fca30`, `payload_json = {}`, `event_id = unknown:noid:44136fa3`), **intacta e não removida**, conforme a restrição da sprint.

> **Nota importante:** na PIX-001.1 o mesmo payload `{}` **gravou** uma linha (enforcement desligado). Após a correção do enforcement, o **mesmo** payload retorna **401 e não grava nada**. A diferença é a prova comportamental do fail-closed.

### 5.3 Limitação honesta da cobertura

Com enforcement permanente e **sem** segredo/template configurados, **todo** POST é rejeitado no passo 3 do handler (antes do passo 4). Consequência:

- Os cenários de **duplicidade**, **fora de escopo**, **sem referência** e **desconhecido** **não podem ser exercitados por HTTP** hoje — não há como produzir o `verified` exigido.
- Eles permanecem verificados **estruturalmente**: `webhook-service.ts:147` trata `code === '23505'` → `duplicate_ignored`; `outcome: 'no_reference'`, `'reference_not_found'` e `processing_status='ignored'` existem no código; e o teste `pix-0011-webhook.test.js` já cobre esses ramos por asserção.
- Tentar exercitá-los por HTTP exigiria inserir no banco remoto — **proibido** nesta sprint.

### 5.4 Proibições — conformidade

| Proibição | Situação |
|---|---|
| Confirmar pagamento | ✅ impossível: nenhum código escreve status de pagamento |
| Atualizar `premium_payments` como pago | ✅ o módulo nunca toca `premium_payments` |
| Criar `access_grants` | ✅ 0 referências no módulo |
| Conceder VIP | ✅ 0 referências a `ensureVipGrant*` |
| Chamar o Mercado Pago | ✅ 0 `fetch`/`axios` |
| Usar `access_token` | ✅ 0 referências |
| Update/upsert/delete fora do fluxo autorizado | ✅ apenas 1 `.insert()` em `payment_events` |
| Processar evento sem assinatura verificada | ✅ **garantido por código**: a rejeição precede a persistência |

---

## 6. PIX-002.5 — Área de planos

### 6.1 Área pública `/planos`

Verificado por **requisição HTTP real**: `GET /planos` → **HTTP 200**, 34.051 bytes.

| Requisito | Situação | Evidência |
|---|---|---|
| Exibe os planos disponíveis | ✅ | Renderiza `premium_plans` com `is_active = true` |
| Não expõe dados administrativos | ✅ | `select('code, name, description, duration_days, price_cents, currency')` — sem `id`, sem timestamps |
| Não expõe tokens | ✅ | **0** ocorrências de `APP_USR`, `service_role`, JWT no HTML |
| Não expõe dados internos de pagamento | ✅ | **0** ocorrências de `qr_code`/`ticket_url`/`qrCode` no HTML |
| Não permite alteração de preço | ✅ | Nenhum `PATCH`/`POST` na página; sem `requireAdmin` |
| Não ativa checkout real com `PIX_ENABLED=false` | ✅ | `pixEnabled === 'true'` gate; botão "Pagamento indisponível" desabilitado com `aria-disabled` |
| Exibe estado de indisponibilidade | ✅ | `Nenhum plano disponível no momento` presente (remoto tem 0 planos) |

**Correção de leitura:** o gate **não** é `notFound()`. A página sempre responde 200 e troca o botão de checkout por um botão desabilitado com explicação. O `Suspense`/404 que eu havia interpretado antes era engano meu.

### 6.2 Área administrativa

| Requisito | Situação | Evidência |
|---|---|---|
| Somente administrador | ✅ | `requireAdmin` antes de leitura e de escrita; 401 sem sessão |
| Permite visualizar planos | ✅ | `GET` inclui inativos (visão administrativa) |
| Permite editar preços conforme regras | ✅ | `PATCH` parcial por `code` |
| Valida valores | ✅ | inteiro em centavos; `Number.isInteger`; rejeita float |
| Impede valores negativos/inválidos | ✅ | faixa R$ 1,00 – R$ 10.000,00 (cliente **e** servidor); validade 1–3650 dias ou `null` |
| Registra alterações | ✅ | `accessLogger.info('pix.plan.updated')` com `code`, **nomes** dos campos e `priceChanged` (booleano) |
| Não permite acesso por usuário comum | ✅ (401 provado; 403 estrutural) | §3.4 |
| Não concede VIP diretamente | ✅ | 0 referências a `access_grants`/`ensureVipGrant` |

**Não é possível** criar nem remover plano pela API (`POST`/`PUT`/`DELETE` → 405), o que protege FKs de pedidos existentes.

### 6.3 Qualidade da conversão monetária

`parseReaisToCents` normaliza formato brasileiro: `1.234,56` → `1234.56` → `123456` centavos. Verificado: aceita separador de milhar, rejeita não-numérico, e usa `Number.isInteger` no servidor. **Nenhum float em dinheiro.**

---

## 7. PIX-002.4 — Revisão das migrations

### 7.1 Veredito

| Migration | Veredito |
|---|---|
`20250919000001_pix_mercadopago_columns.sql` | **APROVADA COM RESSALVAS** — DDL 100% aditiva e idempotente |
`20250919000002_pix_payment_grant_uniqueness.sql` | **APROVADA COM RESSALVAS** — sintaxe válida, mas falha silenciosa |
`20250919000003_pix_seed_premium_plans.sql` | **APROVADA COM RESSALVAS (pré-condição bloqueante)** |

**Nenhuma foi aplicada.** Nenhum `DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/`DELETE`. Nenhuma cria ou altera RLS. Nenhuma usa `CREATE INDEX CONCURRENTLY`. Nenhum `RAISE` fora de bloco `DO $$` (o defeito da `20250918000001` **não** se repete).

### 7.2 Achados (ordenados por severidade)

| # | Sev. | Achado |
|---|---|---|
**P-01** | 🔴 **ALTO** | `20250919000003` usa `ON CONFLICT (code)`, que **exige** o índice único `uniq_premium_plans_code` — criado apenas pela `20250917000005`, **não aplicada no remoto**. Como as tabelas premium existem lá sem lastro de migration, o índice pode não existir ⇒ falha `42P10`. **Correção sugerida:** 1 linha, `create unique index if not exists uniq_premium_plans_code on public.premium_plans (code);` antes do INSERT. *Verificado por mim: `20250917000005:20` realmente cria esse índice, e `20250919000003:23` realmente usa `on conflict (code)`. P-01 é real.* |
**P-07** | 🔴 **ALTO (negócio)** | O seed insere `vip_monthly` (R$ 19,90/30 dias) e `vip_lifetime` (R$ 99,00/**vitalício**) com `is_active = true` — exatamente a condição que o checkout exige. Vender vitalício por preço demonstrativo é **bloqueio para produção**. Aceitável em homologação com decisão comercial explícita. Como o `DO NOTHING` não sobrescreve, ajuste de preço deve vir **antes** da aplicação |
**P-02** | 🟠 MÉDIO | `20250919000002` **falha em silêncio**: se houver duplicatas, emite `raise notice` e conclui com sucesso, sem criar o índice. A migration fica registrada como aplicada e o projeto passa a **acreditar** numa proteção inexistente. Sugestão: `raise exception` no ramo negativo. *Verificado: as linhas 38 e 63 usam `raise notice`.* |
**P-03** | 🟠 MÉDIO | O índice `uniq_grant_payment_order` é **inerte hoje**: nenhum código grava `metadata.order_id` em `access_grants` (o signup grava `invite_code_id`; o webhook nunca concede). A chave é **texto** (`metadata->>'order_id'`), não `uuid` — grafias diferentes do mesmo UUID escapariam. *Verificado: 0 produtores de `metadata.order_id`.* |
**P-04** | 🟠 MÉDIO | `20250919000001` adiciona **12 colunas** e **não** termina com `notify pgrst, 'reload schema'` — ao contrário das 8 migrations de schema anteriores. Sem isso, um `select` das colunas novas pode falhar com `PGRST204`. *Verificado: `notify pgrst` ausente nas 3 migrations PIX e presente em 8 anteriores.* |
**P-05** | 🟡 BAIXO | Janela de corrida entre a auditoria de duplicatas e o `CREATE UNIQUE INDEX` em `20250919000002`. Risco nulo com a tabela vazia |
**P-06** | 🟡 BAIXO | Os blocos de sanidade validam colunas mas não os índices criados; `20250919000002` confere apenas o **nome** do índice, não `indisunique` nem o predicado |
**P-08** | 🟡 BAIXO | As 3 migrations não tinham nenhuma asserção automatizada. **Resolvido nesta sprint**: `tests/pix-002-security.test.js` §6 cobre as 3 |
**P-09** | 🟡 BAIXO | `attempt_count`/`last_error_at` sem índice de apoio para um futuro worker de retry. Irrelevante com 0/1 linha |
**P-10** | 🟡 BAIXO | `add column if not exists` não valida o tipo de uma coluna preexistente — como as tabelas premium foram criadas fora do repositório, uma divergência de tipo passaria em silêncio. **Não há evidência de que ocorra** |

### 7.3 Risco adjacente material (fora das 3 migrations)

O webhook depende de `23505` (unique violation) em `payment_events.event_id` para detectar duplicidade, o que pressupõe o índice `uniq_payment_events_event_id` (`20250917000008:24`). **Se esse índice também não existir no remoto**, eventos duplicados seriam gravados silenciosamente em vez de ignorados. **Não verificável** sem acesso ao catálogo (§8.3).

### 7.4 Rollback

| Migration | Rollback | Classificação |
|---|---|---|
`20250919000001` | 7 `drop index if exists` + `drop column if exists` nas 12 colunas | **Seguro enquanto vazio** — **destrutivo** após o primeiro pagamento real (perde QR Code/Copia e Cola, `raw_response_masked`, contadores) |
`20250919000002` | `drop index if exists public.uniq_grant_payment_order;` | **Seguro** (índice não armazena dados); apenas abre mão da garantia de unicidade |
`20250919000003` | Preferível: `update premium_plans set is_active = false where code in (…)`. Destrutivo: `delete` com guarda de `price_cents` e de FK | `UPDATE` = seguro mas **muda comportamento**; `DELETE` = **destrutivo** e pode falhar por FK `on delete restrict` |

**O SQL completo de rollback está documentado e pronto**, mas **não foi executado** (proibido).

---

## 8. PIX-002.8 — Diagnóstico do Supabase remoto

### 8.1 Projeto e autenticação

| Item | Valor |
|---|---|
Projeto configurado (`supabase/config.toml`) | `project_id = "gpro-alfa-racing-brasil"` |
Projeto vinculado (`supabase/.temp/project-ref`) | `cycqigdywekfwwaspsus` |
Projeto do app (`.env.local`) | `cycqigdywekfwwaspsus` |
**Coincidem?** | ✅ **Sim** — o CLI aponta para o projeto correto |
Organização | `oruvptvlozdatobanzoj` ("Projeto Alfa Web") |
CLI | Supabase CLI **2.109.1** |

### 8.2 🔴 Causa do HTTP 403

```
$ supabase migration list --linked
Initialising login role...
unexpected login role status 403: {"message":"Your account does not have the necessary
privileges to access this endpoint. For more details, refer to our documentation
https://supabase.com/docs/guides/platform/access-control"}
```

**Diagnóstico:**

1. O comando **não** falha por projeto errado — o ref está correto (§8.1).
2. Falha no passo `Initialising login role`, que consulta o endpoint de **roles do banco** na Management API.
3. **Não há token de acesso da CLI**: `$env:SUPABASE_ACCESS_TOKEN` **não definida** e **nenhum** arquivo de credencial `sbp_*` em `~/.supabase` (que contém apenas `traces/` e `telemetry.json`).
4. **Causa provável:** a CLI envia requisição sem credencial válida (ou com credencial expirada/sem escopo), e a Management API responde **403** em vez de **401**. A mensagem é o texto genérico de controle de acesso da plataforma.

**Conclusão:** o bloqueio é de **autenticação/autorização da CLI**, não de configuração do projeto, não de rede, e não de permissão do banco. **Não é possível resolver pelo agente** — exigiria um Personal Access Token que só o titular da conta pode emitir.

### 8.3 Permissões efetivamente disponíveis

| Capacidade | Disponível? |
|---|---|
Leitura do banco remoto via `service_role` (PostgREST) | ✅ **Sim** — usada para as provas de §5.2 e §8.4 |
Escrita em dados via `service_role` | ⚠️ Tecnicamente sim, **deliberadamente não usada** |
`supabase migration list/db push` (Management API) | ❌ **Não** — 403 |
Catálogo do Postgres (`pg_policies`, `pg_indexes`, `information_schema`) | ❌ **Não** — não exposto pelo PostgREST (`PGRST205`) |
Senha do banco / conexão direta `psql` | ❌ **Não** |

### 8.4 Estado do remoto (verificado por leitura)

| Tabela | Linhas |
|---|---|
`payment_events` | **1** (o artefato de teste, intacto) |
`premium_plans` | **0** |
`premium_orders` | **0** |
`premium_payments` | **0** |
`access_grants` | **0** |
`access_events` | **0** |

**Migrations:** `20250919000001`–`000003` **não aplicadas**. Confirmado por evidência direta: as colunas reais de `payment_events` são

```
id, order_id, payment_id, provider, event_type, event_id,
payload_hash, payload_json, received_at, processed_at,
processing_status, error_message
```

— **sem** `provider_status`, `attempt_count` e `last_error_at`, que a `20250919000001` adicionaria.

**Nenhuma alteração remota foi feita nesta sprint.** Nenhum `INSERT`/`UPDATE`/`DELETE`/DDL.

### 8.5 ⚠️ Contradição documental identificada

Há relatórios anteriores que afirmam **ausência remota** das 4 tabelas premium (`PGRST205`) enquanto o próprio relatório da PIX-001.2 mede `payment_events` **existindo**. A conclusão factual que importa: **as tabelas premium existem no remoto sem lastro de migration** (foram criadas fora do repositório), e por isso **os objetos secundários** das migrations `20250917000005`–`000008` (índice único de `code`, `uniq_payment_events_event_id`, policies de RLS, triggers) são de **existência não verificada**. É exatamente isso que fundamenta P-01 e §7.3.

**Ação recomendada para a retomada:** obter o token da CLI, rodar `supabase migration list --linked` e conciliar o histórico real antes de qualquer `db push`.

---

## 9. Pendências e riscos declarados

### 9.1 Lacuna de verificação (não resolvida)

**403 para usuário autenticado sem papel admin** não foi provado — exige sessão real de usuário não-admin, que a sprint não fornece (e criar usuários no remoto está fora do escopo). A proteção existe e é dupla: `requireAdmin` lança `err.status = 403`, e todas as 12 rotas o chamam antes de qualquer operação.

### 9.2 Ressalva do logger

O `sanitizeMeta` bloqueia por **nome exato**, não recursivo. `code` é bloqueado; `planCode`/`orderId` não seriam. Sem vazamento atual, mas a lista merece revisão quando o fluxo de pagamento real for escrito.

### 9.3 Dívida técnica registrada

- **41 ocorrências de `any`** no módulo de pagamentos (§3.7) — viola AGENTS.md, não corrigido por escopo.
- **Rótulos "PIX-001.3"/"PIX-001.4"** em comentários de 2 arquivos (§3.8).
- **`MERCADOPAGO_ENV`** é declarada mas nenhum código a lê — inerte.
- `MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE` foi removida do fluxo; a constante segue exportada apenas por compatibilidade de teste.

### 9.4 Riscos que dependem de estado remoto não verificável

- Existência de `uniq_premium_plans_code` (P-01) e de `uniq_payment_events_event_id` (§7.3) no remoto.
- Colunas reais de `premium_plans`/`premium_orders`/`premium_payments` — conferidas **apenas** contra as migrations locais, não contra o banco.
- Imutabilidade do predicado parcial de índice — avaliada por documentação do PostgreSQL, não por consulta a `pg_proc`.

---

## 10. PIX-002.7 — Validação local

| Comando | Resultado |
|---|---|
`npx tsc --noEmit` | ✅ **exit 0** |
`npm run build` | ✅ **exit 0** — `/api/admin/plans`, `/api/payments/webhooks/mercadopago` e `/planos` presentes como rotas dinâmicas `ƒ` |
`git diff --check` | ✅ **exit 0** — nenhum erro de whitespace |
Suíte completa | ✅ **42 suítes, 986 PASS, 0 falhas novas** |

### 10.1 Testes criados nesta sprint

| Arquivo | PASS | FAIL | PENDING |
|---|---|---|---|
`tests/pix-002-security.test.js` | **68** | 0 | 2 |
`tests/pix-002-plans.test.js` | **59** | 0 | 3 |
**Subtotal novo** | **127** | **0** | 5 |

### 10.2 Suítes com exit ≠ 0 (pré-existentes, sem relação com PIX)

| Suíte | PASS | FAIL | Situação |
|---|---|---|---|
`alfa-002.test.js` | 6 | 1 | pré-existente |
`alfa-003-regression.test.js` | 22 | 1 | pré-existente |
`sponsors-library-0095.test.js` | 0 | — | pré-existente |

Nenhuma delas toca código Pix. **Comparação com o baseline anterior:** 40 suítes / 859 PASS → **42 suítes / 986 PASS** (+2 suítes, +127 testes). As 3 falhas são as mesmas de antes.

### 10.3 Correções feitas nos próprios testes

4 asserções falharam na primeira execução e **as 4 eram defeitos dos meus testes**, não do código:

| Asserção | Defeito | Correção |
|---|---|---|
`if (!secret)` / `if (!template)` | O código real usa `const secret = params.secret ?? null` seguido de `if (!secret)` — a regex `if \(!secret\)` deveria casar, mas o `?? null` na atribuição não interfere; o padrão correto é a linha `return { status: 'not_verified', reason: 'no_secret' }` | Reescrita para casar a instrução completa |
`webhook não hardcoda segredo` | Regex com lookahead negativo casava `secret: process.env[...]` | Reescrita: proíbe literais e **exige** que venha de `process.env` |
`checkout envia apenas o código` | Checava o arquivo inteiro e falhava por textos de UI que mencionam "preço" legitimamente | Passou a inspecionar **apenas o corpo** de `JSON.stringify(...)` |
`log nunca recebe valor` | Janela de 300 caracteres alcançava o código de validação anterior | Passou a extrair o **bloco `meta`** do log |

---

## 11. Arquivos desta sprint

| Arquivo | Ação |
|---|---|
`tests/pix-002-security.test.js` | **criado** (68 asserções) |
`tests/pix-002-plans.test.js` | **criado** (59 asserções) |
`docs/payments/PIX-002-RELATORIO-HOMOLOGACAO.md` | **criado** (este relatório) |

**Alterações de código nesta sprint:** nenhuma nova. O ajuste de enforcement em `app/api/payments/webhooks/mercadopago/route.ts` foi autorizado e executado no fechamento da PIX-001.2 (§5 confirma que passou a integrar o comportamento auditado).

**Nenhum** commit, push, deploy, rebuild de APK, aplicação de migration, chamada ao Mercado Pago, confirmação de pagamento, concessão de VIP, ou remoção de registro.

---

## 12. Recomendação para a retomada

**A PIX-002 pode ser encerrada.** O que falta é **operacional e externo ao código**, em ordem de prioridade:

1. **Credencial de teste `TEST-`** — sem ela, nada de homologação acontece (bloqueio herdado da PIX-001.2).
2. **`MERCADOPAGO_WEBHOOK_SECRET` + `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE`** — sem eles, os cenários de duplicidade/fora de escopo são inalcançáveis por HTTP, e o enforcement não pode ser validado com assinatura real.
3. **Token da Supabase CLI** — para conciliar o histórico de migrations e verificar P-01/§7.3 antes de qualquer `db push`.
4. **Decisão comercial** sobre o seed (`is_active = true` + preços demonstrativos) — P-07.
5. **Correções de migration antes do push** — no mínimo P-04 (`notify pgrst`) e a guarda de P-01; idealmente P-02 (`raise exception`).

**Não avançar para PIX-003.** Nenhuma migration deve ser aplicada, nenhum webhook configurado no painel e `PIX_ENABLED` deve permanecer `false` até que os itens 1–5 estejam resolvidos.

---

## 12. Anexo — investigação de exposição de segredo

### 12.1 A string `APP_USR-` aparece em `.next/dev` (esclarecido, sem vazamento)

Durante a verificação final foi detectada a string literal `APP_USR-` em **12 arquivos** do cache de desenvolvimento do Turbopack. Investigação concluída:

| Verificação | Resultado |
|---|---|
| Origem da string | **`tests/pix-002-plans.test.js:75`** — asserção que *proíbe* o checkout de carregar token: `assert(!/ACCESS_TOKEN|APP_USR-/.test(btnCode), …)` |
| Natureza | **Padrão de regex no código-fonte de um teste** — não é credencial |
| Bundle de **produção** (`.next/static`) | **0 ocorrências** |
| Bundle de servidor (`.next/server`) | **0 ocorrências** |
| Cache de desenvolvimento (`.next/dev`) | 12 ocorrências (o mesmo regex, replicado por módulo em cache) |
| **Token real (valor integral)** em `.next` | **0** |
| **Token real** em `app/` ou `docs/` | **0** |
| **15 dígitos do 2º segmento do token** em `.next` | **0** |
| `.next` no `.gitignore` | ✅ sim |
| `.next` versionado no git | **0 arquivos** |

**Conclusão: não houve vazamento.** O único conteúdo encontrado é o texto de um teste que existe justamente para *impedir* que a credencial chegue ao cliente.

**Correção de uma medição minha:** numa verificação anterior eu registrei "0 arquivos em `.next` contendo `APP_USR-`". Essa medição estava **incompleta** — ela não cobria o cache de desenvolvimento (`.next/dev`), que é populado pelo servidor de dev e continha, naquele momento, o código de teste ainda não criado. A conclusão (nenhum segredo exposto) permanece válida e agora está demonstrada com a separação entre artefato de produção (0) e cache de dev (12, inócuo).

**Ação preventiva sugerida (não executada):** se incomodar ter a string em cache de dev, trocar a asserção por construção dinâmica do padrão (`new RegExp('APP_' + 'USR-')`) evita a literal. Não é necessário para segurança — o cache de dev é descartável e não vai a produção nem ao repositório.

### 12.2 Confinamento do segredo — verificação consolidada

| Superfície | Token real presente? |
|---|---|
`.env.local` | sim (por definição) — protegido por `.gitignore` (`env files` → `.env*`) |
Bundle de produção (`.next/static`, `.next/server`) | **não** |
Cache de dev (`.next/dev`) | **não** (só o regex do teste) |
Código em `app/` | **não** |
Documentação em `docs/` | **não** |
Histórico do git (`git log --all -S`) | **não** |
Respostas HTTP das rotas | **não** |
Logs (`accessLogger`) | **não** |
