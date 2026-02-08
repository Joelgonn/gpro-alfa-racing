// --- START OF FILE app/dashboard/DashboardHome.tsx ---
'use client';
import { ChangeEvent, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext'; 
import { supabase } from '../lib/supabase';
import { 
  User, Car, Zap, Activity, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Cpu, Search, X, LogOut,
  Lock, Unlock, Edit3, Briefcase, Users
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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTracks = useMemo(() => tracksList.filter(t => t.toLowerCase().includes(search.toLowerCase())), [tracksList, search]);

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
                            {filteredTracks.map((track) => (
                                <button key={track} onClick={() => { onSelect(track); setIsOpen(false); setSearch(""); }} className={`w-full text-left px-4 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10'}`}>
                                    <div className="flex items-center gap-4">
                                        {TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-6 h-4 object-cover rounded shadow-sm" /> : <div className="w-6 h-4 bg-white/10 rounded"></div>}
                                        {track}
                                    </div>
                                    {currentTrack === track && <ShieldCheck size={14} />}
                                </button>
                            ))}
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
  
  // USANDO O CONTEXTO GLOBAL PARA TUDO (Inclusive Tech Director e Facilities)
  const { 
      driver, updateDriver, 
      car, updateCar, 
      track, updateTrack, 
      weather, updateWeather, 
      desgasteModifier, updateDesgasteModifier, 
      tracksList,
      techDirector, updateTechDirector,      // Contexto Global
      staffFacilities, updateStaffFacilities // Contexto Global
  } = useGame();
  
  const [testPoints, setTestPoints] = useState({ power: 0, handling: 0, accel: 0 });
  const [performanceData, setPerformanceData] = useState(MOCK_PERFORMANCE_DATA);
  const [calculatedWear, setCalculatedWear] = useState<number[]>([]);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // 1. Check Session
  useEffect(() => {
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) router.push('/login'); else setUserId(session.user.id);
    }
    checkSession();
  }, [router]);

  // 2. Hydrate State (Carrega do Banco e atualiza o Contexto)
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
                
                // ATUALIZA O CONTEXTO COM DADOS DO BANCO
                if (d.tech_director) updateTechDirector(d.tech_director);
                if (d.staff_facilities) updateStaffFacilities(d.staff_facilities);
                
                if (d.weather) updateWeather(d.weather);
                if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
            }
        } catch (e) { console.error("Erro na hidratação:", e); }
        finally { setInitialLoaded(true); }
    }
    hydrate();
  }, [userId, updateTrack, updateDriver, updateCar, updateWeather, updateDesgasteModifier, updateTechDirector, updateStaffFacilities]);

  // 3. Auto-save (Debounced) - Lê do Contexto
  const persistState = useCallback(async () => {
    if (!initialLoaded || !userId) return; 
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python?action=update_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify({ 
                track, driver, car, 
                test_points: testPoints, 
                tech_director: techDirector, // Lê do Contexto
                staff_facilities: staffFacilities, // Lê do Contexto
                weather, desgasteModifier 
            })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) updateDriver('total', Number(data.oa));
    } catch (e) { console.error("Persist error:", e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, initialLoaded, userId, updateDriver]);

  useEffect(() => {
    if (!initialLoaded || !userId) return;
    const timer = setTimeout(() => persistState(), 2000);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, persistState, initialLoaded, userId]);

  // 4. Calculations (Performance + Wear)
  const fetchCalculations = useCallback(async () => {
    if (!track || track === "Selecionar Pista" || !userId || !initialLoaded) return;
    setIsPerformanceLoading(true);
    try {
        // PERFORMANCE
        const resPerf = await fetch('/api/python?action=performance', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
            body: JSON.stringify({ 
                pista: track, 
                driver, 
                car, 
                test_points: testPoints,
                tech_director: techDirector,     // Envia para calculo
                staff_facilities: staffFacilities // Envia para calculo
            }) 
        });
        const dataPerf = await resPerf.json();
        if (dataPerf.sucesso && dataPerf.data) setPerformanceData(dataPerf.data);

        // SETUP & WEAR
        const resSetup = await fetch('/api/python?action=setup_calculate', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
            body: JSON.stringify({ 
                pista: track, 
                driver, 
                car, 
                desgasteModifier,
                tech_director: techDirector, // Envia para calculo
                staff_facilities: staffFacilities // Envia para calculo
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
  }, [track, driver, car, testPoints, desgasteModifier, techDirector, staffFacilities, userId, initialLoaded]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && initialLoaded && userId) {
        const timer = setTimeout(() => fetchCalculations(), 600); 
        return () => clearTimeout(timer);
    }
  }, [track, driver, car, testPoints, desgasteModifier, fetchCalculations, initialLoaded, userId]);

  if (!initialLoaded) return (
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
                    <button onClick={persistState} className="group flex flex-col items-center gap-1 active:scale-95 transition-transform">
                         <div className={`p-2 rounded-lg border bg-white/5 border-white/10 ${isSyncing ? 'animate-spin border-amber-500 text-amber-500' : 'text-slate-400 group-hover:text-indigo-400'}`}><RefreshCw size={18} /></div>
                         <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Salvar</span>
                    </button>
                    <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="group flex flex-col items-center gap-1 active:scale-95">
                         <div className="p-2 rounded-lg border bg-white/5 border-white/10 text-slate-400 group-hover:text-red-400 transition-colors"><LogOut size={18} /></div>
                         <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Sair</span>
                    </button>
                    <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isEditMode ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
                        <div className="flex flex-col text-left"><span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Modo Edição</span><span className="text-[10px] font-bold">{isEditMode ? 'DESBLOQUEADO' : 'BLOQUEADO'}</span></div>
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
                    <div className="flex items-center gap-3">{isEditMode ? <Edit3 size={18} className="text-yellow-400 animate-pulse"/> : <Cpu size={18} className="text-slate-600"/>}<h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Piloto</h3></div>
                    <div className="bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-lg font-black text-white">{Number(driver.total).toFixed(1)}</div>
                </div>
                <div className="flex flex-col gap-1">
                    <TelemetryInput label="Energia" value={driver.energia} max={100} onChange={(e:any)=>updateDriver('energia', Number(e.target.value))} disabled={!isEditMode} isEnergy />
                    {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                        <TelemetryInput key={skill} label={skill} value={(driver as any)[skill]} max={skill === 'experiencia' ? 300 : 250} onChange={(e:any)=>updateDriver(skill as any, Number(e.target.value))} disabled={!isEditMode} />
                    ))}
                    <div className="flex items-center gap-3 h-7 mt-2 border-t border-white/5 pt-2">
                         <div className="flex-1 flex items-center justify-between bg-black/20 rounded px-2 border border-white/5"><span className="text-[9px] font-black text-slate-500 uppercase">Peso</span><input disabled={!isEditMode} type="number" value={driver.peso} onChange={(e)=>updateDriver('peso', Number(e.target.value))} className="w-10 bg-transparent text-right text-xs font-black text-white outline-none" /></div>
                         <div className="flex-1 flex items-center justify-between bg-black/20 rounded px-2 border border-white/5"><span className="text-[9px] font-black text-slate-500 uppercase">Idade</span><input disabled={!isEditMode} type="number" value={driver.idade} onChange={(e)=>updateDriver('idade', Number(e.target.value))} className="w-10 bg-transparent text-right text-xs font-black text-white outline-none" /></div>
                    </div>
                </div>
            </div>

            {/* COLUNA 2: CARRO */}
            <section className="bg-gray-900/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl h-full">
                <div className="bg-white/[0.02] p-4 border-b border-white/5 flex justify-between items-center mb-1">
                    <h3 className="text-[10px] font-black uppercase text-white flex items-center gap-2"><Car size={14} className="text-slate-400"/> Carro</h3>
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
                <div className="flex items-center gap-3 border-b border-white/5 pb-4"><Activity size={16} className="text-indigo-400"/><h3 className="text-[10px] font-black uppercase text-white tracking-widest">Telemetria de Performance</h3></div>
                {['power', 'handling', 'accel'].map((key) => (
                    <PerformanceMetric key={key} label={key} data={(performanceData as any)[key]} test={(testPoints as any)[key]} onTest={(v: number) => setTestPoints(p => ({...p, [key]: v}))} disabled={!isEditMode} />
                ))}
            </section>
        </div>

        {/* SECOND ROW: TECH & FACILITIES - USANDO CONTEXTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-0">
            
            {/* DIRETOR TÉCNICO */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                        <Briefcase size={18} className={isEditMode ? "text-yellow-400" : "text-slate-600"}/>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Diretor Técnico</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <TelemetryInput label="R&D Mecânico" value={techDirector.rdMecanico} max={200} onChange={(e:any)=>updateTechDirector({ rdMecanico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D Eletrônico" value={techDirector.rdEletronico} max={200} onChange={(e:any)=>updateTechDirector({ rdEletronico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="R&D Aerodinâmico" value={techDirector.rdAerodinamico} max={200} onChange={(e:any)=>updateTechDirector({ rdAerodinamico: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="Experiência" value={techDirector.experiencia} max={200} onChange={(e:any)=>updateTechDirector({ experiencia: Number(e.target.value) })} disabled={!isEditMode} />
                    <TelemetryInput label="Cord. de Pit" value={techDirector.pitCoord} max={200} onChange={(e:any)=>updateTechDirector({ pitCoord: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

            {/* PESSOAL E INSTALAÇÕES */}
            <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-gray-900/60 border-yellow-500/20 shadow-yellow-500/5' : 'bg-gray-900/40 border-white/5'}`}>
                 <div className="flex justify-between items-center relative z-10 border-b border-white/5 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                        <Users size={18} className={isEditMode ? "text-yellow-400" : "text-slate-600"}/>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Pessoal e Instalações</h3>
                    </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                     <TelemetryInput label="Tolerância a Pressão" value={staffFacilities.toleranciaPressao} max={200} onChange={(e:any)=>updateStaffFacilities({ toleranciaPressao: Number(e.target.value) })} disabled={!isEditMode} />
                     <TelemetryInput label="Concentração" value={staffFacilities.concentracao} max={200} onChange={(e:any)=>updateStaffFacilities({ concentracao: Number(e.target.value) })} disabled={!isEditMode} />
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}

// --- SUBCOMPONENTES ---

function TelemetryInput({ label, value, max, onChange, disabled, isEnergy }: any) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className={`flex items-center justify-between h-7 group transition-colors ${disabled ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}>
            <label className={`text-[10px] font-black uppercase tracking-tighter truncate w-32 flex items-center gap-2 ${disabled ? 'text-slate-600' : 'text-slate-400 group-hover:text-yellow-400'}`}>
                {isEnergy && <Zap size={10} className={pct > 50 ? "text-indigo-400" : "text-amber-500"} />}{label}
            </label>
            <div className={`flex-1 mx-3 h-1.5 rounded-full overflow-hidden flex relative transition-colors ${disabled ? 'bg-white/5' : 'bg-white/10'}`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full transition-colors ${disabled ? 'bg-slate-700' : (isEnergy ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-indigo-500')}`} />
            </div>
            <input disabled={disabled} type="number" value={value} onChange={onChange} className="w-12 h-6 bg-black/40 text-center text-xs font-black rounded border border-white/10 text-white outline-none focus:border-yellow-500" />
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