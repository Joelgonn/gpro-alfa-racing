// --- START OF FILE app/dashboard/DashboardHome.tsx ---
'use client';
import { ChangeEvent, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext'; 
import { supabase } from '../lib/supabase';
import { 
  Settings, User, Car, Zap, Activity, Trophy, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Gauge, Cpu, Search, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. MAPEAMENTO DE BANDEIRAS (MANTIDO IGUAL) ---
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

// --- COMPONENTE DE SELEÇÃO CUSTOMIZADO (MANTIDO IGUAL) ---
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
        <div className="relative z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 text-2xl text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group"
            >
                {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR PISTA"}
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-[300px] bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Buscar pista..." 
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 outline-none font-bold uppercase"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                            {filteredTracks.length > 0 ? (
                                filteredTracks.map((track) => (
                                    <button
                                        key={track}
                                        onClick={() => {
                                            onSelect(track);
                                            setIsOpen(false);
                                            setSearch("");
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {TRACK_FLAGS[track] ? (
                                                <img 
                                                    src={`/flags/${TRACK_FLAGS[track]}.png`} 
                                                    alt={track} 
                                                    className="w-5 h-3 object-cover rounded shadow-sm opacity-70 group-hover:opacity-100" 
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : <div className="w-5 h-3 bg-white/10 rounded"></div>}
                                            {track}
                                        </div>
                                        {currentTrack === track && <ShieldCheck size={12} />}
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-[10px] text-slate-600 font-bold uppercase">
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

// --- MAIN COMPONENT ---
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

  // --- 1. VERIFICAÇÃO DE LOGIN (SUPABASE) ---
  useEffect(() => {
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push('/login');
        } else {
            setUserId(session.user.id);
            setUserEmail(session.user.email || 'Gerente');
        }
    }
    checkSession();
  }, [router]);

  // --- 2. HIDRATAÇÃO INICIAL DO ESTADO DO USUÁRIO ---
  useEffect(() => {
    // Definimos a função async aqui dentro para ser chamada em seguida.
    const hydrate = async () => {
        // ---> CORREÇÃO 1 <---
        // Adicionamos a verificação aqui. Se não houver userId, a função para.
        // O TypeScript agora sabe que, se o código continuar, 'userId' é uma string.
        if (!userId) return;

        try {
            const resS = await fetch('/api/python?action=get_state', {
                headers: { 'user-id': userId } // Agora é seguro usar userId
            });
            const jsonState = await resS.json();
            
            if (jsonState.sucesso && jsonState.data) {
                const d = jsonState.data;
                if (d.current_track) updateTrack(d.current_track);
                if (d.driver) Object.entries(d.driver).forEach(([key, val]) => updateDriver(key as any, Number(val)));
                if (d.car) d.car.forEach((part: any, idx: number) => {
                    updateCar(idx, 'lvl', part.lvl);
                    updateCar(idx, 'wear', part.wear);
                });
                if (d.test_points) setTestPoints(d.test_points);
                if (d.weather) updateWeather(d.weather);
                if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
            }
        } catch (e) { console.error("Erro na hidratação:", e); }
        finally { setInitialLoaded(true); }
    }
    hydrate();
  }, [userId, updateTrack, updateDriver, updateCar, updateWeather, updateDesgasteModifier]);

  // --- 3. PERSISTÊNCIA AUTOMÁTICA (Auto-save) ---
  const persistState = useCallback(async () => {
    // ---> CORREÇÃO 2 <---
    // A verificação já existia aqui, o que é ótimo!
    // Esta guarda garante que userId é uma string para o restante da função.
    if (!initialLoaded || !userId) return; 
    
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python?action=update_state', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'user-id': userId // Seguro para uso
            },
            body: JSON.stringify({ 
                track,
                driver, 
                car, 
                test_points: testPoints,
                weather,
                desgasteModifier
            })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) updateDriver('total', Number(data.oa));
    } catch (e) { console.error("Erro na persistência:", e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, track, weather, desgasteModifier, initialLoaded, updateDriver, userId]);

  useEffect(() => {
    if (!initialLoaded || !userId) return;
    const timer = setTimeout(() => persistState(), 2000);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, track, weather, desgasteModifier, persistState, initialLoaded, userId]);

  // --- 4. CÁLCULO DE PERFORMANCE ---
  const fetchPerformance = useCallback(async () => {
    // ---> CORREÇÃO 3 <---
    // A verificação aqui também já estava correta.
    // Garante que userId não é null antes de prosseguir.
    if (!track || track === "Selecionar Pista" || !userId || !initialLoaded) return;
    
    setIsPerformanceLoading(true);
    
    const payload = {
        pista: track,
        driver: driver,
        car: car,
        test_points: testPoints,
        test_power: testPoints.power,
        test_handling: testPoints.handling,
        test_accel: testPoints.accel
    };

    try {
        const res = await fetch('/api/python?action=performance', {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'user-id': userId // Seguro para uso
            }, 
            body: JSON.stringify(payload) 
        });
        const data = await res.json();
        if (data.sucesso && data.data) setPerformanceData(data.data);
    } catch (e) { console.error("Erro no cálculo de performance:", e); } finally { setIsPerformanceLoading(false); }
  }, [track, driver, car, testPoints, userId, initialLoaded]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && initialLoaded && userId) {
        const timer = setTimeout(() => fetchPerformance(), 500); 
        return () => clearTimeout(timer);
    }
  }, [track, fetchPerformance, initialLoaded, userId]);

  if (!initialLoaded) return <div className="flex h-screen items-center justify-center bg-[#050507] text-indigo-500 animate-pulse font-mono text-xs">CARREGANDO SISTEMA...</div>;

  return (
    <div className="p-6 space-y-8 animate-fadeIn text-slate-300 pb-24 font-mono max-w-[1600px] mx-auto">
      
      {/* HEADER BAR: SELEÇÃO DE PISTA */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 shadow-2xl relative z-40">
        <div className="bg-black/40 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
            <div className="flex items-center gap-8 w-full md:w-auto">
                <div className="relative group shrink-0">
                    <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/40 transition-all"></div>
                    <div className="w-20 h-12 bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden relative z-10">
                        {track && TRACK_FLAGS[track] ? (
                            <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">🏁</span>}
                    </div>
                </div>
                
                <div>
                    <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                        <MapPin size={10} className="text-indigo-400"/> Circuito Pista Atual
                    </h2>
                    <TrackSelector 
                        currentTrack={track} 
                        tracksList={tracksList}
                        onSelect={updateTrack} 
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                 <div className="hidden md:block text-right">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Gerente Logado</span>
                    <span className="text-[10px] font-bold text-indigo-300">{userEmail}</span>
                 </div>

                 <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Status_Rede</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                        <span className={`text-[10px] font-bold ${isSyncing ? 'text-amber-500' : 'text-emerald-400'}`}>{isSyncing ? 'SINCRONIZANDO' : 'SISTEMA_PRONTO'}</span>
                    </div>
                 </div>
            </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-0">
        {/* COLUNA 1: INFO GERENTE */}
        <div className="xl:col-span-3 space-y-6">
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-full backdrop-blur-sm">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={16} className="text-indigo-400"/>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Perfil do Gerente</h3>
                    </div>
                    <div className="p-1 bg-indigo-500/10 rounded border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase">Classe_A</div>
                </div>
                <div className="p-8 flex flex-col gap-8">
                    <div className="flex justify-center relative">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl flex items-center justify-center text-4xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] border border-white/20">👨‍🚀</div>
                    </div>
                    <div className="space-y-4">
                        <DetailRow label="Grupo" value="Amateur - 22" color="text-indigo-400" />
                        <DetailRow label="Posição_Global" value="#16" />
                        <DetailRow label="Finanças" value="$ 87.7M" color="text-emerald-400 font-bold" />
                    </div>
                    <button onClick={persistState} className="w-full mt-4 bg-white/[0.03] hover:bg-indigo-600 hover:text-white py-4 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-widest group">
                        <RefreshCw size={14} className={`group-hover:rotate-180 transition-transform duration-700 ${isSyncing ? "animate-spin" : ""}`} />
                        Sincronizar_Dados
                    </button>
                    <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full mt-2 bg-red-500/10 hover:bg-red-500 hover:text-white py-3 rounded-xl border border-red-500/20 transition-all text-[8px] font-black uppercase tracking-widest text-red-400">
                        Sair do Sistema
                    </button>
                </div>
            </section>
        </div>

        {/* COLUNA 2: DADOS PILOTO */}
        <div className="xl:col-span-5 bg-white/[0.02] border border-white/5 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <Cpu size={18} className="text-indigo-400"/>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Habilidades do Piloto</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Pontuação_OA</span>
                    <div className="text-xl font-black text-indigo-400 tracking-tighter bg-indigo-500/10 px-3 py-1 rounded border border-indigo-500/20">{Number(driver.total).toFixed(1)}</div>
                </div>
            </div>

            <div className="mb-10 bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <span className="flex items-center gap-2"><Zap size={12} className="text-amber-500 animate-pulse"/> Energia_Atual</span>
                    <span className="text-white">{driver.energia}%</span>
                </div>
                <div className="h-4 bg-white/5 rounded-full overflow-hidden flex relative">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${driver.energia}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_0_15px_#6366f1]" />
                    <input type="number" min={0} max={100} value={driver.energia} onChange={(e)=>updateDriver('energia', Math.min(100, Math.max(0, Number(e.target.value))))} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                    <TelemetryInput key={skill} label={skill} value={(driver as any)[skill]} max={skill === 'experiencia' ? 300 : 250} onChange={(e:any)=>updateDriver(skill as any, Number(e.target.value))} />
                ))}
                
                <div className="grid grid-cols-2 gap-6 mt-8">
                    <TelemetryInput label="Peso" value={driver.peso} max={250} onChange={(e:any)=>updateDriver('peso', Number(e.target.value))} isSmall />
                    <TelemetryInput label="Idade" value={driver.idade} max={99} onChange={(e:any)=>updateDriver('idade', Number(e.target.value))} isSmall />
                </div>
            </div>

            <div className="mt-8 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 grid grid-cols-5 gap-2 text-center">
                {Object.entries(performanceData.zs || {}).map(([key, val]) => (
                    <div key={key}>
                        <p className="text-[7px] font-black text-slate-600 uppercase mb-1">{key}</p>
                        <p className="text-[10px] font-black text-indigo-400">{val}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* COLUNA 3: CARRO & PERFORMANCE */}
        <div className="xl:col-span-4 space-y-6">
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2"><Car size={14} className="text-indigo-400"/> Status do Carro</h3>
                    <div className="flex gap-4 pr-2">
                        <span className="text-[8px] font-black text-slate-500 w-12 text-center">NÍVEL</span>
                        <span className="text-[8px] font-black text-slate-500 w-12 text-center">DESG</span>
                    </div>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-4">
                    <div className="space-y-2">
                        {car.map((part, idx) => (
                            <CarRow key={idx} part={part} 
                                onLvl={(val: number)=>updateCar(idx, 'lvl', val)}
                                onWear={(val: number)=>updateCar(idx, 'wear', val)}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <Activity size={16} className="text-indigo-400"/>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Análise Carro x Pista</h3>
                </div>
                <div className="space-y-8">
                    <PerformanceMetric 
                        label="Power" 
                        data={performanceData.power} 
                        test={testPoints.power} 
                        onTest={(v: number) => setTestPoints(p => ({...p, power: v}))}
                    />
                    <PerformanceMetric 
                        label="Handling" 
                        data={performanceData.handling} 
                        test={testPoints.handling} 
                        onTest={(v: number) => setTestPoints(p => ({...p, handling: v}))}
                    />
                    <PerformanceMetric 
                        label="Accel" 
                        data={performanceData.accel} 
                        test={testPoints.accel} 
                        onTest={(v: number) => setTestPoints(p => ({...p, accel: v}))}
                    />
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES AUXILIARES (IGUAIS AO ANTERIOR) ---
function DetailRow({ label, value, color = "text-slate-300" }: any) {
    return (
        <div className="flex justify-between items-center text-[10px] border-b border-white/5 pb-3 last:border-0">
            <span className="text-slate-500 font-bold uppercase tracking-wider">{label}</span>
            <span className={`font-black ${color}`}>{value}</span>
        </div>
    )
}

function TelemetryInput({ label, value, max, onChange, isSmall }: any) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className={`space-y-2 group ${isSmall ? 'flex-1' : ''}`}>
            <div className="flex justify-between items-end">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => {
                    const input = document.getElementById(`input-${label}`);
                    if(input) input.focus();
                }}>
                    {label}
                </label>
                <div className="flex items-center gap-1">
                    <input 
                        id={`input-${label}`}
                        type="number" 
                        min="0" 
                        max={max}
                        value={value} 
                        onChange={onChange}
                        className="w-10 bg-black/30 text-right text-[10px] font-black text-white px-1 py-0.5 rounded border border-white/5 focus:border-indigo-500 focus:bg-white/10 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[8px] font-mono text-slate-600">/ {max}</span>
                </div>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden flex relative cursor-pointer group-hover:bg-white/10 transition-colors">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-indigo-500/80 group-hover:bg-indigo-500 transition-colors" />
                <input type="range" min="0" max={max} value={value} onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </div>
        </div>
    )
}

function CarRow({ part, onLvl, onWear }: any) {
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
        <div className="flex items-center justify-between py-2 hover:bg-white/[0.02] rounded px-2 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter w-24">{part.name}</span>
            <div className="flex items-center gap-4">
                <input type="number" value={part.lvl} onChange={handleLvlChange} className="w-12 h-8 bg-black/40 border border-white/10 rounded text-center text-xs font-black text-white outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <div className="relative">
                    <input type="number" value={part.wear} onChange={handleWearChange} className={`w-12 h-8 bg-black/40 border border-white/10 rounded text-center text-xs font-black outline-none focus:border-indigo-500/50 focus:bg-white/5 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isCritical ? 'text-rose-500 animate-pulse border-rose-500/30' : 'text-emerald-400'}`} />
                    {isCritical && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>}
                </div>
            </div>
        </div>
    )
}

function PerformanceMetric({ label, data, test, onTest }: any) {
    const diff = data.carro - data.pista;
    const isOk = diff >= 0;
    const barPart = Math.min(100, (data.part / 200) * 100);
    const barTest = Math.min(100 - barPart, (test / 200) * 100);
    const reqPos = Math.min(100, (data.pista / 200) * 100);

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isOk ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center"><p className="text-[6px] text-slate-600 font-black uppercase">Peça</p><p className="text-[10px] font-black text-slate-400">{data.part}</p></div>
                    <div className="text-center">
                        <p className="text-[6px] text-indigo-400/80 font-black uppercase">Teste</p>
                        <input type="number" value={test} onChange={(e)=>onTest(Number(e.target.value))} className="w-10 h-6 bg-black/40 border border-white/10 rounded text-center text-[10px] font-black text-indigo-400 outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <div className="text-center bg-white/5 px-2 py-1 rounded min-w-[30px]"><p className="text-[6px] text-slate-500 font-black uppercase">Req</p><p className="text-[10px] font-black text-white">{data.pista}</p></div>
                </div>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full relative overflow-visible border border-white/5">
                <div className="h-full bg-slate-600 rounded-l-full" style={{ width: `${barPart}%` }} />
                <div className={`h-full absolute top-0 ${isOk ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'}`} style={{ left: `${barPart}%`, width: `${barTest}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white shadow-[0_0_8px_white] z-10 rounded-full" style={{ left: `${reqPos}%` }} />
            </div>
        </div>
    );
}