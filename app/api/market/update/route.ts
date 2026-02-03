import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const GPRO_DOWNLOAD_CSV_URL = "https://www.gpro.net/br/GetMarketFile.asp?market=drivers&type=csv";

const COLUMN_MAP: Record<string, string> = {
    'ID': 'id', 'NAME': 'nome', 'NAT': 'nacionalidade', 'OA': 'total', 'CON': 'concentracao', 
    'TAL': 'talento', 'AGG': 'agressividade', 'EXP': 'experiencia', 'TEI': 'tecnica', 
    'STA': 'resistencia', 'CHA': 'carisma', 'MOT': 'motivacao', 'REP': 'reputacao', 
    'WEI': 'peso', 'AGE': 'idade', 'RET': 'aposentadoria', 
    'SAL': 'salario', 'FEE': 'taxa', 'OFF': 'ofertas', 'FAV': 'favorito', 'LVL': 'nivel'
};

const SIMPLE_NUMERIC_KEYS = [
    'id', 'total', 'concentracao', 'talento', 'agressividade', 'experiencia', 
    'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao', 
    'peso', 'idade', 'nivel', 'ofertas'
];

// --- FUNÇÕES AUXILIARES ---
function safeParseInt(value: string, isCurrency: boolean = false): number {
    if (!value) return 0;
    let cleanValue = value.trim();
    if (isCurrency) {
        cleanValue = cleanValue.replace(/[$,\s]/g, '').replace(/\./g, '');
    }
    const parsed = parseInt(cleanValue, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function parseCSVLine(line: string, separator: string): string[] {
    const columns: string[] = [];
    let currentColumn = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            columns.push(currentColumn.trim());
            currentColumn = "";
        } else {
            currentColumn += char;
        }
    }
    columns.push(currentColumn.trim());
    return columns.map(val => val.replace(/^"|"$/g, '').trim());
}

// --- MÉTODO GET: BUSCA DO SUPABASE ---
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('market_drivers')
            .select('*')
            .order('total', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (e: any) {
        console.error("Erro ao buscar drivers:", e.message);
        return NextResponse.json({ success: false, error: e.message, data: [] }, { status: 500 });
    }
}

// --- MÉTODO POST: SINCRONIZAÇÃO GPRO -> SUPABASE ---
export async function POST() {
    try {
        const response = await fetch(GPRO_DOWNLOAD_CSV_URL, { next: { revalidate: 0 } });
        if (!response.ok) throw new Error(`Download falhou: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let content: string;

        try {
            const decompressed = await gunzip(buffer);
            content = decompressed.toString('latin1');
        } catch {
            content = buffer.toString('latin1');
        }

        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV vazio ou inválido");

        const headerIndex = 1;
        const rawHeader = lines[headerIndex].trim();
        const separator = rawHeader.includes(';') ? ';' : ',';
        const headers = parseCSVLine(rawHeader, separator);

        const drivers = [];

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i], separator);
            if (values.length < 5) continue;

            const driverObj: any = {};
            headers.forEach((header, idx) => {
                const key = COLUMN_MAP[header.toUpperCase()] || header.toLowerCase();
                const val = values[idx] || "";

                if (key === 'aposentadoria') return;
                
                if (key === 'favorito') {
                    driverObj[key] = val;
                } else if (SIMPLE_NUMERIC_KEYS.includes(key)) {
                    driverObj[key] = safeParseInt(val);
                } else if (['salario', 'taxa'].includes(key)) {
                    driverObj[key] = safeParseInt(val, true);
                } else {
                    driverObj[key] = val;
                }
            });

            if (driverObj.id) {
                drivers.push(driverObj);
            }
        }

        // Envia para o Supabase (Upsert baseado no ID)
        const { error } = await supabase
            .from('market_drivers')
            .upsert(drivers, { onConflict: 'id' });

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            count: drivers.length 
        });

    } catch (error: any) {
        console.error("Erro na sincronização:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}