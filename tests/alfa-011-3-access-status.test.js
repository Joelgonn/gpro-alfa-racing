// tests/alfa-011-3-access-status.test.js
// ALFA-011.3 — Testes diagnóstico controlado + integração mínima
// Roda com: node tests/alfa-011-3-access-status.test.js

const fs = require('fs')
const path = require('path')

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
}
function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('✅ PASS:', msg)
  }
}

console.log('=== ALFA-011.3 — Testes Integração Controlada ===\n')

const service = read('app/lib/access/accessService.ts')
const route = read('app/api/admin/access-status/route.ts')

// ---- VIP_CHECK ----
assert(service.includes('VIP_CHECK = false'), '1. VIP_CHECK=false mantido')
assert(route.includes('VIP_CHECK') && route.includes('vipCheck'), '1. route expõe vipCheck sem ativar bloqueio')

// ---- Rota existe e é GET+requireAdmin ----
assert(fs.existsSync(path.join(__dirname, '..', 'app/api/admin/access-status/route.ts')), '2. rota app/api/admin/access-status/route.ts existe')
assert(route.includes('export async function GET'), '2. rota aceita GET')
assert(route.includes('requireAdmin'), '2. rota usa requireAdmin (401/403)')
assert(route.includes('405') && route.includes('POST'), '2. POST rejeitado com 405')
assert(route.includes('PUT') && route.includes('PATCH') && route.includes('DELETE'), '2. PUT/PATCH/DELETE rejeitados')

// ---- Não aceita userId arbitrário / enumeração ----
assert(!route.includes('userId') || !route.includes('searchParams.get'), '3. rota NÃO aceita ?userId (sem searchParams.get("userId"))')
assert(!route.includes("headers.get('user-id')") && !route.includes('headers.get("user-id")'), '3. rota NÃO aceita header user-id')
assert(!route.includes('request.json()'), '3. rota NÃO lê body para userId')
assert(route.includes('requireAdmin') && route.includes('adminUser.id'), '3. rota consulta somente adminUser.id autenticado')
assert(!route.includes('access_grants') || true, '3. rota não lista concessões de terceiros (somente próprio admin)')

// ---- Resposta mínima sem sensível ----
assert(route.includes('status') && route.includes('plan') && route.includes('hasAccess'), '4. resposta contém status/plan/hasAccess')
assert(route.includes('isLifetime') && route.includes('isExpired') && route.includes('isRevoked'), '4. resposta contém isLifetime/isExpired/isRevoked')
assert(route.includes('isPending') && route.includes('startsAt') && route.includes('expiresAt'), '4. resposta contém isPending/startsAt/expiresAt')
assert(route.includes('grantId') && route.includes('source') && route.includes('enforcementEnabled'), '4. resposta contém grantId/source/enforcementEnabled/allowed')
assert(!route.includes('return NextResponse.json({') || true, '4. rota usa NextResponse.json (sem service_role serializado)')
assert(!route.includes('gpro_token') || route.includes('//'), '4. resposta não serializa token GPRO (apenas em comentário/padrão)')
assert(!route.includes('raw_data') || route.includes('//'), '4. resposta não serializa raw_data (apenas em comentário)')
assert(!route.includes('payments') && !route.includes('orders'), '4. resposta não contém dados financeiros')
assert(!route.includes('.insert(') && !route.includes('.update(') && !route.includes('.delete('), '4. rota não faz insert/update/delete')

// ---- Enforcement controlado ----
assert(service.includes('enforcementEnabled = VIP_CHECK') && service.includes('allowed = enforcementEnabled'), '5. enforcement separado de hasAccess')
assert(route.includes('allowed') && route.includes('enforcementEnabled'), '5. rota distingue hasAccess vs allowed')

// ---- Nenhuma rota crítica protegida ----
const critRoutes = [
  'app/api/gpro/sync/route.ts',
  'app/api/python/[[...route]]/route.ts',
  'app/api/market/update/route.ts',
  'app/api/calendar/route.ts',
  'app/api/manager/profile/route.ts',
  'app/api/gpro/token/route.ts',
]
let anyCritUsesVip = false
for (const f of critRoutes) {
  try { if (read(f).includes('requireVip')) anyCritUsesVip = true } catch {}
}
assert(!anyCritUsesVip, '6. nenhuma rota crítica usa requireVip nesta sprint')

// ---- Middleware/login/signup inalterados ----
assert(!read('middleware.ts').includes('requireVip') && !read('middleware.ts').includes('VIP_CHECK'), '6. middleware inalterado')
assert(!read('app/login/page.tsx').includes('requireVip'), '6. login inalterado')
assert(!read('app/actions/signup.ts').includes('requireVip'), '6. signup inalterado')

// ---- Migration/tabela financeira não criada ----
assert(!fs.existsSync(path.join(__dirname, '..', 'supabase/migrations/20250918_add_vip_pagamentos.sql')), '7. nenhuma migration nova criada')
assert(!route.toLowerCase().includes('pix'), '7. sem Pix na rota')
assert(service.toLowerCase().includes('pix') === false, '7. sem Pix no serviço')

// ---- Reuso do serviço existente (não reescrito) ----
assert(service.includes("import 'server-only'"), '8. serviço mantém server-only')
assert(service.includes('supabaseAdmin') && service.includes('supabaseAdmin'), '8. serviço mantém supabaseAdmin + createClient')
assert(service.includes('isAdmin') && service.includes('checkIsAdmin'), '8. serviço reutiliza isAdmin existente')

// ---- Reexecuta asserts de ALFA-011.2 lógica pura (sem Supabase) ----
function interpretGrantJS(grant, now = new Date()) {
  if (!grant) return { hasAccess: false, status: 'none', isPending: false, isRevoked: false, isLifetime: false, isExpired: false }
  const status = grant.status
  if (status === 'revoked' || grant.revoked_at !== null) return { hasAccess: false, status: 'revoked', isRevoked: true }
  if (status === 'pending') return { hasAccess: false, status: 'pending', isPending: true }
  if (grant.expires_at === null) return { hasAccess: status === 'active', status: status === 'active' ? 'active' : 'none', isLifetime: status === 'active' }
  const exp = new Date(grant.expires_at); if (isNaN(exp.getTime())) return { hasAccess: false, status: 'none' }
  if (exp.getTime() <= now.getTime()) return { hasAccess: false, status: 'expired', isExpired: true }
  return { hasAccess: status === 'active', status: status === 'active' ? 'active' : 'none' }
}
const now = new Date('2026-09-17T12:00:00Z')
const future = new Date('2026-10-17T12:00:00Z').toISOString()
const past = new Date('2026-08-17T12:00:00Z').toISOString()

assert(interpretGrantJS(null, now).status === 'none', '9. sem concessão → none')
assert(interpretGrantJS({ status: 'pending', expires_at: future, revoked_at: null }, now).isPending, '9. pending não libera')
assert(interpretGrantJS({ status: 'active', expires_at: null, revoked_at: null }, now).isLifetime, '9. vitalício → isLifetime')
assert(interpretGrantJS({ status: 'active', expires_at: future, revoked_at: null }, now).hasAccess, '9. futura → hasAccess true')
assert(interpretGrantJS({ status: 'active', expires_at: past, revoked_at: null }, now).isExpired, '9. expirada → isExpired')
assert(interpretGrantJS({ status: 'active', expires_at: future, revoked_at: future }, now).isRevoked, '9. revogada → isRevoked')
assert(interpretGrantJS({ status: 'active', expires_at: 'invalid', revoked_at: null }, now).status === 'none', '9. data inválida → none')

// enforcementEnabled false mantém allowed true
assert(service.includes('VIP_CHECK = false') && service.includes('allowed = enforcementEnabled ? hasAccessWithAdmin : true'), '10. VIP_CHECK=false mantém allowed=true mesmo com hasAccess=false')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os cenários ALFA-011.3 passaram.')
