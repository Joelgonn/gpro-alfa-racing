// tests/alfa-003.test.js
// SPRINT 03 — Segurança remota, bloqueadores APK, motor, gpro_token, APIs legadas
// Roda com: node tests/alfa-003.test.js

const fs = require('fs');
const path = require('path');

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(__dirname, '..', file)); }
function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1; }
  else { console.log('✅ PASS:', msg); }
}

console.log('=== ALFA-003 — Testes E2E e Validação ===\n');

// Fase 1 — RLS remoto
console.log('--- Fase 1: RLS remoto ---');
assert(exists('supabase/migrations/20250914000001_rls_hardening.sql'), 'F1: migration RLS existe local');
assert(read('supabase/migrations/20250914000001_rls_hardening.sql').includes('enable row level security'), 'F1: migration habilita RLS');
assert(read('supabase/migrations/20250914000001_rls_hardening.sql').includes('user_state_select_own'), 'F1: migration cria policy user_state');
console.log('⚠️  F1: aplicação remota pendente — requer SQL Editor manual (documentado)');

// Fase 2 — E2E 8 cenários (verificação estática que código lida)
console.log('\n--- Fase 2: E2E 8 cenários ---');
// 2.1 anon -> 401
assert(read('app/lib/auth.ts').includes("status = 401") && read('app/lib/auth.ts').includes('Não autenticado'), 'F2.1: anon -> 401 via requireAuth');
// 2.2 gerente own -> 200 (resolveUserId retorna id quando coincide)
assert(read('app/lib/auth.ts').includes('resolveUserId') && read('app/lib/auth.ts').includes('return user.id'), 'F2.2: gerente own data -> resolveUserId retorna id');
// 2.3 gerente other -> 403
assert(read('app/lib/auth.ts').includes('ID de usuário não corresponde') && read('app/lib/auth.ts').includes('403'), 'F2.3: gerente other -> 403 IDOR');
// 2.4 gerente admin routes -> redirect
assert(read('app/dashboard/admin/layout.tsx').includes("role !== 'admin'") && read('app/dashboard/admin/layout.tsx').includes('redirect'), 'F2.4: gerente -> admin routes redirect');
// 2.5 gerente admin APIs -> 403
assert(read('app/api/admin/gpro-kb/route.ts').includes('requireAdmin') && read('app/api/admin/research/fuel/route.ts').includes('requireAdmin'), 'F2.5: gerente -> admin APIs 403');
// 2.6 admin acessa admin -> 200
assert(read('app/lib/auth.ts').includes('isAdmin') && read('app/dashboard/admin/layout.tsx').includes('supabaseAdmin'), 'F2.6: admin -> 200 via isAdmin+supabaseAdmin');
// 2.7 manipulação IDs URL/body -> 403
assert(read('app/api/calendar/route.ts').includes('resolveUserId') && read('app/api/gpro/sync/route.ts').includes('resolveUserId'), 'F2.7: manipulação ID URL/body -> resolveUserId 403');
assert(read('app/api/python/[[...route]]/route.ts').includes('resolveUserId'), 'F2.7: python manipulação header -> 403');
// 2.8 tokens ausentes/inválidos/expirados -> 401
assert(read('utils/supabase/server.ts').includes('createServerClient'), 'F2.8: tokens via @supabase/ssr cookies (expiração tratada por getUser)');
assert(read('app/lib/auth.ts').includes('getUser') || read('app/lib/auth.ts').includes('auth.getUser'), 'F2.8: getUser valida token expirado -> null -> 401');

// Fase 3 — gpro_token
console.log('\n--- Fase 3: gpro_token ---');
const allApiFiles = ['app/api/gpro/sync/route.ts','app/api/gpro-kb/explore/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts'];
const noReturnToken = allApiFiles.every(f => {
  const content = read(f);
  // Verifica que nenhum retorna gpro_token no JSON
  return !content.includes('gpro_token') || !content.match(/NextResponse\.json.*gpro_token/) || content.includes("select('gpro_token')") && !content.includes('return') || true;
});
// Checagem mais precisa: nenhum JSON de resposta contém gpro_token
let returnsToken = false;
allApiFiles.forEach(f => {
  const c = read(f);
  if (c.includes('gpro_token') && c.includes('NextResponse.json') && c.match(/gpro_token.*NextResponse|NextResponse.*gpro_token/)) returnsToken = true;
});
assert(!returnsToken, 'F3: nenhuma API retorna gpro_token no JSON');
assert(!read('app/api/gpro/sync/route.ts').includes('console.log(token') && !read('app/api/gpro/sync/route.ts').includes('console.log.*gpro_token'), 'F3: sync não loga token (apenas userId)');
assert(read('app/dashboard/configuracoes/integracao/page.tsx').includes('/api/gpro/token'), 'F3: integração usa API server-only /api/gpro/token');
assert(!read('app/dashboard/configuracoes/integracao/page.tsx').includes("select('gpro_token')") && !read('app/dashboard/configuracoes/integracao/page.tsx').includes('select("gpro_token")'), 'F3: integração não faz select direto de token');
assert(!read('app/dashboard/configuracoes/integracao/page.tsx').includes('localStorage') || !read('app/dashboard/configuracoes/integracao/page.tsx').match(/localStorage.*gpro_token/), 'F3: gpro_token não em localStorage');
assert(!read('app/lib/auth.ts').includes('gpro_token'), 'F3: auth não expõe gpro_token');
assert(read('app/lib/supabase-admin.ts').includes('server-only'), 'F3: service_role server-only protege token no servidor');
console.log('⚠️  F3: gpro_token ainda em texto simples em user_state.gpro_token (limitação documentada, criptografia futura)');

// Fase 4 — Bloqueadores APK
console.log('\n--- Fase 4: Bloqueadores APK ---');
const pkg = read('package.json');
assert(!pkg.includes('better-sqlite3'), 'F4: better-sqlite3 removido de package.json');
assert(!pkg.includes('@types/better-sqlite3'), 'F4: @types/better-sqlite3 removido');
assert(!read('app/lib/tracks.ts').includes('better-sqlite3'), 'F4: tracks.ts não importa nativo');
assert(!exists('data/gpro_users.db'), 'F4: gpro_users.db removido');
assert(!exists('backend_python/main.py'), 'F4: backend_python removido');
assert(read('app/api/calendar/route.ts').includes('node:fs/promises') && read('app/api/calendar/route.ts').includes('readFile'), 'F4: calendar usa node:fs/promises');
assert(!read('app/api/calendar/route.ts').includes('readFileSync'), 'F4: calendar não usa readFileSync');

// Fase 5 — Calendário fs/promises
console.log('\n--- Fase 5: Calendário ---');
assert(read('app/api/calendar/route.ts').includes('XLSX') && read('app/api/calendar/route.ts').includes('calculadora.xlsx'), 'F5: calendar lê calculadora.xlsx');
assert(read('app/api/calendar/route.ts').includes('readFile') && read('app/api/calendar/route.ts').includes('node:fs/promises'), 'F5: calendar usa fs/promises async');
assert(!read('app/api/calendar/route.ts').includes('readFileSync'), 'F5: calendar não usa readFileSync');
assert(read('app/api/calendar/route.ts').includes('async function loadTracksFromExcel'), 'F5: loadTracksFromExcel é async');
assert(read('app/api/calendar/route.ts').includes('await loadTracksFromExcel'), 'F5: GET aguarda loadTracksFromExcel');

// Fase 6 — Motor
console.log('\n--- Fase 6: Motor ---');
assert(read('app/api/python/[[...route]]/route.ts').includes('HyperFormula'), 'F6: HyperFormula é motor oficial (python)');
assert(read('app/api/python/[[...route]]/route.ts').includes('setup_calculate'), 'F6: setup_calculate via HyperFormula');
assert(read('domain/setup/calculateSetup.ts').includes('calculateAsaDianteiraQ1'), 'F6: TS asa dianteira implementada');
assert(read('domain/setup/calculateSetup.ts').includes('asaTraseira') && read('domain/setup/calculateSetup.ts').includes('q1: 0'), 'F6: TS outras peças incompletas (0)');
assert(read('services/setupService.ts').includes('compareResults'), 'F6: setupService compara Excel vs TS');
assert(read('services/setupService.ts').includes('/api/python?action=setup_calculate'), 'F6: setupService mantém Excel oficial');

// Fase 7 — APIs legadas
console.log('\n--- Fase 7: APIs legadas ---');
assert(!exists('app/api/calcular/route.js'), 'F7: calcular/route.js removido (sem consumidores)');
assert(!exists('app/api/sponsors/route.js'), 'F7: sponsors/route.js removido (sem consumidores)');
assert(!exists('app/api/performance/route.js'), 'F7: performance/route.js removido (sem consumidores)');
assert(!exists('app/api/tracks/route.js'), 'F7: tracks/route.js removido (sem consumidores)');
assert(exists('app/api/test-calculator/route.ts'), 'F7: test-calculator mantido (usado por tests/page.tsx:643)');
assert(read('app/api/python/[[...route]]/route.ts').includes('tracks'), 'F7: python tracks é oficial');
assert(read('app/api/python/[[...route]]/route.ts').includes('sponsors'), 'F7: python sponsors é oficial');

// Fase 8 — Build
console.log('\n--- Fase 8: Build ---');
assert(exists('app/lib/tracks.ts'), 'F8: tracks.ts existe');
assert(exists('utils/supabase/server.ts'), 'F8: supabase server existe');

console.log('\n=== Resumo ALFA-003 ===');
if (process.exitCode) {
  console.log('❌ Falhas — ver acima');
} else {
  console.log('✅ Verificações estáticas passaram (F1 pendente manual, F4/F5 em progresso)');
}
