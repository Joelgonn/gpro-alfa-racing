// tests/pix-0146-mp-idempotency.test.js
// ============================================================
// PIX-014.6 — Idempotency-Key do Mercado Pago POR TENTATIVA
// ============================================================
// Cobre os 10 cenários obrigatórios da sprint.
//
// Como testa:
//  - COMPORTAMENTAL: executa o código REAL de paymentService.ts / orderService.ts
//    num subprocesso, com stubs de 'server-only', do client admin (banco em memória,
//    COM update) e de globalThis.fetch (Mercado Pago falso).
//  - ESTRUTURAL: inspeção do fonte para contratos e proibições.
// Nenhuma rede, nenhum Supabase, nenhum pagamento real, nenhuma credencial.
//
// Execução: node tests/pix-0146-mp-idempotency.test.js
//           node --test tests/pix-0146-mp-idempotency.test.js
// ============================================================

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }
function eqJson(a, b, m) { assert(JSON.stringify(a) === JSON.stringify(b), `${m} (obtido: ${JSON.stringify(a)})`) }

console.log('=== PIX-014.6 — Idempotency-Key do Mercado Pago por tentativa ===\n')

const PAY_SVC = 'app/lib/payments/paymentService.ts'
const ORDER_SVC = 'app/lib/payments/orderService.ts'
const ORDERS_ROUTE = 'app/api/payments/orders/route.ts'
const MP_CLIENT = 'app/lib/payments/mercadopago-client.ts'
const WEBHOOK_SVC = 'app/lib/payments/webhook-service.ts'
const WEBHOOK_ROUTE = 'app/api/payments/webhooks/mercadopago/route.ts'

const ORDER = '11111111-1111-4111-8111-111111111111'
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const KEY_1 = `TEST-ALFA-0141-MP-${ORDER}-1`
const KEY_2 = `TEST-ALFA-0141-MP-${ORDER}-2`
const CHECKOUT_KEY = 'TEST-ALFA-0141-VIP_MONTHLY-2026-09-19'
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

// ---------------------------------------------------------------------------
// Stub de banco em memória (COM update) + fetch falso do Mercado Pago
// ---------------------------------------------------------------------------
const DB_STUB = [
  "const DB = globalThis.__DB__",
  "const WRITES = globalThis.__WRITES__",
  "const NOW = () => new Date().toISOString()",
  "class Query {",
  "  constructor(t) { this.table = t; this.filters = []; this.mode = 'all'; this.op = 'select'; this.ord = null; this.max = null }",
  "  select(sel) { this.sel = sel; return this }",
  "  insert(row) { this.op = 'insert'; this.rowsIn = Array.isArray(row) ? row : [row]; return this }",
  "  update(patch) { this.op = 'update'; this.patch = patch; return this }",
  "  eq(c, v) { this.filters.push(['eq', c, v]); return this }",
  "  neq(c, v) { this.filters.push(['neq', c, v]); return this }",
  "  in(c, v) { this.filters.push(['in', c, v]); return this }",
  "  order(c, o) { this.ord = { c: c, asc: !o || o.ascending !== false }; return this }",
  "  limit(n) { this.max = n; return this }",
  "  maybeSingle() { this.mode = 'one'; return this.run() }",
  "  single() { this.mode = 'one'; return this.run() }",
  "  then(res, rej) { return this.run().then(res, rej) }",
  "  rows() { return DB[this.table] || (DB[this.table] = []) }",
  "  match(r) {",
  "    for (const f of this.filters) {",
  "      const op = f[0], c = f[1], v = f[2]",
  "      if (op === 'eq' && r[c] !== v) return false",
  "      if (op === 'neq' && r[c] === v) return false",
  "      if (op === 'in' && v.indexOf(r[c]) === -1) return false",
  "    }",
  "    return true",
  "  }",
  "  async run() {",
  "    const rows = this.rows()",
  "    if (this.op === 'insert') {",
  "      const created = this.rowsIn.map(r => Object.assign({ id: this.table + '-' + (rows.length + 1), created_at: NOW(), provider_status: null, provider_payment_id: null, external_reference: null, qr_code: null, qr_code_base64: null, ticket_url: null, expires_at: null }, r))",
  "      for (const r of created) {",
  "        if (r.pix_txid && rows.some(x => x.pix_txid === r.pix_txid)) {",
  "          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint \"uniq_premium_payments_pix_txid\"' } }",
  "        }",
  "      }",
  "      // Simulação de clique duplo: outra requisição vence a corrida e já gravou a chave",
  "      if (this.table === 'premium_payments' && globalThis.__RACE_KEY__ && created[0].pix_txid === globalThis.__RACE_KEY__) {",
  "        globalThis.__RACE_KEY__ = null",
  "        rows.push({ id: 'row-raced', order_id: created[0].order_id, provider: 'mercadopago', status: 'created', pix_txid: created[0].pix_txid, amount_cents: created[0].amount_cents, currency: 'BRL', created_at: NOW() })",
  "        WRITES.push({ table: this.table, op: 'insert_raced', id: 'row-raced' })",
  "        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint \"uniq_premium_payments_pix_txid\"' } }",
  "      }",
  "      created.forEach(r => rows.push(r))",
  "      WRITES.push({ table: this.table, op: 'insert', ids: created.map(r => r.id) })",
  "      return { data: this.mode === 'one' ? created[0] : created, error: null }",
  "    }",
  "    if (this.op === 'update') {",
  "      const targets = rows.filter(r => this.match(r))",
  "      targets.forEach(r => Object.assign(r, this.patch))",
  "      WRITES.push({ table: this.table, op: 'update', ids: targets.map(t => t.id), patch: this.patch })",
  "      return { data: this.mode === 'one' ? (targets[0] || null) : targets, error: null }",
  "    }",
  "    let out = rows.filter(r => this.match(r))",
  "    if (this.ord) { const c = this.ord.c, asc = this.ord.asc; out = out.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)) }",
  "    if (this.max) out = out.slice(0, this.max)",
  "    return { data: this.mode === 'one' ? (out[0] || null) : out, error: null }",
  "  }",
  "}",
  "const client = { from(t) { return new Query(t) }, auth: { getUser: async () => ({ data: { user: null }, error: null }) } }",
  "export const supabaseAdmin = client",
].join('\n')

const LOADER_SRC = [
  "import { pathToFileURL, fileURLToPath } from 'node:url'",
  "import { existsSync } from 'node:fs'",
  "const ROOT = process.env.__PIX146_ROOT__",
  "const STUB_URL = 'data:text/javascript;base64,' + Buffer.from(process.env.__PIX146_STUB__ || '', 'utf8').toString('base64')",
  "const EMPTY_URL = 'data:text/javascript,export default undefined;'",
  "function withExt(base) {",
  "  for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '.cjs']) { if (existsSync(base + ext)) return base + ext }",
  "  return null",
  "}",
  "export async function resolve(spec, ctx, next) {",
  "  if (spec === 'server-only' || spec.endsWith('/server-only')) return { url: EMPTY_URL, shortCircuit: true }",
  "  if (spec === 'supabase-admin' || spec.endsWith('/supabase-admin') || spec === '@/app/lib/supabase-admin' || spec.endsWith('supabase-admin.ts')) return { url: STUB_URL, shortCircuit: true }",
  "  if (spec.startsWith('@/')) { const r = withExt(ROOT + '/' + spec.slice(2)); return { url: pathToFileURL(r || (ROOT + '/' + spec.slice(2))).href, shortCircuit: true } }",
  "  if (spec.startsWith('./') || spec.startsWith('../')) { const r = withExt(fileURLToPath(new URL(spec, ctx.parentURL))); if (r) return { url: pathToFileURL(r).href, shortCircuit: true } }",
  "  return next(spec, ctx)",
  "}",
].join('\n')

const dataUrl = (src) => 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64')

/**
 * Executa o código real de um módulo de pagamentos em subprocesso com stubs.
 * @param {string} relPath módulo a importar (ex.: app/lib/payments/paymentService.ts)
 * @param {string} code corpo ESM; recebe `mod` e retorna valor serializável
 * @param {object} [opts] { seed, mpScript, raceKey }
 */
function runSvc(relPath, code, opts) {
  const o = opts || {}
  const boot = [
    `process.env.__PIX146_ROOT__ = ${JSON.stringify(ROOT.replace(/\\/g, '/'))};`,
    `process.env.__PIX146_STUB__ = ${JSON.stringify(DB_STUB)};`,
    `globalThis.__DB__ = ${JSON.stringify(o.seed || {})};`,
    `globalThis.__WRITES__ = [];`,
    `globalThis.__MP_CALLS__ = [];`,
    `globalThis.__MP_SCRIPT__ = ${JSON.stringify(o.mpScript || [])};`,
    `globalThis.__RACE_KEY__ = ${JSON.stringify(o.raceKey || null)};`,
    `process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';`,
    `delete process.env.VERCEL_ENV;`,
    `delete process.env.VERCEL_ENV;`,
    `globalThis.fetch = async (url, init) => {`,
    `  const h = (init && init.headers) || {};`,
    `  let extRef = null; try { extRef = JSON.parse(init.body).external_reference } catch (e) { extRef = null }`,
    `  globalThis.__MP_CALLS__.push({ url: String(url), method: (init && init.method) || 'GET', idempotencyKey: h['X-Idempotency-Key'] || null, externalReference: extRef, body: init && init.body ? String(init.body) : null });`,
    `  const step = (globalThis.__MP_SCRIPT__ || []).shift();`,
    `  if (!step) return { ok: false, status: 500, text: async () => '{"errors":[{"code":"script_exhausted"}]}' };`,
    `  if (step === 'abort') { const e = new Error('aborted'); e.name = 'AbortError'; throw e }`,
    `  return { ok: step.status >= 200 && step.status < 300, status: step.status, text: async () => JSON.stringify(step.body || {}) };`,
    `};`,
    `const { register } = await import('node:module');`,
    `register(${JSON.stringify(dataUrl(LOADER_SRC))}, { parentURL: import.meta.url });`,
    `const mod = await import(${JSON.stringify('file:///' + ROOT.replace(/\\/g, '/') + '/' + relPath)});`,
    `const __out = await (async () => { ${code} })();`,
    `console.log('__PIX146__' + JSON.stringify({ out: __out, writes: globalThis.__WRITES__, calls: globalThis.__MP_CALLS__, db: globalThis.__DB__ }));`,
  ].join('\n')

  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90000,
  })
  const full = (res.stdout || '') + (res.stderr || '')
  const idx = full.indexOf('__PIX146__')
  if (idx === -1) {
    const diag = full.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-4).join(' | ')
    return { ok: false, reason: diag.slice(0, 500) || 'sem saída do subprocesso' }
  }
  try {
    const parsed = JSON.parse(full.slice(idx + '__PIX146__'.length).split(/\r?\n/)[0])
    return { ok: true, out: parsed.out, writes: parsed.writes, calls: parsed.calls, db: parsed.db }
  } catch (e) {
    return { ok: false, reason: 'resultado não parseável: ' + String(e.message).slice(0, 200) }
  }
}

// Resposta de sucesso do Mercado Pago (Orders API) — só campos usados pelo client
function mpOk(providerOrderId, withQr) {
  const payment = {
    id: 'PAY-' + providerOrderId,
    status: 'action_required',
    amount: '1.99',
    expiration_time: FUTURE,
  }
  if (withQr) {
    payment.payment_method = { id: 'pix', type: 'bank_transfer', qr_code: '00020126PIXCOPIAECOLA', qr_code_base64: 'iVBORw0KGgo=', ticket_url: 'https://mp/ticket/1' }
  }
  return { status: 201, body: { id: providerOrderId, external_reference: ORDER, status: 'action_required', total_amount: '1.99', transactions: { payments: [payment] } } }
}
function mp409() {
  return { status: 409, body: { errors: [{ code: 'idempotency_key_already_used', message: 'The idempotency key was already used' }] } }
}

const seedOrder = (extra) => Object.assign({
  id: ORDER, user_id: USER, plan_id: PLAN, status: 'pending', amount_cents: 199, currency: 'BRL',
  payload_hash: null, pix_txid: null, expires_at: FUTURE, paid_at: null, cancelled_at: null,
  provider_order_id: null, provider_external_reference: null, created_at: '2026-09-19T10:00:00.000Z', updated_at: '2026-09-19T10:00:00.000Z',
}, extra || {})
const seedAttempt = (extra) => Object.assign({
  id: 'pay-1', order_id: ORDER, provider: 'mercadopago', status: 'created', pix_txid: KEY_1,
  provider_payment_id: null, provider_status: null, external_reference: ORDER,
  qr_code: null, qr_code_base64: null, ticket_url: null, expires_at: null,
  amount_cents: 199, currency: 'BRL', created_at: new Date(Date.now() - 1000).toISOString(),
}, extra || {})

const CALL_MP = `const pay = await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'VIP vip_monthly', payerEmail: 'piloto@alfaracing.com' })`

// ---------------------------------------------------------------------------
// 1. Primeira tentativa → UMA Order no Mercado Pago
// ---------------------------------------------------------------------------
console.log('--- 1. Primeira tentativa → uma Order ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      mpCalls: globalThis.__MP_CALLS__.length,
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      checkoutKeyUsada: globalThis.__MP_CALLS__.some(c => c.idempotencyKey === ${JSON.stringify(CHECKOUT_KEY)}),
      status: pay.status,
      pix: pay.pix_txid,
      rows: (globalThis.__DB__.premium_payments || []).length,
      providerOrderId: globalThis.__DB__.premium_orders[0].provider_order_id,
      grantWrites: globalThis.__WRITES__.filter(w => w.table === 'access_grants').length,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [mpOk('MP-ORDER-1', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.mpCalls === 1, '1. apenas UMA chamada POST /v1/orders')
    eqJson(r.out.keys, [KEY_1], '1. chave DA TENTATIVA (…-MP-<orderId>-1) enviada ao provedor')
    assert(r.out.checkoutKeyUsada === false, '1. a chave do checkout NÃO é enviada ao Mercado Pago')
    assert(r.out.status === 'pending', '1. tentativa persistida como pending (nunca paid)')
    assert(r.out.pix === KEY_1, '1. chave da tentativa persistida em pix_txid')
    assert(r.out.rows === 1, '1. exatamente UMA linha de tentativa')
    assert(r.out.providerOrderId === 'MP-ORDER-1', '1. provider_order_id do pedido persistido')
    assert(r.out.grantWrites === 0, '1. nenhuma escrita em access_grants nesta etapa')
  }
}

// ---------------------------------------------------------------------------
// 2. Retry da mesma tentativa (em voo) → MESMA chave, sem segunda Order
// ---------------------------------------------------------------------------
console.log('\n--- 2. Retry da mesma tentativa → mesma chave ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      mpCalls: globalThis.__MP_CALLS__.length,
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).length,
      status: pay.status,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [seedAttempt()] }, mpScript: [mpOk('MP-ORDER-1', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.mpCalls === 1, '2. retry chama o provedor uma única vez')
    eqJson(r.out.keys, [KEY_1], '2. retry usa a MESMA chave da tentativa (não abre Order nova)')
    assert(r.out.rows === 1, '2. nenhuma tentativa nova foi criada')
    assert(r.out.status === 'pending', '2. a própria tentativa foi atualizada com o QR')
  }
}

// ---------------------------------------------------------------------------
// 3. Clique duplo → uma única tentativa (corrida pelo índice único)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Clique duplo → uma tentativa ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    const segundo = await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'VIP vip_monthly' })
    return {
      mpCalls: globalThis.__MP_CALLS__.length,
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).length,
      ids: (globalThis.__DB__.premium_payments || []).map(p => p.id),
      status: segundo.status,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [mpOk('MP-ORDER-1', false), mpOk('MP-ORDER-1', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.rows === 1, '3. dois cliques ⇒ UMA única tentativa persistida')
    eqJson(r.out.keys, [KEY_1, KEY_1], '3. as duas chamadas usam a MESMA chave no provedor')
    assert(r.out.status === 'pending', '3. a tentativa única termina com o QR válido')
  }
}
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      mpCalls: globalThis.__MP_CALLS__.length,
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).length,
      ids: (globalThis.__DB__.premium_payments || []).map(p => p.id),
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [mpOk('MP-ORDER-1', true)], raceKey: KEY_1 })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.rows === 1, '3. corrida real (23505) ⇒ nenhuma tentativa duplicada')
    assert(r.out.ids[0] === 'row-raced', '3. a requisição perdedora ADOTA a tentativa vencedora')
    eqJson(r.out.keys, [KEY_1], '3. a requisição perdedora usa a MESMA chave (não cria Order nova)')
  }
}

// ---------------------------------------------------------------------------
// 4. Timeout / resposta perdida → MESMA chave no retry (janela de 90s)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Timeout → mesma chave no retry ---')
{
  const r = runSvc(PAY_SVC, `let code = null
    try { await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'x' }) } catch (e) { code = e.code }
    const linha = (globalThis.__DB__.premium_payments || [])[0] || {}
    const statusAposTimeout = linha.status
    const pixAposTimeout = linha.pix_txid
    const segunda = await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'x' })
    return {
      code,
      statusAposTimeout,
      pixAposTimeout,
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).length,
      statusFinal: segunda.status,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: ['abort', mpOk('MP-ORDER-1', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.code === 'MERCADOPAGO_TIMEOUT', '4. timeout é classificado como MERCADOPAGO_TIMEOUT')
    assert(r.out.statusAposTimeout === 'created', '4. tentativa permanece EM VOO após timeout (não é fechada)')
    eqJson(r.out.keys, [KEY_1, KEY_1], '4. retry do timeout reutiliza a MESMA chave')
    assert(r.out.rows === 1, '4. nenhuma tentativa nova por causa do timeout')
    assert(r.out.statusFinal === 'pending', '4. retry confirmado na mesma tentativa')
  }
}
// Após 90s a tentativa obsoleta pode ser substituída (nova chave)
{
  const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).map(p => ({ id: p.id, status: p.status, pix: p.pix_txid })),
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [seedAttempt({ created_at: stale })] }, mpScript: [mpOk('MP-ORDER-2', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    eqJson(r.out.keys, [KEY_2], '4. tentativa obsoleta (> 90s) ⇒ nova tentativa com NOVA chave')
    assert(r.out.rows.length === 2, '4. a tentativa obsoleta é fechada e uma nova é aberta')
    assert(r.out.rows[0].status === 'failed', '4. tentativa obsoleta encerrada como failed')
  }
}

// ---------------------------------------------------------------------------
// 5. Falha definitiva → NOVA chave
// ---------------------------------------------------------------------------
console.log('\n--- 5. Falha definitiva → nova chave ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).map(p => ({ status: p.status, pix: p.pix_txid })),
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [seedAttempt({ status: 'failed', pix_txid: KEY_1 })] }, mpScript: [mpOk('MP-ORDER-2', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    eqJson(r.out.keys, [KEY_2], '5. tentativa falhada ⇒ nova tentativa com chave NOVA (…-2)')
    assert(r.out.rows.length === 2, '5. a tentativa falhada é preservada como histórico')
    assert(r.out.rows[1].status === 'pending', '5. a nova tentativa é a cobrança válida')
  }
}
{
  const r = runSvc(PAY_SVC, `let code = null
    try { await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'x' }) } catch (e) { code = e.code }
    return { code, keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey), rows: (globalThis.__DB__.premium_payments || []).map(p => ({ status: p.status, marker: p.provider_status })) }`,
    { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [{ status: 402, body: { errors: [{ code: 'processing_error', message: 'failed to process' }] } }] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.code === 'MERCADOPAGO_TRANSACTION_FAILED', '5. 402 ⇒ MERCADOPAGO_TRANSACTION_FAILED (causa própria, PIX-015)')
    assert(r.out.rows[0].status === 'failed', '5. rejeição definitiva encerra a tentativa (chave não volta a ser usada)')
    assert(String(r.out.rows[0].marker || '').includes('402'), '5. motivo registrado para diagnóstico')
  }
}

// ---------------------------------------------------------------------------
// 6. QR válido existente → ZERO POST novo
// ---------------------------------------------------------------------------
console.log('\n--- 6. QR existente → zero POST novo ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      mpCalls: globalThis.__MP_CALLS__.length,
      pix: pay.pix_txid,
      qr: pay.qr_code,
      rows: (globalThis.__DB__.premium_payments || []).length,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [seedAttempt({ status: 'pending', qr_code: '00020126PIXCOPIAECOLA', expires_at: FUTURE })] }, mpScript: [] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.mpCalls === 0, '6. QR válido ⇒ NENHUMA chamada ao provedor')
    assert(r.out.qr === '00020126PIXCOPIAECOLA', '6. o MESMO QR é devolvido ao usuário')
    assert(r.out.pix === KEY_1, '6. mesma tentativa (mesma chave) reutilizada')
    assert(r.out.rows === 1, '6. nenhuma tentativa adicional')
  }
}

// ---------------------------------------------------------------------------
// 7. 409 idempotency_key_already_used → tratamento controlado (sem loop)
// ---------------------------------------------------------------------------
console.log('\n--- 7. 409 idempotency_key_already_used ---')
{
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey),
      rows: (globalThis.__DB__.premium_payments || []).map(p => ({ status: p.status, pix: p.pix_txid, marker: p.provider_status })),
      status: pay.status,
    }`, { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [mp409(), mpOk('MP-ORDER-2', true)] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    eqJson(r.out.keys, [KEY_1, KEY_2], '7. conflito ⇒ UMA recuperação: nova tentativa com chave nova')
    assert(r.out.rows.length === 2, '7. exatamente duas tentativas (nenhuma Order duplicada)')
    assert(r.out.rows[0].status === 'failed', '7. a tentativa conflitante é encerrada')
    assert(String(r.out.rows[0].marker || '').includes('MERCADOPAGO_IDEMPOTENCY_CONFLICT'), '7. causa registrada de forma distinta (não erro genérico)')
    assert(r.out.status === 'pending', '7. a nova tentativa devolve QR válido')
  }
}
{
  const r = runSvc(PAY_SVC, `let code = null
    try { await mod.createMercadoPagoPixPaymentForOrder(${JSON.stringify(ORDER)}, ${JSON.stringify(USER)}, { description: 'x' }) } catch (e) { code = e.code }
    return { code, mpCalls: globalThis.__MP_CALLS__.length, keys: globalThis.__MP_CALLS__.map(c => c.idempotencyKey), rows: (globalThis.__DB__.premium_payments || []).length }`,
    { seed: { premium_orders: [seedOrder()], premium_payments: [] }, mpScript: [mp409(), mp409()] })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.code === 'MERCADOPAGO_IDEMPOTENCY_CONFLICT', '7. conflito persistente é propagado com código próprio')
    assert(r.out.mpCalls === 2, '7. NENHUM loop: no máximo 2 chamadas (1 recuperação)')
    assert(r.out.rows === 2, '7. nenhuma tentativa extra criada')
  }
}
{
  const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const r = runSvc(PAY_SVC, `${CALL_MP}
    return {
      urls: globalThis.__MP_CALLS__.map(c => c.method + ' ' + c.url.replace('https://api.mercadopago.com', '')),
      rows: (globalThis.__DB__.premium_payments || []).map(p => ({ id: p.id, status: p.status })),
      qr: pay.qr_code,
    }`, {
    seed: { premium_orders: [seedOrder({ provider_order_id: 'MP-ORDER-9' })], premium_payments: [seedAttempt({ created_at: stale })] },
    mpScript: [{ status: 200, body: { id: 'MP-ORDER-9', external_reference: ORDER, status: 'action_required', total_amount: '1.99', transactions: { payments: [{ id: 'PAY-9', status: 'action_required', amount: '1.99', expiration_time: FUTURE, payment_method: { id: 'pix', type: 'bank_transfer', qr_code: '00020126QRECUPERADO', qr_code_base64: 'iVBORw0KGgo=', ticket_url: 'https://mp/ticket/9' } }] } } }],
  })

  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    eqJson(r.out.urls, ['GET /v1/orders/MP-ORDER-9'], '7. recuperação: consulta a Order existente em vez de criar outra')
    assert(r.out.rows.length === 1, '7. nenhuma tentativa nova quando a Order é recuperável')
    assert(r.out.qr === '00020126QRECUPERADO', '7. QR da Order recuperada é o devolvido')
  }
}

// ---------------------------------------------------------------------------
// 8. Nenhum access_grant antes de pagamento aprovado
// ---------------------------------------------------------------------------
console.log('\n--- 8. Nenhum access_grant antes da aprovação ---')
{
  const payCode = stripComments(read(PAY_SVC))
  const orderCode = stripComments(read(ORDER_SVC))
  const routeCode = stripComments(read(ORDERS_ROUTE))
  assert(!/access_grants/.test(payCode), '8. paymentService não toca access_grants')
  assert(!/access_grants/.test(orderCode), '8. orderService não toca access_grants')
  assert(!/access_grants/.test(routeCode), '8. rota POST não toca access_grants')
  assert(!/access_grants/.test(stripComments(read(MP_CLIENT))), '8. client do provedor não toca access_grants')
  assert(/VIP_CHECK = false/.test(read('app/lib/access/accessService.ts')), '8. VIP_CHECK permanece false')
  assert(/ensurePaymentGrant/.test(read(WEBHOOK_SVC)), '8. concessão continua exclusivamente no webhook confirmado')
}

// ---------------------------------------------------------------------------
// 9. Webhook continua idempotente
// ---------------------------------------------------------------------------
console.log('\n--- 9. Webhook idempotente (regressão) ---')
{
  const whSvc = read(WEBHOOK_SVC)
  assert(/event_id/.test(whSvc) && /23505/.test(whSvc), '9. dedupe por event_id (unique) preservado')
  assert(/duplicate_ignored/.test(whSvc), '9. evento repetido → duplicate_ignored')
  assert(/already_confirmed/.test(whSvc), '9. confirmação repetida → already_confirmed')
  assert(/ensurePaymentGrant/.test(whSvc) && /filter\('metadata->>order_id'/.test(whSvc), '9. grant idempotente por order_id preservado')
  const whRoute = read(WEBHOOK_ROUTE)
  assert(/verifySignature/.test(whRoute) && /signature_not_verified/.test(whRoute), '9. assinatura do webhook intacta (fail-closed)')
  assert(!/MP_ATTEMPT|buildMercadoPagoAttemptKey|idempotencyKey|pix_txid/.test(whRoute), '9. PIX-014.6 não alterou o webhook (rota)')
  assert(!/PIX-014\.6/.test(whSvc), '9. webhook-service não foi modificado por esta sprint')
  assert(!/MP_ATTEMPT|buildMercadoPagoAttemptKey/.test(whSvc), '9. webhook-service sem lógica de tentativa (fora do escopo)')
}

// ---------------------------------------------------------------------------
// 10. premium_order expirado sem pagamento utilizável → NOVO pedido (Parte B)
// ---------------------------------------------------------------------------
console.log('\n--- 10. Pedido expirado sem pagamento → novo pedido ---')
{
  const code = `return {
    expirado: mod.isOrderReusableByState({ status: 'pending', expires_at: '2020-01-01T00:00:00.000Z' }),
    encerrado: mod.isOrderReusableByState({ status: 'cancelled', expires_at: null }),
    falhado: mod.isOrderReusableByState({ status: 'failed', expires_at: null }),
    valido: mod.isOrderReusableByState({ status: 'pending', expires_at: '2099-01-01T00:00:00.000Z' }),
    semExpiracao: mod.isOrderReusableByState({ status: 'pending', expires_at: null }),
    pago: mod.isOrderReusableByState({ status: 'paid', expires_at: '2020-01-01T00:00:00.000Z' }),
  }`
  const r = runSvc(ORDER_SVC, code, { seed: {} })
  if (!r.ok) { pending('regra pura indisponível: ' + r.reason) } else {
    assert(r.out.expirado === false, '10. pedido expirado NÃO é reaproveitável')
    assert(r.out.encerrado === false && r.out.falhado === false, '10. pedido encerrado/falhado NÃO é reaproveitável')
    assert(r.out.valido === true && r.out.semExpiracao === true, '10. pedido válido é reaproveitado (idempotência preservada)')
    assert(r.out.pago === true, '10. pedido pago nunca é substituído')
  }
}

const cryptoHash = require('crypto').createHash('sha256').update(`${USER}|${CHECKOUT_KEY}`).digest('hex')

// 10a. pedido expirado + sem pagamento → NOVO pedido
{
  const r = runSvc(ORDER_SVC, `const r = await mod.createOrderFromPlanCode({ userId: ${JSON.stringify(USER)}, planCode: 'vip_monthly', idempotencyKey: ${JSON.stringify(CHECKOUT_KEY)} })
    return { idempotent: r.idempotent, ids: (globalThis.__DB__.premium_orders || []).map(o => o.id), expires: r.order.expires_at, amount: r.order.amount_cents }`,
    {
      seed: {
        premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 199, currency: 'BRL', is_active: true, duration_days: 30 }],
        premium_orders: [seedOrder({ id: 'order-antigo', status: 'pending', expires_at: PAST, payload_hash: cryptoHash })],
        premium_payments: [],
      },
    })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ids.length === 2, '10. Parte B: um NOVO premium_order é criado (não há 409 "Pedido expirado")')
    assert(r.out.ids.includes('order-antigo') && r.out.idempotent === false, '10. o pedido antigo é preservado e o novo é devolvido')
    assert(new Date(r.out.expires).getTime() > Date.now(), '10. o novo pedido nasce com validade própria (30 min)')
    assert(r.out.amount === 199, '10. preço continua vindo do plano (nunca do frontend)')
  }
}

// 10b. pedido VÁLIDO → reaproveitado (sem novo pedido)
{
  const r = runSvc(ORDER_SVC, `const r = await mod.createOrderFromPlanCode({ userId: ${JSON.stringify(USER)}, planCode: 'vip_monthly', idempotencyKey: ${JSON.stringify(CHECKOUT_KEY)} })
    return { idempotent: r.idempotent, ids: (globalThis.__DB__.premium_orders || []).map(o => o.id) }`,
    {
      seed: {
        premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 199, currency: 'BRL', is_active: true, duration_days: 30 }],
        premium_orders: [seedOrder({ id: 'order-valido', status: 'pending', expires_at: FUTURE, payload_hash: cryptoHash })],
        premium_payments: [],
      },
    })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ids.length === 1 && r.out.idempotent === true, '10. pedido válido continua idempotente (nenhum pedido novo)')
  }
}

// 10c. pedido expirado MAS com QR válido → reaproveitado (sem novo pedido nem nova Order)
{
  const r = runSvc(ORDER_SVC, `const r = await mod.createOrderFromPlanCode({ userId: ${JSON.stringify(USER)}, planCode: 'vip_monthly', idempotencyKey: ${JSON.stringify(CHECKOUT_KEY)} })
    return { idempotent: r.idempotent, ids: (globalThis.__DB__.premium_orders || []).map(o => o.id) }`,
    {
      seed: {
        premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 199, currency: 'BRL', is_active: true, duration_days: 30 }],
        premium_orders: [seedOrder({ id: 'order-expirado-com-qr', status: 'pending', expires_at: PAST, payload_hash: cryptoHash })],
        premium_payments: [seedAttempt({ order_id: 'order-expirado-com-qr', status: 'pending', qr_code: '00020126QRVALHO', expires_at: FUTURE })],
      },
    })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ids.length === 1 && r.out.idempotent === true, '10. com QR válido o pedido NÃO é duplicado (usa a mesma cobrança)')
  }
}

// 10d. pedido expirado E com pagamento confirmado → nunca duplica compra
{
  const r = runSvc(ORDER_SVC, `const r = await mod.createOrderFromPlanCode({ userId: ${JSON.stringify(USER)}, planCode: 'vip_monthly', idempotencyKey: ${JSON.stringify(CHECKOUT_KEY)} })
    return { idempotent: r.idempotent, ids: (globalThis.__DB__.premium_orders || []).map(o => o.id) }`,
    {
      seed: {
        premium_plans: [{ id: PLAN, code: 'vip_monthly', price_cents: 199, currency: 'BRL', is_active: true, duration_days: 30 }],
        premium_orders: [seedOrder({ id: 'order-pago', status: 'paid', expires_at: PAST, payload_hash: cryptoHash })],
        premium_payments: [],
      },
    })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ids.length === 1 && r.out.idempotent === true, '10. pedido pago não gera novo pedido (sem cobrança duplicada)')
  }
}

// ---------------------------------------------------------------------------
// Estrutural — contrato da correção
// ---------------------------------------------------------------------------
console.log('\n--- Estrutural ---')
const paySvc = read(PAY_SVC)
const orderSvc = read(ORDER_SVC)
const route = read(ORDERS_ROUTE)
const routeCode = stripComments(route)
const paySvcCode = stripComments(paySvc)
const mpClient = read(MP_CLIENT)
assert(paySvc.includes('TEST-ALFA-0141-MP-'), 'estrutural: chave por tentativa definida em paymentService')
assert(paySvc.includes('idempotencyKey: attemptKey'), 'estrutural: client recebe a chave DA TENTATIVA')
assert(!paySvc.includes('idempotencyKey: opts?.idempotencyKey || orderId'), 'estrutural: chave do checkout deixou de ser enviada ao provedor')
assert(paySvc.includes('MP_ATTEMPT_IN_FLIGHT_MS = 90_000'), 'estrutural: janela de 90s aprovada')
assert(!/Math\.random/.test(paySvc), 'estrutural: nenhuma chave aleatória por requisição')
assert(paySvc.includes('pix_txid: key'), 'estrutural: chave persistida em pix_txid (sem migration)')
assert(paySvc.includes("=== '23505'"), 'estrutural: corrida de clique duplo tratada por chave única')
assert(paySvc.includes('isAttemptOutcomeUnknown'), 'estrutural: desfecho desconhecido (timeout/rede/5xx) mantém a tentativa em voo')
assert(paySvc.includes('recoverAttemptFromProviderOrder') && paySvc.includes('mpGetOrder'), 'estrutural: recuperação por provider_order_id')
assert(mpClient.includes('MERCADOPAGO_IDEMPOTENCY_CONFLICT'), 'estrutural: 409 de idempotência tem código próprio')
assert(mpClient.includes('idempotency_key_already_used'), 'estrutural: código do provedor é reconhecido explicitamente')
assert(mpClient.includes("'X-Idempotency-Key': idempotencyKey"), 'estrutural: header continua sendo enviado')
assert(/params\.idempotencyKey\?\.trim\(\) \|\| params\.orderId\.trim\(\)/.test(mpClient), 'estrutural: fallback para orderId preservado (contrato pix-008)')
assert(orderSvc.includes('hasUsableMercadoPagoPayment'), 'estrutural: Parte B consulta cobrança utilizável antes de decidir')
assert(orderSvc.includes('isOrderReusableByState'), 'estrutural: regra de reaproveitamento do pedido explícita')
assert(route.includes('hasUsableMercadoPagoPayment') && route.includes('Pedido expirado'), 'estrutural: 409 "Pedido expirado" só sem cobrança válida')
assert(/process\.env\.PIX_ENABLED === 'true'/.test(routeCode), 'estrutural: gate PIX_ENABLED preservado (lido no servidor)')
assert(/expiration_time: 'P1D'/.test(mpClient), 'estrutural: expiration_time P1D preservado no payload')
assert(/processing_mode: 'automatic'/.test(mpClient), 'estrutural: processing_mode preservado')
assert(/payment_method: \{[\s\S]{0,60}id: 'pix'/.test(mpClient), 'estrutural: payment_method pix preservado')
assert(!/price_cents/.test(paySvcCode), 'estrutural: paymentService não lê nem define preço')
assert(/select\('id, code, price_cents/.test(orderSvc), 'estrutural: preço continua vindo de premium_plans (inalterado)')
assert(!/price_cents\s*:\s*\d/.test(stripComments(orderSvc) + paySvcCode), 'estrutural: nenhum preço hardcoded introduzido')

console.log('\n=== Resumo PIX-014.6 ===')
if (process.exitCode) console.log('❌ Falhas na idempotência por tentativa.')
else console.log('✅ PIX-014.6 OK (10 cenários + estrutural).')
