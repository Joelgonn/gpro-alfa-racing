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
// MAPEADORES DE DADOS GPRO - ENRIQUECIMENTO
// ============================================

// ========== DRIVER (DriProfile + Office + Menu) ==========
function mapDriver(data: GproJson, officeData: GproJson, menuData: GproJson) {
  // Fallback para o nome do piloto
  // Se driName for 0, undefined, null ou string vazia,
  // tenta buscar do Office (driName) ou do Menu (fName)
  const rawName = data.driName ?? officeData.driName ?? '';
  const nameValue = (rawName && rawName !== 0) ? rawName : (officeData.driName || menuData.fName || '');
  const name = String(nameValue);

  // Campos base (inglês)
  const novos = {
    name: name,
    nationality: String(data.natCode ?? ''),
    nationalityName: String(data.natName ?? ''),
    overall: Number(data.overall ?? 0),
    salary: String(officeData.driSalary ?? data.salary ?? '0'),
    racesLeft: String(officeData.driRacesLeft ?? data.racesLeft ?? '0'),
    trophies: Number(data.trophies ?? 0),
    races: Number(data.races ?? 0),
    wins: Number(data.wins ?? 0),
    podiums: Number(data.podiums ?? 0),
    points: Number(data.points ?? 0),
    poles: Number(data.poles ?? 0),
    fastLaps: Number(data.fastLaps ?? 0),
    driverId: menuData.driverId ? Number(menuData.driverId) : null,
  };

  // Campos existentes (português) - PRESERVADOS
  const existentes = {
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

  // Aliases (inglês) - facilitam migração gradual
  const aliases = {
    energy: existentes.energia,
    concentration: existentes.concentracao,
    talent: existentes.talento,
    aggressiveness: existentes.agressividade,
    experience: existentes.experiencia,
    techInsight: existentes.tecnica,
    stamina: existentes.resistencia,
    charisma: existentes.carisma,
    motivation: existentes.motivacao,
    reputation: existentes.reputacao,
    weight: existentes.peso,
    age: existentes.idade,
  };

  return {
    ...novos,
    ...existentes,
    ...aliases,
  };
}

// ========== TECH DIRECTOR (TDProfile + Office) ==========
function mapTechDirector(tdData: GproJson | null, officeData: GproJson) {
  // Campos base (inglês)
  const novos = {
    name: String(tdData?.tdName ?? officeData.tdName ?? ''),
    id: String(tdData?.tdId ?? officeData.tdId ?? ''),
    nationality: String(tdData?.tdNat ?? officeData.tdNat ?? ''),
    overall: String(tdData?.tdOA ?? officeData.tdOA ?? '0'),
    salary: String(tdData?.tdSalary ?? officeData.tdSalary ?? '0'),
    racesLeft: String(tdData?.tdRacesLeft ?? officeData.tdRacesLeft ?? '0'),
  };

  // Campos existentes (português) - PRESERVADOS
  const existentes = {
    rdMecanico: Number(tdData?.mechanics ?? 0),
    rdEletronico: Number(tdData?.electronics ?? 0),
    rdAerodinamico: Number(tdData?.aerodynamics ?? 0),
    experiencia: Number(tdData?.experience ?? 0),
    pitCoord: Number(tdData?.pitCoord ?? 0),
  };

  // Aliases (inglês) - facilitam migração gradual
  const aliases = {
    mechanics: existentes.rdMecanico,
    electronics: existentes.rdEletronico,
    aerodynamics: existentes.rdAerodinamico,
    experience: existentes.experiencia,
    pitCoord: existentes.pitCoord,
  };

  return {
    ...novos,
    ...existentes,
    ...aliases,
  };
}

// ========== MENU (Menu) ==========
function mapMenu(data: GproJson) {
  // Campos base (inglês)
  const novos = {
    id: Number(data.IDM ?? 0),
    firstName: String(data.fName ?? ''),
    lastName: String(data.lName ?? ''),
    fullName: `${String(data.fName ?? '')} ${String(data.lName ?? '')}`.trim(),
    nationality: String(data.natCode ?? 'br'),
    group: String(data.group ?? 'Rookie - 1'),
    groupShort: String(data.groupShort ?? 'R1'),
    cash: Number(data.cash ?? 0),
    credits: Number(data.credits ?? 0),
    champs: Number(data.champs ?? 0),
    teamId: data.teamId ? Number(data.teamId) : null,
    teamCredits: Number(data.teamCredits ?? 0),
    driverId: data.driverId ? Number(data.driverId) : null,
    status: String(data.accStatus ?? 'Activated'),
    apiRequestsRemaining: Number(data.apiRequestsRemaining ?? 0),
  };

  // Campos existentes - PRESERVADOS
  const existentes = {
    IDM: Number(data.IDM ?? 0),
    fName: String(data.fName ?? ''),
    lName: String(data.lName ?? ''),
    natCode: String(data.natCode ?? 'br'),
    accStatus: String(data.accStatus ?? 'Activated'),
  };

  return {
    ...novos,
    ...existentes,
  };
}

// ========== OFFICE (Office) ==========
function mapOffice(data: GproJson) {
  // Campos base (inglês)
  const novos = {
    season: String(data.seasonNb ?? '0'),
    race: String(data.raceNb ?? '0'),
    trackName: String(data.trackName ?? ''),
    trackId: String(data.trackId ?? ''),
    points: String(data.pts ?? '0'),
    position: String(data.pos ?? '0'),
    average: String(data.avg ?? '0'),
    qual1Position: String(data.qual1Pos ?? '-'),
    qual2Position: String(data.qual2Pos ?? '-'),
    donePractice: String(data.donePractice ?? '0'),
    doneQ1: String(data.doneQ1 ?? '0'),
    doneQ2: String(data.doneQ2 ?? '0'),
    doneTesting: String(data.doneTesting ?? '0'),
  };

  // Campos existentes - PRESERVADOS
  const existentes = {
    seasonNb: String(data.seasonNb ?? '0'),
    raceNb: String(data.raceNb ?? '0'),
    pts: String(data.pts ?? '0'),
    pos: String(data.pos ?? '0'),
    avg: String(data.avg ?? '0'),
    qual1Pos: String(data.qual1Pos ?? '-'),
    qual2Pos: String(data.qual2Pos ?? '-'),
  };

  return {
    ...novos,
    ...existentes,
  };
}

// ========== CAR (UpdateCar) - PRESERVADO ==========
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

// ========== WEATHER (Qualify2) - PRESERVADO ==========
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

// ========== TEST POINTS (Testing) - PRESERVADO ==========
function mapTestPoints(data: GproJson | null) {
  if (!data) {
    return {
      power: 0,
      handling: 0,
      accel: 0,
    };
  }

  const power = Number(data.TestPPoints ?? 0);
  const handling = Number(data.TestHPoints ?? 0);
  const accel = Number(data.TestAPoints ?? 0);
  
  return {
    power: power,
    handling: handling,
    accel: accel,
  };
}

// ========== TESTING (Testing) - PRESERVADO ==========
// NOTA: testing é retornado na API mas NÃO é salvo no banco
// pois não existe coluna testing_json na tabela user_state
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

// ========== STAFF (StaffAndFacilities) - PRESERVADO ==========
function mapStaff(data: GproJson) {
  return {
    toleranciaPressao: Number(data.stressHandling ?? 0),
    concentracao: Number(data.concentration ?? 0),
  };
}

// ========== TRACK (TrackProfile) - APENAS NOME ==========
// track é uma coluna string, não jsonb
function getTrackName(data: GproJson): string {
  return String(data.trackName ?? '');
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
      menuData,
      officeData,
      trackData,
      driverData,
      carData,
      staffData,
      tdData,
      qualifyData,
      testingData,
    ] = await Promise.all([
      fetchGproJson('Menu', token),
      fetchGproJson('Office', token),
      fetchGproJson('TrackProfile', token),
      fetchGproJson('DriProfile', token),
      fetchGproJson('UpdateCar', token),
      fetchGproJson('StaffAndFacilities', token),
      fetchGproJson('TDProfile', token),
      fetchGproJson('Qualify2', token),
      fetchGproJson('Testing', token).catch((error) => {
        console.warn('⚠️ Endpoint Testing indisponível, continuando sem dados de testes:', error.message);
        return null;
      }),
    ]);

    // ============================================
    // EXTRAIR SEASON E RACE - DO OFFICE
    // ============================================

    const seasonRace = {
      season: Number(officeData.seasonNb ?? 0),
      race: Number(officeData.raceNb ?? 0),
    };

    if (seasonRace.season && seasonRace.race) {
      console.log(`📅 Season ${seasonRace.season}, Race ${seasonRace.race} extraídos do Office`);
    } else {
      console.log(`⚠️ Season/Race não encontrados no Office`);
    }

    // ============================================
    // SPRINT 3A - SALVAR SNAPSHOTS (NÃO BLOQUEANTE)
    // ============================================

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
    // MAPEAMENTO DOS DADOS - ENRIQUECIMENTO
    // ============================================

    const menuDataEnriched = mapMenu(menuData);
    const driverDataEnriched = mapDriver(driverData, officeData, menuData);
    const techDirectorDataEnriched = mapTechDirector(tdData, officeData);
    const officeDataEnriched = mapOffice(officeData);
    const trackName = getTrackName(trackData);
    const carDataMapped = mapCar(carData);
    const weatherDataMapped = mapWeather(qualifyData);
    const testPointsDataMapped = mapTestPoints(testingData);
    const testingDataMapped = mapTesting(testingData);
    const staffDataMapped = mapStaff(staffData);
    const lastSyncAt = new Date().toISOString();

    // ============================================
    // SALVAR NO user_state - COM VALIDAÇÃO
    // ============================================

    try {
      const { error: updateError } = await supabase
        .from('user_state')
        .update({
          // Colunas existentes - ENRIQUECIDAS
          driver_json: driverDataEnriched,
          tech_director_json: techDirectorDataEnriched,
          menu_data: menuDataEnriched,
          office_data: officeDataEnriched,
          
          // Colunas existentes - PRESERVADAS
          car_json: carDataMapped,
          test_points_json: testPointsDataMapped,
          weather_data: weatherDataMapped,
          staff_facilities_json: staffDataMapped,
          
          // track (string) - atualizar com o nome da pista
          track: trackName,
          
          // NOTA: updated_at é atualizado automaticamente pelo trigger do Supabase
          // NOTA: last_import_at NÃO deve ser sobrescrito (é para importações manuais)
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erro ao atualizar user_state:', updateError);
        throw new Error(`Erro ao salvar user_state: ${updateError.message}`);
      }

      console.log('✅ user_state atualizado com sucesso');
      console.log(`📊 Driver: ${driverDataEnriched.name || 'N/A'}`);
      console.log(`📊 Tech Director: ${techDirectorDataEnriched.name || 'Nenhum'}`);
      console.log(`📊 Track: ${trackName}`);
      console.log(`📊 Office: Season ${officeDataEnriched.season}, Race ${officeDataEnriched.race}`);

    } catch (updateError) {
      console.error('Erro ao salvar no user_state:', updateError);
      return NextResponse.json(
        { error: updateError instanceof Error ? updateError.message : 'Erro ao salvar dados no banco' },
        { status: 500 }
      );
    }

    // ============================================
    // RESPOSTA DA API - COMPATIBILIDADE TOTAL
    // ============================================

    return NextResponse.json({
      success: true,
      
      // Campos existentes (frontend espera estes)
      driver: driverDataEnriched,
      car: carDataMapped,
      weather: weatherDataMapped,
      tech_director: techDirectorDataEnriched,
      staff: staffDataMapped,
      test_points: testPointsDataMapped,
      menu_data: menuDataEnriched,
      office_data: officeDataEnriched,
      track: trackName,
      
      // Campos adicionais (opcionais)
      testing: testingDataMapped,
      
      // Metadados
      last_sync_at: lastSyncAt,
    });

  } catch (error) {
    console.error('Erro no sync com GPRO:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao sincronizar com GPRO. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}