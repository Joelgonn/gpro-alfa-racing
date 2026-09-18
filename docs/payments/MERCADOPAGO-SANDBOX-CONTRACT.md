# MERCADOPAGO — CONTRATO SANDBOX (captura controlada)

**Sprint:** PIX-001.2 — Captura controlada do contrato Mercado Pago Sandbox
**Data:** 2025-09-19
**Estado:** 🛑 **ETAPA 1 FALHOU — CAPTURA NÃO EXECUTADA (BLOQUEIO DE CREDENCIAL)**
**Nenhuma chamada à API do Mercado Pago foi realizada.**

> 📄 **Relatório completo do bloqueio, do incidente e do plano de desbloqueio:**
> `docs/payments/PIX-001.2-RELATORIO-BLOQUEIO.md`
> Este documento registra o **estado do contrato**; o relatório registra o **processo e a decisão**.

---

## 0. Regra de parada da sprint

A sprint PIX-001.2 determina, na Etapa 1:

> auditar/validar credenciais **e validar que é um token de teste antes de qualquer chamada**

A validação **falhou**. Conforme a própria regra, o processo **foi interrompido na Etapa 1**, antes de qualquer requisição HTTP ao Mercado Pago. As Etapas 2, 3 e 4 **não foram executadas**.

Este documento registra o que **foi** auditado (evidência verificável) e o que **permanece desconhecido** por falta de credencial válida.

---

## 1. Inventário de variáveis de ambiente (PIX-001.2 Etapa 1)

Fonte: `.env.local`. Valores **nunca** impressos; apenas nome, presença, comprimento e prefixo.

| Variável | Situação | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | presente | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | presente | — |
| `SUPABASE_SERVICE_ROLE_KEY` | presente | server-only |
| `ADMIN_EMAILS` | presente | — |
| `GPRO_TOKEN` | presente | — |
| `MERCADOPAGO_ACCESS_TOKEN` | **presente** | ver §2 |
| `MERCADOPAGO_ENV` | presente = `sandbox` | ⚠️ **0 consumidores no código** |
| `PIX_ENABLED` | presente = **`false`** | ✅ inalterado, como exigido |
| `MERCADOPAGO_PUBLIC_KEY` | **AUSENTE** | não é necessária (Checkout Transparente via API de Orders, sem SDK no browser) |
| `MERCADOPAGO_WEBHOOK_SECRET` | **AUSENTE** | bloqueia Etapa 3 |
| `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` | **AUSENTE** | bloqueia Etapa 3 |
| `MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE` | **AUSENTE** | default = `false` (observe-only) |
| `PIX_ENV` | AUSENTE | nome alternativo não utilizado pelo projeto |

### 1.1 Confinamento de segredo (verificado)

| Verificação | Resultado |
|---|---|
| Prefixo `NEXT_PUBLIC_MERCADOPAGO*` | **0 ocorrências** → o token **não** entra no bundle do cliente |
| Token em artefatos `.next/` (busca por `APP_USR-`) | **0 arquivos** |
| `.env.local` versionado no git | **0** (`git ls-files`) |
| `.gitignore` cobre env | `env files` → `.env*` ✅ |
| Ocorrências de `MERCADOPAGO_ACCESS_TOKEN` no código | **1**, e é uma *asserção de teste* que proíbe seu uso no webhook: `tests/pix-0011-webhook.test.js:219` |
| Histórico do git expõe o token | **0** (`git log --all -S`) |

**Conclusão 1.1:** o segredo está corretamente confinado ao servidor e fora do versionamento.

---

## 2. 🛑 Classificação da credencial — MOTIVO DO BLOQUEIO

Auditoria do valor **sem exibi-lo** (apenas prefixo, comprimento e forma):

| Propriedade observada | Valor |
|---|---|
| Prefixo | **`APP_USR-`** |
| Prefixo `TEST-` (credencial de teste) | **`False`** |
| Comprimento | 74 |
| Forma | 5 segmentos separados por `-` |
| 2º segmento é numérico de 15 dígitos | `True` |

### 2.1 Por que isso bloqueia

O Mercado Pago emite duas famílias distintas de Access Token:

| Família | Prefixo | Natureza |
|---|---|---|
| Credencial de **teste** | `TEST-` | opera exclusivamente contra o sandbox; não movimenta dinheiro real |
| Credencial de **produção** | `APP_USR-` | opera contra a conta real; **gera cobrança real** |

O token configurado é `APP_USR-…`, portanto **credencial de produção**. O requisito explícito da sprint era *"captura de um pagamento de teste de baixo valor"* com validação prévia de que o token é de teste. Os dois não coincidem.

**Decisão:** não executar a Etapa 2. Uma chamada de criação de cobrança com credencial `APP_USR-` não é um "teste de baixo valor" — é uma **cobrança real contra a conta de produção do projeto**, exatamente o que as instruções permanentes proíbem (`PIX_ENABLED` deve permanecer `false`; nenhum pagamento real; nenhum VIP automático).

### 2.2 O que *não* foi feito (por disciplina)

| Ação | Situação |
|---|---|
| Requisição a `api.mercadopago.com` (qualquer método) | **não realizada** |
| Criação de cobrança / order / payment | **não realizada** |
| Consulta de conta, merchant, aplicação ou usuário de teste | **não realizada** |
| Impressão, gravação ou transmissão do token | **não realizada** |
| Registro do webhook no painel Mercado Pago | **não realizada** |
| Alteração de `PIX_ENABLED` | **não realizada** (permanece `false`) |

> Nota de honestidade técnica: uma leitura `GET` autenticada (ex.: consulta da própria conta) também **não** foi feita. O prefixo `APP_USR-` já determina a classificação de produção, e a sprint exige parada — não havia necessidade de tocar o endpoint para concluir a Etapa 1.

### 2.3 Ambiguidade residual (declarada, não resolvida por invenção)

Existe um recurso do Mercado Pago chamado *usuário de teste*, em que credenciais de conta de teste podem assumir formatos que **não** começam com `TEST-`. Não é possível — a partir do prefixo isolado — distinguir com certeza absoluta entre:

- (a) uma credencial de **produção** da conta real; e
- (b) uma credencial de **conta de teste** (test user) cujo prefixo não seja `TEST-`.

**Esta ambiguidade não foi resolvida por suposição.** Ela é a razão de a decisão estar registrada como bloqueio e de exigir confirmação humana (§5), e não por um teste empírico que criaria dinheiro real caso a hipótese (a) fosse verdadeira. Um teste custaria uma cobrança real se estivéssemos errados.

*(O valor numérico do 2º segmento do token foi deliberadamente omitido deste documento.)*

---

## 3. Verificação de postura de segurança (independente do bloqueio)

Estas verificações **foram** realizáveis e o resultado é relevante para o contrato.

| Verificação | Resultado |
|---|---|
| `PIX_ENABLED` | `false` ✅ |
| Cliente HTTP para `api.mercadopago.com` no repositório | **0 ocorrências** → nenhum adaptador definitivo foi escrito (correto: aguarda este contrato) |
| Arquivos em `app/lib/payments/` | `mercadopago-signature.ts`, `orderService.ts`, `paymentService.ts`, `paymentStateMachine.ts`, `types.ts`, `webhook-service.ts` |
| Rota de webhook | `POST /api/payments/webhooks/mercadopago` responde localmente |

### 3.1 🌐 Observação real obtida do webhook (PIX-001.1, rodada agora)

Servidor de desenvolvimento ativo em `127.0.0.1:3000`. Requisição executada:

```
POST /api/payments/webhooks/mercadopago
Content-Type: application/json
Body: {}

→ HTTP 200
{"received":true,"outcome":"unknown_event","stored":true}
```

**Achado:** com `MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE` ausente (default `false`) e `MERCADOPAGO_WEBHOOK_SECRET` ausente, um payload **sem assinatura alguma** foi aceito e **`stored: true`** — ou seja, **gravou uma linha em `payment_events`**. O retorno 200 com `stored:true` é a evidência de que o INSERT foi aceito pelo banco remoto.

Consequências a tratar **antes** de registrar a URL no painel do Mercado Pago:

1. `MERCADOPAGO_WEBHOOK_ENFORCE_SIGNATURE=true` **e** `MERCADOPAGO_WEBHOOK_SECRET` definido são pré-requisitos inegociáveis de produção.
2. **Enforcement permanece DESLIGADO** nesta sprint (a alteração foi cancelada pela instrução de precedência). Ligá-lo sem o segredo e o template reais tornaria o endpoint permanentemente inoperante, pois `verifySignature` nunca retornaria `verified`. O enforcement **não foi validado** (`PIX-001.2-RELATORIO-BLOQUEIO.md` §5).
3. A requisição acima **gravou de fato uma linha** em `payment_events`. Identificada por prova criptográfica (`payload_hash` = `sha256('{}')`), `id` = `841ea53e-3ba8-4241-b8a7-ab2bf11fca30`, `received_at` = `2026-09-17T22:39:29Z`. **Remoção pendente de autorização explícita**; nenhum `DELETE` executado.
4. Enquanto o enforcement estiver desligado, a rota é um ponto de **escrita não autenticada** em `payment_events` (limitada a 256 KB/req, a essa tabela e a `processing_status='ignored'` para eventos fora do escopo), sujeita a flood de linhas.

### 3.2 🗄️ Achado de schema remoto (relevante para o adaptador definitivo)

A consulta de identificação do item 3 revelou as colunas **reais** de `payment_events` no banco remoto:

```
id, order_id, payment_id, provider, event_type, event_id,
payload_hash, payload_json, received_at, processed_at,
processing_status, error_message
```

**Ausentes no remoto:** `provider_status`, `attempt_count`, `last_error_at`.

Isso confirma que a migration `supabase/migrations/20250919000001_pix_mercadopago_columns.sql` **não está aplicada** remotamente — coerente com o diagnóstico de que `000005`–`000008` e `20250918000001` também pendem. O adaptador definitivo deve considerar esse estado: o código de webhook atual só depende de colunas que **existem** (por isso funciona), mas qualquer campo novo das migrations pendentes ainda não tem lastro no remoto.

---

## 4. Contrato — o que permanece NÃO VERIFICADO

⚠️ **Nenhum dos itens abaixo foi confirmado.** O que existir de conhecimento anterior é de nível conceitual e **não** deve ser codificado como se fosse contrato capturado.

### 4.1 Criação de cobrança (Etapa 2 — não executada)

| Item a capturar | Estado |
|---|---|
| Método/rota exatos da **API de Orders** (`/v1/orders`?) | ❌ não verificado |
| Corpo mínimo aceito (campos obrigatórios reais) | ❌ não verificado |
| Forma de escolha do meio de pagamento PIX no corpo | ❌ não verificado |
| Header de idempotência: nome exato e formato aceito | ❌ não verificado |
| Nomes dos campos de retorno do QR | ❌ não verificado |
| Prazo de expiração do QR e onde aparece na resposta | ❌ não verificado |
| Formato do identificador externo devolvido | ❌ não verificado |
| Códigos/mensagens de erro de validação | ❌ não verificado |
| Tipo do campo de valor (centavos inteiros vs. decimal) | ❌ não verificado |
| Estrutura de status e valores possíveis | ❌ não verificado (conceitualmente `approved/pending/in_process/rejected/cancelled/refunded/charged_back`, **sem** confirmação) |

> Observação relevante: o código atual em `app/planos/checkout-button.tsx` já consome `data.pizzData.{qrCode,qrCodeBase64,ticketUrl}`. Esse caminho de campos **não** foi validado contra resposta real do provedor e depende inteiramente do que esta captura confirmaria.

### 4.2 Webhook (Etapa 3 — não executada)

| Item a capturar | Estado |
|---|---|
| Nome exato do header de assinatura | ❌ não verificado |
| Fórmula exata do *manifest* (ordem e separadores) | ❌ **não verificado** |
| Algoritmo e codificação do HMAC | ❌ não verificado |
| Nomes do header de idempotência e de request id | ❌ não verificado |
| Corpo real entregue para tópico de pagamento | ❌ não verificado |
| Mecanismo de configuração do segredo | ❌ não verificado |
| TTL da assinatura / tolerância de *timestamp* | ❌ não verificado |

**Confirmado por ausência:** `MERCADOPAGO_WEBHOOK_SECRET` e `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` **não existem** no ambiente. Sem eles, `verifySignature` permanece em `not_verified` e a Etapa 3 é **impossível** de executar — não há como validar assinatura sem segredo.

### 4.3 Conferência servidor-a-servidor (Etapa 4 — não executada)

| Item | Estado |
|---|---|
| Rota de consulta do recurso por id | ❌ não verificado |
| Correspondência entre status do provedor e status interno | ❌ não verificado |
| Comportamento de idempotência em reprocessamento | ❌ não verificado |

---

## 5. 🚧 O que é necessário para desbloquear

### 5.1 Bloqueio A — credencial (crítico)

Necessário **um** dos dois:

- **(A1)** Credencial de **credenciais de teste** do painel Mercado Pago do próprio projeto (prefixo `TEST-`), com `MERCADOPAGO_ENV=sandbox`; **ou**
- **(A2)** Confirmação humana explícita de que o token `APP_USR-…` atual pertence a uma **conta de teste (test user)** e não à conta de produção — após essa confirmação, e somente então, a Etapa 2 pode ser executada.

**Recomendação:** A1. É o caminho sem ambiguidade, é o que a sprint chama de "Sandbox" e não exige confiar em distinção invisível pelo prefixo.

### 5.2 Bloqueio B — segredo de webhook (crítico para Etapa 3)

É necessário obter, no painel do Mercado Pago, o **segredo de assinatura** (e a fórmula do manifest tal como o painel a documenta). Sem isso a Etapa 3 não tem como validar nada.

Observação importante de ordem de operações: **não registrar a URL do webhook no painel do Mercado Pago** antes de capturar a fórmula do manifest — instrução explícita herdada da PIX-001.1, item 8, e ainda válida.

### 5.3 Bloqueio C — escrita no banco remoto (para Etapa 4, migrations e limpeza)

Não há `SUPABASE_ACCESS_TOKEN`, nem arquivo `sbp_*`, nem senha de banco. A `SUPABASE_SERVICE_ROLE_KEY` do app existe e permitiu **somente leitura** (§3.2), mas não permite aplicar migrations. Consequências:

- a comparação servidor-a-servidor da Etapa 4 depende de leitura, mas a captura que a alimenta (Etapa 2) está bloqueada;
- a remoção da linha do incidente (§3.1, item 3) **depende de autorização explícita** do usuário — identificação já feita, `DELETE` não executado;
- as migrations `20250919000001`–`000003` permanecem não aplicadas no remoto (§3.2).

---

## 6. Arquivos tocados por esta sprint

| Arquivo | Ação |
|---|---|
| `docs/payments/MERCADOPAGO-SANDBOX-CONTRACT.md` | **criado** (este documento) |
| `docs/payments/PIX-001.2-RELATORIO-BLOQUEIO.md` | **criado** (relatório do processo e da decisão) |

Nenhum arquivo de código, migration, configuração ou `.env` foi alterado nesta sprint.
Nenhum commit, push, deploy, rebuild de APK ou aplicação de migration foi realizado.
Nenhuma chamada à API do Mercado Pago foi realizada.

---

## 7. Próximo passo imediato

**Bloqueado aguardando §5.1 (A1 ou A2), §5.2 e §5.3.**

Assim que houver credencial de teste e segredo de webhook, a execução é a das Etapas 2 → 4 originais, sem alteração de escopo: uma cobrança de valor mínimo, captura literal da resposta, captura de **um** webhook real, conferência servidor-a-servidor, e **reescrita deste documento** substituindo a §4 por contrato verificado — com a fórmula do manifest e os nomes de campo transcritos da realidade, nunca inventados. A sequência ordenada, com critérios de aceite, está em `PIX-001.2-RELATORIO-BLOQUEIO.md` §7.3.

**Não avançar para PIX-001.3.**
