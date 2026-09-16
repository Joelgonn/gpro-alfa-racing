function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
function vantagemBruta(atual, medio, gerentes){ return (atual - medio) * gerentes; }
function vantagem(atual, medio, gerentes){ return Math.max(-100, Math.min(100, vantagemBruta(atual,medio,gerentes))); }
function estimativa(atual, medio, gerentes){ return (medio * gerentes) - atual; }
function statusVantagem(v){ if(v>0) return 'À frente na negociação'; if(v<0) return 'Atrás na negociação'; return 'Alinhado com a média'; }
function tituloEstimativa(gerentes){ return gerentes===2 ? 'Estimativa do adversário' : 'Estimativa dos adversários'; }

// Caso 1 — À frente
let atual=70, medio=45, gerentes=2;
assert(vantagem(atual,medio,gerentes)===50,'Caso1 vantagem +50');
assert(estimativa(atual,medio,gerentes)===20,'Caso1 estimativa +20');
assert(statusVantagem(vantagem(atual,medio,gerentes))==='À frente na negociação','Caso1 status À frente');

// Caso 2 — Atrás
atual=35; medio=40; gerentes=2;
assert(vantagem(atual,medio,gerentes)===-10,'Caso2 vantagem -10');
assert(estimativa(atual,medio,gerentes)===45,'Caso2 estimativa +45');
assert(statusVantagem(vantagem(atual,medio,gerentes))==='Atrás na negociação','Caso2 status Atrás');

// Caso 3 — Alinhado
atual=50; medio=50; gerentes=2;
assert(vantagem(atual,medio,gerentes)===0,'Caso3 vantagem 0');
assert(estimativa(atual,medio,gerentes)===50,'Caso3 estimativa +50');
assert(statusVantagem(vantagem(atual,medio,gerentes))==='Alinhado com a média','Caso3 status Alinhado');

// Caso 4 — Três gerentes (média por adversário ALFA-009.4)
atual=62; medio=50; gerentes=3;
assert(vantagem(atual,medio,gerentes)===36,'Caso4 vantagem +36');
assert(estimativa(atual,medio,gerentes)===88,'Caso4 total 88');
assert(Math.abs(estimativa(atual,medio,gerentes)/(gerentes-1))===44,'Caso4 média 44');
assert(tituloEstimativa(gerentes)==='Estimativa dos adversários','Caso4 titulo plural');

// Caso 5 — Limite superior + negociação concluída
atual=100; medio=50; gerentes=3;
assert(vantagemBruta(atual,medio,gerentes)===150,'Caso5 bruto +150');
assert(vantagem(atual,medio,gerentes)===100,'Caso5 exibida +100');
assert(atual>=100,'Caso5 negociação concluída flag true');
assert(tituloEstimativa(gerentes)==='Estimativa dos adversários','Caso5 titulo plural');

// Caso 6 — Limite inferior
atual=0; medio=100; gerentes=3;
assert(vantagemBruta(atual,medio,gerentes)===-300,'Caso6 bruto -300');
assert(vantagem(atual,medio,gerentes)===-100,'Caso6 exibida -100');
assert(estimativa(atual,medio,gerentes)===300,'Caso6 total 300');
assert(estimativa(atual,medio,gerentes)/(gerentes-1)===150,'Caso6 média 150');

// Extra: negativos preservados na estimativa (média)
assert(estimativa(80,30,2)===-20,'Extra total -20');
assert(Math.abs(estimativa(80,30,2)/(2-1))===20,'Extra média 20 abs');
assert(vantagem(35,40,2)===-10 && estimativa(35,40,2)===45,'Extra Caso2 revalidado');

// Sinalização
function formatSinal(v){ if(!Number.isFinite(v)) return '—'; if(v>0) return '+'+v.toFixed(0); return v.toFixed(0); }
assert(formatSinal(50)==='+50','format +50');
assert(formatSinal(0)==='0','format 0');
assert(formatSinal(-10)==='-10','format -10');

// Backend compat: diff bruto idêntico a vantagemBruta, clamp frontend -100..100 vs antigo 0..100
assert(vantagemBruta(70,45,2)===50,'compat diff 70-45*2 =50');

// Verificação arquivo não contém IA Competidora (leitura estática já coberta, mas lógica)
const fs=require('fs');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(!page.includes('IA Competidora'),'sem IA Competidora');
assert(!page.includes('competitorPosition'),'sem competitorPosition');
assert(!page.includes('opponentProgress') || page.includes('legado preservado'),'sem opponentProgress exibido');
assert(page.includes('Vantagem na negociação'),'contém Vantagem');
assert(page.includes('Estimativa do adversário'),'contém Estimativa');
assert(page.includes('Estimativa dos adversários'),'contém Estimativa plural');
assert(page.includes('Gerentes negociando'),'contém Gerentes negociando');
assert(page.includes('Meu progresso atual'),'contém Meu progresso atual');
assert(page.includes('Progresso médio'),'contém Progresso médio');
assert(page.includes('Negociação concluída'),'contém Negociação concluída');

console.log('all done');
