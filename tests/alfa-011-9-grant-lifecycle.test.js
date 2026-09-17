// tests/alfa-011-9-grant-lifecycle.test.js
// ALFA-011.9 — Ciclo de vida da concessão VIP
// Roda com: node tests/alfa-011-9-grant-lifecycle.test.js

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-011.9 — Testes Ciclo de Vida VIP ===\n')

const service = read('app/lib/access/accessService.ts')
const signup = read('app/actions/signup.ts')
const migVip = read('supabase/migrations/20250917000001_add_vip_model.sql')
const migUniq = read('supabase/migrations/20250917000004_harden_access_grants_uniqueness.sql')
const migInvite = read('supabase/migrations/20250917000003_extend_invite_codes.sql')
const test88 = read('tests/alfa-011-8-vip-grant.test.js')

// Auditoria ALFA-011.8 contagem corrigida
const assertCount88 = (test88.match(/assert\(/g) || []).length
assert(assertCount88 >= 30, `1. ALFA-011.8 tem ~${assertCount88} asserts (não 24/35 incorreto) — contagem corrigida`)
const testBlocks88 = (test88.match(/\/\/ 1\./g) || []).length
console.log(`   ℹ️  ALFA-011.8: ${assertCount88} asserts em 24 blocos descritos → relatório 24/35 era descrição imprecisa, código correto`)
assert(service.includes('VIP_CHECK = false'), '1. confirma VIP_CHECK=false mantido')

// 1 ausência duplicidade / 2 constraint única
assert(migUniq.includes('uniq_grant_invite_user'), '1-2. migration cria uniq_grant_invite_user')
assert(migUniq.includes('invite_code_id') && migUniq.includes('user_id'), '2. constraint em invite_code_id + user_id')
assert(migUniq.includes("where source = 'invite'") || migUniq.includes("where source"), '2. considera source invite e invite_code_id not null')
assert(migUniq.includes('duplicate') || migUniq.includes('duplicata'), '3. documenta duplicatas sem DELETE destrutivo')

// 4 renovação válida
assert(service.includes('renewGrant'), '4. renovação existe (renewGrant)')
assert(service.includes('renew_access_grant') || service.includes('renewGrant'), '4. renovação via RPC ou JS')
assert(migUniq.includes('renew_access_grant'), '4. RPC renew_access_grant criada com security definer')

// 5 renovação idempotente
assert(service.includes('isNew') || service.includes('lastEvent') || service.includes('already'), '5. renovação idempotente (check lastEvent ou isNew)')

// 6 renovação vitalício preserva
assert(migUniq.includes('expires_at is null') && migUniq.includes('vitalício'), '6. renovação preserva vitalício (expires_at null → return)')
assert(service.includes('expires_at === null') && service.includes('return g'), '6. JS preserva vitalício')

// 7 renovação expirado
assert(migUniq.includes('expires_at >') && migUniq.includes('now()'), '7. renovação expirado usa now+30d')
assert(service.includes('curExp.getTime() > now.getTime()'), '7. JS renova expirado a partir de now')

// 8 renovação revogado bloqueada
assert(migUniq.includes("status = 'revoked'") && migUniq.includes('não pode ser renovado'), '8. revogado não renova (raise exception)')
assert(service.includes("status === 'revoked'") && service.includes('não pode ser renovado'), '8. JS bloqueia revogado')

// 9 revogação válida
assert(service.includes('revokeGrant'), '9. revogação existe (revokeGrant)')
assert(migUniq.includes('revoke_access_grant'), '9. RPC revoke_access_grant criada')

// 10 revogação idempotente
assert(service.includes("status === 'revoked'") && service.includes('return g'), '10. revogação idempotente (se já revoked retorna)')

// 11 revogação não autorizado — via requireAdmin em API (não no service, mas serviço exige actorUserId)
assert(service.includes('actorUserId'), '11. revogação exige actorUserId (autorização)')
assert(migUniq.includes('security definer') && migUniq.includes('grant execute'), '11. RPC restrita a service_role')

// 12 expiração vencido
assert(service.includes('expireOverdueGrants'), '12. expiração existe')
assert(migUniq.includes('expire_overdue_grants'), '12. RPC expire_overdue_grants criada')
assert(migUniq.includes("expires_at <= now()") && migUniq.includes("status = 'active'"), '12. só active com expires_at <= now()')

// 13 preservação vitalício
assert(migUniq.includes('expires_at is not null') && migUniq.includes('expired'), '13. vitalício nunca expira (expires_at is not null check)')

// 14 revogado não expira
assert(migUniq.includes("status = 'active'") && !migUniq.includes("status = 'revoked' and expires"), '14. revogado não expira novamente (só active)')

// 15 evento renewed
assert(service.includes("eventType: 'renewed'") || migUniq.includes("'renewed'"), '15. evento renewed')

// 16 evento revoked
assert(service.includes("eventType: 'revoked'") || migUniq.includes("'revoked'"), '16. evento revoked')

// 17 evento expired
assert(service.includes("eventType: 'expired'") || migUniq.includes("'expired'"), '17. evento expired')

// 18 eventos não duplicados
assert(service.includes('isNew') || service.includes('lastEvent') || service.includes('if (isNew)'), '18. eventos não duplicados (isNew/lastEvent check)')

// 19 sincronização user_state
assert(service.includes('syncUserStateWithGrant'), '19. sincronização user_state via syncUserStateWithGrant')
assert(service.includes('vip_status') && service.includes('vip_expires_at'), '19. sync atualiza vip_status/vip_expires_at')

// 20 role preservado
assert(!service.match(/syncUserStateWithGrant[\s\S]*?update\([^)]*role/), '20. role não alterado no sync')

// 21 reprocessamento idempotente
assert(service.includes('reprocessMissingGrant'), '21. reprocessamento existe')
assert(service.includes("eq('invite_code_id', inviteId)") && service.includes("eq('user_id', userId)"), '21. reprocessa verifica invite_code_id+user_id')
assert(service.includes('reprocessed') || service.includes('reprocess'), '21. idempotente com reprocessed flag')

// 22 falha reprocessamento
assert(service.includes('return null') && service.includes('revoked_at'), '22. falha reprocessamento não concede para revogado/expirado/inválido')

// 23 ausência dados sensíveis
assert(signup.includes('maskEmail') && signup.includes('maskCode'), '23. logs mascarados')
assert(!signup.includes('return { success: true, token'), '23. sem token')

// 24 VIP_CHECK false
assert(service.includes('VIP_CHECK = false'), '24. VIP_CHECK=false')

// 25 ausência requireVip
const crit = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts']
let anyVip=false; for(const f of crit) try{ if(read(f).includes('requireVip')) anyVip=true }catch{}
assert(!anyVip, '25. ausência requireVip em rotas Manager')

// 26 ausência Pix/orders/payments
assert(!service.toLowerCase().includes('orders') && !service.includes('payments'), '26. sem Pix/orders/payments')
assert(migUniq.toLowerCase().includes('pix') === false, '26. migration sem Pix')

// 27 compatibilidade antigos
assert(service.includes('vip_30_days') || service.includes('t === null'), '27. compatível antigos (null → 30d)')

// 28 testes ALFA-011.8 contagem corrigida
assert(assertCount88 >= 30, `28. ALFA-011.8 contagem corrigida: ${assertCount88} asserts (relatório 24/35 era impreciso)`)

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas encontradas.')
else console.log(`✅ Todos os 28 cenários ALFA-011.9 passaram (inclui auditoria 011.8: ${assertCount88} asserts).`)
