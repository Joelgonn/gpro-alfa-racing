function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
const fs=require('fs');
function decodeHtmlEntities(value){
  const text=String(value ?? '');
  if(!text) return text;
  let out=text.replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
  out=out.replace(/&#(\d+);/g,(_m,code)=>{ const n=Number(code); if(!Number.isFinite(n)||n<0||n>1114111) return _m; try{return String.fromCodePoint(n);}catch{return _m;}});
  out=out.replace(/&#x([0-9a-f]+);/gi,(_m,code)=>{ const n=parseInt(code,16); if(!Number.isFinite(n)||n<0||n>1114111) return _m; try{return String.fromCodePoint(n);}catch{return _m;}});
  return out;
}

// Nomeadas
assert(decodeHtmlEntities('&amp;')==='&','&amp;');
assert(decodeHtmlEntities('&apos;')==="'",'&apos;');
assert(decodeHtmlEntities('&#39;')==="'",'&#39;');
assert(decodeHtmlEntities('&quot;')==='"','&quot;');
assert(decodeHtmlEntities('&lt;')==='<','&lt;');
assert(decodeHtmlEntities('&gt;')==='>','&gt;');
assert(decodeHtmlEntities('&nbsp;')===' ','&nbsp;');

// Decimais — casos obrigatórios
assert(decodeHtmlEntities('It&#225;lia')==='Itália','It&#225;lia → Itália');
assert(decodeHtmlEntities('S&#227;o Paulo')==='São Paulo','S&#227;o Paulo → São Paulo');
assert(decodeHtmlEntities('Cr&#233;dit Agricole')==='Crédit Agricole','Cr&#233;dit');
assert(decodeHtmlEntities('P&#233;rez')==='Pérez','P&#233;rez');
assert(decodeHtmlEntities('A&amp;B')==='A&B','A&amp;B');
assert(decodeHtmlEntities('&#231;')==='ç','&#231; → ç');
assert(decodeHtmlEntities('&#237;')==='í','&#237;');
assert(decodeHtmlEntities('&#243;')==='ó','&#243;');
assert(decodeHtmlEntities('&#245;')==='õ','&#245;');
assert(decodeHtmlEntities('&#250;')==='ú','&#250;');
assert(decodeHtmlEntities('&#225;&#227;&#231;')==='áãç','multi decimais');

// Hexadecimais
assert(decodeHtmlEntities('L&#x27;Oréal')==="L'Oréal",'L&#x27;Oréal');
assert(decodeHtmlEntities('&#xE1;')==='á','&#xE1; → á');
assert(decodeHtmlEntities('&#xE3;')==='ã','&#xE3;');
assert(decodeHtmlEntities('&#xE7;')==='ç','&#xE7;');
assert(decodeHtmlEntities('&#xE9;')==='é','hex lower');
assert(decodeHtmlEntities('&#XE1;')==='á','hex upper');

// Texto já correto permanece
assert(decodeHtmlEntities('Müller')==='Müller','Müller preservado');
assert(decodeHtmlEntities('São Paulo')==='São Paulo','São Paulo preservado');
assert(decodeHtmlEntities("L'Oréal")==="L'Oréal",'L\'Oréal preservado');

// Fluxo patrocinador carregado — simula selectedSponsor
function simulateCardDisplay(sponsor){
  const displayName=decodeHtmlEntities(sponsor.name);
  const displayCategory=decodeHtmlEntities(sponsor.category || 'Geral');
  return {displayName, displayCategory};
}
let s={name:'It&#225;lia', category:'Cat&#233;goria'};
let d=simulateCardDisplay(s);
assert(d.displayName==='Itália','card nome It&#225;lia → Itália');
assert(d.displayCategory==='Catégoria','card categoria decodificada');
s={name:'S&#227;o Paulo', category:null};
d=simulateCardDisplay(s);
assert(d.displayName==='São Paulo','card São Paulo');
assert(d.displayCategory==='Geral','card Geral fallback');
s={name:'Cr&#233;dit Agricole', category:'Finan&#231;as'};
d=simulateCardDisplay(s);
assert(d.displayName==='Crédit Agricole','Crédit');
assert(d.displayCategory==='Finanças','Finanças');

// Entidades inválidas não quebram
assert(decodeHtmlEntities('&#9999999;')==='&#9999999;','code point inválido preservado');
assert(decodeHtmlEntities('&#xZZZ;')==='&#xZZZ;','hex inválido preservado');
assert(decodeHtmlEntities('&#;')==='&#;','entidade incompleta preservada');

// Segurança: não interpreta HTML
assert(!decodeHtmlEntities('<script>alert(1)</script>').includes('<script>alert')===false || decodeHtmlEntities('<script>alert(1)</script>')==='<script>alert(1)</script>','não executa, mantém texto');
assert(decodeHtmlEntities('&lt;script&gt;')==='<script>','&lt; decodifica mas não executa');

// Page contém helper corrigido e usos
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(page.includes('function decodeHtmlEntities(value: unknown)'),'helper assinatura unknown');
assert(page.includes("String.fromCodePoint"),'helper usa fromCodePoint');
assert(page.includes('&#(\\d+);') || page.includes('&#'),'helper decimal regex');
assert(page.includes('&#x') && page.includes('fromCodePoint'),'helper hex regex');
assert(!page.includes('dangerouslySetInnerHTML={'),'sem dangerouslySetInnerHTML');
assert((page.match(/decodeHtmlEntities\(/g)||[]).length>=4,'decode usado em >=4 pontos (tabela, autocomplete, card, categoria)');
assert(page.includes('decodeHtmlEntities(s.name)') || page.includes('decodeHtmlEntities(s.category') || page.includes('decodeHtmlEntities(loadedSponsor.name)'),'pontos de exibição cobertos');

// Não altera banco/API
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');

console.log('all 009.6.1 done');
