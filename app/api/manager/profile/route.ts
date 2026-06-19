// app/api/manager/profile/route.ts
// ============================================
// PERFIL DO GERENTE - COM DADOS DO user_state
// ============================================
// Estratégia:
// 1. Buscar menu_data e office_data do user_state (já salvos pelo sync)
// 2. Buscar driver_json e car_json do user_state (já salvos pelo sync)
// 3. Se 'refresh=true' ou se faltarem dados essenciais, buscar da GPRO (fallback/force)
// ============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const GPRO_LANG = 'br';
const GPRO_API_BASE = 'https://gpro.net';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// FETCH DA GPRO CORRIGIDO COM USER-AGENT DE NAVEGADOR
// ============================================

async function fetchGproJson(path: string, token: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${GPRO_API_BASE}/${GPRO_LANG}/backend/api/v2/${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText || response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout ao conectar com GPRO em ${path}`);
    }
    throw error;
  }
}

// ============================================
// MAPEADORES CORRIGIDOS - TODOS OS ATRIBUTOS
// ============================================

function mapDriver(data: any) {
  return {
    name: data.driName || data.name || '',
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
    salario: data.salary || data.driSalary || '0',
    racesLeft: data.racesLeft || data.driRacesLeft || '0',
  };
}

function mapCar(data: any) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  
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

// ============================================
// CACHE EM MEMÓRIA (5 minutos)
// ============================================

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutos

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';
    if (!refresh && cache.has(userId)) {
      const cached = cache.get(userId)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('✅ Dados do gerente obtidos do Cache de Memória');
        return NextResponse.json(cached.data);
      }
    }

    // Buscar dados gravados no user_state do Supabase
    const { data: userState, error: userStateError } = await supabase
      .from('user_state')
      .select('menu_data, office_data, driver_json, car_json, weather_data, gpro_token, last_import_at')
      .eq('user_id', userId)
      .single();

    if (userStateError) {
      console.error('Erro ao buscar user_state:', userStateError);
      return NextResponse.json(
        { error: 'Dados do usuário não encontrados.' },
        { status: 404 }
      );
    }

    // Verificação de consistência de dados no banco de dados
    const hasMenuData = userState?.menu_data && Object.keys(userState.menu_data).length > 0;
    const hasDriverData = userState?.driver_json && 
                          Object.keys(userState.driver_json).length > 0 && 
                          (userState.driver_json as any).concentracao !== undefined &&
                          (userState.driver_json as any).name !== undefined;

    const hasCarData = userState?.car_json && (Array.isArray(userState.car_json) ? userState.car_json.length > 0 : Object.keys(userState.car_json).length > 0);

    let menuData = userState?.menu_data || null;
    let officeData = userState?.office_data || null;
    let driverData = userState?.driver_json || null;
    let carData = userState?.car_json || null;
    let weatherData = userState?.weather_data || null;
    let fetchedFromGpro = false;

    // Força a busca da GPRO caso faltem campos críticos no BD ou se o usuário clicou em 'Sincronizar'
    const shouldFetchFromGpro = refresh || !hasMenuData || !hasDriverData || !hasCarData;

    if (shouldFetchFromGpro && userState?.gpro_token) {
      console.log('📡 Buscando dados atualizados diretamente da API GPRO...');
      try {
        const [freshMenu, freshOffice, freshDriver, freshCar, freshQualify] = await Promise.all([
          fetchGproJson('Menu', userState.gpro_token),
          fetchGproJson('Office', userState.gpro_token),
          fetchGproJson('DriProfile', userState.gpro_token),
          fetchGproJson('UpdateCar', userState.gpro_token),
          fetchGproJson('Qualify2', userState.gpro_token),
        ]);

        const menuInfo = {
          IDM: freshMenu.IDM,
          fName: freshMenu.fName || '',
          lName: freshMenu.lName || '',
          natCode: freshMenu.natCode || 'br',
          group: freshMenu.group || 'Rookie - 1',
          groupShort: freshMenu.groupShort || 'R1',
          cash: freshMenu.cash || 0,
          credits: freshMenu.credits || 0,
          teamId: freshMenu.teamId || null,
          teamCredits: freshMenu.teamCredits || 0,
          champs: freshMenu.champs || 0,
          accStatus: freshMenu.accStatus || 'Activated',
          apiRequestsRemaining: freshMenu.apiRequestsRemaining || 0,
          driverId: freshMenu.driverId || null,
        };

        const officeInfo = {
          season: freshOffice.seasonNb || '0',
          race: freshOffice.raceNb || '0',
          track: freshOffice.trackName || '',
          trackId: freshOffice.trackId || '',
          points: freshOffice.pts || '0',
          position: freshOffice.pos || '0',
          average: freshOffice.avg || '0',
          champs: freshOffice.champs || '0',
          qual1Pos: freshOffice.qual1Pos || '-',
          qual2Pos: freshOffice.qual2Pos || '-',
          donePractice: freshOffice.donePractice || '0',
          doneQ1: freshOffice.doneQ1 || '0',
          doneQ2: freshOffice.doneQ2 || '0',
        };

        const mappedDriver = mapDriver(freshDriver);
        const mappedCar = mapCar(freshCar);

        // Grava os novos dados no Supabase
        await supabase
          .from('user_state')
          .update({
            menu_data: menuInfo,
            office_data: officeInfo,
            driver_json: mappedDriver,
            car_json: mappedCar,
            weather_data: mapWeather(freshQualify),
            last_import_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        menuData = menuInfo;
        officeData = officeInfo;
        driverData = mappedDriver;
        carData = mappedCar;
        weatherData = mapWeather(freshQualify);
        fetchedFromGpro = true;
        console.log('✅ Base de dados remapeada e atualizada com sucesso');
      } catch (error: any) {
        console.error('❌ Falha ao buscar dados diretos da API GPRO:', error.message);
      }
    }

    if (!menuData || Object.keys(menuData).length === 0) {
      return NextResponse.json(
        { error: 'Dados do gerente não disponíveis. Faça a sincronização com a GPRO.' },
        { status: 404 }
      );
    }

    const menu = menuData || {};
    const office = officeData || {};
    const driver = driverData || {};
    const car = carData || [];

    const driverOA = Math.round(
      (Number(driver.talento || 0) +
       Number(driver.concentracao || 0) +
       Number(driver.agressividade || 0) +
       Number(driver.experiencia || 0) +
       Number(driver.tecnica || 0)) / 5
    );

    // ============================================
    // RESPOSTA COMPLETA COM TODOS OS ATRIBUTOS
    // ============================================
    const response = {
      success: true,
      source: fetchedFromGpro ? 'gpro-fallback' : 'database',
      lastSyncAt: userState?.last_import_at || null,
      manager: {
        id: menu.IDM || null,
        firstName: menu.fName || '',
        lastName: menu.lName || '',
        country: menu.natCode || 'br',
        group: menu.group || 'Rookie - 1',
        groupShort: menu.groupShort || 'R1',
        cash: menu.cash || 0,
        credits: menu.credits || 0,
        teamId: menu.teamId || null,
        teamCredits: menu.teamCredits || 0,
        champs: menu.champs || 0,
        accStatus: menu.accStatus || 'Activated',
        apiRequestsRemaining: menu.apiRequestsRemaining || 0,
        driverId: menu.driverId || null,
      },
      driver: {
        id: menu.driverId || null,
        name: driver.name || driver.driName || 'Não Contratado',
        // Core Attributes
        energy: driver.energia || 0,
        concentration: driver.concentracao || 0,
        talent: driver.talento || 0,
        aggressiveness: driver.agressividade || 0,
        experience: driver.experiencia || 0,
        // Extended Attributes
        technique: driver.tecnica || 0,
        stamina: driver.resistencia || 0,
        charisma: driver.carisma || 0,
        motivation: driver.motivacao || 0,
        reputation: driver.reputacao || 0,
        // Physical
        weight: driver.peso || 0,
        age: driver.idade || 0,
        overall: driverOA || driver.overall || 0,
        salary: driver.salario || driver.salary || '0',
        racesLeft: driver.racesLeft || '0',
      },
      car: Array.isArray(car) ? car.map((part: any) => ({
        name: part.name || 'N/A',
        lvl: part.lvl || 0,
        wear: part.wear || 0,
      })) : [],
      race: {
        season: office.season || '0',
        race: office.race || '0',
        track: office.track || '',
        trackId: office.trackId || '',
        points: office.points || '0',
        position: office.position || '0',
        average: office.average || '0',
        champs: office.champs || '0',
        qual1Pos: office.qual1Pos || '-',
        qual2Pos: office.qual2Pos || '-',
        donePractice: office.donePractice || '0',
        doneQ1: office.doneQ1 || '0',
        doneQ2: office.doneQ2 || '0',
      },
      weather: weatherData,
      timestamp: new Date().toISOString()
    };

    cache.set(userId, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Erro crítico no endpoint do gerente:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER WEATHER
// ============================================
function mapWeather(data: any) {
  if (!data?.weather) return null;
  
  return {
    tempQ1: Number(data.weather.q1Temp ?? 0),
    weatherQ1: String(data.weather.q1WeatherTransl ?? data.weather.q1Weather ?? 'Dry'),
    tempQ2: Number(data.weather.q2Temp ?? 0),
    weatherQ2: String(data.weather.q2WeatherTransl ?? data.weather.q2Weather ?? 'Dry'),
    weatherRace: (String(data.weather.q2WeatherTransl ?? data.weather.q2Weather ?? 'Dry') === 'Rain' || 
                  String(data.weather.q2WeatherTransl ?? data.weather.q2Weather ?? 'Dry') === 'Wet') ? 'Wet' : 'Dry',
    r1_temp_min: Number(data.weather.raceQ1TempLow ?? 0),
    r1_temp_max: Number(data.weather.raceQ1TempHigh ?? 0),
    r2_temp_min: Number(data.weather.raceQ2TempLow ?? 0),
    r2_temp_max: Number(data.weather.raceQ2TempHigh ?? 0),
    r3_temp_min: Number(data.weather.raceQ3TempLow ?? 0),
    r3_temp_max: Number(data.weather.raceQ3TempHigh ?? 0),
    r4_temp_min: Number(data.weather.raceQ4TempLow ?? 0),
    r4_temp_max: Number(data.weather.raceQ4TempHigh ?? 0),
    r1_rain_chance: Math.round((Number(data.weather.raceQ1RainPLow ?? 0) + Number(data.weather.raceQ1RainPHigh ?? 0)) / 2),
    r2_rain_chance: Math.round((Number(data.weather.raceQ2RainPLow ?? 0) + Number(data.weather.raceQ2RainPHigh ?? 0)) / 2),
    r3_rain_chance: Math.round((Number(data.weather.raceQ3RainPLow ?? 0) + Number(data.weather.raceQ3RainPHigh ?? 0)) / 2),
    r4_rain_chance: Math.round((Number(data.weather.raceQ4RainPLow ?? 0) + Number(data.weather.raceQ4RainPHigh ?? 0)) / 2),
  };
}