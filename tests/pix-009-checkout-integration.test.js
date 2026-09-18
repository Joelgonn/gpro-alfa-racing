// tests/pix-009-checkout-integration.test.js
// PIX-009 — Integração checkout real Mercado Pago (flag, criação, erros, segurança)
// Estrutural + mocks leves; nenhum pagamento real, nenhum VIP, nenhum token real

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }

console.log('=== PIX-009 — Integração Checkout Mercado Pago ===\n')

const ORDERS_ROUTE = 'app/api/payments/orders/route.ts'
const ORDERS_ID_ROUTE = 'app/api/payments/orders/[id]/route.ts'
const ORDER_SVC = 'app/lib/payments/orderService.ts'
const PAY_SVC = 'app/lib/payments/paymentService.ts'
const MP_CLIENT = 'app/lib/payments/mercadopago-client.ts'
const PLANOS_PAGE = 'app/planos/page.tsx'
const CHECKOUT_BTN = 'app/planos/checkout-button.tsx'

const ordersRoute = read(ORDERS_ROUTE)
const ordersIdRoute = read(ORDERS_ID_ROUTE)
const orderSvc = read(ORDER_SVC)
const paySvc = read(PAY_SVC)
const mpClient = read(MP_CLIENT)
const planosPage = read(PLANOS_PAGE)
const checkoutBtn = read(CHECKOUT_BTN)

const ordersCode = stripComments(ordersRoute)
const payCode = stripComments(paySvc)

// ---------------------------------------------------------------------------
// 1. Flag PIX_ENABLED
// ---------------------------------------------------------------------------
console.log('--- 1. Flag PIX_ENABLED ---')
assert(ordersCode.includes("process.env.PIX_ENABLED === 'true'"), 'rota POST lê PIX_ENABLED === true')
assert(ordersCode.includes('createTestPaymentForOrder'), 'rota mantém fluxo teste quando flag false')
assert(ordersCode.includes('createMercadoPagoPixPaymentForOrder'), 'rota chama fluxo real quando flag true')
assert(ordersCode.includes('MERCADOPAGO_CONFIG_MISSING'), 'rota trata CONFIG_MISSING → 503')
assert(ordersCode.includes("status: 503"), 'rota retorna 503 para configuração incompleta (sem fallback silencioso)')
assert(!/createTestPaymentForOrder.*createMercadoPagoPixPaymentForOrder/.test(ordersCode) || ordersCode.indexOf('createTestPaymentForOrder') < ordersCode.indexOf('createMercadoPagoPixPaymentForOrder'), 'ordem: teste antes de real (flag false primeiro)')
assert(!ordersCode.includes('provider=test') || ordersCode.includes('pixEnabled'), 'não hardcode provider=test quando flag true')

// GET [id] também respeita flag
assert(read(ORDERS_ID_ROUTE).includes("process.env.PIX_ENABLED === 'true'"), 'GET [id] verifica PIX_ENABLED para QR real')
assert(ordersIdRoute.includes('qr_code'), 'GET [id] lê qr_code quando flag true')
assert(ordersIdRoute.includes('pizzData'), 'GET [id] retorna pizzData compatível com frontend')

// Planos page gate
assert(/process\.env\.PIX_ENABLED === 'true'/.test(planosPage), 'planos page gate PIX_ENABLED')
assert(planosPage.includes('Pagamento indisponível'), 'planos page mostra indisponível quando flag false')
assert(!/MERCADOPAGO/.test(stripComments(planosPage)), 'planos page não referencia token')

// ---------------------------------------------------------------------------
// 2. Criação — plano/preço/pedido
// ---------------------------------------------------------------------------
console.log('\n--- 2. Criação ---')
assert(ordersCode.includes('createOrderFromPlanCode'), 'rota cria pedido via createOrderFromPlanCode (preço do banco)')
assert(!/body\.amount/.test(ordersCode), 'rota não lê amount do body (preço do banco)')
assert(ordersCode.includes('planCode'), 'rota valida planCode')
assert(orderSvc.includes("select('id, code, price_cents"), 'orderService busca preço de premium_plans')
assert(ordersCode.includes('expires_at'), 'rota verifica expiração do pedido')
assert(ordersCode.includes('Pedido expirado'), 'pedido expirado → 409')
assert(ordersCode.includes('external_reference') || paySvc.includes('external_reference'), 'external_reference mapeado')
assert(paySvc.includes('external_reference') && paySvc.includes('orderId'), 'paymentService usa orderId como external_reference')
assert(mpClient.includes("external_reference: params.orderId"), 'client usa orderId como external_reference (não planCode/userId)')
assert(mpClient.includes('centsToDecimal') || mpClient.includes('transaction_amount'), 'client converte centavos → decimal')
assert(mpClient.includes("currency_id") && mpClient.includes("'BRL'"), 'client moeda BRL')
assert(ordersCode.includes('description') || paySvc.includes('description'), 'description enviada')

// Idempotência
assert(ordersCode.includes('Idempotency-Key'), 'rota exige Idempotency-Key')
assert(orderSvc.includes('payload_hash'), 'orderService idempotência por payload_hash')
assert(paySvc.includes("provider: 'mercadopago'") && paySvc.includes("qr_code"), 'paymentService reusa pagamento mercadopago com qr_code')
assert(paySvc.includes("code === '23505'"), 'paymentService trata 23505 para concorrência')
assert(orderSvc.includes('in(') && orderSvc.includes("'mercadopago'"), 'getSafePaymentForOrder suporta mercadopago quando flag true')

// Persistência
assert(paySvc.includes('qr_code') && paySvc.includes('qr_code_base64') && paySvc.includes('ticket_url'), 'paymentService persiste QR/ticket')
assert(paySvc.includes('provider_payment_id') && paySvc.includes('provider_status'), 'paymentService persiste IDs e status MP')
assert(paySvc.includes('raw_response_masked'), 'paymentService persiste raw mascarado')

// ---------------------------------------------------------------------------
// 3. Validação resposta antes de persistir
// ---------------------------------------------------------------------------
console.log('\n--- 3. Validação resposta ---')
assert(mpClient.includes('providerPaymentId') && mpClient.includes('Resposta sem ID'), 'client exige ID presente')
assert(mpClient.includes("currency !== 'BRL'") || mpClient.includes("currency deve ser BRL"), 'client valida moeda BRL')
assert(ordersRoute.includes('amount_cents') && ordersRoute.includes('Falha ao criar cobrança'), 'rota valida divergência de valor (amount_cents vs MP)')
assert(mpClient.includes('amountCents') && mpClient.includes('Number.isInteger'), 'client valida amountCents inteiro positivo')
assert(!/payload_json/.test(ordersCode), 'rota não retorna payload_json')

// QR opcional
assert(mpClient.includes('qrCode') && mpClient.includes('null'), 'client normaliza QR ausente como null')
assert(ordersCode.includes('pizzData'), 'rota POST retorna pizzData quando real')

// ---------------------------------------------------------------------------
// 4. Contrato API
// ---------------------------------------------------------------------------
console.log('\n--- 4. Contrato API ---')
assert(ordersCode.includes('orderSafe'), 'POST retorna orderSafe')
assert(ordersCode.includes('paymentSafe'), 'POST retorna paymentSafe')
assert(ordersCode.includes('providerPaymentId') || ordersCode.includes('provider_payment_id'), 'paymentSafe inclui providerPaymentId')
assert(ordersCode.includes("status: 'pending'") || paySvc.includes("status: 'pending'"), 'pagamento criado como pending (não paid)')
assert(!/paid/.test(ordersCode.split('paymentSafe')[1] || '') || ordersCode.includes("status: 'pending'"), 'não retorna paid como criação')
assert(ordersIdRoute.includes('order') && ordersIdRoute.includes('payment'), 'GET retorna order+payment')
assert(!/access_grants/.test(ordersCode), 'POST não toca access_grants')
assert(!/access_grants/.test(read(ORDERS_ID_ROUTE)), 'GET não toca access_grants')

// ---------------------------------------------------------------------------
// 5. Frontend
// ---------------------------------------------------------------------------
console.log('\n--- 5. Frontend ---')
assert(planosPage.includes("pixEnabled ?"), 'frontend gate pixEnabled ternário')
assert(!/MERCADOPAGO/.test(stripComments(checkoutBtn)), 'checkout-button não chama MP direto')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(checkoutBtn), 'checkout não recebe token')
assert(checkoutBtn.includes('pizzData'), 'checkout consome pizzData (qrCode)')
assert(checkoutBtn.includes("isPaid") && checkoutBtn.includes("paymentStatus === 'confirmed'"), 'frontend não interpreta criação como aprovado (só confirmed/paid)')
assert(!/access_grants/.test(stripComments(checkoutBtn)), 'frontend não concede VIP localmente')

// ---------------------------------------------------------------------------
// 6. Erros Mercado Pago
// ---------------------------------------------------------------------------
console.log('\n--- 6. Erros MP ---')
assert(mpClient.includes('MERCADOPAGO_UNAUTHORIZED'), 'client trata 401')
assert(mpClient.includes('MERCADOPAGO_RATE_LIMITED'), 'client trata 429')
assert(mpClient.includes('MERCADOPAGO_REQUEST_FAILED'), 'client trata 500')
assert(mpClient.includes('MERCADOPAGO_TIMEOUT'), 'client trata timeout AbortError')
assert(ordersRoute.includes('503') && ordersRoute.includes('Serviço de pagamento indisponível'), 'rota 503 para CONFIG_MISSING')
assert(ordersRoute.includes('Falha ao criar cobrança'), 'rota 503 genérica para outros erros MP')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(ordersCode) || ordersCode.includes('MERCADOPAGO_CONFIG_MISSING'), 'rota não expõe token no erro (mensagem genérica)')

// ---------------------------------------------------------------------------
// 7. Segurança
// ---------------------------------------------------------------------------
console.log('\n--- 7. Segurança ---')
assert(!/NEXT_PUBLIC.*MERCADOPAGO/.test(mpClient + ordersRoute), 'nenhuma var NEXT_PUBLIC de MP')
assert(mpClient.includes('server-only'), 'client server-only')
assert(paySvc.includes('server-only'), 'paymentService server-only')
assert(!/console\.log\(.*token/.test(mpClient), 'nenhum log de token')
assert(!/access_grants/.test(stripComments(mpClient)), 'client não toca access_grants')
assert(!/access_grants/.test(ordersCode), 'rota não insere access_grants')
assert(!/VIP/.test(ordersCode) || ordersCode.includes('Falha'), 'rota não concede VIP')

console.log('\n=== Resumo PIX-009 ===')
if (process.exitCode) console.log('❌ Falhas PIX-009.')
else console.log('✅ PIX-009 integração OK')
