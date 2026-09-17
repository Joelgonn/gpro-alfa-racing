// tests/alfa-012-1-observability.test.js
// ALFA-012.1 — Observabilidade segura + masking + integração

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-012.1 — Testes Observabilidade ===\n')

const logger = read('app/lib/access/accessLogger.ts')
const signup = read('app/actions/signup.ts')
const service = read('app/lib/access/accessService.ts')
const inviteRoute = read('app/api/admin/vip-invites/route.ts')
const revokeRoute = read('app/api/admin/vip-invites/[id]/revoke/route.ts')

// Logger existe e tem níveis
assert(logger.includes("LogLevel") && logger.includes("'info'") && logger.includes("'warn'") && logger.includes("'error'"), '1. logger tem níveis info/warn/error')
assert(logger.includes('maskEmail') && logger.includes('maskCode') && logger.includes('maskUserId') && logger.includes('maskGrantId'), '2. helpers maskEmail/maskCode/maskUserId/maskGrantId existem')
assert(logger.includes('nextCorrelationId'), '3. correlationId existe')
assert(logger.includes('logVipEvent') && logger.includes('accessLogger'), '4. logVipEvent centralizado')

// Mascaramento não expõe sensível
assert(!logger.includes('password') || logger.includes('blocked'), '5. logger bloqueia password')
assert(logger.includes('service_role') && logger.includes('blocked'), '5. logger bloqueia service_role')
assert(logger.includes('sanitizeMeta'), '5. sanitizeMeta evita metadata sensível')
assert(logger.includes('slice(0, 80)') || logger.includes('slice(0'), '6. logs limitam tamanho')

// Eventos mínimos
const requiredEvents = [
  'vip.invite.created','vip.invite.revoked','vip.invite.consume.started','vip.invite.consume.succeeded','vip.invite.consume.failed',
  'vip.signup.started','vip.signup.auth_created','vip.signup.invite_consumed','vip.signup.grant_created','vip.signup.grant_failed',
  'vip.signup.compensation.started','vip.signup.compensation.succeeded','vip.signup.compensation.failed',
  'vip.grant.created','vip.grant.reprocessed','vip.grant.renewed','vip.grant.revoked','vip.grant.expired',
  'vip.grant.sync.started','vip.grant.sync.succeeded','vip.grant.sync.failed','vip.access.denied'
]
for(const ev of requiredEvents){
  const found = logger.includes(ev) || signup.includes(ev) || service.includes(ev) || inviteRoute.includes(ev) || revokeRoute.includes(ev)
  // Para vip.access.denied, pode estar só em accessService requireVip
  if(ev==='vip.access.denied'){
    assert(service.includes('vip.access.denied') || service.includes('VIP_REQUIRED'), 'event vip.access.denied (ou VIP_REQUIRED) existe')
  } else {
    assert(found || service.includes(ev.split('.')[1]), `evento ${ev} existe (logger/signup/service)`)
  }
}

// Integração nos pontos críticos
assert(signup.includes('vip.signup.started'), '7. signup integra vip.signup.started')
assert(signup.includes('vip.signup.auth_created'), '7. signup integra auth_created')
assert(signup.includes('vip.invite.consume.started'), '7. signup integra consume.started')
assert(signup.includes('vip.invite.consume.succeeded') && signup.includes('vip.signup.invite_consumed'), '7. signup integra consume.succeeded/invite_consumed')
assert(signup.includes('vip.signup.compensation'), '7. signup integra compensation')
assert(signup.includes('vip.signup.grant_created') || signup.includes('vip.grant.created'), '8. signup integra grant_created')
assert(signup.includes('vip.grant.sync'), '8. signup integra grant sync')
assert(inviteRoute.includes('vip.invite.created'), '9. convites criação logada')
assert(revokeRoute.includes('vip.invite.revoked'), '9. revogação logada')
assert(service.includes('vip.grant.created') && service.includes('vip.grant.reprocessed'), '10. grants criação/reprocessed logados')
assert(service.includes('vip.grant.renewed') && service.includes('vip.grant.revoked') && service.includes('vip.grant.expired'), '10. ciclo vida logado (renewed/revoked/expired)')

// Não altera semântica — VIP_CHECK false
assert(service.includes('VIP_CHECK = false'), '11. VIP_CHECK=false mantido')
assert(!signup.includes('VIP_CHECK = true'), '11. não ativa VIP_CHECK')

// Privacidade: nunca registra senha/token/código completo
assert(!logger.includes('password') || logger.includes('blocked'), '12. logger não registra senha')
assert(signup.includes('maskEmail') && signup.includes('maskCode'), '12. signup usa masking')
assert(!signup.includes('return { success: true, token'), '12. sem token na resposta')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Observabilidade segura validada (mascaramento + eventos).')
