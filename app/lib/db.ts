// --- START OF FILE app/lib/db.ts ---
import { createClient } from '@supabase/supabase-js';
import { 
  Driver, CarPart, WeatherData, TechDirector, StaffFacilities // Importando os novos tipos
} from '@/app/context/GameContext'; // Ajuste o caminho se necessário para o seu GameContext

// Inicializa o cliente Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey); // Exportar supabase se for usado fora deste arquivo

// ---> PASSO 1: DEFINIR A INTERFACE PARA O ESTADO DO USUÁRIO
// Este é o "contrato" que diz ao TypeScript como é a estrutura do nosso objeto.
export interface UserState {
  role: 'admin' | 'user';
  track: string;
  driver: Driver; // Usando o tipo Driver importado
  car: CarPart[];  // Usando o tipo CarPart importado
  test_points: { power: number; handling: number; accel: number; }; // Tipo mais específico
  race_options?: { // Pode ser mais específico se você tiver a tipagem RaceOptions (do StrategyPage)
    desgaste_pneu_percent: number;
    condicao: string;
    pneus_fornecedor: string;
    tipo_pneu: string;
    pitstops_num: number;
    ct_valor: number;
    avg_temp: number;
    boost_laps?: any; // Assumindo 'any' para BoostLapsInput e PersonalStintsInput por simplicidade aqui
    personal_stint_voltas?: any;
  };
  weather?: WeatherData; // Usando o tipo WeatherData importado
  desgasteModifier?: number;

  // --- NOVAS PROPRIEDADES ADICIONADAS AQUI ---
  tech_director?: TechDirector;    // Usando o tipo TechDirector importado
  staff_facilities?: StaffFacilities; // Usando o tipo StaffFacilities importado
  // ------------------------------------------
}

// --- VALORES PADRÃO (MOCK) ---
const DEFAULT_DRIVER: Driver = {
    concentracao: 150, talento: 200, agressividade: 0, experiencia: 50,
    tecnica: 50, resistencia: 50, carisma: 50, motivacao: 10,
    reputacao: 0, peso: 65, idade: 20, energia: 100, total: 0 // 'total' foi adicionado no GameContext
};

const DEFAULT_CAR: CarPart[] = [
  { name: "Chassi", lvl: 1, wear: 0 }, { name: "Motor", lvl: 1, wear: 0 },
  { name: "Asa dianteira", lvl: 1, wear: 0 }, { name: "Asa traseira", lvl: 1, wear: 0 },
  { name: "Assoalho", lvl: 1, wear: 0 }, { name: "Laterais", lvl: 1, wear: 0 },
  { name: "Radiador", lvl: 1, wear: 0 }, { name: "Câmbio", lvl: 1, wear: 0 },
  { name: "Freios", lvl: 1, wear: 0 }, { name: "Suspensão", lvl: 1, wear: 0 },
  { name: "Eletronicos", lvl: 1, wear: 0 },
];

const DEFAULT_TEST_POINTS = { power: 0, handling: 0, accel: 0 };

const DEFAULT_RACE_OPTIONS = {
    desgaste_pneu_percent: 18, condicao: "Dry", pneus_fornecedor: "Pipirelli", tipo_pneu: "Medium", pitstops_num: 2, ct_valor: 0, avg_temp: 0,
    boost_laps: { boost1: { volta: null }, boost2: { volta: null }, boost3: { volta: null } },
    personal_stint_voltas: { stint1: null, stint2: null, stint3: null, stint4: null, stint5: null, stint6: null, stint7: null, stint8: null }
};

const DEFAULT_WEATHER: WeatherData = {
    tempQ1: 0, weatherQ1: 'Dry', tempQ2: 0, weatherQ2: 'Dry', weatherRace: 'Dry',
    r1_temp_min: 0, r1_temp_max: 0, r2_temp_min: 0, r2_temp_max: 0,
    r3_temp_min: 0, r3_temp_max: 0, r4_temp_min: 0, r4_temp_max: 0,
};

// --- NOVOS VALORES PADRÃO ---
const DEFAULT_TECH_DIRECTOR: TechDirector = { 
  rdMecanico: 0, rdEletronico: 0, rdAerodinamico: 0, experiencia: 0, pitCoord: 0 
};

const DEFAULT_STAFF_FACILITIES: StaffFacilities = { 
  toleranciaPressao: 0, concentracao: 0 
};
// ----------------------------


/**
 * Busca o estado do usuário no Supabase.
 */
// ---> PASSO 2: USAR A INTERFACE NO RETORNO DA FUNÇÃO
export async function getUserState(userId: string): Promise<UserState> {
    if (!userId) throw new Error("UserID é obrigatório");

    const { data, error } = await supabase
        .from('user_states') // Nome da sua tabela de estados
        .select('*') // Seleciona todas as colunas
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 significa que nenhuma linha foi encontrada
        console.error("Erro ao buscar user_state:", error.message);
        // Retorna um estado padrão com os defaults
        return {
            role: 'user',
            track: 'Selecionar Pista',
            driver: DEFAULT_DRIVER,
            car: DEFAULT_CAR,
            test_points: DEFAULT_TEST_POINTS,
            race_options: DEFAULT_RACE_OPTIONS,
            weather: DEFAULT_WEATHER,
            desgasteModifier: 0,
            tech_director: DEFAULT_TECH_DIRECTOR,    // Default para o novo campo
            staff_facilities: DEFAULT_STAFF_FACILITIES // Default para o novo campo
        };
    }

    // Retorna os dados do banco, fazendo fallback para os padrões se o campo for nulo/indefinido
    return {
        role: data?.role || 'user',
        track: data?.track || 'Selecionar Pista',
        driver: data?.driver_json || DEFAULT_DRIVER,
        car: data?.car_json || DEFAULT_CAR,
        test_points: data?.test_points_json || DEFAULT_TEST_POINTS,
        race_options: data?.race_options_json || DEFAULT_RACE_OPTIONS,
        weather: data?.weather_data || DEFAULT_WEATHER,
        desgasteModifier: data?.desgaste_modifier || 0,
        tech_director: data?.tech_director_json || DEFAULT_TECH_DIRECTOR,     // Busca tech_director_json
        staff_facilities: data?.staff_facilities_json || DEFAULT_STAFF_FACILITIES // Busca staff_facilities_json
    };
}

/**
 * Salva ou Atualiza (Upsert) o estado do usuário.
 */
// ---> PASSO 3: USAR A INTERFACE (PARCIAL) NOS DADOS DE ENTRADA
export async function saveUserState(userId: string, data: Partial<UserState>) {
    if (!userId) throw new Error("UserID é obrigatório para salvar");

    const payload: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
    };

    // Mapeamento manual garante segurança e segue o padrão de suas colunas JSON
    if (data.track !== undefined) payload.track = data.track;
    if (data.driver !== undefined) payload.driver_json = data.driver;
    if (data.car !== undefined) payload.car_json = data.car;
    if (data.test_points !== undefined) payload.test_points_json = data.test_points;
    if (data.race_options !== undefined) payload.race_options_json = data.race_options;
    if (data.weather !== undefined) payload.weather_data = data.weather;
    if (data.desgasteModifier !== undefined) payload.desgaste_modifier = data.desgasteModifier;
    
    // --- Lógica para salvar os novos campos JSON ---
    if (data.tech_director !== undefined) payload.tech_director_json = data.tech_director;
    if (data.staff_facilities !== undefined) payload.staff_facilities_json = data.staff_facilities;
    // ----------------------------------------------

    // NOTA: 'role' não é incluído para segurança (geralmente é administrado separadamente ou definido no registro)
    
    const { error } = await supabase
        .from('user_states') // Nome da sua tabela de estados
        .upsert(payload, { onConflict: 'user_id' });

    if (error) {
        console.error("Erro CRÍTICO ao salvar no Supabase:", error);
        throw new Error(error.message);
    }
    // Retornar algo para indicar sucesso, se necessário
    return { success: true };
}