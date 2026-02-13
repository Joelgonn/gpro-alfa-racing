import { NextResponse } from 'next/server';
import path from 'path';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';
import { Mutex } from 'async-mutex';

// --- CONFIGURAÇÃO DE COORDENADAS (Espelho da API Global) ---
const CELLS = {
    MAIN_SHEET: 'Setup&WS',
    INPUT_TRACK: 'R5', 
    INPUT_DRIVER_COL: 4, INPUT_DRIVER_START_ROW: 6, 
    INPUT_CAR_LVL_COL: 8, START_ROW_CAR: 6,      
    INPUT_CAR_WEAR_COL: 9, 

    // Temperaturas e Clima (Vamos usar R9 e T9 para simular o teste)
    INPUT_TEMP_RACE_AVG: 'R9', 
    INPUT_WEATHER_RACE: 'T9',

    // Modificador
    INPUT_RISK_MODIFIER_SHEET: 'Tyre&Fuel', 
    INPUT_RISK_MODIFIER_COL: 2, // C
    INPUT_RISK_MODIFIER_ROW: 4, // 4

    // Saída Setup (Corrida/Teste é a coluna AE -> Índice 30)
    OUTPUT_START_ROW: 6,
    OUTPUT_COL_RACE: 30, 
};

// --- SINGLETONS & MUTEX (Copiado da API Global para consistência) ---
let hfInstance: HyperFormula | null = null;
let sheetIdMap: Record<string, number> = {}; 
let loadingPromise: Promise<any> | null = null;
const calculationMutex = new Mutex(); 

// --- HELPERS ---
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
    // Arredonda para evitar dizimas infinitas
    if (typeof val === 'number') return Math.round(val * 10000) / 10000;
    return val;
};

// --- CARREGAMENTO DO EXCEL (A versão blindada da sua API Global) ---
async function getHyperFormulaInstance() {
  if (hfInstance && sheetIdMap[CELLS.MAIN_SHEET] !== undefined) {
    return { hf: hfInstance, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
  }
  
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
      console.log("Iniciando carregamento do Excel (API Testes)...");
      const workbook = new ExcelJS.Workbook();
      const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
      await workbook.xlsx.readFile(filePath);

      const sheetsContent: Record<string, any[][]> = {};

      workbook.eachSheet((worksheet) => {
        const sheetData: any[][] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          // AQUI ESTÁ A MÁGICA DA LIMPEZA QUE EVITA O #REF!
          const cleanValues = (row.values as any[]).map(cell => {
            if (cell === null || cell === undefined) return null;
            if (typeof cell !== 'object') return cell;
            
            let val = null;
            if (cell.formula) val = '=' + cell.formula;
            else if (cell.sharedFormula) val = cell.result !== undefined ? cell.result : 0;
            else if (cell.result !== undefined) {
                // Se o resultado for um erro #REF!, retorna 0 ou null
                if (typeof cell.result === 'object' && (cell.result as any).error) return 0;
                val = cell.result;
            }
            else if (cell.text) val = cell.text;
            
            // Segurança extra para objetos de erro
            if (val && typeof val === 'object') return 0;
            return val !== undefined ? val : '';
          });
          sheetData.push(cleanValues.slice(1)); 
        });
        
        // Fix Shared Formulas (Mantido da original)
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

      console.log("Construindo HyperFormula (API Testes)...");
      const hf = HyperFormula.buildFromSheets(sheetsContent, { licenseKey: 'gpl-v3', useColumnIndex: false });
      
      const ids: Record<string, number> = {};
      const loadedSheets = hf.getSheetNames();
      loadedSheets.forEach(name => ids[name] = hf.getSheetId(name)!);
      sheetIdMap = ids;

      // Registro de nomes definidos e expressões (Mantido da original)
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

      hfInstance = hf;
      return { hf, mainSheetId: sheetIdMap[CELLS.MAIN_SHEET], sheetIdMap };
  })();

  return loadingPromise;
}

// Ordem das peças esperada pela planilha (para mapear o objeto car do frontend)
const CAR_PARTS_ORDER = [
    'chassi', 'motor', 'asaDianteira', 'asaTraseira', 
    'assoalho', 'laterais', 'radiador', 'cambio', 
    'freios', 'suspensao', 'eletronicos'
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
        track, testInputs, driver, car, 
        techDirector, staffFacilities, // Recebemos mas não usamos diretamente nas células mapeadas ainda, exceto se adicionar mapeamento
        desgasteModifier 
    } = body;

    // Obtém a instância (pode esperar se estiver carregando)
    const { hf, mainSheetId, sheetIdMap } = await getHyperFormulaInstance();
    const sheetId = mainSheetId;

    // Executa dentro do Mutex para garantir que ninguém mexa na planilha enquanto simulamos
    return await calculationMutex.runExclusive(async () => {
        
        // Helper de escrita
        const write = (sId: number, col: number | string, row: number, val: any) => {
            // Conversão simples de coluna Letra -> Número se necessário, mas aqui usaremos índices diretos ou helper do HF
            // Se for string 'R', o HF entende se usarmos simpleCellAddress
            // Para consistência com a API global, vamos usar setCellContents com coordenadas
            let colIdx = typeof col === 'number' ? col : 0;
            if (typeof col === 'string') {
                // Helper rápido letra -> index (A=0)
                let c = 0;
                for (let i = 0; i < col.length; i++) c = c * 26 + col.toUpperCase().charCodeAt(i) - 64;
                colIdx = c - 1;
            }
            hf.setCellContents({ sheet: sId, col: colIdx, row: row - 1 }, [[val === "" || val === null ? null : val]]);
        };

        // 1. INJEÇÃO DOS DADOS DO TESTE (OVERRIDE)
        
        // Pista
        if (track) write(sheetId, 'R', 5, track);

        // Piloto
        if (driver) {
            const d = driver;
            const driverKeys = ["concentracao", "talento", "agressividade", "experiencia", "tecnica", "resistencia", "carisma", "motivacao", "reputacao", "peso", "idade", "energia"];
            const dVals = driverKeys.map(k => [Number(d[k]) || 0]);
            hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_DRIVER_COL, row: CELLS.INPUT_DRIVER_START_ROW - 1 }, dVals);
        }

        // Carro (Níveis e Desgastes Editados)
        if (car) {
            const carLvl: any[][] = [];
            const carWear: any[][] = [];
            CAR_PARTS_ORDER.forEach(partId => {
                // O frontend envia car como objeto { chassi: {level, wear}, ... }
                // Precisamos ser resilientes a maiusculas/minusculas se necessario, mas assumimos que o frontend ja mandou certo
                // Para garantir, vamos tentar achar a chave ignorando case
                const key = Object.keys(car).find(k => k.toLowerCase() === partId.toLowerCase()) || partId;
                const partData = car[key] || { level: 1, wear: 0 };
                
                carLvl.push([Number(partData.level) || 1]);
                carWear.push([Number(partData.wear) || 0]);
            });
            hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_CAR_LVL_COL, row: CELLS.START_ROW_CAR - 1 }, carLvl);
            hf.setCellContents({ sheet: sheetId, col: CELLS.INPUT_CAR_WEAR_COL, row: CELLS.START_ROW_CAR - 1 }, carWear);
        }

        // --- O PULO DO GATO: TEMPERATURA E CLIMA DO TESTE ---
        // Aqui pegamos o input da tela de teste e escrevemos na célula de "Média da Corrida" (R9)
        // Isso força a coluna AE (Race Setup) a calcular para essa temperatura.
        const testTemp = Number(testInputs.avg_temp);
        write(sheetId, 'R', 9, testTemp);

        // Mesma coisa para o clima (T9)
        const testWeather = testInputs.condicao; // "Dry" ou "Wet"
        write(sheetId, 'T', 9, testWeather);

        // Modificador de Desgaste
        const tfSid = sheetIdMap[CELLS.INPUT_RISK_MODIFIER_SHEET];
        if (tfSid !== undefined && desgasteModifier !== undefined) {
            write(tfSid, CELLS.INPUT_RISK_MODIFIER_COL, CELLS.INPUT_RISK_MODIFIER_ROW, Number(desgasteModifier) || 0);
        }

        // 2. LEITURA DOS RESULTADOS (SETUP IDEAL)
        // Lemos a coluna AE (Setup de Corrida) que agora reflete o teste
        const setupParts = ["asaDianteira", "asaTraseira", "motor", "freios", "cambio", "suspensao"];
        const setupIdeal: any = {};
        
        setupParts.forEach((p, i) => {
            const r = CELLS.OUTPUT_START_ROW - 1 + i; // Linha 6 (0-based 5) + offset
            const valRace = hf.getCellValue({ sheet: sheetId, col: CELLS.OUTPUT_COL_RACE, row: r });
            // Se for número, arredonda e converte pra string. Se for erro ou objeto, retorna "-"
            setupIdeal[p] = (typeof valRace === 'number') ? Math.round(valRace).toString() : safeVal(valRace);
        });

        // 3. CÁLCULO DO STINT (Híbrido)
        // Como a planilha não tem uma célula específica para "Voltas de Teste", usamos a lógica JS
        // baseada nos parâmetros, MAS usando a mesma "engine" de inputs.
        
        let simulatedWear = 0;
        let simulatedFuel = 0;
        const laps = Number(testInputs.voltas);

        if (laps > 0) {
            let wearRate = 0.8; 
            let fuelRate = 0.85; 

            if (testInputs.condicao === 'Wet') { wearRate *= 1.1; fuelRate *= 1.15; }
            if (testInputs.testPriority === "Testar os limites do carro") { wearRate *= 1.2; }
            
            // Fator Temperatura (Simples)
            wearRate += (testTemp - 25) * 0.01;
            // Fator Modificador
            wearRate += (Number(desgasteModifier) * 0.05);

            const totalWear = wearRate * laps;
            simulatedWear = Math.max(0, 100 - totalWear);
            simulatedFuel = Math.ceil(fuelRate * laps);
        }

        const stint1 = {
            voltas: laps,
            desgaste_final_pneu: simulatedWear.toFixed(1),
            comb_necessario: simulatedFuel.toString(),
            tipo_pneu: testInputs.tipo_pneu,
        };

        return NextResponse.json({
            sucesso: true,
            data: {
                setupIdeal,
                stint1
            }
        });
    });

  } catch (error: any) {
    console.error("ERRO CRÍTICO NO API TESTES:", error);
    return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  }
}