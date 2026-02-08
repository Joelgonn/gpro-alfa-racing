// --- app/api/market/update/route.ts ---

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
    'WEI': 'peso', 'AGE': 'idade', 'SAL': 'salario', 'FEE': 'taxa', 'OFF': 'ofertas', 
    'FAV': 'favorito', 'LVL': 'nivel', 'RET': 'aposentadoria'
};

const ALLOWED_KEYS = Object.values(COLUMN_MAP);
const NUMERIC_KEYS = ['id', 'total', 'concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao', 'peso', 'idade', 'ofertas', 'nivel'];

function safeParseInt(value: string, isCurrency = false): number {
    if (!value) return 0;
    let cleanValue = value.trim();
    if (isCurrency) cleanValue = cleanValue.replace(/[$,\s]/g, '').replace(/\./g, '');
    const parsed = parseInt(cleanValue, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function parseCSVLine(line: string, separator: string): string[] {
    const columns: string[] = [];
    let inQuotes = false;
    let current = "";
    for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === separator && !inQuotes) { columns.push(current.trim()); current = ""; }
        else current += char;
    }
    columns.push(current.trim());
    return columns.map(v => v.replace(/^"|"$/g, '').trim());
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('market_drivers')
            .select('*')
            .order('total', { ascending: false });

        const { data: lastRecord } = await supabase
            .from('market_drivers')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        return NextResponse.json({ success: true, data: data || [], lastSync: lastRecord?.[0]?.updated_at || null });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST() {
    try {
        // --- 1. DOWNLOAD E PARSE ---
        const res = await fetch(GPRO_DOWNLOAD_CSV_URL, { next: { revalidate: 0 } });
        const buffer = Buffer.from(await res.arrayBuffer());
        let content: string;
        try { content = (await gunzip(buffer)).toString('latin1'); } catch { content = buffer.toString('latin1'); }

        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        const headers = parseCSVLine(lines[1], lines[1].includes(';') ? ';' : ',');
        
        const allDrivers = lines.slice(2).map(line => {
            const values = parseCSVLine(line, lines[1].includes(';') ? ';' : ',');
            const rawObj: any = {};
            headers.forEach((h, i) => {
                const key = COLUMN_MAP[h.toUpperCase()];
                if (key) {
                    if (NUMERIC_KEYS.includes(key)) rawObj[key] = safeParseInt(values[i]);
                    else if (['salario', 'taxa'].includes(key)) rawObj[key] = safeParseInt(values[i], true);
                    else rawObj[key] = values[i];
                }
            });
            const cleanObj: any = {};
            ALLOWED_KEYS.forEach(key => { if (rawObj[key] !== undefined) cleanObj[key] = rawObj[key]; });
            return cleanObj;
        }).filter(d => d.id);

        if (allDrivers.length === 0) throw new Error("Nenhum piloto encontrado no arquivo CSV.");

        // --- 2. LIMPEZA DA BASE ANTIGA (MUITO IMPORTANTE) ---
        // Deletamos todos os registros antes de inserir os novos para remover pilotos contratados.
        const { error: deleteError } = await supabase
            .from('market_drivers')
            .delete()
            .neq('id', 0); // Filtro "id != 0" para forçar a deleção de todos

        if (deleteError) throw new Error("Erro ao limpar base antiga: " + deleteError.message);

        // --- 3. INSERÇÃO DOS NOVOS DADOS ---
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < allDrivers.length; i += CHUNK_SIZE) {
            const chunk = allDrivers.slice(i, i + CHUNK_SIZE);
            const { error: insertError } = await supabase
                .from('market_drivers')
                .insert(chunk); // Usamos .insert() pois a base já está limpa
            
            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true, count: allDrivers.length });
    } catch (error: any) {
        console.error("Erro na sincronização:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}