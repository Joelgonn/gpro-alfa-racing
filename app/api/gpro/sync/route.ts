import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { saveSnapshots } from '@/app/lib/gpro-snapshot';

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
// FUNÇÃO PARA EXTRAIR SEASON E RACE
// ============================================

function extractSeasonRace(data: GproJson): { season?: number; race?: number } {
  const possibleSeasonFields = ['season', 'seasonId', 'seasonID', 'Season', 'SeasonId'];
  const possibleRaceFields = ['race', 'raceId', 'raceID', 'round', 'Round', 'Race', 'RaceId'];
  
  let season: number | undefined;
  let race: number | undefined;

  for (const field of possibleSeasonFields) {
    const value = Number(data[field]);
    if (!isNaN(value) && value > 0) {
      season = value;
      break;
    }
  }

  for (const field of possibleRaceFields) {
    const value = Number(data[field]);
    if (!isNaN(value) && value > 0) {
      race = value;
      break;
    }
  }

  if (season && race) {
    console.log(`📅 Season ${season}, Race ${race} extraídos`);
  } else {
    console.log(`⚠️ Season/Race não encontrados no payload`);
  }

  return { season, race };
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
  const power = Number(data.testPowerPoints ?? data.testPower ?? 0);
  const handling = Number(data.testHandlPoints ?? data.testHandling ?? data.testHandl ?? 0);
  const accel = Number(data.testAccelPoints ?? data.testAccel ?? 0);
  
  return {
    power: power,
    handling: handling,
    accel: accel,
  };
}

function mapWeather(data: GproJson | null) {
  if (!data?.weather) return null;
  
  const q2Weather = String(data.weather.q2WeatherTransl ?? data.weather.q2Weather ?? 'Dry');
  const weatherRace = (q2Weather === 'Rain' || q2Weather === 'Wet') ? 'Wet' : 'Dry';
  
  const r1RainLow = Number(
    data.weather.raceQ1RainPLow ?? 
    data.weather.raceQ1RainLow ?? 
    data.weather.raceQ1RainChanceLow ?? 
    0
  );
  const r1RainHigh = Number(
    data.weather.raceQ1RainPHigh ?? 
    data.weather.raceQ1RainHigh ?? 
    data.weather.raceQ1RainChanceHigh ?? 
    0
  );
  const r1RainAvg = (r1RainLow + r1RainHigh) / 2;
  
  const r2RainLow = Number(
    data.weather.raceQ2RainPLow ?? 
    data.weather.raceQ2RainLow ?? 
    data.weather.raceQ2RainChanceLow ?? 
    0
  );
  const r2RainHigh = Number(
    data.weather.raceQ2RainPHigh ?? 
    data.weather.raceQ2RainHigh ?? 
    data.weather.raceQ2RainChanceHigh ?? 
    0
  );
  const r2RainAvg = (r2RainLow + r2RainHigh) / 2;
  
  const r3RainLow = Number(
    data.weather.raceQ3RainPLow ?? 
    data.weather.raceQ3RainLow ?? 
    data.weather.raceQ3RainChanceLow ?? 
    0
  );
  const r3RainHigh = Number(
    data.weather.raceQ3RainPHigh ?? 
    data.weather.raceQ3RainHigh ?? 
    data.weather.raceQ3RainChanceHigh ?? 
    0
  );
  const r3RainAvg = (r3RainLow + r3RainHigh) / 2;
  
  const r4RainLow = Number(
    data.weather.raceQ4RainPLow ?? 
    data.weather.raceQ4RainLow ?? 
    data.weather.raceQ4RainChanceLow ?? 
    0
  );
  const r4RainHigh = Number(
    data.weather.raceQ4RainPHigh ?? 
    data.weather.raceQ4RainHigh ?? 
    data.weather.raceQ4RainChanceHigh ?? 
    0
  );
  const r4RainAvg = (r4RainLow + r4RainHigh) / 2;
  
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
    r1_rain_chance: Math.round(r1RainAvg),
    r2_rain_chance: Math.round(r2RainAvg),
    r3_rain_chance: Math.round(r3RainAvg),
    r4_rain_chance: Math.round(r4RainAvg),
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
    // 🔥 ADICIONADOS: Menu e Office para o perfil do gerente
    const [
      menuData,
      officeData,
      trackData,
      driverData,
      carData,
      staffData,
      tdData,
      qualifyData,
    ] = await Promise.all([
      fetchGproJson('Menu', token),
      fetchGproJson('Office', token),
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

    // ============================================
    // SPRINT 3A - SALVAR SNAPSHOTS (NÃO BLOQUEANTE)
    // ============================================
    const seasonRace = extractSeasonRace(qualifyData || trackData || carData || {});
    
    const snapshots = [
      { userId, endpoint: 'Menu', payload: menuData },
      { userId, endpoint: 'Office', payload: officeData },
      { userId, endpoint: 'TrackProfile', payload: trackData },
      { userId, endpoint: 'DriProfile', payload: driverData },
      { userId, endpoint: 'UpdateCar', payload: carData },
      { userId, endpoint: 'StaffAndFacilities', payload: staffData },
      { userId, endpoint: 'TDProfile', payload: tdData },
      { userId, endpoint: 'Qualify2', payload: qualifyData },
    ];

    if (testingData) {
      snapshots.push({ userId, endpoint: 'Testing', payload: testingData });
    }

    try {
      const results = await saveSnapshots(
        snapshots.map(s => ({
          ...s,
          season: seasonRace.season,
          race: seasonRace.race,
        }))
      );
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (failCount === 0) {
        console.log(`✅ ${successCount} snapshots salvos para usuário ${userId}`);
      } else {
        console.warn(`⚠️ ${successCount} snapshots salvos, ${failCount} falhas para usuário ${userId}`);
      }
    } catch (snapshotError) {
      console.error('⚠️ Erro ao salvar snapshots (continuando):', snapshotError);
    }

    // ============================================
    // MAPEAMENTO DOS DADOS
    // ============================================

    const mappedDriver = mapDriver(driverData);
    const mappedCar = mapCar(carData);
    const mappedTechDirector = tdData?.tdName
      ? mapTechDirector(tdData)
      : {
          rdMecanico: 0,
          rdEletronico: 0,
          rdAerodinamico: 0,
          experiencia: 0,
          pitCoord: 0,
        };
    const mappedWeather = mapWeather(qualifyData);
    const mappedTestPoints = mapTestPoints(carData);
    const mappedTesting = mapTesting(testingData);

    // ============================================
    // 🆕 DADOS DO MENU PARA O PERFIL DO GERENTE
    // ============================================
    const menuInfo = {
      IDM: menuData.IDM,
      fName: menuData.fName || '',
      lName: menuData.lName || '',
      natCode: menuData.natCode || 'br',
      group: menuData.group || 'Rookie - 1',
      groupShort: menuData.groupShort || 'R1',
      cash: menuData.cash || 0,
      credits: menuData.credits || 0,
      teamId: menuData.teamId || null,
      teamCredits: menuData.teamCredits || 0,
      champs: menuData.champs || 0,
      accStatus: menuData.accStatus || 'Activated',
      apiRequestsRemaining: menuData.apiRequestsRemaining || 0,
      driverId: menuData.driverId || null,
    };

    // ============================================
    // 🆕 DADOS DO OFFICE PARA A CORRIDA ATUAL
    // ============================================
    const officeInfo = {
      season: officeData.seasonNb || '0',
      race: officeData.raceNb || '0',
      track: officeData.trackName || '',
      trackId: officeData.trackId || '',
      points: officeData.pts || '0',
      position: officeData.pos || '0',
      average: officeData.avg || '0',
      champs: officeData.champs || '0',
      qual1Pos: officeData.qual1Pos || '-',
      qual2Pos: officeData.qual2Pos || '-',
      donePractice: officeData.donePractice || '0',
      doneQ1: officeData.doneQ1 || '0',
      doneQ2: officeData.doneQ2 || '0',
    };

    // ============================================
    // SALVAR NO user_state
    // ============================================
    try {
      const { error: updateError } = await supabase
        .from('user_state')
        .update({
          driver: mappedDriver,
          car: mappedCar,
          track: String(trackData.trackName ?? ''),
          staff: {
            toleranciaPressao: Number(staffData.stressHandling ?? 0),
            concentracao: Number(staffData.concentration ?? 0),
          },
          weather: mappedWeather,
          test_points: mappedTestPoints,
          tech_director: mappedTechDirector,
          // 🆕 NOVOS CAMPOS
          menu_data: menuInfo,
          office_data: officeInfo,
          last_sync_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erro ao atualizar user_state:', updateError);
        // Não retorna erro, apenas log
      } else {
        console.log('✅ user_state atualizado com sucesso');
      }
    } catch (updateError) {
      console.error('Erro ao salvar no user_state:', updateError);
    }

    // ============================================
    // RETORNAR RESPOSTA (compatível com o esperado)
    // ============================================

    return NextResponse.json({
      success: true,
      driver: mappedDriver,
      car: mappedCar,
      techDirector: mappedTechDirector,
      track: String(trackData.trackName ?? ''),
      staff: {
        toleranciaPressao: Number(staffData.stressHandling ?? 0),
        concentracao: Number(staffData.concentration ?? 0),
      },
      weather: mappedWeather,
      test_points: mappedTestPoints,
      testing: mappedTesting,
      // 🆕 DADOS ADICIONAIS (não quebram o frontend existente)
      menu: menuInfo,
      office: officeInfo,
      last_sync_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro no sync com GPRO:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao sincronizar com GPRO. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}