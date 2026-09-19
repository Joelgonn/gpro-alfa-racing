# PIX-014.6 — Idempotency-Key do Mercado Pago por TENTATIVA

Status: **implementado, sem commit, sem push, sem deploy, sem migration.**
Data: 2026-09-19 · Base: commit `2440b2e` (deployment em Production `dpl_ERCBpJqcphD2vSiEEHmS6Rk1ifNv`).

---

## 1. Causa exata do 409 `idempotency_key_already_used`

A chave enviada como `X-Idempotency-Key` ao Mercado Pago **não era o `orderId`**: era a **chave do
checkout**, determinística por plano + dia UTC:

```
checkout-button.tsx:51   TEST-ALFA-0141-<PLANO>-<YYYY-MM-DD>   (ex.: TEST-ALFA-0141-VIP_MONTHLY-2026-09-19)
route.ts:82              idempotencyKey (header do checkout) → createMercadoPagoPixPaymentForOrder
paymentService.ts:249    idempotencyKey: opts?.idempotencyKey || orderId      ← a chave do checkout vence
mercadopago-client.ts:430 const idempotencyKey = params.idempotencyKey?.trim() || params.orderId.trim()
mercadopago-client.ts:434 'X-Idempotency-Key': idempotencyKey
```

Consequência: **todas as tentativas do mesmo plano no mesmo dia** enviavam a **mesma chave** ao
provedor. Depois que uma tentativa é registrada no Mercado Pago — inclusive quando ela termina em
erro (o caso do 402 `processing_error` com `test_user_...@testuser.com`, cujo corpo ainda mudaria
para o e-mail real) — a próxima tentativa reutilizava a chave e recebia **409**
`idempotency_key_already_used`.

Agrava o quadro: no caminho antigo **nada era persistido antes** da chamada ao provedor
(`premium_payments` só era gravado no sucesso, e `provider_order_id` idem), então não havia como
saber qual chave já tinha sido usada nem reaproveitar uma Order existente — e o 409 era mapeado
como erro genérico (`503 "Falha ao criar cobrança"`).

## 2. Fluxo de idempotência (antes → depois)

```
ANTES                              DEPOIS (PIX-014.6)
---------------------------------  ---------------------------------------------------
checkout key (plano+dia)           checkout key (plano+dia)  ← idempotência da NOSSA API
        ↓                                  ↓
   premium_order                      premium_order (Parte B: novo pedido se encerrado
        ↓                                              e sem cobrança utilizável)
   X-Idempotency-Key =                       ↓
   chave do checkout  ❌              TENTATIVA (linha em premium_payments, gravada ANTES)
   (mesma p/ todas as tentativas)             ↓
                                       X-Idempotency-Key = TEST-ALFA-0141-MP-<orderId>-<n>
                                              ↓
                                       Mercado Pago /v1/orders
```

## 3. Chave usada em cada camada

| Camada | Chave / estado | Onde é persistido |
|---|---|---|
| Checkout (nossa API) | `TEST-ALFA-0141-<PLANO>-<DIA>` (inalterada) | `premium_orders.payload_hash = sha256(userId\|key)` |
| Tentativa | `TEST-ALFA-0141-MP-<orderId>-<n>` | `premium_payments.pix_txid` (índice único parcial — **sem migration**) |
| Mercado Pago | a chave **da tentativa** | `provider_order_id` / `provider_external_reference` em `premium_orders`; `provider_payment_id`, `qr_code`, `expires_at` na tentativa |

## 4. Auditoria de `pix_txid` / `pixTxid` (pré-requisito aprovado)

Todos os consumidores levantados em `app/`, `tests/`, `supabase/`:

| Consumidor | Uso | Quebra? |
|---|---|---|
| `supabase/migrations/20250917000007:20` | comentário: *"ID Pix para idempotência"* | **Não** — a coluna nasceu com finalidade de idempotência |
| `supabase/migrations/20250917000006:28` / `...007:25` | índice único parcial (`pix_txid`) | **Não** — é justamente a garantia usada |
| `app/api/admin/orders/route.ts:42` | exibe `pix_txid.slice(0,8)+'***'` | Não (só mascara; funciona com qualquer tamanho) |
| `app/api/admin/payments/route.ts:39` | idem | Não |
| `app/lib/payments/orderService.ts:241,266` | DTO `pixTxid` (leitura) | **Mudança de contrato observável**: para `provider='mercadopago'`, `pixTxid` deixa de ser `NULL` e passa a ser a chave da tentativa (não é segredo, sem PII) |
| `app/planos/checkout-button.tsx:25` | tipo `pixTxid: string \| null` | Não (nunca renderizado) |
| `app/api/payments/orders/[id]/route.ts:51,62` | menciona `?pixTxid=` como **ignorado** | Não (nenhum parâmetro do cliente é lido) |
| `webhook-service.ts` / rota do webhook | **não usa** `pix_txid` | Não |
| `app/lib/payments/paymentService.ts:23,154` (`provider='test'`) | `createTestPixTxid` formato `TEST-ALFA-0141-[0-9A-F]{12}` | Não — o caminho de teste ficou intacto |

**Veredito: nenhum consumidor exige que `pix_txid` seja exclusivamente o TXID real do banco.** O único
efeito colateral é o DTO `pixTxid` deixar de ser nulo em pagamentos Mercado Pago. Se um dia for
necessário o E2E real do Pix, o lugar é `provider_payment_id` (já usado) — não `pix_txid`.

## 5. Como a tentativa é persistida

1. Tenta-se **reutilizar** (nesta ordem): tentativa confirmada → QR válido → tentativa em voo;
2. antes de abrir tentativa nova, tentativa-se **recuperar** a Order por `provider_order_id`
   (`GET /v1/orders/{id}`);
3. só então insere-se a linha da tentativa (`status='created'`, `pix_txid=chave`) **antes** do
   `POST /v1/orders`;
4. o resultado é gravado **na mesma linha** (`status='pending'` com QR; permanece `'created'` quando
   o provedor não devolve QR);
5. falha definitiva → `status='failed'` (a chave é aposentada); desfecho **desconhecido**
   (timeout/rede/429/5xx) → a linha **permanece em voo** por 90s.

## 6. Como cada garantia é obtida

| Garantia | Mecanismo |
|---|---|
| Retry da mesma tentativa → mesma chave | `status='created'` + idade < 90s ⇒ `in_flight` ⇒ reaproveita chave e linha |
| Timeout / resposta perdida | desfecho desconhecido **não fecha** a tentativa (fica em voo); o retry reusa a chave |
| Clique duplo | `openMercadoPagoAttempt` colide no índice único de `pix_txid` (23505) → a requisição perdedora **adota** a linha vencedora e usa a **mesma** chave |
| Cobrança duplicada | nunca se abre tentativa nova enquanto existe QR válido; Order órfã (nunca exibida) expira em `P1D` sem ser escaneada |
| Recuperação de Order | `provider_order_id` + `GET /v1/orders/{id}` antes de criar outra |
| Falha definitiva → nova chave | `closeMercadoPagoAttempt` marca `failed` → próxima tentativa recebe `…-<n+1>` |
| 409 de idempotência | código próprio `MERCADOPAGO_IDEMPOTENCY_CONFLICT` (409 do provedor reconhecido), tentativa encerrada e **no máximo 1** recuperação (sem loop) |
| Sem chave aleatória | chave determinística por tentativa; nenhum `Math.random` |
| Sem access_grant antecipado | esta camada não escreve em `access_grants`; grant continua só no webhook confirmado |
| Webhook idempotente | intacto (não modificado nesta sprint) |

## 7. Parte B — pedido expirado sem cobrança utilizável

`createOrderFromPlanCode` (orderService):

```
existing = findIdempotentOrder(userId, payloadHash)      // sempre o MAIS RECENTE
se existing:
   mesma chave com planCode diferente → 409 (contrato preservado)
   reusar se isOrderReusableByState(existing)             // não encerrado e não expirado (pago ⇒ sim)
         ou hasUsableMercadoPagoPayment(existing.id)      // QR ainda válido
   senão → cria um NOVO premium_order (mesma chave de checkout, mesmo payload_hash)
```

O `findIdempotentOrder` passou a ordenar por `created_at desc` + `limit(1)`, porque a Parte B pode
gerar mais de um pedido para o mesmo `payload_hash` (o índice de `payload_hash` **não é único**).

Na rota, o `409 "Pedido expirado"` permanece — agora **apenas quando não existe cobrança Pix válida**
para o pedido (com QR válido, o usuário recebe de volta o MESMO QR, sem nova Order e sem nova cobrança).

## 8. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `app/lib/payments/mercadopago-client.ts` | novo código `MERCADOPAGO_IDEMPOTENCY_CONFLICT` e reconhecimento explícito de `idempotency_key_already_used` (409 deixa de ser erro genérico) |
| `app/lib/payments/paymentService.ts` | camada de TENTATIVA: chave por tentativa, persistência antes da chamada, classificação (`paid`/`usable_qr`/`in_flight`/`stale`/`closed`), recuperação por `provider_order_id`, desfecho desconhecido mantém a tentativa em voo, 409 com recuperação única |
| `app/lib/payments/orderService.ts` | Parte B (`isOrderReusableByState` + consulta de cobrança utilizável) e `findIdempotentOrder` pegando o pedido mais recente |
| `app/api/payments/orders/route.ts` | `409 "Pedido expirado"` só quando não há cobrança Pix válida |
| `tests/pix-0146-mp-idempotency.test.js` | **novo** — 10 cenários (95 asserts) |
| `docs/payments/PIX-0146-RELATORIO-IDEMPOTENCY-KEY.md` | **novo** — este documento |

**Não alterados:** webhook e `webhook-service.ts`, `PIX_ENABLED`, preços/`premium_plans`,
`expiration_time: 'P1D'`, `processing_mode`, `payment_method`, assinatura do webhook, credenciais,
concessão de `access_grant`, regras Premium, Supabase remoto. **Nenhuma migration.**

## 9. Testes

| Cenário | Resultado |
|---|---|
| 1. Primeira tentativa → uma Order | ✅ 1 `POST /v1/orders`, chave `…-MP-<orderId>-1`, `provider_order_id` gravado |
| 2. Retry da mesma tentativa → mesma chave | ✅ 1 chamada, mesma chave, nenhuma tentativa nova |
| 3. Clique duplo → uma tentativa | ✅ sequencial: 1 linha / mesma chave; corrida 23505: adoção da tentativa vencedora |
| 4. Timeout → mesma chave | ✅ permanece `created` (em voo) e o retry usa a mesma chave; após 90s ⇒ nova chave |
| 5. Falha definitiva → nova chave | ✅ tentativa falhada ⇒ `…-2`; 402 encerra a tentativa |
| 6. QR existente → zero POST | ✅ 0 chamadas ao provedor |
| 7. 409 → tratamento controlado | ✅ 1 recuperação, `…-2`, sem loop (2 chamadas no máximo); recuperação via `GET /v1/orders/{id}` |
| 8. Sem `access_grant` antes da aprovação | ✅ nenhuma escrita; `VIP_CHECK=false` |
| 9. Webhook idempotente | ✅ regressão (event_id, duplicate_ignored, already_confirmed, grant idempotente) |
| 10. Pedido expirado sem pagamento → novo pedido | ✅ regra pura + comportamento (novo pedido; com QR válido/pago NÃO duplica) |

### Validações executadas

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `node --test tests/pix-*.test.js` | ✅ **9/9** (8 anteriores + PIX-014.6) |
| `node --test tests/alfa-*.test.js` | ⚠️ 27/33 — 6 falhas **pré-existentes** (asserções ALFA-014.x invalidadas pelo PIX real: "sem gateway externo", "nenhum QR Code gerado", "serviço não executa update()"). **Nenhuma falha nova**; 2 suítes que falhavam passaram a passar (`alfa-014-idempotency`, `alfa-014-security`) |
| `npm run build` | ✅ ver relatório da sessão |
| `git diff --check` | ✅ exit 0 |

## 10. Observações / pendências

1. As correções **PIX-014.5** (`@testuser.com`) e **PIX-014.6** estão no working tree, **não commitadas**.
2. Chaves já queimadas no provedor **antes** desta correção (ex.: `TEST-ALFA-0141-VIP_MONTHLY-<dia>`)
   deixam de ser usadas: novas tentativas usam `…-MP-<orderId>-<n>`, o que **desbloqueia o usuário
   imediatamente** (não é preciso esperar a virada do dia UTC).
3. Order órfã criada por timeout cuja resposta se perdeu e cujo `provider_order_id` não foi
   persistido não é recuperável (limite conhecido e documentado; sem QR exibido, não há risco de
   cobrança indevida).
4. O DTO `pixTxid` passa a ser preenchido em pagamentos Mercado Pago (ver seção 4).
