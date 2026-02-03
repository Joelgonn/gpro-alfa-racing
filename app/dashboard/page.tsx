// --- START OF FILE app/dashboard/DashboardHome.tsx ---
'use client';
import { ChangeEvent, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext'; 
import { supabase } from '../lib/supabase';
import { 
  Settings, User, Car, Zap, Activity, Trophy, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Gauge, Cpu, Search, X, LogOut,
  Lock, Unlock, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. MAPEAMENTO DE BANDEIRAS (MANTIDO) ---
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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const filteredTracks = useMemo(() => {
        return tracksList.filter(t => t.toLowerCase().includes(search.toLowerCase()));
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
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-full md:w-[350px] bg-[#0F0F13] border border-white/20 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl z-[9999]"
                    >
                        <div className="p-3 border-b border-white/10 bg-white/[0.05]">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="BUSCAR PISTA..." 
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 h-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500/50 outline-none font-bold uppercase"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[250px] md:max-h-[350px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredTracks.length > 0 ? (
                                filteredTracks.map((track) => (
                                    <button
                                        key={track}
                                        onClick={() => {
                                            onSelect(track);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {TRACK_FLAGS[track] ? (
                                                <img 
                                                    src={`/flags/${TRACK_FLAGS[track]}.png`} 
                                                    alt={track} 
                                                    className="w-6 h-4 object-cover rounded shadow-sm" 
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : <div className="w-6 h-4 bg-white/10 rounded"></div>}
                                            {track}
                                        </div>
                                        {currentTrack === track && <ShieldCheck size={14} />}
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-xs text-slate-500 font-bold uppercase">
                                    Nenhuma pista encontrada
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- MAIN DASHBOARD COMPONENT ---
export default function DashboardHome() {
  const router = useRouter();
  const { driver, car, track, updateDriver, updateCar, updateTrack, weather, updateWeather, desgasteModifier, updateDesgasteModifier, tracksList } = useGame();
  
  const [testPoints, setTestPoints] = useState({ power: 0, handling: 0, accel: 0 });
  const [performanceData, setPerformanceData] = useState(MOCK_PERFORMANCE_DATA);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // ESTADO DE EDIÇÃO (Começa falso para segurança)
  const [isEditMode, setIsEditMode] = useState(false);

  // 1. Check Session
  useEffect(() => {
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); } 
        else { setUserId(session.user.id); setUserEmail(session.user.email || 'Gerente'); }
    }
    checkSession();
  }, [router]);

  // 2. Hydrate State
  useEffect(() => {
    const hydrate = async () => {
        if (!userId) return;
        try {
            const resS = await fetch('/api/python?action=get_state', { headers: { 'user-id': userId } });
            const jsonState = await resS.json();
            if (jsonState.sucesso && jsonState.data) {
                const d = jsonState.data;
                if (d.current_track) updateTrack(d.current_track);
                if (d.driver) Object.entries(d.driver).forEach(([key, val]) => updateDriver(key as any, Number(val)));
                if (d.car) d.car.forEach((part: any, idx: number) => { updateCar(idx, 'lvl', part.lvl); updateCar(idx, 'wear', part.wear); });
                if (d.test_points) setTestPoints(d.test_points);
                if (d.weather) updateWeather(d.weather);
                if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
            }
        } catch (e) { console.error("Erro na hidratação:", e); }
        finally { setInitialLoaded(true); }
    }
    hydrate();
  }, [userId, updateTrack, updateDriver, updateCar, updateWeather, updateDesgasteModifier]);

  // 3. Auto-save
  const persistState = useCallback(async () => {
    if (!initialLoaded || !userId) return; 
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python?action=update_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify({ track, driver, car, test_points: testPoints, weather, desgasteModifier })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) updateDriver('total', Number(data.oa));
    } catch (e) { console.error("Persist error:", e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, track, weather, desgasteModifier, initialLoaded, userId, updateDriver]);

  useEffect(() => {
    if (!initialLoaded || !userId) return;
    const timer = setTimeout(() => persistState(), 2000);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, track, weather, desgasteModifier, persistState, initialLoaded, userId]);

  // 4. Performance Calc
  const fetchPerformance = useCallback(async () => {
    if (!track || track === "Selecionar Pista" || !userId || !initialLoaded) return;
    setIsPerformanceLoading(true);
    try {
        const res = await fetch('/api/python?action=performance', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
            body: JSON.stringify({ pista: track, driver, car, test_points: testPoints, test_power: testPoints.power, test_handling: testPoints.handling, test_accel: testPoints.accel }) 
        });
        const data = await res.json();
        if (data.sucesso && data.data) setPerformanceData(data.data);
    } catch (e) { console.error("Performance calc error:", e); } finally { setIsPerformanceLoading(false); }
  }, [track, driver, car, testPoints, userId, initialLoaded]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && initialLoaded && userId) {
        const timer = setTimeout(() => fetchPerformance(), 500); 
        return () => clearTimeout(timer);
    }
  }, [track, fetchPerformance, initialLoaded, userId]);

  if (!initialLoaded) return (
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#050507] text-indigo-500 font-mono text-xs gap-4">
        <Loader2 className="animate-spin w-8 h-8" />
        <span className="animate-pulse tracking-widest">INICIALIZANDO SISTEMA...</span>
    </div>
  );

  return (
    <div className="min-h-screen pb-32 md:pb-12 bg-[#050507] text-slate-300 font-mono selection:bg-indigo-500/30">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 md:space-y-8 relative z-10">
        
        {/* HEADER BAR */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-gray-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 md:p-1 shadow-2xl sticky top-4 z-50"
        >
            <div className="md:bg-black/40 md:rounded-xl md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                
                {/* Track Info */}
                <div className="w-full md:w-auto flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative group shrink-0">
                            <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/40 transition-all hidden md:block"></div>
                            <div className="w-16 h-10 md:w-20 md:h-12 bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden relative z-10 shadow-lg">
                                {track && TRACK_FLAGS[track] ? (
                                    <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                                ) : <span className="text-xl">🏁</span>}
                            </div>
                        </div>
                        <div className="md:hidden flex flex-col">
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Circuito Atual</span>
                             <span className="text-sm font-bold text-white truncate max-w-[150px]">{track}</span>
                        </div>
                    </div>
                    
                    <div className="w-full md:w-auto">
                        <h2 className="hidden md:flex text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 items-center gap-2">
                            <MapPin size={10} className="text-indigo-400"/> Seleção de Circuito
                        </h2>
                        <TrackSelector 
                            currentTrack={track} 
                            tracksList={tracksList} 
                            onSelect={updateTrack} 
                        />
                    </div>
                </div>
                
                {/* BOTÃO DE SEGURANÇA E STATUS */}
                <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6 border-t border-white/5 pt-4 md:pt-0 md:border-t-0">
                     
                     {/* Botão de Trava (Safety Lock) */}
                     <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isEditMode 
                            ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20' 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                     >
                        {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                        <div className="flex flex-col text-left">
                            <span className="text-[8px] font-black uppercase tracking-widest">Modo Edição</span>
                            <span className="text-[10px] font-bold">{isEditMode ? 'DESBLOQUEADO' : 'BLOQUEADO'}</span>
                        </div>
                     </button>

                     <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Rede</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 md:w-1.5 md:h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                            <span className={`text-[10px] font-bold ${isSyncing ? 'text-amber-500' : 'text-emerald-400'}`}>{isSyncing ? 'SYNC...' : 'ONLINE'}</span>
                        </div>
                     </div>
                </div>
            </div>
        </motion.div>

        {/* MAIN GRID */}
        <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6 relative z-0">
            
            {/* COLUNA 1: INFO GERENTE */}
            <div className="order-3 xl:order-1 xl:col-span-3 space-y-6">
                <section className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col h-full backdrop-blur-sm shadow-xl">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <User size={14} className="text-indigo-400"/>
                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">Gerente</h3>
                        </div>
                        <div className="p-1 px-2 bg-indigo-500/10 rounded border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase">Pro</div>
                    </div>
                    
                    <div className="p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-4 xl:flex-col xl:text-center">
                            <div className="w-16 h-16 xl:w-24 xl:h-24 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center text-3xl xl:text-4xl shadow-lg border border-white/10 shrink-0">
                                👨‍🚀
                            </div>
                            <div className="space-y-2 w-full">
                                <DetailRow label="Grupo" value="Elite - 01" color="text-indigo-400" />
                                <DetailRow label="Rank" value="#1" />
                                <DetailRow label="Caixa" value="$ 120M" color="text-emerald-400 font-bold" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 xl:grid-cols-1 gap-3 mt-auto">
                            <button onClick={persistState} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-[0.98]">
                                <RefreshCw size={14} className={`${isSyncing ? "animate-spin" : ""}`} />
                                <span className="hidden md:inline">Sincronizar</span>
                                <span className="md:hidden">Salvar</span>
                            </button>
                            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 px-4 rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-[0.98]">
                                <LogOut size={14} />
                                Sair
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* COLUNA 2: DADOS PILOTO */}
            <div className={`order-1 xl:order-2 xl:col-span-5 border rounded-2xl p-5 md:p-8 backdrop-blur-sm relative overflow-hidden shadow-xl transition-all duration-300 ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                {/* Indicador visual de travado */}
                {!isEditMode && (
                    <div className="absolute top-2 right-2 text-slate-700 opacity-20 pointer-events-none">
                        <Lock size={100} />
                    </div>
                )}

                <div className="flex justify-between items-center mb-6 md:mb-8 relative z-10">
                    <div className="flex items-center gap-3">
                        {isEditMode ? <Edit3 size={18} className="text-yellow-400 animate-pulse"/> : <Cpu size={18} className="text-slate-600"/>}
                        <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${isEditMode ? 'text-yellow-400' : 'text-white'}`}>
                            {isEditMode ? 'Editando Piloto' : 'Piloto (Leitura)'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                        <span className="text-[8px] font-black text-indigo-300 uppercase mr-1">OA</span>
                        <div className="text-lg font-black text-white tracking-tighter">{Number(driver.total).toFixed(1)}</div>
                    </div>
                </div>

                {/* Energia Bar */}
                <div className={`mb-8 p-4 rounded-xl border transition-colors ${isEditMode ? 'bg-black/40 border-white/10' : 'bg-black/20 border-white/5 opacity-80'}`}>
                    <div className="flex justify-between items-end mb-3">
                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <Zap size={14} className={isEditMode ? "text-amber-500" : "text-slate-600"}/> Energia
                        </span>
                        {/* INPUT NUMÉRICO DIRETO */}
                        <div className="flex items-center gap-2">
                             <input 
                                disabled={!isEditMode}
                                type="number" 
                                min={0} 
                                max={100}
                                value={driver.energia} 
                                onChange={(e)=>updateDriver('energia', Math.min(100, Math.max(0, Number(e.target.value))))} 
                                className={`w-16 h-10 bg-black/50 text-center text-sm font-black text-white rounded border focus:outline-none transition-all ${isEditMode ? 'border-yellow-500/50 focus:border-yellow-400' : 'border-white/10 text-slate-500'}`}
                             />
                             <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                    </div>
                    {/* BARRA APENAS VISUAL (SEM SLIDER) */}
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden flex relative">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${driver.energia}%` }} transition={{ duration: 1 }} className={`h-full bg-gradient-to-r shadow-[0_0_15px_#6366f1] ${isEditMode ? 'from-indigo-600 to-cyan-500' : 'from-slate-700 to-slate-600 grayscale'}`} />
                    </div>
                </div>

                {/* Inputs de Skill */}
                <div className="space-y-5 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                    {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                        <TelemetryInput 
                            key={skill} 
                            label={skill} 
                            value={(driver as any)[skill]} 
                            max={skill === 'experiencia' ? 300 : 250} 
                            onChange={(e:any)=>updateDriver(skill as any, Number(e.target.value))} 
                            disabled={!isEditMode}
                        />
                    ))}
                    
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
                        <TelemetryInput label="Peso" value={driver.peso} max={250} onChange={(e:any)=>updateDriver('peso', Number(e.target.value))} isSmall disabled={!isEditMode} />
                        <TelemetryInput label="Idade" value={driver.idade} max={99} onChange={(e:any)=>updateDriver('idade', Number(e.target.value))} isSmall disabled={!isEditMode} />
                    </div>
                </div>
            </div>

            {/* COLUNA 3: CARRO & PERFORMANCE */}
            <div className="order-2 xl:order-3 xl:col-span-4 space-y-6">
                
                {/* CARRO */}
                <section className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                    <div className="bg-white/[0.02] p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                            <Car size={14} className={isEditMode ? "text-indigo-400" : "text-slate-600"}/> Carro
                        </h3>
                        <div className="flex gap-3 pr-1">
                            <span className="text-[8px] font-black text-slate-500 w-12 text-center">NVL</span>
                            <span className="text-[8px] font-black text-slate-500 w-12 text-center">DSG%</span>
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-3 md:p-4 max-h-[400px] md:max-h-none">
                        <div className="space-y-3 md:space-y-1">
                            {car.map((part, idx) => (
                                <CarRow key={idx} part={part} 
                                    onLvl={(val: number)=>updateCar(idx, 'lvl', val)}
                                    onWear={(val: number)=>updateCar(idx, 'wear', val)}
                                    disabled={!isEditMode}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                {/* PERFORMANCE TEST */}
                <section className="bg-gray-900/40 border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                        <Activity size={16} className={isEditMode ? "text-indigo-400" : "text-slate-600"}/>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Telemetria</h3>
                    </div>
                    <div className="space-y-8">
                        <PerformanceMetric 
                            label="Power" 
                            data={performanceData.power} 
                            test={testPoints.power} 
                            onTest={(v: number) => setTestPoints(p => ({...p, power: v}))}
                            disabled={!isEditMode}
                        />
                        <PerformanceMetric 
                            label="Handling" 
                            data={performanceData.handling} 
                            test={testPoints.handling} 
                            onTest={(v: number) => setTestPoints(p => ({...p, handling: v}))}
                            disabled={!isEditMode}
                        />
                        <PerformanceMetric 
                            label="Accel" 
                            data={performanceData.accel} 
                            test={testPoints.accel} 
                            onTest={(v: number) => setTestPoints(p => ({...p, accel: v}))}
                            disabled={!isEditMode}
                        />
                    </div>
                </section>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES REFATORADOS (SEM SLIDERS) ---

function DetailRow({ label, value, color = "text-slate-300" }: any) {
    return (
        <div className="flex justify-between items-center text-[11px] border-b border-white/5 pb-3 last:border-0">
            <span className="text-slate-500 font-bold uppercase tracking-wider">{label}</span>
            <span className={`font-black ${color} text-xs`}>{value}</span>
        </div>
    )
}

function TelemetryInput({ label, value, max, onChange, isSmall, disabled }: any) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className={`space-y-2 group ${isSmall ? 'flex-1' : ''} ${disabled ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-end">
                <label className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${disabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-yellow-400'}`}>
                    {label}
                </label>
                <div className="flex items-center gap-2">
                    {/* INPUT NUMÉRICO GRANDE E CLICÁVEL */}
                    <input 
                        disabled={disabled}
                        type="number" 
                        min="0" 
                        max={max}
                        value={value} 
                        onChange={onChange}
                        // Aumentei a altura (h-10) e a fonte para facilitar o toque
                        className={`w-16 h-10 bg-black/40 text-center text-sm font-black rounded border focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'border-white/5 text-slate-600' : 'border-white/10 text-white focus:border-yellow-500 focus:bg-white/10'}`}
                    />
                    <span className="text-[9px] font-mono text-slate-600 hidden md:inline">/ {max}</span>
                </div>
            </div>
            
            {/* BARRA VISUAL (SEM SLIDER DENTRO) */}
            <div className={`h-3 rounded-full overflow-hidden flex relative transition-colors ${disabled ? 'bg-white/5' : 'bg-white/10'}`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full transition-colors ${disabled ? 'bg-slate-700' : 'bg-indigo-500'}`} />
            </div>
        </div>
    )
}

function CarRow({ part, onLvl, onWear, disabled }: any) {
    const isCritical = part.wear > 85;
    const handleLvlChange = (e: ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value); if(isNaN(val)) val = 1;
        onLvl(Math.max(1, Math.min(9, val)));
    };
    const handleWearChange = (e: ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value); if(isNaN(val)) val = 0;
        onWear(Math.max(0, Math.min(100, val)));
    };
    return (
        <div className={`flex items-center justify-between py-3 md:py-2 rounded px-2 transition-colors border-b border-white/5 md:border-0 last:border-0 ${disabled ? 'opacity-60' : 'hover:bg-white/[0.02]'}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter w-24 truncate">{part.name}</span>
            <div className="flex items-center gap-3 md:gap-4">
                <input disabled={disabled} type="number" value={part.lvl} onChange={handleLvlChange} className={`w-12 h-10 md:h-8 bg-black/40 border rounded text-center text-xs font-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'border-white/5 text-slate-600' : 'border-white/10 text-white focus:border-yellow-500'}`} />
                <div className="relative">
                    <input disabled={disabled} type="number" value={part.wear} onChange={handleWearChange} className={`w-12 h-10 md:h-8 bg-black/40 border rounded text-center text-xs font-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'border-white/5 text-slate-600' : (isCritical ? 'border-rose-500/30 text-rose-500' : 'border-white/10 text-emerald-400 focus:border-yellow-500')}`} />
                    {isCritical && !disabled && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>}
                </div>
            </div>
        </div>
    )
}

function PerformanceMetric({ label, data, test, onTest, disabled }: any) {
    const diff = data.carro - data.pista;
    const isOk = diff >= 0;
    const barPart = Math.min(100, (data.part / 200) * 100);
    const barTest = Math.min(100 - barPart, (test / 200) * 100);
    const reqPos = Math.min(100, (data.pista / 200) * 100);

    return (
        <div className={`space-y-3 ${disabled ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-16">{label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isOk ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:block text-center"><p className="text-[6px] text-slate-600 font-black uppercase">Peça</p><p className="text-[10px] font-black text-slate-400">{data.part}</p></div>
                    <div className="text-center flex flex-col items-center">
                        <p className="text-[6px] text-indigo-400/80 font-black uppercase mb-0.5">Teste</p>
                        <input disabled={disabled} type="number" value={test} onChange={(e)=>onTest(Number(e.target.value))} className={`w-14 h-9 bg-black/40 border rounded text-center text-xs font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'border-white/5 text-slate-600' : 'border-white/10 text-indigo-400 focus:border-yellow-500'}`} />
                    </div>
                    <div className="text-center bg-white/5 px-2 py-1 rounded min-w-[30px] hidden md:block"><p className="text-[6px] text-slate-500 font-black uppercase">Req</p><p className="text-[10px] font-black text-white">{data.pista}</p></div>
                </div>
            </div>
            {/* Barra Visual */}
            <div className="h-3 w-full bg-white/5 rounded-full relative overflow-visible border border-white/5">
                <div className="h-full bg-slate-600 rounded-l-full" style={{ width: `${barPart}%` }} />
                <div className={`h-full absolute top-0 ${isOk ? (disabled ? 'bg-indigo-900' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]') : (disabled ? 'bg-amber-900' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]')}`} style={{ left: `${barPart}%`, width: `${barTest}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white shadow-[0_0_8px_white] z-10 rounded-full transition-all duration-500" style={{ left: `${reqPos}%` }} />
            </div>
        </div>
    );
}