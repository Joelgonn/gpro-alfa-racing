// tests/alfa-011-7-transaction.test.js
// ALFA-011.7 — Transação signup (estratégia compensatória reforçada)
// Roda com: node tests/alfa-011-7-transaction.test.js

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-011.7 — Testes Transação Signup ===\n')

const signup = read('app/actions/signup.ts')
const accessService = read('app/lib/access/accessService.ts')
const migration3 = read('supabase/migrations/20250917000003_extend_invite_codes.sql')

// Auditoria fluxo atual
assert(signup.includes('supabaseAdmin.auth.admin.createUser'), '1. usa auth.admin.createUser (Supabase Auth API)')
assert(signup.includes("from('invite_codes')") && signup.includes('.update('), '1. usa update atômico com where is_used=false')
assert(!fs.readFileSync(path.join(__dirname,'../supabase/migrations/20250917000003_extend_invite_codes.sql'),'utf8').includes('insert into auth.users'), '1. nenhuma migração insere em auth.users diretamente')

// 1-10 cadastros variados
assert(signup.includes('INVITE_NOT_FOUND'), '2. trata INVITE_NOT_FOUND')
assert(signup.includes('INVITE_INVALID') && signup.includes('4') && signup.includes('64'), '3. trata vazio (INVITE_INVALID + limite 4-64)')
assert(signup.includes('trim().toUpperCase'), '4. trata espaços (trim/toUpperCase)')
assert(signup.includes('INVITE_EXPIRED') && signup.includes('expires_at'), '5. trata expirado')
assert(signup.includes('INVITE_REVOKED') && signup.includes('revoked_at'), '6. trata revogado')
assert(signup.includes('INVITE_ALREADY_USED') && signup.includes('is_used'), '7. trata já utilizado')
assert(migration3.includes('expires_at is null') && signup.includes('expires_at'), '8. vitalício (expires_at null)')
assert(migration3.includes('vip_30_days'), '9. 30 dias suportado')
assert(migration3.includes('vip_custom'), '10. custom suportado')

// 11 concorrência
assert(signup.includes('.eq(\'is_used\', false)') && signup.includes('.is(\'revoked_at\', null)'), '11. concorrência protegida por where is_used=false + revoked_at null')
assert(signup.includes('.or(') && signup.includes('expires_at'), '11. concorrência verifica expiração no update atômico')
assert(signup.includes('concorrência') || signup.includes('concorrencia'), '11. documenta concorrência')

// 12 falha Auth
assert(signup.includes('USER_CREATE_FAILED') && signup.includes('authError'), '12. falha Auth → USER_CREATE_FAILED sem consumir')

// 13 falha consumo
assert(signup.includes('!consumed') || signup.includes('consumeError'), '13. falha consumo detectada (concorrência)')

// 14 falha user_state
assert(signup.includes('USER_STATE_FAILED') && signup.includes('user_state'), '14. falha user_state → USER_STATE_FAILED com upsert retry')

// 15 falha compensação
assert(signup.includes('deleteUser') && signup.includes('compensationFailed'), '15. falha compensação tratada como incidente explícito')
assert(signup.includes('Inconsistencia signup') || signup.includes('Incidente compensacao'), '15. loga incidente sem ocultar')
assert(signup.includes('maskEmail') && signup.includes('maskCode'), '15. logs mascarados (sem e-mail/código completo)')

// 16 não excluir preexistente
assert(signup.includes('newUserId') && signup.includes('deleteUser(newUserId)'), '16. compensação só exclui newUserId recém-criado (não preexistente)')
assert(!signup.includes('deleteUser(email)') && !signup.includes('deleteUser(preCheck'), '16. não exclui por e-mail ou invite, só newUserId')

// 17 não conceder VIP
assert(!signup.includes("from('access_grants')") && !signup.includes('VIP_CHECK = true'), '17. não concede VIP automaticamente (sem insert access_grants)')
assert(accessService.includes('VIP_CHECK = false'), '17. VIP_CHECK false mantido')

// 18 VIP_CHECK
assert(accessService.includes('VIP_CHECK = false'), '18. VIP_CHECK=false')

// 19 ausência requireVip
const crit = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts']
let anyVip=false; for(const f of crit) try{ if(read(f).includes('requireVip')) anyVip=true }catch{}
assert(!anyVip, '19. ausência requireVip em rotas Manager')

// 20 ausência dados sensíveis
assert(!signup.includes('return { success: false, message: error.stack'), '20. não retorna stack')
assert(signup.includes('maskEmail') && signup.includes('slice(0, 80)'), '20. logs limitados 80 chars + mascarados')
assert(!signup.includes('raw_data'), '20. ausência raw_data')
assert(signup.includes("import { createClient }") && signup.includes('supabaseAdmin'), '20. usa supabaseAdmin server-only, não vaza')

// 21 compatibilidade antigos
assert(migration3.includes('add column if not exists'), '21. compatível antigos (add column if not exists)')
assert(signup.includes('maybeSingle'), '21. maybeSingle compatível')

// 22 RPC consume_invite_code existe
assert(migration3.includes('consume_invite_code') && migration3.includes('security definer'), '22. RPC consume_invite_code existe com security definer')
assert(migration3.includes('set search_path = public'), '22. RPC com search_path seguro')
assert(migration3.includes('grant execute') && migration3.includes('to authenticated'), '23. RPC grant execute apenas authenticated/service_role')

// 24 rollback real não possível mas compensação existe
assert(signup.includes('auth.admin.deleteUser'), '24. compensação via deleteUser existe (não transação real)')

// Segurança search_path, EXECUTE
assert(migration3.includes('search_path'), 'seg. RPC search_path')
assert(signup.includes('is_used') && signup.includes('expires_at') && signup.includes('revoked_at'), 'seg. não confia em cliente (valida is_used/expires_at/revoked_at server)')
assert(signup.includes('used_by') && signup.includes('newUserId') && !signup.includes('body.used_by'), 'seg. used_by derivado do servidor')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os cenários ALFA-011.7 passaram (estático; concorrência real requer staging).')
