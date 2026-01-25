import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';

export async function GET() {
  try {
    // 1. Localizar o arquivo no servidor
    const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
    
    // 2. Abrir o Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // 3. Pegar a aba 'Tracks' (onde está a lista)
    const worksheet = workbook.getWorksheet('Tracks');
    
    if (!worksheet) {
        console.error("ERRO CRÍTICO: Aba 'Tracks' não encontrada na planilha.");
        return NextResponse.json({ tracks: [], error: 'Aba Tracks sumiu' }, { status: 404 });
    }

    const tracks = [];
    
    // 4. Ler intervalo A4:A67
    // O ExcelJS usa base 1 para linhas, então row=4 é a linha 4 do Excel.
    for (let row = 4; row <= 67; row++) {
        const cell = worksheet.getCell(`A${row}`);
        
        // Só adiciona se tiver texto (evita vazios)
        if (cell.value) {
            tracks.push(cell.value.toString());
        }
    }

    // 5. Retornar JSON para o Frontend
    return NextResponse.json({ tracks });

  } catch (error) {
    console.error('Erro na API Tracks:', error);
    return NextResponse.json({ tracks: [], error: error.message }, { status: 500 });
  }
}