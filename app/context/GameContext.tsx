// --- START OF FILE app/context/GameContext.tsx ---
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';

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

// NOVO TIPO: Diretor Técnico (Baseado no Excel)
export type TechDirector = {
  rdMecanico: number; 
  rdEletronico: number; 
  rdAerodinamico: number;
  experiencia: number; 
  pitCoord: number;
};

// NOVO TIPO: Pessoal e Instalações (Baseado no Excel)
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

// Interface do Contexto (O que fica visível para os componentes)
interface GameContextType {
  // Estados
  role: 'admin' | 'user';
  track: string;
  tracksList: string[];
  tyreSuppliers: string[];
  driver: Driver;
  car: CarPart[];
  
  // Novos Estados no Contexto
  techDirector: TechDirector;
  staffFacilities: StaffFacilities;

  weather: WeatherData;
  raceAvgTemp: number; 
  desgasteModifier: number;

  // Ações / Setters
  updateRole: (newRole: 'admin' | 'user') => void;
  updateTrack: (t: string) => void;
  updateDriver: (field: keyof Driver, value: number) => void;
  updateCar: (index: number, field: 'lvl' | 'wear', value: number) => void;
  
  // Novas Ações
  updateTechDirector: (data: Partial<TechDirector>) => void;
  updateStaffFacilities: (data: Partial<StaffFacilities>) => void;

  updateWeather: (data: Partial<WeatherData>) => void;
  updateDesgasteModifier: (val: number) => void;
}

// ============================================================================
// 2. ESTADOS INICIAIS (CONSTANTES)
// ============================================================================

const INITIAL_DRIVER: Driver = {
  concentracao: 150, talento: 200, agressividade: 0, experiencia: 50,
  tecnica: 50, resistencia: 50, carisma: 50, motivacao: 10,
  reputacao: 0, peso: 65, idade: 20, energia: 100, total: 0
};

const INITIAL_CAR: CarPart[] = [
  { name: "Chassi", lvl: 1, wear: 0 }, { name: "Motor", lvl: 1, wear: 0 },
  { name: "Asa dianteira", lvl: 1, wear: 0 }, { name: "Asa traseira", lvl: 1, wear: 0 },
  { name: "Assoalho", lvl: 1, wear: 0 }, { name: "Laterais", lvl: 1, wear: 0 },
  { name: "Radiador", lvl: 1, wear: 0 }, { name: "Câmbio", lvl: 1, wear: 0 },
  { name: "Freios", lvl: 1, wear: 0 }, { name: "Suspensão", lvl: 1, wear: 0 },
  { name: "Eletrônicos", lvl: 1, wear: 0 },
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

// ============================================================================
// 3. CRIAÇÃO DO CONTEXTO E PROVIDER
// ============================================================================

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  // --- States ---
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [track, setTrack] = useState<string>('Selecionar Pista');
  const [tracksList, setTracksList] = useState<string[]>([]);
  const [tyreSuppliers, setTyreSuppliers] = useState<string[]>([]);
  
  const [driver, setDriver] = useState<Driver>(INITIAL_DRIVER);
  const [car, setCar] = useState<CarPart[]>(INITIAL_CAR);
  
  // Novos Estados
  const [techDirector, setTechDirector] = useState<TechDirector>(INITIAL_TECH_DIRECTOR);
  const [staffFacilities, setStaffFacilities] = useState<StaffFacilities>(INITIAL_STAFF_FACILITIES);

  const [weather, setWeather] = useState<WeatherData>(INITIAL_WEATHER);
  const [desgasteModifier, setDesgasteModifier] = useState<number>(0);

  // --- Effects (Data Fetching) ---
  useEffect(() => {
    // Busca lista de pistas
    fetch('/api/python/tracks')
      .then(res => res.json())
      .then(data => { if (data.tracks) setTracksList(data.tracks); })
      .catch(err => console.error("Erro ao buscar pistas:", err));

    // Busca fornecedores de pneus
    fetch('/api/python/tyre_suppliers')
      .then(res => res.json())
      .then(data => { if (data.sucesso) setTyreSuppliers(data.suppliers); })
      .catch(err => console.error("Erro ao buscar fornecedores:", err));
  }, []);

  // --- Memos (Calculados) ---
  const raceAvgTemp = useMemo(() => {
    const temps = [
      weather.r1_temp_min, weather.r1_temp_max, weather.r2_temp_min, weather.r2_temp_max,
      weather.r3_temp_min, weather.r3_temp_max, weather.r4_temp_min, weather.r4_temp_max
    ].map(Number);
    
    const sum = temps.reduce((a, b) => a + b, 0);
    return sum / 8 || 0;
  }, [weather]);

  // --- Callbacks (Actions) ---
  const updateRole = useCallback((newRole: 'admin' | 'user') => { setRole(newRole); }, []);

  const updateTrack = useCallback((t: string) => { setTrack(t); }, []);
  const updateDriver = useCallback((field: keyof Driver, value: number) => { setDriver(prev => ({ ...prev, [field]: value })); }, []);
  const updateCar = useCallback((index: number, field: 'lvl' | 'wear', value: number) => {
    setCar(prev => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  // Novas Actions
  const updateTechDirector = useCallback((data: Partial<TechDirector>) => {
    setTechDirector(prev => ({ ...prev, ...data }));
  }, []);

  const updateStaffFacilities = useCallback((data: Partial<StaffFacilities>) => {
    setStaffFacilities(prev => ({ ...prev, ...data }));
  }, []);

  const updateWeather = useCallback((data: Partial<WeatherData>) => { setWeather(prev => ({ ...prev, ...data })); }, []);
  const updateDesgasteModifier = useCallback((val: number) => { setDesgasteModifier(val); }, []);

  // --- Render ---
  return (
    <GameContext.Provider value={{ 
      role,
      track, 
      tracksList, 
      tyreSuppliers, 
      driver, 
      car,
      techDirector,      // Expondo
      staffFacilities,   // Expondo
      weather, 
      raceAvgTemp,
      desgasteModifier,
      updateRole,
      updateTrack, 
      updateDriver, 
      updateCar,
      updateTechDirector,    // Expondo
      updateStaffFacilities, // Expondo
      updateWeather,
      updateDesgasteModifier
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