function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
function vantagemBruta(a,m,g){ return (a-m)*g; }
function vantagem(a,m,g){ return Math.max(-100, Math.min(100, vantagemBruta(a,m,g))); }
function total(a,m,g){ return (m*g)-a; }
function qtd(g){ return Math.max(1, g-1); }
function media(a,m,g){ return total(a,m,g)/qtd(g); }
function exibida(a,m,g){ return Math.abs(media(a,m,g)); }
function formatMedia(v){ return Math.abs(v).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:1}); }
function titulo(g){ return g===2 ? 'Estimativa do adversário' : 'Estimativa dos adversários'; }
function getStatus(vant, gerentes, isConcluida){
  if(isConcluida) return {color:'verde', status:'Negociação concluída'};
  if(Math.abs(vant)<=10) return {color:'laranja', status:'Negociação equilibrada'};
  if(vant>0) return {color:'verde', status: gerentes===2 ? 'Adversário atrás' : 'Adversários atrás'};
  return {color:'vermelho', status: gerentes===2 ? 'Adversário à frente' : 'Adversários à frente'};
}

// Caso 1 — Dois gerentes
let atual=45, medio=30, gerentes=2;
assert(total(atual,medio,gerentes)===15,'C1 total 15');
assert(qtd(gerentes)===1,'C1 qtd 1');
assert(media(atual,medio,gerentes)===15,'C1 média 15');
assert(exibida(atual,medio,gerentes)===15,'C1 exibida 15');
let vant=vantagem(atual,medio,gerentes);
let st=getStatus(vant,gerentes,false);
assert(vant===30 && st.color==='verde' && st.status==='Adversário atrás','C1 verde Adversário atrás');
assert(titulo(gerentes)==='Estimativa do adversário','C1 titulo singular');
assert(formatMedia(media(atual,medio,gerentes))==='15','C1 format 15');

// Caso 2 — Dois gerentes, atrás
atual=40; medio=50; gerentes=2;
assert(total(atual,medio,gerentes)===60,'C2 total 60');
assert(media(atual,medio,gerentes)===60,'C2 média 60');
assert(exibida(atual,medio,gerentes)===60,'C2 exibida 60');
vant=vantagem(atual,medio,gerentes);
st=getStatus(vant,gerentes,false);
assert(vant===-20 && st.color==='vermelho' && st.status==='Adversário à frente','C2 vermelho');

// Caso 3 — Três gerentes (problema)
atual=30; medio=45; gerentes=3;
assert(total(atual,medio,gerentes)===105,'C3 total 105');
assert(qtd(gerentes)===2,'C3 qtd 2');
assert(media(atual,medio,gerentes)===52.5,'C3 média 52.5');
assert(exibida(atual,medio,gerentes)===52.5,'C3 exibida 52.5');
assert(formatMedia(media(atual,medio,gerentes))==='52,5','C3 format 52,5 pt-BR');
vant=vantagem(atual,medio,gerentes);
st=getStatus(vant,gerentes,false);
assert(vant===-45 && st.color==='vermelho' && st.status==='Adversários à frente','C3 vermelho Adversários à frente');
assert(titulo(gerentes)==='Estimativa dos adversários','C3 plural');

// Caso 4 — Três gerentes, à frente
atual=62; medio=50; gerentes=3;
assert(total(atual,medio,gerentes)===88,'C4 total 88');
assert(media(atual,medio,gerentes)===44,'C4 média 44');
assert(exibida(atual,medio,gerentes)===44,'C4 exibida 44');
assert(formatMedia(44)==='44','C4 format 44');
vant=vantagem(atual,medio,gerentes);
st=getStatus(vant,gerentes,false);
assert(vant===36 && st.color==='verde' && st.status==='Adversários atrás','C4 verde');

// Caso 5 — Negativa
atual=70; medio=20; gerentes=2;
let tot=total(atual,medio,gerentes);
let med=media(atual,medio,gerentes);
let ex=exibida(atual,medio,gerentes);
vant=vantagem(atual,medio,gerentes);
st=getStatus(vant,gerentes,false);
assert(tot===-30,'C5 total -30');
assert(med===-30,'C5 média -30');
assert(ex===30,'C5 exibida 30 abs');
assert(!String(ex).includes('-') && !String(ex).includes('+'),'C5 sem sinal');
assert(st.color==='verde','C5 cor pela vantagem verde');

// Caso 6 — Gerentes 1 evita divisão zero
assert(qtd(1)===1,'C6 qtd 1 min 1');
assert(media(30,45,1)===(45*1-30)/1,'C6 media gerentes1 sem div0');
assert(total(30,45,1)===15 && media(30,45,1)===15,'C6 total/media 15');

// Singular/plural
assert(titulo(2)==='Estimativa do adversário','titulo 2 singular');
assert(titulo(3)==='Estimativa dos adversários','titulo 3 plural');

// Texto obrigatório
const fs=require('fs');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(page.includes('quantidadeAdversarios'),'page qtd');
assert(page.includes('estimativaMediaAdversarios') || page.includes('totalEstimadoAdversarios'),'page total/media');
assert(page.includes('Média estimada por adversário'),'page texto média');
assert(page.includes('Não representa a porcentagem real'),'page texto não representa');
assert(page.includes('estimativaExibida') || page.includes('formatAbs'),'page exibida abs');
assert(page.includes("toLocaleString('pt-BR'") || page.includes('toLocaleString'),'page pt-BR format');
assert(!page.includes('IA Competidora'),'sem IA');
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');

console.log('all 009.4 done');
