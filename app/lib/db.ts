import { createClient } from '@supabase/supabase-js';
import { Driver, CarPart, TechDirector, StaffFacilities, WeatherData } from '@/app/context/GameContext';

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
  test_points: {
    power: number;
    handling: number;
    accel: number;
  };
  race_options: any;
  weather: WeatherData;
  desgasteModifier: number;
  // NOVO CAMPO: Banco de dados de patrocinadores salvos
  sponsors_database: any[]; 
}

// --- VALORES PADRÃO (FALLBACKS) ---
const DEFAULT_DRIVER: Driver = {
    concentracao: 150, talento: 200, agressividade: 0, experiencia: 50, tecnica: 50,
    resistencia: 50, carisma: 50, motivacao: 10, reputacao: 0, peso: 65, idade: 20, energia: 100, total: 0
};

const DEFAULT_CAR: CarPart[] = [
    { name: "Chassi", lvl: 1, wear: 0 }, { name: "Motor", lvl: 1, wear: 0 },
    { name: "Asa dianteira", lvl: 1, wear: 0 }, { name: "Asa traseira", lvl: 1, wear: 0 },
    { name: "Assoalho", lvl: 1, wear: 0 }, { name: "Laterais", lvl: 1, wear: 0 },
    { name: "Radiador", lvl: 1, wear: 0 }, { name: "Câmbio", lvl: 1, wear: 0 },
    { name: "Freios", lvl: 1, wear: 0 }, { name: "Suspensão", lvl: 1, wear: 0 },
    { name: "Eletrônicos", lvl: 1, wear: 0 },
];

const DEFAULT_TECH_DIRECTOR: TechDirector = {
    rdMecanico: 0, rdEletronico: 0, rdAerodinamico: 0, experiencia: 0, pitCoord: 0
};

const DEFAULT_STAFF: StaffFacilities = {
    toleranciaPressao: 0, concentracao: 0
};

const DEFAULT_WEATHER: WeatherData = {
    tempQ1: 20, weatherQ1: 'Dry', tempQ2: 20, weatherQ2: 'Dry', weatherRace: 'Dry',
    r1_temp_min: 20, r1_temp_max: 20, r2_temp_min: 20, r2_temp_max: 20,
    r3_temp_min: 20, r3_temp_max: 20, r4_temp_min: 20, r4_temp_max: 20,
};

/**
 * Busca o estado completo do usuário no Supabase.
 */
export async function getUserState(userId: string): Promise<UserState> {
    if (!userId) throw new Error("UserID é obrigatório");

    const { data, error } = await supabase
        .from('user_state')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return {
            role: 'user',
            track: 'Selecionar Pista',
            driver: DEFAULT_DRIVER,
            car: DEFAULT_CAR,
            tech_director: DEFAULT_TECH_DIRECTOR,
            staff_facilities: DEFAULT_STAFF,
            test_points: { power: 0, handling: 0, accel: 0 },
            race_options: {},
            weather: DEFAULT_WEATHER,
            desgasteModifier: 0,
            sponsors_database: [] // Inicializa vazio
        };
    }

    return {
        role: data.role || 'user',
        track: data.track || 'Interlagos',
        driver: data.driver_json || DEFAULT_DRIVER,
        car: data.car_json || DEFAULT_CAR,
        tech_director: data.tech_director_json || DEFAULT_TECH_DIRECTOR,
        staff_facilities: data.staff_facilities_json || DEFAULT_STAFF,
        test_points: data.test_points_json || { power: 0, handling: 0, accel: 0 },
        race_options: data.race_options_json || {},
        weather: data.weather_data || DEFAULT_WEATHER,
        desgasteModifier: data.desgaste_modifier || 0,
        // Mapeia a coluna do banco para a propriedade do código
        sponsors_database: data.sponsors_database_json || [],
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

    // Mapeamento manual para colunas do Banco de Dados
    if (data.track !== undefined) payload.track = data.track;
    if (data.driver) payload.driver_json = data.driver;
    if (data.car) payload.car_json = data.car;
    if (data.tech_director) payload.tech_director_json = data.tech_director;
    if (data.staff_facilities) payload.staff_facilities_json = data.staff_facilities;
    if (data.test_points) payload.test_points_json = data.test_points;
    if (data.race_options) payload.race_options_json = data.race_options;
    if (data.weather) payload.weather_data = data.weather;
    if (data.desgasteModifier !== undefined) payload.desgaste_modifier = data.desgasteModifier;
    
    // Sincroniza o banco de patrocinadores com a coluna correta no Supabase
    if (data.sponsors_database) {
        payload.sponsors_database_json = data.sponsors_database;
    }

    const { error } = await supabase
        .from('user_state')
        .upsert(payload, { onConflict: 'user_id' });

    if (error) {
        console.error("Erro ao salvar no Supabase:", error.message);
        throw new Error(`Falha ao salvar estado: ${error.message}`);
    }
}