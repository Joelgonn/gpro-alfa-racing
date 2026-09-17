// tests/alfa-014-premium-plans.test.js
// ALFA-014.0 — Contrato premium_plans

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-014.0 — Testes Premium Plans ===\n')

const mig = read('supabase/migrations/20250917000005_create_premium_plans.sql')
const seed = read('supabase/seed.sql')
const types = read('app/lib/payments/types.ts')

// Contrato tabela
assert(mig.includes('create table if not exists public.premium_plans'), '1. migration cria premium_plans')
assert(mig.includes('code text not null'), '2. code text not null')
assert(mig.includes('unique index') && mig.includes('uniq_premium_plans_code'), '3. unicidade code')
assert(mig.includes('duration_days integer') && mig.includes('duration_days is null or duration_days > 0'), '4. duration_days null=vitalício, >0')
assert(mig.includes('price_cents integer') && mig.includes('price_cents >= 0'), '5. price_cents >=0 centavos')
assert(mig.includes("currency text") && mig.includes("default 'BRL'"), '6. currency BRL')
assert(mig.includes('is_active boolean') && mig.includes('default true'), '7. is_active default true')
assert(mig.includes('created_at') && mig.includes('updated_at'), '8. timestamps')
assert(mig.includes('check (currency = \'BRL\')'), '9. currency constraint BRL')
assert(!mig.includes('alter table public.access_grants') && !mig.includes('alter table public.user_state'), '10. não modifica access_grants/user_state')
assert(!mig.includes('create table public.orders') && !mig.includes('create table public.payments') && !mig.includes('webhook'), '11. não cria orders/payments/webhook')
assert(mig.includes('enable row level security'), '12. RLS habilitado')
assert(mig.includes('premium_plans_select_active') && mig.includes('is_active = true'), '13. policy select ativos para authenticated')
assert(!mig.includes('for insert to authenticated') && !mig.includes('for update to authenticated'), '14. sem insert/update para authenticated (só service_role)')
assert(!mig.includes('VIP_CHECK') && !mig.includes('requireVip'), '15. não ativa VIP_CHECK')

// Seed
assert(seed.includes('vip_monthly') && seed.includes('vip_lifetime'), '16. seed vip_monthly + vip_lifetime')
assert(seed.includes('ON CONFLICT (code) DO NOTHING'), '17. seed idempotente ON CONFLICT')
assert(seed.includes('price_cents') && seed.includes('1990') && seed.includes('9900'), '18. seed valores centavos 1990/9900')
assert(seed.includes('duration_days, price_cents') && seed.includes('NULL'), '19. seed vitalício duration_days NULL')
assert(seed.includes("currency, is_active") && seed.includes("'BRL'"), '20. seed BRL')
assert(seed.includes('IF EXISTS') && seed.includes('premium_plans'), '21. seed condicionado IF EXISTS (seguro reexecução)')
assert(!seed.includes('access_grants') && !seed.includes('orders'), '22. seed não cria grants/orders')

// Compatibilidade types
assert(types.includes('PremiumPlan') && types.includes('price_cents') && types.includes('duration_days'), '23. types compatível com schema (price_cents, duration_days null)')
assert(!types.includes('create table'), '24. types sem SQL')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas premium_plans.')
else console.log('✅ Premium plans contrato validado.')
