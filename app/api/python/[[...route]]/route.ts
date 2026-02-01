import { NextResponse } from 'next/server';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';
import { Mutex } from 'async-mutex';
import { getUserState, saveUserState } from '../../../lib/db';

// --- CONFIGURAÇÃO DE COORDENADAS ---
const CELLS = {
    MAIN_SHEET: 'Setup&WS',
    INPUT_TRACK: 'R5', 
    INPUT_DRIVER_COL: 4, INPUT_DRIVER_START_ROW: 6, 
    INPUT_CAR_LVL_COL: 8, START_ROW_CAR: 6,      
    INPUT_CAR_WEAR_COL: 9, 
    OUTPUT_COL_WEAR: 10,

    INPUT_TEMP_Q1: 'R7', 
    INPUT_TEMP_Q2: 'R8', 
    INPUT_TEMP_RACE_AVG: 'R9', 

    INPUT_WEATHER_Q1: 'T7', 
    INPUT_WEATHER_Q2: 'T8', 
    INPUT_WEATHER_RACE: 'T9',

    // CORREÇÃO AQUI: Célula para o Risco Pista Livre
    // Agora aponta para a aba Tyre&Fuel, coluna C (índice 2), linha 4 (índice 3)
    INPUT_RISCO_PISTA_LIVRE_SHEET: 'Tyre&Fuel', // Nome da aba
    INPUT_RISCO_PISTA_LIVRE_COL: 'C',          // Coluna C
    INPUT_RISCO_PISTA_LIVRE_ROW: 4,            // Linha 4

    OUTPUT_START_ROW: 6,
    OUTPUT_COL_Q1: 28, OUTPUT_COL_Q2: 29, OUTPUT_COL_RACE: 30,

    INPUT_TEST_POWER: 'N6', 
    INPUT_TEST_HANDLING: 'N7', 
    INPUT_TEST_ACCEL: 'N8',
    OUTPUT_COL_PART: 12, OUTPUT_COL_TEST: 13, OUTPUT_COL_CARRO: 14, OUTPUT_COL_PISTA: 15,
    OUTPUT_ZS_COL: 21, OUTPUT_ZS_START_ROW: 24,
};

// --- CONFIGURAÇÃO PATROCINADORES (BASEADO NO SEU ARQUIVO) ---
const SPONSOR_CONFIG = {
    SHEET_NAME_PRIMARY: 'Patrocinador',
    SHEET_NAME_FALLBACK: 'Patrocinador 1',
    TABLES_SHEET: 'Tables',
    
    REF_ROW_START_IDX: 36, // O37:T43 (Indices 0-based: Row 36-42)
    
    // Colunas (Indices 0-based: A=0, O=14...)
    COL_KEY: 14,          // O (Chave 1-7) no ExcelJS colIndex
    COL_EXPECT_IDX: 15,   // P
    COL_POP_IDX: 16,      // Q
    COL_AMOUNT_IDX: 17,   // R
    COL_DURATION_IDX: 18, // S
    COL_AREA_IDX: 19      // T
};

// --- SINGLETONS ---
let hfInstance: HyperFormula | null = null;
let sheetIdMap: Record<string, number> = {}; 
let loadingPromise: Promise<any> | null = null;
const calculationMutex = new Mutex(); 

// --- HELPERS ---
const colToInt = (colStr: string) => {
    let col = 0;
    for (let i = 0; i < colStr.length; i++) col = col * 26 + colStr.toUpperCase().charCodeAt(i) - 64;
    return col - 1;
};

const safeVal = (val: any) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === 'object' && val?.error) return null;
    if (typeof val === 'string') {
        const v = val.trim();
        if (v.toLowerCase() === "opt") return "Opt";
        if (v.toLowerCase() === "best") return "Best";
        const num = Number(v.replace(',', '.'));
        return isNaN(num) ? v : num;
    }
    if (typeof val === 'number') return Math.round(val * 10000) / 10000;
    return val;
};

// --- MOTOR DE EXCEL ---
async function getHyperFormulaInstance() {
  if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined) {
    return { hf: hfInstance, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
  }
  
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
      console.log("Iniciando carregamento do Excel...");
      const workbook = new ExcelJS.Workbook();
      const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
      await workbook.xlsx.readFile(filePath);

      const sheetsContent: Record<string, any[][]> = {};

      workbook.eachSheet((worksheet) => {
        const sheetData: any[][] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          const cleanValues = (row.values as any[]).map(cell => {
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
        
        // Fix Shared Formulas
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (cell.type === ExcelJS.ValueType.Formula && cell.formulaType === ExcelJS.FormulaType.Shared) {
                    const rowIndex = rowNumber - 1;
                    const colIndex = colNumber - 1;
                    if (sheetData[rowIndex]?.[colIndex] && (cell as any).master?.formula) {
                        sheetData[rowIndex][colIndex] = '=' + (cell as any).master.formula;
                    }
                }
            });
        });
        sheetsContent[worksheet.name] = sheetData;
      });

      console.log("Construindo HyperFormula...");
      const hf = HyperFormula.buildFromSheets(sheetsContent, { licenseKey: 'gpl-v3', useColumnIndex: false });
      
      const ids: Record<string, number> = {};
      const loadedSheets = hf.getSheetNames();
      loadedSheets.forEach(name => ids[name] = hf.getSheetId(name)!);
      sheetIdMap = ids;

      if (workbook.definedNames) {
          workbook.definedNames.forEach((defName: any) => {
              try {
                  if (defName.ranges && defName.ranges.length > 0) {
                      const name = defName.name;
                      const range = defName.ranges[0]; 
                      if (range.includes('#REF') || range.includes('[') || range.includes('http')) return;
                      try { hf.addNamedExpression(name, '=' + range); } catch (e) {}
                  }
              } catch (e) {}
          });
      }

      try { 
          const tablesSheetName = loadedSheets.find(s => s.toLowerCase() === 'tables') || 'Tables';
          try { hf.addNamedExpression('tyrediff', `=${tablesSheetName}!$A$60:$D$69`); } catch(e) {}
      } catch (e: any) { console.error("ERRO REGISTRO:", e.message); }

      console.log("Engine Pronto.");
      hfInstance = hf;
      return { hf, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
  })();

  return loadingPromise;
}

// --- ROTAS GET ---
export async function GET(request: Request, context: any) {
    try {
        const { hf, sheetIdMap } = await getHyperFormulaInstance();
        const { searchParams } = new URL(request.url);
        const params = await context.params; 
        let action = searchParams.get('action') || (params?.route ? params.route.join('/') : "");

        if (action.includes('tracks')) {
             return await calculationMutex.runExclusive(async () => {
                 const tracks = [];
                 const sid = sheetIdMap['Tracks'];
                 if (!sid) return NextResponse.json({ sucesso: true, tracks: [] });
                 for (let r = 4; r <= 1000; r++) {
                     const val = hf.getCellValue({ sheet: sid, col: 0, row: r - 1 });
                     if (val) tracks.push(val); 
                 }
                 return NextResponse.json({ sucesso: true, tracks });
             });
        }

        if (action.includes('tyre_suppliers')) {
            return await calculationMutex.runExclusive(async () => {
                const suppliers = [];
                const sid = sheetIdMap['Tyres'];
                if (sid !== undefined) {
                    for (let r = 2; r <= 15; r++) {
                        const val = hf.getCellValue({ sheet: sid, col: 0, row: r - 1 });
                        if (val && typeof val === 'string') suppliers.push(val.trim());
                    }
                }
                return NextResponse.json({ sucesso: true, suppliers });
            });
        }

        const userId = request.headers.get('user-id');
        if (!userId) return NextResponse.json({ sucesso: false, error: "Login necessário" }, { status: 401 });

        if (action.includes('get_state')) {
            const userState = await getUserState(userId);
            return NextResponse.json({ 
                sucesso: true, 
                data: { 
                    current_track: userState.track, 
                    driver: userState.driver, 
                    car: userState.car,
                    test_points: userState.test_points,
                    race_options: userState.race_options,
                    weather: userState.weather 
                } 
            });
        }
        return NextResponse.json({ sucesso: false, message: "Action not found" }, { status: 404 });
    } catch(e: any) { return NextResponse.json({sucesso: false, error: e.message}); }
}

// --- ROTAS POST ---
export async function POST(request: Request, context: any) {
  const userId = request.headers.get('user-id');
  if (!userId) return NextResponse.json({ sucesso: false, error: "Login necessário" }, { status: 401 });

  try {
    const { hf, mainSheetId, sheetIdMap } = await getHyperFormulaInstance();
    const { searchParams } = new URL(request.url);
    const params = await context.params;
    let action = searchParams.get('action') || (params?.route ? params.route.join('/') : "") || searchParams.get('endpoint') || "";
    const body = await request.json();

    return await calculationMutex.runExclusive(async () => {
        const write = (sheetId: number, col: string | number, row: number, val: any) => {
            const colIdx = typeof col === 'string' ? colToInt(col) : col;
            hf.setCellContents({ sheet: sheetId, col: colIdx, row: row - 1 }, [[val === "" || val === null ? null : val]]);
        };

        // 1. SPONSORS
        if (action.includes('sponsors')) {
            let sid = sheetIdMap[SPONSOR_CONFIG.SHEET_NAME_PRIMARY];
            if (sid === undefined) sid = sheetIdMap[SPONSOR_CONFIG.SHEET_NAME_FALLBACK];
            
            if (sid === undefined) {
                console.error("Aba Patrocinador não encontrada");
                return NextResponse.json({ sucesso: false, error: "Aba Patrocinador não encontrada no Excel" }, { status: 500 });
            }

            const B9 = Number(body.currentProgress) || 0;
            const B10 = Number(body.averageProgress) || 0;
            const B11 = Number(body.managers) || 1;

            const diff = (B9 * B11 - 100) - (B10 * B11 - 100);
            
            let opponentProgress = 0;
            const tablesSid = sheetIdMap[SPONSOR_CONFIG.TABLES_SHEET];
            if (tablesSid !== undefined) {
                for (let r = 28; r <= 30; r++) {
                    const mgrs = safeVal(hf.getCellValue({ sheet: tablesSid, col: 28, row: r-1 }));
                    const prog = safeVal(hf.getCellValue({ sheet: tablesSid, col: 29, row: r-1 }));
                    if (String(mgrs) == String(B11)) {
                        opponentProgress = Number(prog);
                        break;
                    }
                }
            }

            const lookup = (val: number, colIdx: number) => {
                let idx = Math.round(Number(val));
                if (idx < 1) idx = 1;
                if (idx > 7) idx = 7;
                
                const row = SPONSOR_CONFIG.REF_ROW_START_IDX + (idx - 1);
                return safeVal(hf.getCellValue({ sheet: sid!, col: colIdx, row: row }));
            };

            const answers = [];
            answers.push(lookup(body.image, SPONSOR_CONFIG.COL_AREA_IDX));
            answers.push(lookup(body.expectations, SPONSOR_CONFIG.COL_EXPECT_IDX));
            answers.push(lookup(body.image, SPONSOR_CONFIG.COL_POP_IDX));
            answers.push(lookup(body.patience, SPONSOR_CONFIG.COL_AMOUNT_IDX));
            answers.push(lookup(body.patience, SPONSOR_CONFIG.COL_DURATION_IDX));

            return NextResponse.json({
                sucesso: true,
                data: { answers, stats: { diff, opponentProgress } }
            });
        }

        // 2. UPDATE STATE
        if (action.includes('update_state')) {
            await saveUserState(userId, body);
            const saved = await getUserState(userId);
            if (saved.driver) {
                const dVals = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].map(k => [Number(saved.driver[k]) || 0]);
                hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, dVals);
            }
            const oa = safeVal(hf.getCellValue({ sheet: mainSheetId, col: 4, row: 4 }));
            return NextResponse.json({ sucesso: true, oa });
        }

        // 3. SETUP CALCULATE
        if (action.includes('setup_calculate')) {
            const savedState = await getUserState(userId);
            const combinedState = {
                track: body.pista || savedState.track,
                driver: { ...savedState.driver, ...(body.driver || {}) },
                car: body.car || savedState.car,
                avgTemp: body.raceAvgTemp !== undefined ? body.raceAvgTemp : (body.avgTemp !== undefined ? body.avgTemp : (savedState.weather?.raceAvgTemp || 20)),
                tempQ1: body.tempQ1 !== undefined ? body.tempQ1 : savedState.weather?.tempQ1,
                tempQ2: body.tempQ2 !== undefined ? body.tempQ2 : savedState.weather?.tempQ2,
                weatherQ1: body.weatherQ1 || savedState.weather?.weatherQ1,
                weatherQ2: body.weatherQ2 || savedState.weather?.weatherQ2,
                weatherRace: body.weatherRace || savedState.weather?.weatherRace,
                desgasteModifier: body.desgasteModifier !== undefined ? body.desgasteModifier : (savedState.desgasteModifier !== undefined ? savedState.desgasteModifier : 0) // Pega do body, depois do savedState, senão 0
            };

            if (combinedState.track) write(mainSheetId, 'R', 5, combinedState.track);
            write(mainSheetId, 'R', 7, combinedState.tempQ1); 
            write(mainSheetId, 'R', 8, combinedState.tempQ2); 
            write(mainSheetId, 'R', 9, combinedState.avgTemp);
            write(mainSheetId, 'T', 7, combinedState.weatherQ1); 
            write(mainSheetId, 'T', 8, combinedState.weatherQ2); 
            write(mainSheetId, 'T', 9, combinedState.weatherRace);
            
            if (combinedState.car) {
                const carLvl = combinedState.car.map((c: any) => [Number(c.lvl) || 1]);
                const carWear = combinedState.car.map((c: any) => [Number(c.wear) || 0]);
                hf.setCellContents({ sheet: mainSheetId, col: 8, row: 5 }, carLvl);
                hf.setCellContents({ sheet: mainSheetId, col: 9, row: 5 }, carWear);
            }
            if (combinedState.driver) {
                const d = combinedState.driver;
                const dVals = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].map(k => [Number(d[k]) || 0]);
                hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, dVals);
            }

            // CORREÇÃO FINAL: Injeta desgasteModifier na célula correta do Excel (Tyre&Fuel C4)
            const tyreFuelSid = sheetIdMap[CELLS.INPUT_RISCO_PISTA_LIVRE_SHEET];
            if (tyreFuelSid !== undefined) {
                write(tyreFuelSid, CELLS.INPUT_RISCO_PISTA_LIVRE_COL, CELLS.INPUT_RISCO_PISTA_LIVRE_ROW, Number(combinedState.desgasteModifier) || 0);
            } else {
                console.warn(`Aba '${CELLS.INPUT_RISCO_PISTA_LIVRE_SHEET}' não encontrada para injetar desgasteModifier.`);
            }
            
            const wearResults: any[] = [];
            for (let r = 5; r <= 15; r++) {
                wearResults.push({
                    start: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 9, row: r })),
                    end: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 10, row: r }))
                });
            }
            
            const setupParts = ["asaDianteira", "asaTraseira", "motor", "freios", "cambio", "suspensao"];
            const resultado: any = {};
            setupParts.forEach((p, i) => {
                const r = 5 + i;
                resultado[p] = {
                    q1: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 28, row: r })),
                    q2: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 29, row: r })),
                    race: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 30, row: r }))
                };
            });
            
            resultado.chassi = { wear: wearResults[0] }; 
            resultado.motor.wear = wearResults[1]; 
            resultado.asaDianteira.wear = wearResults[2]; 
            resultado.asaTraseira.wear = wearResults[3]; 
            resultado.assoalho = { wear: wearResults[4] }; 
            resultado.laterais = { wear: wearResults[5] }; 
            resultado.radiador = { wear: wearResults[6] }; 
            resultado.cambio.wear = wearResults[7]; 
            resultado.freios.wear = wearResults[8]; 
            resultado.suspensao.wear = wearResults[9]; 
            resultado.eletronicos = { wear: wearResults[10] };
            
            return NextResponse.json({ sucesso: true, data: resultado });
        }

        // 4. PERFORMANCE
        if (action.includes('performance')) {
            const savedState = await getUserState(userId);
            const combinedState = {
                track: body.pista || savedState.track,
                driver: { ...savedState.driver, ...(body.driver || {}) },
                car: body.car || savedState.car,
                test_points: { ...savedState.test_points, ...(body.test_points || {}) },
            };

            if (combinedState.track) write(mainSheetId, 'R', 5, combinedState.track);
            write(mainSheetId, 'N', 6, Number(combinedState.test_points.power)); 
            write(mainSheetId, 'N', 7, Number(combinedState.test_points.handling)); 
            write(mainSheetId, 'N', 8, Number(combinedState.test_points.accel));

            if (combinedState.driver) {
                const d = combinedState.driver;
                const dVals = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].map(k => [Number(d[k]) || 0]);
                hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, dVals);
            }

            if (combinedState.car) {
                const carLvl = combinedState.car.map((c: any) => [Number(c.lvl) || 1]);
                const carWear = combinedState.car.map((c: any) => [Number(c.wear) || 0]);
                hf.setCellContents({ sheet: mainSheetId, col: 8, row: 5 }, carLvl);
                hf.setCellContents({ sheet: mainSheetId, col: 9, row: 5 }, carWear);
            }

            const results: any = { power: {}, handling: {}, accel: {}, zs: {} };
            const keys: ('power' | 'handling' | 'accel')[] = ['power', 'handling', 'accel'];
            keys.forEach((key, i) => {
                const rowIdx = 5 + i;
                results[key].part = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 12, row: rowIdx })) || 0);
                results[key].test = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 13, row: rowIdx })) || 0);
                results[key].carro = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 14, row: rowIdx })) || 0);
                results[key].pista = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 15, row: rowIdx })) || 0);
            });
            const zsRow = 23;
            results.zs.wings = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow })) || 0);
            results.zs.motor = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 1 })) || 0);
            results.zs.brakes = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 2 })) || 0);
            results.zs.gear = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 3 })) || 0);
            results.zs.susp = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 4 })) || 0);
            return NextResponse.json({ sucesso: true, data: results });
        }

        // 5. STRATEGY CALCULATE
        if (action.includes('strategy_calculate')) {
            const savedState = await getUserState(userId);
            const combinedState = {
                race_options: { ...savedState.race_options, ...(body.race_options || {}) },
            };
            const tfSid = sheetIdMap['Tyre&Fuel'];
            const ro = combinedState.race_options || {};
            
            let finalSupplier = ro.pneus_fornecedor;
            const tyresSid = sheetIdMap['Tyres'];
            if (tyresSid !== undefined && finalSupplier) {
                 for (let r = 2; r <= 15; r++) {
                    const name = hf.getCellValue({ sheet: tyresSid, col: 0, row: r - 1 });
                    if (name && name.toString().toLowerCase().trim() === finalSupplier.toString().toLowerCase().trim()) {
                        finalSupplier = name; break;
                    }
                }
            }

            write(tfSid, 'C', 5, finalSupplier);
            write(tfSid, 'G', 3, Number(ro.desgaste_pneu_percent) || 0);
            write(tfSid, 'C', 3, ro.condicao); 
            write(tfSid, 'C', 4, Number(ro.ct_valor) || 0);
            write(tfSid, 'C', 6, ro.tipo_pneu); 
            write(tfSid, 'C', 7, Number(ro.pitstops_num) || 0);

            const ps = body.personal_stint_voltas || {};
            for (let i = 1; i <= 8; i++) write(tfSid, String.fromCharCode(70 + i), 21, ps[`stint${i}`] ? Number(ps[`stint${i}`]) : null);
            const bl = body.boost_laps || {};
            write(tfSid, 'R', 20, bl.boost1?.volta); write(tfSid, 'R', 21, bl.boost2?.volta); write(tfSid, 'R', 22, bl.boost3?.volta);

            const output: any = {
                race_calculated_data: {
                    nivel_aderencia: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 23 })),
                    consumo_combustivel: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 21 })),
                    desgaste_pneu_str: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 22 })),
                    ultrapassagem: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 16 })),
                    voltas: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 17 })),
                    pit_io: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 18 })),
                    tcd_corrida: safeVal(hf.getCellValue({ sheet: tfSid, col: 3, row: 20 })), 
                },
                compound_details_outputs: {}, stints_predefined: {}, stints_personal: {}, boost_laps_outputs: {}, boost_mini_stints_outputs: {}
            };

            const rowsCompMap: Record<string, number> = { "Extra Soft": 6, "Soft": 7, "Medium": 8, "Hard": 9 };
            Object.entries(rowsCompMap).forEach(([comp, row]) => {
                output.compound_details_outputs[comp] = {
                    req_stops: safeVal(hf.getCellValue({ sheet: tfSid, col: 6, row: row - 1 })),
                    fuel_load: safeVal(hf.getCellValue({ sheet: tfSid, col: 10, row: row - 1 })),
                    tyre_wear: safeVal(hf.getCellValue({ sheet: tfSid, col: 13, row: row - 1 })),
                    total: safeVal(hf.getCellValue({ sheet: tfSid, col: 14, row: row - 1 })),
                    gap: safeVal(hf.getCellValue({ sheet: tfSid, col: 15, row: row - 1 }))
                };
            });

            const configs = [{ key: "stints_predefined", start: 14 }, { key: "stints_personal", start: 21 }];
            configs.forEach(c => {
                const metrics = [{ key: "voltas", offset: 0 }, { key: "desg_final_pneu", offset: 1 }, { key: "comb_necessario", offset: 2 }, { key: "est_tempo_pit", offset: 3 }, { key: "voltas_em_bad", offset: 4 }];
                metrics.forEach(m => {
                    const rowObj: any = {};
                    for (let j = 1; j <= 8; j++) rowObj[`stint${j}`] = safeVal(hf.getCellValue({ sheet: tfSid, col: 5 + j, row: c.start + m.offset - 1 }));
                    rowObj["total"] = safeVal(hf.getCellValue({ sheet: tfSid, col: 14, row: c.start + m.offset - 1 }));
                    if (!output[c.key]) output[c.key] = {}; output[c.key][m.key] = rowObj;
                });
            });

            for(let i=1; i<=3; i++) {
                output.boost_laps_outputs[`boost${i}`] = {
                    stint: safeVal(hf.getCellValue({ sheet: tfSid, col: 18, row: 18 + i })),
                    voltas_list: safeVal(hf.getCellValue({ sheet: tfSid, col: 19, row: 18 + i })),
                };
            }
            for(let i=1; i<=4; i++) {
                output.boost_mini_stints_outputs[`stint${i}`] = {
                    val1: safeVal(hf.getCellValue({ sheet: tfSid, col: 16 + i, row: 24 })), 
                    val2: safeVal(hf.getCellValue({ sheet: tfSid, col: 16 + i, row: 23 }))  
                };
            }
            return NextResponse.json({ sucesso: true, data: output });
        }

        return NextResponse.json({ sucesso: false, message: "Endpoint não encontrado" }, { status: 404 });
    });

  } catch (error: any) {
    console.error("ERRO CRÍTICO NO POST:", error);
    return NextResponse.json({ sucesso: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}