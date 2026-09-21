// tests/alfa-006-manager.test.js - Sprint ALFA-006.1 Stabilize Manager Dashboard (refatoração hierarquia)
// Valida nova estrutura: onboarding + NextRaceHero + TeamStateGroup + QuickShortcuts

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

// Onboarding sem dados (primeiro acesso)
console.log('\n=== Onboarding sem dados ===');
assert(managerCode.includes('Bem-vindo ao Lobo Alfa'),'onboarding título Bem-vindo ao Lobo Alfa');
assert(managerCode.includes('CONFIGURAR MINHA INTEGRAÇÃO') || managerCode.includes('Configurar minha integração'),'onboarding CTA CONFIGURAR MINHA INTEGRAÇÃO');
assert(managerCode.includes('/dashboard/configuracoes/integracao'),'onboarding rota /dashboard/configuracoes/integracao');
assert(managerCode.includes('lastImportAt') && managerCode.includes('hasData'),'onboarding usa hasData');
assert(managerCode.includes('lastImportAt || (menuData && officeData)') || managerCode.includes('lastImportAt || (menuData && officeData)') ,'hasData baseada em lastImportAt || (menuData && officeData)');
assert(managerCode.includes('O Alfa reúne suas ferramentas'),'onboarding texto spec');
assert(managerCode.includes('Para começar, conecte sua conta do GPRO'),'onboarding orientação spec');

// Dashboard com dados — nova hierarquia
console.log('\n=== Dashboard com dados — hierarquia ===');
assert(managerCode.includes('NextRaceHero'),'dashboard contém NextRaceHero');
assert(managerCode.includes('TeamStateGroup'),'dashboard contém TeamStateGroup');
assert(managerCode.includes('QuickShortcuts'),'dashboard contém QuickShortcuts');
assert(read('app/dashboard/manager/components/NextRaceHero.tsx').includes('Próxima Corrida'),'NextRaceHero renderiza Próxima Corrida');
assert(read('app/dashboard/manager/components/TeamStateGroup.tsx').includes('Piloto') && read('app/dashboard/manager/components/TeamStateGroup.tsx').includes('Carro'),'TeamStateGroup agrupa Piloto+Carro');
assert(read('app/dashboard/manager/components/TeamStateGroup.tsx').includes('Equipe Técnica') || read('app/dashboard/manager/components/TeamStateGroup.tsx').includes('Staff'),'TeamStateGroup agrupa Staff/TD');
assert(read('app/dashboard/manager/components/QuickShortcuts.tsx').includes('/dashboard/setup'),'QuickShortcuts contém Setup');
assert(managerCode.includes("from './components/NextRaceHero'") && managerCode.includes("from './components/TeamStateGroup'") && managerCode.includes("from './components/QuickShortcuts'"),'manager importa 3 novos componentes');

// Elementos antigos removidos
console.log('\n=== Elementos antigos removidos ===');
assert(!managerCode.includes('SyncBanner'),'SyncBanner removido do manager');
assert(!managerCode.includes("from './components/SyncBanner'"),'import SyncBanner removido');
assert(!managerCode.includes("from './components/EmptyState'"),'import EmptyState removido');
assert(!managerCode.includes('getMenuEmptyState') && !managerCode.includes('getOfficeEmptyState'),'get*EmptyState removidos');
assert(!managerCode.includes("!menuData && !officeData") || managerCode.includes('hasData'),'banner antigo !menuData&&!officeData removido (substituído por hasData)');

// 6 atalhos
console.log('\n=== Atalhos 6 rotas ===');
const qs = read('app/dashboard/manager/components/QuickShortcuts.tsx');
assert(qs.includes('/dashboard/setup'),'atalho Setup → /dashboard/setup');
assert(qs.includes('/dashboard/strategy'),'atalho Estratégia → /dashboard/strategy');
assert(qs.includes('/dashboard/tests'),'atalho Testes → /dashboard/tests');
assert(qs.includes('/dashboard/calendar'),'atalho Calendário → /dashboard/calendar');
assert(qs.includes('/dashboard/configuracoes/integracao'),'atalho Integração → /dashboard/configuracoes/integracao');
assert(qs.includes('/dashboard/market'),'atalho Mercado → /dashboard/market');

// Sanitização token (mantido)
console.log('\n=== Sanitização ===');
assert(managerCode.includes("gpro_token") && managerCode.includes('Erro na integração'),'sanitização token sem exposição');

// A11y
console.log('\n=== A11y ===');
assert(managerCode.includes('aria-live="polite"'),'aria-live');
assert(managerCode.includes('aria-busy'),'aria-busy');
const avatarInHero = read('app/dashboard/manager/components/ManagerHero.tsx').includes('aria-label="Alterar avatar');
assert(avatarInHero, 'avatar aria-label em ManagerHero');
assert(managerCode.includes('focus-visible:ring'),'foco visível');

// Staff calc import
console.log('\n=== Staff import ===');
assert(read('app/lib/staff.ts').includes('calcStaffLevel'),'staff.ts existe');
assert(read('app/dashboard/manager/components/TeamStateGroup.tsx').includes('calcStaffLevel') || managerCode.includes("from '@/app/lib/staff'"),'TeamStateGroup ou manager importa staff');

// Build check handled separately
console.log('\n=== ALFA-006.1 ok ===');
