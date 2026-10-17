// tests/hanoi-fase2-engine.test.js
// Fase 2 — Validação de Hanoi no MOTOR REAL (HyperFormula + data/calculadora.xlsx)
//
// Monta o workbook exatamente como app/api/python/[[...route]]/route.ts faz e
// verifica que Hanoi é reconhecida pelo setup, pelas chuvas, pelo histórico e
// pelo planejamento, sem erro de lookup nas tabelas `Tracks`.
//
// Execução: node tests/hanoi-fase2-engine.test.js

const path = require('path');
const ExcelJS = require('exceljs');
const { HyperFormula } = require('hyperformula');

const ROOT = path.join(__dirname, '..');
const WORKBOOK_PATH = path.join(ROOT, 'data', 'calculadora.xlsx');

const HANOI = 'Hanoi';
const CONTROL = 'Monza'; // pista madura, presente em todos os intervalos

// Esperados para Hanoi (linha 68 da aba Tracks)
const EXPECT = {
  wingsBaseTimes2: 194.32 * 2, // Tracks!S68 * 2  → Setup&WS!I25
  wsBase: 37,                  // Tracks!Y68      → termo do VLOOKUP em Setup&WS!Y24
  tyreRain: 0.72,              // Tracks!AC68     → Tyre&Fuel!D15 (ramo Rain)
  tyreDry: 1.04,               // Tracks!AD68     → Tyre&Fuel!D15 (ramo Dry)
  trackFactor: 0.02388,        // Tracks!N68      → RaceHistory!I2
  corners: 23,                 // Tracks!O68      → RaceHistory!J2
  avgSpeed: 216,               // Tracks!M68      → RaceHistory!K2
};

// Tipos de erro do HyperFormula (o detalhe vem em v.type: "NA", "REF", ...)
const ERROR_TYPES = new Set(['ERROR', 'NA', 'VALUE', 'DIV_BY_ZERO', 'REF', 'NAME', 'NUM', 'CYCLE', 'SPILL', 'PARSE']);

console.log('=== HANOI FASE 2 — MOTOR (HyperFormula) ===\n');

function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1; }
  else console.log('✅ PASS:', msg);
}

function near(a, b, tol) {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);
}

function isErrorValue(v) {
  return !!v && typeof v === 'object' && typeof v.type === 'string' && ERROR_TYPES.has(v.type);
}

// CellValue do HyperFormula → { kind, value }
function read(hf, sheetName, addr) {
  const sheet = hf.getSheetId(sheetName);
  if (sheet === undefined) return { kind: 'NOSHEET', value: undefined };
  const parsed = hf.simpleCellAddressFromString(addr, sheet);
  if (!parsed) return { kind: 'BADADDR', value: undefined };
  const v = hf.getCellValue({ sheet, col: parsed.col, row: parsed.row });
  if (v === null || v === undefined) return { kind: 'EMPTY', value: v };
  if (typeof v === 'object') {
    if (isErrorValue(v)) return { kind: 'ERROR', value: v.value };
    return { kind: v.type || 'OBJ', value: v };
  }
  return { kind: typeof v, value: v };
}

function setCell(hf, sheetName, addr, value) {
  const sheet = hf.getSheetId(sheetName);
  const parsed = hf.simpleCellAddressFromString(addr, sheet);
  hf.setCellContents({ sheet, col: parsed.col, row: parsed.row }, [[value]]);
}

function setTrack(hf, trackName) {
  setCell(hf, 'Setup&WS', 'R5', trackName);
}

function describe(r) {
  return r.kind === 'ERROR' ? `ERRO ${JSON.stringify(r.value)}` : `${r.kind} ${JSON.stringify(r.value)}`;
}

// Varre uma aba e devolve Map { "Aba!A1" -> { formula, errorValue } } só das células em erro
function collectErrors(hf, sheetName, maxRows, maxCols) {
  const sheet = hf.getSheetId(sheetName);
  const out = new Map();
  if (sheet === undefined) return out;
  const dims = hf.getSheetDimensions(sheet);
  if (!dims) return out;
  const rows = Math.min(dims.height, maxRows || 120);
  const cols = Math.min(dims.width, maxCols || 60);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = hf.getCellValue({ sheet, col, row });
      if (!isErrorValue(v)) continue;
      const addr = hf.simpleCellAddressToString({ sheet, col, row }, sheet);
      const formula = hf.getCellFormula({ sheet, col, row });
      out.set(`${sheetName}!${addr}`, { formula: typeof formula === 'string' ? formula : '', errorValue: v.value });
    }
  }
  return out;
}

async function main() {
  // ---------------------------------------------------------------------
  // Monta o workbook igual ao motor oficial
  // ---------------------------------------------------------------------
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const sheetsContent = {};
  workbook.eachSheet((worksheet) => {
    const sheetData = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cleanValues = (row.values || []).map((cell) => {
        if (cell === null || cell === undefined) return null;
        if (typeof cell !== 'object') return cell;
        let val = null;
        if (cell.formula) val = '=' + cell.formula;
        else if (cell.sharedFormula) val = cell.result !== undefined ? cell.result : 0;
        else if (cell.result !== undefined) val = cell.result;
        else if (cell.text) val = cell.text;
        if (val && typeof val === 'object') return 0;
        return val !== undefined ? val : '';
      });
      sheetData.push(cleanValues.slice(1));
    });
    // resolve fórmulas compartilhadas (mesmo tratamento do motor oficial)
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
          const rowIndex = rowNumber - 1;
          const colIndex = colNumber - 1;
          if (sheetData[rowIndex]?.[colIndex] && cell.master?.formula) {
            sheetData[rowIndex][colIndex] = '=' + cell.master.formula;
          }
        }
      });
    });
    sheetsContent[worksheet.name] = sheetData;
  });

  console.log('Construindo HyperFormula...');
  const hf = HyperFormula.buildFromSheets(sheetsContent, {
    licenseKey: 'gpl-v3',
    useColumnIndex: false,
  });
  console.log('Motor pronto.\n');

  // ---------------------------------------------------------------------
  // 1. Setup — Wings base (PROCV 19) e WS Base (PROCV 25)
  // ---------------------------------------------------------------------
  console.log('--- 1. Setup&WS ---');
  setTrack(hf, HANOI);

  const i25 = read(hf, 'Setup&WS', 'I25');
  assert(near(i25.value, EXPECT.wingsBaseTimes2),
    `1.1 Setup&WS!I25 = Wings base * 2 = ${EXPECT.wingsBaseTimes2} (obtido: ${describe(i25)})`);

  const y24 = read(hf, 'Setup&WS', 'Y24');
  assert(y24.kind === 'number', `1.2 Setup&WS!Y24 (A.T. Q1) numérico — ${describe(y24)}`);

  const d24 = read(hf, 'Setup&WS', 'D24');
  assert(d24.kind === 'number', `1.3 Setup&WS!D24 (A.T. Q1 previsto) numérico — ${describe(d24)}`);
  assert(!near(d24.value, 251, 1.5),
    `1.4 A.T. Q1 previsto ≠ 251 — 251 era o resultado com Y68 vazia (obtido ${d24.value})`);

  for (const addr of ['Q25', 'R25', 'S25', 'C24', 'E24', 'I26', 'I27', 'I28', 'I29']) {
    const r = read(hf, 'Setup&WS', addr);
    assert(r.kind === 'number', `1.5 Setup&WS!${addr} numérico — ${describe(r)}`);
  }

  // ---------------------------------------------------------------------
  // 2. Tyre&Fuel — chuva (D15) e base por pneu
  // ---------------------------------------------------------------------
  console.log('\n--- 2. Tyre&Fuel (chuva) ---');
  const f4 = read(hf, 'Tyre&Fuel', 'F4');
  assert(String(f4.value).trim() === HANOI, `2.1 Tyre&Fuel!F4 espelha a pista (${describe(f4)})`);

  setCell(hf, 'Tyre&Fuel', 'C6', 'Rain');
  const d15Rain = read(hf, 'Tyre&Fuel', 'D15');
  assert(near(d15Rain.value, EXPECT.tyreRain),
    `2.2 D15 com composto "Rain" usa AC68 = ${EXPECT.tyreRain} (obtido: ${describe(d15Rain)})`);

  setCell(hf, 'Tyre&Fuel', 'C6', 'Extra Soft');
  const d15Dry = read(hf, 'Tyre&Fuel', 'D15');
  assert(near(d15Dry.value, EXPECT.tyreDry),
    `2.3 D15 com composto seco usa AD68 = ${EXPECT.tyreDry} (obtido: ${describe(d15Dry)})`);

  // ---------------------------------------------------------------------
  // 3. RaceHistory — VLOOKUP na aba Tracks
  // ---------------------------------------------------------------------
  console.log('\n--- 3. RaceHistory ---');
  setCell(hf, 'RaceHistory', 'A2', HANOI);
  const i2 = read(hf, 'RaceHistory', 'I2');
  const j2 = read(hf, 'RaceHistory', 'J2');
  const k2 = read(hf, 'RaceHistory', 'K2');
  assert(near(i2.value, EXPECT.trackFactor, 0.0005),
    `3.1 I2 TrackFactor = ${EXPECT.trackFactor} (obtido: ${describe(i2)})`);
  assert(near(j2.value, EXPECT.corners),
    `3.2 J2 Corners = ${EXPECT.corners} (obtido: ${describe(j2)})`);
  assert(near(k2.value, EXPECT.avgSpeed),
    `3.3 K2 AvgSpeed = ${EXPECT.avgSpeed} (obtido: ${describe(k2)})`);

  // regressão: pista antiga continua igual
  setCell(hf, 'RaceHistory', 'A2', 'A1-Ring ');
  const i2ctrl = read(hf, 'RaceHistory', 'I2');
  assert(near(i2ctrl.value, 0.0074, 0.0005),
    `3.4 regressão: A1-Ring continua 0.0074 (obtido: ${describe(i2ctrl)})`);
  setCell(hf, 'RaceHistory', 'A2', 'A1-Ring');

  // ---------------------------------------------------------------------
  // 4. Planejamento — desgaste por pista
  // ---------------------------------------------------------------------
  console.log('\n--- 4. Planejamento ---');
  setCell(hf, 'Planejamento', 'B8', HANOI);
  const wearCells = ['E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19', 'E20', 'E21'];
  const wearBad = wearCells.filter((a) => read(hf, 'Planejamento', a).kind !== 'number');
  assert(wearBad.length === 0,
    '4.1 desgaste E11:E21 calculado para Hanoi' +
    (wearBad.length ? ` — com erro/vazio: ${wearBad.map((a) => `${a}=${describe(read(hf, 'Planejamento', a))}`).join(', ')}` : ''));
  const e11 = read(hf, 'Planejamento', 'E11');
  assert(e11.value > 0 && e11.value < 100,
    `4.2 Planejamento!E11 (Chassi, wear) plausível — ${describe(e11)}`);

  setCell(hf, 'Planejamento', 'L8', HANOI);
  const o11 = read(hf, 'Planejamento', 'O11');
  assert(o11.kind === 'number', `4.3 Planejamento!O11 (Corrida 2) numérico — ${describe(o11)}`);

  // ---------------------------------------------------------------------
  // 5. Erros de lookup — Hanoi x pista de controle
  //    Escopo da Fase 2: nenhuma célula que consulta a aba `Tracks` pode
  //    entrar em erro com Hanoi. Erros em células que consultam `Tables!U`
  //    (tabela de fator de teste por categoria) são fora de escopo e são
  //    reportados como pendência de dados.
  // ---------------------------------------------------------------------
  console.log('\n--- 5. Erros de lookup: Hanoi x controle ---');
  const SCAN_SHEETS = ['Setup&WS', 'Tyre&Fuel', 'Tables', 'Planejamento'];

  function errorSet(trackName) {
    setTrack(hf, trackName);
    const all = new Map();
    for (const sheetName of SCAN_SHEETS) {
      for (const [addr, info] of collectErrors(hf, sheetName)) all.set(addr, info);
    }
    return all;
  }

  const hanoiErrors = errorSet(HANOI);
  const controlErrors = errorSet(CONTROL);

  const tracksLookupErrors = (map) =>
    [...map.entries()].filter(([, info]) => /Tracks!/.test(info.formula));

  const hanoiTracksErrors = tracksLookupErrors(hanoiErrors);
  const controlTracksErrors = tracksLookupErrors(controlErrors);

  assert(hanoiTracksErrors.length === 0,
    '5.1 nenhuma célula que consulta a aba Tracks entra em erro com Hanoi' +
    (hanoiTracksErrors.length
      ? ` — restaram: ${hanoiTracksErrors.slice(0, 8).map(([a, i]) => `${a}=${i.errorValue}`).join(', ')}`
      : ''));
  assert(controlTracksErrors.length === 0,
    '5.2 controle (Monza) também sem erro nas consultas à aba Tracks');

  setTrack(hf, HANOI);
  const hanoiOnly = [...hanoiErrors.keys()].filter((a) => !controlErrors.has(a));
  const tableErrors = hanoiOnly.filter((a) => /Tables!U/.test(hanoiErrors.get(a).formula));

  console.log(`   ${CONTROL}: ${controlErrors.size} células em erro | ${HANOI}: ${hanoiErrors.size}`);
  if (hanoiOnly.length) {
    console.log(`   exclusivas de Hanoi (${hanoiOnly.length}): ${hanoiOnly.slice(0, 15).join(', ')}${hanoiOnly.length > 15 ? '…' : ''}`);
  }
  if (tableErrors.length) {
    console.log('   ⚠️  PENDÊNCIA (fora do escopo da Fase 2): tabela de fator de teste por categoria');
    console.log(`      ${tableErrors.map((a) => `${a}=${hanoiErrors.get(a).errorValue}`).join(', ')}`);
    console.log('      causa: Tables!U2:Z62 / U2:AB63 não contêm Hanoi nem fatores por categoria (dado ausente).');
  }

  assert(hanoiOnly.every((a) => !/Tracks!/.test(hanoiErrors.get(a).formula)),
    '5.3 todo erro exclusivo de Hanoi vem da tabela de fator de teste, nunca de Tracks');
  assert(hanoiOnly.every((a) => hanoiErrors.get(a).errorValue === '#N/A'),
    '5.4 todo erro exclusivo de Hanoi é #N/A ("valor não encontrado" = dado ausente), não fórmula quebrada');

  // Natureza pré-existente: as últimas pistas antigas também caem nessa lacuna.
  const zolderErrors = errorSet('Zolder');
  const zolderTableGap = [...zolderErrors.keys()].filter((a) => !controlErrors.has(a));
  console.log(`   Zolder (pista já existente): ${zolderTableGap.length} erro(s) na mesma tabela` +
    (zolderTableGap.length ? ` → ${zolderTableGap.slice(0, 8).join(', ')}` : ''));
  assert(zolderTableGap.length > 0,
    '5.5 a lacuna de Tables!U também afeta pista antiga (Zolder) — defeito pré-existente, não regressão de Hanoi');

  setTrack(hf, HANOI);

  // ---------------------------------------------------------------------
  // 6. Endpoint /api/python/tracks — caminho da UX
  //    Replica exatamente o laço do handler (linhas 4..1000, para no 1º vazio).
  // ---------------------------------------------------------------------
  console.log('\n--- 6. Endpoint /tracks (UX) ---');
  const tracksSheedId = hf.getSheetId('Tracks');
  const tracksList = [];
  for (let r = 4; r <= 1000; r++) {
    const name = hf.getCellValue({ sheet: tracksSheedId, col: 0, row: r - 1 });
    if (!name) break;
    tracksList.push(String(name));
  }
  assert(tracksList.includes(HANOI),
    `6.1 /tracks inclui Hanoi (lista com ${tracksList.length} pistas)`);
  const hanoiEntryRow = 4 + tracksList.indexOf(HANOI);
  const lengthCell = hf.getCellValue({ sheet: tracksSheedId, col: 6, row: hanoiEntryRow - 1 });
  const lapsCell = hf.getCellValue({ sheet: tracksSheedId, col: 7, row: hanoiEntryRow - 1 });
  assert(near(lengthCell, 5.607, 0.001) && near(lapsCell, 55),
    `6.2 dados de Hanoi retornados completos (lapLength=${lengthCell}, laps=${lapsCell})`);

  console.log('\n=== Resumo HANOI FASE 2 (motor) ===');
  if (process.exitCode) console.log('❌ Falhas');
  else console.log('✅ Hanoi reconhecida por setup, chuva, histórico e planejamento');
}

main().catch((err) => {
  console.error('❌ ERRO FATAL:', err);
  process.exitCode = 1;
});
