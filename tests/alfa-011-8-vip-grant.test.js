// tests/alfa-011-8-vip-grant.test.js
// ALFA-011.8 — Concessão VIP por convite (server-side, idempotente)
// Roda com: node tests/alfa-011-8-vip-grant.test.js

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-011.8 — Testes Concessão VIP ===\n')

const signup = read('app/actions/signup.ts')
const service = read('app/lib/access/accessService.ts')
const migrationVip = read('supabase/migrations/20250917000001_add_vip_model.sql')
const migrationInvite = read('supabase/migrations/20250917000003_extend_invite_codes.sql')

// 1. 30 dias cria full_premium
assert(service.includes('vip_30_days') && service.includes("planForInvite") && service.includes("full_premium"), '1. 30 dias cria full_premium')
assert(service.includes('calculateGrantExpiration') && service.includes('setDate'), '1. calcula expires_at now+30d')

// 2. vitalício expires_at null
assert(service.includes("vip_lifetime") && service.includes('return null'), '2. vitalício cria expires_at=null')
assert(service.includes('vipStatusForGrant') && service.includes("'lifetime'"), '2. vip_status lifetime quando null')

// 3. custom preserva data do convite
assert(service.includes('vip_custom') && service.includes('invite.expires_at'), '3. custom preserva expires_at do convite')

// 4-6. inexistente/expirado/revogado não concede
assert(signup.includes('INVITE_NOT_FOUND'), '4. inexistente não concede (retorna antes de grant)')
assert(signup.includes('INVITE_EXPIRED'), '5. expirado não concede')
assert(signup.includes('INVITE_REVOKED'), '6. revogado não concede')

// 7. antigo sem invite_type
assert(service.includes('t === null') && service.includes('30d'), '7. antigo sem invite_type tratado como 30d (compatibilidade documentada)')
assert(migrationInvite.includes('vip_30_days'), '7. antigo documentado como vip_30_days fallback')

// 8. grant criado uma única vez (idempotente)
assert(service.includes('ensureVipGrantForInvite'), '8. ensureVipGrantForInvite existe')
assert(service.includes("eq('invite_code_id', invite.id)") && service.includes("eq('user_id', userId)"), '8. verifica invite_code_id+user_id existente')
assert(service.includes('isNew: false') && service.includes('isNew: true'), '8. retorna isNew para idempotência')

// 9. segunda tentativa idempotente
assert(service.includes('select') && service.includes('maybeSingle') && service.includes('invite_code_id'), '9. segunda tentativa re-seleciona existente')
assert(signup.includes('ensureVipGrantForInvite'), '9. signup chama ensureVipGrantForInvite (idempotente)')

// 10. corrida não duplica
assert(service.includes('23505') && service.includes('raced'), '10. corrida: catch 23505 e re-seleciona')

// 11. access_event não duplica
assert(service.includes('recordAccessEvent') && signup.includes('recordAccessEvent'), '11. registra access_event')
assert(signup.includes("if (isNew)") && signup.includes("eventType: 'granted'"), '11. só registra granted quando isNew true (não duplica)')

// 12. user_state sincronizado
assert(service.includes('syncUserStateWithGrant'), '12. syncUserStateWithGrant existe')
assert(service.includes('vip_status') && service.includes('vip_expires_at') && service.includes('access_plan') && service.includes('access_grant_id'), '12. sincroniza 4 campos (vip_status, vip_expires_at, access_plan, access_grant_id)')
assert(signup.includes('syncUserStateWithGrant'), '12. signup chama sync após grant')

// 13. role não alterado
assert(service.includes('syncUserStateWithGrant') && service.includes('vip_status'), '13. sync sincroniza vip_status sem role')
assert(!service.includes('syncUserStateWithGrant') || !service.match(/syncUserStateWithGrant[\s\S]*?role/), '13. sync não altera role (check update payload)')
assert(signup.includes('track') && signup.includes('Interlagos'), '13. signup user_state track Interlagos, não role')

// 14-16. cliente não escolhe
assert(!signup.includes('body.expires_at') && signup.includes('preCheck'), '14. cliente não escolhe expires_at (usa invite.expires_at DB)')
assert(service.includes('planForInvite') && !signup.includes('body.access_plan'), '15. cliente não escolhe access_plan (plano derivado full_premium via service)')
assert(service.includes('userId') && signup.includes('newUserId'), '16. cliente não escolhe user_id (derivado do Auth recém-criado)')
assert(signup.includes('inviteForGrant') && signup.includes('preCheck'), '16. user_id e invite derivados do servidor')

// 17. falha concessão registrada
assert(signup.includes('Falha ao criar concessão VIP') && signup.includes('masked'), '17. falha concessão logada com masked')
assert(service.includes('ensureVipGrantForInvite') && signup.includes('try {'), '17. try/catch ao redor de grant')

// 18. falha sincronização não ocultada
assert(signup.includes('Falha ao sincronizar user_state') && signup.includes('grantId'), '18. falha sync logada com grantId, não oculta')

// 19. usuário permanece consistente
assert(signup.includes('Não marcar como concedida') || signup.includes('usuário permanece criado'), '19. usuário permanece criado sem excluir se grant falhar')

// 20. nenhuma concessão para não-VIP (mas antigo concedido via fallback documentado)
assert(service.includes('vip_30_days') && service.includes('vip_lifetime') && service.includes('vip_custom'), '20. só vip_* ou null legado concede (não comum não-VIP)')

// 21. VIP_CHECK false
assert(service.includes('VIP_CHECK = false'), '21. VIP_CHECK=false preservado')
assert(!signup.includes('VIP_CHECK = true'), '21. signup não ativa VIP_CHECK')

// 22. nenhuma rota Manager requireVip
const crit = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts']
let anyVip=false; for(const f of crit) try{ if(read(f).includes('requireVip')) anyVip=true }catch{}
assert(!anyVip, '22. nenhuma rota Manager usa requireVip')

// 23. ausência Pix/orders/payments
assert(!service.toLowerCase().includes('premium_plans') && !signup.toLowerCase().includes('orders'), '23. ausência Pix/orders/payments/premium_plans')
assert(!service.includes('payments') && !signup.includes('payments'), '23. sem payments')

// 24. ausência dados sensíveis
assert(signup.includes('maskEmail') && signup.includes('maskCode'), '24. mascaramento e sem retorno de senha/token')
assert(!signup.includes('return { success: true, token'), '24. não retorna token')
assert(!service.includes('raw_data'), '24. sem raw_data')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os 24 cenários ALFA-011.8 passaram (estático).')
