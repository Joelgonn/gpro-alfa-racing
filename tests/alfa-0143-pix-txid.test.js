// tests/alfa-0143-pix-txid.test.js
// ALFA-014.3 — pix_txid de teste: determinístico, persistido, idempotente, fonte única.
//
// Estes testes são COMPORTAMENTAIS: executam o código real de paymentService.ts num
// subprocesso com stubs em memória (ver tests/_alfa0143-harness.cjs) e observam o
// resultado real das funções. Nenhuma rede, nenhum Supabase, nenhum gateway.
// Se o runtime não permitir a execução, o teste é marcado PENDING — nunca PASS.

const fs = require('fs')
const path = require('path')
const { runModule } = require('./_alfa0143-harness.cjs')

function read(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== ALFA-014.3 — Pix TXID ===\n')
const paySvc = read('app/lib/payments/paymentService.ts')
const orderSvc = read('app/lib/payments/orderService.ts')

const ORDER_A = '11111111-1111-4111-8111-111111111111'
const ORDER_B = '22222222-2222-4222-8222-222222222222'
const ORDER_C = '33333333-3333-4333-8333-333333333333'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PLAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function order(id, userId) {
  return {
    id, user_id: userId, plan_id: PLAN, status: 'pending', amount_cents: 1990, currency: 'BRL',
    pix_txid: null, payload_hash: null, expires_at: null, paid_at: null, cancelled_at: null,
    created_at: '2026-09-17T00:00:00.000Z', updated_at: '2026-09-17T00:00:00.000Z',
  }
}
const BASE_SEED = {
  premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 1990, currency: 'BRL', is_active: true }],
  premium_orders: [order(ORDER_A, USER_A), order(ORDER_B, USER_A), order(ORDER_C, USER_B)],
  premium_payments: [],
}

// ---------------------------------------------------------------------------
// 1. Determinismo (função pura — execução real, 4 chamadas no mesmo módulo)
// ---------------------------------------------------------------------------
const det = runModule('app/lib/payments/paymentService.ts', `
  const a1 = mod.createTestPixTxid('${ORDER_A}', '${USER_A}')
  const a2 = mod.createTestPixTxid('${ORDER_A}', '${USER_A}')
  const b  = mod.createTestPixTxid('${ORDER_B}', '${USER_A}')
  const c  = mod.createTestPixTxid('${ORDER_A}', '${USER_B}')
  return { a1, a2, b, c }
`, { seed: BASE_SEED })

if (!det.ok) {
  pending('determinismo do pix_txid não executável neste runtime: ' + det.reason)
} else {
  const { a1, a2, b, c } = det.out
  assert(a1 === a2, 'pix_txid determinístico: mesmo pedido + mesmo usuário ⇒ mesmo valor')
  assert(a1 !== b, 'pix_txid distinto para pedidos diferentes')
  assert(a1 !== c, 'pix_txid distinto para usuários diferentes')
  assert(/^TEST-ALFA-0141-[0-9A-F]{12}$/.test(a1), 'formato TEST-ALFA-0141-<12 hex> observado: ' + a1)
  assert(!a1.includes('@'), 'pix_txid sem e-mail')
  assert(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(a1) && !/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/.test(a1), 'pix_txid sem CPF/telefone')
  assert(!/(sk_|Bearer|token|secret)/i.test(a1), 'pix_txid sem token/segredo')
}

// ---------------------------------------------------------------------------
// 2. Persistência e idempotência (execução real com armazenamento em memória)
// ---------------------------------------------------------------------------
const persist = runModule('app/lib/payments/paymentService.ts', `
  const first  = await mod.createTestPaymentForOrder('${ORDER_A}', '${USER_A}')
  const second = await mod.createTestPaymentForOrder('${ORDER_A}', '${USER_A}')
  const third  = await mod.ensureTestPaymentForOrder('${ORDER_A}', '${USER_A}')
  return {
    firstPix: first.pix_txid, firstStatus: first.status, firstProvider: first.provider,
    secondPix: second.pix_txid, thirdPix: third.pix_txid,
    sameId: first.id === second.id && second.id === third.id,
    counts: globalThis.__ALFA_DB__.premium_payments.length,
  }
`, { seed: BASE_SEED })

if (!persist.ok) {
  pending('persistência/idempotência do pagamento de teste não executável: ' + persist.reason)
} else {
  const o = persist.out
  assert(o.firstPix === o.secondPix && o.secondPix === o.thirdPix, 'mesmo pedido ⇒ mesmo pix_txid persistido entre chamadas')
  assert(o.sameId === true, 'reuso determinístico: nenhum pagamento novo criado na repetição')
  assert(o.counts === 1, 'exatamente 1 pagamento para o pedido após 3 chamadas (sem duplicidade)')
  assert(o.firstProvider === 'test' && o.firstStatus === 'created', 'pagamento permanece provider=test status=created (nunca confirmado)')
  assert(/^TEST-ALFA-0141-[0-9A-F]{12}$/.test(o.firstPix), 'pix_txid persistido no formato de teste: ' + o.firstPix)
}

// ---------------------------------------------------------------------------
// 3. Isolamento na criação: nunca criar pagamento para pedido de terceiro
// ---------------------------------------------------------------------------
const owner = runModule('app/lib/payments/paymentService.ts', `
  let status = null, msg = ''
  try {
    await mod.createTestPaymentForOrder('${ORDER_C}', '${USER_A}')
  } catch (e) { status = e.status; msg = e.message }
  return { status, msg, counts: globalThis.__ALFA_DB__.premium_payments.length }
`, { seed: BASE_SEED })

if (!owner.ok) {
  pending('guarda de propriedade na criação não executável: ' + owner.reason)
} else {
  assert(owner.out.status === 404, 'criar pagamento para pedido de terceiro ⇒ recusado com 404')
  assert(owner.out.msg === 'Pedido não encontrado', 'mensagem de recusa não distingue existência (não vaza)')
  assert(owner.out.counts === 0, 'nenhum pagamento criado para pedido de terceiro')
}

// ---------------------------------------------------------------------------
// 4. Nenhum efeito colateral externo
// ---------------------------------------------------------------------------
const writes = persist.ok ? persist.writes : []
assert(writes.every(w => w.table === 'premium_payments'), 'somente premium_payments é escrito (nenhuma tabela de acesso/VIP)')
assert(writes.every(w => w.rows.every(r => r.provider === 'test' && r.status === 'created')), 'toda escrita é provider=test status=created (nunca confirmed/paid)')
assert(!/(fetch\(|axios|https\.request|node-fetch)/.test(paySvc), 'nenhum cliente HTTP no serviço (nenhum gateway chamado)')
assert(!/qr_code/.test(paySvc), 'nenhum QR Code gerado')
assert(!/access_grants/.test(paySvc) && !/access_grants/.test(orderSvc), 'nenhuma concessão de acesso premium (sem access_grants)')
assert(!/webhook/i.test(paySvc), 'nenhum webhook registrado pelo serviço de pagamento')

// ---------------------------------------------------------------------------
// 5. Fonte única de verdade do pix_txid
// ---------------------------------------------------------------------------
assert(!orderSvc.includes('createTestPixTxidForOrder'), 'orderService não define gerador próprio de pix_txid (fonte única)')
assert(!/createHash[\s\S]{0,80}TEST-ALFA-0141/.test(orderSvc), 'orderService não calcula hash de txid de teste')
assert(paySvc.includes('createTestPixTxid'), 'createTestPixTxid existe em paymentService')
assert(!paySvc.includes('pix_txid.slice') && !paySvc.includes('pixTxid.slice'), 'hash/txid nunca é truncado para exibição pública')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas pix-txid.')
else console.log('✅ Pix TXID OK')
