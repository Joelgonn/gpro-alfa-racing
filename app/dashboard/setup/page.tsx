'use client';

import { useState, useEffect, ChangeEvent, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useGame } from '../../context/GameContext';

import {
  Loader2, Settings, ShieldAlert,
  MapPin, ChevronDown, Search, X, ShieldCheck,
  CloudSun, Thermometer, Sun, CloudRain, FlaskConical, Timer, Wind, Gauge, Snowflake, Flame, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { calculateSetupService } from "@/services/setupService";

// --- MAPEAMENTOS ---
const TRACK_FLAGS: { [key: string]: string } = { "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be" };

const COMPONENTS = [
    { id: 'chassi', label: 'Chassi' },
    { id: 'motor', label: 'Motor' },
    { id: 'asaDianteira', label: 'Asa Dianteira' },
    { id: 'asaTraseira', label: 'Asa Traseira' },
    { id: 'assoalho', label: 'Assoalho' },
    { id: 'laterais', label: 'Laterais' },
    { id: 'radiador', label: 'Radiador' },
    { id: 'cambio', label: 'Câmbio' },
    { id: 'freios', label: 'Freios' },
    { id: 'suspensao', label: 'Suspensão' },
    { id: 'eletronicos', label: 'Eletrônicos' }
];

const clampSetupDisplay = (value: unknown): unknown => {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return Math.max(0, Math.min(999, num));
};

// --- SELETOR DE PISTA PREMIUM (GELO) - OTIMIZADO PARA MOBILE ---
function TrackSelector({ currentTrack, tracksList, onSelect, placeholder = "SELETO DE PISTA" }: { currentTrack: string, tracksList: any[], onSelect: (t: string) => void, placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const filteredTracks = useMemo(() => {
        return tracksList.filter((track: any) => {
            const name = typeof track === 'object' ? (track.name || "") : (track || "");
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }, [tracksList, search]);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="
                    flex items-center gap-2 sm:gap-2.5 
                    text-[9px] sm:text-xs 
                    text-slate-800 font-black tracking-wider 
                    hover:text-emerald-600 transition-all duration-300 
                    outline-none group 
                    bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 
                    rounded-lg sm:rounded-xl 
                    border border-slate-200 
                    active:scale-[0.98] 
                    shadow-sm hover:shadow-md 
                    min-w-[100px] sm:min-w-[140px]
                    truncate
                "
            >
                <span className="truncate text-[9px] sm:text-xs">
                    {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : placeholder}
                </span>
                <ChevronDown 
                    className={`
                        transition-transform duration-300 
                        text-slate-400 group-hover:text-emerald-600 
                        ${isOpen ? 'rotate-180' : ''}
                        w-3 h-3 sm:w-4 sm:h-4
                    `} 
                    size={14} 
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }} 
                        className="absolute top-full left-0 mt-2 w-[240px] sm:w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[60]"
                    >
                        <div className="p-2 sm:p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    autoFocus 
                                    type="text" 
                                    placeholder="Buscar pista..." 
                                    value={search} 
                                    onChange={(e) => setSearch(e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 outline-none font-bold uppercase tracking-wider" 
                                />
                                {search && (
                                    <button 
                                        onClick={() => setSearch('')} 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[200px] sm:max-h-[220px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5 bg-white">
                            {filteredTracks.map((track: any) => {
                                const name = typeof track === 'object' ? track.name : track;
                                return (
                                    <button
                                        key={name}
                                        onClick={() => { onSelect(name); setIsOpen(false); setSearch(""); }}
                                        className={`
                                            w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 
                                            rounded-lg text-[9px] sm:text-xs 
                                            font-black uppercase tracking-wider 
                                            flex items-center justify-between group transition-all
                                            ${currentTrack === name 
                                                ? 'bg-emerald-600 text-white' 
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 sm:gap-2.5">
                                            {TRACK_FLAGS[name] ? (
                                                <img src={`/flags/${TRACK_FLAGS[name]}.png`} alt={name} className="w-3 h-2 sm:w-4 sm:h-2.5 object-cover rounded-sm shadow-sm" />
                                            ) : (
                                                <div className="w-3 h-2 sm:w-4 sm:h-2.5 bg-slate-100 rounded-sm border border-slate-200"></div>
                                            )}
                                            <span className="truncate max-w-[120px] sm:max-w-none">{name}</span>
                                        </div>
                                        {currentTrack === name && <ShieldCheck size={12} className="shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- WEATHER FORECAST HUD ---
interface WeatherForecastProps {
    weatherData: {
        r1_rain_chance?: number;
        r2_rain_chance?: number;
        r3_rain_chance?: number;
        r4_rain_chance?: number;
        weatherRace?: string;
    };
}

function WeatherForecastHUD({ weatherData }: WeatherForecastProps) {
  const rainChances = [
      weatherData?.r1_rain_chance ?? 0,
      weatherData?.r2_rain_chance ?? 0,
      weatherData?.r3_rain_chance ?? 0,
      weatherData?.r4_rain_chance ?? 0,
  ];

  const maxChance = Math.max(...rainChances);

  const getForecast = (chance: number) => {
      if (chance === 0) {
          return {
              icon: '☀️',
              title: 'Tempo Seco',
              description: 'Sem previsão de chuva durante a corrida.',
              color: 'text-emerald-600',
              bgColor: 'border-emerald-200 bg-emerald-50/50',
          };
      } else if (chance <= 30) {
          return {
              icon: '🌤️',
              title: 'Baixa Probabilidade',
              description: `Instabilidade de até ${Math.round(chance)}%. Condições secas predominantes.`,
              color: 'text-amber-600',
              bgColor: 'border-amber-200 bg-amber-50/50',
          };
      } else if (chance <= 60) {
          return {
              icon: '⛅',
              title: 'Chance Moderada',
              description: `Probabilidade de ${Math.round(chance)}%. Alerta para mudanças rápidas.`,
              color: 'text-orange-600',
              bgColor: 'border-orange-200 bg-orange-50/50',
          };
      } else if (chance <= 85) {
          return {
              icon: '🌧️',
              title: 'Alta Probabilidade',
              description: `Previsão de chuva de ${Math.round(chance)}%. Esteja pronto para pneus de chuva.`,
              color: 'text-blue-600',
              bgColor: 'border-blue-200 bg-blue-50/50',
          };
      } else {
          return {
              icon: '⛈️',
              title: 'Pista Molhada',
              description: `Chuva de ${Math.round(chance)}%. Configuração para chuva recomendada.`,
              color: 'text-indigo-600',
              bgColor: 'border-indigo-200 bg-indigo-50/50',
          };
      }
  };

  const forecast = getForecast(maxChance);

  return (
      <div className={`border rounded-xl p-3.5 flex flex-col justify-center text-left text-xs relative overflow-hidden transition-all duration-300 shadow-sm ${forecast.bgColor}`}>
          <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5" role="img" aria-label="clima">{forecast.icon}</span>
              <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[11px] font-black uppercase tracking-wider ${forecast.color}`}>{forecast.title}</span>
                      <span className="text-[9px] text-slate-500 font-mono font-black">MÁX: {Math.round(maxChance)}%</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-bold mb-2.5">{forecast.description}</p>

                  <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-200/50">
                      {rainChances.map((chance, index) => (
                          <div key={index} className="space-y-1">
                              <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase leading-none">
                                  <span>P{index + 1}</span>
                                  <span className={chance > 50 ? 'text-indigo-600 font-bold' : 'text-slate-500'}>{Math.round(chance)}%</span>
                              </div>
                              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${chance > 50 ? 'bg-indigo-500' : 'bg-slate-400'}`} style={{ width: `${chance}%` }} />
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );
}

// --- INPUTS COMPACTOS ---
function HUDInput({ value, name, onChange, label }: any) {
    const val = Number(value);
    const getIconColor = () => {
        if (!value) return "text-slate-400";
        if (val < 15) return "text-emerald-500";
        if (val < 30) return "text-amber-500";
        return "text-rose-500";
    };

    const IconComponent = !value ? Thermometer : (val < 15 ? Snowflake : (val > 30 ? Flame : Thermometer));

    return (
        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between group hover:border-emerald-500/30 transition-all h-20 shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                <IconComponent size={14} className={`transition-colors duration-500 ${getIconColor()}`} />
            </div>
            <div className="flex items-baseline gap-0.5">
                <input
                    type="number"
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    placeholder="-"
                    className="bg-transparent text-slate-800 font-black text-2xl font-mono outline-none w-full placeholder-slate-200"
                />
                <span className="text-[11px] text-slate-400 font-black">°C</span>
            </div>
        </div>
    )
}

function WeatherSwitchEditable({ name, value, onChange }: any) {
    const isDry = value === 'Dry';
    return (
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 h-9.5 w-full overflow-hidden relative shadow-inner">
            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange({ target: { name, value: 'Dry' } })}
                className={`flex-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 relative z-10 ${
                    isDry ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                {isDry && <motion.div layoutId={`bg-weather-${name}`} className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-md -z-10 shadow-sm" />}
                <Sun size={12} className={isDry ? "animate-[spin_12s_linear_infinite]" : ""} /> Seco
            </motion.button>

            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange({ target: { name, value: 'Wet' } })}
                className={`flex-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 relative z-10 ${
                    !isDry ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                {!isDry && <motion.div layoutId={`bg-weather-${name}`} className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-md -z-10 shadow-sm" />}
                <CloudRain size={12} /> Chuva
            </motion.button>
        </div>
    )
}

// --- SETUP CARD SUGERIDO HORIZONTAL ---
function SetupCard({ part, data }: { part: string, data: any }) {
    const safeRender = (val: any) => (val === null || val === undefined || typeof val === 'object') ? '-' : val;
    const clampedQ1 = clampSetupDisplay(data?.q1);
    const clampedQ2 = clampSetupDisplay(data?.q2);
    const clampedRace = clampSetupDisplay(data?.race);

    return (
        <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 transition-all flex items-center justify-between shadow-sm min-h-[48px] group hover:shadow-md">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider truncate w-28">
                {part.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-50 border border-rose-300 min-w-[40px] justify-center shadow-sm">
                    <span className="text-[7px] font-black text-rose-500 uppercase">Q1</span>
                    <span className="text-xs font-black font-mono leading-none text-rose-700">
                        {safeRender(clampedQ1)}
                    </span>
                </div>
                
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-50 border border-amber-300 min-w-[40px] justify-center shadow-sm">
                    <span className="text-[7px] font-black text-amber-600 uppercase">Q2</span>
                    <span className="text-xs font-black font-mono leading-none text-amber-700">
                        {safeRender(clampedQ2)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-0.5 rounded bg-emerald-50 border border-emerald-300 min-w-[46px] justify-center shadow-sm">
                    <span className="text-[7px] font-black text-emerald-600 uppercase tracking-wider">R</span>
                    <span className="text-sm font-black leading-none font-mono text-emerald-700">
                        {safeRender(clampedRace)}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function SetupPage() {
  const router = useRouter();

  const {
      track, updateTrack,
      driverEditable, updateDriverEditable,
      car, updateCar,
      weather, updateWeather,
      desgasteModifier, updateDesgasteModifier,
      techDirector, updateTechDirector,
      staffFacilities, updateStaffFacilities
  } = useGame();

  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [initialHydrationDone, setInitialHydrationDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');

  const [testTrack, setTestTrack] = useState<string>("Selecionar Pista");
  const [testLaps, setTestLaps] = useState<number>(0);
  const [testResults, setTestResults] = useState<any>(null);

  const [raceAvgTemp, setRaceAvgTemp] = useState<number>(20);

  const hasTestingLimitWarning = useMemo(() => {
      if (!testResults) return false;
      return Object.values(testResults).some((part: any) => {
          return part.pre_race && part.pre_race > 90.4;
      });
  }, [testResults]);

  // Auth Check
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }
        setUserId(session.user.id);
        if(session.user.email) setUserEmail(session.user.email);
      } catch (error) { console.error("Auth error:", error); router.push('/login'); }
      finally { setIsAuthLoading(false); }
    }
    checkSession();
  }, [router]);

  // Hydrate
  useEffect(() => {
    async function hydrate() {
      if (!userId || isAuthLoading) return;
      try {
        const [resT, resS] = await Promise.all([
          fetch('/api/python?action=tracks'),
          fetch('/api/python?action=get_state', { headers: { 'user-id': userId }})
        ]);
        const dTracks = await resT.json();
        const dState = await resS.json();

        if (dTracks.tracks) setTracks(dTracks.tracks);
        if (dState.sucesso && dState.data) {
          const d = dState.data;
          if (d.current_track) updateTrack(d.current_track);
          
          if (d.weather) {
            updateWeather(d.weather);
            
            const r1Min = d.weather.r1_temp_min !== undefined ? d.weather.r1_temp_min : d.weather.r1TempMin;
            const r1Max = d.weather.r1_temp_max !== undefined ? d.weather.r1_temp_max : d.weather.r1TempMax;
            const tQ1 = d.weather.tempQ1 !== undefined ? d.weather.tempQ1 : d.weather.temp_q1;
            const tQ2 = d.weather.tempQ2 !== undefined ? d.weather.tempQ2 : d.weather.temp_q2;

            if (r1Min !== undefined && r1Max !== undefined && Number(r1Min) > 0 && Number(r1Max) > 0) {
              setRaceAvgTemp((Number(r1Min) + Number(r1Max)) / 2);
            } else if (tQ1 !== undefined && tQ2 !== undefined && Number(tQ1) > 0 && Number(tQ2) > 0) {
              setRaceAvgTemp((Number(tQ1) + Number(tQ2)) / 2);
            }
          }
          
          if (d.driver_editable) {
            Object.entries(d.driver_editable).forEach(([k, v]) => {
              updateDriverEditable(k as any, Number(v));
            });
          }
          
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });
          if (d.tech_director) updateTechDirector(d.tech_director);
          if (d.staff_facilities) updateStaffFacilities(d.staff_facilities);
          if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
        }
      } catch (e) { console.error("Hydrate error:", e); }
      finally { setInitialHydrationDone(true); }
    }
    hydrate();
  }, [userId, isAuthLoading, updateTrack, updateWeather, updateDriverEditable, updateCar, updateTechDirector, updateStaffFacilities, updateDesgasteModifier]);

  // Auto-Save
  const persistChanges = useCallback(async () => {
      if (!initialHydrationDone || !userId) return;
      setIsSyncing(true);
      try {
          await fetch('/api/python?action=update_state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'user-id': userId },
              body: JSON.stringify({
                  track,
                  weather,
                  desgasteModifier,
                  driver_editable: driverEditable,
                  car,
                  tech_director: techDirector,
                  staff_facilities: staffFacilities
              })
          });
      } catch (e) {
          console.error("Erro ao salvar:", e);
      } finally {
          setIsSyncing(false);
      }
  }, [track, weather, desgasteModifier, driverEditable, car, techDirector, staffFacilities, initialHydrationDone, userId]);

  useEffect(() => {
      if (!initialHydrationDone || !userId) return;
      const timer = setTimeout(() => { persistChanges(); }, 2000);
      return () => clearTimeout(timer);
  }, [track, weather, desgasteModifier, techDirector, staffFacilities, persistChanges, initialHydrationDone, userId]);

  // Calculation Setup - CORRIGIDO: driver_editable -> driver
  const handleCalcular = useCallback(async () => {
    if (!userId || !track || track === "Selecionar Pista" || !initialHydrationDone) return;
    setLoading(true);
    try {
      const data = await calculateSetupService(
        {
          pista: track,
          driver: driverEditable,
          car,
          tech_director: techDirector,
          staff_facilities: staffFacilities,
          tempQ1: weather.tempQ1,
          tempQ2: weather.tempQ2,
          weatherQ1: weather.weatherQ1,
          weatherQ2: weather.weatherQ2,
          weatherRace: weather.weatherRace,
          raceAvgTemp,
          desgasteModifier
        },
        userId
      );

      if (data.sucesso) {
          setResultado(data.data);
      }
    } catch (error) { console.error("Calc error:", error); }
    finally { setLoading(false); }
  }, [userId, track, driverEditable, car, techDirector, staffFacilities, weather, raceAvgTemp, desgasteModifier, initialHydrationDone]);

  useEffect(() => {
    if (initialHydrationDone && userId && track && track !== "Selecionar Pista") {
      const timer = setTimeout(() => { handleCalcular(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [weather, track, desgasteModifier, techDirector, staffFacilities, handleCalcular, initialHydrationDone, userId]);

  // Simulador de Testes - CORRIGIDO: driver_editable -> driver
  const handleCalculateTest = useCallback(async () => {
    if (!userId || !testTrack || testTrack === "Selecionar Pista" || !initialHydrationDone) {
        setTestResults(null);
        return;
    }
    try {
        const res = await fetch('/api/python?action=test_calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify({
                test_track: testTrack,
                test_laps: testLaps,
                driver: driverEditable,
                car,
                tech_director: techDirector,
                staff_facilities: staffFacilities,
                desgasteModifier
            })
        });
        const data = await res.json();
        if (data.sucesso) setTestResults(data.data);
    } catch (error) { console.error("Test Calc Error:", error); }
  }, [userId, testTrack, testLaps, driverEditable, car, techDirector, staffFacilities, desgasteModifier, initialHydrationDone]);

  useEffect(() => {
      if(testTrack !== "Selecionar Pista") {
          const timer = setTimeout(() => { handleCalculateTest(); }, 500);
          return () => clearTimeout(timer);
      } else {
          setTestResults(null);
      }
  }, [testTrack, testLaps, handleCalculateTest]);

  const handleWeatherChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isText = name.includes('weather');
    updateWeather({ [name]: isText ? value : Number(value) });
    
    if (name === 'r1_temp_min' || name === 'r1_temp_max') {
      const min = name === 'r1_temp_min' ? Number(value) : Number(weather.r1_temp_min);
      const max = name === 'r1_temp_max' ? Number(value) : Number(weather.r1_temp_max);
      if (!isNaN(min) && !isNaN(max) && min > 0 && max > 0) {
        setRaceAvgTemp((min + max) / 2);
      }
    }
  };

  const handleTestLapsChange = (e: ChangeEvent<HTMLInputElement>) => {
      let val = parseInt(e.target.value);
      if(isNaN(val)) val = 0;
      if(val > 100) val = 100;
      if(val < 0) val = 0;
      setTestLaps(val);
  };

  const safeNumber = (val: any) => (typeof val === 'number') ? val : (isNaN(parseFloat(val)) ? 0 : parseFloat(val));

  const getWearColor = (val: number) => {
      if(val > 85) return 'text-rose-600 bg-rose-50 border-rose-200 font-bold';
      if(val > 50) return 'text-amber-600 border-amber-200/50 bg-amber-50/20';
      return 'text-emerald-600 border-emerald-200 bg-emerald-50/10';
  };

  const isTestActive = testTrack !== "Selecionar Pista";

  if (isAuthLoading || !initialHydrationDone) return (
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
      <div className="w-12 h-12 border-2 border-emerald-500/10 rounded-full flex items-center justify-center relative">
        <div className="w-12 h-12 border-2 border-t-emerald-600 rounded-full animate-spin absolute" />
        <Settings size={16} className="animate-pulse text-emerald-600" />
      </div>
      <span className="tracking-widest uppercase font-bold text-xs">CARREGANDO SETUP...</span>
    </div>
  );
  if (!userId) return null;

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 md:pb-12 selection:bg-emerald-500/20 relative overflow-hidden">
      
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.01] blur-[150px] rounded-full" />
      </div>

      {/* HEADER BAR (ICE MODE) - OTIMIZADO PARA MOBILE */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 bg-white/90 p-3 sm:p-4 relative shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 relative z-10">
          
          {/* ESQUERDA: Logo + Título */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg sm:rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] shrink-0">
              <Settings size={14} className="sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                Setup & Telemetria
                <span className="text-[7px] sm:text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase truncate max-w-[100px] sm:max-w-[120px]">{userEmail}</p>
            </div>
          </div>
          
          {/* DIREITA: Circuito + Status + Temp */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto">
            
            {/* Circuito Selecionado */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 sm:pr-4">
              <div className="w-7 h-5 sm:w-8 sm:h-6 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {track && TRACK_FLAGS[track] ? (
                  <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] sm:text-xs">🏁</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[6px] sm:text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">Circuito</span>
                <TrackSelector currentTrack={track} tracksList={tracks} onSelect={updateTrack} />
              </div>
            </div>

            {/* Status + Temperatura */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                <span className={`text-[8px] sm:text-[10px] font-bold ${isSyncing ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {isSyncing ? 'GRAVANDO' : 'GRAVADO'}
                </span>
              </div>
              
              <div className="text-right border-l border-slate-200 pl-3 sm:pl-4 shrink-0 flex flex-col justify-center">
                <p className="text-[7px] sm:text-[8px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5 sm:mb-1">Temp. Média</p>
                <p className="text-base sm:text-xl font-black text-emerald-600 leading-none">
                  {raceAvgTemp !== undefined && raceAvgTemp !== null && raceAvgTemp > 0 
                    ? `${Number(raceAvgTemp).toFixed(1)}°C` 
                    : '20.0°C'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10">
        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          
          {/* SESSÕES METEOROLÓGICAS */}
          <div className="xl:col-span-7">
            <section className="relative bg-white/90 border border-slate-200 shadow-sm rounded-2xl overflow-hidden backdrop-blur-sm group hover:shadow-md hover:border-slate-300 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-lg">
                  <CloudSun size={14} className="text-white" />
                </div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Previsões Meteorológicas</h3>
              </div>
              
              <div className="relative p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3.5">
                  {/* QUALIFICAÇÃO Q1 */}
                  <div className="bg-[#f8fafc] rounded-xl p-3 border border-rose-100 hover:border-rose-300 transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1.5 h-3.5 bg-gradient-to-b from-rose-400 to-rose-600 rounded-full" />
                          Qualificação Q1
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        <WeatherSwitchEditable name="weatherQ1" value={weather.weatherQ1 || 'Dry'} onChange={handleWeatherChange} />
                        <HUDInput value={weather.tempQ1} name="tempQ1" onChange={handleWeatherChange} label="TEMP Q1" />
                      </div>
                    </div>
                  </div>

                  {/* QUALIFICAÇÃO Q2 */}
                  <div className="bg-[#f8fafc] rounded-xl p-3 border border-amber-100 hover:border-amber-300 transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1.5 h-3.5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
                          Qualificação Q2
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        <WeatherSwitchEditable name="weatherQ2" value={weather.weatherQ2 || 'Dry'} onChange={handleWeatherChange} />
                        <HUDInput value={weather.tempQ2} name="tempQ2" onChange={handleWeatherChange} label="TEMP Q2" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SESSÃO CORRIDA */}
                <div className="bg-emerald-50/10 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden p-3.5 h-full group shadow-sm hover:shadow-md">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-3.5 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                          <Wind size={12} className="text-emerald-600" />
                          Sessão Corrida
                        </h3>
                      </div>
                      <div className="text-right bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black text-emerald-600 font-mono leading-none">
                          {raceAvgTemp !== undefined && raceAvgTemp !== null && raceAvgTemp > 0 
                            ? `${Number(raceAvgTemp).toFixed(1)}°` 
                            : '20.0°'}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <WeatherSwitchEditable
                        name="weatherRace"
                        value={weather.weatherRace || 'Dry'}
                        onChange={handleWeatherChange}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                      {[1, 2, 3, 4].map(num => (
                        <div key={num} className="bg-white rounded-xl p-2 border border-slate-200 hover:border-emerald-300 transition-colors flex flex-col justify-between shadow-sm hover:shadow-md">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 rounded w-fit mb-2">P{num}</span>
                          <div className="flex items-center justify-between gap-1.5 font-mono">
                            <div className="flex flex-col">
                              <span className="text-[7px] text-emerald-600 font-bold uppercase leading-none mb-1">Min</span>
                              <input
                                type="number"
                                name={`r${num}_temp_min`}
                                value={(weather as any)[`r${num}_temp_min`] || ''}
                                onChange={handleWeatherChange}
                                className="w-full bg-transparent text-sm font-black text-slate-800 outline-none p-0 leading-none placeholder-slate-200"
                                placeholder="-"
                              />
                            </div>
                            <div className="w-[1px] h-4 bg-slate-200" />
                            <div className="flex flex-col items-end">
                              <span className="text-[7px] text-rose-500 font-bold leading-none mb-1">Max</span>
                              <input
                                type="number"
                                name={`r${num}_temp_max`}
                                value={(weather as any)[`r${num}_temp_max`] || ''}
                                onChange={handleWeatherChange}
                                className="w-full bg-transparent text-right text-sm font-black text-rose-500 outline-none p-0 leading-none placeholder-slate-200"
                                placeholder="-"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <WeatherForecastHUD weatherData={weather} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* SETUP SUGERIDO */}
          <div className="xl:col-span-5">
            <AnimatePresence mode='wait'>
              {resultado && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative bg-white/90 border border-slate-200 shadow-sm rounded-2xl overflow-hidden backdrop-blur-sm h-full flex flex-col group hover:shadow-md hover:border-slate-300 transition-all duration-300">
                  <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-600 rounded-lg">
                        <Settings size={14} className="text-white" />
                      </div>
                      <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Sugestões de Setup</h3>
                    </div>
                    {loading && <Loader2 className="animate-spin text-emerald-600" size={12} />}
                  </div>
                  
                  <div className="relative p-4 flex-grow">
                    <div className="flex flex-col gap-1.5">
                      {['asaDianteira', 'asaTraseira', 'motor', 'freios', 'cambio', 'suspensao'].map((partId) => (
                        <SetupCard key={partId} part={partId} data={resultado[partId]} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {!resultado && (
                <div className="h-full bg-white/90 border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 border-dashed min-h-[350px] shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center animate-pulse mb-3">
                    <Gauge size={24} className="opacity-40 text-slate-500" />
                  </div>
                  <p className="text-[11px] uppercase font-black tracking-widest text-slate-500">Aguardando Parâmetros</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] text-center font-bold">Informe as configurações de clima e as especificações de pista acima.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* TABELAS DE PROJEÇÃO DE DESGASTE */}
        {resultado && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            
            {/* DESGASTE ESTIMADO CORRIDA */}
            <section className="relative bg-white/90 border border-slate-200 shadow-sm rounded-2xl overflow-hidden backdrop-blur-sm group hover:shadow-md hover:border-slate-300 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500 rounded-lg shadow-sm">
                    <ShieldAlert size={14} className="text-white" />
                  </div>
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Desgaste Estimado Corrida</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-500 font-black uppercase">Risco</span>
                  <input type="number" value={desgasteModifier} onChange={(e) => updateDesgasteModifier(Number(e.target.value))} className="w-9 h-6 bg-white border border-slate-200 rounded text-slate-800 text-center text-[10px] font-mono font-black outline-none focus:border-emerald-500 shadow-sm hover:shadow-md transition-shadow" />
                </div>
              </div>
              <div className="relative p-4 space-y-3.5 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                {COMPONENTS.map((part) => {
                  const d = resultado[part.id]?.wear;
                  if (!d) return null;
                  const startVal = safeNumber(d.start);
                  const endVal = safeNumber(d.end);
                  const isCritical = endVal > 85;
                  return (
                    <div key={part.id} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className="text-slate-500">{part.label}</span>
                        <span className="text-slate-700 font-mono font-bold">{startVal}% → <span className={isCritical ? 'text-rose-600 font-black animate-pulse' : 'text-slate-800'}>{endVal.toFixed(1)}%</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/50 p-[1px]">
                        <div className="h-full bg-slate-400 rounded-l-full" style={{ width: `${Math.min(100, startVal)}%` }} />
                        <div className={`h-full rounded-r-full ${isCritical ? 'bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, endVal - startVal))}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* SIMULADOR DE TESTES */}
            <section className="relative bg-white/90 border border-slate-200 shadow-sm rounded-2xl overflow-hidden backdrop-blur-sm flex flex-col group hover:shadow-md hover:border-slate-300 transition-all duration-300">
              <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 rounded-lg">
                      <FlaskConical size={14} className="text-white" />
                    </div>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Simulador de Testes</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <TrackSelector currentTrack={testTrack} tracksList={tracks} onSelect={setTestTrack} placeholder="SIMULAR TESTES NA PISTA" />
                    {isTestActive && (
                      <>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 h-9 shadow-sm hover:shadow-md transition-shadow">
                          <Timer size={12} className="text-slate-400" />
                          <div className="flex flex-col text-left">
                            <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Voltas (0-100)</span>
                            <input
                              type="number"
                              value={testLaps}
                              onChange={handleTestLapsChange}
                              className="bg-transparent text-[11px] font-mono font-black text-slate-800 outline-none w-10 mt-0.5 leading-none"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => { setTestTrack("Selecionar Pista"); setTestLaps(0); setTestResults(null); }}
                          className="h-9 w-9 flex items-center justify-center bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-100 hover:border-rose-500 rounded-xl transition-all shadow-sm hover:shadow-md"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {hasTestingLimitWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-left"
                    >
                      <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={13} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-rose-600 uppercase">Limite Técnico de Desgaste Excedido</span>
                        <p className="text-[9px] text-rose-700/80 leading-tight mt-0.5 font-bold">
                          Algumas peças atingirão mais de 90.4% de desgaste pré-corrida. O GPRO bloqueará a execução desta sessão.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative p-4 overflow-x-auto custom-scrollbar flex-grow bg-white">
                <table className="w-full text-xs border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="sticky left-0 bg-slate-50 z-20 pl-3 pr-2 py-2 text-left border-b border-slate-200 w-auto whitespace-nowrap shadow-sm">Peça</th>
                      <th className="px-1 py-2 text-center border-b border-slate-200 whitespace-nowrap w-min">Nvl</th>
                      <th className="px-1 py-2 text-center border-b border-slate-200 whitespace-nowrap">Início</th>
                      {isTestActive && (
                        <>
                          <th className="px-1 py-2 text-center text-amber-600 border-b border-slate-200 whitespace-nowrap">Teste</th>
                          <th className="px-1 py-2 text-center text-indigo-600 border-b border-slate-200 whitespace-nowrap">Pré-Cor</th>
                        </>
                      )}
                      <th className="px-1 py-2 text-center text-rose-500 border-b border-slate-200 whitespace-nowrap">Fim Corrida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPONENTS.map((part, index) => {
                      const lvl = car[index]?.lvl || 1;
                      const startWear = car[index]?.wear || 0;
                      const testWearVal = testResults ? testResults[part.id]?.test_wear : 0;
                      const preRaceVal = testResults ? testResults[part.id]?.pre_race : startWear;
                      const isLimitBroken = isTestActive && typeof preRaceVal === 'number' && preRaceVal > 90.4;

                      let calculatedFinalWear = 0;
                      if (resultado && resultado[part.id]?.wear) {
                        const originalStart = safeNumber(resultado[part.id].wear.start);
                        const originalEnd = safeNumber(resultado[part.id].wear.end);
                        const raceDegradation = Math.max(0, originalEnd - originalStart);
                        const baseForRace = (isTestActive && typeof preRaceVal === 'number') ? preRaceVal : startWear;
                        calculatedFinalWear = baseForRace + raceDegradation;
                      }

                      return (
                        <tr key={part.id} className={`group transition-colors ${isLimitBroken ? 'bg-rose-50' : 'hover:bg-slate-50/50'}`}>
                          <td className="sticky left-0 bg-slate-50 z-10 pl-3 pr-2 py-1.5 border-r border-slate-200 font-black text-[10px] text-slate-500 uppercase shadow-sm whitespace-nowrap">
                            {part.label}
                          </td>
                          <td className="px-1 py-1 text-center bg-slate-50/40 w-min">
                            <div className="mx-auto w-6 bg-white border border-slate-200 rounded text-[10px] font-mono font-black text-slate-400 py-0.5">{lvl}</div>
                          </td>
                          <td className="px-1 py-1 text-center bg-slate-50/40">
                            <div className={`mx-auto w-10 bg-white border border-slate-200 rounded text-[10px] font-mono font-black py-0.5 ${getWearColor(startWear).split(' ')[0]}`}>
                              {startWear}%
                            </div>
                          </td>
                          {isTestActive && (
                            <>
                              <td className="px-1 py-1 text-center bg-slate-50/40 text-[11px] font-mono font-black text-amber-600 whitespace-nowrap">
                                +{typeof testWearVal === 'number' ? testWearVal.toFixed(1) : '0.0'}%
                              </td>
                              <td className="px-1 py-1 text-center bg-slate-50/40 whitespace-nowrap relative">
                                <div className={`text-[11px] font-mono font-black transition-all ${isLimitBroken ? 'text-rose-500 scale-105' : 'text-indigo-400'}`}>
                                  {typeof preRaceVal === 'number' ? preRaceVal.toFixed(1) : '0.0'}%
                                </div>
                                {isLimitBroken && (
                                  <div className="absolute top-0 right-0 -mr-1 -mt-0.5">
                                    <span className="flex h-1.5 w-1.5 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                                    </span>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-1 py-1 text-center bg-slate-50/40">
                            <div className={`mx-auto w-10 bg-white border border-slate-200 rounded text-[10px] font-mono font-black py-0.5 ${getWearColor(calculatedFinalWear)}`}>
                              {calculatedFinalWear > 0 ? calculatedFinalWear.toFixed(1) + '%' : '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}