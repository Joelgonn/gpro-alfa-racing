import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const GPRO_LANG = 'br';
const GPRO_API_BASE = 'https://gpro.net';

type GproJson = Record<string, any>;

// ============================================
// HELPERS DE REQUISIÇÃO GPRO
// ============================================

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
    const message = typeof payload === 'string' 
      ? payload 
      : payload?.errorMsg || payload?.message || payload?.error || `GPRO ${path} retornou ${response.status}`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`Resposta inválida do endpoint GPRO ${path}`);
  }

  return payload;
}

// ============================================
// MAPEADORES DE DADOS GPRO
// ============================================

function mapDriver(data: GproJson) {
  return {
    concentracao: Number(data.concentration ?? 0),
    talento: Number(data.talent ?? 0),
    agressividade: Number(data.aggressiveness ?? 0),
    experiencia: Number(data.experience ?? 0),
    tecnica: Number(data.techInsight ?? 0),
    resistencia: Number(data.stamina ?? 0),
    carisma: Number(data.charisma ?? 0),
    motivacao: Number(data.motivation ?? 0),
    reputacao: Number(data.reputation ?? 0),
    peso: Number(data.weight ?? 0),
    idade: Number(data.age ?? 0),
    energia: Number(data.energy ?? 0),
  };
}

function mapTechDirector(data: GproJson | null) {
  if (!data) {
    return {
      rdMecanico: 0,
      rdEletronico: 0,
      rdAerodinamico: 0,
      experiencia: 0,
      pitCoord: 0,
    };
  }

  return {
    rdMecanico: Number(data.mechanics ?? 0),
    rdEletronico: Number(data.electronics ?? 0),
    rdAerodinamico: Number(data.aerodynamics ?? 0),
    experiencia: Number(data.experience ?? 0),
    pitCoord: Number(data.pitCoord ?? 0),
  };
}

function mapCar(data: GproJson) {
  return [
    { name: 'Chassi', lvl: Number(data.lvlChassis ?? 0), wear: Number(data.usaChassis ?? 0) },
    { name: 'Motor', lvl: Number(data.lvlEngine ?? 0), wear: Number(data.usaEngine ?? 0) },
    { name: 'Asa dianteira', lvl: Number(data.lvlFWing ?? 0), wear: Number(data.usaFWing ?? 0) },
    { name: 'Asa traseira', lvl: Number(data.lvlRWing ?? 0), wear: Number(data.usaRWing ?? 0) },
    { name: 'Assoalho', lvl: Number(data.lvlUnderbody ?? 0), wear: Number(data.usaUnderbody ?? 0) },
    { name: 'Laterais', lvl: Number(data.lvlSidepods ?? 0), wear: Number(data.usaSidepods ?? 0) },
    { name: 'Radiador', lvl: Number(data.lvlCooling ?? 0), wear: Number(data.usaCooling ?? 0) },
    { name: 'Câmbio', lvl: Number(data.lvlGear ?? 0), wear: Number(data.usaGear ?? 0) },
    { name: 'Freios', lvl: Number(data.lvlBrakes ?? 0), wear: Number(data.usaBrakes ?? 0) },
    { name: 'Suspensão', lvl: Number(data.lvlSusp ?? 0), wear: Number(data.usaSusp ?? 0) },
    { name: 'Eletrônicos', lvl: Number(data.lvlElectronics ?? 0), wear: Number(data.usaElectronics ?? 0) },
  ];
}

function mapTestPoints(data: GproJson) {
  return {
    power: Number(data.testPowerPoints ?? 0),
    handling: Number(data.testHandlPoints ?? 0),
    accel: Number(data.testAccelPoints ?? 0),
  };
}

/**
 * MAPEAMENTO DE CLIMA - FONTE OFICIAL GPRO
 * 
 * REGRA ARQUITETURAL:
 * weatherRace segue ESTRITAMENTE o resultado oficial da API GPRO baseado no primeiro período da corrida.
 * 
 * REGRA CORRETA:
 * A corrida deve iniciar molhada quando raceQ1RainPLow > 0
 * Caso contrário, a corrida inicia seca (Dry)
 * 
 * NÃO são aplicadas inferências locais baseadas em:
 * - Qualificação 2 (Q2)
 * - Quadrantes da corrida (raceQ2, raceQ3, raceQ4)
 * - Percentual de chuva de outros períodos
 * - Probabilidades calculadas localmente
 * 
 * A API GPRO é a ÚNICA fonte de verdade para o clima inicial da corrida.
 */
function mapWeather(data: GproJson | null) {
  if (!data?.weather) return null;
  
  // O clima da corrida é determinado pelo primeiro período (raceQ1RainPLow)
  // Se > 0, a corrida começa molhada. Se == 0, a corrida começa seca.
  const raceQ1RainPLow = Number(data.weather.raceQ1RainPLow ?? 0);
  const weatherRace = raceQ1RainPLow > 0 ? 'Wet' : 'Dry';
  
  return {
    tempQ1: Number(data.weather.q1Temp ?? 0),
    weatherQ1: String(data.weather.q1WeatherTransl ?? data.weather.q1Weather ?? 'Dry'),
    tempQ2: Number(data.weather.q2Temp ?? 0),
    weatherQ2: String(data.weather.q2WeatherTransl ?? data.weather.q2Weather ?? 'Dry'),
    weatherRace: weatherRace,
    r1_temp_min: Number(data.weather.raceQ1TempLow ?? 0),
    r1_temp_max: Number(data.weather.raceQ1TempHigh ?? 0),
    r2_temp_min: Number(data.weather.raceQ2TempLow ?? 0),
    r2_temp_max: Number(data.weather.raceQ2TempHigh ?? 0),
    r3_temp_min: Number(data.weather.raceQ3TempLow ?? 0),
    r3_temp_max: Number(data.weather.raceQ3TempHigh ?? 0),
    r4_temp_min: Number(data.weather.raceQ4TempLow ?? 0),
    r4_temp_max: Number(data.weather.raceQ4TempHigh ?? 0),
  };
}

function mapTesting(data: GproJson | null) {
  if (!data) return null;

  return {
    track: String(data.trackName ?? ''),
    weather: String(
      data.weatherTransl ??
      data.weather ??
      'Dry'
    ),
    temp: Number(data.temp ?? 0),
  };
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Validação da requisição
    let userId: string | null = null;

    try {
      const body = await request.json();
      userId = body.userId || body.user_id;
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido. Envie { userId: "..." }' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório. Envie { userId: "..." } no corpo da requisição.' },
        { status: 400 }
      );
    }

    // 2. Conexão com Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Buscar token do usuário
    const { data: userState, error: userError } = await supabase
      .from('user_state')
      .select('gpro_token')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar user_state:', userError);
      return NextResponse.json(
        { error: 'Erro ao buscar token GPRO. Configure o token na página de integração.' },
        { status: 500 }
      );
    }

    if (!userState?.gpro_token) {
      return NextResponse.json(
        { error: 'Token GPRO não encontrado. Configure o token na página de integração.' },
        { status: 404 }
      );
    }

    const token = userState.gpro_token;

    // 4. Buscar dados da GPRO em paralelo
    const [
      trackData,
      driverData,
      carData,
      staffData,
      tdData,
      qualifyData,
    ] = await Promise.all([
      fetchGproJson('TrackProfile', token),
      fetchGproJson('DriProfile', token),
      fetchGproJson('UpdateCar', token),
      fetchGproJson('StaffAndFacilities', token),
      fetchGproJson('TDProfile', token),
      fetchGproJson('Qualify2', token),
    ]);

    // 5. Dados de testes (não bloqueante)
    const testingData = await fetchGproJson('Testing', token).catch((error) => {
      console.warn('⚠️ Endpoint Testing indisponível, continuando sem dados de testes:', error.message);
      return null;
    });

    // 6. Mapear Tech Director (pode ser nulo)
    const mappedTechDirector = tdData?.tdName
      ? mapTechDirector(tdData)
      : {
          rdMecanico: 0,
          rdEletronico: 0,
          rdAerodinamico: 0,
          experiencia: 0,
          pitCoord: 0,
        };

    // 7. Retornar resposta padronizada
    return NextResponse.json({
      success: true,
      driver: mapDriver(driverData),
      car: mapCar(carData),
      techDirector: mappedTechDirector,
      track: String(trackData.trackName ?? ''),
      staff: {
        toleranciaPressao: Number(staffData.stressHandling ?? 0),
        concentracao: Number(staffData.concentration ?? 0),
      },
      weather: mapWeather(qualifyData),
      test_points: mapTestPoints(carData), // CORRIGIDO: testPoints -> test_points
      testing: mapTesting(testingData),
    });

  } catch (error) {
    console.error('Erro no sync com GPRO:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao sincronizar com GPRO. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}