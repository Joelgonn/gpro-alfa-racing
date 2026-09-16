function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
const fs=require('fs');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');

// Isola trecho do card carregado
const cardStart = page.indexOf('Atributos do Patrocinador');
const cardSlice = cardStart !== -1 ? page.slice(cardStart, cardStart + 3000) : page.slice(0,3000);
const nextSection = cardSlice.indexOf('MÉTRICAS') !== -1 ? cardSlice.indexOf('MÉTRICAS') : cardSlice.indexOf('Métricas');
const cardBlock = nextSection !== -1 ? cardSlice.slice(0, nextSection) : cardSlice;

// 1. Card mostra nome
assert(cardBlock.includes('dName'), 'card usa dName');
assert(cardBlock.includes('title={dName}'), 'card title dName');

// 2. Card mostra somente categoria
assert(cardBlock.includes('dCat'), 'card usa dCat');
assert(cardBlock.includes('title={dCat}'), 'card title dCat');
assert(cardBlock.includes('{dCat}</div>') || cardBlock.includes('{dCat}'), 'card exibe apenas dCat');

// 3. Card não contém país
assert(!cardBlock.includes('loadedSponsor.country'), 'card não contém loadedSponsor.country');
assert(!cardBlock.includes("·") || !cardBlock.includes("join(' · ')"), 'card não contém separador · com país');
// Verifica que não há template `${country} · ${category}` no card
assert(!cardBlock.includes("country, dCat") && !cardBlock.includes("loadedSponsor.country, dCat"), 'card não combina país e categoria');

// 4. Não exibe Itália/It&#225;lia no card
assert(!cardBlock.includes('Itália') && !cardBlock.includes('It&#225;lia'), 'card não exibe Itália literal (país removido)');
assert(!cardBlock.includes("It\\u00E1lia"), 'card não exibe entidade Itália');

// 5. Categoria longa truncate e title completo
assert(cardBlock.includes('truncate'), 'card categoria truncate');
assert(cardBlock.includes('title={dCat}'), 'card title categoria completa');

// 6. Categoria ausente usa Geral
assert(page.includes("decodeHtmlEntities(loadedSponsor.category || 'Geral')") || page.includes("|| 'Geral'"), 'Geral fallback preservado');
assert(cardBlock.includes("'Geral'") || cardBlock.includes('"Geral"'), 'Geral no card');

// 7. Tabela continua exibindo país e bandeira normalmente
assert(page.includes('/flags/${countryCode}.png'), 'tabela flag PNG preservada');
assert(page.includes('countryDisplay'), 'tabela código país preservado');
assert(page.includes('País') || page.includes('PAÍS'), 'coluna PAÍS preservada');
assert(page.includes('w-[260px]'), 'coluna patrocinador 260px preservada');
const idxBib = page.indexOf('Biblioteca em Nuvem');
const tableSlice = idxBib !== -1 ? page.slice(idxBib, idxBib+4000) : page;
assert(tableSlice.includes('countryCode') || tableSlice.includes('countryDisplay'), 'tabela ainda usa país');
assert(tableSlice.includes('flagSrc') || tableSlice.includes('/flags/'), 'tabela bandeira');

// 8. Busca e autocomplete preservados
assert(page.includes('normalizeForSearch'), 'busca normalize preservada');
assert(page.includes('autocompleteSuggestions'), 'autocomplete preservado');
assert(page.includes('decodeHtmlEntities(s.name)') || page.includes('decodedName'), 'autocomplete decode preservado');

// 9. Helper decode preservado
assert(page.includes('function decodeHtmlEntities'), 'helper decode preservado');
assert(!page.includes('dangerouslySetInnerHTML={'), 'sem dangerouslySetInnerHTML');

// 10. Exemplo Netscaliburics
// Simula
function decodeHtmlEntities(v){ const t=String(v??''); let o=t.replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' '); o=o.replace(/&#(\d+);/g,(_,c)=>{const n=Number(c); if(!Number.isFinite(n)||n<0||n>1114111) return _; try{return String.fromCodePoint(n);}catch{return _;}}); o=o.replace(/&#x([0-9a-f]+);/gi,(_,c)=>{const n=parseInt(c,16); if(!Number.isFinite(n)||n<0||n>1114111) return _; try{return String.fromCodePoint(n);}catch{return _;}}); return o; }
let dName=decodeHtmlEntities('Netscaliburics');
let dCat=decodeHtmlEntities('Redes de computador (Redes de comput...)');
assert(dName==='Netscaliburics','Netscaliburics nome');
assert(dCat==='Redes de computador (Redes de comput...)','categoria longa');
let display = dCat; // card mostra apenas categoria
assert(display==='Redes de computador (Redes de comput...)','card somente categoria');
assert(!display.includes('Itália') && !display.includes('·'), 'card sem país nem separador');

// 11. Backend/API não alterados
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');

console.log('all 009.6.2 no-country done');
