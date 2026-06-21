// --- START OF FILE app/context/GameContext.tsx ---
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================================
// 1. DEFINIÇÃO DE TIPOS (TYPESCRIPT) - VERSÃO COMPLETA E ENRIQUECIDA
// ============================================================================

export type Driver = {
  // ============================================
  // NOVOS CAMPOS ENRIQUECIDOS DO GPRO (inglês)
  // ============================================
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
  
  // ============================================
  // ALIASES (inglês) - facilitam migração gradual
  // ============================================
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
  
  // ============================================
  // CAMPOS LEGADOS (português) - PRESERVADOS
  // ============================================
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
  
  // Total calculado
  total: number;
};

export type CarPart = {
  name: string; 
  lvl: number; 
  wear: number;
};

export type TechDirector = {
  // ============================================
  // NOVOS CAMPOS ENRIQUECIDOS DO GPRO (inglês)
  // ============================================
  name?: string;
  id?: string;
  nationality?: string;
  overall?: string;
  salary?: string;
  racesLeft?: string;
  
  // ============================================
  // ALIASES (inglês) - facilitam migração gradual
  // ============================================
  mechanics?: number;
  electronics?: number;
  aerodynamics?: number;
  experience?: number;
  
  // ============================================
  // CAMPOS LEGADOS (português) - PRESERVADOS
  // NOTA: pitCoord é o mesmo em inglês e português,
  // então NÃO duplicamos como alias
  // ============================================
  rdMecanico: number;
  rdEletronico: number;
  rdAerodinamico: number;
  experiencia: number;
  pitCoord: number;
};

export type StaffFacilities = {
  toleranciaPressao: number; 
  concentracao: number;
};

export type WeatherData = {
  tempQ1: number; 
  weatherQ1: string; 
  tempQ2: number; 
  weatherQ2: string;
  weatherRace: string; 
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
};

export type TestPoints = {
  power: number; 
  handling: number; 
  accel: number;
};

// ============================================
// NOVOS TIPOS: Dados enriquecidos do GPRO
// ============================================

export type MenuData = {
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
  
  // Campos legados (compatibilidade)
  IDM: number;
  fName: string;
  lName: string;
  natCode: string;
  accStatus: string;
};

export type OfficeData = {
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
  
  // Campos legados (compatibilidade)
  seasonNb: string;
  raceNb: string;
  pts: string;
  pos: string;
  avg: string;
  qual1Pos: string;
  qual2Pos: string;
};

// Interface do Contexto
export interface GameContextType {
  // Estados Globais
  isGlobalLoading: boolean;
  isDataSynced: boolean;
  
  role: 'admin' | 'user';
  track: string;
  tracksList: string[];
  tyreSuppliers: string[];
  
  // Entidades
  driver: Driver;
  car: CarPart[];
  techDirector: TechDirector;
  staffFacilities: StaffFacilities;
  weather: WeatherData;
  testPoints: TestPoints;
  
  // NOVAS ENTIDADES
  menuData: MenuData | null;
  officeData: OfficeData | null;

  // Calculados
  raceAvgTemp: number;
  desgasteModifier: number;
  idealSetup: Record<string, any> | null;

  // Ações / Setters
  updateRole: (newRole: 'admin' | 'user') => void;
  updateTrack: (t: string) => void;
  updateDriver: (field: keyof Driver, value: Driver[keyof Driver]) => void;
  updateCar: (index: number, field: 'lvl' | 'wear', value: number) => void;
  updateTechDirector: (data: Partial<TechDirector>) => void;
  updateStaffFacilities: (data: Partial<StaffFacilities>) => void;
  updateWeather: (data: Partial<WeatherData>) => void;
  updateTestPoints: (data: Partial<TestPoints>) => void;
  updateDesgasteModifier: (val: number) => void;
  updateIdealSetup: (data: Record<string, any> | null) => void;
  markDataAsSynced: () => void;
}

// ============================================================================
// 2. ESTADOS INICIAIS (CONSTANTES)
// ============================================================================

const INITIAL_DRIVER: Driver = {
  concentracao: 0, 
  talento: 0, 
  agressividade: 0, 
  experiencia: 0,
  tecnica: 0, 
  resistencia: 0, 
  carisma: 0, 
  motivacao: 0,
  reputacao: 0, 
  peso: 0, 
  idade: 0, 
  energia: 0, 
  total: 0
};

const INITIAL_CAR: CarPart[] = [
  { name: "Chassi", lvl: 0, wear: 0 }, 
  { name: "Motor", lvl: 0, wear: 0 },
  { name: "Asa dianteira", lvl: 0, wear: 0 }, 
  { name: "Asa traseira", lvl: 0, wear: 0 },
  { name: "Assoalho", lvl: 0, wear: 0 }, 
  { name: "Laterais", lvl: 0, wear: 0 },
  { name: "Radiador", lvl: 0, wear: 0 }, 
  { name: "Câmbio", lvl: 0, wear: 0 },
  { name: "Freios", lvl: 0, wear: 0 }, 
  { name: "Suspensão", lvl: 0, wear: 0 },
  { name: "Eletrônicos", lvl: 0, wear: 0 },
];

const INITIAL_TECH_DIRECTOR: TechDirector = {
  rdMecanico: 0, 
  rdEletronico: 0, 
  rdAerodinamico: 0, 
  experiencia: 0, 
  pitCoord: 0
};

const INITIAL_STAFF_FACILITIES: StaffFacilities = {
  toleranciaPressao: 0, 
  concentracao: 0
};

const INITIAL_WEATHER: WeatherData = {
  tempQ1: 0, 
  weatherQ1: 'Dry', 
  tempQ2: 0, 
  weatherQ2: 'Dry', 
  weatherRace: 'Dry',
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

const INITIAL_TEST_POINTS: TestPoints = { 
  power: 0, 
  handling: 0, 
  accel: 0 
};

// ============================================================================
// 3. CRIAÇÃO DO CONTEXTO E PROVIDER
// ============================================================================

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  // --- States Globais de Controle ---
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(true);
  const [isDataSynced, setIsDataSynced] = useState<boolean>(false);

  // --- States de Dados ---
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [track, setTrack] = useState<string>('Selecionar Pista');
  const [tracksList, setTracksList] = useState<string[]>([]);
  const [tyreSuppliers, setTyreSuppliers] = useState<string[]>([]);
  
  const [driver, setDriver] = useState<Driver>(INITIAL_DRIVER);
  const [car, setCar] = useState<CarPart[]>(INITIAL_CAR);
  const [techDirector, setTechDirector] = useState<TechDirector>(INITIAL_TECH_DIRECTOR);
  const [staffFacilities, setStaffFacilities] = useState<StaffFacilities>(INITIAL_STAFF_FACILITIES);
  const [weather, setWeather] = useState<WeatherData>(INITIAL_WEATHER);
  const [testPoints, setTestPoints] = useState<TestPoints>(INITIAL_TEST_POINTS);
  
  // NOVOS ESTADOS
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);
  
  const [desgasteModifier, setDesgasteModifier] = useState<number>(0);
  const [idealSetup, setIdealSetup] = useState<Record<string, any> | null>(null);

  // ==========================================================================
  // HIDRATAÇÃO GLOBAL
  // ==========================================================================
  useEffect(() => {
    async function loadGlobalData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
         setIsGlobalLoading(false);
         return;
      }

      try {
          const res = await fetch('/api/python?action=get_state', { 
            headers: { 'user-id': session.user.id } 
          });
          const json = await res.json();
          
          if (json.sucesso && json.data) {
              const d = json.data;
              
              if (d.current_track) setTrack(d.current_track);
              if (d.driver) setDriver(prev => ({ ...prev, ...d.driver }));
              if (d.test_points) setTestPoints(d.test_points);
              
              if (d.car) {
                  setCar(prev => {
                      const newCar = [...prev];
                      d.car.forEach((part: any, idx: number) => {
                          if (newCar[idx]) {
                              newCar[idx] = { ...newCar[idx], lvl: part.lvl, wear: part.wear };
                          }
                      });
                      return newCar;
                  });
              }
              
              if (d.tech_director) setTechDirector(prev => ({ ...prev, ...d.tech_director }));
              if (d.staff_facilities) setStaffFacilities(prev => ({ ...prev, ...d.staff_facilities }));
              if (d.weather) setWeather(prev => ({ ...prev, ...d.weather }));
              if (d.desgasteModifier !== undefined) setDesgasteModifier(Number(d.desgasteModifier));
              
              if (d.menu_data) {
                setMenuData(d.menu_data);
                console.log('✅ MenuData carregado:', d.menu_data.fullName);
              }
              
              if (d.office_data) {
                setOfficeData(d.office_data);
                console.log('✅ OfficeData carregado: Season', d.office_data.season, 'Race', d.office_data.race);
              }
              
              setIsDataSynced(true); 
          }
      } catch (e) { 
          console.error("Erro na hidratação global:", e); 
      } finally {
          setIsGlobalLoading(false);
      }
    }
    
    loadGlobalData();
  }, []);

  // --- Effects (Listas Estáticas) ---
  useEffect(() => {
    fetch('/api/python/tracks')
      .then(res => res.json())
      .then(data => { if (data.tracks) setTracksList(data.tracks); })
      .catch(err => console.error("Erro ao buscar pistas:", err));

    fetch('/api/python/tyre_suppliers')
      .then(res => res.json())
      .then(data => { if (data.sucesso) setTyreSuppliers(data.suppliers); })
      .catch(err => console.error("Erro ao buscar fornecedores:", err));
  }, []);

  // --- Memos ---
  const raceAvgTemp = useMemo(() => {
    const temps = [
      weather.r1_temp_min, weather.r1_temp_max, weather.r2_temp_min, weather.r2_temp_max,
      weather.r3_temp_min, weather.r3_temp_max, weather.r4_temp_min, weather.r4_temp_max
    ].map(Number);
    const sum = temps.reduce((a, b) => a + b, 0);
    return sum / 8 || 0;
  }, [weather]);

  // --- Logs ---
  useEffect(() => {
    if (menuData) {
      console.log('✅ MENU DATA:', { fullName: menuData.fullName, cash: menuData.cash });
    }
  }, [menuData]);

  useEffect(() => {
    if (officeData) {
      console.log('✅ OFFICE DATA:', { season: officeData.season, race: officeData.race, trackName: officeData.trackName });
    }
  }, [officeData]);

  useEffect(() => {
    if (driver) {
      console.log('✅ DRIVER:', { name: driver.name || 'N/A', overall: driver.overall || 'N/A' });
    }
  }, [driver]);

  // --- Callbacks ---
  const updateRole = useCallback((newRole: 'admin' | 'user') => setRole(newRole), []);
  const updateTrack = useCallback((t: string) => setTrack(t), []);
  
  const updateDriver = useCallback((field: keyof Driver, value: Driver[keyof Driver]) => {
    setDriver(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const updateCar = useCallback((index: number, field: 'lvl' | 'wear', value: number) => {
    setCar(prev => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const updateTechDirector = useCallback((data: Partial<TechDirector>) => {
    setTechDirector(prev => ({ ...prev, ...data }));
  }, []);
  
  const updateStaffFacilities = useCallback((data: Partial<StaffFacilities>) => {
    setStaffFacilities(prev => ({ ...prev, ...data }));
  }, []);
  
  const updateWeather = useCallback((data: Partial<WeatherData>) => {
    setWeather(prev => ({ ...prev, ...data }));
  }, []);
  
  const updateTestPoints = useCallback((data: Partial<TestPoints>) => {
    setTestPoints(prev => ({ ...prev, ...data }));
  }, []);
  
  const updateDesgasteModifier = useCallback((val: number) => setDesgasteModifier(val), []);
  const updateIdealSetup = useCallback((data: Record<string, any> | null) => setIdealSetup(data), []);
  const markDataAsSynced = useCallback(() => setIsDataSynced(true), []);

  // --- Render ---
  return (
    <GameContext.Provider value={{ 
      isGlobalLoading,
      isDataSynced,
      role,
      track, 
      tracksList, 
      tyreSuppliers, 
      driver, 
      car,
      techDirector,
      staffFacilities,
      weather, 
      testPoints,
      menuData,
      officeData,
      raceAvgTemp, 
      desgasteModifier,
      idealSetup,
      updateRole,
      updateTrack, 
      updateDriver, 
      updateCar,
      updateTechDirector,
      updateStaffFacilities,
      updateWeather,
      updateTestPoints,
      updateDesgasteModifier,
      updateIdealSetup,
      markDataAsSynced
    }}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================================================
// 4. HOOK PERSONALIZADO
// ============================================================================

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame deve ser usado dentro de um GameProvider');
  }
  return context;
}
// --- END OF FILE app/context/GameContext.tsx ---