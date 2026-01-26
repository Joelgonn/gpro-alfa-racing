import { NextResponse } from 'next/server';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';

// --- CONFIGURAÇÃO GLOBAL ---
let hfInstance: HyperFormula | null = null;
let sheetIdMap: Record<string, number> = {};
let loadingPromise: Promise<any> | null = null;

// --- MAPA DE CÉLULAS ---
const CELLS = {
    MAIN_SHEET: 'Setup&WS',
    // Output Performance
    OUTPUT_COL_PART: 12,  // M
    OUTPUT_COL_TEST: 13,  // N
    OUTPUT_COL_CARRO: 14, // O
    OUTPUT_COL_PISTA: 15, // P
    OUTPUT_ZS_COL: 21,    // V
    OUTPUT_ZS_START_ROW: 23, // V24

    // Setup Outputs (AC, AD, AE)
    SETUP_Q1_COL: 28, // AC
    SETUP_Q2_COL: 29, // AD
    SETUP_RACE_COL: 30, // AE
    SETUP_START_ROW: 5, // Linha 6 (index 5)
    
    // Wear Outputs (J, K)
    WEAR_START_COL: 9, // J
    WEAR_END_COL: 10,  // K
};

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
    if (typeof val === 'object' && val?.error) return null; // Retorna null se for erro de fórmula
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

// --- MOTOR DE EXCEL (ENGINE) ---
async function getEngine() {
    if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined) {
        return { hf: hfInstance, sheetIdMap };
    }
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
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
                        else if (cell.richText) val = cell.richText.map((t: any) => t.text).join('');
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
                            const currentValue = sheetData[rowIndex]?.[colIndex];
                            if (currentValue && (typeof currentValue !== 'string' || !currentValue.startsWith('='))) {
                                if ((cell as any).master && (cell as any).master.formula) {
                                    sheetData[rowIndex][colIndex] = '=' + (cell as any).master.formula;
                                }
                            }
                        }
                    });
                });
                sheetsContent[worksheet.name] = sheetData;
            });

            console.log("Construindo HyperFormula...");
            const hf = HyperFormula.buildFromSheets(sheetsContent, { licenseKey: 'gpl-v3' });
            hf.getSheetNames().forEach(name => { sheetIdMap[name] = hf.getSheetId(name)!; });
            
            // --- CORREÇÃO DO NAMED RANGE (SEM A FUNÇÃO isNamedExpression QUE CAUSA ERRO) ---
            try {
                // Apenas adicionamos. Se já existir internamente (raro no init), ele sobrescreve ou ignora.
                // Isso conecta a referência "tyrediff" usada nas fórmulas ao intervalo na aba Tables
                hf.addNamedExpression('tyrediff', '=Tables!$A$60:$D$69');
                console.log("Named Range 'tyrediff' registrado com sucesso.");
            } catch (err) {
                console.error("Aviso: Falha ao registrar tyrediff (não crítico se já existir)", err);
            }

            hfInstance = hf;
            console.log("Engine Pronto.");
            return { hf, sheetIdMap };
        } catch (e) {
            console.error("Erro fatal engine:", e);
            loadingPromise = null;
            throw e;
        }
    })();
    return loadingPromise;
}

// --- ROTAS GET ---
export async function GET(request: Request, context: any) {
    try {
        const { hf, sheetIdMap } = await getEngine();
        const { searchParams } = new URL(request.url);
        const params = await context.params; 
        
        let pathStr = "";
        if (params?.route) pathStr = params.route.join('/');
        else if (searchParams.get('action')) pathStr = searchParams.get('action') || "";

        if (pathStr.includes('tracks')) {
             const tracks = [];
             const tracksSid = sheetIdMap['Tracks'];
             for (let r = 4; r <= 67; r++) {
                 const val = hf.getCellValue(getCellAddr(tracksSid, 'A', r));
                 if (val) tracks.push(val);
             }
             return NextResponse.json({ sucesso: true, tracks });
        }

        if (pathStr.includes('state')) {
            const setupSid = sheetIdMap['Setup&WS'];
            const tfSid = sheetIdMap['Tyre&Fuel']; 
            
            const driverData: any = {};
            ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"].forEach((k, i) => {
                driverData[k] = safeVal(hf.getCellValue(getCellAddr(setupSid, 'E', 6 + i)));
            });
            driverData.total = safeVal(hf.getCellValue(getCellAddr(setupSid, 'E', 5)));
            
            const carData = [];
            for(let i=0; i<11; i++) {
                carData.push({
                    lvl: safeVal(hf.getCellValue(getCellAddr(setupSid, 'I', 6 + i))),
                    wear: safeVal(hf.getCellValue(getCellAddr(setupSid, 'J', 6 + i)))
                });
            }

            const weatherData = {
                tempQ1: safeVal(hf.getCellValue(getCellAddr(setupSid, 'R', 7))),
                tempQ2: safeVal(hf.getCellValue(getCellAddr(setupSid, 'R', 8))),
                weatherQ1: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 7))),
                weatherQ2: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 8))),
                weatherRace: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 9))),
                r1_temp_min: safeVal(hf.getCellValue(getCellAddr(setupSid, 'S', 12))),
                r1_temp_max: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 12))),
                r2_temp_min: safeVal(hf.getCellValue(getCellAddr(setupSid, 'S', 13))),
                r2_temp_max: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 13))),
                r3_temp_min: safeVal(hf.getCellValue(getCellAddr(setupSid, 'S', 14))),
                r3_temp_max: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 14))),
                r4_temp_min: safeVal(hf.getCellValue(getCellAddr(setupSid, 'S', 15))),
                r4_temp_max: safeVal(hf.getCellValue(getCellAddr(setupSid, 'T', 15))),
            };

            const raceOptions = {
                 avg_temp: safeVal(hf.getCellValue(getCellAddr(setupSid, 'R', 9))),
                 desgaste_pneu_percent: safeVal(hf.getCellValue(getCellAddr(tfSid, 'G', 3))),
                 condicao: safeVal(hf.getCellValue(getCellAddr(tfSid, 'C', 3))),
                 ct_valor: safeVal(hf.getCellValue(getCellAddr(tfSid, 'C', 4))),
                 pneus_fornecedor: safeVal(hf.getCellValue(getCellAddr(tfSid, 'C', 5))),
                 tipo_pneu: safeVal(hf.getCellValue(getCellAddr(tfSid, 'C', 6))),
                 pitstops_num: safeVal(hf.getCellValue(getCellAddr(tfSid, 'C', 7))),
            };

            return NextResponse.json({ 
                sucesso: true, 
                data: { 
                    current_track: safeVal(hf.getCellValue(getCellAddr(setupSid, 'R', 5))), 
                    driver: driverData, 
                    car: carData, 
                    weather: weatherData,
                    race_options: raceOptions
                } 
            });
        }
        return NextResponse.json({ sucesso: true });
    } catch(e: any) {
        return NextResponse.json({sucesso: false, error: e.message}, {status: 500});
    }
}

// --- ROTAS POST ---
export async function POST(request: Request, context: any) {
    try {
        const { hf, sheetIdMap } = await getEngine();
        const { searchParams } = new URL(request.url);
        const params = await context.params;
        
        let pathStr = "";
        if (params?.route) pathStr = params.route.join('/');
        else if (searchParams.get('endpoint')) pathStr = searchParams.get('endpoint') || "";

        const body = await request.json();
        const setupSid = sheetIdMap[CELLS.MAIN_SHEET];

        const write = (sheetId: number, col: string, row: number, val: any) => {
             const finalVal = (val === "" || val === null) ? null : val;
             hf.setCellContents(getCellAddr(sheetId, col, row), [[finalVal]]);
        };

        // --- 1. PERFORMANCE ---
        if (pathStr.includes('performance')) {
            if (body.pista) write(setupSid, 'R', 5, body.pista);
            write(setupSid, 'N', 6, Number(body.test_power) || 0);
            write(setupSid, 'N', 7, Number(body.test_handling) || 0);
            write(setupSid, 'N', 8, Number(body.test_accel) || 0);

            const driverValues = [
                [Number(body.concentracao)||0], [Number(body.talento)||0], [Number(body.agressividade)||0],
                [Number(body.experiencia)||0], [Number(body.tecnica)||0], [Number(body.resistencia)||0],
                [Number(body.carisma)||0], [Number(body.motivacao)||0], [Number(body.reputacao)||0], 
                [Number(body.peso)||0], [Number(body.idade)||0], [Number(body.energia)||100], 
            ];
            hf.setCellContents({ sheet: setupSid, col: 4, row: 5 }, driverValues);

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
            hf.setCellContents({ sheet: setupSid, col: 8, row: 5 }, carLevels);
            hf.setCellContents({ sheet: setupSid, col: 9, row: 5 }, carWears);

            const performanceResults = {
                power: { part: 0, test: 0, carro: 0, pista: 0 },
                handling: { part: 0, test: 0, carro: 0, pista: 0 },
                accel: { part: 0, test: 0, carro: 0, pista: 0 },
                zs: { wings: 0, motor: 0, brakes: 0, gear: 0, susp: 0 }
            };

            const rows = [5, 6, 7]; 
            const keys: ('power' | 'handling' | 'accel')[] = ['power', 'handling', 'accel'];
            rows.forEach((rowIdx, index) => {
                const key = keys[index];
                performanceResults[key].part   = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: CELLS.OUTPUT_COL_PART, row: rowIdx })) || 0);
                performanceResults[key].test   = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: CELLS.OUTPUT_COL_TEST, row: rowIdx })) || 0);
                performanceResults[key].carro  = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: CELLS.OUTPUT_COL_CARRO, row: rowIdx })) || 0);
                performanceResults[key].pista  = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: CELLS.OUTPUT_COL_PISTA, row: rowIdx })) || 0);
            });

            const startRow = CELLS.OUTPUT_ZS_START_ROW;
            const colZS = CELLS.OUTPUT_ZS_COL;
            performanceResults.zs.wings  = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: colZS, row: startRow })) || 0);
            performanceResults.zs.motor  = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: colZS, row: startRow + 1 })) || 0);
            performanceResults.zs.brakes = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: colZS, row: startRow + 2 })) || 0);
            performanceResults.zs.gear   = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: colZS, row: startRow + 3 })) || 0);
            performanceResults.zs.susp   = Math.round(Number(hf.getCellValue({ sheet: setupSid, col: colZS, row: startRow + 4 })) || 0);

            return NextResponse.json({ sucesso: true, data: performanceResults });
        }

        // --- 2. UPDATE SETUP WEATHER ---
        if (pathStr.includes('update_setup_weather')) {
            write(setupSid, 'R', 7, body.tempQ1);
            write(setupSid, 'R', 8, body.tempQ2);
            write(setupSid, 'R', 9, body.avgTemp);
            write(setupSid, 'T', 7, body.weatherQ1);
            write(setupSid, 'T', 8, body.weatherQ2);
            write(setupSid, 'T', 9, body.weatherRace);
            
            write(setupSid, 'S', 12, body.r1_temp_min); write(setupSid, 'T', 12, body.r1_temp_max);
            write(setupSid, 'S', 13, body.r2_temp_min); write(setupSid, 'T', 13, body.r2_temp_max);
            write(setupSid, 'S', 14, body.r3_temp_min); write(setupSid, 'T', 14, body.r3_temp_max);
            write(setupSid, 'S', 15, body.r4_temp_min); write(setupSid, 'T', 15, body.r4_temp_max);

            return NextResponse.json({ sucesso: true });
        }

        // --- 3. CALCULATE SETUP ---
        if (pathStr.includes('setup/calculate')) {
            if (body.pista && body.pista !== "Selecionar Pista") write(setupSid, 'R', 5, body.pista);
            
            // Clima
            write(setupSid, 'R', 7, body.tempQ1);
            write(setupSid, 'R', 8, body.tempQ2);
            write(setupSid, 'R', 9, body.avgTemp);
            write(setupSid, 'T', 7, body.weatherQ1);
            write(setupSid, 'T', 8, body.weatherQ2);
            write(setupSid, 'T', 9, body.weatherRace);

            const setupParts = ["asaDianteira", "asaTraseira", "motor", "freios", "cambio", "suspensao"];
            const wearResults: any[] = [];
            for (let r = 5; r <= 15; r++) {
                 wearResults.push({
                     start: safeVal(hf.getCellValue({ sheet: setupSid, col: CELLS.WEAR_START_COL, row: r })),
                     end: safeVal(hf.getCellValue({ sheet: setupSid, col: CELLS.WEAR_END_COL, row: r }))
                 });
            }

            const resultado: any = {};
            setupParts.forEach((part, idx) => {
                const row = CELLS.SETUP_START_ROW + idx;
                resultado[part] = {
                    q1: safeVal(hf.getCellValue({ sheet: setupSid, col: CELLS.SETUP_Q1_COL, row })),
                    q2: safeVal(hf.getCellValue({ sheet: setupSid, col: CELLS.SETUP_Q2_COL, row })),
                    race: safeVal(hf.getCellValue({ sheet: setupSid, col: CELLS.SETUP_RACE_COL, row }))
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

        // --- 4. STRATEGY CALCULATE ---
        if (pathStr.includes('strategy/calculate')) {
            const tfSid = sheetIdMap['Tyre&Fuel']; 
            
            // A. INPUTS GERAIS
            if (body.pista && body.pista !== "Selecionar Pista") {
                write(setupSid, 'R', 5, body.pista);
            }
            
            const ro = body.race_options || {};
            
            // Opções
            write(tfSid, 'G', 3, Number(ro.desgaste_pneu_percent) || 0);
            write(tfSid, 'C', 3, ro.condicao);
            write(tfSid, 'C', 4, Number(ro.ct_valor) || 0);
            write(tfSid, 'C', 5, ro.pneus_fornecedor); 
            write(tfSid, 'C', 6, ro.tipo_pneu);
            write(tfSid, 'C', 7, Number(ro.pitstops_num) || 0);
            
            // Temperatura
            if(ro.avg_temp !== undefined && ro.avg_temp !== null && ro.avg_temp !== "") {
                write(setupSid, 'R', 9, Number(ro.avg_temp));
            }

            // B. PILOTO E CARRO
            if(body.driver) {
                const dFields = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"];
                const dVals = dFields.map(k => [Number(body.driver[k]) || 0]);
                hf.setCellContents({ sheet: setupSid, col: 4, row: 5 }, dVals);
            }
            if(body.car) {
                const cLvl = body.car.map((c: any) => [Number(c.lvl)||1]);
                const cWear = body.car.map((c: any) => [Number(c.wear)||0]);
                hf.setCellContents({ sheet: setupSid, col: 8, row: 5 }, cLvl);
                hf.setCellContents({ sheet: setupSid, col: 9, row: 5 }, cWear);
            }

            // C. STINTS
            const ps = body.personal_stint_voltas || {};
            for (let i = 1; i <= 8; i++) {
                const colChar = String.fromCharCode(70 + i); 
                const rawVal = ps[`stint${i}`];
                const finalVal = (rawVal === "" || rawVal === null) ? null : Number(rawVal);
                write(tfSid, colChar, 21, finalVal);
            }

            const bl = body.boost_laps || {};
            write(tfSid, 'R', 20, bl.boost1?.volta ? Number(bl.boost1.volta) : null);
            write(tfSid, 'R', 21, bl.boost2?.volta ? Number(bl.boost2.volta) : null);
            write(tfSid, 'R', 22, bl.boost3?.volta ? Number(bl.boost3.volta) : null);

            // D. OUTPUTS
            const output: any = {
                race_calculated_data: {
                    nivel_aderencia: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 24))),
                    consumo_combustivel: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 22))),
                    desgaste_pneu_str: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 23))),
                    ultrapassagem: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 17))),
                    voltas: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 18))),
                    pit_io: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 19))),
                    tcd_corrida: safeVal(hf.getCellValue(getCellAddr(tfSid, 'D', 21))), 
                },
                compound_details_outputs: {},
                stints_predefined: {},
                stints_personal: {},
                boost_laps_outputs: {},
                boost_mini_stints_outputs: {}
            };

            const rowsComp: Record<string, number> = { "Extra Soft": 6, "Soft": 7, "Medium": 8, "Hard": 9 };
            Object.entries(rowsComp).forEach(([comp, row]) => {
                output.compound_details_outputs[comp] = {
                    req_stops: safeVal(hf.getCellValue(getCellAddr(tfSid, 'G', row))),
                    fuel_load: safeVal(hf.getCellValue(getCellAddr(tfSid, 'K', row))),
                    tyre_wear: safeVal(hf.getCellValue(getCellAddr(tfSid, 'N', row))),
                    total: safeVal(hf.getCellValue(getCellAddr(tfSid, 'O', row)))
                };
            });

            const stintConfigs = [
                { key: "stints_predefined", rowStart: 14 },
                { key: "stints_personal", rowStart: 21 }
            ];

            stintConfigs.forEach(conf => {
                const baseRow = conf.rowStart;
                const rowsData = [
                    { key: "voltas", offset: 0 },
                    { key: "desg_final_pneu", offset: 1 },
                    { key: "comb_necessario", offset: 2 },
                    { key: "est_tempo_pit", offset: 3 },
                    { key: "voltas_em_bad", offset: 4 }
                ];
                rowsData.forEach(rd => {
                    const currentRow = baseRow + rd.offset;
                    const rowObj: any = {};
                    for(let j=1; j<=8; j++) {
                        const colChar = String.fromCharCode(70 + j); 
                        rowObj[`stint${j}`] = safeVal(hf.getCellValue(getCellAddr(tfSid, colChar, currentRow)));
                    }
                    rowObj["total"] = safeVal(hf.getCellValue(getCellAddr(tfSid, 'O', currentRow)));
                    if (!output[conf.key]) output[conf.key] = {};
                    output[conf.key][rd.key] = rowObj;
                });
            });

            for(let i=1; i<=3; i++) {
                const r = 19 + i;
                output.boost_laps_outputs[`boost${i}`] = {
                    stint: safeVal(hf.getCellValue(getCellAddr(tfSid, 'S', r))),
                    voltas_list: safeVal(hf.getCellValue(getCellAddr(tfSid, 'T', r))),
                };
            }

            for(let i=1; i<=8; i++) {
                const colChar = String.fromCharCode(82 + i - 1);
                output.boost_mini_stints_outputs[`stint${i}`] = {
                    val1: safeVal(hf.getCellValue(getCellAddr(tfSid, colChar, 25))),
                    val2: safeVal(hf.getCellValue(getCellAddr(tfSid, colChar, 24)))
                };
            }

            return NextResponse.json({ sucesso: true, data: output });
        }

        // --- 5. UPDATE DRIVER CAR ---
        if (pathStr.includes('update_driver_car')) {
            if(body.driver) {
                const dFields = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"];
                const dVals = dFields.map(k => [Number(body.driver[k]) || 0]);
                hf.setCellContents({ sheet: setupSid, col: 4, row: 5 }, dVals);
            }
            if(body.car) {
                const cLvl = body.car.map((c: any) => [Number(c.lvl)||1]);
                const cWear = body.car.map((c: any) => [Number(c.wear)||0]);
                hf.setCellContents({ sheet: setupSid, col: 8, row: 5 }, cLvl);
                hf.setCellContents({ sheet: setupSid, col: 9, row: 5 }, cWear);
            }
            if(body.test_points) {
                write(setupSid, 'N', 6, Number(body.test_points.power));
                write(setupSid, 'N', 7, Number(body.test_points.handling));
                write(setupSid, 'N', 8, Number(body.test_points.accel));
            }
            const oa = safeVal(hf.getCellValue(getCellAddr(setupSid, 'E', 5)));
            return NextResponse.json({ sucesso: true, oa });
        }
        
        return NextResponse.json({ sucesso: false, message: "Endpoint não encontrado" }, { status: 404 });

    } catch (error: any) {
        console.error("Erro API POST:", error);
        return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
    }
}