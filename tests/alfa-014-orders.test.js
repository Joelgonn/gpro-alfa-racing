// tests/alfa-014-orders.test.js
// ALFA-014.1 — Schema e serviços de pedidos

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }
console.log('=== ALFA-014.1 — Orders ===\n')
const mig = read('supabase/migrations/20250917000006_create_premium_orders.sql')
const types = read('app/lib/payments/types.ts')
const svc = read('app/lib/payments/orderService.ts')
const api = read('app/api/admin/orders/route.ts')

assert(mig.includes('create table if not exists public.premium_orders'), 'schema premium_orders existe')
assert(mig.includes('user_id uuid not null') && mig.includes('plan_id uuid not null references public.premium_plans'), 'FKs user_id, plan_id')
assert(mig.includes("check (status in ('draft','pending'"), 'status check')
assert(mig.includes('amount_cents integer') && mig.includes('amount_cents >= 0'), 'amount_cents >=0')
assert(mig.includes("currency text") && mig.includes("default 'BRL'"), 'currency BRL')
assert(mig.includes('pix_txid text') && mig.includes('payload_hash text'), 'pix_txid, payload_hash')
assert(mig.includes('uniq_premium_orders_pix_txid') && mig.includes('where pix_txid is not null'), 'índice único pix_txid')
assert(mig.includes('idx_premium_orders_payload_hash'), 'índice payload_hash')
assert(mig.includes('enable row level security'), 'RLS habilitada')
assert(mig.includes('premium_orders_select_own') && mig.includes('auth.uid() = user_id'), 'RLS select own')
assert(!mig.includes('for insert to authenticated'), 'sem insert para authenticated')
assert(types.includes('PremiumOrder') && types.includes('OrderStatus'), 'types PremiumOrder')
assert(svc.includes('createOrderIdempotent') && svc.includes('price_cents'), 'serviço cria idempotente captura preço do plano')
assert(!svc.includes('body.amount_cents') && svc.includes('price_cents') && svc.includes('plan'), 'não confia em amount do frontend (usa plan price_cents)')
assert(api.includes('requireAdmin') && api.includes('page') && api.includes('limit'), 'API admin paginação')
assert(api.includes('pix_txid') && api.includes('slice(0, 8)'), 'API mascara pix_txid')
assert(!api.includes('payload_hash') || api.includes('select') && !api.includes('payload_json'), 'API não expõe payload sensível por padrão')
console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas orders.')
else console.log('✅ Orders OK')
