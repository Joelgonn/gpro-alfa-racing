import { Driver, CarPart, TechDirector, StaffFacilities, WeatherData, MenuData, OfficeData } from '@/app/context/GameContext';
import { EnergyCoefficients, DEFAULT_COEFFS } from '@/app/services/engine/regressionEngine';
import { DEFAULT_TYRE_SUPPLIERS as CENTRAL_DEFAULT_TYRE_SUPPLIERS } from '@/app/lib/tracks';
import { supabase as browserSupabase } from '@/app/lib/supabase';

// Helper para obter client correto sem vazar service_role ao bundle cliente
// Usa dynamic import com eval para evitar static analysis do `server-only`
async function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server: cria client service_role diretamente (evita importar supabase-admin que tem 'server-only')
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !key) throw new Error('Service role não configurado no servidor');
    return createClient(url, key, { auth: { persistSession: false } });
  }
  return browserSupabase;
}

// Export para compatibilidade (browser)
export const supabase = browserSupabase;

// Re-export da fonte única para compatibilidade
export const DEFAULT_TYRE_SUPPLIERS = CENTRAL_DEFAULT_TYRE_SUPPLIERS;

// ============================================
// INTERFACE DO ESTADO DO USUÁRIO
// ============================================

export interface UserState {
  role: 'admin' | 'user';
  track: string;
  
  // ✅ DADOS IMUTÁVEIS DO PILOTO (NUNCA MUDAM)
  driver_static: {
    name: string;
    nationality: string;
    nationalityName: string;
    overall: number;
    salary: string;
    racesLeft: string;
    driverId: number | null;
    trophies: number;
    races: number;
    wins: number;
    podiums: number;
    points: number;
    poles: number;
    fastLaps: number;
  };
  
  // ✅ DADOS EDITÁVEIS DO PILOTO (PODEM MUDAR)
  driver_editable: {
    concentracao: number;
    talento: number;
    agressividade: number;
    experiencia: number;
    tecnica: number;
    resistencia: number;
    carisma: number;
    motivacao: number;
    reputacao: number;
    peso: number;
    idade: number;
    energia: number;
    total: number;
  };
  
  car: CarPart[];
  tech_director: TechDirector;
  staff_facilities: StaffFacilities;
  test_points: { power: number; handling: number; accel: number; };
  race_options: any;
  weather: WeatherData;
  desgasteModifier: number;
  sponsors_database: any[];
  energy_coeffs: EnergyCoefficients;
  menu_data: MenuData | null;
  office_data: OfficeData | null;
  last_import_snapshot?: any | null;
  last_import_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  
  // ✅ FORNECEDORES DE PNEUS (ADICIONADO)
  tyre_suppliers: string[];

  // ✅ TOTAIS DO CARRO (ADICIONADO - PASSO 1)
  car_totals?: {
    power: number;
    handling: number;
    accel: number;
  };
}

// ============================================
// VALORES PADRÃO
// ============================================

const DEFAULT_DRIVER_STATIC = {
  name: '',
  nationality: '',
  nationalityName: '',
  overall: 0,
  salary: '0',
  racesLeft: '0',
  driverId: null,
  trophies: 0,
  races: 0,
  wins: 0,
  podiums: 0,
  points: 0,
  poles: 0,
  fastLaps: 0,
};

const DEFAULT_DRIVER_EDITABLE = {
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
};

// ============================================
// FUNÇÕES PRINCIPAIS
// ============================================

export async function getUserState(userId: string): Promise<UserState> {
  if (!userId) throw new Error("UserID é obrigatório");

  const client = await getSupabaseClient();
  // Seleção explícita sem gpro_token (Fase 3.1 — nunca selecionar token em consultas gerais)
  // Colunas verificadas existentes em produção (check_columns.js 14/09/2026)
  const { data, error } = await client
    .from('user_state')
    .select('user_id, role, track, driver_json, car_json, tech_director_json, staff_facilities_json, test_points_json, race_options_json, weather_data, sponsors_database_json, energy_coeffs_json, menu_data, office_data, desgaste_modifier, last_import_snapshot, last_import_at, created_at, updated_at, car_development_json, driver_info, driver_editable, driver_static, car_totals')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    // Retorna estado padrão com fornecedores de pneus
    return {
      role: 'user',
      track: 'Selecionar Pista',
      driver_static: { ...DEFAULT_DRIVER_STATIC },
      driver_editable: { ...DEFAULT_DRIVER_EDITABLE },
      car: [],
      tech_director: {} as TechDirector,
      staff_facilities: { toleranciaPressao: 0, concentracao: 0 },
      test_points: { power: 0, handling: 0, accel: 0 },
      race_options: {},
      weather: {} as WeatherData,
      desgasteModifier: 0,
      sponsors_database: [],
      energy_coeffs: DEFAULT_COEFFS,
      menu_data: null,
      office_data: null,
      last_import_snapshot: null,
      last_import_at: null,
      tyre_suppliers: [...DEFAULT_TYRE_SUPPLIERS], // ✅ PADRÃO
      car_totals: { power: 0, handling: 0, accel: 0 }, // ✅ PADRÃO
    };
  }

  // ✅ DADOS IMUTÁVEIS - apenas ler, nunca mesclar
  const driverStatic = data.driver_static || { ...DEFAULT_DRIVER_STATIC };
  
  // ✅ DADOS EDITÁVEIS - apenas ler, nunca mesclar
  const driverEditable = data.driver_editable || { ...DEFAULT_DRIVER_EDITABLE };

  // ✅ FORNECEDORES DE PNEUS - coluna não existe em produção, sempre fallback para DEFAULT
  let tyreSuppliers = (data as any).tyre_suppliers;
  if (!tyreSuppliers || !Array.isArray(tyreSuppliers) || tyreSuppliers.length === 0) {
    tyreSuppliers = [...DEFAULT_TYRE_SUPPLIERS];
  }

  // ✅ TOTAIS DO CARRO - garantir que exista
  const carTotals = data.car_totals || { power: 0, handling: 0, accel: 0 };

  console.log('🔍 [db.ts] Driver Static (imutável):', {
    name: driverStatic.name,
    overall: driverStatic.overall,
    nationality: driverStatic.nationality,
  });
  
  console.log('🔍 [db.ts] Driver Editable (mutável):', {
    concentracao: driverEditable.concentracao,
    energia: driverEditable.energia,
  });

  console.log('🔍 [db.ts] Tyre Suppliers:', tyreSuppliers);
  console.log('🔍 [db.ts] Car Totals:', carTotals);

  return {
    role: data.role || 'user',
    track: data.track || 'Interlagos',
    driver_static: driverStatic,
    driver_editable: driverEditable,
    car: data.car_json || [],
    tech_director: data.tech_director_json || {} as TechDirector,
    staff_facilities: data.staff_facilities_json || { toleranciaPressao: 0, concentracao: 0 },
    test_points: data.test_points_json || { power: 0, handling: 0, accel: 0 },
    race_options: data.race_options_json || {},
    weather: data.weather_data || {} as WeatherData,
    desgasteModifier: data.desgaste_modifier || 0,
    sponsors_database: data.sponsors_database_json || [],
    energy_coeffs: data.energy_coeffs_json || DEFAULT_COEFFS,
    menu_data: data.menu_data || null,
    office_data: data.office_data || null,
    last_import_snapshot: data.last_import_snapshot || null,
    last_import_at: data.last_import_at || null,
    updated_at: (data as any).updated_at || null,
    created_at: (data as any).created_at || null,
    tyre_suppliers: tyreSuppliers, // ✅ ADICIONADO
    car_totals: carTotals, // ✅ ADICIONADO - PASSO 1
  };
}

export async function saveUserState(userId: string, data: Partial<UserState>) {
  if (!userId) throw new Error("UserID é obrigatório para salvar");

  const payload: any = {
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  if (data.track !== undefined) payload.track = data.track;
  if (data.driver_static) payload.driver_static = data.driver_static;
  if (data.driver_editable) payload.driver_editable = data.driver_editable;
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
  
  // ✅ SALVAR FORNECEDORES DE PNEUS
  if (data.tyre_suppliers && Array.isArray(data.tyre_suppliers)) {
    // Coluna pode não existir em instâncias antigas — tenta salvar, ignora erro de coluna inexistente
    payload.tyre_suppliers = data.tyre_suppliers;
  }

  // ✅ SALVAR TOTAIS DO CARRO (ADICIONADO - PASSO 1)
  if (data.car_totals) {
    payload.car_totals = data.car_totals;
  }

  const client = await getSupabaseClient();
  let { error } = await client
    .from('user_state')
    .upsert(payload, { onConflict: 'user_id' });

  // Fallback para instâncias sem coluna tyre_suppliers (42703)
  if (error && (error as any).code === '42703' && payload.tyre_suppliers) {
    console.warn('Coluna tyre_suppliers não existe, salvando sem ela');
    const { tyre_suppliers: _omit, ...payloadWithoutTyre } = payload;
    const retry = await client.from('user_state').upsert(payloadWithoutTyre, { onConflict: 'user_id' });
    error = retry.error;
  }

  if (error) {
    console.error("Erro ao salvar no Supabase:", error.message);
    throw new Error(`Falha ao salvar estado: ${error.message}`);
  }
}

// ============================================
// FUNÇÃO PARA ATUALIZAR APENAS OS FORNECEDORES
// ============================================

export async function updateTyreSuppliers(userId: string, suppliers: string[]) {
  if (!userId) throw new Error("UserID é obrigatório");
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    throw new Error("Lista de fornecedores inválida");
  }

  return saveUserState(userId, { tyre_suppliers: suppliers });
}

// ============================================
// FUNÇÃO PARA BUSCAR APENAS OS FORNECEDORES
// ============================================

export async function getTyreSuppliers(userId: string): Promise<string[]> {
  const state = await getUserState(userId);
  return state.tyre_suppliers || [...DEFAULT_TYRE_SUPPLIERS];
}

// ============================================
// FUNÇÃO PARA BUSCAR APENAS OS TOTAIS DO CARRO
// ============================================

export async function getCarTotals(userId: string): Promise<{ power: number; handling: number; accel: number }> {
  const state = await getUserState(userId);
  return state.car_totals || { power: 0, handling: 0, accel: 0 };
}