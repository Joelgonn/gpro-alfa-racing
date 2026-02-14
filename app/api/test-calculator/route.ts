import { NextResponse } from 'next/server';
import { HyperFormula } from 'hyperformula';
import ExcelJS from 'exceljs';
import path from 'path';

let hfInstance: HyperFormula | null = null;
let sheetIds: Record<string, number> = {};
let isLoading = false;

async function getEngine() {
    if (hfInstance) return { hf: hfInstance, sheetIds };
    if (isLoading) {
        while (isLoading) { await new Promise(res => setTimeout(res, 100)); }
        return { hf: hfInstance!, sheetIds };
    }
    isLoading = true;
    const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
    const workbook = new ExcelJS.Workbook();
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
    hfInstance = HyperFormula.buildFromSheets(sheetsContent, { licenseKey: 'gpl-v3' });
    hfInstance.getSheetNames().forEach(name => { sheetIds[name] = hfInstance!.getSheetId(name)!; });
    isLoading = false;
    return { hf: hfInstance, sheetIds };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { track, driver, car, weather, temp, risk, tyreSupplier, compound, pits, stints, priority } = body;
        const { hf, sheetIds } = await getEngine();
        const setupSheetId = sheetIds['Setup&WS'];
        const tyreSheetId = sheetIds['Tyre&Fuel'];

        // --- SEQUÊNCIA DE INJEÇÃO (RIGOROSA) ---
        
        // 1. Âncoras e Clima (Injeção em ambas as abas para cálculo de Pneu e Setup)
        if (track) hf.setCellContents({ sheet: setupSheetId, row: 4, col: 17 }, [[track]]); // R5
        
        if (weather) {
            hf.setCellContents({ sheet: tyreSheetId, row: 2, col: 2 }, [[weather]]);   // C3 em Tyre&Fuel
            hf.setCellContents({ sheet: setupSheetId, row: 8, col: 19 }, [[weather]]); // T9 em Setup&WS (Crítico para AE6:AE11)
        }
        
        // 2. Parâmetros de Ambiente
        if (temp) hf.setCellContents({ sheet: setupSheetId, row: 8, col: 17 }, [[temp]]); // R9
        if (risk) hf.setCellContents({ sheet: tyreSheetId, row: 3, col: 2 }, [[Number(risk)]]); // C4
        if (tyreSupplier) hf.setCellContents({ sheet: tyreSheetId, row: 4, col: 2 }, [[tyreSupplier]]); // C5
        if (compound) hf.setCellContents({ sheet: tyreSheetId, row: 5, col: 2 }, [[compound]]); // C6
        if (pits) hf.setCellContents({ sheet: tyreSheetId, row: 6, col: 2 }, [[pits]]); // C7
        if (priority) hf.setCellContents({ sheet: tyreSheetId, row: 7, col: 2 }, [[priority]]); // C8

        // 3. Piloto (E6:E17 -> Row 5-16, Col 4)
        const driverFields = ['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao', 'peso', 'idade', 'energia'];
        driverFields.forEach((key, i) => {
            if (driver?.[key] !== undefined) {
                hf.setCellContents({ sheet: setupSheetId, row: 5 + i, col: 4 }, [[Number(driver[key])]]);
            }
        });

        // 4. Carro (I6:J16 -> Row 5-15, Col 8 e 9)
        if (car && Array.isArray(car)) {
            car.forEach((part, i) => {
                if (i < 11) {
                    hf.setCellContents({ sheet: setupSheetId, row: 5 + i, col: 8 }, [[Number(part.lvl) || 1]]);
                    hf.setCellContents({ sheet: setupSheetId, row: 5 + i, col: 9 }, [[Number(part.wear) || 0]]);
                }
            });
        }

        // 5. Voltas dos Stints (G21-N21 -> Row 20, Col 6-13)
        const stintKeys = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
        stintKeys.forEach((key, i) => {
            const laps = stints?.[key] === '' ? 0 : Number(stints?.[key]);
            hf.setCellContents({ sheet: tyreSheetId, row: 20, col: 6 + i }, [[laps]]);
        });

        // --- LEITURA DOS RESULTADOS RECALCULADOS ---

        // Stints (G22-N22 e G23-N23)
        const results = stintKeys.map((_, i) => ({
            wear: hf.getCellValue({ sheet: tyreSheetId, row: 21, col: 6 + i }),
            fuel: hf.getCellValue({ sheet: tyreSheetId, row: 22, col: 6 + i })
        }));

        // Setup Ideal (AE6:AE11 -> Row 5 a 10, Coluna AE = 30)
        const setupIdeal = [];
        for (let r = 5; r <= 10; r++) {
            const val = hf.getCellValue({ sheet: setupSheetId, row: r, col: 30 });
            setupIdeal.push(typeof val === 'number' ? Math.round(val) : val);
        }

        return NextResponse.json({ results, setupIdeal, success: true });
    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}