# ALFA-014.3 — Orders GET + Pix TXID de teste idempotente

> **Sprint:** ALFA-014.3 — Consulta segura de pedido (`GET /api/payments/orders/:id`) + `pix_txid` de teste determinístico
> **Data:** 2026-09-17 | **Branch:** `main` | **Projeto:** `C:\Users\joelg\Documents\gpro-alfa-racing-brasil`
> **Flag:** `VIP_CHECK=false` (inalterada) — `requireVip` **não** ativo
> **Status:** **Aprovada**
> **Escopo:** correção dos defeitos comprovados. Nenhuma migration, nenhum gateway, nenhum Pix real, nenhum grant.

---

## 1. Objetivo

Tornar `GET /api/payments/orders/:id` estritamente somente leitura, com autenticação por sessão,
validação de UUID, isolamento total por `user_id`, DTO por allow-list positiva, pagamento de teste
filtrado por `order_id` + dono do pedido + `provider='test'` (sem status terminais) e `pix_txid`
de teste determinístico, persistido e idempotente com fonte única de verdade.

## 2. Estado encontrado antes da alteração

### 2.1 Arquivos e medições

| Item | Estado antes |
|---|---|
| `app/api/payments/orders/[id]/route.ts` | 69 linhas — GET funcional, 401/400/404/405 já existentes |
| `app/lib/payments/orderService.ts` | 230 linhas |
| `app/lib/payments/paymentService.ts` | 109 linhas |
| `app/lib/payments/types.ts` | 120 linhas |
| `app/lib/payments/orderService.ts.new` | presente, conteúdo `// temp` (órfão) |
| `docs/ALFA-014.3-ORDERS-GET-PIX-TXID.md` | não existia |
| `npx tsc --noEmit` | exit **0** (baseline) |
| Node | v22.21.0, `--experimental-strip-types` funcional |
| `import('app/lib/payments/paymentService.ts')` em Node puro | `ERR_MODULE_NOT_FOUND: server-only` |

### 2.2 Cadeia de execução do GET antes

```
GET /api/payments/orders/:id
  → auth.getUser()                                  401 se !user
  → isValidUUID(id)                                 400
  → getOrderDetailsForUser(id, userId)
       ├─ getOrderForUser(orderId, userId)   ✅ isolamento real (.eq('id').eq('user_id'))
       ├─ premium_plans.select('code')       ✅
       └─ createTestPaymentForOrder(orderId) ⚠️ ESCRITA DURANTE O GET, sem userId
            └─ catch → premium_payments.select(...).eq('order_id', orderId) ⚠️ SEM DONO
```

## 3. Defeitos confirmados e corrigidos

| # | Defeito confirmado | Evidência antes | Correção aplicada |
|---|---|---|---|
| D1 | GET executava **escrita** | `orderService.ts:217` chamava `createTestPaymentForOrder` no caminho de leitura | `getOrderDetailsForUser` virou 100% leitura; nenhuma escrita no caminho do GET |
| D2 | `userId` não era usado em query própria da função de detalhes | `orderService.ts:203-225` dependia só de `getOrderForUser` | `userId` obrigatório, validação `if (!orderId \|\| !userId) return null`, filtro `eq('user_id', userId)` explícito |
| D3 | Fallback consultava pagamento **só por `order_id`** (IDOR latente) | `orderService.ts:220` `.eq('order_id', orderId)` sem dono | bloco `try/catch` removido integralmente; não existe mais leitura sem escopo |
| D4 | Leitura de pagamento sem `provider`, sem dono e sem filtro de status | `paymentService.ts:74-79`, `orderService.ts:220` | filtro simultâneo `order_id` + `provider='test'` + `premium_orders!inner(user_id)` + `neq` de terminais |
| D5 | `pix_txid` com **duas fontes** com assinaturas diferentes | `orderService.ts:227` (`createTestPixTxidForOrder`) vs `paymentService.ts:10` | `createTestPixTxidForOrder` removida; fonte única em `paymentService.createTestPixTxid` |
| D6 | Reuso não escopado / não comprovadamente idempotente | `createTestPaymentForOrder` sem `provider` e sem dono | reuso escopado + `pix_txid` persistido + tratamento `23505` |
| D7 | Status terminais exibíveis como pagamento ativo | nenhum filtro de status | `neq('status','failed'\|'refunded'\|'chargeback')` + guarda defensiva em memória |
| D8 | Testes apenas **estáticos** (não distinguiam o código vulnerável do corrigido) | os 4 `alfa-0143-*.test.js` só usavam `read().includes()` | harness comportamental que executa o código real (ver §9) |
| D9 | Arquivo órfão | `app/lib/payments/orderService.ts.new` | **excluído** |

### 3.1 Divergências entre a auditoria preliminar e o código real (registradas)

1. **Asserção de isolamento não falhava antes.** A hipótese registrada no plano de que
   `tests/alfa-0143-isolation.test.js:14` (`premium_orders!inner`) falharia no código antigo estava
   **incorreta**: a asserção lê `paymentService.ts`, que **já** continha `premium_orders!inner` no
   `getPaymentForUser`. Comportamento real do código antigo: a suíte de isolamento passava por
   coincidência textual, **sem** que o caminho do GET tivesse escopo de dono. O defeito real (D3/D4)
   era outro e está corrigido.
2. **Asserção de `access_grants` passava por ausência do token.** A suíte antiga de pix_txid
   rejeitava `paySvc.includes('access_grants')`, o que o código antigo satisfazia apenas por não
   conter a string. Agora `paymentService.ts` **de fato** consulta e grava somente `premium_payments`
   (comprovado por observação das escritas reais no harness).
3. **Nenhuma migration é necessária.** O `check` de `premium_payments.status` já aceita `'created'`
   (`20250917000007:9`) e `uniq_premium_payments_pix_txid` já existe (`:25`). Portanto não foi criada
   e não é necessária migration nesta sprint — confirmando a restrição do escopo.

## 4. Arquivos alterados, excluídos e criados

| Arquivo | Ação | Antes → Depois |
|---|---|---|
| `app/lib/payments/types.ts` | alterado (aditivo) | 120 → 171 linhas |
| `app/lib/payments/paymentService.ts` | alterado | 109 → 179 linhas |
| `app/lib/payments/orderService.ts` | alterado | 230 → 283 linhas |
| `app/api/payments/orders/[id]/route.ts` | alterado | 69 → 63 linhas |
| `app/api/payments/orders/route.ts` | alterado (1 linha) | 95 → 95 linhas |
| `app/lib/payments/orderService.ts.new` | **excluído** | órfão `// temp` |
| `tests/alfa-0143-orders-get.test.js` | alterado | 21 → 133 linhas |
| `tests/alfa-0143-pix-txid.test.js` | alterado | 20 → 131 linhas |
| `tests/alfa-0143-isolation.test.js` | alterado | 19 → 136 linhas |
| `tests/alfa-0143-security.test.js` | alterado | 20 → 122 linhas |
| `tests/_alfa0143-harness.cjs` | **criado** | harness de teste (191 linhas, stubs em memória) |
| `docs/ALFA-014.3-ORDERS-GET-PIX-TXID.md` | **criado** | este relatório |
| `*.alfaprev` (5 arquivos) | **criados** (artefatos de rollback E1) | cópias pré-alteração |

### 4.1 Alteração mínima no POST da ALFA-014.2 (necessária e comprovada)

Alteração **única**, exigida pela assinatura nova de `createTestPaymentForOrder(orderId, userId)`:

```diff
-  payment = await createTestPaymentForOrder(result.order.id)
+  payment = await createTestPaymentForOrder(result.order.id, userId)
```

**Comprovação de necessidade:** `npx tsc --noEmit` falhou com `error TS2554: Expected 2 arguments,
but got 1` em `app/api/payments/orders/route.ts(59,23)` e `app/lib/payments/orderService.ts(217,21)`
— os dois únicos call sites. Nada mais no POST foi tocado: `planCode`, `Idempotency-Key`,
preço do banco, `201/200/409/404` e o `try/catch` que não bloqueia o pedido permanecem idênticos
(confirmado por diff contra o backup E1: **1 linha** diferente).

## 5. Comportamento final do GET

```
GET /api/payments/orders/:id
```

| Caso | Resposta |
|---|---|
| Sem sessão | **401** `{ success:false, error:'Não autenticado' }` |
| UUID inválido | **400** `{ success:false, error:'ID inválido' }` |
| Pedido inexistente | **404** `{ success:false, error:'Pedido não encontrado' }` |
| Pedido de terceiro | **404** com corpo **byte a byte idêntico** ao anterior |
| Pedido próprio com pagamento | **200** `{ order, payment }` |
| Pedido próprio sem pagamento | **200** `{ order, payment: null }` |
| `POST`/`PUT`/`PATCH`/`DELETE` | **405** |
| `?userId=`, `?status=`, `?pixTxid=`, body | **ignorados** — `request` nunca é lido |
| Erro interno | **500** `{ success:false, error:'Erro interno' }` (sem detalhe de banco) |

- **Nenhuma escrita** em qualquer caminho: o handler não contém `.insert(`, `.update(`, `.delete(`,
  nem chama `createTestPaymentForOrder`/`ensureTestPaymentForOrder`.
- DTO montado por **allow-list positiva**:
  - `order` = `{ id, planCode, status, amountCents, currency, expiresAt, paidAt, createdAt, updatedAt }`
  - `payment` = `{ id, provider, status, pixTxid, amountCents, currency } | null`

## 6. Regras de isolamento

- `userId` vem **exclusivamente** de `supabase.auth.getUser()` (`user.id`). Nunca de body, query ou header.
- `getOrderDetailsForUser(orderId, userId)` recusa escopo incompleto (`if (!orderId || !userId) return null`).
- Pedido: `premium_orders.eq('id', orderId).eq('user_id', userId)`.
- Pagamento: `.eq('order_id', orderId).eq('provider','test').eq('premium_orders.user_id', userId)`
  + `.neq('status','failed'|'refunded'|'chargeback')`, último registro por `created_at desc`, `.limit(1)`, `.maybeSingle()`.
- `planCode` vem de `premium_plans` do `plan_id` **do pedido autorizado** — nunca do frontend.
- Guardas defensivas em memória: pagamento com dono divergente ou status terminal é descartado mesmo se a query retornar linha.
- Criação de pagamento de teste exige `userId` obrigatório e valida a posse **antes** de qualquer leitura de `premium_payments`; pedido de terceiro ⇒ `404 'Pedido não encontrado'` sem criar linha.

## 7. Campos omitidos por segurança

Nunca presentes na resposta: `user_id`, `plan_id`, `payload_hash`, `payload_json`, `order_id`,
dados do join (`premium_orders`), `service_role`, chaves/tokens, dados bancários, QR Code,
eventos de pagamento e payloads de webhook. Comprovado por serialização real do DTO (§9.4).

## 8. Estratégia de idempotência do `pix_txid`

- **Fonte única:** `paymentService.createTestPixTxid(orderId, userId?, payloadHash?)`
  → `sha256("TEST-ALFA-0141|<orderId>|<userId>|<payloadHash>")` → `.slice(0,12).toUpperCase()`
  → formato `TEST-ALFA-0141-<12 hex>`. O hash interno nunca é exposto nem logado.
- **Persistido:** gravado em `premium_payments.pix_txid` no insert — a resposta **lê** o valor persistido, não recalcula.
- **Reuso determinístico:** segunda chamada devolve a mesma linha e o mesmo `pix_txid`; nada é regravado (comprovado: 3 chamadas ⇒ 1 linha).
- **Sem duplicidade:** unicidade pela `uniq_premium_payments_pix_txid` (migration existente) + reuso escopado + tratamento de `23505` com releitura.
- **Nunca vem do frontend:** o handler não lê body/query e nem menciona `pixTxid` em código.
- **Sem gateway/Pix real:** nenhum cliente HTTP nos serviços; nenhuma chamada externa.
- **Máquina de estados preservada:** pagamento permanece `provider='test'` / `status='created'`; nenhuma transição é executada; `order.status` permanece `pending`; nenhum `paid`/`confirmed`/`refunded`/`chargeback` é gravado.

## 9. Testes executados — resultados reais

### 9.1 Harness comportamental (novo)

`tests/_alfa0143-harness.cjs` executa o **código real** de `paymentService.ts` / `orderService.ts` em
subprocesso (`node --experimental-strip-types`) com dois loaders ESM registrados via `module.register`
(data: URL), que redirecionam **apenas** `server-only` e o admin client para stubs em memória, e
resolvem o alias `@/`.

Isso foi necessário porque o módulo **não** carrega em Node puro
(`ERR_MODULE_NOT_FOUND: server-only` — o pacote existe apenas em `node_modules/next/dist/compiled`).
Nenhuma rede, nenhum Supabase real, nenhum gateway. Nenhum arquivo proibido foi alterado para isso
(`package.json` intocado).

### 9.2 Suites da sprint

| Suite | Resultado | Casos |
|---|---|---|
| `node tests/alfa-0143-orders-get.test.js` | **exit 0** | 29 PASS · 1 PENDING |
| `node tests/alfa-0143-pix-txid.test.js` | **exit 0** | 25 PASS |
| `node tests/alfa-0143-isolation.test.js` | **exit 0** | 18 PASS |
| `node tests/alfa-0143-security.test.js` | **exit 0** | 37 PASS |

Destaques comportamentais (execução real, não texto):
- `pix_txid` idêntico em chamadas repetidas e distinto para pedidos/usuários diferentes
  (`TEST-ALFA-0141-2DD6A96B30C4`); formato `^TEST-ALFA-0141-[0-9A-F]{12}$`; sem CPF/telefone/e-mail/token.
- 3 chamadas a `createTestPaymentForOrder`/`ensureTestPaymentForOrder` ⇒ **1 única linha**, mesmo `pix_txid`.
- Criar pagamento para pedido de terceiro ⇒ recusado com `404`, **nenhuma** linha criada.
- `getOrderDetailsForUser(orderB, userA)` ⇒ `null`; `getSafePaymentForOrder(orderB, userA)` ⇒ `null`;
  pagamento `failed`/`refunded` ⇒ `null`; **ZERO escritas** durante as consultas.
- Chaves do DTO observadas: `order` = `["amountCents","createdAt","currency","expiresAt","id","paidAt","planCode","status","updatedAt"]`,
  `payment` = `["amountCents","currency","id","pixTxid","provider","status"]`.
- Serialização real sem `user_id`, `plan_id`, `payload_hash`, `payload_json`, hashes internos ou segredos.

### 9.3 Regressão (sprints anteriores) — todas verdes

`alfa-0142-orders-api`, `alfa-0142-idempotency`, `alfa-0142-price-security`,
`alfa-0142-payment-preparation`, `alfa-014-orders`, `alfa-014-payments`, `alfa-014-idempotency`,
`alfa-014-security`, `alfa-014-premium-plans` → **exit 0** (9 de 9).

**Total: 13 de 13 suites com exit 0.**

### 9.4 Testes PENDENTES (nunca marcados como PASS)

| Caso | Motivo | Como executar |
|---|---|---|
| `GET` 401 sem sessão (HTTP real) | exige servidor Next em execução e sessão Supabase; o projeto não possui runner de integração (não foi criado um nesta sprint) | `npm run dev` + requisição com/sem cookie de sessão |
| `GET` 400 com UUID inválido (HTTP real) | idem | `GET /api/payments/orders/not-a-uuid` |
| `GET` 404 indistinguível (HTTP real, 2 usuários) | idem — exige usuário A e B reais para comparar corpos byte a byte | `GET` do pedido de B com token de A vs UUID inexistente |
| `GET` 405 nos 4 verbos (HTTP real) | idem | `POST/PUT/PATCH/DELETE` no mesmo path |

Observação: a estrutura desses casos (presença de `getUser`+401, `isValidUUID`+400, corpo único de
404, os 4 handlers 405) é verificada por asserção no handler; o **comportamento HTTP em si não foi
exercido** e por isso não é declarado PASS.

## 10. Validação técnica

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | **exit 0** (sem erros) |
| `npm run build` | **exit 0** — rotas `ƒ /api/payments/orders` e `ƒ /api/payments/orders/[id]` compiladas |
| `git diff --check` | **exit 0** (sem erros de whitespace) |
| `git status --short` | `M app/actions/signup.ts`, `M app/dashboard/layout.tsx` (sprints anteriores, mtime 17/09 12:31 e anteriores) + diretórios `??` de sprints anteriores; novos `?? tests/_alfa0143-harness.cjs`, `?? docs/` e os `*.alfaprev` desta sprint |
| `git diff --stat` | `2 files changed, 288 insertions(+), 26 deletions(-)` — **somente** arquivos de sprints anteriores; nenhum arquivo desta sprint está rastreado |

### 10.1 Confirmação de escopo (E11)

- Arquivos proibidos **não modificados**: `app/api/admin/**` (mtime 12:44), `app/lib/access/**` (mtime 11:30),
  `app/lib/supabase-admin.ts`, `utils/supabase/**`, `app/lib/auth.ts`, `middleware.ts` (mtime 14/09),
  `supabase/**` (migrations/seed de sprints anteriores), `capacitor.config.ts`, `android/**`, `package.json` (mtime 16/09) —
  todos com data anterior ao início da execução (17/09 13:1x).
- Tokens proibidos no `[id]/route.ts`: **nenhum** (`service_role`, `payload_json`, `payload_hash`,
  `access_grants`, `pix_txid`, `qr_code`, clientes HTTP ausentes do código).
- `payload_hash` permanece apenas em `orderService.ts`, por necessidade legítima da ALFA-014.2
  (coluna real do insert/busca idempotente) e **nunca** entra em SELECT de leitura pública nem em resposta.

## 11. Limitações

1. **GET somente leitura ⇒ pedido legado sem pagamento retorna `payment: null`.** A criação
   idempotente vive em `POST /api/payments/orders` e em `ensureTestPaymentForOrder(orderId, userId)`
   (porta canônica); nenhum backfill foi feito nesta sprint.
2. **Unicidade `(order_id, provider)` não existe no banco** e nenhuma migration foi criada (proibido).
   Mitigação em aplicação: reuso escopado + `maybeSingle()` + `23505` + `uniq_premium_payments_pix_txid`.
3. `types.ts` mantém a união legada de status (`PaymentStatus`) por compatibilidade com a ALFA-014.1/014.2.
4. `expires_at` não é interpretado pelo GET: o `status` persistido é devolvido como está (sem coluna nova).
5. Testes comportamentais dependem do harness de loader em Node 22; em runtime sem suporte, o caso sai
   como `PENDING` explícito, nunca PASS (não ocorreu neste ambiente).
6. Contrato HTTP real (401/400/404/405/200 com dois usuários) permanece manual/pendente (§9.4) e
   atualmente **bloqueado**: o schema remoto não existe (§14).

## 12. Pendências

1. **BLOQUEIO ATIVO:** aplicar as migrations `00005`–`00008` (local via Docker ou remoto autorizado) para
   habilitar a validação HTTP real (§14). Sem isso o endpoint responde 500 `PGRST205`.
2. Exercer manualmente os casos HTTP de §9.4 em ambiente com sessão (dois usuários) após o desbloqueio —
   e só então promovê-los de PENDING para PASS.
3. Decidir sobre a criação futura (autorizada) de índice único parcial em `premium_payments(order_id, provider)` — **proposta**, não criada.
4. Avaliar backfill opcional de pagamento de teste para pedidos legados via `ensureTestPaymentForOrder` (fora do escopo desta sprint).
5. Remover os artefatos `.alfaprev` após aceite formal da sprint (são cópias de rollback E1).

## 13. Confirmações obrigatórias

| Confirmação | Estado |
|---|---|
| Migration remota aplicada | **NÃO** — `supabase db push` / `db reset` **não executados** |
| `supabase migration list --linked` | **NÃO executado** (sem autorização) |
| Commit | **NÃO** |
| Push | **NÃO** |
| Deploy (`vercel deploy`) | **NÃO** |
| Rebuild do APK | **NÃO** |
| Pix real gerado | **NÃO** — nenhuma cobrança, nenhum txid real |
| Gateway chamado | **NÃO** — nenhum cliente HTTP nos serviços |
| Webhook público criado | **NÃO** |
| QR Code gerado | **NÃO** |
| Pagamento confirmado (`confirmed`/`paid`) | **NÃO** — permanece `created` |
| `access_grants` criado | **NÃO** |
| `VIP_CHECK` | **`false`** (inalterado, verificado em `app/lib/access/accessService.ts`) |
| `requireVip` | **desativado** (0 ocorrências nas rotas de pagamento) |

## 14. Tentativa de validação HTTP real — BLOQUEIO DIAGNOSTICADO (17/09 13:4x)

### 14.1 Sintoma relatado

Com sessão autenticada, `GET /api/payments/orders/11111111-1111-4111-8111-111111111111` (UUID inexistente)
retornou **HTTP 500** `{ success: false, error: 'Erro interno' }` — esperado **HTTP 404**
`{ success: false, error: 'Pedido não encontrado' }`.

### 14.2 Causa raiz COMPROVADA — infraestrutura, não lógica

```
PGRST205 — Could not find the table 'public.premium_orders' in the schema cache
```

Medição direta contra o PostgREST (`https://cycq***.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY`, **somente
SELECT**, executada de script temporário **fora do repositório**, já removido; nenhuma migration, nenhum
`db push`, nenhum `migration list --linked`):

| Sonda (SELECT only) | HTTP | Corpo |
|---|---|---|
| `premium_orders?select=id&limit=1` | 404 | `{"code":"PGRST205","message":"Could not find the table 'public.premium_orders' in the schema cache","hint":"Perhaps you meant the table 'public.invite_codes'"}` |
| `premium_orders?id=eq.1111…1111` | 404 | mesmo `PGRST205` |
| `premium_payments?select=id&limit=1` | 404 | `PGRST205` |
| `premium_plans?select=id,code&limit=1` | 404 | `PGRST205` |

**As tabelas `premium_plans`, `premium_orders` e `premium_payments` não existem no banco remoto.**
As migrations `20250917000005..000008` permanecem **locais apenas** — confirmando a hipótese H1 do §2.3,
que até aqui era hipótese e agora está provada.

Consequências:
1. O 500 **não** é defeito do fluxo ALFA-014.3: `getOrderForUser` recebe erro do PostgREST e o
   converte em exceção (`if (error) throw …`), corretamente classificado como falha interna.
2. **O POST da ALFA-014.2 nunca funcionou de ponta a ponta**: `createOrderFromPlanCode` consulta
   `premium_plans` e recebe o mesmo `PGRST205`, mascarado como `404 'Plano não encontrado'`.
3. Nenhum ajuste de código pode produzir 404 sem a tabela existir.

### 14.3 Arquivo e trecho responsável pelo mascaramento do diagnóstico

- Origem da exceção: `app/lib/payments/orderService.ts:65-74`
  (`getOrderForUser` → `if (error) throw new Error(error.message)`).
- Ponto de perda do código do erro: `app/api/payments/orders/[id]/route.ts` (bloco `catch`), que logava
  apenas `error.message?.slice(0, 80)` — descartando `code`/`name`, o que impediu o diagnóstico imediato.

### 14.4 Correção aplicada — Parte B (autorizada, ~11 linhas, somente o handler)

Em `app/api/payments/orders/[id]/route.ts`:

- novo helper `describeError(error: unknown)`: compõe `code|name|message`, remove JWT (`eyJ…`),
  redige `apikey|token|secret|password|authorization`, remove URL de conexão e trunca em 160 chars;
- `catch` passou de `error: any` para `error: unknown`;
- log passou a registrar o código explícito: `console.error('GET /api/payments/orders/[id] falhou', describeError(error))`;
- **resposta ao cliente inalterada** (`500 { success:false, error:'Erro interno' }`) — o diagnóstico
  **nunca** vaza para a resposta;
- **falha de infraestrutura não é mascarada como 404**: `PGRST205` continua 500, porque o 404
  indistinguível vale para pedido inexistente/de terceiro, não para schema ausente.

Nenhum serviço foi alterado. Nenhuma migration criada. Resposta, semântica de 401/400/404/405 e
contrato do POST permanecem idênticos.

### 14.5 Tentativa local (Docker/Supabase) — NÃO FOI POSSÍVEL

| Verificação | Resultado |
|---|---|
| `docker --version` | presente (29.6.1) |
| `docker info` | **falha**: daemon não responde (`npipe:////./pipe/dockerDesktopLinuxEngine` inexistente; Docker Desktop não está em execução) |
| `supabase --version` | 2.109.1 |
| `supabase status` | **falha**: `failed to inspect container health … dockerDesktopLinuxEngine` |
| `supabase/config.toml` | **ausente** (o projeto nunca teve stack local inicializada) |

Portanto `supabase db reset` **não foi executado** — o comando não tem stack para operar. Conforme
orientação recebida: **não foi contornado**, **nenhuma migration remota foi aplicada**, e a validação
local está registrada como impossível.

### 14.6 Estado da validação HTTP — BLOQUEADA (não PASS)

Os 4 casos de contrato HTTP **continuam PENDING** (§9.4) e **não** são declarados PASS:

| Caso | Estado | Motivo |
|---|---|---|
| 401 sem sessão | **BLOQUEADO/PENDING** | requer schema aplicado (qualquer request autenticado falha hoje em `PGRST205`) |
| 400 UUID inválido | **PENDING** | requer execução HTTP real; o caminho 400 é anterior ao banco, mas não foi exercido |
| 404 pedido inexistente / de terceiro | **BLOQUEADO** | reproduzido como **500** por `PGRST205`; exige migrations aplicadas |
| 405 nos 4 verbos | **PENDING** | requer execução HTTP real |

**Desbloqueio (uma das duas vias):**
1. Stack local: iniciar Docker Desktop e `supabase start` + `supabase db reset` (requer `supabase init`); **ou**
2. Remoto: aplicar as migrations pendentes — `supabase db push --linked` — **NÃO AUTORIZADO nesta etapa**.

### 14.7 Revalidação após a Parte B (executada)

| Comando | Resultado |
|---|---|
| `node tests/alfa-0143-orders-get.test.js` | **exit 0** — 34 PASS · 1 PENDING (5 asserções novas da instrumentação) |
| `node tests/alfa-0143-pix-txid.test.js` | **exit 0** — 25 PASS |
| `node tests/alfa-0143-isolation.test.js` | **exit 0** — 18 PASS |
| `node tests/alfa-0143-security.test.js` | **exit 0** — 37 PASS |
| Regressões ALFA-014.2 (4 suites) + ALFA-014 (5 suites) | **exit 0** — 9 de 9 verdes |
| `npx tsc --noEmit` | **exit 0** |
| `npm run build` | **exit 0** — `Compiled successfully in 17.6s` |
| `git diff --check` | **exit 0** |

**Total: 13 de 13 suites exit 0.** As asserções novas garantem que o `catch` não loga o objeto de erro
completo, que a resposta ao cliente permanece `Erro interno` e que o código do erro é registrado.

## 15. Validação HTTP real contra dev server local (17/09 ~13:5x) — PARCIAL, com bloqueio residual

### 15.1 Preparação local: **Docker indisponível** (bloqueio mantido)

| Verificação (regra 1 do escopo autorizado) | Resultado |
|---|---|
| Docker Desktop em execução | **NÃO** (processos `Docker Desktop` e `com.docker.backend` ausentes) |
| `docker info` | **falha** — `open //./pipe/dockerDesktopLinuxEngine: O sistema não pode encontrar o arquivo especificado` |
| Pipe do daemon `\\.\pipe\dockerDesktopLinuxEngine` | **ausente** |
| Docker Desktop instalado | sim (`C:\Program Files\Docker\Docker\Docker Desktop.exe`) |
| `supabase/config.toml` | **ausente** (projeto local nunca inicializado) |
| `supabase/.temp/` | presente (metadados de CLI: `linked-project.json`, `project-ref`, versões) |
| Migrations locais | 11 arquivos em `supabase/migrations`; `supabase/seed.sql` presente |

Conforme a regra 3: **parei**. `supabase init`, `supabase start` e `supabase db reset` **não foram
executados**; nenhuma migration remota foi aplicada; nenhuma limitação foi contornada.

### 15.2 Dev server já em execução — casos HTTP exercidos de verdade

Descoberto na inspeção: `npm run dev` **já estava rodando** (PID 1496, iniciado às 09:41, porta 3000,
`next/dist/server/lib/start-server.js`). Requisições reais executadas contra `http://127.0.0.1:3000`
(somente leitura; nenhuma sessão fornecida):

| # | Requisição | Resultado real observado | Esperado | Veredito |
|---|---|---|---|---|
| 1 | `GET /api/payments/orders/11111111-1111-4111-8111-111111111111` (sem cookie) | **401** `{"success":false,"error":"Não autenticado"}` | 401 | **PASS** |
| 2 | `GET /api/payments/orders/not-a-uuid` (sem cookie) | **401** `{"success":false,"error":"Não autenticado"}` | 401 (auth precede a validação) | **PASS** para o caminho exercido |
| 3 | `POST /api/payments/orders/<uuid>` | **405** `{"success":false,"error":"Método não permitido. Use GET."}` | 405 | **PASS** |
| 4 | `PUT /api/payments/orders/<uuid>` | **405** `{"success":false,"error":"Método não permitido."}` | 405 | **PASS** |
| 5 | `PATCH /api/payments/orders/<uuid>` | **405** `{"success":false,"error":"Método não permitido."}` | 405 | **PASS** |
| 6 | `DELETE /api/payments/orders/<uuid>` | **405** `{"success":false,"error":"Método não permitido."}` | 405 | **PASS** |
| 7 | `GET /api/payments/orders/<uuid>/extra` | **404** (página de not-found) | rota inexistente | sanity check OK |
| 8 | `POST /api/payments/orders` (rota pai) | **401** | 401 | consistente |
| 9 | `GET /api/payments/orders` (rota pai) | **405** `"Método não permitido. Use POST."` | 405 | consistente |

**Prova de roteamento (§item 3/4/5/6):** o corpo `"Método não permitido. Use GET."` só existe em
`app/api/payments/orders/[id]/route.ts` (o handler da rota pai responde `"Use POST."`). Portanto os 405
foram servidos pelo handler correto da ALFA-014.3, e não pela rota pai.

**Descoberta de ordem de verificação (documentada, não é defeito):** um UUID inválido **sem sessão**
retorna **401**, não 400 — a checagem de autenticação precede a validação de UUID, como manda o requisito
de segurança. O **400** só é alcançável **com sessão autenticada**, o que exige cookie de sessão Supabase
real (não automatizável nesta sessão sem credenciais de teste).

### 15.3 Casos NÃO exercidos (permanecem PENDING/BLOQUEADO — não declarados PASS)

| Caso | Estado | Motivo |
|---|---|---|
| **400** UUID inválido (com sessão) | **PENDING** | requer cookie de sessão autenticada; caminho verificado estruturalmente (`isValidUUID` + `400`), não exercido |
| **404** pedido inexistente (com sessão) | **BLOQUEADO** | exige schema aplicado; hoje qualquer request autenticado cai em `PGRST205` → 500 (§14) |
| **404** indistinguível para pedido de terceiro | **BLOQUEADO** | idem, e requer dois usuários reais |
| **200** pedido próprio com pagamento | **BLOQUEADO** | idem |
| **200** pedido próprio sem pagamento (`payment: null`) | **BLOQUEADO** | idem |

**Desbloqueio (uma das vias, conforme autorização):**
1. **Local:** iniciar o Docker Desktop → `supabase init` → `supabase start` → `supabase db reset` → criar
   duas contas de teste → exercer 400/404/200 e comparar os corpos de 404 (inexistente vs terceiro);
2. **Remoto:** `supabase db push --linked` — **NÃO AUTORIZADO**; não executado.

### 15.4 Estado de código inalterado nesta etapa

Nenhum arquivo do escopo foi modificado nesta etapa de preparação (apenas verificação e requisições
HTTP de leitura). `tsc`, `build`, `git diff --check` e as 13 suites permanecem como no §14.7.

## 16. Status final

**APROVADA NO ESCOPO DE CÓDIGO — VALIDAÇÃO HTTP PARCIAL (3 de 4 famílias exercidas com sucesso),
bloqueio residual por infraestrutura: Docker daemon ausente + schema remoto inexistente.**

- 13 de 13 suites com exit 0; `tsc` exit 0; `build` exit 0; `git diff --check` exit 0.
- Diff restrito ao escopo autorizado; nenhum arquivo proibido alterado.
- Causa raiz do 500 **provada**: `PGRST205` — `premium_plans`/`premium_orders`/`premium_payments`
  inexistentes no remoto (migrations 00005–00008 locais).
- Correção de diagnóstico (Parte B) aplicada e revalidada.
- **HTTP real exercido com sucesso (§15.2):** 401 sem sessão **PASS**; 405 nos 4 verbos **PASS**
  (corpo prova que o handler `app/api/payments/orders/[id]/route.ts` respondeu); roteamento
  sanity-check **OK**.
- **Ainda PENDING/BLOQUEADO:** 400 com sessão, 404 pedido inexistente, 404 de terceiro,
  200 com/sem pagamento — exigem schema aplicado e/ou cookie de sessão autenticada.
- Preparação local **não executada** por regra: Docker daemon indisponível → `supabase init`,
  `supabase start` e `supabase db reset` **não rodados**; nenhuma migration remota aplicada.
- Nenhum commit/push/deploy, nenhum rebuild de APK, nenhum Pix real/gateway/webhook/QR,
  nenhuma confirmação de pagamento, nenhum `access_grants`, `VIP_CHECK=false`, `requireVip` desativado.
