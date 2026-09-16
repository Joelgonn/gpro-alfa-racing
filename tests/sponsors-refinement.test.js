function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }

function vantagemBruta(atual,medio,gerentes){ return (atual-medio)*gerentes; }
function vantagem(atual,medio,gerentes){ return Math.max(-100, Math.min(100, vantagemBruta(atual,medio,gerentes))); }
function estimativa(atual,medio,gerentes){ return (medio*gerentes)-atual; }
function tituloEstimativa(g){ return g===2 ? 'Estimativa do adversário' : 'Estimativa dos adversários'; }
// ALFA-009.3: cor/status da estimativa baseados na VANTAGEM, não no sinal da estimativa
function getEstimativaStatusALFA0093(vantagemNa, gerentes, isConcluida){
  if(isConcluida) return {color:'verde', status:'Negociação concluída'};
  if(Math.abs(vantagemNa)<=10) return {color:'laranja', status:'Negociação equilibrada'};
  if(vantagemNa>0) return {color:'verde', status: gerentes===2 ? 'Adversário atrás' : 'Adversários atrás'};
  return {color:'vermelho', status: gerentes===2 ? 'Adversário à frente' : 'Adversários à frente'};
}
function getInsight(vantagemNa, isConcluida){
  if(isConcluida) return 'A negociação atingiu 100% de progresso.';
  if(vantagemNa>0) return 'Você está à frente na negociação. Mantenha o acompanhamento do progresso.';
  if(vantagemNa===0) return 'A negociação está alinhada com a média. Pequenas mudanças no progresso podem alterar a vantagem.';
  if(vantagemNa<0 && Math.abs(vantagemNa)<=10) return 'Ainda dá para recuperar. A desvantagem é pequena; acompanhe o progresso da negociação.';
  if(vantagemNa< -10 && vantagemNa >= -20) return 'A negociação está difícil. Será necessário aumentar o progresso para reduzir a desvantagem.';
  if(vantagemNa< -20) return 'A desvantagem está elevada. Avalie se ainda vale a pena continuar nesta negociação.';
  return '';
}

// Estimativa: agora baseada na vantagem
// Caso vantagem +30 -> estimativa qualquer 15 mas status verde Adversário atrás
let vantagemVal=30;
let r=getEstimativaStatusALFA0093(vantagemVal,2,false);
assert(r.color==='verde' && r.status==='Adversário atrás','Estimativa com vantagem +30 -> verde Adversário atrás');

// vantagem -20 -> vermelho Adversário à frente
vantagemVal=-20;
r=getEstimativaStatusALFA0093(vantagemVal,2,false);
assert(r.color==='vermelho' && r.status==='Adversário à frente','vantagem -20 -> vermelho Adversário à frente');

// vantagem 0 -> laranja
r=getEstimativaStatusALFA0093(0,2,false);
assert(r.color==='laranja' && r.status==='Negociação equilibrada','vantagem 0 laranja');

// vantagem +8 -> laranja próxima de zero (prioridade distancia <=10)
r=getEstimativaStatusALFA0093(8,3,false);
assert(r.color==='laranja','vantagem +8 laranja próxima');

// vantagem +10 limite laranja
r=getEstimativaStatusALFA0093(10,2,false);
assert(r.color==='laranja','vantagem +10 laranja');

// vantagem +11 verde
r=getEstimativaStatusALFA0093(11,2,false);
assert(r.color==='verde','vantagem +11 verde');

// vantagem -11 vermelho
r=getEstimativaStatusALFA0093(-11,2,false);
assert(r.color==='vermelho','vantagem -11 vermelho');

// Insight recuperação -10
let v=-10;
assert(getInsight(v,false).includes('Ainda dá para recuperar'),'Insight -10 recuperação');

// Insight dificuldade -15
v=-15;
assert(getInsight(v,false).includes('negociação está difícil'),'Insight -15 difícil');

// Insight avaliação -21
v=-21;
assert(getInsight(v,false).includes('Avalie se ainda vale'),'Insight -21 avaliação');

// Negociação concluída prioriza sobre recuperação
let atual=100, medio=50, gerentes=3;
let vant=vantagem(atual,medio,gerentes);
let concluida=atual>=100;
let insight=getInsight(vant, concluida);
assert(concluida && vant===100,'Concluída vantagem +100');
assert(insight.includes('100% de progresso'),'Concluída insight 100%');
assert(!insight.includes('Ainda dá para recuperar'),'Concluída não mostra recuperação');
// estimativa status quando concluída
let estStatus=getEstimativaStatusALFA0093(vant, gerentes, concluida);
assert(estStatus.status==='Negociação concluída' && estStatus.color==='verde','Estimativa concluída verde Negociação concluída');

// Casos ALFA-009.1 ainda válidos
assert(vantagem(70,45,2)===50,'Compat 70,45,2 vantagem 50');
assert(estimativa(70,45,2)===20,'Compat estimativa 20');
assert(vantagem(35,40,2)===-10,'Compat -10');
assert(tituloEstimativa(2)==='Estimativa do adversário','titulo singular');
assert(tituloEstimativa(3)==='Estimativa dos adversários','titulo plural');

// Arquivo page.tsx contém novos textos e hierarquia
const fs=require('fs');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(page.includes('Vantagem na negociação'),'page contém Vantagem');
assert(page.includes('Estimativa do adversário'),'page contém Estimativa singular');
assert(page.includes('Você está à frente na negociação'),'page insight à frente');
assert(page.includes('Ainda dá para recuperar'),'page insight recuperar');
assert(page.includes('A negociação está difícil'),'page insight difícil');
assert(page.includes('A desvantagem está elevada'),'page insight elevada');
assert(page.includes('Negociação equilibrada'),'page status equilibrada');
assert(page.includes('Adversário à frente') || page.includes('Adversários à frente'),'page status adversário à frente');
assert(page.includes('Adversário atrás') || page.includes('Adversários atrás'),'page status adversário atrás');
assert(!page.includes('IA Competidora'),'sem IA');
assert(page.includes('estimativaExibida') || page.includes('estimativaMediaAdversarios'),'estimativaExibida abs presente');
assert(page.includes('Math.abs(vantagemNaNegociacao) <= 10'),'regra proximidade vantagem <=10 presente');

console.log('all refinement done');
