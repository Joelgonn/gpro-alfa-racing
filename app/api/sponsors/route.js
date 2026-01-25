import { NextResponse } from 'next/server';
import path from 'path';
import ExcelJS from 'exceljs';

const CONFIG = {
  // TENTATIVA 1: Nome exato que você mencionou
  SHEET_NAME_PRIMARY: 'Patrocinador',
  // TENTATIVA 2: Nome alternativo comum (caso o anterior falhe)
  SHEET_NAME_FALLBACK: 'Patrocinador 1',
  
  TABLES_SHEET: 'Tables',
  
  // GABARITO (O37:T43)
  REF_ROW_START: 37,
  REF_ROW_END: 43,
  
  // Colunas (ExcelJS: A=1 ... O=15)
  COL_KEY: 15,      // O (Chave 1-7)
  COL_EXPECT: 16,   // P (H5)
  COL_POP: 17,      // Q (H6)
  COL_AMOUNT: 18,   // R (H7)
  COL_DURATION: 19, // S (H8)
  COL_AREA: 20      // T (H4)
};

let cachedLookupTable = null;
let cachedOpponentTable = null;

// Função para limpar valores sujos do Excel
function extractValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return null;
    if (typeof cell.value !== 'object') return cell.value;
    
    // Se for objeto (RichText, Formula, etc)
    const v = cell.value;
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v.text) return v.text;
    
    return String(v); 
}

async function loadTables() {
    if (cachedLookupTable && cachedOpponentTable) return;

    const workbook = new ExcelJS.Workbook();
    const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
    await workbook.xlsx.readFile(filePath);

    // --- 1. CARREGAR GABARITO DE TEXTO ---
    // Tenta achar a aba 'Patrocinador' ou 'Patrocinador 1'
    let sheetSponsor = workbook.getWorksheet(CONFIG.SHEET_NAME_PRIMARY);
    if (!sheetSponsor) {
        sheetSponsor = workbook.getWorksheet(CONFIG.SHEET_NAME_FALLBACK);
    }

    const textTable = {};
    
    if (sheetSponsor) {
        // console.log(`Lendo aba: ${sheetSponsor.name}`); // Debug
        for (let i = CONFIG.REF_ROW_START; i <= CONFIG.REF_ROW_END; i++) {
            const row = sheetSponsor.getRow(i);
            
            // Extrai a chave da coluna O (15)
            let rawKey = extractValue(row.getCell(CONFIG.COL_KEY));
            
            if (rawKey !== null) {
                const keyStr = String(rawKey).trim();
                
                textTable[keyStr] = {
                    expect: String(extractValue(row.getCell(CONFIG.COL_EXPECT)) || "..."),
                    pop: String(extractValue(row.getCell(CONFIG.COL_POP)) || "..."),
                    amount: String(extractValue(row.getCell(CONFIG.COL_AMOUNT)) || "..."),
                    duration: String(extractValue(row.getCell(CONFIG.COL_DURATION)) || "..."),
                    area: String(extractValue(row.getCell(CONFIG.COL_AREA)) || "..."),
                };
            }
        }
    } else {
        console.error(`ERRO CRÍTICO: Aba '${CONFIG.SHEET_NAME_PRIMARY}' não encontrada no Excel.`);
    }
    cachedLookupTable = textTable;

    // --- 2. CARREGAR TABELA DO ADVERSÁRIO (Aba Tables) ---
    const sheetTables = workbook.getWorksheet(CONFIG.TABLES_SHEET);
    const oppTable = {};
    
    if (sheetTables) {
        for (let r = 28; r <= 30; r++) {
            const row = sheetTables.getRow(r);
            const mgrs = extractValue(row.getCell(29)); // AC
            const prog = extractValue(row.getCell(30)); // AD
            if (mgrs != null) {
                oppTable[String(mgrs)] = Number(prog);
            }
        }
    }
    cachedOpponentTable = oppTable;
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    await loadTables(); // Garante carregamento

    // 1. CÁLCULO MATEMÁTICO (H9/H10)
    const B9 = Number(body.currentProgress) || 0;
    const B10 = Number(body.averageProgress) || 0;
    const B11 = Number(body.managers) || 1;

    const diff = (B9 * B11 - 100) - (B10 * B11 - 100);
    const opponentProgress = cachedOpponentTable ? (cachedOpponentTable[String(B11)] || 0) : 0;

    // 2. BUSCA DE RESPOSTAS (PROCV MANUAL)
    const answers = [];

    const lookup = (val, type) => {
        let idx = Math.round(Number(val));
        if (idx < 1) idx = 1;
        if (idx > 7) idx = 7;
        
        // Se a tabela não carregou, retorna erro
        if (!cachedLookupTable) return "Erro Leitura Excel";

        const row = cachedLookupTable[String(idx)];
        return row ? row[type] : "...";
    };

    // Mapeamento
    // P1 (Area) -> Imagem (B7)
    answers.push(lookup(body.image, 'area'));
    
    // P2 (Expectativa) -> Expectativas (B4)
    answers.push(lookup(body.expectations, 'expect'));
    
    // P3 (Popularidade) -> Imagem (B7)
    answers.push(lookup(body.image, 'pop'));
    
    // P4 (Valor) -> Paciência (B5)
    answers.push(lookup(body.patience, 'amount'));
    
    // P5 (Duração) -> Paciência (B5)
    answers.push(lookup(body.patience, 'duration'));

    return NextResponse.json({ 
        sucesso: true, 
        data: {
            answers,
            stats: {
                diff: Number(diff.toFixed(2)),
                opponentProgress: Number(opponentProgress)
            }
        }
    });

  } catch (error) {
    console.error("Erro API Sponsors:", error);
    return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  }
}