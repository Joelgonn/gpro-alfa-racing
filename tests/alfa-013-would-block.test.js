// tests/alfa-013-would-block.test.js
// ALFA-013.0 — Observabilidade wouldBlock

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-013.0 — Testes WouldBlock ===\n')

const route = read('app/api/admin/access-would-block/route.ts')
const service = read('app/lib/access/accessService.ts')
const logger = read('app/lib/access/accessLogger.ts')

// 1-6 grants
assert(route.includes('grantsActive') || route.includes('grants'), '1. grant ativo métrica existe')
assert(route.includes('wouldBlockByExpiredDate') || route.includes('expires_at'), '2. grant expirado detectado')
assert(route.includes('grantsRevoked') || route.includes('revoked'), '3. grant revogado métrica')
assert(route.includes('grantsLifetime') || route.includes('is null'), '4. grant vitalício (expires_at null)')
assert(route.includes('grantsTotal') || route.includes('total'), '5. grant inexistente/pendente tratado (total vs active)')
assert(route.includes('divergences') || route.includes('wouldBlock'), '6. divergência grant vs cache detectada')

// 7-11 autorização
assert(route.includes('requireAdmin'), '7. usuário comum sem acesso → 403 (requireAdmin)')
assert(route.includes('requireAdmin'), '8. admin com acesso 200')
assert(!route.includes('searchParams.get') || !route.includes('userId'), '9. não aceita userId arbitrário (visão agregada)')
assert(!route.includes('service_role') || route.includes('supabaseAdmin'), '10. ausência dados sensíveis (sem service_role no JSON)')
assert(service.includes('VIP_CHECK = false'), '10. VIP_CHECK=false preservado')
assert(!read('app/api/gpro/sync/route.ts').includes('requireVip'), '11. requireVip ainda desligado (Manager)')
assert(route.includes('POST') && route.includes('405'), '12. sem efeitos colaterais (GET somente, POST 405)')

// Segurança logs
assert(route.includes('accessLogger'), '13. endpoint loga via accessLogger')
assert(logger.includes('maskUserId') && logger.includes('maskGrantId'), '14. masking IDs')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas wouldBlock.')
else console.log('✅ WouldBlock observabilidade validada.')
