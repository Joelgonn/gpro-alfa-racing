import { NextRequest, NextResponse } from 'next/server';
import { saveSnapshots, saveSnapshot, getLatestSnapshot } from '@/app/lib/gpro-snapshot';
import { fetchGproJson, type GproJson } from '@/app/lib/gpro-gateway';
import { mapTesting } from '@/app/lib/gpro-testing';
import {
  MAX_SPONSOR_ENRICHMENTS_PER_SYNC,
  indexExistingSponsors,
  selectSponsorsForEnrichment,
  shouldRefreshAvailSponsors,
  buildSponsorRow,
  type ExistingSponsor,
  type GproSponsor,
  type GproSponsorDetail,
} from '@/app/lib/gpro-sponsors';
import type { Capture } from '@/app/lib/capture';
import { acquireAvailSponsorsClaim, releaseAvailSponsorsClaim } from '@/app/lib/gpro-sync-claim';
import { resolveUserId } from '@/app/lib/auth';
// PIX-015 — autorização centralizada (import GPRO é recurso Premium)
import { guardPremiumApi } from '@/app/lib/access/authorization';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getGproToken } from '@/app/lib/gpro-token';

// ============================================
// MAPEADORES DE DADOS GPRO - ENRIQUECIMENTO
// ============================================

// ========== DRIVER (DriProfile + Office + Menu) ==========
function mapDriver(data: GproJson, officeData: GproJson, menuData: GproJson) {
  // Fallback para o nome do piloto
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

  // Aliases (inglês)
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
  const novos = {
    name: String(tdData?.tdName ?? officeData.tdName ?? ''),
    id: String(tdData?.tdId ?? officeData.tdId ?? ''),
    nationality: String(tdData?.tdNat ?? officeData.tdNat ?? ''),
    overall: String(tdData?.tdOA ?? officeData.tdOA ?? '0'),
    salary: String(tdData?.tdSalary ?? officeData.tdSalary ?? '0'),
    racesLeft: String(tdData?.tdRacesLeft ?? officeData.tdRacesLeft ?? '0'),
  };

  const existentes = {
    rdMecanico: Number(tdData?.mechanics ?? 0),
    rdEletronico: Number(tdData?.electronics ?? 0),
    rdAerodinamico: Number(tdData?.aerodynamics ?? 0),
    experiencia: Number(tdData?.experience ?? 0),
    pitCoord: Number(tdData?.pitCoord ?? 0),
  };

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

// ========== CAR (UpdateCar) ==========
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

// ========== CARACTERÍSTICA (UpdateCar tPower/tHandl/tAccel) ==========
function mapCarCharacteristic(data: GproJson) {
  return {
    power: Number(data.tPower ?? 0),
    handling: Number(data.tHandl ?? 0),
    accel: Number(data.tAccel ?? 0),
  };
}

// ========== WEATHER (Qualify2) ==========
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

// ========== TEST POINTS (Testing) ==========
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

// ========== STAFF (StaffAndFacilities) ==========
function mapStaff(data: GproJson) {
  return {
    toleranciaPressao: Number(data.stressHandling ?? 0),
    concentracao: Number(data.concentration ?? 0),
  };
}

// ========== TRACK (TrackProfile) ==========
function getTrackName(data: GproJson): string {
  return String(data.trackName ?? '');
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  // ============================================
  // ALFA-010 - INSTRUMENTAÇÃO DE CONSUMO DE API
  // ============================================
  // Declaradas fora do try para permitir log estruturado também em falha.
  // NUNCA registrar token/headers.
  const syncStartedAt = Date.now();
  const syncRunId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const endpointCalls: Record<string, number> = {};
  let enrichedSponsorsCount = 0;
  let syncUserId: string | null = null;
  let syncSeasonRace: { season: number; race: number } | null = null;
  let apiRequestsRemaining: number | null = null;

  try {
    // PIX-015: sincronização com a GPRO exige acesso Premium (free → 403, admin → liberado).
    const denied = await guardPremiumApi();
    if (denied) return denied;

    // 1. Autenticação server-side (não confia em userId do cliente)
    let requestedUserId: string | null = null;
    // ALFA-010: flag opcional para forçar atualização de patrocinadores
    // (retrocompatível: ausente = comportamento otimizado padrão).
    let requestedRefreshSponsors = false;
    try {
      const body = await request.clone().json();
      requestedUserId = body.userId || body.user_id || null;
      requestedRefreshSponsors = body.refreshSponsors === true;
    } catch {
      // body vazio será tratado como sem ID solicitado
    }
    const userId = await resolveUserId(requestedUserId);
    syncUserId = userId;

    // 2. Conexão com Supabase (service role isolado)
    const supabase = supabaseAdmin;

    // 3. Buscar token do usuário (server-only, descriptografado, nunca exposto ao cliente)
    const token = await getGproToken(userId);

    if (!token) {
      return NextResponse.json(
        { error: 'Token GPRO não encontrado. Configure o token na página de integração.' },
        { status: 404 }
      );
    }

    // ============================================
    // ALFA-010 - INSTRUMENTAÇÃO DE CONSUMO DE API
    // ============================================
    const gpro = (path: string) => {
      const endpoint = path.split('?')[0];
      endpointCalls[endpoint] = (endpointCalls[endpoint] || 0) + 1;
      return fetchGproJson(path, token);
    };

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
      practiceData, // ✅ ADICIONADO - Buscar Practice para os totais
    ] = await Promise.all([
      gpro('Menu'),
      gpro('Office'),
      gpro('TrackProfile'),
      gpro('DriProfile'),
      gpro('UpdateCar'),
      gpro('StaffAndFacilities'),
      gpro('TDProfile'),
      gpro('Qualify2'),
      gpro('Testing').catch((error) => {
        console.warn('⚠️ Endpoint Testing indisponível, continuando sem dados de testes:', error.message);
        return null;
      }),
      gpro('Practice').catch((error) => {
        console.warn('⚠️ Endpoint Practice indisponível, continuando sem dados de totais:', error.message);
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
    syncSeasonRace = seasonRace;
    apiRequestsRemaining = Number.isFinite(Number(menuData?.apiRequestsRemaining))
      ? Number(menuData.apiRequestsRemaining)
      : null;

    if (seasonRace.season && seasonRace.race) {
      console.log(`📅 Season ${seasonRace.season}, Race ${seasonRace.race} extraídos do Office`);
    } else {
      console.log(`⚠️ Season/Race não encontrados no Office`);
    }

    // ============================================
    // SPRINT 3A - SALVAR SNAPSHOTS (NÃO BLOQUEANTE)
    // ============================================

    const snapshots: Capture[] = [
      { userId, endpoint: 'Menu', source: 'manager_sync', payload: menuData },
      { userId, endpoint: 'Office', source: 'manager_sync', payload: officeData },
      { userId, endpoint: 'TrackProfile', source: 'manager_sync', payload: trackData },
      { userId, endpoint: 'DriProfile', source: 'manager_sync', payload: driverData },
      { userId, endpoint: 'UpdateCar', source: 'manager_sync', payload: carData },
      { userId, endpoint: 'StaffAndFacilities', source: 'manager_sync', payload: staffData },
      { userId, endpoint: 'TDProfile', source: 'manager_sync', payload: tdData },
      { userId, endpoint: 'Qualify2', source: 'manager_sync', payload: qualifyData },
    ];

    if (testingData) {
      snapshots.push({ userId, endpoint: 'Testing', source: 'manager_sync', payload: testingData });
    }

    if (practiceData) {
      snapshots.push({ userId, endpoint: 'Practice', source: 'manager_sync', payload: practiceData });
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
    // ALFA-008.14 - SINCRONIZAÇÃO CATÁLOGO PATROCINADORES (NÃO BLOQUEANTE, IDEMPOTENTE)
    // ============================================
    // ALFA-010 - Otimização de consumo de API GPRO:
    //   - AvailSponsors: no máximo 1x por corrida (season/race). Fora disso,
    //     reutiliza o payload do último snapshot (0 chamadas GPRO);
    //   - exclusão mútua por claim persistente (gpro_sponsor_sync_state)
    //     evita refresh duplicado sob concorrência; `refreshSponsors` respeita
    //     o lock (se houver sync em andamento, a execução é adiada);
    //   - NegotiateSponsor: SOMENTE para patrocinadores sem categoria/país
    //     persistidos, com limite por sync;
    //   - valores já existentes nunca são sobrescritos por vazio/null.
    try {
      // Força explícita (sync manual completo). Retrocompatível: ausente = otimizado.
      const forceSponsorRefresh = requestedRefreshSponsors === true;

      const lastAvail = await getLatestSnapshot(userId, 'AvailSponsors');

      const shouldRefreshSponsors = shouldRefreshAvailSponsors({
        lastSeason: lastAvail?.season ?? null,
        lastRace: lastAvail?.race ?? null,
        season: seasonRace.season,
        race: seasonRace.race,
        force: forceSponsorRefresh,
      });

      let sponsorsList: GproSponsor[] = [];
      let sponsorsSyncDeferred = false;

      if (shouldRefreshSponsors) {
        // ALFA-010 - Exclusão mútua persistente: no máximo UM processo busca
        // AvailSponsors por (user_id, season, race), mesmo sob concorrência
        // entre instâncias serverless. O lock é liberado sempre ao final.
        const claim = await acquireAvailSponsorsClaim(userId, seasonRace.season, seasonRace.race);

        if (claim.status === 'busy') {
          sponsorsSyncDeferred = true;
          console.log('⏳ AvailSponsors já em sincronização por outra execução — adiando (0 chamadas GPRO)');
        } else {
          try {
            const availData = await gpro('AvailSponsors').catch((e: unknown) => {
              console.warn('⚠️ AvailSponsors indisponível:', e instanceof Error ? e.message : e);
              return null;
            });
            sponsorsList = Array.isArray(availData?.sponsors) ? availData.sponsors : [];

            if (availData && sponsorsList.length > 0) {
              await saveSnapshot({
                userId,
                endpoint: 'AvailSponsors',
                source: 'manager_sync',
                payload: availData,
                season: seasonRace.season,
                race: seasonRace.race,
              }).catch((e: unknown) => console.warn('⚠️ Falha ao salvar snapshot AvailSponsors:', e instanceof Error ? e.message : e));
              console.log(`📦 AvailSponsors: ${sponsorsList.length} patrocinadores encontrados`);
            }
          } finally {
            // Em sucesso, a dedup por corrida passa a ser feita pelo snapshot;
            // em falha/vazio, a liberação permite nova tentativa.
            await releaseAvailSponsorsClaim(userId, seasonRace.season, seasonRace.race, claim.token);
          }
        }
      } else {
        // Reutiliza o último snapshot: nenhuma chamada AvailSponsors nesta sync.
        sponsorsList = Array.isArray(lastAvail?.payload?.sponsors) ? lastAvail.payload.sponsors : [];
        console.log(`ℹ️ AvailSponsors reutilizado do snapshot (season ${lastAvail?.season}, race ${lastAvail?.race}) — 0 chamadas GPRO`);
      }

      if (sponsorsList.length > 0) {
        // Catálogo atual — leitura Supabase (sem custo de API GPRO).
        const sponsorIds = sponsorsList
          .map((s) => Number(s?.sponsorId))
          .filter((id) => Number.isFinite(id));

        const { data: existingRows, error: existingError } = await supabase
          .from('gpro_sponsors')
          .select('sponsor_id, name, country, category, finances, expectations, patience, reputation, image, negotiation')
          .in('sponsor_id', sponsorIds);

        if (existingError) {
          console.warn('⚠️ Erro ao ler gpro_sponsors (seguindo sem preservar existentes):', existingError.message);
        }

        const existingById = indexExistingSponsors((existingRows as ExistingSponsor[]) ?? []);
        const toEnrich = selectSponsorsForEnrichment(sponsorsList, existingById, MAX_SPONSOR_ENRICHMENTS_PER_SYNC);

        const detailsById = new Map<number, GproSponsorDetail>();
        await Promise.all(
          toEnrich.map(async (s) => {
            const detail = await gpro(`NegotiateSponsor?id=${s.sponsorId}`).catch(() => null);
            if (detail) detailsById.set(Number(s.sponsorId), detail as GproSponsorDetail);
          })
        );
        enrichedSponsorsCount = toEnrich.length;

        const allSponsors = sponsorsList
          .map((s) => buildSponsorRow(s, detailsById.get(Number(s.sponsorId)), existingById.get(Number(s.sponsorId))))
          .filter((row) => Number.isFinite(row.sponsor_id));

        if (allSponsors.length > 0) {
          const { error: upsertError } = await supabase
            .from('gpro_sponsors')
            .upsert(allSponsors, { onConflict: 'sponsor_id' });
          if (upsertError) console.warn('⚠️ Erro ao upsert gpro_sponsors:', upsertError.message);
          else console.log(`✅ gpro_sponsors upsert ${allSponsors.length} registros (${enrichedSponsorsCount} enriquecidos nesta sync)`);
        }
      } else if (sponsorsSyncDeferred) {
        console.log('ℹ️ Sincronização de patrocinadores adiada (execução concorrente em andamento)');
      } else {
        console.log('ℹ️ AvailSponsors vazio ou indisponível');
      }
    } catch (e: any) {
      console.warn('⚠️ Falha sincronização patrocinadores (não bloqueante):', e?.message);
    }

    // ============================================
    // MAPEAMENTO DOS DADOS - SEPARADOS
    // ============================================

    const menuDataEnriched = mapMenu(menuData);
    const driverDataEnriched = mapDriver(driverData, officeData, menuData);
    
    // ✅ DADOS IMUTÁVEIS DO PILOTO (NUNCA MUDAM)
    const driverStatic = {
      name: driverDataEnriched.name || '',
      nationality: driverDataEnriched.nationality || '',
      nationalityName: driverDataEnriched.nationalityName || '',
      overall: driverDataEnriched.overall || 0,
      salary: driverDataEnriched.salary || '0',
      racesLeft: driverDataEnriched.racesLeft || '0',
      driverId: driverDataEnriched.driverId || null,
      trophies: driverDataEnriched.trophies || 0,
      races: driverDataEnriched.races || 0,
      wins: driverDataEnriched.wins || 0,
      podiums: driverDataEnriched.podiums || 0,
      points: driverDataEnriched.points || 0,
      poles: driverDataEnriched.poles || 0,
      fastLaps: driverDataEnriched.fastLaps || 0,
    };
    
    // ✅ DADOS EDITÁVEIS DO PILOTO (PODEM MUDAR)
    const driverEditable = {
      concentracao: driverDataEnriched.concentracao || 0,
      talento: driverDataEnriched.talento || 0,
      agressividade: driverDataEnriched.agressividade || 0,
      experiencia: driverDataEnriched.experiencia || 0,
      tecnica: driverDataEnriched.tecnica || 0,
      resistencia: driverDataEnriched.resistencia || 0,
      carisma: driverDataEnriched.carisma || 0,
      motivacao: driverDataEnriched.motivacao || 0,
      reputacao: driverDataEnriched.reputacao || 0,
      peso: driverDataEnriched.peso || 0,
      idade: driverDataEnriched.idade || 0,
      energia: driverDataEnriched.energia || 0,
    };
    
    const techDirectorDataEnriched = mapTechDirector(tdData, officeData);
    const officeDataEnriched = mapOffice(officeData);
    const trackName = getTrackName(trackData);
    const carDataMapped = mapCar(carData);
    const carCharacteristicMapped = mapCarCharacteristic(carData);
    const weatherDataMapped = mapWeather(qualifyData);
    const testPointsDataMapped = mapTestPoints(testingData);
    const testingDataMapped = mapTesting(testingData);
    const staffDataMapped = mapStaff(staffData);
    const lastSyncAt = new Date().toISOString();

    // ============================================
    // EXTRAIR TOTAIS DO CARRO - DO PRACTICE (CORRIGIDO)
    // ============================================

    // ✅ Buscar do Practice, não do Office
    const carTotals = {
      power: Number(practiceData?.carPower ?? 0),
      handling: Number(practiceData?.carHandl ?? 0),
      accel: Number(practiceData?.carAccel ?? 0),
    };

    console.log('📊 Practice Data - carPower:', practiceData?.carPower);
    console.log('📊 Practice Data - carHandl:', practiceData?.carHandl);
    console.log('📊 Practice Data - carAccel:', practiceData?.carAccel);
    console.log('📊 Car Totals extraídos do Practice:', carTotals);

    // ============================================
    // SALVAR NO user_state - SEPARADO
    // ============================================

    try {
      const { error: updateError } = await supabase
        .from('user_state')
        .update({
          // ✅ DADOS IMUTÁVEIS (NUNCA SOBRESCRITOS)
          driver_static: driverStatic,
          
          // ✅ DADOS EDITÁVEIS (PODEM SER SOBRESCRITOS)
          driver_editable: driverEditable,
          
          // Outros dados
          tech_director_json: techDirectorDataEnriched,
          menu_data: menuDataEnriched,
          office_data: officeDataEnriched,
          car_json: carDataMapped,
          car_characteristic: carCharacteristicMapped,
          test_points_json: testPointsDataMapped,
          weather_data: weatherDataMapped,
          staff_facilities_json: staffDataMapped,
          track: trackName,
          
          // ✅ TOTAIS DO CARRO (AGORA DO PRACTICE)
          car_totals: carTotals,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erro ao atualizar user_state:', updateError);
        throw new Error(`Erro ao salvar user_state: ${updateError.message}`);
      }

      console.log('✅ user_state atualizado com sucesso');
      console.log(`📊 Driver Static (imutável): ${driverStatic.name}`);
      console.log(`📊 Driver Editable (mutável): energia=${driverEditable.energia}, concentracao=${driverEditable.concentracao}`);
      console.log(`📊 Tech Director: ${techDirectorDataEnriched.name || 'Nenhum'}`);
      console.log(`📊 Track: ${trackName}`);
      console.log(`📊 Office: Season ${officeDataEnriched.season}, Race ${officeDataEnriched.race}`);
      console.log(`📊 Car Characteristic (tPower/tHandl/tAccel): ${JSON.stringify(carCharacteristicMapped)}`);
      console.log(`📊 Car Totals salvos (do Practice): ${JSON.stringify(carTotals)}`);

    } catch (updateError) {
      console.error('Erro ao salvar no user_state:', updateError);
      return NextResponse.json(
        { error: updateError instanceof Error ? updateError.message : 'Erro ao salvar dados no banco' },
        { status: 500 }
      );
    }

    // ============================================
    // RESPOSTA DA API
    // ============================================

    // ALFA-010 - Log estruturado de consumo (diagnóstico da franquia GPRO).
    // Observação: apiRequestsRemaining é o valor retornado pelo Menu APÓS as
    // chamadas desta sync; não representa o delta exato consumido.
    const totalGproCalls = Object.values(endpointCalls).reduce((sum, n) => sum + n, 0);
    console.log('📊 [gpro-sync]', JSON.stringify({
      syncRunId,
      userId: syncUserId,
      season: syncSeasonRace?.season ?? null,
      race: syncSeasonRace?.race ?? null,
      endpointCalls,
      totalGproCalls,
      enrichedSponsors: enrichedSponsorsCount,
      apiRequestsRemaining,
      durationMs: Date.now() - syncStartedAt,
      result: 'success',
    }));

    return NextResponse.json({
      success: true,
      driver_static: driverStatic,
      driver_editable: driverEditable,
      car: carDataMapped,
      car_characteristic: carCharacteristicMapped,
      weather: weatherDataMapped,
      tech_director: techDirectorDataEnriched,
      staff: staffDataMapped,
      test_points: testPointsDataMapped,
      menu_data: menuDataEnriched,
      office_data: officeDataEnriched,
      track: trackName,
      testing: testingDataMapped,
      last_sync_at: lastSyncAt,
    });

  } catch (error: any) {
    if (error?.status === 401) {
      return NextResponse.json({ error: error.message || 'Não autenticado' }, { status: 401 });
    }
    if (error?.status === 403) {
      return NextResponse.json({ error: error.message || 'Acesso negado' }, { status: 403 });
    }
    const totalGproCalls = Object.values(endpointCalls).reduce((sum, n) => sum + n, 0);
    console.log('📊 [gpro-sync]', JSON.stringify({
      syncRunId,
      userId: syncUserId,
      season: syncSeasonRace?.season ?? null,
      race: syncSeasonRace?.race ?? null,
      endpointCalls,
      totalGproCalls,
      enrichedSponsors: enrichedSponsorsCount,
      apiRequestsRemaining,
      durationMs: Date.now() - syncStartedAt,
      result: 'error',
      error: error instanceof Error ? error.message : String(error),
    }));
    console.error('Erro no sync com GPRO:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao sincronizar com GPRO. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}
