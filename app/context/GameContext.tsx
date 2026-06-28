'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getUserState, saveUserState, UserState } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// ============================================
// TIPOS
// ============================================

// ✅ DADOS IMUTÁVEIS DO PILOTO (NUNCA MUDAM)
export interface DriverStatic {
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
}

// ✅ DADOS EDITÁVEIS DO PILOTO (PODEM MUDAR)
export interface DriverEditable {
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
}

// ✅ DRIVER COMPLETO (para compatibilidade com código existente)
export interface Driver extends DriverStatic, DriverEditable {}

export interface CarPart {
  name: string;
  lvl: number;
  wear: number;
}

export interface TechDirector {
  name: string;
  id: string;
  nationality: string;
  overall: string;
  salary: string;
  racesLeft: string;
  rdMecanico: number;
  rdEletronico: number;
  rdAerodinamico: number;
  experiencia: number;
  pitCoord: number;
  mechanics: number;
  electronics: number;
  aerodynamics: number;
  experience: number;
}

export interface StaffFacilities {
  toleranciaPressao: number;
  concentracao: number;
}

export interface TestPoints {
  power: number;
  handling: number;
  accel: number;
}

export interface WeatherData {
  tempQ1: number;
  weatherQ1: "Dry" | "Wet";
  tempQ2: number;
  weatherQ2: "Dry" | "Wet";
  weatherRace: "Dry" | "Wet";
  r1_temp_min: number;
  r1_temp_max: number;
  r2_temp_min: number;
  r2_temp_max: number;
  r3_temp_min: number;
  r3_temp_max: number;
  r4_temp_min: number;
  r4_temp_max: number;
  r1_rain_chance: number;
  r2_rain_chance: number;
  r3_rain_chance: number;
  r4_rain_chance: number;
}

export interface MenuData {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  group: string;
  groupShort: string;
  cash: number;
  credits: number;
  champs: number;
  teamId: number | null;
  teamCredits: number;
  driverId: number | null;
  status: string;
  apiRequestsRemaining: number;
  IDM: number;
  fName: string;
  lName: string;
  natCode: string;
  accStatus: string;
}

export interface OfficeData {
  season: string;
  race: string;
  trackName: string;
  trackId: string;
  points: string;
  position: string;
  average: string;
  qual1Position: string;
  qual2Position: string;
  donePractice: string;
  doneQ1: string;
  doneQ2: string;
  doneTesting: string;
  seasonNb: string;
  raceNb: string;
  pts: string;
  pos: string;
  avg: string;
  qual1Pos: string;
  qual2Pos: string;
}

// ============================================
// CONSTANTES - FORNECEDORES DE PNEUS
// ============================================

export const TYRE_SUPPLIERS = [
  "Pipirelli",
  "Hantook",
  "Dunlop",
  "Michelin",
  "Pirelli",
  "Goodyear",
  "Bridgestone"
];

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_DRIVER_STATIC: DriverStatic = {
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

const DEFAULT_DRIVER_EDITABLE: DriverEditable = {
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

const defaultCar: CarPart[] = [
  { name: 'Chassi', lvl: 0, wear: 0 },
  { name: 'Motor', lvl: 0, wear: 0 },
  { name: 'Asa dianteira', lvl: 0, wear: 0 },
  { name: 'Asa traseira', lvl: 0, wear: 0 },
  { name: 'Assoalho', lvl: 0, wear: 0 },
  { name: 'Laterais', lvl: 0, wear: 0 },
  { name: 'Radiador', lvl: 0, wear: 0 },
  { name: 'Câmbio', lvl: 0, wear: 0 },
  { name: 'Freios', lvl: 0, wear: 0 },
  { name: 'Suspensão', lvl: 0, wear: 0 },
  { name: 'Eletrônicos', lvl: 0, wear: 0 },
];

const defaultTechDirector: TechDirector = {
  name: '',
  id: '',
  nationality: '',
  overall: '0',
  salary: '0',
  racesLeft: '0',
  rdMecanico: 0,
  rdEletronico: 0,
  rdAerodinamico: 0,
  experiencia: 0,
  pitCoord: 0,
  mechanics: 0,
  electronics: 0,
  aerodynamics: 0,
  experience: 0,
};

const defaultStaffFacilities: StaffFacilities = {
  toleranciaPressao: 0,
  concentracao: 0,
};

const defaultTestPoints: TestPoints = {
  power: 0,
  handling: 0,
  accel: 0,
};

const defaultWeather: WeatherData = {
  tempQ1: 0,
  weatherQ1: "Dry",
  tempQ2: 0,
  weatherQ2: "Dry",
  weatherRace: "Dry",
  r1_temp_min: 0,
  r1_temp_max: 0,
  r2_temp_min: 0,
  r2_temp_max: 0,
  r3_temp_min: 0,
  r3_temp_max: 0,
  r4_temp_min: 0,
  r4_temp_max: 0,
  r1_rain_chance: 0,
  r2_rain_chance: 0,
  r3_rain_chance: 0,
  r4_rain_chance: 0,
};

// ============================================
// NORMALIZAÇÃO DO CLIMA
// ============================================

/**
 * Normaliza uma condição climática para "Dry" ou "Wet"
 */
function normalizeCondition(weather: any): "Dry" | "Wet" {
  if (weather === null || weather === undefined) return "Dry";
  
  const text = String(weather).trim().toLowerCase();
  
  // Padrões para "Wet" (chuva)
  const wetPatterns = ['wet', 'rain', 'chuva', 'molhado', 'chuvoso', 'raining', 'rainy'];
  for (const pattern of wetPatterns) {
    if (text.includes(pattern)) {
      return "Wet";
    }
  }
  
  return "Dry";
}

/**
 * Normaliza dados de clima vindos da API
 * 
 * Suporta múltiplos formatos:
 * - tempQ1 / temp_q1
 * - weatherQ1 / weather_q1
 * - "Dry", "dry", "DRY", "Sunny", "Seco" → "Dry"
 * - "Wet", "wet", "WET", "Rain", "Chuva" → "Wet"
 */
export function normalizeWeather(raw: any): WeatherData {
  if (!raw || typeof raw !== 'object') {
    return { ...defaultWeather };
  }

  // Criar um objeto seguro
  const data = { ...defaultWeather, ...raw };

  return {
    // Temperaturas (normalizar nomes dos campos)
    tempQ1: Number(data.tempQ1 ?? data.temp_q1 ?? 0),
    tempQ2: Number(data.tempQ2 ?? data.temp_q2 ?? 0),

    // Climas (normalizar valores)
    weatherQ1: normalizeCondition(data.weatherQ1 ?? data.weather_q1),
    weatherQ2: normalizeCondition(data.weatherQ2 ?? data.weather_q2),
    weatherRace: normalizeCondition(data.weatherRace ?? data.weather_race ?? data.weather),

    // Períodos de temperatura
    r1_temp_min: Number(data.r1_temp_min ?? data.r1_temp_min ?? 0),
    r1_temp_max: Number(data.r1_temp_max ?? data.r1_temp_max ?? 0),
    r2_temp_min: Number(data.r2_temp_min ?? data.r2_temp_min ?? 0),
    r2_temp_max: Number(data.r2_temp_max ?? data.r2_temp_max ?? 0),
    r3_temp_min: Number(data.r3_temp_min ?? data.r3_temp_min ?? 0),
    r3_temp_max: Number(data.r3_temp_max ?? data.r3_temp_max ?? 0),
    r4_temp_min: Number(data.r4_temp_min ?? data.r4_temp_min ?? 0),
    r4_temp_max: Number(data.r4_temp_max ?? data.r4_temp_max ?? 0),

    // Chances de chuva
    r1_rain_chance: Number(data.r1_rain_chance ?? 0),
    r2_rain_chance: Number(data.r2_rain_chance ?? 0),
    r3_rain_chance: Number(data.r3_rain_chance ?? 0),
    r4_rain_chance: Number(data.r4_rain_chance ?? 0),
  };
}

// ============================================
// CONTEXT
// ============================================

interface GameContextType {
  // ✅ DADOS SEPARADOS DO PILOTO
  driverStatic: DriverStatic;
  driverEditable: DriverEditable;
  
  // ✅ DRIVER COMPLETO (para compatibilidade)
  driver: Driver;
  
  // Outros estados
  car: CarPart[];
  track: string;
  weather: WeatherData;
  desgasteModifier: number;
  tracksList: string[];
  tyreSuppliers: string[]; // ✅ ADICIONADO
  techDirector: TechDirector;
  staffFacilities: StaffFacilities;
  testPoints: TestPoints;
  isGlobalLoading: boolean;
  menuData: MenuData | null;
  officeData: OfficeData | null;
  
  // Atualizadores - SOMENTE para dados editáveis
  updateDriverEditable: <K extends keyof DriverEditable>(key: K, value: DriverEditable[K]) => void;
  updateCar: (index: number, key: keyof CarPart, value: number) => void;
  updateTrack: (track: string) => void;
  updateWeather: (weather: Partial<WeatherData> | any) => void;
  updateDesgasteModifier: (value: number) => void;
  updateTechDirector: (data: Partial<TechDirector>) => void;
  updateStaffFacilities: (data: Partial<StaffFacilities>) => void;
  updateTestPoints: (data: Partial<TestPoints>) => void;
  
  // ✅ IDEAL SETUP (para página de estratégia)
  idealSetup: any;
  updateIdealSetup: (data: any) => void;
  
  // Ações
  loadUserState: () => Promise<void>;
  reloadUserState: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function GameProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(true);
  
  // ✅ ESTADOS SEPARADOS DO PILOTO
  const [driverStatic, setDriverStatic] = useState<DriverStatic>(DEFAULT_DRIVER_STATIC);
  const [driverEditable, setDriverEditable] = useState<DriverEditable>(DEFAULT_DRIVER_EDITABLE);
  
  // ✅ DRIVER COMPLETO (junção dos dois)
  const [driver, setDriver] = useState<Driver>({
    ...DEFAULT_DRIVER_STATIC,
    ...DEFAULT_DRIVER_EDITABLE,
  });
  
  // ✅ IDEAL SETUP (para página de estratégia)
  const [idealSetup, setIdealSetup] = useState<any>(null);
  
  // Outros estados
  const [car, setCar] = useState<CarPart[]>(defaultCar);
  const [track, setTrack] = useState<string>('Selecionar Pista');
  const [weather, setWeather] = useState<WeatherData>(defaultWeather);
  const [desgasteModifier, setDesgasteModifier] = useState<number>(0);
  const [tracksList, setTracksList] = useState<string[]>([]);
  const [tyreSuppliers, setTyreSuppliers] = useState<string[]>(TYRE_SUPPLIERS); // ✅ ADICIONADO
  const [techDirector, setTechDirector] = useState<TechDirector>(defaultTechDirector);
  const [staffFacilities, setStaffFacilities] = useState<StaffFacilities>(defaultStaffFacilities);
  const [testPoints, setTestPoints] = useState<TestPoints>(defaultTestPoints);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);

  // ============================================
  // UPDATE WEATHER - COM NORMALIZAÇÃO
  // ============================================
  const updateWeather = useCallback((data: Partial<WeatherData> | any) => {
    if (!data || typeof data !== 'object') {
      return;
    }
    
    // Normalizar os dados recebidos
    const normalized = normalizeWeather(data);
    
    // Mesclar com o estado atual
    setWeather(prev => ({
      ...prev,
      ...normalized,
    }));
  }, []);

  // ============================================
  // LOAD USER STATE - SEPARADO
  // ============================================
  const loadUserState = useCallback(async () => {
    if (!userId) {
      console.log("🔍 loadUserState: userId não disponível");
      return;
    }

    try {
      console.log("🔍 loadUserState: Iniciando carregamento para userId:", userId);
      
      const loaded = await getUserState(userId);
      
      console.log("===== LOAD USER STATE =====");
      console.log('📊 Driver Static (imutável):', {
        name: loaded.driver_static?.name,
        overall: loaded.driver_static?.overall,
        nationality: loaded.driver_static?.nationality,
      });
      console.log('📊 Driver Editable (mutável):', {
        concentracao: loaded.driver_editable?.concentracao,
        energia: loaded.driver_editable?.energia,
      });
      console.log('📊 Weather (normalizado):', {
        tempQ1: loaded.weather?.tempQ1,
        weatherQ1: loaded.weather?.weatherQ1,
        tempQ2: loaded.weather?.tempQ2,
        weatherQ2: loaded.weather?.weatherQ2,
        weatherRace: loaded.weather?.weatherRace,
      });
      console.log("===== FIM LOAD USER STATE =====");

      // ✅ ATUALIZAR DADOS IMUTÁVEIS
      if (loaded.driver_static) {
        setDriverStatic(loaded.driver_static);
      }
      
      // ✅ ATUALIZAR DADOS EDITÁVEIS
      if (loaded.driver_editable) {
        setDriverEditable(loaded.driver_editable);
      }
      
      // ✅ ATUALIZAR DRIVER COMPLETO (junção)
      setDriver({
        ...loaded.driver_static,
        ...loaded.driver_editable,
      });

      // ✅ ATUALIZAR WEATHER (NORMALIZADO)
      if (loaded.weather) {
        updateWeather(loaded.weather);
      }

      // Atualizar outros estados
      if (loaded.car && Array.isArray(loaded.car)) {
        setCar(loaded.car);
      }

      if (loaded.track) {
        setTrack(loaded.track);
      }

      if (loaded.desgasteModifier !== undefined) {
        setDesgasteModifier(loaded.desgasteModifier);
      }

      if (loaded.tech_director) {
        setTechDirector(loaded.tech_director);
      }

      if (loaded.staff_facilities) {
        setStaffFacilities(loaded.staff_facilities);
      }

      if (loaded.test_points) {
        setTestPoints(loaded.test_points);
      }

      if (loaded.menu_data) {
        setMenuData(loaded.menu_data);
      }

      if (loaded.office_data) {
        setOfficeData(loaded.office_data);
      }

      // ✅ ATUALIZAR FORNECEDORES DE PNEUS (se vier do banco)
      if (loaded.tyre_suppliers && Array.isArray(loaded.tyre_suppliers)) {
        setTyreSuppliers(loaded.tyre_suppliers);
      }

      console.log('✅ [GameContext] Estado carregado com sucesso');

    } catch (error) {
      console.error("🔍 loadUserState: Erro ao carregar:", error);
    } finally {
      setIsGlobalLoading(false);
    }
  }, [userId, updateWeather]);

  // ============================================
  // RELOAD USER STATE
  // ============================================
  const reloadUserState = useCallback(async () => {
    console.log('🔄 [GameContext] Forçando recarga do estado...');
    setIsGlobalLoading(true);
    try {
      await loadUserState();
      console.log('✅ [GameContext] Estado recarregado com sucesso');
    } catch (error) {
      console.error('❌ [GameContext] Erro ao recarregar:', error);
    } finally {
      setIsGlobalLoading(false);
    }
  }, [loadUserState]);

  // ============================================
  // CHECK SESSION
  // ============================================
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);
    }
    checkSession();
  }, [router]);

  // ============================================
  // LOAD ON USER ID CHANGE
  // ============================================
  useEffect(() => {
    if (userId) {
      loadUserState();
    }
  }, [userId, loadUserState]);

  // ============================================
  // UPDATERS - SOMENTE DADOS EDITÁVEIS
  // ============================================
  
  const updateDriverEditable = useCallback(<K extends keyof DriverEditable>(key: K, value: DriverEditable[K]) => {
    // ✅ Atualizar driverEditable
    setDriverEditable(prev => ({
      ...prev,
      [key]: value
    }));
    
    // ✅ Atualizar driver completo
    setDriver(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateCar = useCallback((index: number, key: keyof CarPart, value: number) => {
    setCar(prev => {
      const newCar = [...prev];
      newCar[index] = {
        ...newCar[index],
        [key]: value
      };
      return newCar;
    });
  }, []);

  const updateTrack = useCallback((newTrack: string) => {
    setTrack(newTrack);
  }, []);

  const updateDesgasteModifier = useCallback((value: number) => {
    setDesgasteModifier(value);
  }, []);

  const updateTechDirector = useCallback((data: Partial<TechDirector>) => {
    setTechDirector(prev => ({
      ...prev,
      ...data
    }));
  }, []);

  const updateStaffFacilities = useCallback((data: Partial<StaffFacilities>) => {
    setStaffFacilities(prev => ({
      ...prev,
      ...data
    }));
  }, []);

  const updateTestPoints = useCallback((data: Partial<TestPoints>) => {
    setTestPoints(prev => ({
      ...prev,
      ...data
    }));
  }, []);

  // ============================================
  // UPDATE IDEAL SETUP (para página de estratégia)
  // ============================================
  const updateIdealSetup = useCallback((data: any) => {
    console.log('📊 Ideal Setup atualizado:', data);
    setIdealSetup(data);
  }, []);

  // ============================================
  // VALUE
  // ============================================
  
  const value: GameContextType = {
    // ✅ DADOS SEPARADOS
    driverStatic,
    driverEditable,
    driver,
    
    // ✅ IDEAL SETUP
    idealSetup,
    updateIdealSetup,
    
    // Outros estados
    car,
    track,
    weather,
    desgasteModifier,
    tracksList,
    tyreSuppliers, // ✅ ADICIONADO
    techDirector,
    staffFacilities,
    testPoints,
    isGlobalLoading,
    menuData,
    officeData,
    
    // Atualizadores
    updateDriverEditable,
    updateCar,
    updateTrack,
    updateWeather,
    updateDesgasteModifier,
    updateTechDirector,
    updateStaffFacilities,
    updateTestPoints,
    
    // Ações
    loadUserState,
    reloadUserState,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}