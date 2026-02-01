import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// ---> PASSO 1: DEFINIR A INTERFACE PARA O ESTADO DO USUÁRIO
// Este é o "contrato" que diz ao TypeScript como é a estrutura do nosso objeto.
interface UserState {
  role: 'admin' | 'user';
  track: string;
  driver: any; // Pode ser mais específico se você tiver a tipagem do driver
  car: any[];  // Um array de objetos de carro
  test_points: any;
  race_options: any;
  weather: any;
  desgasteModifier?: number; // <--- AQUI ESTÁ A PROPRIEDADE QUE FALTAVA! O '?' a torna opcional.
}

// --- VALORES PADRÃO (MOCK) ---
const DEFAULT_DRIVER = {
    concentracao: 0, talento: 0, agressividade: 0, experiencia: 0, tecnica: 0,
    resistencia: 0, carisma: 0, motivacao: 0, reputacao: 0, peso: 80, idade: 20, energia: 100
};

const DEFAULT_CAR = Array(11).fill({ lvl: 1, wear: 0 });

const DEFAULT_TEST = { power: 0, handling: 0, accel: 0 };
const DEFAULT_OPTS = {};

const DEFAULT_WEATHER = {
    tempQ1: 20, tempQ2: 20, weatherQ1: 'Dry', weatherQ2: 'Dry', weatherRace: 'Dry',
    r1_temp_min: 20, r1_temp_max: 20, r2_temp_min: 20, r2_temp_max: 20,
    r3_temp_min: 20, r3_temp_max: 20, r4_temp_min: 20, r4_temp_max: 20,
};

/**
 * Busca o estado do usuário no Supabase.
 */
// ---> PASSO 2: USAR A INTERFACE NO RETORNO DA FUNÇÃO
export async function getUserState(userId: string): Promise<UserState> {
    if (!userId) throw new Error("UserID é obrigatório");

    const { data, error } = await supabase
        .from('user_state')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        if (error && error.code !== 'PGRST116') {
            console.error("Erro ao buscar user_state:", error.message);
        }
        
        // Retorna o estado padrão
        return {
            role: 'user',
            track: 'Selecionar Pista',
            driver: DEFAULT_DRIVER,
            car: DEFAULT_CAR,
            test_points: DEFAULT_TEST,
            race_options: DEFAULT_OPTS,
            weather: DEFAULT_WEATHER,
            desgasteModifier: 0, // Inclui o valor padrão aqui também
        };
    }

    // Retorna os dados do banco
    return {
        role: data.role || 'user',
        track: data.track || 'Interlagos',
        driver: data.driver_json || DEFAULT_DRIVER,
        car: data.car_json || DEFAULT_CAR,
        test_points: data.test_points_json || DEFAULT_TEST,
        race_options: data.race_options_json || DEFAULT_OPTS,
        weather: data.weather_data || DEFAULT_WEATHER,
        desgasteModifier: data.desgaste_modifier || 0, // <--- BUSCA A PROPRIEDADE DO BANCO
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

    // Mapeamento manual garante segurança
    if (data.track !== undefined) payload.track = data.track;
    if (data.driver) payload.driver_json = data.driver;
    if (data.car) payload.car_json = data.car;
    if (data.test_points) payload.test_points_json = data.test_points;
    if (data.race_options) payload.race_options_json = data.race_options;
    if (data.weather) payload.weather_data = data.weather;
    if (data.desgasteModifier !== undefined) payload.desgaste_modifier = data.desgasteModifier; // <--- ADICIONA A LÓGICA PARA SALVAR

    // NOTA: 'role' não é incluído para segurança
    
    const { error } = await supabase
        .from('user_state')
        .upsert(payload, { onConflict: 'user_id' });

    if (error) {
        console.error("Erro CRÍTICO ao salvar no Supabase:", error);
        throw new Error(error.message);
    }
}