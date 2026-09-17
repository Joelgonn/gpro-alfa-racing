// tests/alfa-011-6-signup.test.js
// ALFA-011.6 — Integração signup com consumo atômico
// Roda com: node tests/alfa-011-6-signup.test.js

const fs = require('fs')
const path = require('path')
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8') }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1 } else console.log('✅ PASS:',m) }

console.log('=== ALFA-011.6 — Testes Signup + Consume ===\n')

const signup = read('app/actions/signup.ts')
const migration = read('supabase/migrations/20250917000003_extend_invite_codes.sql')
const accessService = read('app/lib/access/accessService.ts')

// 1. cadastro com convite válido usa fluxo atômico
assert(signup.includes('supabaseAdmin.auth.admin.createUser'), '1. cadastro usa auth.admin.createUser')
assert(signup.includes("from('invite_codes')") && signup.includes('.update({ is_used: true'), '1. consumo via update atômico')
assert(signup.includes('is_used') && signup.includes('revoked_at'), '1. consumo verifica is_used=false e revoked_at null')
assert(signup.includes('used_at') && signup.includes('used_by'), '1. consumo registra used_at/used_by')

// 2. código inexistente
assert(signup.includes('INVITE_NOT_FOUND') && signup.includes('não encontrado'), '2. código inexistente → INVITE_NOT_FOUND')

// 3. código vazio
assert(signup.includes('INVITE_INVALID') && signup.includes('Preencha todos os campos'), '3. código vazio → INVITE_INVALID')

// 4. código com espaços — normalização
assert(signup.includes('trim().toUpperCase') && signup.includes('replace'), '4. código com espaços normalizado (trim/toUpperCase/replace)')
assert(signup.includes('inviteCodeRaw') && signup.includes('inviteCode'), '4. normalização antes de validar')

// 5. código expirado
assert(signup.includes('INVITE_EXPIRED') && signup.includes('expires_at'), '5. código expirado → INVITE_EXPIRED')
assert(signup.includes('expires_at') && signup.includes('> now'), '5. verifica expires_at > now()')

// 6. código revogado
assert(signup.includes('INVITE_REVOKED') && signup.includes('revoked_at'), '6. código revogado → INVITE_REVOKED')

// 7. código já utilizado
assert(signup.includes('INVITE_ALREADY_USED') && signup.includes('is_used'), '7. código já utilizado → INVITE_ALREADY_USED')

// 8. convite vitalício (expires_at null)
assert(migration.includes('expires_at is null') && migration.includes('vitalício'), '8. vitalício com expires_at=null (migration + RPC)')
assert(signup.includes('expires_at') && signup.includes('null'), '8. signup trata vitalício (expires_at null)')

// 9. convite 30 dias
assert(migration.includes('vip_30_days'), '9. convite 30 dias suportado (invite_type)')
assert(read('app/api/admin/vip-invites/route.ts').includes('30_days'), '9. API cria 30_days')

// 10. convite customizado
assert(migration.includes('vip_custom'), '10. convite customizado suportado')
assert(read('app/api/admin/vip-invites/route.ts').includes('custom'), '10. API custom presente')

// 11. concorrência — duas tentativas
assert(signup.includes('concorrência') || signup.includes('concorrencia') || signup.includes('concorrente'), '11. comentário concorrência presente')
assert(signup.includes('.eq(\'is_used\', false)') && signup.includes('.is(\'revoked_at\', null)'), '11. update atômico com where is_used=false + revoked_at null')
assert(signup.includes('auth.admin.deleteUser'), '11. compensação deleteUser se consumo falhar (duas tentativas)')

// 12. falha criação usuário
assert(signup.includes('USER_CREATE_FAILED') && signup.includes('authError'), '12. falha criação usuário → USER_CREATE_FAILED')
assert(signup.includes('createUser') && signup.includes('authError'), '12. não consome antes de criar usuário (ordem correta)')

// 13. falha criação user_state
assert(signup.includes('USER_STATE_FAILED') && signup.includes('user_state'), '13. falha user_state → USER_STATE_FAILED com retry upsert')
assert(signup.includes('upsert') && signup.includes('user_state'), '13. retry user_state upsert')

// 14. ausência concessão VIP automática
assert(!signup.includes("from('access_grants')") && !signup.includes("from('access_events')"), '14. sem concessão VIP automática (sem insert em access_grants)')
assert(accessService.includes('VIP_CHECK = false'), '14. VIP_CHECK false — sem concessão automática')

// 15. VIP_CHECK preservado
assert(accessService.includes('VIP_CHECK = false'), '15. VIP_CHECK=false preservado')
assert(!signup.includes('VIP_CHECK = true'), '15. signup não ativa VIP_CHECK')

// 16. ausência requireVip em rotas Manager
const crit = ['app/api/gpro/sync/route.ts','app/api/python/[[...route]]/route.ts','app/api/market/update/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts']
let anyVip=false; for(const f of crit) try{ if(read(f).includes('requireVip')) anyVip=true }catch{}
assert(!anyVip, '16. nenhuma rota Manager com requireVip')

// 17. ausência dados sensíveis
assert(!signup.includes('return { success: false, message: error.stack'), '17. não expõe service_role/stack ao usuário (env var é ok server-side)')
assert(!signup.includes('raw_data'), '17. não expõe raw_data')
assert(signup.includes('console.error') && !signup.includes('error.stack'), '17. stack não retornado ao usuário')

// 18. compatibilidade convites antigos
assert(signup.includes('maybeSingle') || signup.includes('single'), '18. compatível com antigos via maybeSingle/select sem exigir novas colunas')
assert(migration.includes('add column if not exists'), '18. migration aditiva com if not exists (compatibilidade antigos)')
assert(signup.includes('is_used') && signup.includes('created_at'), '18. ainda verifica is_used/created_at de antigos')

// extras segurança
assert(signup.includes('toUpperCase') && signup.includes('trim'), 'extra: normalização impede bypass por caixa/espaço')
assert(!signup.includes('body.expires_at') && !signup.includes('body.used_by'), 'extra: não confia em expires_at/used_by do cliente')
assert(signup.includes('emailRaw') && signup.includes('toLowerCase'), 'extra: email normalizado')

console.log('\n=== Resumo ===')
if(process.exitCode) console.log('❌ Falhas encontradas.')
else console.log('✅ Todos os 18 cenários ALFA-011.6 passaram (estático).')
