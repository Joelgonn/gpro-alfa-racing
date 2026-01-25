import { NextResponse } from 'next/server';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';

// --- CONFIGURAÇÃO DE COORDENADAS ---
const CELLS = {
  MAIN_SHEET: 'Setup&WS',
  
  // INPUTS GERAIS
  INPUT_TRACK: 'R5', 
  INPUT_DRIVER_COL: 4, INPUT_DRIVER_START_ROW: 6, 
  INPUT_CAR_LVL_COL: 8, START_ROW_CAR: 6,      

  // Input J (9) e Output K (10)
  INPUT_CAR_WEAR_COL: 9, // Coluna J (Inicial)
  OUTPUT_COL_WEAR: 10,   // Coluna K (Final)

  // TEMPERATURAS (R)
  INPUT_TEMP_Q1: 'R7', 
  INPUT_TEMP_Q2: 'R8', 
  INPUT_TEMP_RACE_AVG: 'R9', // Média

  // TEMPERATURAS DETALHADAS CORRIDA (S e T - Linhas 12 a 15)
  INPUT_R1_MIN: 'S12', INPUT_R1_MAX: 'T12', // 0h - 30m
  INPUT_R2_MIN: 'S13', INPUT_R2_MAX: 'T13', // 30m - 1h
  INPUT_R3_MIN: 'S14', INPUT_R3_MAX: 'T14', // 1h - 1h30
  INPUT_R4_MIN: 'S15', INPUT_R4_MAX: 'T15', // 1h30 - 2h

  // CLIMA (T)
  INPUT_WEATHER_Q1: 'T7', 
  INPUT_WEATHER_Q2: 'T8', 
  INPUT_WEATHER_RACE: 'T9',

  // SAÍDAS SETUP
  OUTPUT_START_ROW: 6,
  OUTPUT_COL_Q1: 28, OUTPUT_COL_Q2: 29, OUTPUT_COL_RACE: 30,
};

let hfInstance = null;
let sheetIdMap = {}; 

async function getHyperFormulaInstance() {
  if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined) {
    return { hf: hfInstance, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
  }

  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
  await workbook.xlsx.readFile(filePath);

  const sheetsContent = {};

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    const sheetData = [];

    worksheet.eachRow({ includeEmpty: true }, (row) => {
      // --- LIMPEZA BLINDADA ---
      const cleanValues = row.values.map(cell => {
        if (cell === null || cell === undefined) return null;
        if (typeof cell !== 'object') return cell;
        if (cell.error) return 0;
        
        let val = null;
        if (cell.formula) {
            val = '=' + cell.formula;
        } else if (cell.sharedFormula) {
            if (cell.result && typeof cell.result === 'object') return 0;
            val = cell.result;
        } else if (cell.result !== undefined) {
            if (typeof cell.result === 'object') return 0;
            val = cell.result;
        } else if (cell.richText) {
            val = cell.richText.map(t => t.text).join('');
        } else if (cell.text) {
            val = cell.text;
        }
        if (val && typeof val === 'object') return 0;
        return val !== undefined ? val : '';
      });
      
      sheetData.push(cleanValues.slice(1)); 
    });

    // Patch para fórmulas compartilhadas
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

  const hf = HyperFormula.buildFromSheets(sheetsContent, { licenseKey: 'gpl-v3', useColumnIndex: false });
  
  const ids = {};
  hf.getSheetNames().forEach(name => ids[name] = hf.getSheetId(name));
  sheetIdMap = ids;
  
  hfInstance = hf;
  return { hf, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { hf, mainSheetId, sheetIdMap } = await getHyperFormulaInstance();
    const sheetId = mainSheetId;

    // 1. INJEÇÃO DE DADOS BÁSICOS
    if (body.pista) hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TRACK, sheetId), [[body.pista]]);

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

    // 2. INJEÇÃO DE CLIMA E TEMPERATURAS
    
    // Q1 e Q2
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEMP_Q1, sheetId), [[Number(body.tempQ1) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEMP_Q2, sheetId), [[Number(body.tempQ2) || 0]]);
    
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_WEATHER_Q1, sheetId), [[body.weatherQ1 || "Dry"]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_WEATHER_Q2, sheetId), [[body.weatherQ2 || "Dry"]]);
    
    // Corrida (Clima Principal)
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_WEATHER_RACE, sheetId), [[body.weatherRace || "Dry"]]);

    // Corrida (Média em R9) - Usa o valor calculado no frontend ou recalcula aqui
    const avgTemp = body.avgTemp !== undefined ? Number(body.avgTemp) : 0;
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_TEMP_RACE_AVG, sheetId), [[avgTemp]]);

    // Corrida (Detalhes por Período - S12:T15)
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R1_MIN, sheetId), [[Number(body.r1_temp_min) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R1_MAX, sheetId), [[Number(body.r1_temp_max) || 0]]);
    
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R2_MIN, sheetId), [[Number(body.r2_temp_min) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R2_MAX, sheetId), [[Number(body.r2_temp_max) || 0]]);
    
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R3_MIN, sheetId), [[Number(body.r3_temp_min) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R3_MAX, sheetId), [[Number(body.r3_temp_max) || 0]]);
    
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R4_MIN, sheetId), [[Number(body.r4_temp_min) || 0]]);
    hf.setCellContents(hf.simpleCellAddressFromString(CELLS.INPUT_R4_MAX, sheetId), [[Number(body.r4_temp_max) || 0]]);

    // INJEÇÃO DE RISCO (Aba Tyre&Fuel - C4)
    const tyreSheetName = Object.keys(sheetIdMap).find(k => k.includes('Tyre'));
    const tyreSheetId = tyreSheetName ? sheetIdMap[tyreSheetName] : null;
    
    if (body.desgasteModifier !== undefined && tyreSheetId !== undefined) {
         hf.setCellContents({ sheet: tyreSheetId, col: 2, row: 3 }, [[Number(body.desgasteModifier) || 0]]);
    }

    // --- LEITURA DE RESULTADOS ---
    const outputRows = 6; 
    const startRow = CELLS.OUTPUT_START_ROW - 1;
    const setupQ1 = [], setupQ2 = [], setupRace = [], wearResult = [];

    for (let i = 0; i < outputRows; i++) {
      const row = startRow + i;
      const valQ1 = hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_Q1, row });
      const valQ2 = hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_Q2, row });
      const valRace = hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_RACE, row });
      setupQ1.push(Math.round(Number(valQ1) || 0));
      setupQ2.push(Math.round(Number(valQ2) || 0));
      setupRace.push(Math.round(Number(valRace) || 0));
    }

    // LEITURA DO DESGASTE: AGORA LÊ INICIAL (J) E FINAL (K)
    for (let i = 0; i < 11; i++) {
        const row = CELLS.START_ROW_CAR - 1 + i;
        const valStart = hf.getCellValue({ sheet: sheetId, col: CELLS.INPUT_CAR_WEAR_COL, row }); // Coluna J
        const valEnd = hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_WEAR, row }); // Coluna K
        
        wearResult.push({
            start: Math.round(Number(valStart) || 0),
            end: Math.round(Number(valEnd) || 0)
        });
    }

    const resultado = {
      asaDianteira: { q1: setupQ1[0], q2: setupQ2[0], race: setupRace[0], wear: wearResult[2] },
      asaTraseira:  { q1: setupQ1[1], q2: setupQ2[1], race: setupRace[1], wear: wearResult[3] },
      motor:        { q1: setupQ1[2], q2: setupQ2[2], race: setupRace[2], wear: wearResult[1] },
      freios:       { q1: setupQ1[3], q2: setupQ2[3], race: setupRace[3], wear: wearResult[8] },
      cambio:       { q1: setupQ1[4], q2: setupQ2[4], race: setupRace[4], wear: wearResult[7] },
      suspensao:    { q1: setupQ1[5], q2: setupQ2[5], race: setupRace[5], wear: wearResult[9] },
      
      chassi:       { wear: wearResult[0] },
      assoalho:     { wear: wearResult[4] },
      laterais:     { wear: wearResult[5] },
      radiador:     { wear: wearResult[6] },
      eletronicos:  { wear: wearResult[10] },
    };

    return NextResponse.json({ sucesso: true, data: resultado });

  } catch (error) {
    console.error("Erro API:", error);
    return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  }
}