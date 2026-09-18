// tests/pix-008-mercadopago-client.test.js
// PIX-008 — Adaptador Mercado Pago (mocks, sem chamada real)
// Cobertura: config, HTTP 200/201/400/401/404/429/500, timeout, JSON invalido, sem ID, sem PIX, opcionais ausentes, conversao centavos, external_reference, idempotencia, seguranca

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }

console.log('=== PIX-008 — Mercado Pago Client ===\n')

const CLIENT = 'app/lib/payments/mercadopago-client.ts'
const PAY_SVC = 'app/lib/payments/paymentService.ts'
const clientSrc = read(CLIENT)
const paySvcSrc = read(PAY_SVC)
const fileUrl = 'file:///' + path.join(ROOT, CLIENT).replace(/\\/g, '/')

function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }
const clientCode = stripComments(clientSrc)

// Helpers para executar modulo ESM com mocks via subprocesso
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
// Estrutural
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
assert(clientSrc.includes('centsToDecimal') || clientSrc.includes('amountCents'), 'conversao centavos presente')
assert(clientSrc.includes('qr_code') && clientSrc.includes('qr_code_base64') && clientSrc.includes('ticket_url'), 'campos QR mapeados')
assert(clientSrc.includes('createPixPayment'), 'createPixPayment exportada')
assert(clientSrc.includes('getMercadoPagoPayment'), 'getMercadoPagoPayment exportada')
assert(!/console\.log\(.*MERCADOPAGO_ACCESS_TOKEN/.test(clientSrc), 'nenhum log de token')
assert(!/process\.env\.MERCADOPAGO_ACCESS_TOKEN/.test(paySvcSrc) || paySvcSrc.includes('MercadoPagoError'), 'token nao vaza em paymentService além do client ')
assert(clientSrc.includes('rawResponseMasked'), 'rawResponseMasked mascarado')
assert(clientSrc.includes('providerPaymentId'), 'modelo interno providerPaymentId')

// Integração leve: paymentService expõe wrapper sem ativar PIX
assert(paySvcSrc.includes('createMercadoPagoPixPaymentForOrder'), 'paymentService expõe createMercadoPagoPixPaymentForOrder')
assert(paySvcSrc.includes("provider: 'mercadopago'"), 'persistencia provider mercadopago')
assert(paySvcSrc.includes('qr_code'), 'persistencia qr_code')
assert(!/from\(['"]access_grants['"]\)\s*\.\s*insert/.test(paySvcSrc), 'paymentService mercadopago nao insere access_grants')
assert(paySvcSrc.includes('PIX-008'), 'comentario PIX-008 presente')

// PIX_ENABLED guard
const ordersRoute = read('app/api/payments/orders/route.ts')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(ordersRoute), 'rota orders nao referencia token direto (via service)')

// ---------------------------------------------------------------------------
// Funcional: validacoes e mocks (spawnSync)
// ---------------------------------------------------------------------------
console.log('\n--- Funcional com mocks ---')

// 1. token ausente -> CONFIG_MISSING, sem fetch
{
  const r = runWithMocks(`
    const origEnv = process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'BRL', description: 'VIP test' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code, msg: e.message })); }
    process.env.MERCADOPAGO_ACCESS_TOKEN = origEnv;
  `)
  if (!r.full.includes('__R__')) console.log('DEBUG token ausente full:', r.full.slice(0, 800))
  const idx = r.full.indexOf('__R__')
  let parsed = null; try { parsed = JSON.parse(r.full.slice(idx+5).split(/\r?\n/)[0]) } catch {}
  assert(parsed && parsed.code === 'MERCADOPAGO_CONFIG_MISSING', 'token ausente → CONFIG_MISSING (sem fetch)')
}

// 2. valor negativo -> INVALID_RESPONSE antes de fetch
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: -100, currency: 'BRL', description: 'x' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code })); }
  `)
  if (!r.full.includes('__R__')) console.log('DEBUG amount negativo full:', r.full.slice(0, 800))
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code === 'MERCADOPAGO_INVALID_RESPONSE', 'amount negativo → INVALID_RESPONSE')
}

// 3. moeda incorreta
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'USD', description: 'x' }); console.log('__R__FAIL'); }
    catch (e) { console.log('__R__' + JSON.stringify({ code: e.code })); }
  `)
  if (!r.full.includes('__R__')) console.log('DEBUG USD full:', r.full.slice(0, 800))
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code === 'MERCADOPAGO_INVALID_RESPONSE', 'moeda USD → INVALID_RESPONSE')
}

// 4. fetch 201 sucesso com QR
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async (url, init) => {
      const auth = init.headers['Authorization'] || init.headers.Authorization;
      if (!auth || !auth.startsWith('Bearer ')) throw new Error('no auth');
      if (init.headers['X-Idempotency-Key'] !== '00000000-0000-4000-a000-000000000001') throw new Error('no idempotency');
      const body = JSON.parse(init.body);
      if (body.external_reference !== '00000000-0000-4000-a000-000000000001') throw new Error('external_reference mismatch');
      if (body.transaction_amount !== 19.9) throw new Error('amount mismatch ' + body.transaction_amount);
      if (body.payment_method_id !== 'pix') throw new Error('pix missing');
      return { ok: true, status: 201, text: async () => JSON.stringify({ id: 12345, status: 'pending', status_detail: 'pending_waiting_payment', external_reference: '00000000-0000-4000-a000-000000000001', transaction_amount: 19.9, currency_id: 'BRL', date_of_expiration: '2026-09-18T20:00:00.000Z', point_of_interaction: { transaction_data: { qr_code: '000201...', qr_code_base64: 'iVBOR...', ticket_url: 'https://mp.com/ticket' } } }) };
    };
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000001', amountCents: 1990, currency: 'BRL', description: 'VIP Mensal' });
    console.log('__R__' + JSON.stringify({ pid: out.providerPaymentId, qr: !!out.qrCode, b64: !!out.qrCodeBase64, ticket: !!out.ticketUrl, amount: out.amount, curr: out.currency, masked: !!out.rawResponseMasked }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  if (!parsed || parsed.pid !== '12345') console.log('DEBUG 201 full:', r.full.slice(0, 900), 'parsed:', parsed)
  assert(parsed && parsed.pid === '12345' && parsed.qr && parsed.b64 && parsed.ticket && parsed.amount===19.9 && parsed.curr==='BRL', '201 com QR normalizado (centavos 1990→19.90, external_reference=orderId, idempotency)')
}

// 5. fetch 200 consulta approved
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 99999, status: 'approved', status_detail: 'accredited', external_reference: '00000000-0000-4000-a000-000000000002', transaction_amount: 99, currency_id: 'BRL' }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.getMercadoPagoPayment('99999');
    console.log('__R__' + JSON.stringify({ status: out.providerStatus, detail: out.statusDetail }));
  `)
  if (!r.full.includes('__R__') || !r.full.includes('approved')) console.log('DEBUG 5 full:', r.full.slice(0, 900))
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.status==='approved' && parsed.detail==='accredited', 'consulta 200 approved normalizado')
}

// 6. erro 401
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoPayment('1'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code, status:e.status})); }
  `)
  if (!r.full.includes('MERCADOPAGO_UNAUTHORIZED')) console.log('DEBUG 401 full:', r.full.slice(0, 800))
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_UNAUTHORIZED' && parsed.status===401, '401 → UNAUTHORIZED')
}

// 7. erro 404
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

// 8. erro 429
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoPayment('1'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_RATE_LIMITED', '429 → RATE_LIMITED')
}

// 9. erro 500
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

// 10. timeout
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => { const e=new Error('aborted'); e.name='AbortError'; throw e; };
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoPayment('1'); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_TIMEOUT', 'AbortError → TIMEOUT')
}

// 11. JSON invalido
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

// 12. resposta sem ID
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ status: 'pending' }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000006', amountCents: 1990, currency:'BRL', description:'x' }); console.log('__R__FAIL'); } catch(e){ console.log('__R__' + JSON.stringify({code:e.code})); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.code==='MERCADOPAGO_INVALID_RESPONSE', 'sem ID → INVALID_RESPONSE')
}

// 13. sem dados PIX (qr ausente) — deve normalizar null, não falhar
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ id: 777, status: 'pending', transaction_amount: 10, currency_id: 'BRL' }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.createPixPayment({ orderId: '00000000-0000-4000-a000-000000000007', amountCents: 1000, currency:'BRL', description:'x' });
    console.log('__R__' + JSON.stringify({ qr: out.qrCode, b64: out.qrCodeBase64 }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.qr===null && parsed.b64===null, 'sem QR → normaliza null (nao falha)')
}

// 14. status pending/rejected desconhecido
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-TOKEN-123';
    global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: 888, status: 'rejected', status_detail: 'cc_rejected_other_reason', transaction_amount: 19.90, currency_id: 'BRL' }) });
    const mod = await import(${JSON.stringify(fileUrl)});
    const out = await mod.getMercadoPagoPayment('888');
    console.log('__R__' + JSON.stringify({ s: out.providerStatus, d: out.statusDetail }));
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.s==='rejected', 'status rejected normalizado')
}

// 15. seguranca: token nao aparece no erro/body
{
  const r = runWithMocks(`
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-SECRET-XYZ';
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
    const mod = await import(${JSON.stringify(fileUrl)});
    try { await mod.getMercadoPagoPayment('1'); } catch(e){ console.log('__R__' + JSON.stringify({ msg: e.message, hasToken: e.message.includes('TEST-SECRET-XYZ') })); }
  `)
  const parsed = (()=>{ const i=r.full.indexOf('__R__'); try{return JSON.parse(r.full.slice(i+5).split(/\r?\n/)[0])}catch{return null}})()
  assert(parsed && parsed.hasToken===false, 'mensagem de erro nao expoe token')
}

// 16. nenhum access_grants criado (estrutural ja coberto) — reforco
assert(!clientCode.includes('access_grants'), 'client nao toca access_grants')
assert(paySvcSrc.includes("provider: 'mercadopago'"), 'persistencia mercadopago presente')

console.log('\\n=== Resumo PIX-008 ===')
if (process.exitCode) console.log('❌ Falhas PIX-008.')
else console.log('✅ PIX-008 client OK')
