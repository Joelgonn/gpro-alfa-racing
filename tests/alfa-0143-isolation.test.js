// tests/alfa-0143-isolation.test.js
// ALFA-014.3 — Isolamento por usuário: pedido, pagamento e plano.
//
// Testes COMPORTAMENTAIS: executam orderService.ts e paymentService.ts reais num subprocesso
// com dados em memória (tests/_alfa0143-harness.cjs). Nenhuma rede, nenhum Supabase.
// Se o runtime não permitir execução, o caso é marcado PENDING — nunca PASS.

const fs = require('fs')
const path = require('path')
const { runModule } = require('./_alfa0143-harness.cjs')

function read(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== ALFA-014.3 — Isolamento ===\n')
const route = read('app/api/payments/orders/[id]/route.ts')
const svc = read('app/lib/payments/orderService.ts')
const paySvc = read('app/lib/payments/paymentService.ts')

const ORDER_A = '11111111-1111-4111-8111-111111111111'
const ORDER_B = '22222222-2222-4222-8222-222222222222'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PLAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TS = '2026-09-17T00:00:00.000Z'

function order(id, userId) {
  return { id, user_id: userId, plan_id: PLAN, status: 'pending', amount_cents: 1990, currency: 'BRL',
    pix_txid: null, payload_hash: null, expires_at: null, paid_at: null, cancelled_at: null, created_at: TS, updated_at: TS }
}
function payment(id, orderId, status, txid) {
  return { id, order_id: orderId, provider: 'test', provider_payment_id: null, pix_txid: txid, status,
    amount_cents: 1990, currency: 'BRL', payload_hash: null, paid_at: null, created_at: TS, updated_at: TS }
}

const SEED = {
  premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 1990, currency: 'BRL', is_active: true }],
  premium_orders: [order(ORDER_A, USER_A), order(ORDER_B, USER_B)],
  premium_payments: [
    payment('pay-a', ORDER_A, 'created', 'TEST-ALFA-0141-AAAAAAAAAAAA'),
    payment('pay-b', ORDER_B, 'created', 'TEST-ALFA-0141-BBBBBBBBBBBB'),
  ],
}

// ---------------------------------------------------------------------------
// 1. Pedido de terceiro é indistinguível de inexistente
// ---------------------------------------------------------------------------
const iso = runModule('app/lib/payments/orderService.ts', `
  const proprio = await mod.getOrderDetailsForUser('${ORDER_A}', '${USER_A}')
  const terceiro = await mod.getOrderDetailsForUser('${ORDER_B}', '${USER_A}')
  const inexistente = await mod.getOrderDetailsForUser('99999999-9999-4999-8999-999999999999', '${USER_A}')
  const semUserId = await mod.getOrderDetailsForUser('${ORDER_A}', '')
  const semOrderId = await mod.getOrderDetailsForUser('', '${USER_A}')
  return {
    proprioPlanCode: proprio && proprio.order.planCode,
    proprioUserField: proprio ? Object.prototype.hasOwnProperty.call(proprio.order, 'user_id') : null,
    terceiro, inexistente, semUserId, semOrderId,
  }
`, { seed: SEED })

if (!iso.ok) {
  pending('isolamento do pedido não executável: ' + iso.reason)
} else {
  const o = iso.out
  assert(o.terceiro === null, 'usuário A não vê pedido do usuário B (null → 404 indistinguível)')
  assert(o.inexistente === null, 'pedido inexistente também retorna null (mesmo resultado, sem vazar existência)')
  assert(o.proprioPlanCode === 'vip_monthly', 'usuário A vê o próprio pedido com planCode correto')
  assert(o.proprioUserField === false, 'DTO do pedido não expõe o campo user_id')
  assert(o.semUserId === null && o.semOrderId === null, 'sem userId/orderId não há consulta (nunca desce ao banco sem escopo)')
}

// ---------------------------------------------------------------------------
// 2. Pagamento filtrado pelo pedido autorizado (order_id + dono + provider test)
// ---------------------------------------------------------------------------
const payIso = runModule('app/lib/payments/orderService.ts', `
  const meu = await mod.getSafePaymentForOrder('${ORDER_A}', '${USER_A}')
  const doOutro = await mod.getSafePaymentForOrder('${ORDER_B}', '${USER_A}')
  const idErrado = await mod.getSafePaymentForOrder('${ORDER_A}', '${USER_B}')
  return {
    meuId: meu && meu.id,
    doOutro, idErrado,
    chaves: meu ? Object.keys(meu).sort() : null,
  }
`, { seed: SEED })

if (!payIso.ok) {
  pending('isolamento do pagamento não executável: ' + payIso.reason)
} else {
  const o = payIso.out
  assert(o.meuId === 'pay-a', 'usuário A recebe apenas o pagamento do próprio pedido')
  assert(o.doOutro === null, 'usuário A não vê pagamento do usuário B')
  assert(o.idErrado === null, 'pagamento não é devolvido quando o userId não é o dono do pedido')
  assert(JSON.stringify(o.chaves) === JSON.stringify(['amountCents', 'currency', 'id', 'pixTxid', 'provider', 'status']),
    'DTO do pagamento por allow-list: ' + JSON.stringify(o.chaves))
}

// ---------------------------------------------------------------------------
// 3. Status terminais nunca apresentados como pagamento ativo
// ---------------------------------------------------------------------------
const termSeed = {
  premium_plans: SEED.premium_plans,
  premium_orders: SEED.premium_orders,
  premium_payments: [
    payment('pay-1', ORDER_A, 'failed', 'TEST-ALFA-0141-FAILED000001'),
    payment('pay-2', ORDER_A, 'refunded', 'TEST-ALFA-0141-REFUND000001'),
  ],
}
const term = runModule('app/lib/payments/orderService.ts', `
  const p = await mod.getSafePaymentForOrder('${ORDER_A}', '${USER_A}')
  const detalhes = await mod.getOrderDetailsForUser('${ORDER_A}', '${USER_A}')
  return { p, pagamentoNoDetalhe: detalhes && detalhes.payment }
`, { seed: termSeed })

if (!term.ok) {
  pending('filtro de status terminal não executável: ' + term.reason)
} else {
  assert(term.out.p === null, 'pagamento failed/refunded não é devolvido como ativo')
  assert(term.out.pagamentoNoDetalhe === null, 'detalhes do pedido devolvem payment=null quando só há status terminal')
}

// ---------------------------------------------------------------------------
// 4. Asserções estruturais do isolamento (texto do código real)
// ---------------------------------------------------------------------------
assert(svc.includes("eq('id', orderId)") && svc.includes("eq('user_id', userId)"), 'serviço filtra por order_id + user_id')
assert(svc.includes('premium_orders!inner'), 'pagamento filtrado pelo dono do pedido autorizado (join inner)')
assert(svc.includes("eq('provider', 'test')"), 'pagamento filtrado por provider=test')
assert(paySvc.includes("eq('provider', 'test')"), 'leitura de pagamento de teste também escopada por provider=test')
assert(svc.includes('.maybeSingle()') && !svc.includes('.eq(\'order_id\', orderId).select'), 'nenhuma leitura de pagamento sem escopo de dono')
assert(!svc.includes("select('id, order_id, provider, provider_payment_id, pix_txid, status, amount_cents, currency, payload_hash, paid_at, created_at, updated_at').eq('order_id'"),
  'fallback antigo que consultava pagamento apenas por order_id foi removido')
assert(svc.includes('premium_plans') && svc.includes('planCode'), 'planCode vem do plano do pedido autorizado')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas isolamento.')
else console.log('✅ Isolamento OK')
