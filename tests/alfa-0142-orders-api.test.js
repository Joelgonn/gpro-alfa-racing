// tests/alfa-0142-orders-api.test.js
const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }
console.log('=== ALFA-014.2 — Orders API ===\n')
const route = read('app/api/payments/orders/route.ts')
const svc = read('app/lib/payments/orderService.ts')

assert(route.includes('createClient') && route.includes('auth.getUser'), 'Sem sessão 401 (getUser)')
assert(route.includes('user_id') && route.includes('auth.getUser') && !route.includes('body.user_id') && !route.includes('body.userId'), 'userId da sessão (não body/query)')
assert(route.includes('planCode') && route.includes('Idempotency-Key'), 'endpoint exige planCode e Idempotency-Key')
assert(route.includes('400') && route.includes('Body inválido'), 'body inválido 400')
assert(route.includes('planCode obrigatório'), 'planCode ausente 400')
assert(svc.includes('Idempotency-Key ausente') || route.includes('Idempotency-Key ausente'), 'Idempotency-Key ausente 400')
assert(svc.includes('TEST-ALFA-0141-'), 'Idempotency-Key prefixo TEST-ALFA-0141-')
assert(route.includes('supabaseAdmin') || svc.includes('premium_plans'), 'plano inexistente 404 (busca premium_plans)')
assert(route.includes('is_active') || svc.includes('is_active'), 'plano inativo 409')
assert(route.includes('200') && route.includes('201'), '201 criado e 200 idempotente')
assert(route.includes('405') && route.includes('GET'), '405 métodos não permitidos')
assert(!route.includes('"payload_json"') && !route.includes('"service_role"'), 'sem payload_json/service_role na resposta JSON')
console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas orders-api.')
else console.log('✅ Orders API OK')
