'use client';
import { ChangeEvent, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext'; 
import { supabase } from '../lib/supabase';
import { saveUserState, getUserState } from '../lib/db';
import { 
  User, Car, Zap, Activity, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Cpu, Search, X, LogOut,
  Lock, Unlock, Edit3, Briefcase, Users, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. MAPEAMENTO DE BANDEIRAS ---
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

// --- SELETOR DE PISTA ---
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
                className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 text-lg md:text-2xl text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group bg-white/5 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-white/10 md:border-none active:scale-[0.98] duration-200"
            >
                <span className="truncate max-w-[200px] md:max-w-none">
                    {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR PISTA"}
                </span>
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full left-0 mt-2 w-full md:w-[350px] bg-[#0F0F13] border border-white/20 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl z-[9999]">
                        <div className="p-3 border-b border-white/10 bg-white/[0.05]">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input autoFocus type="text" placeholder="BUSCAR PISTA..." className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 h-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500/50 outline-none font-bold uppercase" value={search} onChange={(e) => setSearch(e.target.value)} />
                                {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2"><X size={14} /></button>}
                            </div>
                        </div>
                        <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredTracks.map((track: any) => {
                                const name = typeof track === 'object' ? track.name : track;
                                
                                return (
                                    <button 
                                        key={name}
                                        onClick={() => { onSelect(name); setIsOpen(false); setSearch(""); }} 
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-[11px] font-bold uppercase text-slate-300 hover:bg-indigo-500/20 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {TRACK_FLAGS[name] ? (
                                                <img src={`/flags/${TRACK_FLAGS[name]}.png`} alt={name} className="w-5 h-3 object-cover rounded-sm" />
                                            ) : (
                                                <div className="w-5 h-3 bg-white/10 rounded-sm"></div>
                                            )}
                                            <span className="truncate max-w-[200px]">{name}</span>
                                        </div>
                                        {currentTrack === name && <ShieldCheck size={12} className="text-indigo-400" />}
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

// --- SUBCOMPONENTES ---

function TelemetryInput({ label, value, max, onChange, disabled, isEnergy }: any) {
    const safeValue = value ?? 0;
    const pct = Math.min(100, (safeValue / max) * 100);
    return (
        <div className={`flex items-center justify-between h-7 group transition-colors ${disabled ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}>
            <label className={`text-[10px] font-black uppercase tracking-tighter truncate w-32 flex items-center gap-2 ${disabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-yellow-400'}`}>
                {isEnergy && <Zap size={10} className={pct > 50 ? "text-indigo-400" : "text-amber-500"} />}
                {label}
            </label>
            <div className={`flex-1 mx-3 h-1.5 rounded-full overflow-hidden flex relative transition-colors ${disabled ? 'bg-white/5' : 'bg-white/10'}`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full transition-colors ${disabled ? 'bg-slate-700' : (isEnergy ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-indigo-500')}`} />
            </div>
            <input disabled={disabled} type="number" value={safeValue} onChange={onChange} className="w-12 h-6 bg-black/40 text-center text-xs font-black rounded border border-white/10 text-white outline-none focus:border-yellow-500" />
        </div>
    )
}

function CarRow({ part, finalWear, onLvl, onWear, disabled }: any) {
    const isCritical = part.wear > 85 || (finalWear !== undefined && finalWear > 95);
    return (
        <div className={`flex items-center justify-between h-7 rounded px-2 transition-colors ${disabled ? 'opacity-60' : 'hover:bg-white/[0.02]'}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter w-24 truncate">{part.name}</span>
            <div className="flex items-center gap-4">
                <input disabled={disabled} type="number" value={part.lvl} onChange={(e)=>onLvl(Number(e.target.value))} className="w-10 h-6 bg-black/40 border border-white/10 rounded text-center text-xs font-black text-white" />
                <input disabled={disabled} type="number" value={part.wear} onChange={(e)=>onWear(Number(e.target.value))} className={`w-10 h-6 bg-black/40 border border-white/10 rounded text-center text-xs font-black ${part.wear > 80 ? 'text-rose-500' : 'text-emerald-400'}`} />
                <div className={`w-10 h-6 rounded flex items-center justify-center border font-black text-[10px] ${isCritical ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]'}`}>
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

    return (
        <div className={`space-y-3 ${disabled ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-slate-500">{label} <span className={isOk ? 'text-emerald-400 ml-2' : 'text-rose-400 ml-2'}>{diff > 0 ? `+${diff}` : diff}</span></span>
                <div className="flex items-center gap-2">
                    <div className="text-center flex flex-col items-center">
                        <p className="text-[6px] text-slate-600 mb-0.5">TESTE</p>
                        <input disabled={disabled} type="number" value={test} onChange={(e)=>onTest(Number(e.target.value))} className="w-14 h-8 bg-black/40 border border-white/10 rounded text-center text-xs font-black text-indigo-400 focus:border-yellow-500 outline-none" />
                    </div>
                    <div className="text-center bg-white/5 px-2 py-1 rounded min-w-[30px] ml-2"><p className="text-[6px] text-slate-500 mb-0.5">REQ</p><p className="text-[10px] text-white">{data?.pista || 0}</p></div>
                </div>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full relative overflow-visible border border-white/5">
                <div className="h-full bg-slate-600 rounded-l-full" style={{ width: `${pctPeça}%` }} />
                <div className="h-full absolute top-0 bg-indigo-500 shadow-[0_0_10px_#6366f1]" style={{ left: `${pctPeça}%`, width: `${pctTeste}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white shadow-[0_0_8px_white] z-10 rounded-full transition-all duration-500" style={{ left: `${pctPista}%` }} />
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

  // ============================================
  // FUNÇÃO DE NORMALIZAÇÃO DO CLIMA
  // ============================================
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

  // ============================================
  // PIPELINE ÚNICO
  // ============================================
  const applyGproPayload = useCallback((payload: {
    driver?: any;
    car?: any[];
    techDirector?: any;
    staff?: any;
    weather?: any;
    track?: string;
    test_points?: any;
  }) => {
    // Driver
    if (payload.driver) {
      Object.entries(payload.driver).forEach(([key, value]) => {
        if (key !== 'total' && value !== undefined && typeof value === 'number') {
          updateDriver(key as any, value);
        }
      });
    }
    
    // Carro
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
    
    // Diretor Técnico
    if (payload.techDirector) {
      updateTechDirector(payload.techDirector);
    }
    
    // Staff
    if (payload.staff) {
      updateStaffFacilities(payload.staff);
    }
    
    // Weather - com normalização
    if (payload.weather) {
      const normalizedWeather = normalizeWeatherFromAPI(payload.weather);
      updateWeather(normalizedWeather);
    }
    
    // Track
    if (payload.track && payload.track !== track && payload.track !== "") {
      updateTrack(payload.track);
    }
    
    // Test Points
    if (payload.test_points) {
      updateTestPoints(payload.test_points);
    }
    
  }, [updateDriver, updateCar, updateTechDirector, updateStaffFacilities, updateWeather, updateTrack, track, updateTestPoints, normalizeWeatherFromAPI]);

  // Função para importar dados do GPRO
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
      
      // Criar e salvar snapshot
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
      
      // Aplicar os dados
      applyGproPayload(data);
      
      // Força uma atualização dos cálculos após a importação
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

  // Função para restaurar dados do snapshot
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
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#050507] text-indigo-500 font-mono text-xs gap-4">
        <Loader2 className="animate-spin w-8 h-8" />
        <span className="animate-pulse tracking-widest">SINCRONIZANDO TELEMETRIA...</span>
    </div>
  );

  return (
    <div className="min-h-screen pb-32 md:pb-12 bg-[#050507] text-slate-300 font-mono selection:bg-indigo-500/30">
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none"></div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 md:space-y-8 relative z-10">
        
        {/* HEADER BAR */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl sticky top-4 z-50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                    <div className="w-20 h-12 bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden shadow-lg">
                        {track && TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" /> : <span className="text-xl">🏁</span>}
                    </div>
                    <div>
                        <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><MapPin size={10} className="text-indigo-400"/> Circuito Selecionado</h2>
                        <TrackSelector currentTrack={track} tracksList={tracksList} onSelect={updateTrack} />
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                  {/* Botão RESTAURAR SNAPSHOT */}
                  <button 
                    onClick={handleRestoreImportSnapshot} 
                    disabled={isRestoring}
                    className="group flex flex-col items-center gap-1 active:scale-95 transition-transform"
                  >
                    <div className={`p-2 rounded-lg border transition-all ${isRestoring ? 'animate-spin border-amber-500 text-amber-500' : 'text-slate-400 group-hover:text-indigo-400 border-white/10 bg-white/5'}`}>
                      {isRestoring ? <Loader2 size={18} /> : <History size={18} />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                      {isRestoring ? 'RESTAURANDO' : 'RESTAURAR'}
                    </span>
                  </button>
                  
                  {/* Botão IMPORTAR GPRO */}
                  <button 
                    onClick={handleImportGPRO} 
                    disabled={isImporting}
                    className="group flex flex-col items-center gap-1 active:scale-95 transition-transform"
                  >
                    <div className={`p-2 rounded-lg border bg-white/5 border-white/10 transition-all ${isImporting ? 'animate-spin border-green-500 text-green-500' : 'text-slate-400 group-hover:text-green-400 group-hover:border-green-500/30'}`}>
                      {isImporting ? <Loader2 size={18} /> : <Zap size={18} />}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                      {isImporting ? 'IMPORTANDO' : 'IMPORTAR'}
                    </span>
                  </button>
                  
                  {/* Botão Salvar */}
                  <button onClick={persistState} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform">
                     <div className={`p-2 rounded-lg border bg-white/5 border-white/10 ${isSyncing ? 'animate-spin border-amber-500 text-amber-500' : 'text-slate-400 group-hover:text-indigo-400'}`}><RefreshCw size={18} /></div>
                     <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">SALVAR</span>
                  </button>
                  
                  {/* Botão Sair */}
                  <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="group flex flex-col items-center gap-1 active:scale-95">
                     <div className="p-2 rounded-lg border bg-white/5 border-white/10 text-slate-400 group-hover:text-red-400 transition-colors"><LogOut size={18} /></div>
                     <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">SAIR</span>
                  </button>
                  
                  {/* Botão Modo Edição */}
                  <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isEditMode ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                      {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                      <div className="flex flex-col text-left">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">MODO</span>
                        <span className="text-[10px] font-bold">{isEditMode ? 'EDIÇÃO' : 'BLOQUEADO'}</span>
                      </div>
                  </button>
                </div>
            </div>
        </motion.div>

        {/* MAIN GRID - 3 COLUNAS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-0">
            
            {/* COLUNA 1: PILOTO */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                {!isEditMode && <div className="absolute top-2 right-2 text-slate-700 opacity-20 pointer-events-none"><Lock size={80} /></div>}
                <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-3">{isEditMode ? <Edit3 size={18} className="text-yellow-400 animate-pulse"/> : <Cpu size={18} className="text-slate-600"/>}<h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">PILOTO</h3></div>
                    <div className="bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-lg font-black text-white">{Number(driver.total).toFixed(1)}</div>
                </div>
                <div className="flex flex-col gap-1">
                    <TelemetryInput label="ENERGIA" value={driver.energia} max={100} onChange={(e:any)=>updateDriver('energia', Number(e.target.value))} disabled={!isEditMode} isEnergy />
                    {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                        <TelemetryInput key={skill} label={skill.toUpperCase()} value={(driver as any)[skill]} max={skill === 'experiencia' ? 300 : 250} onChange={(e:any)=>updateDriver(skill as any, Number(e.target.value))} disabled={!isEditMode} />
                    ))}
                    <div className="flex items-center gap-3 h-7 mt-2 border-t border-white/5 pt-2">
                         <div className="flex-1 flex items-center justify-between bg-black/20 rounded px-2 border border-white/5"><span className="text-[9px] font-black text-slate-500 uppercase">PESO</span><input disabled={!isEditMode} type="number" value={driver.peso} onChange={(e)=>updateDriver('peso', Number(e.target.value))} className="w-10 bg-transparent text-right text-xs font-black text-white outline-none" /></div>
                         <div className="flex-1 flex items-center justify-between bg-black/20 rounded px-2 border border-white/5"><span className="text-[9px] font-black text-slate-500 uppercase">IDADE</span><input disabled={!isEditMode} type="number" value={driver.idade} onChange={(e)=>updateDriver('idade', Number(e.target.value))} className="w-10 bg-transparent text-right text-xs font-black text-white outline-none" /></div>
                    </div>
                </div>
            </div>

            {/* COLUNA 2: CARRO */}
            <section className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl h-full">
                <div className="bg-white/[0.02] p-4 border-b border-white/5 flex justify-between items-center mb-1">
                    <h3 className="text-[10px] font-black uppercase text-white flex items-center gap-2"><Car size={14} className="text-slate-400"/> CARRO</h3>
                    <div className="flex gap-4 pr-1 text-[8px] font-black text-slate-500 uppercase">
                        <span className="w-10 text-center">NVL</span>
                        <span className="w-10 text-center">DSG%</span>
                        <span className="w-10 text-center text-indigo-400">FIM%</span>
                    </div>
                </div>
                <div className="p-4 pt-1 flex flex-col gap-1">
                    {car.map((part, idx) => (
                        <CarRow key={idx} part={part} finalWear={calculatedWear[idx]} onLvl={(val: number)=>updateCar(idx, 'lvl', val)} onWear={(val: number)=>updateCar(idx, 'wear', val)} disabled={!isEditMode} />
                    ))}
                </div>
            </section>

            {/* COLUNA 3: TELEMETRIA */}
            <section className="bg-gray-900/40 border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl h-full space-y-8">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4"><Activity size={16} className="text-indigo-400"/><h3 className="text-[10px] font-black uppercase text-white tracking-widest">TELEMETRIA</h3></div>
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

        {/* SECOND ROW: TECH & FACILITIES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-0">
            
            {/* DIRETOR TÉCNICO */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                        <Briefcase size={18} className={isEditMode ? "text-yellow-400" : "text-slate-600"}/>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">DIRETOR TÉCNICO</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <TelemetryInput label="R&D MECÂNICO" value={techDirector.rdMecanico} max={200} onChange={(e:any)=>updateTechDirector({ rdMecanico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D ELETRÔNICO" value={techDirector.rdEletronico} max={200} onChange={(e:any)=>updateTechDirector({ rdEletronico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D AERODINÂMICO" value={techDirector.rdAerodinamico} max={200} onChange={(e:any)=>updateTechDirector({ rdAerodinamico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="EXPERIÊNCIA" value={techDirector.experiencia} max={200} onChange={(e:any)=>updateTechDirector({ experiencia: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="PIT COORD" value={techDirector.pitCoord} max={200} onChange={(e:any)=>updateTechDirector({ pitCoord: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

            {/* PESSOAL E INSTALAÇÕES */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                        <Users size={18} className={isEditMode ? "text-yellow-400" : "text-slate-600"}/>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">STAFF</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                     <TelemetryInput label="TOLERÂNCIA" value={staffFacilities.toleranciaPressao} max={200} onChange={(e:any)=>updateStaffFacilities({ toleranciaPressao: Number(e.target.value) })} disabled={!isEditMode} />
                     <TelemetryInput label="CONCENTRAÇÃO" value={staffFacilities.concentracao} max={200} onChange={(e:any)=>updateStaffFacilities({ concentracao: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}