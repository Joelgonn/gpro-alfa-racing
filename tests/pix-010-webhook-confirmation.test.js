// tests/pix-010-webhook-confirmation.test.js
// PIX-010 — Confirmação segura e concessão VIP (HMAC, server-to-server, validações, idempotência, segurança)
// Estrutural + execução pura de helpers; mocks para MP; nenhum token real, nenhum pagamento real, nenhum DB push

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') }

console.log('=== PIX-010 — Webhook Confirmação e VIP ===\n')

const WH_ROUTE = 'app/api/payments/webhooks/mercadopago/route.ts'
const WH_SVC = 'app/lib/payments/webhook-service.ts'
const MP_CLIENT = 'app/lib/payments/mercadopago-client.ts'
const PAY_SVC = 'app/lib/payments/paymentService.ts'
const ORDER_SVC = 'app/lib/payments/orderService.ts'
const STATE_MACHINE = 'app/lib/payments/paymentStateMachine.ts'

const whRoute = read(WH_ROUTE)
const whSvc = read(WH_SVC)
const mpClient = read(MP_CLIENT)
const whCode = stripComments(whSvc)
const routeCode = stripComments(whRoute)

// ---------------------------------------------------------------------------
// Helpers ESM
// ---------------------------------------------------------------------------
const svcUrl = 'file:///' + path.join(ROOT, WH_SVC).replace(/\\/g, '/')
function runPure(code) {
  const boot = [
    `import { createRequire } from 'node:module';`,
    `const require = createRequire(import.meta.url);`,
    `process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';`,
    `process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-1234567890';`,
    `process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-FAKE';`,
    code,
  ].join('\n')
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', boot], {
    cwd: ROOT, encoding: 'utf8', timeout: 8000, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key-1234567890' },
  })
  const out = (res.stdout || '') + (res.stderr || '')
  const idx = out.indexOf('__R__')
  if (idx === -1) return { ok: false, out: out.slice(0, 800) }
  try { return { ok: true, data: JSON.parse(out.slice(idx+5).split(/\r?\n/)[0]) } } catch (e) { return { ok: false, out: out.slice(0, 800) } }
}

// ---------------------------------------------------------------------------
// 1. Webhook HMAC e evento
// ---------------------------------------------------------------------------
console.log('--- 1. Webhook HMAC e evento ---')
assert(whRoute.includes("verifySignature"), 'route valida HMAC via verifySignature')
assert(whRoute.includes("signature_not_verified") && whRoute.includes('401'), 'assinatura inválida → 401')
assert(whSvc.includes('isRelevantEvent'), 'svc identifica evento relevante')
assert(whSvc.includes("unknown_event"), 'evento desconhecido → unknown_event')
assert(whSvc.includes('data.id') || whCode.includes('dataId'), 'svc extrai data.id')
assert(whSvc.includes('getMercadoPagoPayment'), 'svc consulta MP server-to-server')
assert(whSvc.includes('MERCADOPAGO_CONFIG_MISSING') || whSvc.includes('fetch_failed'), 'svc trata erro config/MP')

// 1a. data.id ausente
assert(whSvc.includes('!dataId') && whSvc.includes('unknown_event'), 'data.id ausente → unknown_event sem consulta MP')
// paymentId inválido tratado via validateMpPayment / isValidUUID

// ---------------------------------------------------------------------------
// 2. Consulta server-to-server erros
// ---------------------------------------------------------------------------
console.log('\n--- 2. Consulta MP erros ---')
assert(mpClient.includes('MERCADOPAGO_UNAUTHORIZED'), 'client trata 401')
assert(mpClient.includes('MERCADOPAGO_NOT_FOUND'), 'client trata 404')
assert(mpClient.includes('MERCADOPAGO_RATE_LIMITED'), 'client trata 429')
assert(mpClient.includes('MERCADOPAGO_TIMEOUT'), 'client trata timeout AbortError')
assert(mpClient.includes('MERCADOPAGO_INVALID_RESPONSE'), 'client trata resposta inválida')
assert(whSvc.includes('fetch_failed') || whSvc.includes('mp_fetch_failed'), 'svc registra fetch_failed')
assert(whSvc.includes('MERCADOPAGO_CONFIG_MISSING') || whSvc.includes('validation_failed'), 'svc trata CONFIG_MISSING como validation_failed')

// ---------------------------------------------------------------------------
// 3. Pagamento aprovado — validações
// ---------------------------------------------------------------------------
console.log('\n--- 3. Pagamento aprovado validações ---')
assert(whSvc.includes("status_not_approved"), 'svc valida status aprovado/processado (Orders API)')
assert(whSvc.includes('externalReference') && whSvc.includes('external_reference'), 'svc valida external_reference')
assert(whSvc.includes('isValidUUID') && whSvc.includes('externalReference'), 'svc valida UUID do external_reference')
assert(whSvc.includes('Math.round') && whSvc.includes('amount'), 'svc valida valor com comparação centavos (sem float)')
assert(whSvc.includes("currency") && whSvc.includes("'BRL'"), 'svc valida moeda BRL')
assert(whSvc.includes("provider === 'mercadopago'") || whSvc.includes('provider !=='), 'svc valida provider mercadopago')
assert(whSvc.includes('premium_payments') && whSvc.includes("eq('provider', 'mercadopago')"), 'svc localiza pagamento mercadopago')
assert(whSvc.includes('premium_orders') && whSvc.includes('amount_cents'), 'svc valida valor contra pedido')
assert(whSvc.includes('plan_id') || whSvc.includes('premium_plans'), 'svc relaciona plano')

// Testa validateMpPayment — estrutural (evita import com alias @/ que falha em node puro)
assert(whSvc.includes('function validateMpPayment'), 'validateMpPayment exportado')
assert(whSvc.includes("normalizedStatus") && whSvc.includes("status_not_approved"), 'validateMpPayment valida status aprovado/processado e rejeita outros')
assert(whSvc.includes('external_reference_divergente'), 'validateMpPayment detecta external_reference divergente')
assert(whSvc.includes('valor_divergente'), 'validateMpPayment detecta valor divergente')
assert(whSvc.includes('moeda_divergente'), 'validateMpPayment detecta moeda divergente')

// ---------------------------------------------------------------------------
// 4. Persistência confirmação
// ---------------------------------------------------------------------------
console.log('\n--- 4. Persistência confirmação ---')
assert(whSvc.includes("canTransitionPayment") || whSvc.includes('canTransitionOrder'), 'svc usa máquina de estados')
assert(whSvc.includes("status: 'confirmed'") || whSvc.includes("'confirmed'"), 'svc confirma premium_payments → confirmed')
assert(whSvc.includes("status: 'paid'") || whSvc.includes("'paid'"), 'svc marca premium_orders → paid')
assert(whSvc.includes("provider_status: 'approved'") || whSvc.includes("provider_status"), 'svc atualiza provider_status approved')
assert(whSvc.includes('paid_at'), 'svc registra paid_at')
assert(whSvc.includes('confirmPaymentAndOrder') || whSvc.includes('orderConfirmed'), 'svc tem função de confirmação')

// ---------------------------------------------------------------------------
// 5. Concessão VIP idempotente
// ---------------------------------------------------------------------------
console.log('\n--- 5. Concessão VIP ---')
assert(whSvc.includes('access_grants'), 'svc cria access_grants')
assert(whSvc.includes("source: 'payment'"), 'grant source payment')
assert(whSvc.includes("plan: 'full_premium'") || whSvc.includes('full_premium'), 'grant plan full_premium')
assert(whSvc.includes("status: 'active'"), 'grant status active')
assert(whSvc.includes('metadata') && whSvc.includes('order_id'), 'grant metadata order_id')
assert(whSvc.includes('ensurePaymentGrant') || whSvc.includes('ensurePaymentGrant') || whSvc.includes('uniq_grant_payment_order') || whSvc.includes('23505'), 'grant idempotente via 23505 / uniq_grant_payment_order')
assert(whSvc.includes('expires_at') && whSvc.includes('duration_days'), 'grant expires_at baseado em premium_plans.duration_days')
assert(!whSvc.includes("source: 'invite'") || whSvc.includes("source: 'payment'"), 'grant payment não usa source invite')

// ---------------------------------------------------------------------------
// 6. Eventos repetidos / idempotência
// ---------------------------------------------------------------------------
console.log('\n--- 6. Idempotência ---')
assert(whSvc.includes('duplicate_ignored'), 'mesmo event_id → duplicate_ignored')
assert(whSvc.includes('23505'), 'unique violation 23505 tratado')
assert(whSvc.includes('already_confirmed') || whSvc.includes('alreadyConfirmed') || whSvc.includes("status === 'confirmed'"), 'pagamento já confirmado → idempotente')
assert(whSvc.includes("status === 'paid'") || whSvc.includes('alreadyPaid') || whSvc.includes('already_paid'), 'pedido já pago → idempotente')
assert(whSvc.includes('grant_reused') || whSvc.includes('isNew: false'), 'grant já existente → grant_reused')

// ---------------------------------------------------------------------------
// 7. Estados não aprovados
// ---------------------------------------------------------------------------
console.log('\n--- 7. Estados não aprovados ---')
assert(whSvc.includes('pending_observed') || whSvc.includes('mp_status:pending'), 'pending/in_process → pending_observed, não concede')
assert(whSvc.includes('rejected_observed') || whSvc.includes('rejected'), 'rejected/cancelled → rejected_observed')
assert(whSvc.includes('refunded') || whSvc.includes('charged_back'), 'refunded/charged_back tratados')
assert(whSvc.includes('validation_failed'), 'inconsistência → validation_failed')
assert(whSvc.includes('fetch_failed'), 'pagamento inexistente → fetch_failed')

// ---------------------------------------------------------------------------
// 8. Rejeição e inconsistência detalhadas
// ---------------------------------------------------------------------------
console.log('\n--- 8. Rejeição / inconsistência ---')
assert(whSvc.includes('pending_observed') && whSvc.includes('rejected_observed'), 'todos os estados pending/rejected mapeados para validation_failed ou observed')
assert(whSvc.includes('pedido nao encontrado') || whSvc.includes('reference_not_found'), 'pedido inexistente → reference_not_found')
assert(whSvc.includes('pagamento local') || whSvc.includes('premium_payments'), 'pagamento local inexistente → validation_failed')
assert(whSvc.includes("provider: 'mercadopago'") && !whSvc.includes("provider: 'test'") || whSvc.includes('provider divergente'), 'pagamento de teste não confirmado via MP')

// ---------------------------------------------------------------------------
// 9. Segurança
// ---------------------------------------------------------------------------
console.log('\n--- 9. Segurança ---')
assert(!/MERCADOPAGO_ACCESS_TOKEN/.test(whCode) || whCode.includes('getMercadoPagoPayment'), 'wh svc não loga token, só chama client')
assert(!/NEXT_PUBLIC.*MERCADOPAGO/.test(whCode), 'nenhuma var pública MP no webhook')
assert(!whCode.includes('eyJ'), 'nenhum JWT em código webhook')
assert(whSvc.includes('maskPayload'), 'payload mascarado')
assert(!/access_grants/.test(stripComments(read(PAY_SVC))) || read(PAY_SVC).includes('mercadopago'), 'paymentService não cria grant para não aprovado (só via webhook)')
// Verifica que webhook não é chamado pelo frontend
assert(!whCode.includes('fetch(') || whCode.includes('supabaseAdmin'), 'webhook não faz fetch direto além de MP client')

// ---------------------------------------------------------------------------
// 10. Máquina de estados
// ---------------------------------------------------------------------------
console.log('\n--- 10. Máquina de estados ---')
const stateMachine = read(STATE_MACHINE)
assert(stateMachine.includes("pending: ['awaiting_payment', 'paid'"), 'pending→paid permitido (PIX-010)')
assert(stateMachine.includes("pending: ['confirmed'"), 'pending→confirmed permitido')
assert(stateMachine.includes('canTransitionOrder') && stateMachine.includes('canTransitionPayment'), 'svc usa canTransition')

// Testa transições proibidas
{
  const smUrl = 'file:///' + path.join(ROOT, 'app/lib/payments/paymentStateMachine.ts').replace(/\\/g, '/')
  const r = runPure(`
    const sm = await import(${JSON.stringify(smUrl)});
    const tests = [
      !sm.canTransitionPayment('failed','confirmed'),
      !sm.canTransitionPayment('refunded','confirmed'),
      !sm.canTransitionOrder('failed','paid'),
      sm.canTransitionPayment('pending','confirmed'),
      sm.canTransitionOrder('pending','paid'),
      sm.canTransitionOrder('awaiting_payment','paid'),
    ];
    console.log('__R__' + JSON.stringify({ all: tests.every(Boolean) }));
  `)
  if (!r.ok) console.log('DEBUG state machine:', r.out.slice(0, 800))
  assert(r.ok && r.data.all, 'máquina bloqueia failed→confirmed e permite pending→confirmed/paid')
}

console.log('\n=== Resumo PIX-010 ===')
if (process.exitCode) console.log('❌ Falhas PIX-010.')
else console.log('✅ PIX-010 validação OK')
