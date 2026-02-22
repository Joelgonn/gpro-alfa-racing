// --- START OF FILE app/setup/SetupPage.tsx ---
'use client';

import { useState, useEffect, ChangeEvent, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useGame } from '../../context/GameContext';

import {
  Loader2, Settings, ShieldAlert,
  MapPin, ChevronDown, Search, X, ShieldCheck, 
  CloudSun, Thermometer, Sun, CloudRain, FlaskConical, Timer, Wind, Gauge, Snowflake, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

// --- SELETOR DE PISTA ---
function TrackSelector({ currentTrack, tracksList, onSelect, placeholder = "SELECIONAR PISTA" }: { currentTrack: string, tracksList: string[], onSelect: (t: string) => void, placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);
    const filteredTracks = useMemo(() => tracksList.filter(t => t.toLowerCase().includes(search.toLowerCase())), [tracksList, search]);
    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 text-xs md:text-sm text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : placeholder}
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={16} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-64 bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-[60]">
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input autoFocus type="text" placeholder="Buscar pista..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 outline-none font-bold uppercase" />{search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}</div></div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">{filteredTracks.map(track => (<button key={track} onClick={() => { onSelect(track); setIsOpen(false); setSearch(""); }} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><div className="flex items-center gap-3">{TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-5 h-3 object-cover rounded-sm shadow-sm" /> : <div className="w-5 h-3 bg-white/10 rounded-sm"></div>}{track}</div>{currentTrack === track && <ShieldCheck size={12} />}</button>))}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- COMPONENTES OTIMIZADOS ---

// 1. HUDInput Reativo (Termômetro muda de cor)
function HUDInput({ value, name, onChange, label }: any) { 
    const val = Number(value);
    
    // Lógica de cor baseada na temperatura
    const getIconColor = () => {
        if (!value) return "text-slate-600";
        if (val < 15) return "text-cyan-400";
        if (val < 30) return "text-emerald-400";
        return "text-orange-500";
    };

    const IconComponent = !value ? Thermometer : (val < 15 ? Snowflake : (val > 30 ? Flame : Thermometer));

    return (
        <div className="relative bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 rounded-xl p-3 flex flex-col justify-between group hover:border-indigo-500/30 transition-all h-24">
            <div className="flex items-start justify-between">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
                <IconComponent size={16} className={`transition-colors duration-500 ${getIconColor()}`} />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
                <input 
                    type="number" 
                    name={name} 
                    value={value || ''} 
                    onChange={onChange} 
                    placeholder="0"
                    className="bg-transparent text-white font-black text-3xl outline-none w-full placeholder-slate-800" 
                />
                <span className="text-xs text-slate-500 font-bold mb-1">°C</span>
            </div>
        </div>
    ) 
}

// 2. WeatherSwitch Animado
function WeatherSwitch({ name, value, onChange }: any) { 
    const isDry = value === 'Dry'; 
    return (
        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 h-10 w-full overflow-hidden relative">
            
            <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ target: { name, value: 'Dry' } })} 
                className={`flex-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 relative z-10 ${
                    isDry ? 'text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
            >
                {isDry && <motion.div layoutId="bg-weather" className="absolute inset-0 bg-gradient-to-br from-orange-500 to-orange-600 rounded-md -z-10" />}
                <Sun size={14} className={isDry ? "animate-[spin_10s_linear_infinite]" : ""} /> Seco
            </motion.button>

            <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ target: { name, value: 'Wet' } })} 
                className={`flex-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 relative z-10 ${
                    !isDry ? 'text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
            >
                {!isDry && <motion.div layoutId="bg-weather" className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-md -z-10" />}
                <CloudRain size={14} /> Chuva
            </motion.button>
        </div>
    ) 
}

// 3. SetupCard Compacto e Colorido (Vermelho, Amarelo, Verde)
function SetupCard({ part, data }: { part: string, data: any }) {
    const safeRender = (val: any) => (val === null || val === undefined || typeof val === 'object') ? '-' : val;
    
    return (
        <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/5 hover:border-white/10 rounded-xl p-2.5 transition-all group">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{part.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5">
                {/* Q1 - RED */}
                <div className="flex flex-col items-center p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/20">
                    <span className="text-[7px] font-black text-rose-500/70 mb-0.5 uppercase">Q1</span>
                    <span className="text-sm font-black text-rose-400 font-mono leading-none">{safeRender(data?.q1)}</span>
                </div>
                
                {/* Q2 - YELLOW/AMBER */}
                <div className="flex flex-col items-center p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <span className="text-[7px] font-black text-amber-500/70 mb-0.5 uppercase">Q2</span>
                    <span className="text-sm font-black text-amber-400 font-mono leading-none">{safeRender(data?.q2)}</span>
                </div>

                {/* RACE - GREEN */}
                <div className="flex flex-col items-center p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 relative overflow-hidden shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 blur-md opacity-40"></div>
                    <span className="text-[7px] font-black text-emerald-500 mb-0.5 uppercase tracking-widest">Corrida</span>
                    <span className="text-base font-black text-white leading-none">{safeRender(data?.race)}</span>
                </div>
            </div>
        </div>
    )
}

export default function SetupPage() {
  const router = useRouter(); 
  
  const { 
      track, updateTrack, 
      driver, updateDriver, 
      car, updateCar, 
      weather, updateWeather, 
      desgasteModifier, updateDesgasteModifier, 
      raceAvgTemp,
      techDirector, updateTechDirector,
      staffFacilities, updateStaffFacilities,
      updateIdealSetup 
  } = useGame();
  
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [initialHydrationDone, setInitialHydrationDone] = useState(false); 
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente'); 

  // --- NOVO ESTADO: Pista de Teste e Voltas ---
  const [testTrack, setTestTrack] = useState<string>("Selecionar Pista");
  const [testLaps, setTestLaps] = useState<number>(0);
  const [testResults, setTestResults] = useState<any>(null);

  // --- LÓGICA DE AVISO (LIMIT 90%) ---
  const hasTestingLimitWarning = useMemo(() => {
      if (!testResults) return false;
      return Object.values(testResults).some((part: any) => {
          return part.pre_race && part.pre_race > 90.4;
      });
  }, [testResults]);

  // 1. Auth Check
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
  
  // 2. Hydrate
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
          if (d.weather) updateWeather(d.weather);
          if (d.driver) Object.entries(d.driver).forEach(([k, v]) => updateDriver(k as any, Number(v)));
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });
          if (d.tech_director) updateTechDirector(d.tech_director);
          if (d.staff_facilities) updateStaffFacilities(d.staff_facilities);
          if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
        }
      } catch (e) { console.error("Hydrate error:", e); }
      finally { setInitialHydrationDone(true); } 
    }
    hydrate();
  }, [userId, isAuthLoading, updateTrack, updateWeather, updateDriver, updateCar, updateTechDirector, updateStaffFacilities, updateDesgasteModifier]); 

  // 3. AUTO-SAVE LOGIC
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
                  driver,
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
  }, [track, weather, desgasteModifier, driver, car, techDirector, staffFacilities, initialHydrationDone, userId]);

  useEffect(() => {
      if (!initialHydrationDone || !userId) return;
      const timer = setTimeout(() => { persistChanges(); }, 2000);
      return () => clearTimeout(timer);
  }, [track, weather, desgasteModifier, techDirector, staffFacilities, persistChanges, initialHydrationDone, userId]);

  // 4. CALCULATION LOGIC
  const handleCalcular = useCallback(async () => { 
    if (!userId || !track || track === "Selecionar Pista" || !initialHydrationDone) return;
    setLoading(true);
    try {
      const res = await fetch('/api/python?action=setup_calculate', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({ 
            pista: track, 
            driver, car, 
            tech_director: techDirector,
            staff_facilities: staffFacilities,
            tempQ1: weather.tempQ1, tempQ2: weather.tempQ2, 
            weatherQ1: weather.weatherQ1, weatherQ2: weather.weatherQ2, 
            weatherRace: weather.weatherRace, 
            raceAvgTemp, desgasteModifier 
        })
      });
      const data = await res.json();
      if (data.sucesso) {
          setResultado(data.data);
          updateIdealSetup(data.data); // <-- AQUI SALVAMOS GLOBALMENTE NO CONTEXTO
      }
    } catch (error) { console.error("Calc error:", error); }
    finally { setLoading(false); }
  }, [userId, track, driver, car, techDirector, staffFacilities, weather, raceAvgTemp, desgasteModifier, initialHydrationDone, updateIdealSetup]);

  useEffect(() => {
    if (initialHydrationDone && userId && track && track !== "Selecionar Pista") {
      const timer = setTimeout(() => { handleCalcular(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [weather, track, desgasteModifier, techDirector, staffFacilities, handleCalcular, initialHydrationDone, userId]);

  // 5. LOGICA DE TESTES
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
                driver, 
                car, 
                tech_director: techDirector,
                staff_facilities: staffFacilities,
                desgasteModifier
            })
        });
        const data = await res.json();
        if (data.sucesso) setTestResults(data.data);
    } catch (error) { console.error("Test Calc Error:", error); }
  }, [userId, testTrack, testLaps, driver, car, techDirector, staffFacilities, desgasteModifier, initialHydrationDone]);

  useEffect(() => {
      if(testTrack !== "Selecionar Pista") {
          const timer = setTimeout(() => { handleCalculateTest(); }, 500);
          return () => clearTimeout(timer);
      } else {
          setTestResults(null);
      }
  }, [testTrack, testLaps, handleCalculateTest]);


  // --- Helpers ---
  const handleWeatherChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isText = name.includes('weather');
    updateWeather({ [name]: isText ? value : Number(value) });
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
      if(val > 85) return 'text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)] border-rose-500/30';
      if(val > 50) return 'text-amber-400 border-amber-500/30';
      return 'text-emerald-400 border-emerald-500/30';
  };

  const isTestActive = testTrack !== "Selecionar Pista";

  if (isAuthLoading || !initialHydrationDone) return <div className="flex h-screen items-center justify-center bg-[#050507]"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  if (!userId) return null;

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 animate-fadeIn text-slate-300 pb-24 font-mono max-w-[1600px] mx-auto">
      
      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 shadow-2xl relative z-40">
        <div className="bg-black/40 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 backdrop-blur-xl">
          <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
            <div className="relative group shrink-0">
              <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full"></div>
              <div className="w-16 h-10 md:w-20 md:h-12 bg-zinc-900 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative z-10 shadow-lg">
                {track && TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" /> : <span className="text-xl">🏁</span>}
              </div>
            </div>
            <div>
              <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2"><MapPin size={10} className="text-indigo-400" /> Circuito Atual</h2>
              <TrackSelector currentTrack={track} tracksList={tracks} onSelect={updateTrack} />
            </div>
          </div>
          
          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="flex flex-col items-end border-r border-white/10 pr-6 mr-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Status</span>
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                    <span className={`text-[10px] font-bold ${isSyncing ? 'text-amber-500' : 'text-emerald-400'}`}>
                        {isSyncing ? 'SALVANDO...' : 'SALVO'}
                    </span>
                </div>
            </div>

            <div className="text-left md:text-right border-r border-white/10 pr-4 md:mr-2 hidden md:block">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Logado como</span>
              <span className="text-[10px] font-bold text-indigo-300 truncate max-w-[100px] md:max-w-none">{userEmail}</span>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">Temp. Média Corrida</p>
              <p className="text-2xl font-black text-indigo-400">{raceAvgTemp.toFixed(1)}°C</p>
            </div>
          </div>
        </div>
      </motion.div>

      <main className="space-y-6">
        
        {/* === CLIMA & SETUP IDEAL (Refatorado para Mobile First e Cards Coloridos) === */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
            
            {/* --- SEÇÃO DE CLIMA --- */}
            <div className="xl:col-span-7">
              <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm h-full flex flex-col">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <CloudSun size={20} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Metereologia</h2>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Configurações da Sessão</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                  
                  {/* Card Esquerda: Qualificação */}
                  <div className="space-y-4">
                    {/* Q1 Card */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qualificação 1</span>
                        <span className="text-[8px] px-2 py-0.5 rounded bg-white/5 text-slate-500 font-bold">Sessão 1</span>
                      </div>
                      <div className="space-y-3">
                        <WeatherSwitch name="weatherQ1" value={weather.weatherQ1} onChange={handleWeatherChange} />
                        <HUDInput value={weather.tempQ1} name="tempQ1" onChange={handleWeatherChange} label="Temperatura Q1" />
                      </div>
                    </div>

                    {/* Q2 Card */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qualificação 2</span>
                        <span className="text-[8px] px-2 py-0.5 rounded bg-white/5 text-slate-500 font-bold">Sessão 2</span>
                      </div>
                      <div className="space-y-3">
                        <WeatherSwitch name="weatherQ2" value={weather.weatherQ2} onChange={handleWeatherChange} />
                        <HUDInput value={weather.tempQ2} name="tempQ2" onChange={handleWeatherChange} label="Temperatura Q2" />
                      </div>
                    </div>
                  </div>

                  {/* Card Direita: Corrida (OTIMIZADO MOBILE FIRST) */}
                <div className="bg-gradient-to-br from-indigo-900/10 to-transparent rounded-xl border border-indigo-500/20 flex flex-col relative overflow-hidden h-full group">
                    
                    {/* Background Decorativo */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full -z-10 transition-opacity opacity-50 group-hover:opacity-100 pointer-events-none"></div>

                    {/* Cabeçalho e Controles */}
                    <div className="p-4 border-b border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-500/20 rounded-md shadow-inner shadow-indigo-500/10">
                                    <Wind size={14} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Corrida</h3>
                                    <p className="text-[8px] text-indigo-300/60 font-bold uppercase mt-0.5">4 Períodos</p>
                                </div>
                            </div>
                            
                            {/* Display da Média Calculada */}
                            <div className="text-right bg-black/20 px-2 py-1 rounded border border-white/5">
                                <span className="text-[7px] text-slate-500 font-bold uppercase block tracking-wider">Média Est.</span>
                                <span className="text-sm font-black text-white leading-none tracking-tight">{raceAvgTemp.toFixed(1)}°</span>
                            </div>
                        </div>
                        
                        {/* Switch de Clima (Seco/Chuva) */}
                        <WeatherSwitch name="weatherRace" value={weather.weatherRace} onChange={handleWeatherChange} />
                    </div>

                    {/* Grid de Inputs (2x2) - Visual de Telemetria */}
                    <div className="p-3 grid grid-cols-2 gap-2 flex-grow content-start">
                        {[1, 2, 3, 4].map(num => (
                            <div key={num} className="bg-black/40 rounded-lg p-2 border border-white/5 relative hover:border-indigo-500/20 transition-colors flex flex-col justify-between group/period">
                                
                                {/* Label do Período */}
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[8px] font-black text-slate-600 group-hover/period:text-indigo-400 transition-colors uppercase tracking-widest bg-white/5 px-1.5 rounded">P{num}</span>
                                </div>

                                {/* Linha de Inputs */}
                                <div className="flex items-end justify-between gap-2">
                                    
                                    {/* Input Minimo (Cyan) */}
                                    <div className="flex flex-col w-full">
                                        <span className="text-[6px] text-cyan-500/60 font-bold uppercase tracking-wider mb-0.5">Min</span>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                name={`r${num}_temp_min`} 
                                                value={(weather as any)[`r${num}_temp_min`] || ''} 
                                                onChange={handleWeatherChange} 
                                                className="w-full bg-transparent text-lg font-black text-cyan-500/90 outline-none p-0 leading-none placeholder-white/5 focus:text-cyan-400 transition-colors" 
                                                placeholder="-" 
                                            />
                                        </div>
                                    </div>

                                    {/* Divisor Vertical */}
                                    <div className="w-px h-5 bg-white/5 self-end mb-1"></div>

                                    {/* Input Máximo (Rose) */}
                                    <div className="flex flex-col w-full items-end">
                                        <span className="text-[6px] text-rose-500/60 font-bold uppercase tracking-wider mb-0.5">Max</span>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                name={`r${num}_temp_max`} 
                                                value={(weather as any)[`r${num}_temp_max`] || ''} 
                                                onChange={handleWeatherChange} 
                                                className="w-full bg-transparent text-right text-lg font-black text-rose-500/90 outline-none p-0 leading-none placeholder-white/5 focus:text-rose-400 transition-colors" 
                                                placeholder="-" 
                                            />
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                </div>
              </section>
            </div>

            {/* --- SEÇÃO DE SETUP IDEAL (COMPACTO) --- */}
            <div className="xl:col-span-5">
              <AnimatePresence mode='wait'>
                {resultado && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Setup Ideal</h2>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Calculado para {track}</p>
                                </div>
                            </div>
                            {loading && <Loader2 className="animate-spin text-white" size={14} />}
                        </div>
                        
                        {/* Grid de Cards Compactos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1 gap-2.5 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
                            {['asaDianteira', 'asaTraseira', 'motor', 'freios', 'cambio', 'suspensao'].map((partId) => (
                                <SetupCard key={partId} part={partId} data={resultado[partId]} />
                            ))}
                        </div>
                    </motion.div>
                )}
                {!resultado && (
                    <div className="h-full bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 text-slate-600 gap-4 border-dashed min-h-[400px]">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <Gauge size={32} className="opacity-40" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs uppercase font-black tracking-widest text-slate-500">Aguardando Dados</p>
                            <p className="text-[9px] text-slate-700 mt-1 max-w-[200px]">Preencha os dados de clima e driver para calcular o setup.</p>
                        </div>
                    </div>
                )}
              </AnimatePresence>
            </div>
        </div>

        {/* === LINHA INFERIOR: Tabelas de Desgaste (Lado a Lado no Desktop) === */}
        {resultado && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                
                {/* 1. DESGASTE ESTIMADO (ORIGINAL) */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm h-full">
                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><ShieldAlert size={14} className="text-rose-500" /> Desgaste Estimado</h2>
                        <div className="flex items-center gap-2">
                        <span className="text-[8px] text-slate-500 font-black whitespace-nowrap">Risco Pista</span>
                        <input type="number" value={desgasteModifier} onChange={(e) => updateDesgasteModifier(Number(e.target.value))} className="w-10 bg-black/40 border border-white/10 rounded text-white text-center text-xs font-black outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                        {COMPONENTS.map((part) => {
                        const d = resultado[part.id]?.wear;
                        if (!d) return null;
                        const startVal = safeNumber(d.start); const endVal = safeNumber(d.end); const isCritical = endVal > 85;
                        return (
                            <div key={part.id} className="space-y-1.5">
                            <div className="flex justify-between text-[9px] md:text-[8px] font-black uppercase tracking-tighter">
                                <span className="text-slate-500">{part.label}</span>
                                <span className="text-slate-300">{startVal}% → <span className={isCritical ? 'text-rose-500 font-black animate-pulse' : 'text-white'}>{endVal.toFixed(1)}%</span></span>
                            </div>
                            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden flex border border-white/5">
                                <div className="h-full bg-slate-600" style={{ width: `${Math.min(100, startVal)}%` }}></div>
                                <div className={`h-full ${isCritical ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, Math.max(0, endVal - startVal))}%` }}></div>
                            </div>
                            </div>
                        )
                        })}
                    </div>
                </section>

                {/* 2. DESGASTE ESTIMADO COM TESTES (OTIMIZADA) */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-0 overflow-hidden backdrop-blur-sm h-full flex flex-col">
                    {/* HEADER DA SEÇÃO */}
                    <div className="p-6 border-b border-white/5">
                        <div className="flex flex-col gap-4 mb-2">
                            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                <FlaskConical size={14} className="text-amber-500" /> Desgaste Estimado com Testes
                            </h2>
                            
                            {/* Controles: Pista e Voltas */}
                            <div className="flex flex-wrap items-center gap-3 w-full">
                                <div className="flex items-center gap-2">
                                     <TrackSelector 
                                        currentTrack={testTrack} 
                                        tracksList={tracks} 
                                        onSelect={setTestTrack} 
                                        placeholder="TESTAR NESTA PISTA"
                                     />

                                     {isTestActive && (
                                         <button 
                                            onClick={() => {
                                                setTestTrack("Selecionar Pista");
                                                setTestLaps(0);
                                                setTestResults(null);
                                            }}
                                            className="h-[34px] w-[34px] flex items-center justify-center bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-lg transition-all"
                                            title="Cancelar Teste"
                                         >
                                             <X size={16} />
                                         </button>
                                     )}
                                </div>

                                 {isTestActive && (
                                     <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                                         <Timer size={14} className="text-slate-500" />
                                         <div className="flex flex-col">
                                             <span className="text-[7px] font-black text-slate-500 uppercase leading-none">Voltas (Max 100)</span>
                                             <input 
                                                type="number" 
                                                value={testLaps}
                                                onChange={handleTestLapsChange}
                                                className="bg-transparent text-[10px] font-bold text-white outline-none w-16"
                                                placeholder="0"
                                                min="0"
                                                max="100"
                                             />
                                         </div>
                                         {(testLaps > 0 && testLaps < 5) && (
                                             <span className="text-[7px] text-rose-500 font-bold ml-1 animate-pulse">MIN 5!</span>
                                         )}
                                     </div>
                                 )}
                            </div>
                        </div>

                        {/* AVISO GLOBAL DE LIMITE 90% */}
                        <AnimatePresence>
                            {hasTestingLimitWarning && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 flex items-start gap-3"
                                >
                                    <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={14} />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-rose-400 uppercase">Atenção: Limite de Teste Excedido</span>
                                        <p className="text-[9px] text-rose-200/80 leading-tight">
                                            Uma ou mais peças ultrapassarão 90% de desgaste durante o teste. O GPRO impedirá a realização deste teste.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* TABELA OTIMIZADA */}
                    <div className="overflow-x-auto custom-scrollbar pb-2 px-2 flex-grow">
                        <table className="w-full text-xs border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="sticky left-0 bg-[#0F0F13] z-20 pl-3 pr-2 py-2 text-left border-b border-white/5 shadow-[2px_0_5px_rgba(0,0,0,0.3)] w-auto whitespace-nowrap">Peça</th>
                                    <th className="px-1 py-2 text-center border-b border-white/5 whitespace-nowrap w-min">Nvl</th>
                                    <th className="px-1 py-2 text-center border-b border-white/5 whitespace-nowrap">Início</th>
                                    {isTestActive && (
                                        <>
                                            <th className="px-1 py-2 text-center text-amber-500 border-b border-white/5 whitespace-nowrap">Teste</th>
                                            <th className="px-1 py-2 text-center text-indigo-400 border-b border-white/5 whitespace-nowrap">Pré-Cor</th>
                                        </>
                                    )}
                                    <th className="px-1 py-2 text-center text-rose-500 border-b border-white/5 whitespace-nowrap">Fim</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMPONENTS.map((part, index) => {
                                    const lvl = car[index]?.lvl || 1;
                                    const startWear = car[index]?.wear || 0;
                                    const testWearVal = testResults ? testResults[part.id]?.test_wear : 0;
                                    const preRaceVal = testResults ? testResults[part.id]?.pre_race : startWear; 

                                    // Checa se ESSE componente estourou o limite
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
                                        <tr key={part.id} className={`group transition-colors ${isLimitBroken ? 'bg-rose-500/5' : 'hover:bg-white/[0.02]'}`}>
                                            {/* Coluna Fixa */}
                                            <td className="sticky left-0 bg-[#13131A] z-10 pl-3 pr-2 py-2 border-r border-white/5 font-black text-[9px] text-slate-300 uppercase shadow-[2px_0_5px_rgba(0,0,0,0.3)] whitespace-nowrap">
                                                {part.label}
                                            </td>

                                            {/* Nível */}
                                            <td className="px-1 py-1 text-center bg-black/20 w-min">
                                                <div className="mx-auto w-6 bg-[#0F0F13] border border-white/5 rounded text-[9px] font-bold text-slate-400 py-1">
                                                    {lvl}
                                                </div>
                                            </td>

                                            {/* Início */}
                                            <td className="px-1 py-1 text-center bg-black/20">
                                                <div className={`mx-auto w-10 bg-[#0F0F13] border border-white/5 rounded text-[9px] font-bold py-1 ${getWearColor(startWear).split(' ')[0]}`}>
                                                    {startWear}%
                                                </div>
                                            </td>

                                            {/* Colunas Extras (Teste Ativo) */}
                                            {isTestActive && (
                                                <>
                                                    <td className="px-1 py-1 text-center bg-black/20 text-[10px] font-black text-amber-500 whitespace-nowrap">
                                                        +{typeof testWearVal === 'number' ? testWearVal.toFixed(1) : '0.0'}%
                                                    </td>
                                                    
                                                    {/* Célula PRÉ-COR com aviso condicional */}
                                                    <td className="px-1 py-1 text-center bg-black/20 whitespace-nowrap relative">
                                                        <div className={`text-[10px] font-black transition-all ${isLimitBroken ? 'text-rose-500 scale-110' : 'text-indigo-400'}`}>
                                                            {typeof preRaceVal === 'number' ? preRaceVal.toFixed(1) : '0.0'}%
                                                        </div>
                                                        {isLimitBroken && (
                                                            <div className="absolute top-0 right-0 -mr-1 -mt-1">
                                                                <span className="flex h-2 w-2 relative">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {/* Fim */}
                                            <td className="px-1 py-1 text-center bg-black/20">
                                                <div className={`mx-auto w-10 bg-[#0F0F13]/50 border border-white/5 rounded text-[9px] font-bold py-1 ${getWearColor(calculatedFinalWear)}`}>
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
      </main>
    </div>
  );
}