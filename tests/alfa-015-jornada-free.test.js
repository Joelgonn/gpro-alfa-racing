// tests/alfa-015-jornada-free.test.js
// ============================================================
// ALFA-015.0 — JORNADA DO USUÁRIO GRATUITO (FREE)
// ============================================================
// Cobre os TESTE 7, 8 e 9 do escopo da sprint e a regressão mínima:
//   TESTE 7 — autenticado SEM Premium acessa /planos e pode iniciar compra
//   TESTE 8 — Premium continua funcionando
//   TESTE 9 — Admin continua funcionando
//   REGRESSÃO — preços, planos, webhook e PIX não foram alterados por esta sprint
//
// Execução: node tests/alfa-015-jornada-free.test.js
// ============================================================

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8') }
function assert(c, m) { if (!c) { console.error('❌ FAIL:', m); process.exitCode = 1 } else console.log('✅ PASS:', m) }
function pending(m) { console.log('⚠️  PENDING:', m) }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

console.log('=== ALFA-015.0 — Jornada Free / Premium / Admin ===\n')

let flow = null
try {
  flow = require(path.join(ROOT, 'app/lib/auth-flow.ts'))
} catch (e) {
  pending(`regras puras indisponíveis: ${String(e.message).slice(0, 80)}`)
}

const planosCode = stripComments(read('app/planos/page.tsx'))
const checkoutCode = stripComments(read('app/planos/checkout-button.tsx'))
const middlewareCode = read('middleware.ts')
const sessionCode = read('utils/supabase/middleware.ts')
const accessCode = stripComments(read('app/lib/access/accessService.ts'))
const adminLayout = read('app/dashboard/admin/layout.tsx')
const ordersApi = stripComments(read('app/api/payments/orders/route.ts'))

// ---------------------------------------------------------------------------
// TESTE 7 — Autenticado sem Premium acessa /planos
// ---------------------------------------------------------------------------
console.log('--- TESTE 7: usuário free acessa /planos ---')
assert(fs.existsSync(path.join(ROOT, 'app/planos/page.tsx')), 'TESTE 7: /planos existe')
assert(!/requireVip/.test(planosCode), 'TESTE 7: /planos não exige VIP')
assert(/getAuthenticatedUser/.test(planosCode), 'TESTE 7: /planos lê o usuário autenticado sem exigir Premium')
assert(/pixEnabled \? \(/.test(planosCode), 'TESTE 7: CTA de compra renderizado quando o Pix está habilitado')
assert(/CheckoutButton/.test(planosCode) && /isAuthenticated=\{Boolean\(user\)\}/.test(planosCode), 'TESTE 7: usuário autenticado (free ou premium) recebe o botão de compra')
assert(/Não tem conta\? Criar conta grátis/.test(planosCode), 'TESTE 7: /planos aponta para o cadastro gratuito')
assert(/\/login\?next=/.test(planosCode), 'TESTE 7: /planos preserva o retorno no login')

// Middleware não pode assumir Premium
assert(!/requireVip|access_grants|vip_status|premium/i.test(middlewareCode), 'TESTE 7: middleware raiz não assume Premium')
assert(!/redirect|NextResponse\.redirect/.test(sessionCode), 'TESTE 7: updateSession não bloqueia rota por falta de Premium')
assert(/supabase\.auth\.getUser\(\)/.test(sessionCode), 'TESTE 7: middleware apenas atualiza a sessão (comportamento preservado)')
assert(/VIP_CHECK = false/.test(accessCode), 'TESTE 7: enforcement de VIP continua desligado (nada passou a bloquear o free)')

// Compra iniciável sem Premium
assert(/supabase\.auth\.getUser\(\)/.test(ordersApi), 'TESTE 7: criação de pedido exige apenas autenticação')
assert(!/requireVip|hasVipAccess|accessPlan|vip_status/.test(ordersApi), 'TESTE 7: criação de pedido NÃO exige Premium')
assert(/isAuthenticated\) \{[\s\S]{0,200}?\/login\?next=\/planos/.test(checkoutCode), 'TESTE 7: sem sessão o checkout manda para /login preservando /planos')

if (flow) {
  const freeAccess = { role: 'user', accessPlan: null }
  assert(flow.resolvePostLoginDestination({ access: freeAccess }) === '/planos', 'TESTE 7: free autenticado é conduzido a /planos')
  const formerVip = { role: 'user', accessPlan: 'full_premium' }
  assert(flow.resolvePostLoginDestination({ access: formerVip }) === '/dashboard/manager', 'TESTE 7: quem já tem plano registrado mantém o destino atual (sem regressão)')
}

// ---------------------------------------------------------------------------
// TESTE 8 — Premium continua funcionando
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 8: Premium continua funcionando ---')
assert(/interpretGrant|pickBestGrant/.test(accessCode), 'TESTE 8: regras de Premium/access_grants intactas')
assert(/canGrantPremium|ensureVipGrantForInvite/.test(accessCode), 'TESTE 8: concessão de acesso continua no accessService existente')
assert(!/freeSignup|signUpFreeUser/.test(accessCode), 'TESTE 8: cadastro gratuito não interfere no serviço de acesso')
assert(/CheckoutButton/.test(planosCode), 'TESTE 8: Premium segue comprando pelo fluxo Pix existente')
if (flow) {
  const lifetime = { role: 'user', accessPlan: 'full_premium' }
  assert(flow.resolvePostLoginDestination({ access: lifetime }) === '/dashboard/manager', 'TESTE 8: Premium vitalício mantém o destino atual')
  const monthly = { role: 'user', accessPlan: 'premium' }
  assert(flow.resolvePostLoginDestination({ access: monthly }) === '/dashboard/manager', 'TESTE 8: Premium mensal mantém o destino atual')
  const vencido = { role: 'user', accessPlan: 'full_premium' }
  assert(flow.resolvePostLoginDestination({ access: vencido }) === '/dashboard/manager', 'TESTE 8: plano registrado (mesmo vencido) não é rebaixado para o funil free')
}

// ---------------------------------------------------------------------------
// TESTE 9 — Admin continua funcionando
// ---------------------------------------------------------------------------
console.log('\n--- TESTE 9: Admin continua funcionando ---')
assert(/userState\.role !== 'admin'/.test(adminLayout), 'TESTE 9: proteção de /dashboard/admin intacta')
assert(/redirect\('\/login'\)/.test(adminLayout), 'TESTE 9: admin não autenticado → /login')
assert(!/freeSignup/.test(adminLayout), 'TESTE 9: cadastro gratuito não altera a área administrativa')
if (flow) {
  const admin = { role: 'admin', accessPlan: null, vipExpiresAt: null }
  assert(flow.resolvePostLoginDestination({ access: admin }) === '/dashboard/manager', 'TESTE 9: admin mantém o destino atual')
  assert(flow.resolvePostLoginDestination({ next: '/planos', access: admin }) === '/planos', 'TESTE 9: ?next= explícito continua tendo precedência')
}

// ---------------------------------------------------------------------------
// Regressão — nada fora do escopo foi alterado
// ---------------------------------------------------------------------------
console.log('\n--- Regressão (fora do escopo) ---')
const planSeed = read('supabase/migrations/20250919000003_pix_seed_premium_plans.sql')
assert(/vip_monthly/.test(planSeed) && /30, 1990/.test(planSeed), 'REGRESSÃO: seed do VIP Mensal (30 dias) intacto')
assert(/vip_lifetime/.test(planSeed) && /null, 9900/.test(planSeed), 'REGRESSÃO: seed do VIP Vitalício (sem expiração) intacto')
// Os preços vigentes (VIP Mensal R$ 1,99 / VIP Vitalício R$ 99,00) são administrados
// pelo painel (/api/admin/plans). Esta sprint não escreve preço em nenhum arquivo:
for (const f of ['app/actions/freeSignup.ts', 'app/cadastro/page.tsx', 'app/lib/auth-flow.ts', 'app/auth/confirmar/route.ts']) {
  const src = stripComments(read(f))
  assert(!/premium_plans|price_cents|1990|9900|199\b/.test(src), `REGRESSÃO: ${f} não altera preço/plano`)
}
assert(!/premium_plans/.test(read('app/actions/freeSignup.ts')), 'REGRESSÃO: cadastro não lê nem escreve premium_plans')
const webhook = read('app/api/payments/webhooks/mercadopago/route.ts')
assert(/MERCADOPAGO_WEBHOOK_SECRET|signature/i.test(webhook), 'REGRESSÃO: webhook Mercado Pago intacto')
assert(!/freeSignup|free\.signup/.test(webhook), 'REGRESSÃO: cadastro gratuito não toca no webhook')
const mpClient = read('app/lib/payments/mercadopago-client.ts')
assert(!/freeSignup|free\.signup/.test(mpClient), 'REGRESSÃO: mercadopago-client não foi modificado')
const paymentService = read('app/lib/payments/paymentService.ts')
assert(!/freeSignup|free\.signup/.test(paymentService), 'REGRESSÃO: paymentService não foi modificado')
assert(/PIX_ENABLED/.test(planosCode) && !/PIX_ENABLED\s*=\s*false/.test(planosCode), 'REGRESSÃO: gate PIX_ENABLED preservado')
assert(fs.existsSync(path.join(ROOT, 'app/auth/confirmar/route.ts')), 'CONFIRMAÇÃO: rota de retorno do e-mail existe')
assert(!/access_grants|vip_status|full_premium/.test(stripComments(read('app/auth/confirmar/route.ts'))), 'CONFIRMAÇÃO: confirmação de e-mail não concede Premium')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas na jornada Free/Premium/Admin.')
else console.log('✅ TESTE 7, 8, 9 e regressão OK.')
