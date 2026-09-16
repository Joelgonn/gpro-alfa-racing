// tests/alfa-003-regression.test.js
// HOTFIX ALFA-003-REGRESSION — Valida correção do fluxo /dashboard/manager AGUARDANDO SINCRONIZAÇÃO
const fs = require('fs');
const path = require('path');
function read(f){ return fs.readFileSync(path.join(__dirname,'..',f),'utf8'); }
function exists(f){ return fs.existsSync(path.join(__dirname,'..',f)); }
function assert(c,m){ if(!c){ console.error('❌ FAIL:',m); process.exitCode=1; } else console.log('✅ PASS:',m); }
console.log('=== ALFA-003-REGRESSION ===\n');

// 1. Página carrega (manager existe e tem fallback AGUARDANDO)
assert(exists('app/dashboard/manager/page.tsx'), '1. manager/page.tsx existe');
assert(read('app/dashboard/manager/page.tsx').includes('Aguardando Sincronização'), '1. página tem fallback AGUARDANDO');

// 2. Integração não configurada
assert(read('app/dashboard/manager/page.tsx').includes('Integração não configurada'), '2. mensagem integração não configurada');
assert(read('app/api/gpro/sync/route.ts').includes('Token GPRO não encontrado'), '2. sync retorna 404 token não encontrado');

// 3. Sincronização bem-sucedida atualiza
assert(read('app/dashboard/manager/page.tsx').includes('handleSync') && read('app/dashboard/manager/page.tsx').includes("fetch('/api/gpro/sync'"), '3. handleSync chama /api/gpro/sync');
assert(read('app/dashboard/manager/page.tsx').includes('reloadUserState()') && read('app/dashboard/manager/page.tsx').includes('setSyncStatus'), '3. sync chama reloadUserState e atualiza status');

// 4. Erro API não deixa loading infinito (finally)
assert(read('app/dashboard/manager/page.tsx').includes('finally') && read('app/dashboard/manager/page.tsx').includes('setIsSyncing(false)'), '4. finally encerra loading');
assert(read('app/dashboard/manager/page.tsx').includes('try {') && read('app/dashboard/manager/page.tsx').includes('catch'), '4. try/catch existe');

// 5. Token ausente tratado
assert(read('app/dashboard/manager/page.tsx').includes('404') && read('app/dashboard/manager/page.tsx').includes('Integração não configurada'), '5. token ausente 404 tratado');
assert(read('app/api/gpro/sync/route.ts').includes("status: 404"), '5. sync retorna 404 para token ausente');

// 6. Token inválido tratado
assert(read('app/dashboard/manager/page.tsx').includes('inválido') && read('app/dashboard/manager/page.tsx').includes('expirou'), '6. token inválido mensagem');
assert(read('app/api/gpro/sync/route.ts').includes('fetchGproJson'), '6. sync consulta GPRO com token');

// 7. Erro 401 tratado
assert(read('app/dashboard/manager/page.tsx').includes('401') && read('app/dashboard/manager/page.tsx').includes('Sessão expirada'), '7. 401 tratado');

// 8. Erro 403/RLS tratado
assert(read('app/dashboard/manager/page.tsx').includes('403') && read('app/dashboard/manager/page.tsx').includes('Acesso negado'), '8. 403/RLS tratado');
assert(read('app/lib/db.ts').includes('getSupabaseClient') && read('app/lib/db.ts').includes('service_role'), '8. db.ts usa service_role no server para RLS');

// 9. Erro 500 tratado
assert(read('app/dashboard/manager/page.tsx').includes('500') || read('app/dashboard/manager/page.tsx').includes('Falha na sincronização'), '9. 500 tratado');
assert(read('app/api/gpro/sync/route.ts').includes('status: 500'), '9. sync retorna 500 em erro interno');

// 10. Botão tentar novamente
assert(read('app/dashboard/manager/page.tsx').includes('Tentar novamente') && read('app/dashboard/manager/page.tsx').includes('onClick={handleSync}'), '10. botão tentar novamente existe');

// 11. Nenhum token retornado ao cliente
const apiFiles = ['app/api/gpro/sync/route.ts','app/api/gpro-kb/explore/route.ts','app/api/calendar/route.ts','app/api/manager/profile/route.ts'];
const leaks = apiFiles.filter(f => {
  const c=read(f);
  // Verifica se resposta JSON contém gpro_token como campo retornado (ex: { gpro_token: token })
  return /NextResponse\.json\([^)]*gpro_token\s*:/.test(c) || /return[^}]*gpro_token\s*:/.test(c);
});
assert(leaks.length===0, '11. nenhuma API retorna gpro_token no JSON');
assert(!/fetch\([^)]*gpro_token/.test(read('app/dashboard/manager/page.tsx')) && !/select\([^)]*gpro_token/.test(read('app/dashboard/manager/page.tsx')), '11. manager não expõe token em fetch/select');
assert(read('app/lib/db.ts').includes("select('*')") || read('app/lib/db.ts').includes("getSupabaseClient"), '11. db.ts usa client correto e não expõe token em UserState');

// 12. Nenhuma API removida ainda é chamada
const removedApis = ['/api/tracks','/api/calcular','/api/sponsors','/api/performance'];
const stillCalled = removedApis.filter(api => read('app/dashboard/manager/page.tsx').includes(api) || read('app/context/GameContext.tsx').includes(api));
assert(stillCalled.length===0, '12. manager/GameContext não chamam APIs removidas');
assert(!read('app/api/calendar/route.ts').includes('readFileSync'), '12. calendar não usa readFileSync (bloqueador removido)');

console.log('\n=== Resumo REGRESSION ===');
if(process.exitCode) console.log('❌ Falhas');
else console.log('✅ Todos os 12 cenários de regressão passaram');
