import { NextResponse } from 'next/server';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';

// --- MAPA DE CÉLULAS ---
const CELLS = {
  MAIN_SHEET: 'Setup&WS',
  
  // INPUTS
  INPUT_TRACK: 'R5', 
  INPUT_DRIVER_COL: 4, INPUT_DRIVER_START_ROW: 6, 
  INPUT_CAR_LVL_COL: 8, INPUT_CAR_WEAR_COL: 9, START_ROW_CAR: 6,      
  INPUT_TEST_POWER: 'N6', INPUT_TEST_HANDLING: 'N7', INPUT_TEST_ACCEL: 'N8',
  
  // OUTPUTS PERFORMANCE (M, N, O, P)
  OUTPUT_COL_PART: 12, OUTPUT_COL_TEST: 13, OUTPUT_COL_CARRO: 14, OUTPUT_COL_PISTA: 15,

  // --- NOVOS OUTPUTS: ZONA DE SATISFAÇÃO (Coluna V) ---
  // V24: Asas, V25: Motor, V26: Freios, V27: Câmbio, V28: Susp.
  OUTPUT_ZS_COL: 21, // Coluna V (A=0 ... V=21)
  OUTPUT_ZS_START_ROW: 24, // Linha 24
};

let hfInstance = null;
let sheetIdMap = {}; 

async function getHyperFormulaInstance() {
  if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined) {
    return { hf: hfInstance, sheetIdMap };
  }

  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
  await workbook.xlsx.readFile(filePath);

  const sheetsContent = {};

  workbook.eachSheet((worksheet, id) => { 
    const sheetName = worksheet.name; 
    const sheetData = [];

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cleanValues = row.values.map(cell => {
        if (cell === null || cell === undefined) return null;
        if (typeof cell !== 'object') return cell;

        let val = null;
        if (cell.formula) val = '=' + cell.formula;
        else if (cell.sharedFormula) val = cell.result !== undefined ? cell.result : 0; 
        else if (cell.result !== undefined) val = cell.result;
        else if (cell.richText) val = cell.richText.map(t => t.text).join('');
        else if (cell.text) val = cell.text;

        if (val && typeof val === 'object') return 0;
        if (val === undefined || val === null) return '';
        return val;
      });
      sheetData.push(cleanValues.slice(1)); 
    });

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
                 const rowIndex = rowNumber - 1; 
                 const colIndex = colNumber - 1; 
                 const currentValue = sheetData[rowIndex][colIndex];
                 if (currentValue && typeof currentValue !== 'string' || (typeof currentValue === 'string' && !currentValue.startsWith('='))) {
                     if (cell.master && cell.master.formula) {
                         sheetData[rowIndex][colIndex] = '=' + cell.master.formula;
                     }
                 }
            }
        });
    });

    sheetsContent[sheetName] = sheetData;
  });

  const hf = HyperFormula.buildFromSheets(sheetsContent, {
    licenseKey: 'gpl-v3'
  });

  const sheetNames = hf.getSheetNames();
  sheetNames.forEach(name => {
    sheetIdMap[name] = hf.getSheetId(name);
  });

  hfInstance = hf;
  return { hf, sheetIdMap };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { hf, sheetIdMap } = await getHyperFormulaInstance();
    const sheetId = sheetIdMap[CELLS.MAIN_SHEET];

    // INJEÇÃO (Pista, Testes, Piloto, Carro) - Mantido igual
    if (body.pista) hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TRACK, sheetId), [[body.pista]]);
    
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEST_POWER, sheetId), [[Number(body.test_power) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEST_HANDLING, sheetId), [[Number(body.test_handling) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEST_ACCEL, sheetId), [[Number(body.test_accel) || 0]]);

    const driverValues = [
      [Number(body.concentracao) || 0], [Number(body.talento) || 0], [Number(body.agressividade) || 0],
      [Number(body.experiencia) || 0], [Number(body.tecnica) || 0], [Number(body.resistencia) || 0],
      [Number(body.carisma) || 0], [Number(body.motivacao) || 0], [Number(body.reputacao) || 0], 
      [Number(body.peso) || 0], [Number(body.idade) || 0], [Number(body.energia) || 100], 
    ];
    hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_DRIVER_COL, row: CELLS.INPUT_DRIVER_START_ROW - 1 }, driverValues);

    const parts = [
      { lvl: body.chassi_lvl, wear: body.chassi_wear }, { lvl: body.motor_lvl, wear: body.motor_wear },
      { lvl: body.asaDianteira_lvl, wear: body.asaDianteira_wear }, { lvl: body.asaTraseira_lvl, wear: body.asaTraseira_wear },
      { lvl: body.assoalho_lvl, wear: body.assoalho_wear }, { lvl: body.laterais_lvl, wear: body.laterais_wear },
      { lvl: body.radiador_lvl, wear: body.radiador_wear }, { lvl: body.cambio_lvl, wear: body.cambio_wear },
      { lvl: body.freios_lvl, wear: body.freios_wear }, { lvl: body.suspensao_lvl, wear: body.suspensao_wear },
      { lvl: body.eletronicos_lvl, wear: body.eletronicos_wear },
    ];
    const carLevels = parts.map(p => [Number(p.lvl) || 1]);
    const carWears = parts.map(p => [Number(p.wear) || 0]);

    hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_CAR_LVL_COL, row: CELLS.START_ROW_CAR - 1 }, carLevels);
    hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_CAR_WEAR_COL, row: CELLS.START_ROW_CAR - 1 }, carWears);


    // --- LEITURA DOS RESULTADOS ---
    const performanceResults = {
        power: { part: 0, test: 0, carro: 0, pista: 0 },
        handling: { part: 0, test: 0, carro: 0, pista: 0 },
        accel: { part: 0, test: 0, carro: 0, pista: 0 },
        // NOVA PROPRIEDADE: ZS
        zs: { wings: 0, motor: 0, brakes: 0, gear: 0, susp: 0 }
    };
    
    // Performance (Linhas 6, 7, 8)
    const rows = [5, 6, 7];
    const keys = ['power', 'handling', 'accel'];
    rows.forEach((row, index) => {
        const key = keys[index];
        performanceResults[key].part   = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_PART, row }));
        performanceResults[key].test   = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_TEST, row }));
        performanceResults[key].carro  = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_CARRO, row }));
        performanceResults[key].pista  = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_PISTA, row }));
    });

    // ZS (Linhas 24 a 28) -> Index 23 a 27
    const zsStartRow = CELLS.OUTPUT_ZS_START_ROW - 1; // 23
    performanceResults.zs.wings  = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_ZS_COL, row: zsStartRow }));     // V24
    performanceResults.zs.motor  = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_ZS_COL, row: zsStartRow + 1 })); // V25
    performanceResults.zs.brakes = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_ZS_COL, row: zsStartRow + 2 })); // V26
    performanceResults.zs.gear   = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_ZS_COL, row: zsStartRow + 3 })); // V27
    performanceResults.zs.susp   = Math.round(hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_ZS_COL, row: zsStartRow + 4 })); // V28

    return NextResponse.json({ sucesso: true, data: performanceResults });

  } catch (error) {
    console.error("Erro na API de Performance:", error);
    return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  }
}