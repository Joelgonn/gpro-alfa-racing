'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { useGame } from '../../context/GameContext'; 
import { 
  Loader2, Activity, Flag, Thermometer, CloudSun, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function SetupPage() {
  const { 
    driver, car, track, updateTrack, updateDriver, updateCar,
    weather, updateWeather, desgasteModifier, updateDesgasteModifier, raceAvgTemp 
  } = useGame();
  
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const handleCalcular = useCallback(async () => {
    if(!track || track === "Selecionar Pista") return;
    setLoading(true);
    try {
      const res = await fetch('/api/python?endpoint=setup/calculate', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ pista: track, ...driver, car, ...weather, avgTemp: raceAvgTemp, desgasteModifier }) 
      });
      const data = await res.json();
      if (data.sucesso) setResultado(data.data);
    } catch (error) { 
        console.error(error); 
    } finally { 
        setLoading(false); 
    }
  }, [track, driver, car, weather, desgasteModifier, raceAvgTemp]);

  useEffect(() => {
    async function hydrate() {
        try {
            const [resT, resS] = await Promise.all([
                fetch('/api/python?action=tracks'),
                fetch('/api/python?action=state')
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
                setInitialLoaded(true);
            }
        } catch (e) { 
            console.error(e); 
            setInitialLoaded(true); 
        }
    }
    hydrate();
  }, []);

  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => { handleCalcular(); }, 1000);
    return () => clearTimeout(timer);
  }, [weather, track, initialLoaded, handleCalcular]);

  const handleWeatherChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isText = name.includes('weather'); 
    updateWeather({ [name]: isText ? value : Number(value) });
  };

  // --- Função Auxiliar para evitar crash de Objetos/Erros ---
  const safeRender = (val: any) => {
    if (val === null || val === undefined) return '---';
    // Se for um objeto (erro do Excel), retorna 'Err' em vez de quebrar
    if (typeof val === 'object') return 'Err';
    return val;
  };

  // --- Função Auxiliar para garantir números nas barras de progresso ---
  const safeNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
          const n = parseFloat(val);
          return isNaN(n) ? 0 : n;
      }
      return 0; // Se for objeto ou null, retorna 0
  };

  if (!initialLoaded) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#050507]">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-slate-300 font-mono pb-20">
        <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 py-4">
            <div className="max-w-[1600px] mx-auto flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded flex items-center justify-center shadow-lg">
                        <Activity className="text-white" size={20} />
                    </div>
                    <h1 className="text-sm font-black text-white uppercase tracking-widest">Setup Optimizer - Calculadora</h1>
                </div>
                <div className="flex items-center gap-4 bg-black/40 p-1 rounded-lg border border-white/5">
                    <div className="px-4 py-1.5 border-r border-white/5 text-center">
                        <p className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Temp. Corrida</p>
                        <p className="text-xs font-black text-indigo-400">{raceAvgTemp.toFixed(1)}°C</p>
                    </div>
                    <div className="relative min-w-[250px]">
                        <select 
                            value={track} 
                            onChange={(e) => updateTrack(e.target.value)} 
                            className="w-full h-9 bg-transparent text-white font-bold text-[10px] outline-none appearance-none px-4"
                        >
                            {tracks.map((t, i) => (
                                <option key={i} value={t} className="bg-slate-900">{t.toUpperCase()}</option>
                            ))}
                        </select>
                        <Flag className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500" size={14} />
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
             {/* Left Column: Weather Inputs */}
             <div className="xl:col-span-7 space-y-6">
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 backdrop-blur-sm">
                    <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                        <CloudSun className="text-indigo-400" size={16} /> Previsão Metereológica
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                            <SessionGroup title="Qualificação - 1">
                                <WeatherSwitch name="weatherQ1" value={weather.weatherQ1} onChange={handleWeatherChange} />
                                <HUDInput value={weather.tempQ1} name="tempQ1" onChange={handleWeatherChange} label="Temperatura (Q1)" />
                            </SessionGroup>
                            <SessionGroup title="Qualificação - 2">
                                <WeatherSwitch name="weatherQ2" value={weather.weatherQ2} onChange={handleWeatherChange} />
                                <HUDInput value={weather.tempQ2} name="tempQ2" onChange={handleWeatherChange} label="Temperatura (Q2)" />
                            </SessionGroup>
                        </div>
                        <div className="bg-black/20 rounded-xl p-6 border border-white/5">
                            <h3 className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-6">Previsão para a Corrida</h3>
                            <WeatherSwitch name="weatherRace" value={weather.weatherRace} onChange={handleWeatherChange} />
                            <div className="mt-8 space-y-4">
                                {[1, 2, 3, 4].map(num => (
                                    <div key={num} className="grid grid-cols-3 items-center bg-black/40 p-2 rounded-lg border border-white/5">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase pl-1">Quadrante:{num}</span>
                                        <input 
                                            name={`r${num}_temp_min`} 
                                            value={(weather as any)[`r${num}_temp_min`]} 
                                            onChange={handleWeatherChange} 
                                            className="bg-transparent text-center text-[11px] font-black text-indigo-300 outline-none" 
                                        />
                                        <input 
                                            name={`r${num}_temp_max`} 
                                            value={(weather as any)[`r${num}_temp_max`]} 
                                            onChange={handleWeatherChange} 
                                            className="bg-transparent text-center text-[11px] font-black text-rose-300 outline-none" 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
             </div>

             {/* Right Column: Results */}
             <div className="xl:col-span-5 space-y-6">
                <AnimatePresence mode='wait'>
                    {resultado && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            
                            {/* Setup Values Table */}
                            <div className="bg-indigo-600 rounded-2xl overflow-hidden shadow-2xl border border-indigo-400/20">
                                <div className="bg-black/20 p-4 border-b border-white/10 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Setup Ideal Calculadora</span>
                                    {loading && <Loader2 className="animate-spin text-white" size={14} />}
                                </div>
                                <div className="p-4 space-y-1">
                                    <div className="grid grid-cols-4 px-4 py-1 text-[7px] font-black text-indigo-200 uppercase">
                                        <span>Peça</span><span className="text-center">Q1</span><span className="text-center">Q2</span><span className="text-center">Race</span>
                                    </div>
                                    {['asaDianteira', 'asaTraseira', 'motor', 'freios', 'cambio', 'suspensao'].map((part) => (
                                        <div key={part} className="grid grid-cols-4 items-center bg-black/20 py-2.5 px-4 rounded border border-white/5">
                                            <span className="text-[9px] font-bold text-white uppercase">{part.replace('asa', 'Asa_')}</span>
                                            {/* Uso do safeRender aqui para evitar crash */}
                                            <span className="text-center text-[11px] text-white/50">{safeRender(resultado[part]?.q1)}</span>
                                            <span className="text-center text-[11px] text-white/50">{safeRender(resultado[part]?.q2)}</span>
                                            <span className="text-center text-sm font-black text-white">{safeRender(resultado[part]?.race)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Wear Bars */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                                    <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                        <ShieldAlert size={14} className="text-rose-500" /> Desgaste Final Estimado
                                    </h2>
                                    <div className="bg-black/50 px-3 py-1 rounded border border-white/10 flex items-center gap-3">
                                        <span className="text-[8px] text-slate-500 font-black">Risco Pista Livre</span>
                                        <input 
                                            type="number" 
                                            value={desgasteModifier} 
                                            onChange={(e) => updateDesgasteModifier(Number(e.target.value))} 
                                            className="w-8 bg-transparent text-white text-center text-xs font-black outline-none" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                                    {COMPONENTS.map((part) => {
                                        const d = resultado[part.id]?.wear;
                                        if (!d) return null;
                                        
                                        // Uso do safeNumber para garantir que não passamos objeto para matemática
                                        const startVal = safeNumber(d.start);
                                        const endVal = safeNumber(d.end);
                                        const isCritical = endVal > 85;

                                        return (
                                            <div key={part.id} className="space-y-1.5">
                                                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter">
                                                    <span className="text-slate-500">{part.label}</span>
                                                    <span className="text-slate-300">
                                                        {startVal}% → <span className={isCritical ? 'text-rose-500 font-black animate-pulse' : 'text-white'}>{endVal.toFixed(1)}%</span>
                                                    </span>
                                                </div>
                                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                                                    <div className="h-full bg-slate-700" style={{ width: `${Math.min(100, startVal)}%` }}></div>
                                                    <div 
                                                        className={`h-full ${isCritical ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-indigo-500'}`} 
                                                        style={{ width: `${Math.min(100, Math.max(0, endVal - startVal))}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
             </div>
        </main>
    </div>
  );
}

// --- Componentes Auxiliares ---

function SessionGroup({ title, children }: any) {
    return (
        <div className="space-y-4">
            <h3 className="text-[8px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-indigo-500/30 pl-3">
                {title}
            </h3>
            <div className="space-y-4">{children}</div>
        </div>
    )
}

function HUDInput({ value, name, onChange, label }: any) {
    return (
        <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-indigo-500/40 transition-all">
            <label className="block text-[7px] font-black text-slate-600 uppercase mb-1 tracking-widest">
                {label}
            </label>
            <div className="flex items-center justify-between">
                <Thermometer size={14} className="text-indigo-400/50" />
                <input 
                    type="number" 
                    name={name} 
                    value={value || ''} 
                    onChange={onChange} 
                    className="bg-transparent text-right text-white font-black text-sm outline-none w-full" 
                />
                <span className="text-[9px] text-slate-600 font-bold ml-2">°C</span>
            </div>
        </div>
    )
}

function WeatherSwitch({ name, value, onChange }: any) {
    const isDry = value === 'Dry';
    return (
        <div className="flex bg-black p-1 rounded-lg border border-white/5">
            <button 
                onClick={() => onChange({ target: { name, value: 'Dry' } } as any)} 
                className={`flex-1 py-2 rounded text-[8px] font-black uppercase transition-all ${isDry ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-500'}`}
            >
                ☀️ Seco
            </button>
            <button 
                onClick={() => onChange({ target: { name, value: 'Wet' } } as any)} 
                className={`flex-1 py-2 rounded text-[8px] font-black uppercase transition-all ${!isDry ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-500'}`}
            >
                🌧️ Chuva
            </button>
        </div>
    )
}