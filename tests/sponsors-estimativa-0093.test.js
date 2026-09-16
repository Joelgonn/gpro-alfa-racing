function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
function vantagemBruta(a,m,g){ return (a-m)*g; }
function vantagem(a,m,g){ return Math.max(-100, Math.min(100, vantagemBruta(a,m,g))); }
function estimativaTotal(a,m,g){ return (m*g)-a; }
function estimativa(a,m,g){ return (m*g)-a; } // total compat
function estimativaMedia(a,m,g){ return estimativaTotal(a,m,g)/Math.max(1,g-1); }
function estimativaExibida(a,m,g){ return Math.abs(estimativaMedia(a,m,g)); }
function titulo(g){ return g===2 ? 'Estimativa do adversário' : 'Estimativa dos adversários'; }
function getEstimativaStatus(vantagemNa, gerentes, isConcluida){
  if(isConcluida) return {color:'verde', status:'Negociação concluída'};
  if(Math.abs(vantagemNa)<=10) return {color:'laranja', status:'Negociação equilibrada'};
  if(vantagemNa>0) return {color:'verde', status: gerentes===2 ? 'Adversário atrás' : 'Adversários atrás'};
  return {color:'vermelho', status: gerentes===2 ? 'Adversário à frente' : 'Adversários à frente'};
}

// Caso 1 — Usuário à frente
let atual=45, medio=30, gerentes=2;
let vant=vantagem(atual,medio,gerentes);
let est=estimativa(atual,medio,gerentes);
let exib=estimativaExibida(atual,medio,gerentes);
let st=getEstimativaStatus(vant,gerentes, atual>=100);
assert(vant===30,'C1 vantagem +30');
assert(est===15,'C1 estimativa matemática +15');
assert(exib===15,'C1 exibido 15 sem sinal');
assert(st.color==='verde' && st.status==='Adversário atrás','C1 verde Adversário atrás');
assert(exib!==15 || String(exib).startsWith('+')===false && String(exib).startsWith('-')===false,'C1 não exibe +15/-15');
assert(titulo(gerentes)==='Estimativa do adversário','C1 titulo singular');

// Caso 2 — Usuário atrás
atual=40; medio=50; gerentes=2;
vant=vantagem(atual,medio,gerentes);
est=estimativa(atual,medio,gerentes);
exib=estimativaExibida(atual,medio,gerentes);
st=getEstimativaStatus(vant,gerentes,false);
assert(vant===-20,'C2 vantagem -20');
assert(est===60,'C2 estimativa +60');
assert(exib===60,'C2 exibido 60');
assert(st.color==='vermelho' && st.status==='Adversário à frente','C2 vermelho Adversário à frente');

// Caso 3 — Equilibrado
atual=40; medio=40; gerentes=2;
vant=vantagem(atual,medio,gerentes);
est=estimativa(atual,medio,gerentes);
exib=estimativaExibida(atual,medio,gerentes);
st=getEstimativaStatus(vant,gerentes,false);
assert(vant===0,'C3 vantagem 0');
assert(est===40,'C3 estimativa +40');
assert(exib===40,'C3 exibido 40');
assert(st.color==='laranja' && st.status==='Negociação equilibrada','C3 laranja');

// Caso 4 — Vantagem próxima +10
atual=45; medio=40; gerentes=2;
vant=vantagem(atual,medio,gerentes);
st=getEstimativaStatus(vant,gerentes,false);
assert(vant===10,'C4 vantagem +10');
assert(st.color==='laranja' && st.status==='Negociação equilibrada','C4 laranja equilibrada');

// Caso 5 — Três gerentes (média ALFA-009.4)
atual=62; medio=50; gerentes=3;
vant=vantagem(atual,medio,gerentes);
est=estimativaTotal(atual,medio,gerentes);
let media=estimativaMedia(atual,medio,gerentes);
exib=estimativaExibida(atual,medio,gerentes);
st=getEstimativaStatus(vant,gerentes,false);
assert(vant===36,'C5 vantagem +36');
assert(est===88,'C5 total 88');
assert(media===44,'C5 média 44');
assert(exib===44,'C5 exibido 44');
assert(st.color==='verde' && st.status==='Adversários atrás','C5 verde Adversários atrás');
assert(titulo(gerentes)==='Estimativa dos adversários','C5 titulo plural');

// Caso 6 — estimativa matemática negativa (deve exibir sem sinal e cor pela vantagem)
// Exemplo: atual 80, medio 30, gerentes 2 => estimativa =60-80=-20, vantagem=+100? Vamos achar caso onde estimativa negativa mas vantagem positiva
// Usar atual 70, medio 20, gerentes 2 => estimativa 40-70=-30, vantagem +100
atual=70; medio=20; gerentes=2;
vant=vantagem(atual,medio,gerentes);
est=estimativa(atual,medio,gerentes);
exib=estimativaExibida(atual,medio,gerentes);
st=getEstimativaStatus(vant,gerentes,false);
assert(est===-30,'C6 estimativa -30');
assert(exib===30,'C6 exibido 30 sem sinal');
assert(st.color==='verde','C6 cor segue vantagem +100 verde');
assert(!String(exib).includes('+') && !String(exib).includes('-') || exib===30,'C6 sem sinal');

// Verifica formato sem sinal sempre
function formatAbs(v){ return Math.abs(v).toFixed(0); }
assert(formatAbs(15)==='15','formatAbs 15');
assert(formatAbs(-15)==='15','formatAbs -15');
assert(formatAbs(0)==='0','formatAbs 0');

// Page checks
const fs=require('fs');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(page.includes('estimativaExibida') || page.includes('estimativaMediaAdversarios'),'page tem estimativa média');
assert(page.includes('quantidadeAdversarios'),'page quantidadeAdversarios');
assert(page.includes('Math.abs(vantagemNaNegociacao) <= 10'),'page regra proximidade vantagem');
assert(page.includes('Adversário atrás') || page.includes('Adversários atrás'),'page Adversário atrás');
assert(page.includes('Adversário à frente') || page.includes('Adversários à frente'),'page Adversário à frente');
assert(page.includes('formatAbs'),'page usa formatAbs sem sinal');
assert(page.includes('Média estimada por adversário'),'page texto média estimada');
assert(page.includes('Negociação concluída'),'page concluída');
// Não alterar API/persistência
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');

console.log('all 009.3 done');
