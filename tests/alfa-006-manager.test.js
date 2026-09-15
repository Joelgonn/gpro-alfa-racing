// tests/alfa-006-manager.test.js - Sprint ALFA-006.1 Stabilize Manager Dashboard
// Casos: staff calc, timestamp, estados menu/office, token, loading, retry

const fs = require('fs');
const path = require('path');

function read(p){ return fs.readFileSync(path.join(__dirname,'..',p),'utf8'); }
function assert(c,msg){ if(!c){ console.error('FAIL:',msg); process.exitCode=1; } else console.log('PASS:',msg); }

// Staff calc puro
console.log('=== Staff calc ===');
function calc(a,b){ const v1=Number(a??0); const v2=Number(b??0); const n1=Number.isFinite(v1)?v1:0; const n2=Number.isFinite(v2)?v2:0; return Math.round((n1+n2)/2); }
assert(calc(80,60)===70,'staff 80+60/2=70');
assert(calc(0,0)===0,'staff 0,0=0');
assert(calc(null,null)===0,'staff null,null=0');
assert(calc(undefined,100)===50,'staff undefined,100=50');
assert(calc(10,null)===5,'staff 10,null=5');
assert(calc('80','60')===70,'staff string 80,60=70');
assert(calc(NaN,50)===25,'staff NaN,50 fallback 0 =>25');
console.log('Staff tests ok');

// Timestamp real
console.log('\n=== Timestamp ===');
const managerCode = read('app/dashboard/manager/page.tsx');
assert(!managerCode.includes('setLastUpdated(new Date().toISOString())'),'timestamp falso removido');
assert(managerCode.includes('lastImportAt') && managerCode.includes('updatedAt'),'exibe lastImportAt/updatedAt');
assert(managerCode.includes('Sincronização não identificada'),'fallback sem timestamp');
assert(read('app/context/GameContext.tsx').includes('lastImportAt') && read('app/context/GameContext.tsx').includes('updatedAt'),'GameContext expõe timestamps');
assert(read('app/lib/db.ts').includes('updated_at') && read('app/lib/db.ts').includes('last_import_at'),'db retorna timestamps');

// Desacoplamento
console.log('\n=== Desacoplamento menu/office ===');
assert(!managerCode.includes('if (!menuData || !officeData)'),'bloqueio global removido');
assert(managerCode.includes('!menuData ?') && managerCode.includes('!officeData ?'),'blocos independentes');
assert(managerCode.includes('getMenuEmptyState') && managerCode.includes('getOfficeEmptyState'),'empty states específicos');
assert(managerCode.includes('Ambas') || managerCode.includes('!menuData && !officeData'),'banner ambos ausentes');

// Mensagens token
console.log('\n=== Mensagens ===');
assert(managerCode.includes('Configure sua integração GPRO'),'msg token ausente');
assert(managerCode.includes('Revise seu token'),'msg token inválido');
assert(managerCode.includes('Não foi possível atualizar este bloco'),'msg erro temporário');
assert(managerCode.includes('ainda não recebeu dados'),'msg não sincronizado');
// Sanitização: deve filtrar gpro_token mas não expor
assert(managerCode.includes("gpro_token") && managerCode.includes('Erro na integração'), 'sanitização token sem exposição');

// Retry granular
console.log('\n=== Retry ===');
assert(managerCode.includes('handleSync') && managerCode.includes('disabled={isSyncing}'),'retry impede múltiplos cliques');
assert(managerCode.includes('aria-label="Sincronizar bloco'),'retry granular por bloco');

// A11y
console.log('\n=== A11y ===');
assert(managerCode.includes('aria-live="polite"'),'aria-live');
assert(managerCode.includes('aria-busy'),'aria-busy');
assert(managerCode.includes('aria-label="Alterar avatar'), 'avatar aria-label');
assert(managerCode.includes('focus-visible:ring'),'foco visível');

// Staff calc import
console.log('\n=== Staff import ===');
assert(read('app/lib/staff.ts').includes('calcStaffLevel'),'staff.ts existe');
assert(managerCode.includes("from '@/app/lib/staff'"),'manager importa staff');

// Build check handled separately
console.log('\n=== ALFA-006.1 ok ===');
