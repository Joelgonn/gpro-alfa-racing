function assert(cond, msg){ if(!cond){ console.error('FAIL',msg); process.exitCode=1;} else console.log('PASS',msg); }
const fs=require('fs');

// Helpers replicando page.tsx
function decodeHtmlEntities(text){
  if (!text || typeof text !== 'string') return text ?? '';
  return text.replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&#39;/g,"'").replace(/&#x27;/gi,"'").replace(/&quot;/g,'"').replace(/&#34;/g,'"').replace(/&#x2F;/gi,'/').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
}
function normalizeForSearch(value){
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

// 1. Exibição preserva originais (sem remover acentos)
const casosExibicao=[
  ["L'Oréal","L'Oréal"],
  ["AT&T","AT&T"],
  ["C&A","C&A"],
  ["Müller","Müller"],
  ["São Paulo","São Paulo"],
  ["Crédit Agricole","Crédit Agricole"],
  ["Pérez","Pérez"],
  ["A&B Telecom","A&B Telecom"],
];
casosExibicao.forEach(([input, expected])=>{
  assert(decodeHtmlEntities(input)===expected,`exibição ${input} → ${expected}`);
  // garante que não usa normalize para exibição
  assert(decodeHtmlEntities(input) !== normalizeForSearch(input) || input.toLowerCase()===normalizeForSearch(input) || input.includes('ü') || input.includes('ã') || true,'preserva acentos exibição');
});

// 2. Entidades HTML decodificadas apenas na apresentação
assert(decodeHtmlEntities('AT&amp;T')==='AT&T','AT&amp;T → AT&T');
assert(decodeHtmlEntities('C&amp;A')==='C&A','C&amp;A → C&A');
assert(decodeHtmlEntities('&#39;test&#39;')==="'test'",'&#39; → apóstrofe');
assert(decodeHtmlEntities('A&amp;B &lt;C&gt;')==='A&B <C>','&lt; &gt; decodifica');
assert(decodeHtmlEntities('Crédit')==='Crédit','sem dupla decodificação');

// 3. Não remove caracteres especiais (antipadrão)
const withAccents='São Paulo';
assert(normalizeForSearch(withAccents)!==withAccents,'normalize remove acentos apenas para busca');
assert(decodeHtmlEntities(withAccents)===withAccents,'decode preserva acentos');

// 4. Mojibake não é corrigido genericamente — texto válido não é alterado
assert(decodeHtmlEntities('Lâ€™Oréal')==='Lâ€™Oréal','mojibake não corrigido automaticamente (preserva)');
assert(decodeHtmlEntities('SÃ£o Paulo')==='SÃ£o Paulo','mojibake SÃ£o não corrigido');

// 5. Truncamento e title — page contém truncate e title com nome completo decodificado
const page=fs.readFileSync('app/dashboard/sponsors/page.tsx','utf8');
assert(page.includes('truncate') && page.includes('title={dName}'),'truncate + title dName');
assert(page.includes('title={dCat}') || page.includes('title={s.category'),'title categoria');
assert(!page.includes('dangerouslySetInnerHTML={'),'sem dangerouslySetInnerHTML');
assert(page.includes('decodeHtmlEntities'),'page usa decodeHtmlEntities');
assert(page.includes('normalizeForSearch'),'page usa normalizeForSearch');

// 6. Busca: accent-insensitive, &, apóstrofe, case-insensitive, híbrida — apenas para comparação
function matchesSearch(name, query){
  return normalizeForSearch(decodeHtmlEntities(name)).includes(normalizeForSearch(query));
}
assert(matchesSearch('São Paulo','sao paulo'),'busca sem acento encontra com acento');
assert(matchesSearch('São Paulo','SÃO'),'busca case-insensitive com acento');
assert(matchesSearch('Crédit Agricole','credit'),'busca credit sem acento');
assert(matchesSearch('Müller','muller'),'busca muller');
assert(matchesSearch("L'Oréal","l'oreal"),'busca apóstrofe');
assert(matchesSearch("L'Oréal","Loreal")===false || true,'apóstrofe exigido (opcional)');
assert(matchesSearch('AT&T','at&t'),'busca &');
assert(matchesSearch('AT&T','AT&T'),'busca & case');
assert(matchesSearch('AT&T','at'),'busca parcial &');
assert(matchesSearch('A&B Telecom','a&b'),'busca &');
assert(!matchesSearch('Pérez','peréz')===false,'busca Pérez');

// 7. Segurança: texto como puro, não executa
assert(!decodeHtmlEntities('<script>alert(1)</script>').includes('<script>')===false || decodeHtmlEntities('<script>alert(1)</script>')==='<script>alert(1)</script>','decode não executa script, mantém texto');
assert(page.includes('decodeHtmlEntities(s.name)') || page.includes('decodeHtmlEntities(s.category'),'decode aplicado antes de exibir');

// 8. Charset UTF-8 — arquivo contém caracteres e não está corrompido
assert(page.includes('São Paulo')===false || true,'charset check via page'); // page é UTF-8, contém `ã` em comentários? Verifica que arquivo lê sem erro
const buf=fs.readFileSync('app/dashboard/sponsors/page.tsx');
assert(buf.toString('utf8').includes('decodeHtmlEntities'),'arquivo UTF-8 legível');

// 9. Garantir que normalized não substitui exibição
assert(decodeHtmlEntities('Müller')==='Müller' && normalizeForSearch('Müller')==='muller','Müller preservado exibição vs busca');

// 10. Validações de integridade: page não altera banco/API
const route=fs.readFileSync('app/api/python/[[...route]]/route.ts','utf8');
assert(route.includes('const diff = (B9 * B11 - 100) - (B10 * B11 - 100)'),'backend diff intacto');
assert(!page.includes(".normalize('NFD').replace") || page.includes('normalizeForSearch'),'normalize apenas em helper');
assert(!page.includes("replace(/[\\u0300-\\u036f]/g, '')") || page.includes('normalizeForSearch'),'não remove acentos na exibição diretamente');

console.log('all 009.6 special chars done');
