import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

// Mapa de bandeiras (adicionei variações comuns para garantir)
const MAPA_BANDEIRAS: Record<string, string> = {
  "adelaide": "au", "ahvenisto": "fi", "anderstorp": "se", "austin": "us", "avus": "de", 
  "a1-ring": "at", "a1 ring": "at", "a1ring": "at", // Variações do A1-Ring
  "baku city": "az", "baku": "az", "barcelona": "es", "brands hatch": "gb", "brasilia": "br", "bremgarten": "ch", 
  "brno": "cz", "bucharest ring": "ro", "buenos aires": "ar",
  "catalunya": "es", "dijon-prenois": "fr", "donington": "gb", "estoril": "pt", "fiorano": "it", "fuji": "jp", 
  "grobnik": "hr", "hockenheim": "de", "hungaroring": "hu", "imola": "sm", 
  "indianapolis oval": "us", "indianapolis": "us", "interlagos": "br", "istanbul": "tr", "irungattukottai": "in", 
  "jarama": "es", "jeddah": "sa", "jerez": "es", "kyalami": "za", "jyllands-ringen": "dk", "kaunas": "lt", 
  "laguna seca": "us", "las vegas": "us", "le mans": "fr", "long beach": "us", "losail": "qa", 
  "magny cours": "fr", "magny-cours": "fr", "melbourne": "au", "mexico city": "mx", "miami": "us", 
  "misano": "it", "monte carlo": "mc", "monaco": "mc", "montreal": "ca", "monza": "it", "mugello": "it", 
  "nurburgring": "de", "oschersleben": "de", "new delhi": "in", 
  "oesterreichring": "at", "osterreichring": "at", "paul ricard": "fr", "portimao": "pt", "poznan": "pl", 
  "red bull ring": "at", "rio de janeiro": "br", "rafaela oval": "ar", 
  "sakhir": "bh", "sepang": "my", "shanghai": "cn", "silverstone": "gb", "singapore": "sg", "sochi": "ru", 
  "spa": "be", "suzuka": "jp", "serres": "gr", "slovakiaring": "sk", 
  "valencia": "es", "vallelunga": "it", "yas marina": "ae", "yeongam": "kr", "zandvoort": "nl", "zolder": "be"
};

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
    if (!fs.existsSync(filePath)) return NextResponse.json({ sucesso: false, erro: 'Planilha não encontrada' }, { status: 404 });

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets['Tracks'];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const rows = data.slice(3); // Pula o cabeçalho

    const tracks = rows.filter(row => row[0]).map(row => {
      // 1. Limpa espaços extras
      const trackName = String(row[0]).trim();
      
      // 2. Busca inteligente da bandeira (transforma tudo em minúsculo para comparar)
      const nomeParaBusca = trackName.toLowerCase();
      const flagCode = MAPA_BANDEIRAS[nomeParaBusca] || 'xx';

      // DEBUG: Se for A1-Ring, avisa no console do servidor o que está acontecendo
      if (nomeParaBusca.includes('a1')) {
        console.log(`[DEBUG API] Pista lida do Excel: "${trackName}" | Código procurado: "${nomeParaBusca}" | Bandeira encontrada: "${flagCode}"`);
      }

      return {
        name: trackName,
        flag: flagCode, 
        downforce: String(row[1] || '-'),
        overtaking: String(row[2] || '-'),
        suspension: String(row[3] || '-'),
        fuel: String(row[4] || '-'),
        wear: String(row[5] || '-'),
        lapLen: Number(row[6]) || 0,
        laps: Number(row[7]) || 0,
        dist: Number(row[8]) || 0,
        power: Number(row[9]) || 0,
        handling: Number(row[10]) || 0,
        accel: Number(row[11]) || 0,
        avgSpeed: Number(row[12]) || 0,
        corners: Number(row[14]) || 0, 
        pit: Number(row[15]) || 0,     
        grip: String(row[16] || '-')   
      };
    });

    return NextResponse.json({ sucesso: true, tracks });
  } catch (error: any) {
    console.error("Erro na API de calendário:", error);
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
}