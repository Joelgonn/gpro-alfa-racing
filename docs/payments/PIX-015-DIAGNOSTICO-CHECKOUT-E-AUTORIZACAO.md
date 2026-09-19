# PIX-015 — Diagnóstico do checkout em Production + Autorização Free/Premium

Status: **diagnóstico + correções implementadas; sem commit, sem push, sem deploy, sem migration.**
Base: `99a4c79` · Deployment Production analisado: `dpl_2nud4u6uxUDwexzBrMZQpRaBGLPf`.

---

## PROBLEMA 1 — 402 `processing_error` no Mercado Pago

### Evidências coletadas

| # | Evidência | Como foi obtida |
|---|---|---|
| E1 | O payload que o código envia é **aceito** pelo provedor: HTTP **201**, Order `ORDTST01M2XNYWBFN7D99T1D4DSTRG7S`, `status=action_required`, `status_detail=waiting_transfer`, com `transactions.payments[0]` contendo QR (`qr_code`, `qr_code_base64`, `ticket_url`) | `POST /v1/orders` executado no **sandbox** com o payload idêntico ao de `buildPixPayload` (`type=online`, `processing_mode=automatic`, `total_amount=1.99`, `payment_method {id: pix, type: bank_transfer}`, `expiration_time=P1D`, `payer.email`) |
| E2 | Sem `payer` o provedor responde **400** ⇒ `payer.email` é obrigatório | mesmo experimento, payload sem `payer` |
| E3 | A credencial disponível neste ambiente é de **sandbox** (`/users/me` → `TESTUSER7787314022675637397`, site MLB). O token de **Production** não é legível aqui | `GET /users/me`; leitura dos `.env` |
| E4 | Com o token sandbox, as 3 Orders e os 3 Payments de Production retornam **404** ⇒ não é possível ler o estado real deles daqui | `GET /v1/orders/{id}` e `GET /v1/payments/{id}` para os 3 pares informados |
| E5 | Na resposta de sucesso o provedor devolve **`expiration_time: "P1D"`** (duração, ecoada do request) **e** `date_of_expiration` (ISO). O código lia a duração como data ⇒ `expires_at` ficava `NULL` | corpo real capturado em E1 |
| E6 | Em HTTP 402 o provedor **cria** Order + Payment e retorna `errors[0].code=failed` / `"The following transactions failed"`, com o pagamento em `processing_error`. O código extraía apenas `code`/`message` do primeiro erro — **descartava** `details`, `status_detail` e os ids criados | logs de Production informados + leitura de `handleHttpError` no commit `99a4c79` |

### Conclusões

**PROVADO**
1. O **payload está correto e é aceito** pelo provedor — não é payload inválido, não é `processing_mode`, não é `payment_method`, não é `expiration_time` (E1).
2. `payer.email` é **exigido** pela API (E2) e é enviado corretamente (e-mail real do usuário autenticado, com bloqueio apenas de `@testuser.com` em Production).
3. O 402 não é idempotência (PIX-014.6 resolvido — as 3 tentativas têm chaves distintas `…-MP-<orderId>-<n>`) nem falha de requisição: a **Order e o Payment existem** no provedor e a **transação** falhou (E6).
4. Nossa instrumentação era **insuficiente para determinar a causa**: o motivo real (`status_detail`/`details`) e os ids criados eram descartados no caminho de erro (E6) e o `provider_order_id` nunca era persistido em falha.

**INFERIDO (a partir da estrutura do erro, não confirmado)**
- `processing_error` + `"The following transactions failed"` indica rejeição da **transação Pix** por condição do provedor/conta/pagador no momento da criação (risco, habilitação Pix da conta, ou o pagador não aceito por aquela conta). **Não é possível determinar qual** sem o corpo do 402 de Production ou sem `GET /v1/orders/{id}` com o token de Production.

**NÃO DETERMINADO**
- A causa específica do 402 nas 3 tentativas reais. Falta **uma** destas duas informações externas:
  1. o corpo completo do 402 (agora será registrado pelo código, ver correção); **ou**
  2. `GET /v1/orders/ORD01M2XNH47AER0CFQBW12G8KNN3` (e as outras duas) com o **Access Token de Production** — o `status_detail` da Order/pagamento informa o motivo.
- Nada de workaround especulativo foi implementado.

### Correções aplicadas (baseadas em E1/E5/E6, sem alterar o fluxo PIX-014.6)

| Correção | Arquivo | Motivo |
|---|---|---|
| C1 — expiração real do QR | `app/lib/payments/mercadopago-client.ts` | passou a preferir `date_of_expiration` (ISO) e **ignorar durações** como `P1D` (E5). Antes `expires_at` ficava `NULL` e o QR era tratado como utilizável para sempre |
| C2 — detalhe do erro do provedor | `mercadopago-client.ts` | `MercadoPagoErrorDetail` com `providerErrorCode`, `providerMessage`, `details[]`, `statusDetail`, `providerOrderId`, `providerPaymentId` — extração defensiva (não assume shape), sanitizada (e-mail → `[email]`, JWT/token → redigido, truncada) |
| C3 — código próprio para 402 | `mercadopago-client.ts` | `MERCADOPAGO_TRANSACTION_FAILED` (distinto de falha de requisição): a cobrança chegou a existir no provedor |
| C4 — persistir ids criados em falha | `app/lib/payments/paymentService.ts` | em 402 com ids no corpo, grava `provider_order_id` no pedido e `provider_payment_id` na tentativa, e guarda motivo (`status_detail`, `details`) em `raw_response_masked` — habilita auditoria e a recuperação já existente |

**Payload sanitizado efetivamente enviado** (produzido pelo código atual, validado em E1):

```json
{
  "type": "online",
  "external_reference": "<premium_orders.id (uuid)>",
  "total_amount": "1.99",
  "description": "VIP vip_monthly",
  "processing_mode": "automatic",
  "transactions": {
    "payments": [{
      "amount": "1.99",
      "payment_method": { "id": "pix", "type": "bank_transfer" },
      "expiration_time": "P1D"
    }]
  },
  "payer": { "email": "[email do usuário autenticado]" }
}
```
Headers: `Authorization: Bearer <env MERCADOPAGO_ACCESS_TOKEN>`, `Content-Type: application/json`,
`X-Idempotency-Key: TEST-ALFA-0141-MP-<orderId>-<n>` (PIX-014.6).

---

## PROBLEMA 2 — Free acessando o Manager

### Causa

Não havia **nenhuma autorização server-side** fora de `/dashboard/admin`:
`app/dashboard/**` não tinha guard (nem layout, nem páginas); o middleware só renova sessão;
`VIP_CHECK=false`; nenhuma rota manager chamava `requireVip`. Logo,
**autenticação == autorização**: o usuário gratuito abria `/dashboard/manager` por URL direta,
por refresh ou pelo botão "Painel" (as APIs manager respondiam igualmente a qualquer autenticado).

### Correção (regra única, no servidor)

| Peça | Papel |
|---|---|
| `app/lib/access/authorization.ts` | **ÚNICA** regra: `resolveAccessDecision()` (reutiliza o `accessService` — fonte de verdade), `requireDashboardAccess()` (páginas) e `guardPremiumApi()` (APIs). Níveis: `anonymous`/`free`/`premium`/`admin` |
| `app/dashboard/layout.tsx` | virou **server component** com `requireDashboardAccess()`: anônimo → `/login?next=…`; free → `/planos?motivo=premium`; premium/admin → liberado. `dynamic = 'force-dynamic'` |
| `app/dashboard/DashboardShell.tsx` | UI (sidebar, GameProvider, menu) preservada, agora como shell cliente |
| 6 rotas de API | `guardPremiumApi()` → 401 (anônimo) / 403 `PREMIUM_REQUIRED` (free): `manager/profile`, `gpro/sync`, `gpro/token` (3 handlers), `market/update` (2), `calendar`, `python/[[...route]]` (2 — ações públicas `tracks`/`tyre_suppliers` preservadas) |

Admin nunca é bloqueado pela guarda; Free continua comprando (`/api/payments/orders` **não** exige Premium);
`/login`, `/cadastro`, `/planos` e logout permanecem intactos.

---

## Testes

| Arquivo | Cobertura |
|---|---|
| `tests/pix-015-free-premium-access.test.js` | **novo** — 12 cenários (free bloqueado em página/API/URL direta, IDOR, premium liberado, premium expirado/revogado bloqueado, admin liberado, anônimo 401/redirect, login/cadastro/planos/logout intactos) + estrutural (guarda no servidor, cliente não decide, todas as rotas protegidas) |
| `tests/pix-015-mp-error-detail.test.js` | **novo** — expiração (`P1D` vs `date_of_expiration`), detalhe do 402 (status_detail/details/ids), sanitização de e-mail, payload inalterado |
| `tests/pix-0146-mp-idempotency.test.js` | ajuste de 1 asserção (402 agora ⇒ `MERCADOPAGO_TRANSACTION_FAILED`) |
| `tests/alfa-001-auth.test.js`, `tests/alfa-011-5-vip-invites.test.js`, `tests/pix-002-plans.test.js` | apontados de `app/dashboard/layout.tsx` → `app/dashboard/DashboardShell.tsx` (o menu mudou de arquivo na divisão do layout). **Nenhuma asserção foi relaxada** |

### Resultados

| Comando | Resultado |
|---|---|
| `tests/pix-0146-mp-idempotency.test.js` | ✅ (10 cenários) |
| `tests/pix-015-free-premium-access.test.js` | ✅ (12 cenários + estrutural) |
| `tests/pix-015-mp-error-detail.test.js` | ✅ |
| `node --test tests/pix-*.test.js` | ✅ **11/11** |
| `node --test tests/alfa-*.test.js` | ⚠️ 27/33 — **as mesmas 6 falhas pré-existentes**, nenhuma nova |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ `✓ Compiled successfully in 19.3s` — `/dashboard/**` agora `ƒ (Dynamic)` (antes `○ Static`), consequência esperada do guard |
| `git diff --check` | ✅ exit 0 |

Falhas pré-existentes (inalteradas): `alfa-002` (sponsors/route.js legado), `alfa-003-regression` (fallback
AGUARDANDO), `alfa-0142-payment-preparation` ("sem gateway externo"), `alfa-0143-isolation` ("provider=test"),
`alfa-0143-pix-txid` ("nenhum QR Code gerado"), `alfa-0143-security` ("handler não importa o client
administrativo", "não lê variáveis de ambiente", "nenhum QR Code gerado", "serviço não executa update()").
Todas são asserções de sprints antigas invalidadas pelo PIX real — nenhuma relacionada a esta sprint.

---

## Riscos e pendências

1. **Causa do 402 permanece não determinada** — requer o corpo do 402 pós-deploy (agora registrado) ou
   `GET /v1/orders/{id}` com o token de Production. **Nenhum workaround especulativo foi criado.**
2. `/dashboard/**` deixou de ser estático: agora renderiza por requisição (necessário para autorizar por usuário).
3. Fronteira de autorização: o **shell inteiro** de `/dashboard` é Premium (decisão documentada). Se o produto
   quiser liberar páginas específicas para Free, é um allowlist de uma linha na guarda.
4. `app/planos/page.tsx` (alteração PIX-010/E2E pré-existente) permanece **fora** desta sprint.
5. Nada foi commitado/enviado/publicado; nenhuma migration, nenhuma alteração de Supabase/credenciais/preços.
