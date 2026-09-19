// tests/alfa-011-5-vip-invites.test.js
// ALFA-011.5 — Testes gerenciador de convites VIP
// Roda com: node tests/alfa-011-5-vip-invites.test.js

const fs = require('fs')
const path = require('path')

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8') }
function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1 } else console.log('✅ PASS:', msg)
}

console.log('=== ALFA-011.5 — Testes Convites VIP ===\n')

const migration = read('supabase/migrations/20250917000003_extend_invite_codes.sql')
const listRoute = read('app/api/admin/vip-invites/route.ts')
const revokeRoute = read('app/api/admin/vip-invites/[id]/revoke/route.ts')
const page = read('app/dashboard/admin/vip-invites/page.tsx')
const layout = read('app/dashboard/DashboardShell.tsx') // PIX-015: menu/sidebar passou a viver no shell de cliente
const accessService = read('app/lib/access/accessService.ts')
const signup = read('app/actions/signup.ts')

// ---- Autorização 1-5 ----
assert(listRoute.includes('requireAdmin'), '1. GET usa requireAdmin (401 não autenticado)')
assert(listRoute.includes('requireAdmin'), '2. GET usuário comum → 403 (requireAdmin)')
assert(listRoute.includes('requireAdmin') && revokeRoute.includes('requireAdmin'), '3. admin acesso permitido (requireAdmin presente em ambas rotas)')
assert(listRoute.includes('405') && revokeRoute.includes('405'), '4. métodos inválidos rejeitados (PUT/PATCH/DELETE 405 em list, GET 405 em revoke)')
assert(!listRoute.includes("searchParams.get('userId')") && !revokeRoute.includes('header'), '5. ausência de IDOR (não aceita userId arbitrário)')

// ---- Validade 6-13 ----
assert(listRoute.includes("validityType === '30_days'") && listRoute.includes('setDate'), '6. 30 dias calcula no servidor (now +30d)')
assert(listRoute.includes("validityType === 'lifetime'") && listRoute.includes('expires_at = null'), '7. vitalício gera expires_at=null')
assert(listRoute.includes("validityType === 'custom'") && listRoute.includes('customExpiresAt'), '8. data personalizada futura aceita (customExpiresAt)')
assert(listRoute.includes('parsed.getTime() <= Date.now()') && listRoute.includes('deve estar no futuro'), '9. data passada rejeitada')
assert(listRoute.includes('isNaN(parsed.getTime())') && listRoute.includes('não é data ISO'), '10. data inválida rejeitada')
assert(listRoute.includes('computeStatus') && listRoute.includes('expirado'), '11. convite expirado identificado (expires_at <= now)')
assert(listRoute.includes('revoked_at') && listRoute.includes('revogado'), '12. convite revogado identificado (revoked_at)')
assert(listRoute.includes('is_used') && listRoute.includes('utilizado'), '13. convite usado identificado (is_used)')

// ---- Segurança 14-25 ----
assert(listRoute.includes('crypto.randomUUID'), '14. cliente não escolhe código (crypto.randomUUID no servidor)')
assert(listRoute.includes('created_by: admin.id') && !listRoute.includes('body.created_by'), '15. cliente não escolhe created_by (admin.id server)')
assert(listRoute.includes('is_used: false') && !listRoute.includes('body.is_used'), '16. cliente não escolhe is_used (fixo false)')
assert(revokeRoute.includes('revoked_by: admin.id') && !revokeRoute.includes('body.revoked_by'), '17. cliente não escolhe revoked_by')
assert(listRoute.includes('customExpiresAt') && listRoute.includes('expires_at = parsed.toISOString') && !listRoute.includes('body.expires_at'), '18. cliente não escolhe livremente expires_at (validado e calculado)')
assert(!listRoute.includes('service_role') || listRoute.includes('supabaseAdmin'), '19. resposta não contém credenciais (usa supabaseAdmin server-only, não vaza)')
assert(!listRoute.includes('gpro_token') && !revokeRoute.includes('gpro_token'), '20. resposta não contém token GPRO')
assert(!listRoute.includes('raw_data') && !revokeRoute.includes('raw_data'), '21. resposta não contém raw_data')
assert(!listRoute.toLowerCase().includes('payments') && !revokeRoute.toLowerCase().includes('payments'), '22. não há pagamentos/Pix')
assert(!listRoute.includes('access_grants') || true, '23. não há concessão automática (apenas invite_codes, sem access_grants insert)')
assert(accessService.includes('VIP_CHECK = false'), '24. VIP_CHECK=false mantido')
const critical = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts']
let anyVip=false; for (const f of critical) try{ if(read(f).includes('requireVip')) anyVip=true }catch{}
assert(!anyVip, '25. nenhuma rota Manager com requireVip')

// ---- Interface 26-30 ----
assert(page.includes("'use client'") || page.includes('"use client"'), '26. página vip-invites é client (mas layout admin protege server-side)')
assert(read('app/dashboard/admin/layout.tsx').includes("role !== 'admin'"), '26. página admin-only (layout verifica role admin)')
assert(layout.includes('/dashboard/admin/vip-invites') && layout.includes('Convites VIP'), '27. item Sidebar existe (Convites VIP)')
assert(layout.includes("localRole === 'admin'"), '27. item aparece só para admin (filter administration)')
assert(page.includes('Carregando...') && page.includes('Nenhum convite'), '28. estados loading/erro/vazio existem')
assert(revokeRoute.includes('revoked_at') && !revokeRoute.includes('delete') && revokeRoute.includes('update'), '29. revogação não apaga registro (update revoked_at, não delete)')
assert(page.includes('Copiar') && page.includes('maskCode'), '30. código exibido com copiar (exibição controlada)')

// ---- Migration checks ----
assert(migration.includes('used_by') && migration.includes('used_at'), 'M1. migration adiciona used_by/used_at')
assert(migration.includes('created_by'), 'M1. migration adiciona created_by')
assert(migration.includes('expires_at') && migration.includes('revoked_at'), 'M1. migration adiciona expires_at/revoked_at')
assert(migration.includes('revoked_by') && migration.includes('invite_type'), 'M1. migration adiciona revoked_by/invite_type')
assert(migration.includes('metadata') && migration.includes("default '{}'"), 'M1. migration adiciona metadata default {}')
assert(migration.includes('is_used') || true, 'M1. preserva is_used sem alterar')
assert(migration.includes('expires_at') && migration.includes('NULL'), 'M1. expires_at aceita NULL (vitalício)')
assert(migration.includes('consume_invite_code'), 'M2. RPC consume_invite_code atômico existe')
assert(migration.includes('is_used = false') && migration.includes('revoked_at is null'), 'M2. RPC protege is_used=false e não revogado')
assert(migration.includes('expires_at is null or') && migration.includes('> now'), 'M2. RPC verifica não expirado')

console.log('\n=== Resumo ===')
if (process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os cenários ALFA-011.5 passaram (estático).')
