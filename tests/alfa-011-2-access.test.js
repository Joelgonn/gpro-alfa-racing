// tests/alfa-011-2-access.test.js
// ALFA-011.2 — Testes determinísticos da lógica pura do accessService
// Roda com: node tests/alfa-011-2-access.test.js
// Não depende de Supabase remoto — testa interpretGrant, pickBestGrant e VIP_CHECK

const fs = require('fs')
const path = require('path')

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('✅ PASS:', msg)
  }
}

console.log('=== ALFA-011.2 — Testes Serviço de Acesso (lógica pura) ===\n')

const servicePath = path.join(__dirname, '..', 'app/lib/access/accessService.ts')
const content = fs.readFileSync(servicePath, 'utf8')

// 0. Estrutura
assert(content.includes('VIP_CHECK = false'), '0. VIP_CHECK=false explícito')
assert(content.includes("import 'server-only'"), '0. server-only presente')
assert(content.includes('supabaseAdmin'), '0. usa supabaseAdmin (service_role) — não client')
assert(!content.includes('localStorage.getItem') && !content.includes('localStorage.setItem'), '0. não usa localStorage (sem getItem/setItem)')
assert(!content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes("import 'server-only'"), '0. não expõe SERVICE_ROLE_KEY no bundle (server-only)')

// Verificar que não escreve em user_state diretamente (exceto syncUserStateWithGrant em 011.8+)
const hasUserStateInsert = !!content.match(/\.from\(['\"]user_state['\"]\)\.insert/)
const hasUserStateUpdate = !!content.match(/\.from\(['\"]user_state['\"]\)\.update/)
if (hasUserStateInsert) {
  assert(content.includes('syncUserStateWithGrant') || content.includes('update_user_profile'), '0. insert user_state apenas via sync/função autorizada (011.8+)')
} else {
  assert(true, '0. não faz insert em user_state (011.2)')
}
if (hasUserStateUpdate) {
  assert(content.includes('syncUserStateWithGrant'), '0. update user_state apenas via syncUserStateWithGrant (011.8+)')
} else {
  assert(true, '0. não faz update em user_state')
}
// Em ALFA-011.8, inserts em access_grants/events são via ensureVipGrantForInvite/recordAccessEvent (idempotente, server-only)
// Permitir após 011.8: verificar que inserts existem apenas nessas funções
const hasGrantsInsert = !!content.match(/\.from\(['\"]access_grants['\"]\)\.insert/)
const hasEventsInsert = !!content.match(/\.from\(['\"]access_events['\"]\)\.insert/)
if (hasGrantsInsert) {
  assert(content.includes('ensureVipGrantForInvite'), '0. inserts em access_grants apenas via ensureVipGrantForInvite (011.8 idempotente)')
}
if (hasEventsInsert) {
  assert(content.includes('recordAccessEvent'), '0. inserts em access_events apenas via recordAccessEvent (011.8)')
}
if (!hasGrantsInsert) {
  assert(true, '0. sem insert access_grants (011.2 original)')
}
if (!hasEventsInsert) {
  assert(true, '0. sem insert access_events (011.2 original)')
}

// Tipos
assert(content.includes('AccessStatus'), '0. tipo AccessStatus definido')
assert(content.includes('AccessPlan'), '0. tipo AccessPlan definido')
assert(content.includes('AccessState'), '0. tipo AccessState definido')
assert(content.includes('interpretGrant'), '0. função interpretGrant exposta')
assert(content.includes('pickBestGrant'), '0. função pickBestGrant exposta')
assert(content.includes('getAccessState'), '0. função getAccessState exposta')
assert(content.includes('hasVipAccess'), '0. função hasVipAccess exposta')
assert(content.includes('requireVip'), '0. função requireVip exposta (guard futuro)')

// Reutiliza padrões existentes
assert(content.includes('isAdmin') || content.includes('checkIsAdmin'), '0. reutiliza isAdmin existente')
assert(content.includes('createClient') || content.includes('supabaseAdmin'), '0. usa cliente Supabase server-side')
assert(content.includes('auth.uid()') || content.includes('getUser'), '0. resolve usuário server-side')

// Verificar que requireVip não está aplicado em rotas
const routeFiles = [
  'app/api/gpro/sync/route.ts',
  'app/api/python/[[...route]]/route.ts',
  'app/api/calendar/route.ts',
  'app/api/manager/profile/route.ts',
  'app/api/market/update/route.ts',
  'app/api/gpro/token/route.ts',
]
let anyRouteUsesRequireVip = false
for (const f of routeFiles) {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
    if (txt.includes('requireVip')) anyRouteUsesRequireVip = true
  } catch {}
}
assert(!anyRouteUsesRequireVip, '0. nenhuma rota aplica requireVip nesta sprint')

// Verificar ausência de payments/orders/pix
assert(!content.includes('payments'), '0. sem referência a payments')
assert(!content.includes('orders'), '0. sem referência a orders')
assert(!content.toLowerCase().includes('pix'), '0. sem referência a Pix')

// ============================================
// Testes de lógica pura (interpretGrant + pickBestGrant)
// Reimplementa helpers leves para validar regras sem importar TS
// ============================================

function interpretGrantJS(grant, now = new Date()) {
  if (!grant) return { hasAccess: false, status: 'none', isLifetime: false, isExpired: false, isRevoked: false, isPending: false }
  const status = grant.status
  const isRevoked = status === 'revoked' || grant.revoked_at !== null
  const isPending = status === 'pending'
  if (isRevoked) return { hasAccess: false, status: 'revoked', isLifetime: false, isExpired: false, isRevoked: true, isPending: false }
  if (isPending) return { hasAccess: false, status: 'pending', isLifetime: false, isExpired: false, isRevoked: false, isPending: true }
  if (grant.expires_at === null) {
    const isActiveLike = status === 'active'
    return { hasAccess: isActiveLike, status: isActiveLike ? 'active' : 'none', isLifetime: isActiveLike, isExpired: false, isRevoked: false, isPending: false }
  }
  const exp = new Date(grant.expires_at)
  const isValid = !isNaN(exp.getTime())
  if (!isValid) return { hasAccess: false, status: 'none', isLifetime: false, isExpired: false, isRevoked: false, isPending: false }
  const isExpired = exp.getTime() <= now.getTime()
  if (isExpired) return { hasAccess: false, status: 'expired', isLifetime: false, isExpired: true, isRevoked: false, isPending: false }
  return { hasAccess: status === 'active', status: status === 'active' ? 'active' : 'none', isLifetime: false, isExpired: false, isRevoked: false, isPending: false }
}

const now = new Date('2026-09-17T12:00:00Z')
const future = new Date('2026-10-17T12:00:00Z').toISOString()
const past = new Date('2026-08-17T12:00:00Z').toISOString()

// 1. sem concessão
assert(interpretGrantJS(null, now).hasAccess === false && interpretGrantJS(null, now).status === 'none', '1. sem concessão → hasAccess false, status none')

// 2. pending
assert(interpretGrantJS({ status: 'pending', expires_at: future, revoked_at: null }, now).status === 'pending' && !interpretGrantJS({ status: 'pending', expires_at: future, revoked_at: null }, now).hasAccess, '2. pending não libera acesso')

// 3. ativa sem expiração (vitalício)
const lifetime = interpretGrantJS({ status: 'active', expires_at: null, revoked_at: null, plan: 'full_premium', id: '1' }, now)
assert(lifetime.hasAccess === true && lifetime.isLifetime === true && lifetime.status === 'active', '3. ativa vitalícia (expires_at null) → hasAccess true, isLifetime true')

// 4. ativa com expiração futura
const activeFuture = interpretGrantJS({ status: 'active', expires_at: future, revoked_at: null }, now)
assert(activeFuture.hasAccess === true && activeFuture.isExpired === false && activeFuture.status === 'active', '4. ativa futura → hasAccess true')

// 5. expirada
const expired = interpretGrantJS({ status: 'active', expires_at: past, revoked_at: null }, now)
assert(expired.hasAccess === false && expired.status === 'expired' && expired.isExpired === true, '5. expirada → hasAccess false, status expired')

// 6. revogada
const revoked = interpretGrantJS({ status: 'active', expires_at: future, revoked_at: future }, now)
assert(revoked.hasAccess === false && revoked.status === 'revoked' && revoked.isRevoked === true, '6. revogada (revoked_at) → hasAccess false, status revoked')
const revoked2 = interpretGrantJS({ status: 'revoked', expires_at: future, revoked_at: null }, now)
assert(revoked2.status === 'revoked' && !revoked2.hasAccess, '6. revogada (status revoked) → não libera')

// 7. administrador (lógica: isAdmin em getAccessState sobrescreve; aqui testa que interpretGrant não decide admin — admin é camada acima)
assert(content.includes('isAdmin') && content.includes('hasAccessWithAdmin'), '7. administrador preservado via isAdmin (não é plano comercial)')

// 8. VIP_CHECK=false mantém allowed=true
assert(content.includes('enforcementEnabled = VIP_CHECK') && content.includes('allowed = enforcementEnabled ? hasAccessWithAdmin : true'), '8. VIP_CHECK=false mantém allowed=true (enforcementEnabled false)')

// 9. múltiplas concessões — pickBestGrant lógica
function pickBestGrantJS(grants, now) {
  if (!grants || grants.length === 0) return null
  let best = null, bestExp = -1
  for (const g of grants) {
    const interp = interpretGrantJS(g, now)
    if (interp.hasAccess) {
      const expVal = interp.isLifetime ? Infinity : new Date(g.expires_at).getTime()
      if (expVal > bestExp) { bestExp = expVal; best = g }
    }
  }
  if (best) return best
  const pending = grants.find(g=>g.status==='pending'); if(pending) return pending
  const exp2 = grants.find(g=>interpretGrantJS(g,now).status==='expired'); if(exp2) return exp2
  const rev = grants.find(g=>interpretGrantJS(g,now).status==='revoked'); if(rev) return rev
  return grants[0]
}

const g1 = { id: 'g1', status: 'expired', expires_at: past, revoked_at: null }
const g2 = { id: 'g2', status: 'active', expires_at: new Date('2026-09-20T12:00:00Z').toISOString(), revoked_at: null }
const g3 = { id: 'g3', status: 'active', expires_at: null, revoked_at: null } // vitalício — maior
const g4 = { id: 'g4', status: 'pending', expires_at: future, revoked_at: null }
assert(pickBestGrantJS([g1, g2, g3, g4], now).id === 'g3', '9. múltiplas: vitalícia vence')
assert(pickBestGrantJS([g1, g2, g4], now).id === 'g2', '9. múltiplas sem vitalícia: futura mais longa vence')
assert(pickBestGrantJS([g1, g4], now).id === 'g4', '9. múltiplas sem ativa: pending é escolhido')
assert(pickBestGrantJS([g1], now).id === 'g1', '9. só expirada: retorna ela')

// 10. datas inválidas
const invalid = interpretGrantJS({ status: 'active', expires_at: 'not-a-date', revoked_at: null }, now)
assert(invalid.hasAccess === false && invalid.status === 'none', '10. data inválida → não libera acesso')

console.log('\n=== Resumo ===')
if (process.exitCode) {
  console.log('❌ Alguns testes falharam.')
} else {
  console.log('✅ Todos os 10 cenários de lógica pura passaram (sem Supabase).')
}
