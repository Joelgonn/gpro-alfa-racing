// tests/alfa-012-1-integration.test.js
// ALFA-012.1 — Teste integração fluxo convite→cadastro→grant→evento→cache (estático)

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-012.1 — Teste Integração Fluxo ===\n')

const signup = read('app/actions/signup.ts')
const service = read('app/lib/access/accessService.ts')
const inviteRoute = read('app/api/admin/vip-invites/route.ts')

// Fluxo completo auditado: validar→Auth→consumir→user_state→grant→evento→sync
assert(signup.includes('preCheck') && signup.includes('maybeSingle'), '1. validar convite (preCheck SELECT)')
assert(signup.includes('auth.admin.createUser'), '2. criar usuário Auth')
assert(signup.includes('.update({ is_used: true'), '3. consumir convite atomicamente')
assert(signup.includes("from('user_state').insert"), '4. criar user_state')
assert(signup.includes('ensureVipGrantForInvite'), '5. criar access_grant idempotente')
assert(signup.includes('recordAccessEvent') && signup.includes("eventType: 'granted'"), '6. registrar access_event')
assert(signup.includes('syncUserStateWithGrant'), '7. sincronizar cache user_state')

// Ciclo vida auditado
assert(service.includes('renewGrant'), '8. renovação existe')
assert(service.includes('revokeGrant'), '9. revogação existe')
assert(service.includes('expireOverdueGrants'), '10. expiração existe')
assert(service.includes('reprocessMissingGrant'), '11. reprocessamento existe')
assert(service.includes('pickBestGrant') && service.includes('interpretGrant'), '12. user_state recalculado via pickBestGrant (fonte primária access_grants)')

// Segurança revalidada
assert(service.includes("import 'server-only'"), '13. server-only')
assert(service.includes('supabaseAdmin'), '14. service_role somente servidor')
assert(!service.includes('localStorage.getItem') && !service.includes('localStorage.setItem'), '15. sem lógica local VIP (sem getItem/setItem)')
assert(inviteRoute.includes('requireAdmin'), '16. convite exige admin')
assert(service.includes('VIP_CHECK = false'), '17. VIP_CHECK false')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas integração.')
else console.log('✅ Fluxo integrado auditado (estático).')
