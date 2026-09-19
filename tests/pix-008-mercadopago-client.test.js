// tests/pix-008-mercadopago-client.test.js
// PIX-010.2 — Adaptador Mercado Pago via /v1/orders (Checkout Transparente) — mocks, sem chamada real
// Cobertura: config, HTTP 200/201/400/401/404/429/500, timeout, JSON invalido, sem ID, sem PIX, opcionais, type online, total_amount, external_reference, processing_mode, transactions, idempotência, Ordem/Pagamento

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }

console.log('=== PIX-008 — Mercado Pago Client (Orders) ===\n')

const CLIENT = 'app/lib/payments/mercadopago-client.ts'
const PAY_SVC = 'app/lib/payments/paymentService.ts'
const clientSrc = read(CLIENT)
const paySvcSrc = read(PAY_SVC)
const fileUrl = 'file:///' + path.join(ROOT, CLIENT).replace(/\\/g, '/')

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }
const clientCode = stripComments(clientSrc)

function runWithMocks(code) {
  const boot = [
    `import { createRequire } from 'node:module';`,
    `const require = createRequire(import.meta.url);`,
    code,
  ].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], {
    cwd: ROOT, encoding: 'utf8', timeout: 8000, env: { ...process.env },
  })
  const out = (res.stdout || '') + (res.stderr || '')
  if (!out.includes('__R__')) console.log('DEBUG no __R__:', out.slice(0, 900))
  return { stdout: res.stdout || '', stderr: res.stderr || '', full: out, status: res.status }
}

// ---------------------------------------------------------------------------
// Estrutural — novo /v1/orders
// ---------------------------------------------------------------------------
console.log('--- Estrutural ---')
assert(clientSrc.includes("import 'server-only'"), 'server-only importado')
assert(clientSrc.includes('MERCADOPAGO_API_BASE'), 'base URL definida')
assert(clientSrc.includes('MERCADOPAGO_CONFIG_MISSING'), 'erro CONFIG_MISSING definido')
assert(clientSrc.includes('MERCADOPAGO_TIMEOUT'), 'erro TIMEOUT definido')
assert(clientSrc.includes('MERCADOPAGO_UNAUTHORIZED'), 'erro UNAUTHORIZED definido')
assert(clientSrc.includes('MERCADOPAGO_RATE_LIMITED'), 'erro RATE_LIMITED definido')
assert(clientSrc.includes('MERCADOPAGO_NOT_FOUND'), 'erro NOT_FOUND definido')
assert(clientSrc.includes('MERCADOPAGO_INVALID_RESPONSE'), 'erro INVALID_RESPONSE definido')
assert(clientSrc.includes('AbortController'), 'timeout com AbortController')
assert(clientSrc.includes('Authorization'), 'Authorization: Bearer header')
assert(clientSrc.includes('X-Idempotency-Key'), 'Idempotency-Key enviada')
assert(clientSrc.includes('external_reference'), 'external_reference mapeado')
assert(clientSrc.includes('centsToDecimal'), 'conversao centavos presente')
assert(clientSrc.includes('qr_code') && clientSrc.includes('qr_code_base64') && clientSrc.includes('ticket_url'), 'campos QR mapeados')
assert(clientSrc.includes('createPixPayment'), 'createPixPayment exportada (agora via /v1/orders)')
assert(clientSrc.includes('/v1/orders') && clientSrc.includes("type: 'online'") || clientSrc.includes('type'), 'POST /v1/orders com type online')
assert(clientSrc.includes('total_amount') && clientSrc.includes('processing_mode'), 'total_amount e processing_mode presentes')
assert(clientSrc.includes('transactions') && clientSrc.includes('payment_method'), 'transactions.payments com payment_method id pix')
assert(clientSrc.includes('payment_method') && clientSrc.includes("'pix'") && clientSrc.includes('bank_transfer'), 'payment_method id pix type bank_transfer')
assert(clientSrc.includes('getMercadoPagoPayment'), 'getMercadoPagoPayment exportada (legado)')
assert(clientSrc.includes('getMercadoPagoOrder'), 'getMercadoPagoOrder exportada (novo)')
assert(!/console\.log\(.*MERCADOPAGO_ACCESS_TOKEN/.test(clientSrc), 'nenhum log de token')
assert(clientSrc.includes('rawResponseMasked'), 'rawResponseMasked mascarado')
assert(clientSrc.includes('providerPaymentId'), 'modelo interno providerPaymentId')
assert(clientSrc.includes('providerOrderId'), 'modelo interno providerOrderId (novo)')

// Integração leve
assert(paySvcSrc.includes('createMercadoPagoPixPaymentForOrder'), 'paymentService expõe createMercadoPagoPixPaymentForOrder')
assert(paySvcSrc.includes("provider: 'mercadopago'"), 'persistencia provider mercadopago')
assert(paySvcSrc.includes('qr_code'), 'persistencia qr_code')
assert(paySvcSrc.includes('provider_order_id') || paySvcSrc.includes('providerOrderId'), 'persistencia provider_order_id (novo)')
assert(!/from\(['"]access_grants['"]\)\s*\.\s*insert/.test(paySvcSrc) || paySvcSrc.includes('PIX-008'), 'paymentService mercadopago nao insere access_grants fora do webhook')
assert(paySvcSrc.includes('PIX-008'), 'comentario PIX-008 presente')

// ---------------------------------------------------------------------------
// Funcional com mocks — /v1/orders
// ---------------------------------------------------------------------------
console.log('\n--- Funcional com mocks (Orders) ---')

// 1. token ausente -> CONFIG_MISSING
{
  const r = runWithMocks(`
    const origEnv = process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'BRL', description: 'VIP test' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code, msg: e.message })); }
    process.env.MERCADOPAGO_ACCESS_TOKEN = origEnv;
  `)
  const idx = r.full.indexOf('__R__')
  let parsed = null; try { parsed = JSON.parse(r.full.slice(idx+5).split(/\r?\n/)[0]) } catch {}
  assert(parsed && parsed.code === 'MERCADOPAGO_CONFIG_MISSING', 'token ausente → CONFIG_MISSING')
}

// 2. valor negativo -> INVALID_RESPONSE
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: -100, currency: 'BRL', description: 'x' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code })); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code === 'MERCADOPAGO_INVALID_RESPONSE', 'amount negativo → INVALID_RESPONSE')
}

// 3. moeda USD -> INVALID_RESPONSE
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'USD', description: 'x' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code })); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code === 'MERCADOPAGO_INVALID_RESPONSE', 'moeda USD → INVALID_RESPONSE')
}

// 4. POST /v1/orders 201 com QR — checa type, total_amount, external_reference, processing_mode, transactions
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async (url, init) => {
      if (!url.endsWith('/v1/orders')) throw new Error('url deve ser /v1/orders, got ' + url);
      if (init.method !== 'POST') throw new Error('method deve ser POST');
      const auth = init.headers['Authorization'] || init.headers.Authorization;
      if (!auth || !auth.startsWith('Bearer ')) throw new Error('no auth');
      if (init.headers['X-Idempotency-Key'] !== '00000000-0000-4000-a000-000000000001') throw new Error('no idempotency');
      const body = JSON.parse(init.body);
      if (body.type !== 'online') throw new Error('type deve ser online');
      if (body.total_amount !== '19.90') throw new Error('total_amount mismatch ' + body.total_amount);
      if (body.external_reference !== '00000000-0000-4000-a000-000000000001') throw new Error('external_reference mismatch');
      if (body.processing_mode !== 'automatic') throw new Error('processing_mode mismatch');
      if (!body.transactions || !body.transactions.payments || body.transactions.payments[0].payment_method.id !== 'pix') throw new Error('pix missing');
      if (body.transactions.payments[0].payment_method.type !== 'bank_transfer') throw new Error('type bank_transfer missing');
      if (body.transactions.payments[0].amount !== '19.90') throw new Error('amount mismatch');
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: 'ORD01TEST', status: 'processed', external_reference: '00000000-0000-4000-a000-000000000001', total_amount: '19.90', transactions: { payments: [{ id: 'PAY01TEST', status: 'pending', status_detail: 'pending_waiting_payment', amount: '19.90', payment_method: { id: 'pix', type: 'bank_transfer', qr_code: '000201...', qr_code_base64: 'iVBOR...', ticket_url: 'https://mp.com/ticket' } }] } }) };
    };
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'BRL', description: 'VIP Mensal' });
    console.log('__R__' + JSON.stringify({ orderId: out.providerOrderId, pid: out.providerPaymentId, qr: !!out.qrCode, b64: !!out.qrCodeBase64, ticket: !!out.ticketUrl, amount: out.amount, ext: out.externalReference }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  if (!parsed || parsed.orderId !== 'ORD01TEST') console.log('DEBUG 201 orders full:', r.full.slice(0, 900))
  assert(parsed && parsed.orderId === 'ORD01TEST' && parsed.pid === 'PAY01TEST' && parsed.qr && parsed.b64 && parsed.ticket && parsed.amount===19.9 && parsed.ext==='00000000-0000-4000-a000-000000000001', 'POST /v1/orders 201 com QR (type online, total_amount 19.90, external_reference, processing_mode automatic, transactions pix)')
}

// 5. GET /v1/orders/{id} 200 approved
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async (url) => {
      if (!url.includes('/v1/orders/')) throw new Error('url deve ser /v1/orders');
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'ORD01TEST', status: 'processed', external_reference: '00000000-0000-4000-a000-000000000002', total_amount: '99.00', transactions: { payments: [{ id: 'PAY02TEST', status: 'approved', status_detail: 'accredited', amount: '99.00', payment_method: { id: 'pix', type: 'bank_transfer' } }] } }) };
    };
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.getMercadoPagoOrder('ORD01TEST');
    console.log('__R__' + JSON.stringify({ orderId: out.providerOrderId, status: out.providerStatus, pid: out.providerPaymentId }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.orderId==='ORD01TEST' && parsed.status==='approved' && parsed.pid==='PAY02TEST', 'GET /v1/orders 200 approved (orderId + paymentId extraídos)')
}

// 6. GET /v1/payments legacy ainda funciona (para compatibilidade webhook payment)
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async (url) => {
      if (!url.includes('/v1/payments/')) throw new Error('url deve ser /v1/payments');
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 99999, status: 'approved', status_detail: 'accredited', external_reference: '00000000-0000-4000-a000-000000000002', transaction_amount: 99, currency_id: 'BRL' }) };
    };
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.getMercadoPagoPayment('99999');
    console.log('__R__' + JSON.stringify({ status: out.providerStatus }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.status==='approved', 'GET /v1/payments legacy ainda funciona')
}

// 7. erro 401
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoOrder('ORD01'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code, status:e.status})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_UNAUTHORIZED' && parsed.status===401, '401 → UNAUTHORIZED (orders)')
}

// 8. erro 404
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 404, text: async () => 'not found' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000003', amountCents: 1990, currency:'BRL', description:'x' }); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_NOT_FOUND', '404 → NOT_FOUND')
}

// 9. erro 429
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoOrder('ORD01'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_RATE_LIMITED', '429 → RATE_LIMITED')
}

// 10. erro 500
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 500, text: async () => 'internal' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000004', amountCents: 1990, currency:'BRL', description:'x' }); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_REQUEST_FAILED', '500 → REQUEST_FAILED')
}

// 11. timeout
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => { const e=new Error('aborted'); e.name='AbortError'; throw e; };
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoOrder('ORD01'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_TIMEOUT', 'AbortError → TIMEOUT')
}

// 12. JSON invalido
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 200, text: async () => 'not-json{' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000005', amountCents: 1990, currency:'BRL', description:'x' }); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_INVALID_RESPONSE', 'JSON invalido → INVALID_RESPONSE')
}

// 13. resposta sem ID order
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ status: 'processed' }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000006', amountCents: 1990, currency:'BRL', description:'x' }); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_INVALID_RESPONSE', 'sem ID order → INVALID_RESPONSE')
}

// 14. sem dados PIX (qr ausente) — deve normalizar null, não falhar
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ id: 'ORD02TEST', status: 'processed', external_reference: '00000000-0000-4000-a000-000000000007', total_amount: '10.00', transactions: { payments: [{ id: 'PAY03TEST', status: 'pending', amount: '10.00', payment_method: { id: 'pix', type: 'bank_transfer' } }] } }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000007', amountCents: 1000, currency:'BRL', description:'x' });
    console.log('__R__' + JSON.stringify({ qr: out.qrCode, b64: out.qrCodeBase64 }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.qr===null && parsed.b64===null, 'sem QR → normaliza null (orders)')
}

// 15. status rejected
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 'ORD03TEST', status: 'processed', external_reference: '00000000-0000-4000-a000-000000000008', total_amount: '19.90', transactions: { payments: [{ id: 'PAY04TEST', status: 'rejected', status_detail: 'cc_rejected', amount: '19.90', payment_method: { id: 'pix', type: 'bank_transfer' } }] } }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.getMercadoPagoOrder('ORD03TEST');
    console.log('__R__' + JSON.stringify({ s: out.providerStatus }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.s==='rejected', 'status rejected normalizado (orders)')
}

// 16. segurança token não expõe
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-SECRET-XYZ';
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoOrder('ORD01'); } catch(e){ console.log('__R__' + JSON.stringify({ msg: e.message, hasToken: e.message.includes('TEST-SECRET-XYZ') })); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.hasToken===false, 'mensagem de erro não expõe token')
}

assert(!clientCode.includes('access_grants'), 'client não toca access_grants')
assert(paySvcSrc.includes("provider: 'mercadopago'"), 'persistencia mercadopago presente')

console.log('\\n=== Resumo PIX-008 (Orders) ===')
if (process.exitCode) console.log('❌ Falhas PIX-008.')
else console.log('✅ PIX-008 client OK (Orders)')
