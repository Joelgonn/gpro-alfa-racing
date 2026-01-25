'use client';
import { useState, useEffect, FormEvent, ChangeEvent, useCallback } from 'react';
import { useGame } from '../../context/GameContext'; 
import { Loader2, RefreshCw, Zap, Gauge, Thermometer, Flag, AlertTriangle, CloudSun } from 'lucide-react';

const TRACK_FLAGS: { [key: string]: string } = {
  "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Anderstorp GP": "se",
  "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb",
  "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Fiorano": "it", "Estoril": "pt", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de",
  "Hungaroring": "hu", "Imola": "sm", "Indianapolis Oval": "us", "Indianapolis": "us",
  "Interlagos": "br", "Irungattukottai": "in", "Istanbul": "tr", "Jerez": "es",
  "Jyllands-Ringen": "dk", "Kaunas": "lt", "Kyalami": "za", "Laguna Seca": "us",
  "Magny Cours": "fr", "Magny-Cours": "fr", "Melbourne": "au", "Mexico City": "mx",
  "Monte Carlo": "mc", "Monaco": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it",
  "New Delhi": "in", "Nurburgring": "de", "Oesterreichring": "at", "Paul Ricard": "fr",
  "Portimao": "pt", "Poznan": "pl", "Rafaela Oval": "ar", "Sakhir": "bh", "Bahrain": "bh",
  "Sepang": "my", "Serres": "gr", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg",
  "Slovakiaring": "sk", "Sochi": "ru", "Spa": "be", "Spa Francorchamps": "be", "Suzuka": "jp",
  "Valencia": "es", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be",
  "Jeddah": "sa", "Miami": "us", "Losail": "qa", "Las Vegas": "us", "Donington Park": "gb",
};

export default function SetupPage() {
  const { 
    driver, car, track, updateTrack, updateDriver, updateCar,
    weather, updateWeather, 
    desgasteModifier, updateDesgasteModifier 
  } = useGame();
  
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isSavingWeather, setIsSavingWeather] = useState(false);

  // --- LÓGICA MANTIDA INTACTA ---
  const handleCalcular = useCallback(async (isAuto: boolean = false) => {
    if(!track || track === "Selecionar Pista") return;
    setLoading(true);

    const payload = {
        pista: track, ...driver, car, ...weather,
        avgTemp: calculateRaceAverage(), 
        desgasteModifier
    };

    try {
      const res = await fetch('/api/python/setup/calculate', { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (data.sucesso) setResultado(data.data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  }, [track, driver, car, weather, desgasteModifier]);

  useEffect(() => {
    async function hydrate() {
        try {
            const resTracks = await fetch('/api/python/tracks');
            const dTracks = await resTracks.json();
            if (dTracks.tracks) setTracks(dTracks.tracks);

            const resState = await fetch('/api/python/strategy/state');
            const json = await resState.json();
            
            if (json.sucesso && json.data) {
                const d = json.data;
                if (d.current_track) updateTrack(d.current_track);
                if (d.weather) updateWeather(d.weather);
                if (d.driver) {
                    Object.entries(d.driver).forEach(([k, v]) => updateDriver(k as any, Number(v)));
                }
                if (d.car) {
                    d.car.forEach((p: any, i: number) => {
                        updateCar(i, 'lvl', p.lvl);
                        updateCar(i, 'wear', p.wear);
                    });
                }
                setInitialLoaded(true);
            }
        } catch (e) { console.error(e); setInitialLoaded(true); }
    }
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateRaceAverage = () => {
      const sum = 
        Number(weather.r1_temp_min || 0) + Number(weather.r1_temp_max || 0) +
        Number(weather.r2_temp_min || 0) + Number(weather.r2_temp_max || 0) +
        Number(weather.r3_temp_min || 0) + Number(weather.r3_temp_max || 0) +
        Number(weather.r4_temp_min || 0) + Number(weather.r4_temp_max || 0);
      return sum / 8;
  };

  const persistWeatherToExcel = useCallback(async () => {
    if (!initialLoaded) return;
    setIsSavingWeather(true);
    try {
        await fetch('/api/python/update_setup_weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ...weather, 
                avgTemp: calculateRaceAverage(),
                pista: track 
            })
        });
    } catch (e) { console.error(e); }
    finally { setIsSavingWeather(false); }
  }, [weather, track, initialLoaded]);

  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => { 
        persistWeatherToExcel(); 
        handleCalcular(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [weather, track, driver, car, desgasteModifier, persistWeatherToExcel, handleCalcular, initialLoaded]);


  const handleWeatherChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string, value: string | number } }) => {
    const { name, value } = e.target;
    const isText = name.includes('weather'); 
    updateWeather({ [name]: isText ? value : Number(value) });
  };

  if (!initialLoaded) return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <span className="text-slate-400 font-medium text-sm tracking-wide uppercase">Iniciando Sistemas...</span>
        </div>
    </div>
  );

  return (
    // MUDANÇA: Fundo Slate-950 (Azul escuro acinzentado) ao invés de Preto
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20 selection:bg-indigo-500/30">
        
        {/* HEADER: Mais leve, usando Slate-900 e bordas visíveis */}
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 shadow-sm mb-8">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-6">
                
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                        {loading || isSavingWeather ? (
                            <RefreshCw className="text-white animate-spin" size={22} />
                        ) : (
                            <Zap className="text-white" size={22} />
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight uppercase">
                            Strategy <span className="text-indigo-400">Engine</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                                Temp. Média: <span className="text-slate-200 font-bold">{calculateRaceAverage().toFixed(2)}°C</span>
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* SELECTOR: Fundo mais claro e borda Slate-700 */}
                <div className="w-full md:w-80 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-1">
                        <Flag size={10} /> Circuito Ativo
                    </label>
                    <div className="relative flex items-center w-full bg-slate-900 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all shadow-sm">
                        <div className="absolute left-3 pointer-events-none z-10 flex items-center justify-center h-full">
                            {track && TRACK_FLAGS[track] ? (
                                <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-6 shadow-sm rounded-[2px]" />
                            ) : <span className="text-slate-600">🏁</span>}
                        </div>
                        <select 
                            value={track} 
                            onChange={(e) => updateTrack(e.target.value)} 
                            className="w-full h-11 pl-12 pr-10 bg-transparent text-slate-200 font-semibold text-sm outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 rounded-xl"
                        >
                            <option value="Selecionar Pista" className="bg-slate-900">-- Selecione --</option>
                            {tracks.map((t, i) => <option key={i} value={t} className="bg-slate-900">{t}</option>)}
                        </select>
                        <span className="absolute right-4 text-slate-500 pointer-events-none text-[10px]">▼</span>
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 grid grid-cols-1 xl:grid-cols-12 gap-8">
             
             {/* ESQUERDA: INPUTS */}
             <div className="xl:col-span-7 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* CARD PRINCIPAL: Slate-900 (não preto) com borda suave */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                     
                     <h2 className="font-bold text-sm text-slate-300 mb-6 flex items-center gap-2 uppercase tracking-wider pb-4 border-b border-slate-800/50">
                        <CloudSun size={18} className="text-indigo-400" />
                        Configuração Meteorológica
                     </h2>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <SessionCard title="Qualificação 1">
                                <WeatherToggle name="weatherQ1" value={weather.weatherQ1} onChange={handleWeatherChange} />
                                <PremiumInput value={weather.tempQ1} name="tempQ1" onChange={handleWeatherChange} label="Temp. Ambiente" />
                            </SessionCard>

                            <SessionCard title="Qualificação 2">
                                <WeatherToggle name="weatherQ2" value={weather.weatherQ2} onChange={handleWeatherChange} />
                                <PremiumInput value={weather.tempQ2} name="tempQ2" onChange={handleWeatherChange} label="Temp. Ambiente" />
                            </SessionCard>
                        </div>

                        {/* CARD PREVISÃO: Fundo levemente diferenciado */}
                        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 flex flex-col relative">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Corrida (Previsão)</span>
                            </div>
                            
                            <WeatherToggle name="weatherRace" value={weather.weatherRace} onChange={handleWeatherChange} />
                            
                            <div className="mt-5 space-y-2">
                                <div className="grid grid-cols-[1fr,1fr,1fr] px-2 text-[10px] font-bold text-slate-500 uppercase pb-1">
                                    <span>Stint</span>
                                    <span className="text-center">Min (°C)</span>
                                    <span className="text-center">Max (°C)</span>
                                </div>
                                {[1, 2, 3, 4].map(num => (
                                    <div key={num} className="grid grid-cols-[1fr,1fr,1fr] gap-3 items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-400 pl-2">Período {num}</span>
                                        <MinimalInput name={`r${num}_temp_min`} value={(weather as any)[`r${num}_temp_min`]} onChange={handleWeatherChange} />
                                        <MinimalInput name={`r${num}_temp_max`} value={(weather as any)[`r${num}_temp_max`]} onChange={handleWeatherChange} />
                                    </div>
                                ))}
                            </div>
                        </div>
                     </div>
                     
                     <button 
                        onClick={() => handleCalcular()} 
                        disabled={loading} 
                        className="w-full mt-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-wide"
                     >
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <><RefreshCw size={18} /> Atualizar Estratégia</>}
                    </button>
                </div>
             </div>

             {/* DIREITA: RESULTADOS */}
             <div className="xl:col-span-5 flex flex-col gap-6 sticky top-24 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
                {resultado ? (
                    <>
                        {/* CARD SETUP */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
                                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <Gauge size={16} className="text-emerald-400" /> Setup Ideal
                                </h2>
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">LIVE</span>
                            </div>
                            <div className="p-4 space-y-1">
                                <div className="grid grid-cols-4 px-3 py-2 text-[10px] uppercase font-bold text-slate-500 mb-1">
                                    <span>Peça</span>
                                    <span className="text-center">Q1</span>
                                    <span className="text-center">Q2</span>
                                    <span className="text-center text-slate-300">Race</span>
                                </div>
                                {['asaDianteira', 'asaTraseira', 'motor', 'freios', 'cambio', 'suspensao'].map(part => (
                                    <ResultRow 
                                        key={part} 
                                        label={part === 'asaDianteira' ? 'Asa Diant.' : part === 'asaTraseira' ? 'Asa Tras.' : part} 
                                        q1={resultado[part].q1} 
                                        q2={resultado[part].q2} 
                                        race={resultado[part].race} 
                                    />
                                ))}
                            </div>
                        </div>

                        {/* CARD DESGASTE */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-orange-400" />
                                    Desgaste
                                </h2>
                                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Risco:</span>
                                    <input 
                                        type="number" 
                                        value={desgasteModifier} 
                                        onChange={(e) => updateDesgasteModifier(Number(e.target.value))} 
                                        className="w-8 bg-transparent text-white text-center text-xs font-mono font-bold outline-none focus:text-indigo-400" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { key: 'chassi', label: 'Chassi' },
                                    { key: 'motor', label: 'Motor' },
                                    { key: 'asaDianteira', label: 'Asa Diant.' },
                                    { key: 'asaTraseira', label: 'Asa Tras.' },
                                    { key: 'assoalho', label: 'Assoalho' },
                                    { key: 'laterais', label: 'Laterais' },
                                    { key: 'radiador', label: 'Radiador' },
                                    { key: 'cambio', label: 'Câmbio' },
                                    { key: 'freios', label: 'Freios' },
                                    { key: 'suspensao', label: 'Suspensão' },
                                    { key: 'eletronicos', label: 'Eletrônicos' },
                                ].map((item) => {
                                    const partData = resultado[item.key];
                                    if (!partData || !partData.wear) return null;
                                    return <WearRow key={item.key} label={item.label} wearData={partData.wear} />;
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <EmptyState loading={loading} />
                )}
             </div>
        </main>
    </div>
  );
}

// --- SUBCOMPONENTES AJUSTADOS (CORES MAIS CLARAS) ---

function WeatherToggle({ name, value, onChange }: any) {
    const isDry = value === 'Dry';
    const toggle = (val: string) => onChange({ target: { name, value: val } });
    
    return (
        <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex w-full h-10 shadow-inner relative overflow-hidden">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-slate-800 rounded-md transition-all duration-300 ease-out shadow-sm ${isDry ? 'left-1' : 'left-[calc(50%+4px)]'}`}></div>
            
            <button type="button" onClick={() => toggle('Dry')} className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-colors ${isDry ? 'text-orange-400' : 'text-slate-500 hover:text-slate-400'}`}>
                <span>☀️ Seco</span>
            </button>
            <button type="button" onClick={() => toggle('Wet')} className={`relative z-10 flex-1 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-colors ${!isDry ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'}`}>
                <span>🌧️ Chuva</span>
            </button>
        </div>
    );
}

function SessionCard({ title, children }: any) {
    return (
        <div className="group">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-500 flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                {title}
            </h3>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}

function PremiumInput({ value, name, onChange, label }: any) {
    return (
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                <Thermometer size={14} />
            </div>
            {/* Input fundo Slate-950 (visível sobre o Slate-900) */}
            <input 
                type="number" 
                name={name} 
                value={value || ''} 
                onChange={onChange} 
                className="w-full bg-slate-950 border border-slate-700/50 rounded-lg py-2.5 pl-9 pr-8 text-white font-mono font-bold text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-slate-700"
                placeholder="00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">°C</span>
        </div>
    )
}

function MinimalInput({ name, value, onChange }: any) {
    return (
        <input 
            type="number" 
            name={name} 
            value={value || ''} 
            placeholder="-" 
            onChange={onChange} 
            className="w-full bg-slate-950 text-white text-center text-xs font-mono py-1.5 rounded border border-slate-700 focus:border-indigo-500 outline-none transition-colors placeholder-slate-700" 
        />
    )
}

function ResultRow({ label, q1, q2, race }: any) {
    return (
        <div className="grid grid-cols-4 items-center py-2 px-3 hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-700 group">
            <span className="text-slate-400 font-bold text-[10px] uppercase truncate group-hover:text-white transition-colors">{label}</span>
            <span className="text-center font-mono text-slate-400 text-sm font-medium tabular-nums">{q1}</span>
            <span className="text-center font-mono text-slate-400 text-sm font-medium tabular-nums">{q2}</span>
            <div className="flex justify-center">
                <span className="text-center font-mono font-bold text-emerald-400 text-xs bg-emerald-950/30 border border-emerald-500/20 px-2 rounded min-w-[30px] tabular-nums shadow-sm">{race}</span>
            </div>
        </div>
    )
}

function WearRow({ label, wearData }: any) {
    const { start, end } = wearData;
    const damage = Math.max(0, end - start);
    
    // Cores mais vivas para contraste com o fundo Slate
    const getGradient = (val: number) => {
        if(val > 85) return 'bg-rose-500';
        if(val > 55) return 'bg-amber-400';
        return 'bg-emerald-500';
    }

    const barColor = getGradient(end);
    
    return (
        <div className="space-y-1 group">
            <div className="flex justify-between items-end px-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold tracking-widest group-hover:text-slate-300 transition-colors">{label}</span>
                <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <span className="text-slate-500">{Number(start).toFixed()}%</span>
                    <span className="text-slate-600">→</span>
                    <span className={`font-bold ${end > 85 ? 'text-rose-400' : 'text-slate-200'}`}>{Number(end).toFixed(1)}%</span>
                </div>
            </div>
            
            <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden flex relative border border-slate-800">
                {/* Parte usada */}
                <div className="h-full bg-slate-700/50 border-r border-slate-900" style={{ width: `${start}%` }}></div>
                
                {/* Dano novo */}
                <div className={`h-full ${barColor} relative shadow-[0_0_8px_rgba(255,255,255,0.1)]`} style={{ width: `${damage}%` }}></div>
            </div>
        </div>
    );
}

function EmptyState({ loading }: { loading: boolean }) {
    return (
        <div className="h-full min-h-[400px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
            {/* Fundo de grade sutil */}
            <div className="absolute inset-0 opacity-[0.03]" 
                 style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
            </div>
            
            {loading ? (
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={40} />
                    <p className="font-bold text-slate-300 uppercase tracking-widest text-xs">Calculando...</p>
                </div>
            ) : (
                <div className="relative z-10 flex flex-col items-center opacity-60">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                        <Zap size={24} className="text-slate-400" />
                    </div>
                    <p className="font-bold text-slate-200 uppercase tracking-widest text-xs mb-2">Aguardando Dados</p>
                    <p className="text-[11px] max-w-[220px] leading-relaxed text-slate-500">
                        Configure a meteorologia ou selecione uma pista para ver a telemetria.
                    </p>
                </div>
            )}
        </div>
    )
}