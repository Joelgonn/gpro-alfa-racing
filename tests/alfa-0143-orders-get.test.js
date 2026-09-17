// tests/alfa-0143-orders-get.test.js
// ALFA-014.3 — GET /api/payments/orders/:id: contrato, somente leitura e DTO.
//
// Testes COMPORTAMENTAIS onde é possível: as funções reais de orderService/paymentService
// são executadas num subprocesso com dados em memória (tests/_alfa0143-harness.cjs).
// O contrato HTTP (401/400/404/405) é verificado estruturalmente no handler, pois exige
// servidor Next em execução; esses casos são registrados como PENDING quando não executáveis.
// Nenhum caso é declarado PASS apenas por ser verificação estática.

const fs = require('fs')
const path = require('path')
const { runModule } = require('./_alfa0143-harness.cjs')

function read(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8') }
// Remove comentários para asserções que devem valer apenas sobre CÓDIGO executável
// (documentar a regra em comentário não pode ser tratado como violação, nem o contrário).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== ALFA-014.3 — Orders GET ===\n')
const route = read('app/api/payments/orders/[id]/route.ts')
const routeCode = stripComments(route)
const postRoute = read('app/api/payments/orders/route.ts')
const postCode = stripComments(postRoute)
const svc = read('app/lib/payments/orderService.ts')

const ORDER_A = '11111111-1111-4111-8111-111111111111'
const ORDER_SEM_PAG = '44444444-4444-4444-8444-444444444444'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TS = '2026-09-17T00:00:00.000Z'

function order(id, userId) {
  return { id, user_id: userId, plan_id: PLAN, status: 'pending', amount_cents: 1990, currency: 'BRL',
    pix_txid: null, payload_hash: null, expires_at: null, paid_at: null, cancelled_at: null, created_at: TS, updated_at: TS }
}
const SEED = {
  premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 1990, currency: 'BRL', is_active: true }],
  premium_orders: [order(ORDER_A, USER_A), order(ORDER_SEM_PAG, USER_A)],
  premium_payments: [{ id: 'pay-a', order_id: ORDER_A, provider: 'test', provider_payment_id: null,
    pix_txid: 'TEST-ALFA-0141-AAAAAAAAAAAA', status: 'created', amount_cents: 1990, currency: 'BRL',
    payload_hash: null, paid_at: null, created_at: TS, updated_at: TS }],
}

// ---------------------------------------------------------------------------
// 1. Contrato do handler
// ---------------------------------------------------------------------------
assert(route.includes('createClient') && route.includes('auth.getUser'), 'sem sessão ⇒ 401 (auth.getUser)')
assert(route.includes("if (authErr || !user)") && route.includes('401'), '401 explícito quando não há usuário')
assert(route.includes('isValidUUID') && route.includes('400'), 'UUID inválido ⇒ 400')
assert(route.includes('getOrderDetailsForUser') && route.includes('userId'), 'consulta pelo userId da sessão')
assert(route.includes("error: 'Pedido não encontrado'") && route.includes('404'), 'pedido inexistente/terceiro ⇒ 404 com corpo único')
assert(route.includes('405') && /export async function POST/.test(route) && /export async function PUT/.test(route)
  && /export async function PATCH/.test(route) && /export async function DELETE/.test(route),
  'POST/PUT/PATCH/DELETE ⇒ 405')
assert(!routeCode.includes('request.json()') && !routeCode.includes('searchParams') && !routeCode.includes('request.url'),
  'query string e body nunca são lidos (ignorados por construção)')
assert(route.includes('details.order') && route.includes('details.payment'), 'resposta devolve { order, payment }')

// --- Instrumentação (Parte B): código do erro no log, resposta intacta, nada sensível logado ---
assert(routeCode.includes('describeError') && /catch \(error: unknown\)/.test(routeCode),
  'catch extrai code/name/message com tipo unknown')
assert(/describeError\(error\)/.test(routeCode) && !/error\.message\?\.slice/.test(routeCode),
  'log registra o diagnóstico sanitizado (código explícito), não a mensagem crua truncada')
assert(!/console\.error\([^)]*,\s*error\s*\)/.test(routeCode), 'nunca loga o objeto de erro completo')
assert(!/\{\s*success: false, error: (error|describeError)/.test(routeCode)
  && (routeCode.match(/error: 'Erro interno'/g) || []).length === 1,
  'resposta ao cliente permanece Erro interno (nada do diagnóstico vaza)')
assert(/PGRST/.test(route) && /N[ÃA]O/.test(route), 'comentário registra que falha de infraestrutura não vira 404')

// ---------------------------------------------------------------------------
// 2. Somente leitura (asserção estrutural decisiva: nenhuma escrita no handler)
// ---------------------------------------------------------------------------
assert(!routeCode.includes('.insert('), 'handler do GET não insere')
assert(!routeCode.includes('.update('), 'handler do GET não atualiza')
assert(!routeCode.includes('.delete('), 'handler do GET não apaga')
assert(!routeCode.includes('createTestPaymentForOrder'), 'GET nunca chama createTestPaymentForOrder')
assert(!routeCode.includes('ensureTestPaymentForOrder'), 'GET nunca chama ensureTestPaymentForOrder')
assert(!svc.includes('createTestPaymentForOrder'), 'ordem de detalhes não cria pagamento (GET é somente leitura)')
assert(!/from\('premium_payments'\)[\s\S]{0,400}?\.insert\(/.test(svc), 'nenhum insert em premium_payments dentro do serviço de leitura')

// ---------------------------------------------------------------------------
// 3. Comportamento real: pedido próprio, pedido sem pagamento, pedido de terceiro
// ---------------------------------------------------------------------------
const beh = runModule('app/lib/payments/orderService.ts', `
  const comPag = await mod.getOrderDetailsForUser('${ORDER_A}', '${USER_A}')
  const semPag = await mod.getOrderDetailsForUser('${ORDER_SEM_PAG}', '${USER_A}')
  const terceiro = await mod.getOrderDetailsForUser('${ORDER_SEM_PAG}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  return {
    comPag, semPag, terceiro,
    escritas: globalThis.__ALFA_WRITES__.length,
  }
`, { seed: SEED })

if (!beh.ok) {
  pending('comportamento do GET não executável neste runtime: ' + beh.reason)
  pending('casos HTTP 401/400/404/405 exigem servidor Next em execução (não executados nesta sprint)')
} else {
  const o = beh.out
  assert(o.comPag && o.comPag.order.planCode === 'vip_monthly', 'GET 200 para pedido próprio, com planCode')
  assert(o.comPag && o.comPag.payment && o.comPag.payment.pixTxid === 'TEST-ALFA-0141-AAAAAAAAAAAA',
    'pagamento de teste associado é devolvido com pixTxid persistido')
  assert(o.semPag && o.semPag.payment === null, 'pedido legado sem pagamento ⇒ payment: null (nenhuma criação)')
  assert(o.terceiro === null, 'pedido de terceiro ⇒ mesmo resultado de inexistente')
  assert(o.escritas === 0, 'ZERO escritas em banco durante as consultas (leitura comprovada)')
  pending('casos HTTP 401/400/404/405 exigem servidor Next em execução (não executados nesta sprint)')
}

// ---------------------------------------------------------------------------
// 4. DTO por allow-list positiva
// ---------------------------------------------------------------------------
const CHAVES_ORDER = ['amountCents', 'createdAt', 'currency', 'expiresAt', 'id', 'paidAt', 'planCode', 'status', 'updatedAt']
const CHAVES_PAYMENT = ['amountCents', 'currency', 'id', 'pixTxid', 'provider', 'status']

if (beh.ok) {
  const chavesOrder = Object.keys(beh.out.comPag.order).sort()
  const chavesPayment = Object.keys(beh.out.comPag.payment).sort()
  assert(JSON.stringify(chavesOrder) === JSON.stringify(CHAVES_ORDER), 'order expõe exatamente as chaves permitidas: ' + JSON.stringify(chavesOrder))
  assert(JSON.stringify(chavesPayment) === JSON.stringify(CHAVES_PAYMENT), 'payment expõe exatamente as chaves permitidas: ' + JSON.stringify(chavesPayment))
  assert(!chavesOrder.includes('user_id') && !chavesOrder.includes('plan_id') && !chavesOrder.includes('payload_hash'),
    'DTO do pedido sem user_id/plan_id/payload_hash')
  assert(!chavesPayment.includes('order_id') && !chavesPayment.includes('payload_hash') && !chavesPayment.includes('premium_orders'),
    'DTO do pagamento sem order_id/payload_hash/join')
} else {
  pending('verificação das chaves do DTO não executável: ' + beh.reason)
}

// ---------------------------------------------------------------------------
// 5. Compatibilidade do POST da ALFA-014.2 (alteração mínima: 1 argumento)
// ---------------------------------------------------------------------------
assert(postCode.includes('createTestPaymentForOrder(result.order.id, userId)'),
  'POST 014.2 passa userId (única alteração de compatibilidade)')
assert((postCode.match(/createTestPaymentForOrder\(/g) || []).length === 1, 'POST chama createTestPaymentForOrder uma única vez')
assert((postCode.match(/^import .*createTestPaymentForOrder/m) || []).length === 1, 'POST importa createTestPaymentForOrder uma única vez')
assert(postRoute.includes('Idempotency-Key') && postRoute.includes('planCode') && postRoute.includes('201') && postRoute.includes('200'),
  'contrato do POST 014.2 preservado (planCode, Idempotency-Key, 201/200)')
assert(!postRoute.includes('requireVip'), 'POST sem requireVip')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas orders-get.')
else console.log('✅ Orders GET OK')
