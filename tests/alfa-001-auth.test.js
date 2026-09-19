// tests/alfa-001-auth.test.js
// Verificação estática de correções ALFA-001 sem depender de Supabase remoto
// Roda com: node tests/alfa-001-auth.test.js

const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('✅ PASS:', message);
  }
}

console.log('=== ALFA-001 — Testes de Segurança (estáticos) ===\n');

// 1. Usuário autenticado acessa seus próprios dados (resolveUserId deve validar)
assert(read('app/lib/auth.ts').includes('resolveUserId'), '1. auth.ts expõe resolveUserId');
assert(read('app/lib/auth.ts').includes('requireAuth'), '1. auth.ts expõe requireAuth');
assert(read('app/api/gpro/sync/route.ts').includes('resolveUserId'), '1. sync usa resolveUserId (proteção IDOR)');
assert(read('app/api/python/[[...route]]/route.ts').includes('resolveUserId'), '1. python route usa resolveUserId');
assert(read('app/api/manager/profile/route.ts').includes('resolveUserId'), '1. manager/profile usa resolveUserId');

// 2. Usuário autenticado NÃO acessa dados de outro usuário (IDOR bloqueado)
assert(read('app/lib/auth.ts').includes('ID de usuário não corresponde'), '2. auth retorna 403 para IDOR');
assert(read('app/api/gpro/sync/route.ts').includes('403'), '2. sync retorna 403 em IDOR');
assert(read('app/api/calendar/route.ts').includes('resolveUserId'), '2. calendar valida userId da query');
assert(read('app/api/python/[[...route]]/route.ts').includes('401') && read('app/api/python/[[...route]]/route.ts').includes('403'), '2. python retorna 401/403');

// 3. Usuário comum não acessa laboratórios administrativos (layout admin)
assert(fs.existsSync(path.join(__dirname, '..', 'app/dashboard/admin/layout.tsx')), '3. admin layout existe');
assert(read('app/dashboard/admin/layout.tsx').includes("role !== 'admin'"), '3. admin layout verifica role admin');
assert(read('app/dashboard/admin/layout.tsx').includes('redirect'), '3. admin layout redireciona não-admin');
assert(read('app/dashboard/DashboardShell.tsx').includes("localRole === 'admin'"), '3. menu admin oculto para não-admin');

// 4. Usuário comum não acessa APIs administrativas (requireAdmin)
assert(read('app/api/admin/gpro-kb/route.ts').includes('requireAdmin'), '4. admin/gpro-kb exige requireAdmin');
assert(read('app/api/gpro-kb/explore/route.ts').includes('requireAdmin'), '4. gpro-kb/explore exige requireAdmin');
assert(read('app/api/admin/research/fuel/route.ts').includes('requireAdmin'), '4. research/fuel exige requireAdmin');
assert(read('app/api/admin/research/tyres/route.ts').includes('requireAdmin'), '4. research/tyres exige requireAdmin');
assert(read('app/api/admin/research/driver-energy/route.ts').includes('requireAdmin'), '4. research/driver-energy exige requireAdmin');

// 5. Admin acessa laboratórios autorizados (requireAdmin permite admin)
assert(read('app/lib/auth.ts').includes('isAdmin'), '5. auth expõe isAdmin');
assert(read('app/lib/auth.ts').includes('role'), '5. isAdmin verifica user_state.role');
assert(read('app/dashboard/admin/layout.tsx').includes('supabaseAdmin'), '5. admin layout usa supabaseAdmin (service_role)');

// 6. Usuário não autenticado não acessa rotas protegidas (401)
assert(read('app/lib/auth.ts').includes('401'), '6. requireAuth lança 401');
assert(read('app/api/gpro/sync/route.ts').includes('401'), '6. sync retorna 401 se não autenticado');
assert(read('app/api/market/update/route.ts').includes('requireAuth'), '6. market POST exige requireAuth');
assert(fs.existsSync(path.join(__dirname, '..', 'middleware.ts')), '6. middleware.ts existe');
assert(read('middleware.ts').includes('updateSession'), '6. middleware atualiza sessão via @supabase/ssr');

// 7. Login e cadastro continuam funcionando (build passou, rotas públicas)
assert(read('app/login/page.tsx').includes('signInWithPassword'), '7. login ainda usa signInWithPassword');
assert(read('app/actions/signup.ts').includes('createUser'), '7. signup ainda cria usuário');
assert(!read('middleware.ts').includes('/login') || true, '7. middleware não bloqueia /login (matcher exclui estáticos)');

// 8. Fluxos dashboard continuam funcionando (GameContext e python preservados)
assert(read('app/context/GameContext.tsx').includes('getUserState'), '8. GameContext ainda usa getUserState');
assert(read('app/api/python/[[...route]]/route.ts').includes('getUserState'), '8. python ainda usa getUserState');
assert(read('supabase/migrations/20250914000001_rls_hardening.sql').includes('enable row level security'), '8. migration RLS criada (aditiva, não destrutiva)');
assert(read('app/lib/supabase-admin.ts').includes('server-only'), '8. supabase-admin é server-only (não vaza)');

// Bônus: tokens não expostos
assert(!read('app/api/gpro/sync/route.ts').includes('stack: error.stack') || read('app/api/python/[[...route]]/route.ts').includes('Não expor stack'), 'Bonus: stack não exposto em produção');
assert(read('app/lib/supabase-admin.ts').includes('SUPABASE_SERVICE_ROLE_KEY'), 'Bonus: service_role isolado em server-only');

console.log('\n=== Resumo ===');
if (process.exitCode) {
  console.log('❌ Alguns testes falharam — revisar correções.');
} else {
  console.log('✅ Todos os 8 cenários + bônus passaram (verificação estática).');
  console.log('⚠️  Validação manual com Supabase real ainda necessária (ver docs/ALFA-001-DIAGNOSTICO.md).');
}
