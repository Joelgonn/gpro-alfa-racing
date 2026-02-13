// --- START OF FILE app/setup/SetupPage.tsx ---
'use client';

import { useState, useEffect, ChangeEvent, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useGame } from '../../context/GameContext';

import {
  Loader2, Settings, ShieldAlert,
  MapPin, ChevronDown, Search, X, ShieldCheck, 
  CloudSun, Thermometer, Sun, CloudRain, FlaskConical, Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- (MAPEAMENTOS MANTIDOS) ---
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

// --- SELETOR DE PISTA (Mantido) ---
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

// --- COMPONENTES AUXILIARES (Definidos antes ou depois, mas precisam estar no arquivo) ---
function SessionGroup({ title, children }: { title: string, children: React.ReactNode }) { return <div className="space-y-4"><h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500/30 pl-3">{title}</h3><div className="space-y-4">{children}</div></div> }

function HUDInput({ value, name, onChange, label }: any) { return <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-indigo-500/40 transition-all"><label className="block text-[8px] font-black text-slate-600 uppercase mb-2 tracking-widest">{label}</label><div className="flex items-center justify-between"><Thermometer size={16} className="text-indigo-400/50" /><input type="number" name={name} value={value || ''} onChange={onChange} className="bg-transparent text-right text-white font-black text-xl outline-none w-full" /><span className="text-sm text-slate-600 font-bold ml-2">°C</span></div></div> }

function WeatherSwitch({ name, value, onChange }: any) { 
    const isDry = value === 'Dry'; 
    return (
        <div className="flex bg-black p-1 rounded-lg border border-white/5">
            <button 
                onClick={() => onChange({ target: { name, value: 'Dry' } })} 
                className={`flex-1 py-2.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                    isDry ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
            >
                <Sun size={14} /> Seco
            </button>

            <button 
                onClick={() => onChange({ target: { name, value: 'Wet' } })} 
                className={`flex-1 py-2.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                    !isDry ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'
                }`}
            >
                <CloudRain size={14} /> Chuva
            </button>
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

  // --- NOVO ESTADO: Pista de Teste e Voltas ---
  const [testTrack, setTestTrack] = useState<string>("Selecionar Pista");
  const [testLaps, setTestLaps] = useState<number>(0);
  const [testResults, setTestResults] = useState<any>(null); // Armazenará { testWear: [], preRaceWear: [] }

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
  
  // 2. Hydrate (Load from DB)
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

  // 4. CALCULATION LOGIC (Principal)
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
      if (data.sucesso) setResultado(data.data);
    } catch (error) { console.error("Calc error:", error); }
    finally { setLoading(false); }
  }, [userId, track, driver, car, techDirector, staffFacilities, weather, raceAvgTemp, desgasteModifier, initialHydrationDone]);

  useEffect(() => {
    if (initialHydrationDone && userId && track && track !== "Selecionar Pista") {
      const timer = setTimeout(() => { handleCalcular(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [weather, track, desgasteModifier, techDirector, staffFacilities, handleCalcular, initialHydrationDone, userId]);


  // --- 5. LOGICA DE TESTES (NOVA) ---
  const handleCalculateTest = useCallback(async () => {
    // Só calcula se tiver pista selecionada e usuario logado
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
                desgasteModifier // Importante passar o risco também
            })
        });
        
        const data = await res.json();
        
        if (data.sucesso) {
            setTestResults(data.data);
        } else {
            console.error("Erro no cálculo de testes:", data.error);
        }
        
    } catch (error) {
        console.error("Test Calc Error:", error);
    }
  }, [userId, testTrack, testLaps, driver, car, techDirector, staffFacilities, desgasteModifier, initialHydrationDone]);

  // Gatilho para calculo de testes (Reativo)
  useEffect(() => {
      if(testTrack !== "Selecionar Pista") {
          const timer = setTimeout(() => { handleCalculateTest(); }, 500); // Debounce de 500ms
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

  const safeRender = (val: any) => (val === null || val === undefined || typeof val === 'object') ? '-' : val;
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
      
      {/* HEADER (Mantido) */}
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

      <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
        
        {/* INPUTS DE CLIMA (Mantido) */}
        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3 border-b border-white/5 pb-4">
              <CloudSun className="text-indigo-400" size={16} /> Previsão Metereológica
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
              <div className="space-y-8">
                <SessionGroup title="Qualificação - 1"><WeatherSwitch name="weatherQ1" value={weather.weatherQ1} onChange={handleWeatherChange} /><HUDInput value={weather.tempQ1} name="tempQ1" onChange={handleWeatherChange} label="Temperatura (Q1)" /></SessionGroup>
                <SessionGroup title="Qualificação - 2"><WeatherSwitch name="weatherQ2" value={weather.weatherQ2} onChange={handleWeatherChange} /><HUDInput value={weather.tempQ2} name="tempQ2" onChange={handleWeatherChange} label="Temperatura (Q2)" /></SessionGroup>
              </div>
              <div className="bg-black/20 rounded-xl p-6 border border-white/5">
                <h3 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-6">Previsão para a Corrida</h3>
                <WeatherSwitch name="weatherRace" value={weather.weatherRace} onChange={handleWeatherChange} />
                <div className="mt-6 space-y-3">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} className="grid grid-cols-5 items-center bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="col-span-2 text-[9px] font-bold text-slate-500 uppercase pl-1">Quad: {num}</span>
                      <span className='text-slate-600 text-[10px] text-center'>MIN</span>
                      <input type="number" name={`r${num}_temp_min`} value={(weather as any)[`r${num}_temp_min`]} onChange={handleWeatherChange} className="bg-transparent text-center text-[11px] font-black text-indigo-300 outline-none w-full" />
                      <input type="number" name={`r${num}_temp_max`} value={(weather as any)[`r${num}_temp_max`]} onChange={handleWeatherChange} className="bg-transparent text-center text-[11px] font-black text-rose-300 outline-none w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DA DIREITA: RESULTADOS E DESGASTE */}
        <div className="xl:col-span-5 space-y-6">
          <AnimatePresence mode='wait'>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* 1. SETUP IDEAL */}
                {resultado && (
                    <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><Settings size={14} className="text-indigo-400" /> Setup Ideal</h2>
                            {loading && <Loader2 className="animate-spin text-white" size={14} />}
                        </div>
                        <div className='space-y-3'>
                            <div className="hidden md:grid grid-cols-4 px-4 py-1 text-[8px] font-black text-slate-500 uppercase">
                                <span>Componente</span><span className="text-center">Q1</span><span className="text-center">Q2</span><span className="text-center">Corrida</span>
                            </div>
                            {['asaDianteira', 'asaTraseira', 'motor', 'freios', 'cambio', 'suspensao'].map((part) => (
                                <div key={part} className="bg-black/20 hover:bg-white/5 transition-colors p-4 rounded-lg border border-white/5 md:grid md:grid-cols-4 md:items-center md:py-3">
                                    <span className="text-sm font-bold text-white uppercase tracking-wider md:text-[10px]">{part.replace('asa', 'Asa ')}</span>
                                    <div className="grid grid-cols-3 gap-2 mt-3 md:contents">
                                        <div className="text-center"><p className="text-lg text-slate-400 font-mono md:text-sm">{safeRender(resultado[part]?.q1)}</p></div>
                                        <div className="text-center"><p className="text-lg text-slate-400 font-mono md:text-sm">{safeRender(resultado[part]?.q2)}</p></div>
                                        <div className="text-center"><p className="text-xl font-black text-indigo-400 md:text-lg">{safeRender(resultado[part]?.race)}</p></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. DESGASTE ESTIMADO (Original - Mantido) */}
                {resultado && (
                    <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><ShieldAlert size={14} className="text-rose-500" /> Desgaste Estimado</h2>
                        <div className="flex items-center gap-2">
                        <span className="text-[8px] text-slate-500 font-black whitespace-nowrap">Risco Pista</span>
                        <input type="number" value={desgasteModifier} onChange={(e) => updateDesgasteModifier(Number(e.target.value))} className="w-10 bg-black/40 border border-white/10 rounded text-white text-center text-xs font-black outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
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
                )}

                {/* 3. NOVA SEÇÃO: DESGASTE ESTIMADO COM TESTES */}
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex flex-col gap-4 mb-6 border-b border-white/5 pb-4">
                        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <FlaskConical size={14} className="text-amber-500" /> Desgaste Estimado com Testes
                        </h2>
                        
                        {/* Controles: Pista e Voltas */}
                        <div className="flex flex-wrap items-center gap-3 w-full">
                             <TrackSelector 
                                currentTrack={testTrack} 
                                tracksList={tracks} 
                                onSelect={setTestTrack} 
                                placeholder="TESTAR NESTA PISTA"
                             />

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

                    {/* Cabeçalho da Tabela */}
                    <div className={`grid ${isTestActive ? 'grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr]' : 'grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]'} items-center px-2 mb-3 gap-1`}>
                         <div className="text-[8px] font-black text-slate-500 uppercase">Peça</div>
                         <div className="text-[8px] font-black text-slate-500 uppercase text-center">Nvl</div>
                         <div className="text-[8px] font-black text-slate-500 uppercase text-center">Início</div>
                         
                         {isTestActive && (
                             <>
                                <div className="text-[8px] font-black text-amber-500 uppercase text-center">Teste</div>
                                <div className="text-[8px] font-black text-indigo-400 uppercase text-center">Pré-Cor</div>
                             </>
                         )}
                         
                         <div className="text-[8px] font-black text-rose-500 uppercase text-center">Fim</div>
                    </div>

                    {/* Lista de Componentes */}
                    <div className="space-y-2">
                        {COMPONENTS.map((part, index) => {
                             // Valores do Contexto (Origem Verdadeira)
                             const lvl = car[index]?.lvl || 1;
                             const startWear = car[index]?.wear || 0;
                             
                             // Valores vindos da API de Teste
                             const testWearVal = testResults ? testResults[part.id]?.test_wear : 0;
                             const preRaceVal = testResults ? testResults[part.id]?.pre_race : startWear; 

                             // Lógica para o Desgaste Final
                             let calculatedFinalWear = 0;

                             if (resultado && resultado[part.id]?.wear) {
                                 // 1. Descobrimos quanto a peça gasta SÓ na corrida (Final Original - Inicio Original)
                                 const originalStart = safeNumber(resultado[part.id].wear.start);
                                 const originalEnd = safeNumber(resultado[part.id].wear.end);
                                 const raceDegradation = Math.max(0, originalEnd - originalStart);

                                 // 2. Somamos esse desgaste ao novo ponto de partida (Pré-Corrida)
                                 // Se tiver teste, usa o preRaceVal, se não, usa o startWear normal
                                 const baseForRace = (isTestActive && typeof preRaceVal === 'number') ? preRaceVal : startWear;
                                 
                                 calculatedFinalWear = baseForRace + raceDegradation;
                             }

                             return (
                                <div key={part.id} className={`grid ${isTestActive ? 'grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr]' : 'grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr]'} items-center bg-black/20 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors gap-1`}>
                                    
                                    {/* Nome */}
                                    <div className="text-[9px] font-black uppercase text-slate-300 truncate pr-1">
                                        {part.label}
                                    </div>

                                    {/* CAIXA SOMENTE LEITURA: Nível */}
                                    <div className="flex justify-center">
                                        <div className="w-10 bg-[#0F0F13] border border-white/5 rounded text-center text-[10px] font-bold text-slate-400 py-1 select-none">
                                            {lvl}
                                        </div>
                                    </div>

                                    {/* CAIXA SOMENTE LEITURA: Desgaste Inicial */}
                                    <div className="flex justify-center">
                                         <div className={`w-10 bg-[#0F0F13] border border-white/5 rounded text-center text-[10px] font-bold py-1 select-none ${getWearColor(startWear).split(' ')[0]}`}>
                                            {startWear}%
                                        </div>
                                    </div>

                                    {/* Colunas Extras (Teste Ativo) */}
                                    {isTestActive && (
                                        <>
                                            <div className="text-center text-[10px] font-black text-amber-500">
                                                +{typeof testWearVal === 'number' ? testWearVal.toFixed(1) : '0.0'}%
                                            </div>
                                            <div className="text-center text-[10px] font-black text-indigo-400">
                                                {typeof preRaceVal === 'number' ? preRaceVal.toFixed(1) : '0.0'}%
                                            </div>
                                        </>
                                    )}

                                    {/* Desgaste Final (Agora calculado com base no teste) */}
                                    <div className="flex justify-center">
                                        <div className={`w-10 bg-[#0F0F13]/50 border border-white/5 rounded text-center text-[10px] font-bold py-1 ${getWearColor(calculatedFinalWear)}`}>
                                            {calculatedFinalWear > 0 ? calculatedFinalWear.toFixed(1) + '%' : '-'}
                                        </div>
                                    </div>

                                </div>
                             )
                        })}
                    </div>
                </section>

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}