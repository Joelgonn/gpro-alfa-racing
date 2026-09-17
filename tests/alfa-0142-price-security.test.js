// tests/alfa-0142-price-security.test.js
const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }
console.log('=== ALFA-014.2 — Preço Segurança ===\n')
const svc = read('app/lib/payments/orderService.ts')
const route = read('app/api/payments/orders/route.ts')

assert(svc.includes('premium_plans') && svc.includes('price_cents'), 'plano inexistente 404 (busca premium_plans)')
assert(svc.includes('is_active') && svc.includes('Plano inativo'), 'plano inativo 409')
assert(svc.includes('price_cents') && svc.includes('plan'), 'preço vem de premium_plans (plan.price_cents via plan)')
assert(!svc.includes('body.amount_cents') && !svc.includes('body.price_cents'), 'amount/price do cliente não utilizado')
assert(route.includes('planCode') && !route.includes('body.amount_cents'), 'currency permanece BRL (não do cliente)')
assert(!route.includes('body.plan_id') || route.includes('planCode'), 'plan_id arbitrário não aceito (usa planCode)')
assert(svc.includes('amount_cents') && svc.includes('currency'), 'pedido com preço correto')
console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas preço.')
else console.log('✅ Preço segurança OK')
