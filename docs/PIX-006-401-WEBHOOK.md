# PIX-006 — Diagnóstico 401 Webhook Mercado Pago

**Data:** 2026-09-18 • **Deployment Preview:** `https://gpro-alfa-racing-brasil-io0xneig2-joelson-goncalves-projects.vercel.app` (`dpl_J5TS32CEgkwTUSgyhrJoWsTX3oRg` `● Ready` `Preview`) • **Production:** `https://gpro-alfa-racing-brasil-4l4t0b32o-joelson-goncalves-projects.vercel.app` (`● Ready` `Production`) • **PIX_ENABLED=false**

## 1. Causa exata do 401

**Dois 401 distintos, sobrepostos:**

1. **Vercel Deployment Protection (SSO) — causa primária do teste externo**
   - `curl -I https://gpro-alfa-racing-brasil-io0xneig2-joelson-goncalves-projects.vercel.app/api/payments/webhooks/mercadopago`
   - Resposta: `HTTP/1.1 302 Found` `Location: https://vercel.com/sso-api?url=.../api/payments/webhooks/mercadopago&nonce=...` + `Set-Cookie: _vercel_sso_nonce=...`
   - Em seguida, sem cookie SSO, `401 Unauthorized` da Vercel (não do nosso código). O Mercado Pago, ao chamar `https://<preview>/api/payments/webhooks/mercadopago` sem `x-vercel-protection-bypass`, recebe `302 → 401` **antes** de chegar ao `route.ts`.

2. **Validação de assinatura do Mercado Pago (nossa, fail-closed) — causa secundária**
   - `app/api/payments/webhooks/mercadopago/route.ts:102` `if (verdict.status !== 'verified') return 401 signature_not_verified`
   - `app/lib/payments/mercadopago-signature.ts` só retorna `verified` se `MERCADOPAGO_WEBHOOK_SECRET` **e** `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` estiverem configurados **e** `x-signature: ts=...,v1=...` + `x-request-id` baterem com HMAC em tempo constante.
   - Hoje `vercel env ls` mostra `MERCADOPAGO_WEBHOOK_SECRET` **ausente** em Preview/Production, `MERCADOPAGO_WEBHOOK_SIGNATURE_TEMPLATE` **ausente** → `verifySignature` retorna `not_verified` (`no_secret`/`no_template`) → nosso código também retornaria `401`, **mesmo sem Vercel SSO**.

**Conclusão:** O `401` observado no teste externo é **ambos**: primeiro o **SSO da Vercel** bloqueia o Preview, e mesmo que o SSO fosse bypassado, **faltam credenciais/assinatura** e o teste do Mercado Pago **pode não enviar `x-signature`/`x-request-id` válidos**, então nosso código também retornaria `401`. Não é erro de código, é proteção + falta de contrato.

## 2. Alteração necessária para liberar o endpoint (sem desativar validação)

**Não desativar** `verifySignature` — ela permanece `fail-closed` (linha 93 `// Fail-closed SEMPRE`).

**Para o Mercado Pago alcançar o Preview, habilitar `Protection Bypass for Automation` (recomendado pela Vercel para webhooks):**

1. Vercel Dashboard → `gpro-alfa-racing-brasil` → Settings → Deployment Protection → **Protection Bypass for Automation** → Enable → copia `VERCEL_AUTOMATION_BYPASS_SECRET` (gerado, ex: `abc123`).
2. Vercel env já cria `VERCEL_AUTOMATION_BYPASS_SECRET` automaticamente (ver `vercel env ls` após habilitar).
3. **URL do webhook para o Mercado Pago passa a ser:**
   ```
   https://gpro-alfa-racing-brasil-io0xneig2-joelson-goncalves-projects.vercel.app/api/payments/webhooks/mercadopago?x-vercel-protection-bypass=<SECRET>
   ```
   ou com header `x-vercel-protection-bypass: <SECRET>` (MP não envia header custom, então usar **query param**).

**Alternativa (Deployment Protection Exceptions):** Settings → Deployment Protection → **Deployment Protection Exceptions** → adicionar `gpro-alfa-racing-brasil-io0xneig2-joelson-goncalves-projects.vercel.app` (ou `preview-branch-name.vercel.app`) para tornar apenas esse domínio público, mantendo `Production` protegido. Requer permissão `Protection Bypass`.

**Código:** Nenhuma desativação de `verifySignature`. Apenas `vercel.json` já criado com `Cache-Control: no-store` para o webhook (evita cache), e comentário em `route.ts:1` explicando o `302 SSO`:
```ts
// Nota Vercel: Preview deployments são protegidos por SSO por padrão.
// Para o Mercado Pago alcançar este endpoint, o Preview deve ser exposto via
// Deployment Protection Exceptions ou via ?x-vercel-protection-bypass=SECRET.
// Este código NÃO desativa a validação de assinatura do Mercado Pago.
```

**Novo Preview necessário?** **Sim.** Após habilitar `Protection Bypass for Automation` ou `Exceptions`, é necessário **redeploy** (`vercel deploy` ou `git push` para branch Preview) para o novo `vercel.json`/`env` entrar em vigor. O `dpl_J5TS32CEgkwTUSgyhrJoWsTX3oRg` atual foi gerado **antes** do `vercel.json` e sem `VERCEL_AUTOMATION_BYPASS_SECRET`, então continuará `302`. Novo `Preview` (`vercel deploy --yes`) gerará nova URL (`https://gpro-alfa-racing-brasil-<newHash>-joelson-goncalves-projects.vercel.app`) que deve ser usada para o webhook.

## 3. Como validar sem pagamento real

```powershell
# 1. Sem assinatura (deve ser 401 do nosso código, não 302, após bypass)
curl -X POST https://<preview>/api/payments/webhooks/mercadopago?x-vercel-protection-bypass=<SECRET> `
  -H "Content-Type: application/json" -d '{"test":1}'
# Esperado: 401 {received:false, reason:"signature_not_verified"} + log pix.webhook.rejected

# 2. Método não permitido
curl -X GET https://<preview>/api/payments/webhooks/mercadopago?x-vercel-protection-bypass=<SECRET>
# Esperado: 405 {received:false, reason:"method_not_allowed"}

# 3. Payload grande
# >256KB → 413 payload_too_large

# 4. Assinatura válida (quando SECRET + TEMPLATE configurados)
# Gerar HMAC com template real (ex: "id:{data_id};request-id:{request_id};ts:{ts}")
# curl -X POST ... -H "x-signature: ts=123,v1=<hmac>" -H "x-request-id: req-123" -d '{"data":{"id":"TEST-123"}}'
# Esperado: 200 {received:true, outcome:"stored_pending" ou "unknown_event", stored:true}
# E SELECT * FROM payment_events WHERE event_id LIKE '%TEST-123%' → 1 row, processed_at not null
# Nenhum UPDATE em premium_payments / access_grants
```

**`order.processed`:** `app/lib/payments/webhook-service.ts:88` `isRelevantEvent` retorna `false` para `t === 'order'` ou `t === 'order.processed'` (só `payment`/`payments`/`payment.*`). `order.processed` (enviado pelo botão "Testar" do MP para **Orders API**) será registrado como `unknown_event` (`outcome: 'unknown_event'`, `stored:true`, `orderId:null`) e **não concederá VIP** — comportamento correto e documentado. Apenas `payment` com `external_reference` que casa com `premium_orders.id` seria `stored_pending` (ainda sem `grant` nesta sprint).

## 4. Arquivos modificados

- `vercel.json` **criado** (headers `Cache-Control: no-store` + comentário sobre `x-vercel-protection-bypass`; não desativa `verifySignature`)
- `app/api/payments/webhooks/mercadopago/route.ts` **comentário** sobre Vercel SSO (linhas 1-5, sem lógica alterada)
- `app/lib/payments/webhook-service.ts` **comentário** sobre `order.processed` (linhas 87-92)

**Não modificado:** `supabase/migrations/*` (nenhum `db push`), `PIX_ENABLED` (`false`), `premium_plans` (`is_active=false`).

## 5. Testes executados

```powershell
npx tsc --noEmit          # TSC:0
npm run build             # BUILD:0 44/44 (ƒ /api/payments/webhooks/mercadopago)
node --test tests/pix-0011-webhook.test.js # 1 pass (3 subtests, 986 checks, PUT/PATCH/DELETE 405, invalid_json 400, duplicate_ignored)
```

**Não executado:** `supabase db push`/`reset`, pagamento `TEST-` real, `UPDATE premium_plans`.

---

**Status:** Diagnóstico concluído, **homologação NÃO concluída** — aguardando `Protection Bypass for Automation` (`VERCEL_AUTOMATION_BYPASS_SECRET`) + `MERCADOPAGO_WEBHOOK_SECRET`/`TEMPLATE` em **Preview** + novo `vercel deploy` para URL com `?x-vercel-protection-bypass=`. **Production permanece protegida** (`PIX_ENABLED=false`, sem `MERCADOPAGO_*`).

**Próxima ação:** Habilitar `Protection Bypass for Automation` em Vercel Dashboard → copiar `VERCEL_AUTOMATION_BYPASS_SECRET` → `vercel env add` Preview → `vercel deploy --yes` → testar `curl` com `?x-vercel-protection-bypass` → `401` (sem assinatura) vs `200` (com `x-signature` válida).
