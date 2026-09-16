// tests/alfa-002.test.js
// SPRINT 02 — Higiene, Motores, Centralização, Supabase
// Roda com: node tests/alfa-002.test.js

const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}
function exists(file) {
  return fs.existsSync(path.join(__dirname, '..', file));
}
function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('✅ PASS:', msg);
  }
}

console.log('=== ALFA-002 — Testes de Regressão ===\n');

// 1. Cálculo de setup — motor oficial é HyperFormula via python
assert(read('app/api/python/[[...route]]/route.ts').includes('setup_calculate'), '1. python route expõe setup_calculate (oficial)');
assert(read('services/setupService.ts').includes("'/api/python?action=setup_calculate'"), '1. setupService usa python como oficial');
assert(read('services/setupService.ts').includes('calculateSetup'), '1. setupService mantém comparação TS (Strangler)');
assert(read('domain/setup/calculateSetup.ts').includes('calculateAsaDianteiraQ1'), '1. calculateSetup.ts implementa asa dianteira');
assert(read('domain/setup/calculateSetup.ts').includes('asaTraseira') && read('domain/setup/calculateSetup.ts').includes('q1: 0'), '1. outras peças ainda retornam 0 (incompleto, preservado)');

// 2. Estratégia
assert(read('app/api/python/[[...route]]/route.ts').includes('strategy_calculate'), '2. python expõe strategy_calculate (oficial)');
assert(exists('app/api/sponsors/route.js'), '2. sponsors/route.js legado ainda existe (não removido, mapeado)');
assert(read('app/api/sponsors/route.js').includes('Patrocinador'), '2. sponsors legado usa Excel (duplicação documentada)');

// 3. Performance
assert(read('app/api/python/[[...route]]/route.ts').includes("'performance'") || read('app/api/python/[[...route]]/route.ts').includes('performance'), '3. python expõe performance (oficial)');
assert(exists('app/api/performance/route.js'), '3. performance/route.js legado existe (não removido)');

// 4. Planejamento
assert(read('app/api/python/[[...route]]/route.ts').includes('planning_calculate'), '4. python expõe planning_calculate');
assert(read('app/api/python/[[...route]]/route.ts').includes('save_planning'), '4. python expõe save_planning/get_planning');
assert(read('app/api/python/[[...route]]/route.ts').includes('user_planning'), '4. planejamento persiste em user_planning via supabaseAdmin');

// 5. Desgaste
assert(read('app/api/python/[[...route]]/route.ts').includes('desgasteModifier') || read('app/api/python/[[...route]]/route.ts').includes('wear'), '5. desgaste via python (col J/K, Tyre&Fuel C4)');
assert(read('domain/setup/calculateSetup.ts').includes('P25'), '5. TS P25 ainda stub 154 (documentado)');

// 6. Constantes centralizadas
assert(exists('app/lib/tracks.ts'), '6. app/lib/tracks.ts existe (fonte única)');
assert(read('app/lib/tracks.ts').includes('TRACK_FLAGS'), '6. tracks.ts exporta TRACK_FLAGS');
assert(read('app/lib/tracks.ts').includes('TYRE_SUPPLIERS'), '6. tracks.ts exporta TYRE_SUPPLIERS');
assert(read('app/lib/tracks.ts').includes('getTrackFlag'), '6. tracks.ts expõe getTrackFlag helper');
assert(read('app/lib/tracks.ts').includes('TYRE_SUPPLIERS_LEGACY'), '6. tracks.ts preserva legado 9 fornecedores');
assert(read('app/context/GameContext.tsx').includes("from '@/app/lib/tracks'"), '6. GameContext importa de tracks.ts');
assert(read('app/lib/db.ts').includes("from '@/app/lib/tracks'"), '6. db.ts importa de tracks.ts');
assert(read('app/dashboard/page.tsx').includes("from '@/app/lib/tracks'"), '6. dashboard/page importa TRACK_FLAGS central');
assert(read('app/dashboard/setup/page.tsx').includes("app/lib/tracks"), '6. setup/page importa central');
assert(read('app/dashboard/strategy/page.tsx').includes("app/lib/tracks"), '6. strategy/page importa central');
assert(read('app/dashboard/tests/page.tsx').includes("app/lib/tracks"), '6. tests/page importa central');
assert(read('app/dashboard/manager/page.tsx').includes("from '@/app/lib/tracks'"), '6. manager/page importa central');
assert(read('app/api/calendar/route.ts').includes("getTrackFlag"), '6. calendar usa getTrackFlag central');
assert(!read('app/dashboard/page.tsx').includes('const TRACK_FLAGS'), '6. dashboard/page não define TRACK_FLAGS local');
assert(!read('app/dashboard/setup/page.tsx').includes('const TRACK_FLAGS'), '6. setup/page não define local');

// 7. Proteção APIs (gerente)
assert(read('app/api/gpro/sync/route.ts').includes('resolveUserId'), '7. sync protegido IDOR');
assert(read('app/api/python/[[...route]]/route.ts').includes('resolveUserId'), '7. python protegido');
assert(read('app/api/manager/profile/route.ts').includes('resolveUserId'), '7. manager/profile protegido');
assert(read('app/api/calendar/route.ts').includes('resolveUserId'), '7. calendar valida ?userId');
assert(read('app/api/market/update/route.ts').includes('requireAuth'), '7. market POST exige auth');

// 8. Fluxo conta gerente preservado
assert(read('app/context/GameContext.tsx').includes('getUserState'), '8. GameContext ainda usa getUserState');
assert(read('app/dashboard/page.tsx').includes('useGame'), '8. dashboard/page ainda usa GameContext');
assert(exists('app/dashboard/setup/page.tsx'), '8. setup existe');
assert(exists('app/dashboard/strategy/page.tsx'), '8. strategy existe');
assert(exists('app/dashboard/tests/page.tsx'), '8. tests existe');
assert(exists('app/dashboard/wear/page.tsx'), '8. wear existe');
assert(read('app/lib/db.ts').includes('supabase'), '8. db.ts ainda exporta supabase para gerente');

// 9. Ausência dependência Node nativa no APK gerente
const gerenteFiles = ['app/dashboard/page.tsx', 'app/dashboard/setup/page.tsx', 'app/dashboard/strategy/page.tsx', 'app/context/GameContext.tsx', 'app/lib/tracks.ts'];
let hasNativeInGerente = gerenteFiles.some(f => read(f).includes('better-sqlite3') || read(f).includes('xlwings') || read(f).includes('backend_python'));
assert(!hasNativeInGerente, '9. gerente não importa better-sqlite3/xlwings/backend_python');
assert(read('package.json').includes('better-sqlite3'), '9. better-sqlite3 ainda em package.json (mapeado, não removido nesta sprint)');
assert(exists('data/gpro_users.db'), '9. gpro_users.db ainda existe (mapeado, remoção proposta ALFA-003)');
assert(exists('backend_python/main.py'), '9. backend_python ainda existe (isolado, remoção proposta)');

// 10. Segredos não expostos
assert(read('app/lib/supabase.ts').includes('createBrowserClient'), '10. supabase.ts usa BrowserClient (só ANON)');
assert(read('app/lib/supabase.ts').includes('NEXT_PUBLIC_SUPABASE_ANON_KEY') && !read('app/lib/supabase.ts').includes('SERVICE_ROLE'), '10. supabase.ts não contém SERVICE_ROLE');
assert(read('app/lib/supabase-admin.ts').includes('server-only'), '10. supabase-admin é server-only');
assert(read('app/lib/db.ts').includes('NEXT_PUBLIC_SUPABASE_ANON_KEY') && !read('app/lib/db.ts').includes('SERVICE_ROLE_KEY ||'), '10. db.ts usa só ANON (híbrido eliminado)');
assert(!read('app/api/gpro/sync/route.ts').includes('gpro_token') || !read('app/api/gpro/sync/route.ts').match(/return.*gpro_token/), '10. sync não retorna gpro_token');
assert(read('app/lib/db.ts').includes('Browser-safe'), '10. db.ts documenta separação');

console.log('\n=== Resumo ALFA-002 ===');
if (process.exitCode) {
  console.log('❌ Falhas detectadas');
} else {
  console.log('✅ Todos os 10 grupos de testes passaram');
  console.log('⚠️  RLS migration ainda pendente de aplicação manual (supabase/migrations/*)');
}
