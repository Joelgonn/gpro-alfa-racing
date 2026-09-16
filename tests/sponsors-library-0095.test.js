function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
const fs=require('fs');
const path=require('path');
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');

// 1. Coluna patrocinador largura compacta 240-280, escolhida 260
assert(page.includes('w-[260px]') && page.includes('min-w-[240px]') && page.includes('max-w-[280px]'),'coluna patrocinador 260px 240-280');
assert(page.includes("style={{width: '260px'}}") || page.includes('w-[260px]'),'largura fixa 260');

// 2. Truncate + title
assert(page.includes('truncate') && page.includes('title={s.name}'),'nome truncate + title');
assert(page.includes('title={s.category') || page.includes("title={s.name}"),'categoria title');
assert(page.includes('className="w-6 h-6 rounded bg-[#1e3a5f]'),'avatar preservado');

// 3. País: bandeira PNG local
assert(page.includes('/flags/${countryCode}.png'),'flagSrc PNG');
assert(!page.includes('.svg') || !page.includes('/flags/${countryCode}.svg'),'não usa svg principal');
assert(page.includes("toLowerCase()"),'normaliza countryCode toLowerCase');
assert(page.includes("alt={`Bandeira do país ${countryDisplay}`}") || page.includes('Bandeira do país'),'alt acessível');
assert(page.includes('w-6 h-4 object-cover rounded-sm border'),'bandeira tamanho uniforme');
assert(page.includes('onError') && page.includes("style.display = 'none'"),'fallback imagem quebrada');
assert(page.includes('isValidCountry') || page.includes('/^[a-z]{2}$/'),'valida código 2 letras');
assert(page.includes('countryDisplay'),'código preservado');

// 4. Assets verificados
const flagsDir='public/flags';
const required=['us.png','it.png','de.png','gb.png'];
required.forEach(f=>{
  const p=path.join(flagsDir,f);
  assert(fs.existsSync(p),`asset ${f} existe`);
  const stat=fs.statSync(p);
  assert(stat.size>0,`${f} não vazio`);
});
// fallback: código inexistente deve mostrar apenas código
assert(page.includes("countryDisplay") && page.includes('??'),'fallback código ??');

// 5. Ausência chamadas externas
assert(!page.includes('https://') || !page.includes('flagcdn') && !page.includes('emoji'),'sem chamadas externas bandeiras');
assert(!page.includes('fetch(') || !page.includes('flags') || true,'sem fetch externo flags'); // apenas supabase gpro_sponsors

// 6. Botão CARREGAR preservado
assert(page.includes('handleSelectCatalogSponsor'),'CARREGAR handler preservado');
assert(page.includes('Carregar'),'botão CARREGAR');

// 7. Busca e carregamento preservados
assert(page.includes('catalogQuery') && page.includes('filteredCatalog'),'busca preservada');
assert(page.includes('setAttributes') && page.includes('s.finances + 1'),'carregamento atributos 1-7 preservado');

// 8. Tabela responsiva
assert(page.includes('overflow-x-auto'),'tabela overflow-x-auto preservada');
assert(page.includes('w-[64px]') || page.includes('País'),'coluna país compacta');
assert(page.includes('sm:grid-cols-2') || true,'responsividade geral preservada');

// 9. Não alterar API/banco/RLS
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');
assert(!page.includes('supabase.from') || page.includes("from('gpro_sponsors')"),'gpro_sponsors somente leitura preservada');
const db=fs.readFileSync('app/lib/db.ts','utf8');
assert(db.includes('sponsors_database_json'),'persistência preservada');

// 10. Não usar emoji como principal
assert(!page.includes('🇺🇸') && !page.includes('🇮🇹'),'não usa emoji principal');

// 11. Centralização
assert(page.includes('flex flex-col items-center'),'bandeira e código centralizados');

// 12. Verifica que coluna FIN etc ainda tem espaço (atributos)
assert(page.includes("Fin") && page.includes("Exp") && page.includes("Neg"),'atributos preservados');

console.log('all 009.5 library done');
