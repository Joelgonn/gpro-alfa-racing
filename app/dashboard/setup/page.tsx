'use client';

import { useState, useEffect, ChangeEvent, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useGame } from '../../context/GameContext';

import {
  Loader2, Settings, ShieldAlert,
  MapPin, ChevronDown, Search, X, ShieldCheck, 
  CloudSun, Thermometer, Sun, CloudRain, Save, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- (MAPEAMENTOS MANTIDOS) ---
const TRACK_FLAGS: { [key: string]: string } = { "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be" };
const COMPONENTS = [ { id: 'chassi', label: 'Chassi' }, { id: 'motor', label: 'Motor' }, { id: 'asaDianteira', label: 'Asa Dianteira' }, { id: 'asaTraseira', label: 'Asa Traseira' }, { id: 'assoalho', label: 'Assoalho' }, { id: 'laterais', label: 'Laterais' }, { id: 'radiador', label: 'Radiador' }, { id: 'cambio', label: 'Câmbio' }, { id: 'freios', label: 'Freios' }, { id: 'suspensao', label: 'Suspensão' }, { id: 'eletronicos', label: 'Eletrônicos' } ];

// --- SELETOR DE PISTA (Mantido) ---
function TrackSelector({ currentTrack, tracksList, onSelect }: { currentTrack: string, tracksList: string[], onSelect: (t: string) => void }) {
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
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 text-2xl text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group">
                {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR PISTA"}
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-80 max-w-xs bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input autoFocus type="text" placeholder="Buscar pista..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 outline-none font-bold uppercase" />{search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}</div></div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">{filteredTracks.map(track => (<button key={track} onClick={() => { onSelect(track); setIsOpen(false); setSearch(""); }} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><div className="flex items-center gap-3">{TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-5 h-3 object-cover rounded-sm shadow-sm" /> : <div className="w-5 h-3 bg-white/10 rounded-sm"></div>}{track}</div>{currentTrack === track && <ShieldCheck size={12} />}</button>))}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function SetupPage() {
  const router = useRouter(); 
  const { track, updateTrack, driver, updateDriver, car, updateCar, weather, updateWeather, desgasteModifier, updateDesgasteModifier, raceAvgTemp } = useGame();
  
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // <<< NOVO: Estado de salvamento
  const [resultado, setResultado] = useState<any>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [initialHydrationDone, setInitialHydrationDone] = useState(false); 
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente'); 

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
          // Preenche o contexto com o que veio do banco
          if (d.current_track) updateTrack(d.current_track);
          if (d.weather) updateWeather(d.weather);
          if (d.driver) Object.entries(d.driver).forEach(([k, v]) => updateDriver(k as any, Number(v)));
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });
          if (d.desgasteModifier !== undefined) updateDesgasteModifier(Number(d.desgasteModifier));
        }
      } catch (e) { console.error("Hydrate error:", e); }
      finally { setInitialHydrationDone(true); } 
    }
    hydrate();
  }, [userId, isAuthLoading, updateTrack, updateWeather, updateDriver, updateCar, updateDesgasteModifier]); 

  // --- 3. AUTO-SAVE LOGIC (NOVO!) ---
  const persistChanges = useCallback(async () => {
      if (!initialHydrationDone || !userId) return;
      setIsSyncing(true);
      try {
          // Salva apenas o que é pertinente desta página (Track, Weather, Desgaste)
          // Mas como a API espera o objeto completo para garantir integridade, mandamos o que temos.
          // O backend faz o merge.
          await fetch('/api/python?action=update_state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'user-id': userId },
              body: JSON.stringify({ 
                  track, 
                  weather, 
                  desgasteModifier,
                  // Mandamos driver e car apenas para garantir que o backend não zere se for um replace completo,
                  // mas a lógica do backend deve tratar isso.
                  driver,
                  car
              })
          });
      } catch (e) {
          console.error("Erro ao salvar:", e);
      } finally {
          setIsSyncing(false);
      }
  }, [track, weather, desgasteModifier, driver, car, initialHydrationDone, userId]);

  // Gatilho do Auto-Save (Espera 2s após parar de digitar)
  useEffect(() => {
      if (!initialHydrationDone || !userId) return;
      const timer = setTimeout(() => { persistChanges(); }, 2000);
      return () => clearTimeout(timer);
  }, [track, weather, desgasteModifier, persistChanges, initialHydrationDone, userId]);

  // --- 4. CALCULATION LOGIC ---
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
  }, [userId, track, driver, car, weather, raceAvgTemp, desgasteModifier, initialHydrationDone]);

  // Gatilho do Cálculo (Espera 0.8s para calcular, é mais rápido que o save)
  useEffect(() => {
    if (initialHydrationDone && userId && track && track !== "Selecionar Pista") {
      const timer = setTimeout(() => { handleCalcular(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [weather, track, desgasteModifier, handleCalcular, initialHydrationDone, userId]);


  const handleWeatherChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isText = name.includes('weather');
    updateWeather({ [name]: isText ? value : Number(value) });
  };

  const safeRender = (val: any) => (val === null || val === undefined || typeof val === 'object') ? '-' : val;
  const safeNumber = (val: any) => (typeof val === 'number') ? val : (isNaN(parseFloat(val)) ? 0 : parseFloat(val));

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
            {/* STATUS DE SINCRONIZAÇÃO */}
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
        {/* INPUTS DE CLIMA */}
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

        {/* RESULTADOS */}
        <div className="xl:col-span-5 space-y-6">
          <AnimatePresence mode='wait'>
            {resultado && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
                                <div className="text-center bg-black/20 rounded p-2 md:bg-transparent md:p-0">
                                  <span className="text-[9px] font-bold text-slate-500 md:hidden">Q1</span>
                                  <p className="text-lg text-slate-400 font-mono md:text-sm">{safeRender(resultado[part]?.q1)}</p>
                                </div>
                                <div className="text-center bg-black/20 rounded p-2 md:bg-transparent md:p-0">
                                  <span className="text-[9px] font-bold text-slate-500 md:hidden">Q2</span>
                                  <p className="text-lg text-slate-400 font-mono md:text-sm">{safeRender(resultado[part]?.q2)}</p>
                                </div>
                                <div className="text-center bg-indigo-900/20 rounded p-2 md:bg-transparent md:p-0">
                                  <span className="text-[9px] font-bold text-indigo-400 md:hidden">Corrida</span>
                                  <p className="text-xl font-black text-indigo-400 md:text-lg">{safeRender(resultado[part]?.race)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                  </div>
                </section>

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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Componentes Auxiliares (Mantidos) ---
function SessionGroup({ title, children }: { title: string, children: React.ReactNode }) { return <div className="space-y-4"><h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500/30 pl-3">{title}</h3><div className="space-y-4">{children}</div></div> }
function HUDInput({ value, name, onChange, label }: any) { return <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-indigo-500/40 transition-all"><label className="block text-[8px] font-black text-slate-600 uppercase mb-2 tracking-widest">{label}</label><div className="flex items-center justify-between"><Thermometer size={16} className="text-indigo-400/50" /><input type="number" name={name} value={value || ''} onChange={onChange} className="bg-transparent text-right text-white font-black text-xl outline-none w-full" /><span className="text-sm text-slate-600 font-bold ml-2">°C</span></div></div> }
function WeatherSwitch({ name, value, onChange }: any) { const isDry = value === 'Dry'; return (<div className="flex bg-black p-1 rounded-lg border border-white/5"><button onClick={() => onChange({ target: { name, value: 'Dry' } })} className={`flex-1 py-2.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${isDry ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}><Sun size={14} /> Seco</button><button onClick={() => onChange({ target: { name, value: 'Wet' } })} className={`flex-1 py-2.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${!isDry ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}><CloudRain size={14} /> Chuva</button></div>) }