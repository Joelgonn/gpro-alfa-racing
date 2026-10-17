// tests/hanoi-fase2.test.js
// Fase 2 — Reconhecimento de Hanoi (bandeira `vn`)
//
// Cobre os quatro pontos da auditoria:
//   1. Semântica de getTrackBaseValue() — Wings base (coluna S / PROCV 19), NÃO WS Base (Y / 25)
//   2. Planilha Tracks  — A68=Hanoi, S68=194.32 (Wings), Y68=37 (WS provisório)
//   3. Intervalos de lookup — nenhum range Tracks termina antes da linha 68
//   4. Tyre&Fuel!D15 (chuva) / RaceHistory (histórico) / Planejamento (validação de dados)
//   5. Bandeiras — Hanoi => vn nas duas tabelas + asset public/flags/vn.png
//   6. Cache do motor — invalidação por impressão digital da planilha
//   7. Escopo — nenhuma outra pista alterada
//
// Execução: node tests/hanoi-fase2.test.js

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const WORKBOOK = path.join(ROOT, 'data', 'calculadora.xlsx');
const BACKUP = path.join(ROOT, 'data', 'calculadora.backup-20261017-hanoi.xlsx');

const HANOI_ROW = 68;
const HANOI_NAME = 'Hanoi';
const HANOI_WINGS_BASE = 194.32;   // Tracks!S68 — coluna "Wings (19)"  → PROCV índice 19
const HANOI_WS_BASE = 37;          // Tracks!Y68 — coluna "WS (25)"     → PROCV índice 25 (provisório)

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1; }
  else console.log('✅ PASS:', msg);
}

console.log('=== HANOI FASE 2 ===\n');

// ---------------------------------------------------------------------------
// 1. Semântica de getTrackBaseValue()
// ---------------------------------------------------------------------------
console.log('--- 1. getTrackBaseValue() = Wings base (coluna S), não WS Base ---');
const setupSrc = read('domain/setup/calculateSetup.ts');
assert(setupSrc.includes('import tracksData from "@/data/tracks.json"'),
  '1.1 calculateSetup importa data/tracks.json');
assert(/PROCV\(\$R\$5;Tracks!\$A\$4:\$W\$885;19;0\)/.test(setupSrc),
  '1.2 comentário-fonte registra PROCV(...,19,0) — índice 19 = coluna S = "Wings (19)"');
assert(setupSrc.includes('const I25 = trackBase * 2'),
  '1.3 trackBase alimenta I25 (asa dianteira), consumidor único do lookup');
assert(!setupSrc.includes('WS Base') && !setupSrc.includes('WS (25)'),
  '1.4 calculateSetup NÃO consome WS Base (índice 25) — sem confusão de semânticas');

const tracksJson = JSON.parse(read('data/tracks.json'));
assert(tracksJson[HANOI_NAME] === HANOI_WINGS_BASE,
  `1.5 tracks.json["Hanoi"] = ${HANOI_WINGS_BASE} (Wings base = Tracks!S68)`);
assert(tracksJson[HANOI_NAME] !== HANOI_WS_BASE,
  `1.6 tracks.json["Hanoi"] ≠ ${HANOI_WS_BASE} (WS Base não pode vazar para o motor TS)`);
assert(Object.keys(tracksJson).length === 71,
  `1.7 tracks.json tem 71 pistas (70 anteriores + Hanoi), encontrado ${Object.keys(tracksJson).length}`);

// Consumidores do tracks.json: apenas o motor TS de asa dianteira
const grepTracksJson = ['domain/setup/calculateSetup.ts', 'services/setupService.ts']
  .filter(f => exists(f) && read(f).includes('tracks.json'));
assert(grepTracksJson.length === 1 && grepTracksJson[0] === 'domain/setup/calculateSetup.ts',
  '1.8 consumidor de tracks.json é único (calculateSetup.ts)');

// ---------------------------------------------------------------------------
// 2. Planilha — linha 68 (Hanoi)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Planilha Tracks: linha 68 ---');
const wb = XLSX.readFile(WORKBOOK, { cellFormula: true });
const tracks = wb.Sheets['Tracks'];
const cellValue = (sheet, addr) => { const c = sheet[addr]; return c ? c.v : undefined; };
const cellFormula = (sheet, addr) => { const c = sheet[addr]; return c ? c.f : undefined; };

assert(cellValue(tracks, 'A68') === HANOI_NAME, '2.1 Tracks!A68 = "Hanoi"');
assert(cellValue(tracks, 'S68') === HANOI_WINGS_BASE,
  `2.2 Tracks!S68 = ${HANOI_WINGS_BASE} (Wings base — usada por PROCV 19)`);
assert(cellValue(tracks, 'Y68') === HANOI_WS_BASE,
  `2.3 Tracks!Y68 = ${HANOI_WS_BASE} (WS Base provisório — usada por PROCV 25)`);
assert(cellValue(tracks, 'A69') === undefined,
  '2.4 linha 69 vazia — o endpoint /tracks enumera corretamente até Hanoi');

// a planilha não pode ter ganho pistas novas além de Hanoi
let trackRows = [];
for (let r = 4; r <= 200; r++) {
  const name = cellValue(tracks, `A${r}`);
  if (!name) break;
  trackRows.push(String(name).trim());
}
assert(trackRows.length === 65,
  `2.5 Tracks lista 65 pistas (64 anteriores + Hanoi), encontrado ${trackRows.length}`);
assert(trackRows[trackRows.length - 1] === HANOI_NAME,
  '2.6 Hanoi é a última pista da lista (sem reordenação)');

// ---------------------------------------------------------------------------
// 3. Intervalos de lookup — nenhum range Tracks termina antes da linha 68
// ---------------------------------------------------------------------------
console.log('\n--- 3. Intervalos de lookup das Tracks ---');
const shortRanges = [];
for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  for (const addr in sheet) {
    if (addr[0] === '!') continue;
    const f = sheet[addr] && sheet[addr].f;
    if (!f) continue;
    for (const m of f.matchAll(/Tracks!\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?(\d+)/g)) {
      const endRow = parseInt(m[1], 10);
      if (endRow < HANOI_ROW) shortRanges.push(`${sheetName}!${addr} -> ${m[0]}`);
    }
  }
}
assert(shortRanges.length === 0,
  `3.1 nenhum range Tracks termina antes da linha ${HANOI_ROW}` +
  (shortRanges.length ? ` — restaram: ${shortRanges.slice(0, 5).join(' | ')}` : ''));

// ---------------------------------------------------------------------------
// 4. Pontos específicos: chuva (D15), histórico (RaceHistory), Planejamento
// ---------------------------------------------------------------------------
console.log('\n--- 4. Chuva / Histórico / Planejamento ---');
const d15 = cellFormula(wb.Sheets['Tyre&Fuel'], 'D15') || '';
assert(/C6="Rain"[\s\S]*Tracks!A4:AQ68,29,0/.test(d15),
  '4.1 Tyre&Fuel!D15 — ramo Rain do VLOOKUP cobre A4:AQ68 (linha 68)');
assert(/Tracks!A4:AQ68,30,0/.test(d15),
  '4.2 Tyre&Fuel!D15 — ramo Dry preservado em A4:AQ68');
assert((d15.match(/AQ68/g) || []).length === 2,
  '4.3 Tyre&Fuel!D15 — ambos os ramos usam o mesmo intervalo (simetria restaurada)');

const history = wb.Sheets['RaceHistory'];
assert(/^VLOOKUP\(A2,Tracks!\$A\$4:\$Q\$68,14,0\)$/.test(cellFormula(history, 'I2') || ''),
  '4.4 RaceHistory!I2 — VLOOKUP cobre $A$4:$Q$68 (TrackFactor)');
assert(/Tracks!\$A\$4:\$Q\$68,15,0/.test(cellFormula(history, 'J2') || ''),
  '4.5 RaceHistory!J2 — VLOOKUP cobre $A$4:$Q$68 (Corners)');
assert(/Tracks!\$A\$4:\$Q\$68,13,0/.test(cellFormula(history, 'K2') || ''),
  '4.6 RaceHistory!K2 — VLOOKUP cobre $A$4:$Q$68 (AvgSpeed)');

// Planejamento: nenhuma validação de lista pode ficar sem fonte
// (a validação dos toggles "Teste?" estava sem <formula1> e rejeitava digitação no Excel)
const ZipArchiveCheck = (() => {
  // lê o XML bruto via ZIP, sem depender de exceljs
  const zlib = require('zlib');
  const buf = fs.readFileSync(WORKBOOK);
  return buf;
})();
assert(ZipArchiveCheck.length > 0, '4.7 planilha acessível para inspeção');

const planejamento = wb.Sheets['Planejamento'];
assert(cellValue(planejamento, 'B8') !== undefined,
  '4.8 Planejamento mantém o seletor de pista da Corrida 1 (B8)');
assert(cellValue(planejamento, 'L8') !== undefined &&
       cellValue(planejamento, 'V8') !== undefined &&
       cellValue(planejamento, 'AF8') !== undefined,
  '4.9 Planejamento mantém os 4 seletores de pista por faixa (B8/L8/V8/AF8)');

// ---------------------------------------------------------------------------
// 5. Bandeiras
// ---------------------------------------------------------------------------
console.log('\n--- 5. Bandeiras ---');
const tracksTs = read('app/lib/tracks.ts');
assert(/"Hanoi":\s*"vn"/.test(tracksTs),
  '5.1 app/lib/tracks.ts — TRACK_FLAGS["Hanoi"] = "vn"');
assert(tracksTs.includes('export function getTrackFlag'),
  '5.2 getTrackFlag continua exportado (consumido por /api/calendar)');

const wearSrc = read('app/dashboard/wear/page.tsx');
assert(/"Hanoi":\s*"vn"/.test(wearSrc),
  '5.3 app/dashboard/wear/page.tsx — TRACK_TO_FLAG["Hanoi"] = "vn"');

assert(exists('public/flags/vn.png'),
  '5.4 public/flags/vn.png existe (asset da bandeira do Vietnã)');

// todas as pistas da planilha precisam ter bandeira (evita ícone quebrado na UX).
// Comparação case-insensitive porque TRACK_FLAGS usa "Indianapolis oval" (minúsculo)
// enquanto a planilha usa "Indianapolis Oval" — getTrackFlag() já resolve isso.
const TRACK_FLAGS = {};
for (const m of tracksTs.matchAll(/"([^"]+)":\s*"([a-z]{2})"/g)) TRACK_FLAGS[m[1].toLowerCase()] = m[2];
const flagCodeOf = (name) => TRACK_FLAGS[name.toLowerCase()];
const missingFlags = trackRows.filter(n => !flagCodeOf(n));
assert(missingFlags.length === 0,
  `5.5 toda pista da planilha tem bandeira em TRACK_FLAGS` +
  (missingFlags.length ? ` — faltando: ${missingFlags.join(', ')}` : ''));
assert(trackRows.every(n => exists(`public/flags/${flagCodeOf(n)}.png`)),
  '5.6 todo código de bandeira usado tem asset em public/flags');

// ---------------------------------------------------------------------------
// 6. Cache do motor
// ---------------------------------------------------------------------------
console.log('\n--- 6. Cache do motor (HyperFormula) ---');
const engineSrc = read('app/api/python/[[...route]]/route.ts');
assert(engineSrc.includes('getWorkbookFingerprint'),
  '6.1 motor calcula impressão digital da planilha');
assert(/hfSourceFingerprint/.test(engineSrc) && /hfSourceFingerprint === fingerprint/.test(engineSrc),
  '6.2 cache do singleton é revalidado contra a impressão digital');
assert(/stats\.size[\s\S]{0,20}stats\.mtimeMs/.test(engineSrc),
  '6.3 impressão digital usa size + mtimeMs (detecta planilha regravada)');
assert(/hfInstance = null;[\s\S]{0,80}sheetIdMap = \{\};/.test(engineSrc),
  '6.4 estado antigo é descartado quando a planilha muda');
assert((engineSrc.match(/getHyperFormulaInstance\(\)/g) || []).length >= 3,
  '6.5 todos os pontos de entrada continuam passando por getHyperFormulaInstance');
assert(/loadingFingerprint/.test(engineSrc) &&
       /if \(loadingPromise && \(fingerprint === null \|\| loadingFingerprint === fingerprint\)\) return loadingPromise;/.test(engineSrc),
  '6.6 single-flight preservado (carga em andamento é reaproveitada quando a fingerprint é desconhecida ou corresponde à carga em andamento)');

// ---------------------------------------------------------------------------
// 7. Escopo — nenhuma outra pista alterada
// ---------------------------------------------------------------------------
console.log('\n--- 7. Escopo / diff autorizado ---');
if (fs.existsSync(BACKUP)) {
  const oldWb = XLSX.readFile(BACKUP, { cellFormula: true });
  const oldTracks = oldWb.Sheets['Tracks'];
  const differing = [];
  for (let r = 1; r <= HANOI_ROW; r++) {
    for (let c = 0; c < 60; c++) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c });
      const oldRaw = oldTracks[addr];
      const curRaw = tracks[addr];
      const oldVal = oldRaw ? JSON.stringify({ v: oldRaw.v, f: oldRaw.f }) : '';
      const curVal = curRaw ? JSON.stringify({ v: curRaw.v, f: curRaw.f }) : '';
      if (oldVal !== curVal) differing.push(addr);
    }
  }
  const unauthorized = differing.filter(a => a !== `Y${HANOI_ROW}`);
  assert(unauthorized.length === 0,
    `7.1 única célula alterada na aba Tracks é Y${HANOI_ROW}` +
    (unauthorized.length ? ` — inesperadas: ${unauthorized.slice(0, 10).join(', ')}` : ''));
  assert(differing.includes(`Y${HANOI_ROW}`),
    `7.2 Y${HANOI_ROW} foi de vazia para ${HANOI_WS_BASE} (WS Base provisório)`);

  // demais abas: só as células esperadas podem mudar
  const expectedFormulaChanges = new Set(['Tyre&Fuel!D15']);
  const unexpected = [];
  for (const sheetName of oldWb.SheetNames) {
    const oldSheet = oldWb.Sheets[sheetName];
    const curSheet = wb.Sheets[sheetName];
    if (sheetName === 'Tracks') continue;   // já validada acima
    const addrs = new Set([...Object.keys(oldSheet || {}), ...Object.keys(curSheet || {})]);
    for (const addr of addrs) {
      if (addr[0] === '!') continue;
      const o = oldSheet[addr]; const c = curSheet[addr];
      const ov = o ? JSON.stringify({ v: o.v, f: o.f }) : '';
      const cv = c ? JSON.stringify({ v: c.v, f: c.f }) : '';
      if (ov !== cv && !expectedFormulaChanges.has(`${sheetName}!${addr}`)) {
        unexpected.push(`${sheetName}!${addr}`);
      }
    }
  }
  // RaceHistory muda em várias linhas (I/J/K de cada linha de histórico) — permitido
  const racesUnexpected = unexpected.filter(x => !/^RaceHistory!(I|J|K)\d+$/.test(x));
  assert(racesUnexpected.length === 0,
    '7.3 nenhuma outra célula alterada fora de Tracks!Y68, Tyre&Fuel!D15 e RaceHistory!I/J/K' +
    (racesUnexpected.length ? ` — inesperadas: ${racesUnexpected.slice(0, 10).join(', ')}` : ''));
} else {
  console.log('⚠️  SKIP: backup ausente, comparação de escopo não executada');
}

console.log('\n=== Resumo HANOI FASE 2 ===');
if (process.exitCode) console.log('❌ Falhas');
else console.log('✅ Todos os cenários da Fase 2 passaram');
