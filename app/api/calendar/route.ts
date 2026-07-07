import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const GPRO_LANG = 'br';
const GPRO_API_BASE = 'https://gpro.net';

type GproJson = Record<string, any>;

/**
 * Busca um endpoint da API GPRO
 */
async function fetchGproJson(path: string, token: string): Promise<GproJson> {
  const response = await fetch(`${GPRO_API_BASE}/${GPRO_LANG}/backend/api/v2/${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.errorMsg || payload?.message || payload?.error || `GPRO ${path} retornou ${response.status}`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`Resposta inválida do endpoint GPRO ${path}`);
  }

  return payload;
}

/**
 * Lê e processa a planilha de pistas do Excel
 */
function loadTracksFromExcel() {
  const filePath = path.join(process.cwd(), 'data', 'calculadora.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('Planilha não encontrada');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const worksheet = workbook.Sheets['Tracks'];
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const rows = data.slice(3); // Pula o cabeçalho

  const tracks = rows.filter(row => row[0]).map(row => {
    const trackName = String(row[0]).trim();
    const nomeParaBusca = trackName.toLowerCase();
    const flagCode = MAPA_BANDEIRAS[nomeParaBusca] || 'xx';

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

  return tracks;
}

/**
 * Busca o token GPRO do usuário no Supabase
 */
async function getUserToken(userId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: userState, error: userError } = await supabase
    .from('user_state')
    .select('gpro_token')
    .eq('user_id', userId)
    .single();

  if (userError || !userState?.gpro_token) {
    return null;
  }

  return userState.gpro_token;
}

/**
 * Busca o calendário da API GPRO
 */
async function fetchGproCalendar(token: string): Promise<GproJson | null> {
  try {
    const calendarData = await fetchGproJson('Calendar', token);
    return calendarData;
  } catch (error) {
    console.warn('⚠️ Endpoint Calendar indisponível:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Processa o calendário bruto da GPRO
 */
function processCalendar(calendarRaw: GproJson | null): {
  events: any[];
  nextSeasonEvents: any[];
  testTrackName: string;
  testTrackId: string;
  group: string;
} | null {
  if (!calendarRaw) return null;

  // Tenta extrair eventos da estrutura esperada (events array)
  let events: any[] = [];
  let nextSeasonEvents: any[] = [];
  let testTrackName = '';
  let testTrackId = '';
  let group = '';

  if (Array.isArray(calendarRaw.events)) {
    events = calendarRaw.events.map((event: any) => ({
      idx: event.idx ?? event.race ?? event.raceNumber ?? 0,
      trackName: String(event.trackName ?? event.track ?? ''),
      trackId: String(event.trackId ?? ''),
      dateEvent: String(event.dateEvent ?? event.date ?? ''),
      eventType: String(event.eventType ?? 'R'),
      isCurrentRace: Boolean(event.isCurrentRace ?? false),
      isFavTrack: Boolean(event.isFavTrack ?? false),
      trackNatCode: String(event.trackNatCode ?? ''),
    }));
  } else {
    // Fallback: tenta encontrar um array em qualquer propriedade
    for (const key of Object.keys(calendarRaw)) {
      if (Array.isArray(calendarRaw[key]) && calendarRaw[key].length > 0) {
        const firstItem = calendarRaw[key][0];
        if (firstItem && (firstItem.trackName || firstItem.track || firstItem.race || firstItem.raceNumber)) {
          events = calendarRaw[key].map((race: any) => ({
            idx: Number(race.race ?? race.raceNumber ?? 0),
            trackName: String(race.trackName ?? race.track ?? ''),
            trackId: String(race.trackId ?? ''),
            dateEvent: String(race.dateEvent ?? race.date ?? ''),
            eventType: String(race.eventType ?? 'R'),
            isCurrentRace: Boolean(race.isCurrentRace ?? false),
            isFavTrack: Boolean(race.isFavTrack ?? false),
            trackNatCode: String(race.trackNatCode ?? ''),
          }));
          break;
        }
      }
    }
  }

  // Extrai próximos eventos da temporada
  if (Array.isArray(calendarRaw.nextSeasonEvents)) {
    nextSeasonEvents = calendarRaw.nextSeasonEvents.map((event: any) => ({
      idx: event.idx ?? event.race ?? event.raceNumber ?? 0,
      trackName: String(event.trackName ?? event.track ?? ''),
      trackId: String(event.trackId ?? ''),
      dateEvent: String(event.dateEvent ?? event.date ?? ''),
      eventType: String(event.eventType ?? 'R'),
      isCurrentRace: false,
      isFavTrack: Boolean(event.isFavTrack ?? false),
      trackNatCode: String(event.trackNatCode ?? ''),
    }));
  }

  // Extrai pista de testes
  if (calendarRaw.testTrackName) {
    testTrackName = String(calendarRaw.testTrackName);
  }
  if (calendarRaw.testTrackId) {
    testTrackId = String(calendarRaw.testTrackId);
  }

  // Extrai nome do grupo
  if (calendarRaw.group) {
    group = String(calendarRaw.group);
  }

  return {
    events,
    nextSeasonEvents,
    testTrackName,
    testTrackId,
    group,
  };
}

/**
 * Mescla dados do calendário com os dados da planilha
 */
function mergeCalendarWithTracks(calendar: any[] | null, tracks: any[]): any[] | null {
  if (!calendar || calendar.length === 0) return null;

  // Cria um mapa de pistas para busca rápida
  const tracksMap = new Map();
  tracks.forEach(track => {
    tracksMap.set(track.name.toLowerCase(), track);
  });

  const merged = calendar.map(race => {
    const trackName = race.trackName || '';
    const trackData = tracksMap.get(trackName.toLowerCase());

    if (trackData) {
      return {
        ...race,
        ...trackData,
        // Garante que o nome da pista do calendário prevaleça
        trackName: trackName
      };
    }

    // Se não encontrou a pista, retorna apenas os dados do calendário
    return {
      ...race,
      flag: 'xx',
      downforce: '-',
      overtaking: '-',
      suspension: '-',
      fuel: '-',
      wear: '-',
      lapLen: 0,
      laps: 0,
      dist: 0,
      power: 0,
      handling: 0,
      accel: 0,
      avgSpeed: 0,
      corners: 0,
      pit: 0,
      grip: '-'
    };
  });

  return merged;
}

export async function GET(request: Request) {
  try {
    // Extrai userId da URL (query param)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    // 1. Carrega pistas do Excel (sempre necessário)
    let tracks: any[] = [];
    try {
      tracks = loadTracksFromExcel();
    } catch (error) {
      console.error('Erro ao carregar planilha:', error);
      return NextResponse.json(
        { sucesso: false, erro: 'Erro ao carregar dados das pistas' },
        { status: 500 }
      );
    }

    // 2. Se não tiver userId, retorna apenas as pistas (compatibilidade com versão anterior)
    if (!userId) {
      return NextResponse.json({ 
        sucesso: true, 
        tracks,
        calendar: null,
        calendarRaw: null
      });
    }

    // 3. Busca token do usuário
    const token = await getUserToken(userId);
    if (!token) {
      return NextResponse.json({ 
        sucesso: true, 
        tracks,
        calendar: null,
        calendarRaw: null,
        erroToken: 'Token GPRO não encontrado'
      });
    }

    // 4. Busca calendário da GPRO
    const calendarRaw = await fetchGproCalendar(token);

    // 5. Processa o calendário
    const processed = processCalendar(calendarRaw);

    // 6. Mescla eventos com dados da planilha
    const mergedCalendar = processed ? mergeCalendarWithTracks(processed.events, tracks) : null;
    const mergedNextSeason = processed ? mergeCalendarWithTracks(processed.nextSeasonEvents, tracks) : null;

    // 7. Monta resposta completa
    const responsePayload: any = {
      sucesso: true,
      tracks,
      calendar: mergedCalendar,
      calendarRaw: {
        events: processed?.events ?? [],
        nextSeasonEvents: processed?.nextSeasonEvents ?? [],
        testTrackName: processed?.testTrackName ?? '',
        testTrackId: processed?.testTrackId ?? '',
        group: processed?.group ?? '',
      },
    };

    // TODO: Remover após homologação do endpoint Calendar
    console.log('🔍 Calendar API Response:');
    console.dir(calendarRaw, { depth: null });

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("Erro na API de calendário:", error);
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }
}
