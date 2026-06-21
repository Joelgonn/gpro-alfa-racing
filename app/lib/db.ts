import { createClient } from '@supabase/supabase-js';
import { Driver, CarPart, TechDirector, StaffFacilities, WeatherData, MenuData, OfficeData } from '@/app/context/GameContext';
import { EnergyCoefficients, DEFAULT_COEFFS } from '@/app/services/engine/regressionEngine';

// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- INTERFACE DO ESTADO DO USUÁRIO ---
export interface UserState {
  role: 'admin' | 'user';
  track: string;
  driver: Driver;
  car: CarPart[];
  tech_director: TechDirector;
  staff_facilities: StaffFacilities;
  test_points: { power: number; handling: number; accel: number; };
  race_options: any;
  weather: WeatherData;
  desgasteModifier: number;
  sponsors_database: any[]; 
  energy_coeffs: EnergyCoefficients;
  
  // ============================================
  // NOVOS CAMPOS: Dados enriquecidos do GPRO
  // ============================================
  menu_data: MenuData | null;
  office_data: OfficeData | null;
  
  // Snapshot da última importação GPRO
  last_import_snapshot?: {
    driver: Driver;
    car: CarPart[];
    tech_director: TechDirector;
    staff_facilities: StaffFacilities;
    weather: WeatherData;
    track: string;
    test_points?: {
      power: number;
      handling: number;
      accel: number;
    };
  } | null;
  last_import_at?: string | null;
}

// ============================================
// VALORES PADRÃO - ATUALIZADOS COM CAMPOS ENRIQUECIDOS
// ============================================

/**
 * Driver padrão com todos os campos necessários.
 * Inclui campos legados (português) e campos enriquecidos (inglês).
 */
const DEFAULT_DRIVER: Driver & {
  name?: string;
  nationality?: string;
  nationalityName?: string;
  overall?: number;
  salary?: string;
  racesLeft?: string;
  trophies?: number;
  races?: number;
  wins?: number;
  podiums?: number;
  points?: number;
  poles?: number;
  fastLaps?: number;
  driverId?: number | null;
  energy?: number;
  concentration?: number;
  talent?: number;
  aggressiveness?: number;
  experience?: number;
  techInsight?: number;
  stamina?: number;
  charisma?: number;
  motivation?: number;
  reputation?: number;
  weight?: number;
  age?: number;
} = {
  // Campos existentes (português) - PRESERVADOS
  concentracao: 150,
  talento: 200,
  agressividade: 0,
  experiencia: 50,
  tecnica: 50,
  resistencia: 50,
  carisma: 50,
  motivacao: 10,
  reputacao: 0,
  peso: 65,
  idade: 20,
  energia: 100,
  total: 0,
  
  // Campos enriquecidos (inglês) - NOVOS
  name: '',
  nationality: '',
  nationalityName: '',
  overall: 0,
  salary: '0',
  racesLeft: '0',
  trophies: 0,
  races: 0,
  wins: 0,
  podiums: 0,
  points: 0,
  poles: 0,
  fastLaps: 0,
  driverId: null,
  
  // Aliases (inglês) - facilitam migração gradual
  energy: 100,
  concentration: 150,
  talent: 200,
  aggressiveness: 0,
  experience: 50,
  techInsight: 50,
  stamina: 50,
  charisma: 50,
  motivation: 10,
  reputation: 0,
  weight: 65,
  age: 20,
};

const DEFAULT_CAR: CarPart[] = [
    { name: "Chassi", lvl: 1, wear: 0 }, { name: "Motor", lvl: 1, wear: 0 },
    { name: "Asa dianteira", lvl: 1, wear: 0 }, { name: "Asa traseira", lvl: 1, wear: 0 },
    { name: "Assoalho", lvl: 1, wear: 0 }, { name: "Laterais", lvl: 1, wear: 0 },
    { name: "Radiador", lvl: 1, wear: 0 }, { name: "Câmbio", lvl: 1, wear: 0 },
    { name: "Freios", lvl: 1, wear: 0 }, { name: "Suspensão", lvl: 1, wear: 0 },
    { name: "Eletrônicos", lvl: 1, wear: 0 },
];

const DEFAULT_TECH_DIRECTOR: TechDirector & {
  name?: string;
  id?: string;
  nationality?: string;
  overall?: string;
  salary?: string;
  racesLeft?: string;
  mechanics?: number;
  electronics?: number;
  aerodynamics?: number;
  experience?: number;
  pitCoord?: number;
} = {
  rdMecanico: 0,
  rdEletronico: 0,
  rdAerodinamico: 0,
  experiencia: 0,
  pitCoord: 0,
  // Campos enriquecidos
  name: '',
  id: '',
  nationality: '',
  overall: '0',
  salary: '0',
  racesLeft: '0',
  mechanics: 0,
  electronics: 0,
  aerodynamics: 0,
  experience: 0,
};

// ============================================
// HELPER: Merge de Driver com fallback
// ============================================

function mergeDriver(dbDriver: any): Driver {
  if (!dbDriver || typeof dbDriver !== 'object') {
    return DEFAULT_DRIVER as Driver;
  }

  const merged = {
    ...DEFAULT_DRIVER,
    ...dbDriver,
  };

  const enrichedFields = [
    'name', 'nationality', 'nationalityName', 'overall', 'salary',
    'racesLeft', 'trophies', 'races', 'wins', 'podiums',
    'points', 'poles', 'fastLaps', 'driverId'
  ];
  
  // Coerção de tipos explícita para evitar erro de indexação dinâmica do TS
  const mergedObj = merged as Record<string, any>;
  const defaultDriverObj = DEFAULT_DRIVER as Record<string, any>;

  for (const field of enrichedFields) {
    if (mergedObj[field] === undefined) {
      mergedObj[field] = defaultDriverObj[field];
    }
  }

  return merged as Driver;
}

// ============================================
// HELPER: Merge de TechDirector com fallback
// ============================================

function mergeTechDirector(dbTechDirector: any): TechDirector {
  if (!dbTechDirector || typeof dbTechDirector !== 'object') {
    return DEFAULT_TECH_DIRECTOR as TechDirector;
  }

  const merged = {
    ...DEFAULT_TECH_DIRECTOR,
    ...dbTechDirector,
  };

  const enrichedFields = ['name', 'id', 'nationality', 'overall', 'salary', 'racesLeft'];
  
  // Coerção de tipos explícita para evitar erro de indexação dinâmica do TS
  const mergedObj = merged as Record<string, any>;
  const defaultTDObj = DEFAULT_TECH_DIRECTOR as Record<string, any>;

  for (const field of enrichedFields) {
    if (mergedObj[field] === undefined) {
      mergedObj[field] = defaultTDObj[field];
    }
  }

  return merged as TechDirector;
}

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

/**
 * Busca o estado completo do usuário no Supabase.
 */
export async function getUserState(userId: string): Promise<UserState> {
    if (!userId) throw new Error("UserID é obrigatório");

    const { data, error } = await supabase
        .from('user_state')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) {
        return {
            role: 'user',
            track: 'Selecionar Pista',
            driver: DEFAULT_DRIVER as Driver,
            car: DEFAULT_CAR,
            tech_director: DEFAULT_TECH_DIRECTOR as TechDirector,
            staff_facilities: { toleranciaPressao: 0, concentracao: 0 },
            test_points: { power: 0, handling: 0, accel: 0 },
            race_options: {},
            weather: {
                tempQ1: 20, weatherQ1: 'Dry', tempQ2: 20, weatherQ2: 'Dry', weatherRace: 'Dry',
                r1_temp_min: 20, r1_temp_max: 20, r2_temp_min: 20, r2_temp_max: 20,
                r3_temp_min: 20, r3_temp_max: 20, r4_temp_min: 20, r4_temp_max: 20,
                r1_rain_chance: 0, r2_rain_chance: 0, r3_rain_chance: 0, r4_rain_chance: 0,
            },
            desgasteModifier: 0,
            sponsors_database: [],
            energy_coeffs: DEFAULT_COEFFS,
            menu_data: null,
            office_data: null,
            last_import_snapshot: null,
            last_import_at: null,
        };
    }

    const driver = mergeDriver(data.driver_json);
    const techDirector = mergeTechDirector(data.tech_director_json);

    console.log('🔍 [db.ts] Driver após merge:', {
        name: driver.name,
        overall: driver.overall,
        driverId: driver.driverId,
        concentracao: driver.concentracao,
        energia: driver.energia,
        hasName: !!driver.name,
    });

    return {
        role: data.role || 'user',
        track: data.track || 'Interlagos',
        driver: driver,
        car: data.car_json || DEFAULT_CAR,
        tech_director: techDirector,
        staff_facilities: data.staff_facilities_json || { toleranciaPressao: 0, concentracao: 0 },
        test_points: data.test_points_json || { power: 0, handling: 0, accel: 0 },
        race_options: data.race_options_json || {},
        weather: data.weather_data || {
                tempQ1: 20, weatherQ1: 'Dry', tempQ2: 20, weatherQ2: 'Dry', weatherRace: 'Dry',
                r1_temp_min: 20, r1_temp_max: 20, r2_temp_min: 20, r2_temp_max: 20,
                r3_temp_min: 20, r3_temp_max: 20, r4_temp_min: 20, r4_temp_max: 20,
                r1_rain_chance: 0, r2_rain_chance: 0, r3_rain_chance: 0, r4_rain_chance: 0,
            },
        desgasteModifier: data.desgaste_modifier || 0,
        sponsors_database: data.sponsors_database_json || [],
        energy_coeffs: data.energy_coeffs_json || DEFAULT_COEFFS,
        menu_data: data.menu_data || null,
        office_data: data.office_data || null,
        last_import_snapshot: data.last_import_snapshot || null,
        last_import_at: data.last_import_at || null,
    };
}

/**
 * Salva ou atualiza os dados do usuário no Supabase.
 */
export async function saveUserState(userId: string, data: Partial<UserState>) {
    if (!userId) throw new Error("UserID é obrigatório para salvar");

    const payload: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
    };

    if (data.track !== undefined) payload.track = data.track;
    if (data.driver) payload.driver_json = data.driver;
    if (data.car) payload.car_json = data.car;
    if (data.tech_director) payload.tech_director_json = data.tech_director;
    if (data.staff_facilities) payload.staff_facilities_json = data.staff_facilities;
    if (data.test_points) payload.test_points_json = data.test_points;
    if (data.race_options) payload.race_options_json = data.race_options;
    if (data.weather) payload.weather_data = data.weather;
    if (data.desgasteModifier !== undefined) payload.desgaste_modifier = data.desgasteModifier;
    if (data.sponsors_database) payload.sponsors_database_json = data.sponsors_database;
    if (data.energy_coeffs) payload.energy_coeffs_json = data.energy_coeffs;
    
    if (data.menu_data !== undefined) payload.menu_data = data.menu_data;
    if (data.office_data !== undefined) payload.office_data = data.office_data;
    
    if (data.last_import_snapshot !== undefined) payload.last_import_snapshot = data.last_import_snapshot;
    if (data.last_import_at !== undefined) payload.last_import_at = data.last_import_at;

    const { error } = await supabase
        .from('user_state')
        .upsert(payload, { onConflict: 'user_id' });

    if (error) {
        console.error("Erro ao salvar no Supabase:", error.message);
        throw new Error(`Falha ao salvar estado: ${error.message}`);
    }
}