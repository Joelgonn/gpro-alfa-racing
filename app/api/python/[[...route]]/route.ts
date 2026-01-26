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
    INPUT_CAR_WEAR_COL: 9, 
    OUTPUT_COL_WEAR: 10,

    // TEMPERATURAS (R)
    INPUT_TEMP_Q1: 'R7', 
    INPUT_TEMP_Q2: 'R8', 
    INPUT_TEMP_RACE_AVG: 'R9', 

    // CLIMA (T)
    INPUT_WEATHER_Q1: 'T7', 
    INPUT_WEATHER_Q2: 'T8', 
    INPUT_WEATHER_RACE: 'T9',

    // SAÍDAS SETUP
    OUTPUT_START_ROW: 6,
    OUTPUT_COL_Q1: 28, OUTPUT_COL_Q2: 29, OUTPUT_COL_RACE: 30,

    // MAPA DE PERFORMANCE
    INPUT_TEST_POWER: 'N6', 
    INPUT_TEST_HANDLING: 'N7', 
    INPUT_TEST_ACCEL: 'N8',
    OUTPUT_COL_PART: 12, OUTPUT_COL_TEST: 13, OUTPUT_COL_CARRO: 14, OUTPUT_COL_PISTA: 15,
    OUTPUT_ZS_COL: 21, OUTPUT_ZS_START_ROW: 24,
};

let hfInstance: HyperFormula | null = null;
let sheetIdMap: Record<string, number> = {}; 
let loadingPromise: Promise<any> | null = null;

// --- HELPERS ---
const colToInt = (colStr: string) => {
    let col = 0;
    for (let i = 0; i < colStr.length; i++) col = col * 26 + colStr.toUpperCase().charCodeAt(i) - 64;
    return col - 1;
};

const getCellAddr = (sheetId: number, colStr: string, rowNum: number) => {
    return { sheet: sheetId, col: colToInt(colStr), row: rowNum - 1 };
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

      // 1. Carregar Planilhas
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

      console.log("Abas Carregadas:", loadedSheets.join(", "));

      // --- 2. IMPORTAR NOMES DEFINIDOS (MODO SEGURO COM CORREÇÃO TS) ---
      if (workbook.definedNames) {
          // CORREÇÃO AQUI: Adicionado ': any' para evitar erro de build
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

      // --- 3. REGISTRO MANUAL OBRIGATÓRIO TYREDIFF ---
      try { 
          const tablesSheetName = loadedSheets.find(s => s.toLowerCase() === 'tables') || 'Tables';
          try {
             hf.addNamedExpression('tyrediff', `=${tablesSheetName}!$A$60:$D$69`);
             console.log("Sucesso: tyrediff registrado via addNamedExpression.");
          } catch(e) {
             console.log("Aviso: tyrediff já devia existir ou falhou registro.");
          }
      } catch (e: any) { 
          console.error("ERRO FATAL AO REGISTRAR TYREDIFF:", e.message);
      }

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
        let pathStr = params?.route ? params.route.join('/') : (searchParams.get('action') || "");

        if (pathStr.includes('tracks')) {
             const tracks = [];
             const sid = sheetIdMap['Tracks'];
             for (let r = 4; r <= 1000; r++) {
                 const val = hf.getCellValue({ sheet: sid, col: 0, row: r - 1 });
                 if (val) tracks.push(val); 
             }
             return NextResponse.json({ sucesso: true, tracks });
        }

        if (pathStr.includes('tyre_suppliers')) {
            const suppliers = [];
            const sid = sheetIdMap['Tyres'];
            if (sid !== undefined) {
                for (let r = 2; r <= 15; r++) {
                    const val = hf.getCellValue({ sheet: sid, col: 0, row: r - 1 });
                    if (val && typeof val === 'string') suppliers.push(val.trim());
                }
            }
            return NextResponse.json({ sucesso: true, suppliers });
        }

        if (pathStr.includes('state')) {
            const setupSid = sheetIdMap['Setup&WS'];
            const tfSid = sheetIdMap['Tyre&Fuel']; 
            const driverData: any = {};
            ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].forEach((k, i) => {
                driverData[k] = safeVal(hf.getCellValue({ sheet: setupSid, col: 4, row: 5 + i }));
            });
            const carData = [];
            for(let i=0; i<11; i++) {
                carData.push({
                    lvl: safeVal(hf.getCellValue({ sheet: setupSid, col: 8, row: 5 + i })),
                    wear: safeVal(hf.getCellValue({ sheet: setupSid, col: 9, row: 5 + i }))
                });
            }
            return NextResponse.json({ 
                sucesso: true, 
                data: { 
                    current_track: safeVal(hf.getCellValue({ sheet: setupSid, col: 17, row: 4 })), 
                    driver: driverData, car: carData,
                    race_options: { avg_temp: safeVal(hf.getCellValue({ sheet: setupSid, col: 17, row: 8 })), desgaste_pneu_percent: safeVal(hf.getCellValue({ sheet: tfSid, col: 6, row: 2 })) }
                } 
            });
        }
        return NextResponse.json({ sucesso: true });
    } catch(e: any) { return NextResponse.json({sucesso: false, error: e.message}); }
}

// --- ROTAS POST ---
export async function POST(request: Request, context: any) {
  try {
    const { hf, mainSheetId, sheetIdMap } = await getHyperFormulaInstance();
    const { searchParams } = new URL(request.url);
    const params = await context.params;
    let pathStr = params?.route ? params.route.join('/') : (searchParams.get('endpoint') || "");
    const body = await request.json();

    const write = (sheetId: number, col: string | number, row: number, val: any) => {
        const colIdx = typeof col === 'string' ? colToInt(col) : col;
        hf.setCellContents({ sheet: sheetId, col: colIdx, row: row - 1 }, [[val === "" || val === null ? null : val]]);
    };

    // --- 1. PERFORMANCE ---
    if (pathStr.includes('performance')) {
        if (body.pista) write(mainSheetId, 'R', 5, body.pista);
        write(mainSheetId, 'N', 6, Number(body.test_power) || 0);
        write(mainSheetId, 'N', 7, Number(body.test_handling) || 0);
        write(mainSheetId, 'N', 8, Number(body.test_accel) || 0);

        const driverValues = [
            [Number(body.concentracao)||0], [Number(body.talento)||0], [Number(body.agressividade)||0],
            [Number(body.experiencia)||0], [Number(body.tecnica)||0], [Number(body.resistencia)||0],
            [Number(body.carisma)||0], [Number(body.motivacao)||0], [Number(body.reputacao)||0], 
            [Number(body.peso)||0], [Number(body.idade)||0], [Number(body.energia)||100], 
        ];
        hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, driverValues);

        const carLevels = [
            [Number(body.chassi_lvl)||1], [Number(body.motor_lvl)||1], [Number(body.asaDianteira_lvl)||1], 
            [Number(body.asaTraseira_lvl)||1], [Number(body.assoalho_lvl)||1], [Number(body.laterais_lvl)||1],
            [Number(body.radiador_lvl)||1], [Number(body.cambio_lvl)||1], [Number(body.freios_lvl)||1],
            [Number(body.suspensao_lvl)||1], [Number(body.eletronicos_lvl)||1]
        ];
        const carWears = [
            [Number(body.chassi_wear)||0], [Number(body.motor_wear)||0], [Number(body.asaDianteira_wear)||0], 
            [Number(body.asaTraseira_wear)||0], [Number(body.assoalho_wear)||0], [Number(body.laterais_wear)||0],
            [Number(body.radiador_wear)||0], [Number(body.cambio_wear)||0], [Number(body.freios_wear)||0],
            [Number(body.suspensao_wear)||0], [Number(body.eletronicos_wear)||0]
        ];
        hf.setCellContents({ sheet: mainSheetId, col: 8, row: 5 }, carLevels);
        hf.setCellContents({ sheet: mainSheetId, col: 9, row: 5 }, carWears);

        const results: any = { power: {}, handling: {}, accel: {}, zs: {} };
        const keys: ('power' | 'handling' | 'accel')[] = ['power', 'handling', 'accel'];
        keys.forEach((key, i) => {
            const rowIdx = 5 + i;
            results[key].part = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: CELLS.OUTPUT_COL_PART, row: rowIdx })) || 0);
            results[key].test = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: CELLS.OUTPUT_COL_TEST, row: rowIdx })) || 0);
            results[key].carro = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: CELLS.OUTPUT_COL_CARRO, row: rowIdx })) || 0);
            results[key].pista = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: CELLS.OUTPUT_COL_PISTA, row: rowIdx })) || 0);
        });
        const zsRow = 23;
        results.zs.wings = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow })) || 0);
        results.zs.motor = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 1 })) || 0);
        results.zs.brakes = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 2 })) || 0);
        results.zs.gear = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 3 })) || 0);
        results.zs.susp = Math.round(Number(hf.getCellValue({ sheet: mainSheetId, col: 21, row: zsRow + 4 })) || 0);
        return NextResponse.json({ sucesso: true, data: results });
    }

    // --- 2. UPDATE SETUP WEATHER ---
    if (pathStr.includes('update_setup_weather')) {
        write(mainSheetId, 'R', 7, body.tempQ1); write(mainSheetId, 'R', 8, body.tempQ2); write(mainSheetId, 'R', 9, body.avgTemp);
        write(mainSheetId, 'T', 7, body.weatherQ1); write(mainSheetId, 'T', 8, body.weatherQ2); write(mainSheetId, 'T', 9, body.weatherRace);
        write(mainSheetId, 'S', 12, body.r1_temp_min); write(mainSheetId, 'T', 12, body.r1_temp_max);
        write(mainSheetId, 'S', 13, body.r2_temp_min); write(mainSheetId, 'T', 13, body.r2_temp_max);
        write(mainSheetId, 'S', 14, body.r3_temp_min); write(mainSheetId, 'T', 14, body.r3_temp_max);
        write(mainSheetId, 'S', 15, body.r4_temp_min); write(mainSheetId, 'T', 15, body.r4_temp_max);
        return NextResponse.json({ sucesso: true });
    }

    // --- 3. CALCULATE SETUP ---
    if (pathStr.includes('setup/calculate')) {
        if (body.pista) write(mainSheetId, 'R', 5, body.pista);
        write(mainSheetId, 'R', 7, body.tempQ1); write(mainSheetId, 'R', 8, body.tempQ2); write(mainSheetId, 'R', 9, body.avgTemp);
        write(mainSheetId, 'T', 7, body.weatherQ1); write(mainSheetId, 'T', 8, body.weatherQ2); write(mainSheetId, 'T', 9, body.weatherRace);
        
        const setupParts = ["asaDianteira", "asaTraseira", "motor", "freios", "cambio", "suspensao"];
        const wearResults: any[] = [];
        for (let r = 5; r <= 15; r++) {
            wearResults.push({
                start: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 9, row: r })),
                end: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 10, row: r }))
            });
        }
        const resultado: any = {};
        setupParts.forEach((p, i) => {
            const r = 5 + i;
            resultado[p] = {
                q1: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 28, row: r })),
                q2: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 29, row: r })),
                race: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 30, row: r }))
            };
        });
        resultado.chassi = { wear: wearResults[0] }; resultado.motor.wear = wearResults[1]; resultado.asaDianteira.wear = wearResults[2]; resultado.asaTraseira.wear = wearResults[3]; resultado.assoalho = { wear: wearResults[4] }; resultado.laterais = { wear: wearResults[5] }; resultado.radiador = { wear: wearResults[6] }; resultado.cambio.wear = wearResults[7]; resultado.freios.wear = wearResults[8]; resultado.suspensao.wear = wearResults[9]; resultado.eletronicos = { wear: wearResults[10] };
        return NextResponse.json({ sucesso: true, data: resultado });
    }

    // --- 4. STRATEGY CALCULATE ---
    if (pathStr.includes('strategy/calculate')) {
        const tfSid = sheetIdMap['Tyre&Fuel'];

        // --- NORMALIZAÇÃO PISTA ---
        if (body.pista && body.pista !== "Selecionar Pista") {
            const tracksSid = sheetIdMap['Tracks'];
            let finalTrack = body.pista;
            if (tracksSid !== undefined) {
                for (let r = 4; r <= 1000; r++) {
                    const val = hf.getCellValue({ sheet: tracksSid, col: 0, row: r - 1 });
                    if (val && val.toString().toLowerCase().trim() === body.pista.toLowerCase().trim()) {
                        finalTrack = val;
                        console.log(`[API] Pista OK: ${finalTrack}`);
                        break;
                    }
                }
            }
            write(mainSheetId, 'R', 5, finalTrack);
        }

        // --- NORMALIZAÇÃO FORNECEDOR ---
        const ro = body.race_options || {};
        let finalSupplier = ro.pneus_fornecedor;
        const tyresSid = sheetIdMap['Tyres'];
        if (tyresSid !== undefined && finalSupplier) {
             for (let r = 2; r <= 15; r++) {
                const name = hf.getCellValue({ sheet: tyresSid, col: 0, row: r - 1 });
                if (name && name.toString().toLowerCase().trim() === finalSupplier.toString().toLowerCase().trim()) {
                    finalSupplier = name; 
                    console.log(`[API] Fornecedor OK: ${finalSupplier}`);
                    break;
                }
            }
        }
        
        // --- ESCRITA ---
        if (ro.avg_temp !== undefined) write(mainSheetId, 'R', 9, Number(ro.avg_temp));
        if (body.driver) {
            const dVals = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].map(k => [Number(body.driver[k]) || 0]);
            hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, dVals);
        }
        if (body.car) {
            const carLevels = body.car.map((c: any) => [Number(c.lvl) || 1]);
            const carWears = body.car.map((c: any) => [Number(c.wear) || 0]);
            hf.setCellContents({ sheet: mainSheetId, col: 8, row: 5 }, carLevels);
            hf.setCellContents({ sheet: mainSheetId, col: 9, row: 5 }, carWears);
        }

        write(tfSid, 'C', 5, finalSupplier);
        write(tfSid, 'G', 3, Number(ro.desgaste_pneu_percent) || 0);
        write(tfSid, 'C', 3, ro.condicao); write(tfSid, 'C', 4, Number(ro.ct_valor) || 0);
        write(tfSid, 'C', 6, ro.tipo_pneu); write(tfSid, 'C', 7, Number(ro.pitstops_num) || 0);

        const ps = body.personal_stint_voltas || {};
        for (let i = 1; i <= 8; i++) write(tfSid, String.fromCharCode(70 + i), 21, ps[`stint${i}`] ? Number(ps[`stint${i}`]) : null);
        const bl = body.boost_laps || {};
        write(tfSid, 'R', 20, bl.boost1?.volta); write(tfSid, 'R', 21, bl.boost2?.volta); write(tfSid, 'R', 22, bl.boost3?.volta);

        // --- OUTPUTS ---
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
                stint: safeVal(hf.getCellValue({ sheet: tfSid, col: 18, row: 19 + i })),
                voltas_list: safeVal(hf.getCellValue({ sheet: tfSid, col: 19, row: 19 + i })),
            };
        }
        for(let i=1; i<=8; i++) {
            output.boost_mini_stints_outputs[`stint${i}`] = {
                val1: safeVal(hf.getCellValue({ sheet: tfSid, col: 17 + i - 1, row: 24 })),
                val2: safeVal(hf.getCellValue({ sheet: tfSid, col: 17 + i - 1, row: 23 }))
            };
        }
        return NextResponse.json({ sucesso: true, data: output });
    }

    // --- 5. UPDATE DRIVER CAR (MANTIDO) ---
    if (pathStr.includes('update_driver_car')) {
        if(body.driver) {
            const dVals = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].map(k => [Number(body.driver[k]) || 0]);
            hf.setCellContents({ sheet: mainSheetId, col: 4, row: 5 }, dVals);
        }
        if(body.car) {
            const carLvl = body.car.map((c: any) => [Number(c.lvl) || 1]);
            const carWear = body.car.map((c: any) => [Number(c.wear) || 0]);
            hf.setCellContents({ sheet: mainSheetId, col: 8, row: 5 }, carLvl);
            hf.setCellContents({ sheet: mainSheetId, col: 9, row: 5 }, carWear);
        }
        if(body.test_points) {
            write(mainSheetId, 'N', 6, Number(body.test_points.power)); write(mainSheetId, 'N', 7, Number(body.test_points.handling)); write(mainSheetId, 'N', 8, Number(body.test_points.accel));
        }
        return NextResponse.json({ sucesso: true, oa: safeVal(hf.getCellValue({ sheet: mainSheetId, col: 4, row: 4 })) });
    }

    return NextResponse.json({ sucesso: false, message: "Endpoint não encontrado" }, { status: 404 });

  } catch (error: any) {
    console.error("ERRO CRÍTICO NO POST:", error);
    return NextResponse.json({ sucesso: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}