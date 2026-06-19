'use client';

import { ChangeEvent, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext'; 
import { supabase } from '../lib/supabase';
import { saveUserState, getUserState } from '../lib/db';
import { 
  User, Car, Zap, Activity, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Cpu, Search, X, LogOut,
  Lock, Unlock, Edit3, Briefcase, Users, History, Layers, Sliders, Settings,
  Sparkles, Gauge, Brain, Flame, Target, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MAPEAMENTO DE BANDEIRAS ---
const TRACK_FLAGS: { [key: string]: string } = {
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", 
  "Estoril": "pt", "Fiorano": "it", "Fuji": "jp",
  "Grobnik": "hr",
  "Hockenheim": "de", "Hungaroring": "hu",
  "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in",
  "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt",
  "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa",
  "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it",
  "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at",
  "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl",
  "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar",
  "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk",
  "Valencia": "es", "Vallelunga": "it",
  "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be"
};

const MOCK_PERFORMANCE_DATA = {
    power: { part: 0, test: 0, carro: 0, pista: 0 },
    handling: { part: 0, test: 0, carro: 0, pista: 0 },
    accel: { part: 0, test: 0, carro: 0, pista: 0 },
    zs: { wings: 0, motor: 0, brakes: 0, gear: 0, susp: 0 } 
};

// --- SELETOR DE PISTA PREMIUM ---
function TrackSelector({ currentTrack, tracksList, onSelect }: { currentTrack: string, tracksList: string[], onSelect: (t: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTracks = useMemo(() => {
        return tracksList.filter((track: any) => {
            const name = typeof track === 'object' ? (track.name || "") : (track || "");
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }, [tracksList, search]);

    return (
        <div className="relative w-full md:w-auto" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full md:w-auto flex items-center justify-between gap-3 text-sm md:text-base text-white font-black tracking-wider hover:text-indigo-400 transition-all duration-300 outline-none group bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-xl active:scale-[0.98] shadow-[0_0_15px_rgba(99,102,241,0.05)] hover:shadow-[0_0_25px_rgba(99,102,241,0.1)]"
            >
                <span className="truncate max-w-[180px] md:max-w-none">
                    {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR CIRCUITO"}
                </span>
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full left-0 mt-2 w-full md:w-[320px] bg-[#0c0c0e] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-xl z-[9999]">
                        <div className="p-3 border-b border-white/5 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                            <div className="relative">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input autoFocus type="text" placeholder="BUSCAR CIRCUITO..." className="w-full bg-black/60 border border-white/5 rounded-lg pl-9 pr-3 h-9 text-xs text-white placeholder-slate-600 focus:border-indigo-500/40 outline-none font-bold uppercase tracking-wider focus:shadow-[0_0_20px_rgba(99,102,241,0.1)]" value={search} onChange={(e) => setSearch(e.target.value)} />
                                {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1.5"><X size={12} /></button>}
                            </div>
                        </div>
                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                            {filteredTracks.map((track: any) => {
                                const name = typeof track === 'object' ? track.name : track;
                                
                                return (
                                    <button 
                                        key={name}
                                        onClick={() => { onSelect(name); setIsOpen(false); setSearch(""); }} 
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:bg-gradient-to-r hover:from-indigo-500/20 hover:to-purple-500/20 hover:text-white transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {TRACK_FLAGS[name] ? (
                                                <img src={`/flags/${TRACK_FLAGS[name]}.png`} alt={name} className="w-4 h-2.5 object-cover rounded-sm border border-white/5" />
                                            ) : (
                                                <div className="w-4 h-2.5 bg-white/5 rounded-sm border border-white/5"></div>
                                            )}
                                            <span className="truncate max-w-[170px]">{name}</span>
                                        </div>
                                        {currentTrack === name && <ShieldCheck size={12} className="text-indigo-400 shrink-0" />}
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

// --- SUBCOMPONENTES SLIM COM GRADIENTES ---

function TelemetryInput({ label, value, max, onChange, disabled, isEnergy }: any) {
    const safeValue = value ?? 0;
    const pct = Math.min(100, (safeValue / max) * 100);
    return (
        <div className={`flex items-center justify-between h-8 rounded-lg px-2 group transition-all duration-200 ${disabled ? 'opacity-50' : 'hover:bg-white/[0.01]'}`}>
            <label className={`text-[9px] font-black uppercase tracking-wider truncate w-24 flex items-center gap-1.5 ${disabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-amber-400 transition-colors'}`}>
                {isEnergy && <Zap size={10} className={pct > 50 ? "text-indigo-400" : "text-amber-500 animate-pulse"} />}
                {label}
            </label>
            <div className={`flex-1 mx-3 h-1 rounded-full overflow-hidden flex relative ${disabled ? 'bg-white/5' : 'bg-gradient-to-r from-white/5 to-white/10'}`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${disabled ? 'bg-slate-700' : (isEnergy ? 'bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-gradient-to-r from-indigo-500 to-purple-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]')}`} />
            </div>
            <input disabled={disabled} type="number" value={safeValue} onChange={onChange} className="w-10 h-6 bg-black/60 text-center text-[11px] font-mono font-black rounded border border-white/5 text-white outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] disabled:border-transparent transition-all" />
        </div>
    )
}

function CarRow({ part, finalWear, onLvl, onWear, disabled }: any) {
    const isCritical = part.wear > 85 || (finalWear !== undefined && finalWear > 95);
    const wearColor = part.wear > 80 ? "text-rose-400" : part.wear > 50 ? "text-amber-400" : "text-emerald-400";
    const finalWearColor = finalWear > 90 ? "text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(225,29,72,0.1)]" : "text-slate-200 bg-indigo-500/5 border-indigo-500/20";

    return (
        <div className={`flex items-center justify-between h-8 rounded-lg px-2 group transition-all duration-200 ${disabled ? 'opacity-60' : 'hover:bg-white/[0.01]'}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 truncate group-hover:text-slate-200 transition-colors">{part.name}</span>
            <div className="flex items-center gap-2">
                <input disabled={disabled} type="number" value={part.lvl} onChange={(e)=>onLvl(Number(e.target.value))} className="w-9 h-6 bg-black/60 border border-white/5 rounded text-center text-[10px] font-mono font-black text-white focus:border-indigo-500 focus:shadow-[0_0_10px_rgba(99,102,241,0.1)]" />
                <input disabled={disabled} type="number" value={part.wear} onChange={(e)=>onWear(Number(e.target.value))} className={`w-9 h-6 bg-black/60 border border-white/5 rounded text-center text-[10px] font-mono font-black ${wearColor} focus:border-indigo-500 focus:shadow-[0_0_10px_rgba(99,102,241,0.1)]`} />
                <div className={`w-9 h-6 rounded flex items-center justify-center border font-black font-mono text-[9px] ${finalWearColor}`}>
                    {finalWear !== undefined ? finalWear : '--'}
                </div>
            </div>
        </div>
    )
}

function PerformanceMetric({ label, data, test, onTest, disabled }: any) {
    const diff = (data?.carro || 0) - (data?.pista || 0);
    const isOk = diff >= 0;
    const pctPista = Math.min(100, ((data?.pista || 0) / 200) * 100);
    const pctPeça = Math.min(100, ((data?.part || 0) / 200) * 100);
    const pctTeste = Math.min(100 - pctPeça, (test / 200) * 100);

    const gradientColors = {
        power: "from-rose-500/20 to-red-500/10",
        handling: "from-indigo-500/20 to-purple-500/10",
        accel: "from-emerald-500/20 to-teal-500/10"
    };

    return (
        <div className={`space-y-2 bg-gradient-to-br ${gradientColors[label as keyof typeof gradientColors] || 'from-slate-500/10 to-transparent'} p-3 rounded-xl border border-white/[0.02] ${disabled ? 'opacity-60' : 'hover:border-white/5 transition-all duration-300'}`}>
            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-slate-400 flex items-center gap-1.5">
                    {label === 'power' && <Zap size={10} className="text-rose-400" />}
                    {label === 'handling' && <Gauge size={10} className="text-indigo-400" />}
                    {label === 'accel' && <Flame size={10} className="text-emerald-400" />}
                    {label} 
                    <span className={isOk ? 'text-emerald-400 ml-2 font-black' : 'text-rose-400 ml-2 font-black'}>{diff > 0 ? `+${diff}` : diff}</span>
                </span>
                <div className="flex items-center gap-1.5">
                    <div className="text-center flex flex-col items-center">
                        <span className="text-[6px] text-slate-500 mb-0.5">ESTIMADO</span>
                        <input disabled={disabled} type="number" value={test} onChange={(e)=>onTest(Number(e.target.value))} className="w-12 h-6 bg-black/60 border border-white/10 rounded text-center text-[10px] font-mono font-black text-indigo-400 focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] outline-none" />
                    </div>
                    <div className="text-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-2 py-0.5 rounded min-w-[32px] ml-1 border border-indigo-500/10"><p className="text-[6px] text-slate-500 mb-0.5">ALVO</p><p className="text-[10px] text-white font-mono font-black">{data?.pista || 0}</p></div>
                </div>
            </div>
            
            <div className="h-1.5 w-full bg-slate-950 rounded-full relative overflow-visible border border-white/5 p-[1px]">
                <div className="h-full bg-gradient-to-r from-slate-700 to-slate-600 rounded-l-full" style={{ width: `${pctPeça}%` }} />
                <div className="h-full absolute top-0 bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]" style={{ left: `${pctPeça}%`, width: `${pctTeste}%` }} />
                
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)] z-10 rounded-sm transition-all duration-500" 
                  style={{ left: `${pctPista}%` }} 
                />
            </div>
        </div>
    );
}

// --- MAIN DASHBOARD COMPONENT ---
export default function DashboardHome() {
  const router = useRouter();
  
  const { 
      driver, updateDriver, 
      car, updateCar, 
      track, updateTrack, 
      weather, updateWeather, 
      desgasteModifier, updateDesgasteModifier, 
      tracksList,
      techDirector, updateTechDirector,      
      staffFacilities, updateStaffFacilities, 
      testPoints, updateTestPoints,
      isGlobalLoading
  } = useGame();
  
  const [performanceData, setPerformanceData] = useState(MOCK_PERFORMANCE_DATA);
  const [calculatedWear, setCalculatedWear] = useState<number[]>([]);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) router.push('/login'); 
        else setUserId(session.user.id);
    }
    checkSession();
  }, [router]);

  const persistState = useCallback(async () => {
    if (isGlobalLoading || !userId) return; 
    
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python?action=update_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify({ 
                track, driver, car, 
                test_points: testPoints, 
                tech_director: techDirector, 
                staff_facilities: staffFacilities, 
                weather, desgasteModifier 
            })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) updateDriver('total', Number(data.oa));
    } catch (e) { console.error("Persist error:", e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, isGlobalLoading, userId, updateDriver]);

  useEffect(() => {
    if (isGlobalLoading || !userId) return;
    const timer = setTimeout(() => persistState(), 2000);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, persistState, isGlobalLoading, userId]);

  const fetchCalculations = useCallback(async () => {
    if (!track || track === "Selecionar Pista" || !userId || isGlobalLoading) return;
    setIsPerformanceLoading(true);
    try {
        const resPerf = await fetch('/api/python?action=performance', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
            body: JSON.stringify({ 
                pista: track, 
                driver, 
                car, 
                test_points: testPoints,
                tech_director: techDirector,     
                staff_facilities: staffFacilities 
            }) 
        });
        const dataPerf = await resPerf.json();
        if (dataPerf.sucesso && dataPerf.data) setPerformanceData(dataPerf.data);

        const resSetup = await fetch('/api/python?action=setup_calculate', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
            body: JSON.stringify({ 
                pista: track, 
                driver, 
                car, 
                desgasteModifier,
                tech_director: techDirector, 
                staff_facilities: staffFacilities 
            }) 
        });
        const dataSetup = await resSetup.json();
        if (dataSetup.sucesso && dataSetup.data) {
            const wears = [
                dataSetup.data.chassi.wear.desgasteFinal,
                dataSetup.data.motor.wear.desgasteFinal,
                dataSetup.data.asaDianteira.wear.desgasteFinal,
                dataSetup.data.asaTraseira.wear.desgasteFinal,
                dataSetup.data.assoalho.wear.desgasteFinal,
                dataSetup.data.laterais.wear.desgasteFinal,
                dataSetup.data.radiador.wear.desgasteFinal,
                dataSetup.data.cambio.wear.desgasteFinal,
                dataSetup.data.freios.wear.desgasteFinal,
                dataSetup.data.suspensao.wear.desgasteFinal,
                dataSetup.data.eletronicos.wear.desgasteFinal,
            ].map(v => Math.round(Number(v) || 0));
            setCalculatedWear(wears);
        }
    } catch (e) { console.error("Calc error:", e); } 
    finally { setIsPerformanceLoading(false); }
  }, [track, driver, car, testPoints, desgasteModifier, techDirector, staffFacilities, userId, isGlobalLoading]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && !isGlobalLoading && userId) {
        const timer = setTimeout(() => fetchCalculations(), 600); 
        return () => clearTimeout(timer);
    }
  }, [track, driver, car, testPoints, desgasteModifier, fetchCalculations, isGlobalLoading, userId]);

  const normalizeWeatherFromAPI = useCallback((weatherData: any) => {
    if (!weatherData) return weatherData;

    const normalizeValue = (value: string): string => {
      if (!value) return 'Dry';
      if (value === 'Dry' || value === 'Wet') return value;
      
      const normalized = value.toLowerCase();
      if (normalized.includes('rain') || 
          normalized.includes('chuva') || 
          normalized.includes('molhado') ||
          normalized.includes('wet')) {
        return 'Wet';
      }
      
      return 'Dry';
    };

    return {
      ...weatherData,
      weatherQ1: normalizeValue(weatherData.weatherQ1),
      weatherQ2: normalizeValue(weatherData.weatherQ2),
      weatherRace: normalizeValue(weatherData.weatherRace),
    };
  }, []);

  const applyGproPayload = useCallback((payload: {
    driver?: any;
    car?: any[];
    techDirector?: any;
    staff?: any;
    weather?: any;
    track?: string;
    test_points?: any;
  }) => {
    if (payload.driver) {
      Object.entries(payload.driver).forEach(([key, value]) => {
        if (key !== 'total' && value !== undefined && typeof value === 'number') {
          updateDriver(key as any, value);
        }
      });
    }
    
    if (payload.car && Array.isArray(payload.car)) {
      payload.car.forEach((part: any, index: number) => {
        if (part.lvl !== undefined && part.lvl !== null) {
          updateCar(index, 'lvl', part.lvl);
        }
        if (part.wear !== undefined && part.wear !== null) {
          updateCar(index, 'wear', part.wear);
        }
      });
    }
    
    if (payload.techDirector) {
      updateTechDirector(payload.techDirector);
    }
    
    if (payload.staff) {
      updateStaffFacilities(payload.staff);
    }
    
    if (payload.weather) {
      const normalizedWeather = normalizeWeatherFromAPI(payload.weather);
      updateWeather(normalizedWeather);
    }
    
    if (payload.track && payload.track !== track && payload.track !== "") {
      updateTrack(payload.track);
    }
    
    if (payload.test_points) {
      updateTestPoints(payload.test_points);
    }
    
  }, [updateDriver, updateCar, updateTechDirector, updateStaffFacilities, updateWeather, updateTrack, track, updateTestPoints, normalizeWeatherFromAPI]);

  const handleImportGPRO = async () => {
    setIsImporting(true);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Erro ao obter usuário:', userError);
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      
      const { data: userState, error: fetchError } = await supabase
        .from('user_state')
        .select('gpro_token')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (fetchError) {
        console.error('Erro ao buscar user_state:', fetchError);
        throw new Error('Erro ao buscar token GPRO: ' + fetchError.message);
      }
      
      const token = userState?.gpro_token;
      
      if (!token) {
        alert('Configure o token GPRO em Configurações → Integração GPRO primeiro');
        return;
      }
      
      const response = await fetch('/api/gpro/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Erro ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch(e) {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao importar dados do GPRO');
      }
      
      const importSnapshot = {
        driver: data.driver || null,
        car: data.car || null,
        tech_director: data.techDirector || null,
        staff_facilities: data.staff || null,
        weather: data.weather || null,
        track: data.track || null,
        test_points: data.test_points || null
      };
      
      const importTimestamp = new Date().toISOString();
      
      await saveUserState(user.id, {
        last_import_snapshot: importSnapshot,
        last_import_at: importTimestamp
      });
      
      applyGproPayload(data);
      
      setTimeout(() => {
        fetchCalculations();
      }, 500);
      
      setTimeout(() => persistState(), 500);
      alert('Dados importados com sucesso do GPRO!');
      
    } catch (error) {
      console.error('Erro detalhado na importação GPRO:', error);
      alert(error instanceof Error ? error.message : 'Erro ao importar dados do GPRO');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreImportSnapshot = async () => {
    if (!userId) {
      alert('Usuário não autenticado.');
      return;
    }
    
    setIsRestoring(true);
    
    try {
      const userState = await getUserState(userId);
      
      if (!userState || !userState.last_import_snapshot) {
        alert('Nenhum snapshot de importação encontrado. Faça uma importação primeiro.');
        return;
      }
      
      const snapshot = userState.last_import_snapshot;
      const importDate = userState.last_import_at;
      
      const normalizedPayload = {
        driver: snapshot.driver,
        car: snapshot.car,
        techDirector: snapshot.tech_director,
        staff: snapshot.staff_facilities,
        weather: snapshot.weather,
        track: snapshot.track,
        test_points: snapshot.test_points
      };
      
      applyGproPayload(normalizedPayload);
      
      setTimeout(() => persistState(), 500);
      
      alert(`Dados restaurados com sucesso do snapshot de ${importDate ? new Date(importDate).toLocaleString() : 'data desconhecida'}`);
      
    } catch (error) {
      console.error('Erro detalhado na restauração do snapshot:', error);
      alert(error instanceof Error ? error.message : 'Erro ao restaurar dados do snapshot');
    } finally {
      setIsRestoring(false);
    }
  };

  if (isGlobalLoading) return (
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#020204] text-indigo-500 font-mono text-xs gap-4">
        <div className="relative">
            <div className="w-16 h-16 border-2 border-indigo-500/10 rounded-full absolute"></div>
            <Loader2 className="animate-spin w-8 h-8 text-indigo-400" />
        </div>
        <span className="animate-pulse tracking-widest bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">SINCRONIZANDO TELEMETRIA...</span>
    </div>
  );

  return (
    <div className="min-h-screen pb-32 md:pb-12 bg-[#020204] text-slate-300 font-mono selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* ==========================================
          FUNDO AMBIENTAL COM GRADIENTES
          ========================================== */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 blur-[150px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
      </div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 relative z-10">
        
        {/* HEADER BAR (GLASS CONTROL BAR) */}
        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-950/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl sticky top-4 z-50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="flex flex-col xl:flex-row items-center justify-between gap-5 relative">
              <div className="flex items-center gap-6 self-stretch xl:self-auto justify-between sm:justify-start">
                  <div className="w-16 h-10 bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                      {track && TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" /> : <span className="text-lg">🏁</span>}
                  </div>
                  <div className="text-left">
                      <h2 className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={10} className="text-indigo-400"/> CIRCUITO SELECIONADO</h2>
                      <TrackSelector currentTrack={track} tracksList={tracksList} onSelect={updateTrack} />
                  </div>
              </div>
              
              {/* BOTÕES DE CONTROLE COMPACTOS */}
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full xl:w-auto self-stretch xl:self-auto border-t xl:border-t-0 border-white/5 pt-3 xl:pt-0">
                <div className="flex items-center gap-4">
                  <button onClick={handleRestoreImportSnapshot} disabled={isRestoring} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform" title="Restaurar Snapshot GPRO">
                    <div className={`p-2 rounded-lg border bg-white/5 border-white/5 transition-all duration-200 ${isRestoring ? 'animate-spin border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'text-slate-400 hover:text-amber-400 hover:border-amber-500/20'}`}><History size={16} /></div>
                    <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase">RESTAURAR</span>
                  </button>
                  
                  <button onClick={handleImportGPRO} disabled={isImporting} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform" title="Sincronizar dados direto da GPRO">
                    <div className={`p-2 rounded-lg border bg-white/5 border-white/5 transition-all duration-200 ${isImporting ? 'animate-spin border-green-500 text-green-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'text-slate-400 hover:text-green-400 hover:border-green-500/20'}`}><Zap size={16} /></div>
                    <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase">GPRO SYNC</span>
                  </button>
                  
                  <button onClick={persistState} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform" title="Salvar modificações atuais">
                     <div className={`p-2 rounded-lg border bg-white/5 border-white/5 transition-all duration-200 ${isSyncing ? 'animate-spin border-cyan-500 text-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'text-slate-400 hover:text-indigo-400 hover:border-indigo-500/20'}`}><RefreshCw size={16} /></div>
                     <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase">GRAVAR</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${isEditMode ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.1)]' : 'bg-white/5 border-white/5 text-slate-400'}`}>
                      {isEditMode ? <Unlock size={12} className="animate-pulse text-amber-400" /> : <Lock size={12} />}
                      <div className="flex flex-col text-left">
                        <span className="text-[7px] font-bold text-slate-500 leading-none">MODO</span>
                        <span className="text-[9px] font-black tracking-wider leading-none mt-0.5">{isEditMode ? 'EDIÇÃO' : 'BLOQUEADO'}</span>
                      </div>
                  </button>
                </div>
              </div>
          </div>
        </motion.div>

        {/* MAIN GRID - 3 COLUNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-0">
            
            {/* COLUNA 1: PILOTO SPECS */}
            <div className={`lg:col-span-4 border rounded-2xl p-4.5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-zinc-950/60 border-amber-500/20 shadow-lg shadow-amber-500/5' : 'bg-zinc-950/40 border-white/5'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                {!isEditMode && <div className="absolute top-2 right-2 text-slate-700 opacity-20 pointer-events-none" title="Controle travado. Ative o modo edição."><Lock size={64} /></div>}
                
                <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                        {isEditMode ? <Edit3 size={14} className="text-amber-500 animate-pulse"/> : <Cpu size={14} className="text-slate-500"/>}
                        <h3 className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Telemetria Piloto</h3>
                    </div>
                    <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 text-xs font-mono font-black text-white shadow-[0_0_15px_rgba(99,102,241,0.05)]" title="Overall Geral Calculado">{Number(driver.total).toFixed(1)} OA</div>
                </div>

                <div className="flex flex-col gap-0.5 relative z-10">
                    <TelemetryInput label="ENERGIA" value={driver.energia} max={100} onChange={(e:any)=>updateDriver('energia', Number(e.target.value))} disabled={!isEditMode} isEnergy />
                    {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                        <TelemetryInput key={skill} label={skill.toUpperCase()} value={(driver as any)[skill]} max={skill === 'experiencia' ? 300 : 250} onChange={(e:any)=>updateDriver(skill as any, Number(e.target.value))} disabled={!isEditMode} />
                    ))}
                    <div className="flex items-center gap-2 mt-2 border-t border-white/5 pt-2 text-[11px]">
                         <div className="flex-1 flex items-center justify-between bg-black/30 rounded-xl px-2.5 h-8 border border-white/5"><span className="text-[8px] font-black text-slate-500 uppercase">PESO kg</span><input disabled={!isEditMode} type="number" value={driver.peso} onChange={(e)=>updateDriver('peso', Number(e.target.value))} className="w-8 bg-transparent text-right font-mono font-black text-white outline-none" /></div>
                         <div className="flex-1 flex items-center justify-between bg-black/30 rounded-xl px-2.5 h-8 border border-white/5"><span className="text-[8px] font-black text-slate-500 uppercase">IDADE anos</span><input disabled={!isEditMode} type="number" value={driver.idade} onChange={(e)=>updateDriver('idade', Number(e.target.value))} className="w-8 bg-transparent text-right font-mono font-black text-white outline-none" /></div>
                    </div>
                </div>
            </div>

            {/* COLUNA 2: DIAGNÓSTICO DO CARRO */}
            <section className="lg:col-span-4 bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative bg-gradient-to-r from-emerald-500/5 to-teal-500/5 p-3.5 border-b border-white/5 flex justify-between items-center mb-1">
                    <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2"><Car size={14} className="text-emerald-400"/> Desgaste Chassi</h3>
                    <div className="flex gap-2 pr-1 text-[8px] font-black text-slate-500 uppercase tracking-wider">
                        <span className="w-9 text-center">NVL</span>
                        <span className="w-9 text-center">DSG%</span>
                        <span className="w-9 text-center text-emerald-400">FIM%</span>
                    </div>
                </div>
                <div className="relative p-3.5 pt-1 flex flex-col gap-0.5">
                    {car.map((part, idx) => (
                        <CarRow key={idx} part={part} finalWear={calculatedWear[idx]} onLvl={(val: number)=>updateCar(idx, 'lvl', val)} onWear={(val: number)=>updateCar(idx, 'wear', val)} disabled={!isEditMode} />
                    ))}
                </div>
            </section>

            {/* COLUNA 3: REGULAGENS DE EXIGÊNCIA (TELEMETRIA CIRCUITO) */}
            <section className="lg:col-span-4 bg-zinc-950/40 border border-white/5 rounded-2xl p-4.5 shadow-xl h-full space-y-4 flex flex-col backdrop-blur-sm relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 relative">
                    <div className="p-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                        <Activity size={14} className="text-white" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase text-white tracking-widest bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Ajuste de Exigência</h3>
                </div>
                {['power', 'handling', 'accel'].map((key) => (
                    <PerformanceMetric 
                        key={key} 
                        label={key.toUpperCase()} 
                        data={(performanceData as any)[key]} 
                        test={(testPoints as any)[key]} 
                        onTest={(v: number) => updateTestPoints({ [key]: v })} 
                        disabled={!isEditMode} 
                    />
                ))}
            </section>
        </div>

        {/* SECOND ROW: STAFF & TECH TEAM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-0">
            
            {/* DIRETOR TÉCNICO */}
            <div className={`border rounded-2xl p-4.5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-zinc-950/60 border-yellow-500/20 shadow-lg shadow-yellow-500/5' : 'bg-zinc-950/40 border-white/5'}`}>
                 <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                        <Briefcase size={14} className={isEditMode ? "text-yellow-400 animate-pulse" : "text-slate-500"}/>
                        <h3 className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Diretor Técnico</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-0.5 relative z-10">
                    <TelemetryInput label="R&D MECÂNICO" value={techDirector.rdMecanico} max={200} onChange={(e:any)=>updateTechDirector({ rdMecanico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D ELETRÔNICO" value={techDirector.rdEletronico} max={200} onChange={(e:any)=>updateTechDirector({ rdEletronico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D AERODINÂMICO" value={techDirector.rdAerodinamico} max={200} onChange={(e:any)=>updateTechDirector({ rdAerodinamico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="EXPERIÊNCIA" value={techDirector.experiencia} max={200} onChange={(e:any)=>updateTechDirector({ experiencia: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="PIT COORD" value={techDirector.pitCoord} max={200} onChange={(e:any)=>updateTechDirector({ pitCoord: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

            {/* EQUIPE DE SUPORTE (STAFF) */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-zinc-950/60 border-yellow-500/20 shadow-lg shadow-yellow-500/5' : 'bg-zinc-950/40 border-white/5'}`}>
                 <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                        <Users size={14} className={isEditMode ? "text-yellow-400 animate-pulse" : "text-slate-500"}/>
                        <h3 className="text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Equipe de Pessoal (Staff)</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-0.5 mt-2 relative z-10">
                     <TelemetryInput label="TOLERÂNCIA" value={staffFacilities.toleranciaPressao} max={200} onChange={(e:any)=>updateStaffFacilities({ toleranciaPressao: Number(e.target.value) })} disabled={!isEditMode} />
                     <TelemetryInput label="CONCENTRAÇÃO" value={staffFacilities.concentracao} max={200} onChange={(e:any)=>updateStaffFacilities({ concentracao: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

        </div>

      </div>
      
      {/* Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.2); }
      `}</style>
    </div>
  );
}