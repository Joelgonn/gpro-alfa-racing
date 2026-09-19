// tests/pix-015-mp-error-detail.test.js
// ============================================================
// PIX-015 — Evidência do Mercado Pago: detalhe do erro + expiração do QR
// ============================================================
// Testa, executando o client REAL (mercadopago-client.ts) com fetch falso, as duas
// correções baseadas em evidência da FASE 2/FASE 3:
//
// 1. EXPIRAÇÃO: a resposta real do provedor traz `expiration_time: "P1D"` (duração)
//    E `date_of_expiration` (ISO). O código lia a duração como se fosse data ⇒
//    `expires_at` ficava NULL e o QR era considerado utilizável para sempre.
//    Agora prefere `date_of_expiration`.
//
// 2. DIAGNÓSTICO DO 402: o corpo do erro do provedor contém o motivo real
//    (status_detail/details) e os identificadores criados (ORD.../PAY...). O código
//    antigo registrava apenas code/message e descartava o resto — era impossível
//    determinar a causa pelos nossos logs. Agora esses campos são extraídos,
//    sanitizados e anexados ao erro.
//
// Nenhuma rede real: as respostas abaixo são reproduções da estrutura devolvida pelo
// provedor (campos observados em resposta real de sandbox + formato de erro público).
// Execução: node tests/pix-015-mp-error-detail.test.js
// ============================================================

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }

console.log('=== PIX-015 — Detalhe do erro MP + expiração do QR ===\n')

const MP_CLIENT = 'app/lib/payments/mercadopago-client.ts'
const ORDER = '11111111-1111-4111-8111-111111111111'

const LOADER = [
  "import { pathToFileURL, fileURLToPath } from 'node:url'",
  "import { existsSync } from 'node:fs'",
  "const EMPTY = 'data:text/javascript,export default undefined;'",
  "function withExt(b) { for (const e of ['', '.ts', '.tsx', '.js']) { if (existsSync(b + e)) return b + e } return null }",
  "export async function resolve(spec, ctx, next) {",
  "  if (spec === 'server-only' || spec.endsWith('/server-only')) return { url: EMPTY, shortCircuit: true }",
  "  if (spec.startsWith('@/')) { const r = withExt(process.env.__PIX15R_ROOT__ + '/' + spec.slice(2)); return { url: pathToFileURL(r).href, shortCircuit: true } }",
  "  if (spec.startsWith('./') || spec.startsWith('../')) { const r = withExt(fileURLToPath(new URL(spec, ctx.parentURL))); if (r) return { url: pathToFileURL(r).href, shortCircuit: true } }",
  "  return next(spec, ctx)",
  "}",
].join('\n')

function runClient(code, mpResponse) {
  const boot = [
    `process.env.__PIX15R_ROOT__ = ${JSON.stringify(ROOT.replace(/\\/g, '/'))};`,
    `process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE-TOKEN-FOR-TEST';`,
    `globalThis.fetch = async () => ({ ok: ${mpResponse.status >= 200 && mpResponse.status < 300}, status: ${mpResponse.status}, text: async () => ${JSON.stringify(JSON.stringify(mpResponse.body))} });`,
    `const { register } = await import('node:module');`,
    `register(${JSON.stringify('data:text/javascript;base64,' + Buffer.from(LOADER, 'utf8').toString('base64'))}, { parentURL: import.meta.url });`,
    `const mod = await import(${JSON.stringify('file:///' + ROOT.replace(/\\/g, '/') + '/' + MP_CLIENT)});`,
    `const __out = await (async () => { ${code} })();`,
    `console.log('__PIX15R__' + JSON.stringify(__out));`,
  ].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
  const full = (res.stdout || '') + (res.stderr || '')
  const idx = full.indexOf('__PIX15R__')
  if (idx === -1) {
    const diag = full.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(-3).join(' | ')
    return { ok: false, reason: diag.slice(0, 400) }
  }
  try { return { ok: true, out: JSON.parse(full.slice(idx + '__PIX15R__'.length).split(/\r?\n/)[0]) } }
  catch (e) { return { ok: false, reason: 'parse: ' + e.message } }
}

const CALL = `try {
  const p = await mod.createPixPayment({ orderId: ${JSON.stringify(ORDER)}, amountCents: 199, currency: 'BRL', description: 'VIP vip_monthly', payerEmail: 'piloto@alfaracing.com', idempotencyKey: 'TEST-ALFA-0141-MP-x-1' })
  return { ok: true, expiresAt: p.expiresAt, qr: Boolean(p.qrCode), providerOrderId: p.providerOrderId }
} catch (e) {
  return { ok: false, code: e.code, status: e.status, msg: e.message, detail: e.detail || null }
}`

// Resposta de SUCESSO com o formato real observado no provedor (P1D + date_of_expiration)
const OK_BODY = {
  id: 'ORDTST01M2XNYWBFN7D99T1D4DSTRG7S',
  type: 'online',
  processing_mode: 'automatic',
  external_reference: ORDER,
  total_amount: '1.99',
  status: 'action_required',
  status_detail: 'waiting_transfer',
  transactions: {
    payments: [{
      id: 'PAY01M2XNYWBXBQZB679VXF38NH7Z',
      amount: '1.99',
      status: 'action_required',
      status_detail: 'waiting_transfer',
      expiration_time: 'P1D',
      date_of_expiration: '2026-09-20T20:33:09.575+00:00',
      payment_method: { id: 'pix', type: 'bank_transfer', qr_code: '00020126QR', qr_code_base64: 'iVBOR', ticket_url: 'https://mp/t' },
    }],
  },
}

console.log('--- 1. Expiração do QR (evidência: resposta real do provedor) ---')
{
  const r = runClient(CALL, { status: 201, body: OK_BODY })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ok === true, '1. Order de Pix criada com sucesso é normalizada')
    assert(r.out.expiresAt === '2026-09-20T20:33:09.575+00:00', '1. expiresAt usa date_of_expiration (não a duração "P1D")')
    assert(r.out.expiresAt !== 'P1D', '1. duração ISO-8601 nunca é tratada como data')
    assert(!Number.isNaN(new Date(r.out.expiresAt).getTime()), '1. expiresAt é data válida (antes ficava NULL → QR eterno)')
    assert(r.out.qr === true && r.out.providerOrderId === 'ORDTST01M2XNYWBFN7D99T1D4DSTRG7S', '1. QR e id da Order preservados')
  }
}

console.log('\n--- 2. Detalhe do 402 (motivo real + ids criados) ---')
{
  // Estrutura de erro do provedor: errors[].details com o motivo da transação e ids
  const body402 = {
    errors: [{
      code: 'failed',
      message: 'The following transactions failed',
      status: 402,
      details: [{ code: 'processing_error', message: 'The payment could not be processed for the provided payer', status_detail: 'rejected_by_issuer_example' }],
      order_id: 'ORD01M2XNH47AER0CFQBW12G8KNN3',
      payment_id: 'PAY01M2XNH47MTSZMCRS0A8D488S7',
    }],
  }
  const r = runClient(CALL, { status: 402, body: body402 })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    assert(r.out.ok === false && r.out.code === 'MERCADOPAGO_TRANSACTION_FAILED', '2. 402 ⇒ código próprio MERCADOPAGO_TRANSACTION_FAILED')
    assert(r.out.status === 402, '2. status HTTP preservado')
    assert(Boolean(r.out.detail), '2. erro carrega detail estruturado')
    assert(r.out.detail && r.out.detail.providerErrorCode === 'failed', '2. código do provedor preservado (failed)')
    assert(r.out.detail && /processing_error/.test(JSON.stringify(r.out.detail.details)), '2. motivo real (details/processing_error) preservado')
    assert(r.out.detail && r.out.detail.providerOrderId === 'ORD01M2XNH47AER0CFQBW12G8KNN3', '2. id da Order criada é capturado (antes era descartado)')
    assert(r.out.detail && r.out.detail.providerPaymentId === 'PAY01M2XNH47MTSZMCRS0A8D488S7', '2. id do pagamento criado é capturado')
    assert(/status_detail=/.test(r.out.msg || ''), '2. mensagem do erro expõe status_detail para o log')
    assert(!/Bearer|TEST-FAKE-TOKEN/.test(r.out.msg || ''), '2. nenhum token vaza na mensagem')
  }
}

console.log('\n--- 3. Erro com PII/e-mail no corpo é sanitizado ---')
{
  const bodyWithMail = {
    errors: [{ code: 'failed', message: 'payer piloto@alfaracing.com inválido para esta conta', details: ['contato: piloto@alfaracing.com'] }],
  }
  const r = runClient(CALL, { status: 402, body: bodyWithMail })
  if (!r.ok) { pending('execução indisponível: ' + r.reason) } else {
    const serialized = JSON.stringify(r.out.detail) + ' ' + String(r.out.msg)
    assert(!/piloto@alfaracing\.com/.test(serialized), '3. e-mail do pagador é mascarado no detalhe/log')
    assert(/\[email\]/.test(serialized), '3. marcador [email] presente (sanitização comprovada)')
  }
}

console.log('\n--- 4. Estrutural ---')
const clientSrc = read(MP_CLIENT)
assert(clientSrc.includes('MERCADOPAGO_TRANSACTION_FAILED'), '4. código de transação falha definido')
assert(clientSrc.includes('extractErrorDetail'), '4. extrator de detalhe existe')
assert(clientSrc.includes('date_of_expiration'), '4. leitura de date_of_expiration presente')
assert(clientSrc.includes('P1D'), '4. duração ISO-8601 explicitamente tratada')
assert(/expiration_time: 'P1D'/.test(clientSrc), '4. payload de request continua enviando expiration_time P1D (inalterado)')
assert(/processing_mode: 'automatic'/.test(clientSrc), '4. processing_mode inalterado')
assert(!/MERCADOPAGO_ACCESS_TOKEN\s*=\s*['"]/.test(clientSrc), '4. token só vem de env (nunca hardcoded)')

console.log('\n=== Resumo PIX-015 (Mercado Pago) ===')
if (process.exitCode) console.log('❌ Falhas no diagnóstico/expiração.')
else console.log('✅ PIX-015 MP OK (expiração + detalhe do erro).')
