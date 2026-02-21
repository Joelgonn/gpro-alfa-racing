// --- START OF FILE app/context/GameContext.tsx ---
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Importando o Supabase para a verificação de sessão

// ============================================================================
// 1. DEFINIÇÃO DE TIPOS (TYPESCRIPT)
// ============================================================================

export type Driver = {
  concentracao: number; talento: number; agressividade: number; experiencia: number;
  tecnica: number; resistencia: number; carisma: number; motivacao: number;
  reputacao: number; peso: number; idade: number; energia: number; total: number;
};

export type CarPart = {
  name: string; lvl: number; wear: number;
};

export type TechDirector = {
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
  tempQ1: number; weatherQ1: string; tempQ2: number; weatherQ2: string;
  weatherRace: string; r1_temp_min: number; r1_temp_max: number;
  r2_temp_min: number; r2_temp_max: number; r3_temp_min: number; r3_temp_max: number;
  r4_temp_min: number; r4_temp_max: number;
};

// NOVO TIPO: Pontos de Teste (Vindo do Dashboard)
export type TestPoints = {
  power: number; handling: number; accel: number;
};

// Interface do Contexto
export interface GameContextType {
  // Estados Globais
  isGlobalLoading: boolean; // Flag de carregamento master (Novo)
  isDataSynced: boolean;    // Flag se os dados são reais do banco
  
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
  testPoints: TestPoints; // Estado movido para o contexto

  // Calculados
  raceAvgTemp: number;
  desgasteModifier: number;
  idealSetup: Record<string, any> | null;

  // Ações / Setters
  updateRole: (newRole: 'admin' | 'user') => void;
  updateTrack: (t: string) => void;
  updateDriver: (field: keyof Driver, value: number) => void;
  updateCar: (index: number, field: 'lvl' | 'wear', value: number) => void;
  updateTechDirector: (data: Partial<TechDirector>) => void;
  updateStaffFacilities: (data: Partial<StaffFacilities>) => void;
  updateWeather: (data: Partial<WeatherData>) => void;
  updateTestPoints: (data: Partial<TestPoints>) => void; // Nova Ação
  updateDesgasteModifier: (val: number) => void;
  updateIdealSetup: (data: Record<string, any> | null) => void;
  markDataAsSynced: () => void;
}

// ============================================================================
// 2. ESTADOS INICIAIS (CONSTANTES)
// ============================================================================

const INITIAL_DRIVER: Driver = {
  concentracao: 0, talento: 0, agressividade: 0, experiencia: 0,
  tecnica: 0, resistencia: 0, carisma: 0, motivacao: 0,
  reputacao: 0, peso: 0, idade: 0, energia: 0, total: 0
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
  rdMecanico: 0, rdEletronico: 0, rdAerodinamico: 0, experiencia: 0, pitCoord: 0
};

const INITIAL_STAFF_FACILITIES: StaffFacilities = {
  toleranciaPressao: 0, concentracao: 0
};

const INITIAL_WEATHER: WeatherData = {
  tempQ1: 0, weatherQ1: 'Dry', tempQ2: 0, weatherQ2: 'Dry', weatherRace: 'Dry',
  r1_temp_min: 0, r1_temp_max: 0, r2_temp_min: 0, r2_temp_max: 0,
  r3_temp_min: 0, r3_temp_max: 0, r4_temp_min: 0, r4_temp_max: 0,
};

const INITIAL_TEST_POINTS: TestPoints = { power: 0, handling: 0, accel: 0 };

// ============================================================================
// 3. CRIAÇÃO DO CONTEXTO E PROVIDER
// ============================================================================

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  // --- States Globais de Controle ---
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(true); // Começa true bloqueando as telas
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
  
  const [desgasteModifier, setDesgasteModifier] = useState<number>(0);
  const [idealSetup, setIdealSetup] = useState<Record<string, any> | null>(null);

  // ==========================================================================
  // O CORAÇÃO DO SISTEMA: HIDRATAÇÃO GLOBAL (Acorda no F5 / Login)
  // ==========================================================================
  useEffect(() => {
    async function loadGlobalData() {
      // 1. Verifica sessão
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se não tem sessão, libera o loading para a página redirecionar para o /login
      if (!session) {
         setIsGlobalLoading(false);
         return;
      }

      // 2. Busca dados no banco para o usuário logado
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
              
              // Mescla o carro preservando o nome das peças (Caso API retorne só lvl e wear)
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
              
              // Avisa que os dados foram puxados com sucesso do banco
              setIsDataSynced(true); 
          }
      } catch (e) { 
          console.error("Erro na hidratação global (Contexto):", e); 
      } finally {
          // Independente de dar erro ou sucesso, libera a tela de carregamento
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

  // --- Callbacks (Actions) ---
  const updateRole = useCallback((newRole: 'admin' | 'user') => setRole(newRole), []);
  const updateTrack = useCallback((t: string) => setTrack(t), []);
  const updateDriver = useCallback((field: keyof Driver, value: number) => setDriver(prev => ({ ...prev, [field]: value })), []);
  
  const updateCar = useCallback((index: number, field: 'lvl' | 'wear', value: number) => {
    setCar(prev => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const updateTechDirector = useCallback((data: Partial<TechDirector>) => setTechDirector(prev => ({ ...prev, ...data })), []);
  const updateStaffFacilities = useCallback((data: Partial<StaffFacilities>) => setStaffFacilities(prev => ({ ...prev, ...data })), []);
  const updateWeather = useCallback((data: Partial<WeatherData>) => setWeather(prev => ({ ...prev, ...data })), []);
  const updateTestPoints = useCallback((data: Partial<TestPoints>) => setTestPoints(prev => ({ ...prev, ...data })), []);
  
  const updateDesgasteModifier = useCallback((val: number) => setDesgasteModifier(val), []);
  const updateIdealSetup = useCallback((data: Record<string, any> | null) => setIdealSetup(data), []);
  const markDataAsSynced = useCallback(() => setIsDataSynced(true), []);

  // --- Render ---
  return (
    <GameContext.Provider value={{ 
      isGlobalLoading, // Expondo
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
      testPoints,      // Expondo
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
      updateTestPoints, // Expondo
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