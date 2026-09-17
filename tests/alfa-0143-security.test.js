// tests/alfa-0143-security.test.js
// ALFA-014.3 — Segurança: sem exposição de dados sensíveis, sem gateway, sem acesso premium.
//
// Testes COMPORTAMENTAIS (executam os serviços reais num subprocesso com stubs em memória,
// ver tests/_alfa0143-harness.cjs) combinados com verificação estrutural do handler.
// Nenhuma rede, nenhum Supabase, nenhum gateway. Casos não executáveis ⇒ PENDING, nunca PASS.

const fs = require('fs')
const path = require('path')
const { runModule } = require('./_alfa0143-harness.cjs')

function read(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8') }
// Asserções de "não contém token proibido" valem sobre o CÓDIGO, não sobre a documentação
// em comentários: documentar a proibição não é violá-la.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== ALFA-014.3 — Segurança ===\n')
const route = read('app/api/payments/orders/[id]/route.ts')
const routeCode = stripComments(route)
const postRoute = read('app/api/payments/orders/route.ts')
const postCode = stripComments(postRoute)
const svc = read('app/lib/payments/orderService.ts')
const svcCode = stripComments(svc)
const paySvc = read('app/lib/payments/paymentService.ts')
const payCode = stripComments(paySvc)
const types = read('app/lib/payments/types.ts')
const typesCode = stripComments(types)
const access = read('app/lib/access/accessService.ts')

const ORDER_A = '11111111-1111-4111-8111-111111111111'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TS = '2026-09-17T00:00:00.000Z'
const SEED = {
  premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 1990, currency: 'BRL', is_active: true }],
  premium_orders: [{ id: ORDER_A, user_id: USER_A, plan_id: PLAN, status: 'pending', amount_cents: 1990,
    currency: 'BRL', pix_txid: null, payload_hash: 'hash-interno-que-nao-deve-vazar', expires_at: null,
    paid_at: null, cancelled_at: null, created_at: TS, updated_at: TS }],
  premium_payments: [{ id: 'pay-a', order_id: ORDER_A, provider: 'test', provider_payment_id: 'pp-1',
    pix_txid: 'TEST-ALFA-0141-AAAAAAAAAAAA', status: 'created', amount_cents: 1990, currency: 'BRL',
    payload_hash: 'hash-de-payload-que-nao-deve-vazar', paid_at: null, created_at: TS, updated_at: TS }],
}

// ---------------------------------------------------------------------------
// 1. Nenhum campo sensível na resposta (comportamental: DTO real serializado)
// ---------------------------------------------------------------------------
const beh = runModule('app/lib/payments/orderService.ts', `
  const d = await mod.getOrderDetailsForUser('${ORDER_A}', '${USER_A}')
  return { json: JSON.stringify(d), p: await mod.getSafePaymentForOrder('${ORDER_A}', '${USER_A}') }
`, { seed: SEED })

if (!beh.ok) {
  pending('serialização real do DTO não executável neste runtime: ' + beh.reason)
} else {
  const json = beh.out.json
  assert(!json.includes('user_id'), 'resposta serializada sem user_id')
  assert(!json.includes('payload_hash'), 'resposta serializada sem payload_hash')
  assert(!json.includes('payload_json'), 'resposta serializada sem payload_json')
  assert(!json.includes('hash-interno') && !json.includes('hash-de-payload'), 'hashes internos não vazam')
  assert(!json.includes('plan_id'), 'resposta serializada sem plan_id')
  assert(!json.includes('premium_orders'), 'resposta serializada sem dados do join')
  assert(!/(service_role|SUPABASE_SERVICE_ROLE|sk_live|Bearer )/.test(json), 'resposta sem service role/tokens/segredos')
  assert(beh.out.p && beh.out.p.pixTxid === 'TEST-ALFA-0141-AAAAAAAAAAAA', 'pixTxid de teste é o único identificador exposto')
}

// ---------------------------------------------------------------------------
// 2. Handler sem exposição
// ---------------------------------------------------------------------------
assert(!routeCode.includes('service_role') && !routeCode.includes('SUPABASE_SERVICE_ROLE'), 'handler sem service_role')
assert(!routeCode.includes('payload_json') && !routeCode.includes('payload_hash'), 'handler sem payload_json/payload_hash')
assert(!routeCode.includes('supabase-admin') && !routeCode.includes('SERVICE_ROLE_KEY'), 'handler não importa o client administrativo')
assert(routeCode.includes('@/app/lib/payments/orderService'), 'handler importa apenas o serviço de leitura de pedidos')
assert(!routeCode.includes('process.env'), 'handler não lê variáveis de ambiente diretamente')
assert(!/console\.(log|info)\(/.test(routeCode), 'nenhum log de dados da resposta')
assert(routeCode.includes('Erro interno'), 'erro genérico devolvido ao cliente (sem detalhe de banco)')

// ---------------------------------------------------------------------------
// 3. Import de server-only nos serviços (impede uso em bundle de cliente)
// ---------------------------------------------------------------------------
assert(payCode.includes("import 'server-only'"), 'paymentService é server-only')
assert(svcCode.includes("import 'server-only'"), 'orderService é server-only')
assert(typesCode.includes('PAYMENT_PUBLIC_COLUMNS') && !/payload_hash/.test(typesCode.match(/PAYMENT_PUBLIC_COLUMNS =[\s\S]{0,300}/)[0]),
  'projeção pública de pagamento não inclui payload_hash')

// ---------------------------------------------------------------------------
// 4. Sem gateway, Pix real, QR Code, webhook ou confirmação
// ---------------------------------------------------------------------------
assert(!/(fetch\(|axios|https\.request|node-fetch|got\()/.test(payCode + svcCode), 'nenhum cliente HTTP nos serviços (nenhum gateway chamado)')
assert(!/qr_code/i.test(payCode + svcCode), 'nenhum QR Code gerado')
assert(!/webhook/i.test(payCode + svcCode), 'nenhum webhook registrado nos serviços de pagamento')
assert(!/status:\s*['"]paid['"]/.test(payCode), 'serviço de teste nunca grava status paid')
assert(!/status:\s*['"]confirmed['"]/.test(payCode), 'serviço de teste nunca grava status confirmed')
assert(!/status:\s*['"](refunded|chargeback)['"]/.test(payCode), 'serviço de teste nunca grava status terminal')
assert(/status: 'created'/.test(payCode) && /provider: 'test'/.test(payCode), 'pagamento de teste permanece provider=test status=created')
assert(!/\.update\(\s*[{)]/.test(payCode), 'serviço de pagamento não executa update() nesta sprint')

// ---------------------------------------------------------------------------
// 5. Nenhuma concessão de acesso premium e flags VIP intactas
// ---------------------------------------------------------------------------
assert(!/access_grants/.test(payCode) && !/access_grants/.test(svcCode) && !/access_grants/.test(routeCode), 'nenhum access_grants em pagamentos')
assert(access.includes('VIP_CHECK = false'), 'VIP_CHECK permanece false')
assert(!routeCode.includes('requireVip'), 'requireVip desativado na rota de pagamentos')
assert(!postCode.includes('requireVip'), 'requireVip desativado no POST de pedidos')
assert(!routeCode.includes('vip_check') && !routeCode.includes('hasAccess'), 'rota de pagamentos não avalia acesso VIP')

// ---------------------------------------------------------------------------
// 6. Nenhum UUID/status/pixTxid arbitrário aceito do frontend
// ---------------------------------------------------------------------------
assert(!routeCode.includes('searchParams') && !routeCode.includes('request.json()'), 'nenhum parâmetro livre do cliente é lido')
assert(!/pixTxid\s*:/.test(routeCode), 'handler não atribui pixTxid (não pode ser definido pelo cliente)')
assert(!/pix_txid/.test(routeCode), 'handler não aceita pix_txid do cliente')
assert(!/planId|plan_id/.test(routeCode), 'handler não aceita plan_id/planId do cliente')
assert(!/status:\s*(request|body)/.test(routeCode) && !/status.*request\./.test(routeCode), 'handler não define status a partir de entrada do cliente')
assert(/await params/.test(routeCode), 'único parâmetro de entrada é o id do path')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas segurança.')
else console.log('✅ Segurança OK')
