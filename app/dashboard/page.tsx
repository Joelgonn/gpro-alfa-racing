'use client';
import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext'; 
import { Settings, User, Car, Zap, Activity, Trophy, MapPin, RefreshCw, Loader2, ChevronDown } from 'lucide-react';

// --- TIPAGEM ---
type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type DriverKeys = 'concentracao' | 'talento' | 'agressividade' | 'experiencia' | 'tecnica' | 'resistencia' | 'carisma' | 'motivacao' | 'reputacao' | 'peso' | 'idade' | 'energia' | 'total';

// (MANTIVE O OBJETO TRACK_FLAGS E MOCK_PERFORMANCE_DATA EXATAMENTE IGUAL)
const TRACK_FLAGS: { [key: string]: string } = {
  "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz",
  "Bucharest Ring": "ro", "Buenos Aires": "ar", "Fiorano": "it", "Estoril": "pt", "Fuji": "jp", "Grobnik": "hr",
  "Hockenheim": "de", "Hungaroring": "hu", "Imola": "it", "Indianapolis Oval": "us", "Indianapolis": "us",
  "Interlagos": "br", "Irungattukottai": "in", "Istanbul": "tr", "Jerez": "es", "Jyllands-Ringen": "dk",
  "Kaunas": "lt", "Kyalami": "za", "Laguna Seca": "us", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx",
  "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "New Delhi": "in", "Nurburgring": "de",
  "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Rafaela Oval": "ar",
  "Sakhir": "bh", "Sepang": "my", "Serres": "gr", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg",
  "Slovakiaring": "sk", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Valencia": "es", "Yas Marina": "ae",
  "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be", "Jeddah": "sa", "Miami": "us", "Losail": "qa", "Las Vegas": "us",
};

const MOCK_PERFORMANCE_DATA = {
    power: { part: 0, test: 0, carro: 0, pista: 0 },
    handling: { part: 0, test: 0, carro: 0, pista: 0 },
    accel: { part: 0, test: 0, carro: 0, pista: 0 },
    zs: { wings: 0, motor: 0, brakes: 0, gear: 0, susp: 0 }
};

export default function DashboardHome() {
  const { driver, car, track, updateDriver, updateCar, updateTrack } = useGame();
  
  const [tracksList, setTracksList] = useState<string[]>([]);
  const [testPoints, setTestPoints] = useState({ power: 0, handling: 0, accel: 0 });
  const [performanceData, setPerformanceData] = useState(MOCK_PERFORMANCE_DATA);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // 1. CARREGAMENTO INICIAL (Restaurar do Excel)
  useEffect(() => {
    async function hydrate() {
        try {
            const resTracks = await fetch('/api/python/tracks');
            const dataTracks = await resTracks.json();
            if (dataTracks.tracks) setTracksList(dataTracks.tracks);

            const resState = await fetch('/api/python/strategy/state');
            const json = await resState.json();
            
            if (json.sucesso && json.data) {
                const d = json.data;
                if (d.current_track) updateTrack(d.current_track);
                
                if (d.driver) {
                    Object.entries(d.driver).forEach(([key, val]) => {
                        updateDriver(key as any, Number(val));
                    });
                }
                
                if (d.car) {
                    d.car.forEach((part: any, idx: number) => {
                        updateCar(idx, 'lvl', part.lvl);
                        updateCar(idx, 'wear', part.wear);
                    });
                }
                
                if (d.test_points) setTestPoints(d.test_points);
            }
        } catch (e) { console.error("Erro na hidratação:", e); }
        finally { setInitialLoaded(true); }
    }
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. FUNÇÃO DE SALVAMENTO
  const persistToExcel = useCallback(async () => {
    if (!initialLoaded) return;
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python/update_driver_car', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driver, car, test_points: testPoints })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) {
            updateDriver('total', Number(data.oa));
        }
    } catch (e) { console.error("Erro ao persistir:", e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, initialLoaded, updateDriver]);

  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => { persistToExcel(); }, 1500);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, persistToExcel, initialLoaded]);


  // 3. PERFORMANCE
  const fetchPerformance = useCallback(async () => {
    if (!track || track === "Selecionar Pista") return;
    setIsPerformanceLoading(true);

    const payload = {
        pista: track, ...driver, 
        chassi_lvl: car[0].lvl, chassi_wear: car[0].wear,
        motor_lvl: car[1].lvl, motor_wear: car[1].wear,
        asaDianteira_lvl: car[2].lvl, asaDianteira_wear: car[2].wear,
        asaTraseira_lvl: car[3].lvl, asaTraseira_wear: car[3].wear,
        assoalho_lvl: car[4].lvl, assoalho_wear: car[4].wear,
        laterais_lvl: car[5].lvl, laterais_wear: car[5].wear,
        radiador_lvl: car[6].lvl, radiador_wear: car[6].wear,
        cambio_lvl: car[7].lvl, cambio_wear: car[7].wear,
        freios_lvl: car[8].lvl, freios_wear: car[8].wear,
        suspensao_lvl: car[9].lvl, suspensao_wear: car[9].wear,
        eletronicos_lvl: car[10].lvl, eletronicos_wear: car[10].wear,
        test_power: testPoints.power, test_handling: testPoints.handling, test_accel: testPoints.accel
    };
    
    try {
        const res = await fetch('/api/performance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.sucesso) setPerformanceData(data.data);
    } catch (e) { console.error(e); } 
    finally { setIsPerformanceLoading(false); }
  }, [track, driver, car, testPoints]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && initialLoaded) {
        const timer = setTimeout(() => { fetchPerformance(); }, 500); 
        return () => clearTimeout(timer);
    }
  }, [track, driver, car, testPoints, fetchPerformance, initialLoaded]);

  if (!initialLoaded) {
      return (
          <div className="flex h-screen items-center justify-center bg-black text-white">
              <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                      <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse"></div>
                      <Loader2 className="animate-spin text-purple-500 relative z-10" size={64} />
                  </div>
                  <p className="font-mono text-xs text-zinc-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando Telemetria...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fadeIn text-zinc-200 pb-24 font-sans max-w-[1600px] mx-auto">
      
      {/* 1. BARRA DE PRÓXIMA CORRIDA */}
      <div className="glass-panel p-1 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="bg-zinc-950/40 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
            <div className="flex items-center gap-6 w-full md:w-auto">
                <div className="relative shrink-0">
                    <span className="text-4xl shadow-2xl rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-900 flex items-center justify-center w-20 h-14 relative z-10">
                        {track && TRACK_FLAGS[track] ? (
                            <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                        ) : '🏁'}
                    </span>
                    {/* Glow effect atrás da bandeira */}
                    <div className="absolute -inset-2 bg-purple-500/20 blur-xl rounded-full z-0"></div>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <MapPin size={12} className="text-purple-400"/> Próxima Corrida
                    </h2>
                    <div className="relative group w-full">
                        <select 
                            value={track} 
                            onChange={(e) => { updateTrack(e.target.value); }}
                            className="appearance-none bg-transparent text-3xl text-white font-black tracking-tight outline-none cursor-pointer hover:text-purple-400 transition-colors w-full pr-8 z-10 relative"
                        >
                            <option value="Selecionar Pista" className="text-zinc-900 bg-zinc-200">Selecionar Pista</option>
                            {tracksList.map((t, i) => (
                                <option key={i} value={t} className="text-zinc-900 bg-zinc-200 font-sans text-sm">{t}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-purple-500 transition-colors pointer-events-none" size={20} />
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                 <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isSyncing ? 'border-purple-500/50 text-purple-300 bg-purple-500/10' : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'}`}>
                    {isSyncing ? 'SYNCING...' : 'ONLINE'}
                 </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA 1: GERENTE (3 colunas na grid de 12) */}
        <div className="xl:col-span-3 glass-panel flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <User size={16} className="text-purple-400"/>
                <h3 className="label-header text-zinc-300">Perfil Gerente</h3>
            </div>
            <div className="p-6 flex flex-col gap-8 flex-1">
                <div className="flex justify-center gap-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent blur-2xl rounded-full transform translate-y-4"></div>
                    <div className="w-20 h-20 bg-zinc-800 rounded-2xl border border-white/10 flex items-center justify-center text-3xl shadow-lg relative z-10 rotate-3 hover:rotate-0 transition-transform duration-300">👨‍💼</div>
                    <div className="w-20 h-20 bg-zinc-800 rounded-2xl border border-white/10 flex items-center justify-center text-3xl shadow-lg relative z-10 -rotate-3 hover:rotate-0 transition-transform duration-300">🏎️</div>
                </div>
                <div className="space-y-4">
                    <StatRow label="Grupo" value="Amateur - 22" valueColor="text-blue-400 font-bold" icon={<Trophy size={14}/>} />
                    <StatRow label="Posição" value="#16" icon={<Activity size={14}/>} />
                    <StatRow label="Saldo" value="$ 87.7M" valueColor="text-emerald-400 font-mono font-bold text-base" />
                </div>
                <div className="mt-auto pt-6">
                    <button onClick={persistToExcel} className="w-full group bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-4 rounded-xl border border-zinc-700/50 hover:border-purple-500/50 transition-all flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest shadow-lg">
                        <RefreshCw size={14} className={`text-purple-500 group-hover:text-purple-400 transition-colors ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Salvando Dados..." : "Sincronizar"}
                    </button>
                </div>
            </div>
        </div>

        {/* COLUNA 2: PILOTO (5 colunas na grid de 12) */}
        <div className="xl:col-span-5 glass-panel p-6 h-full flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                         <User size={16} className="text-purple-400"/>
                    </div>
                    <h3 className="label-header text-zinc-200">Telemetria Piloto</h3>
                </div>
                <span className="text-[9px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-full font-bold shadow-lg shadow-purple-900/20">Lobo Alfa</span>
            </div>
            
            {/* Energia Bar Premium */}
            <div className="mb-8 px-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    <span className="flex items-center gap-1"><Zap size={10} className="text-yellow-500"/> Energia</span>
                    <span className="text-white">{driver.energia}%</span>
                </div>
                <div className="h-3 bg-zinc-950 rounded-full border border-white/5 relative overflow-hidden group shadow-inner">
                    <input type="number" value={driver.energia} onChange={(e) => updateDriver('energia', Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-col-resize" />
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-500" style={{ width: `${driver.energia}%` }}></div>
                </div>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <SkillInput 
                    label="Overall (OA)" 
                    value={Number(driver.total).toFixed(1)} 
                    max={250} 
                    readonly 
                    color="bg-indigo-500" 
                    glow="shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                    />
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>
                {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                    <SkillInput 
                        key={skill}
                        label={skill} 
                        value={(driver as any)[skill]} 
                        max={skill === 'experiencia' ? 300 : 250}
                        onChange={(e: any) => updateDriver(skill as any, Number(e.target.value))} 
                    />
                ))}
                
                <div className="mt-8 bg-black/20 p-4 rounded-xl border border-white/5">
                    <h4 className="label-header text-center mb-4 opacity-70">Satisfação Calculada</h4>
                    <div className="grid grid-cols-5 gap-2">
                        <ZSBox label="Asas" value={performanceData.zs?.wings || 0} />
                        <ZSBox label="Motor" value={performanceData.zs?.motor || 0} />
                        <ZSBox label="Freios" value={performanceData.zs?.brakes || 0} />
                        <ZSBox label="Câmbio" value={performanceData.zs?.gear || 0} />
                        <ZSBox label="Susp." value={performanceData.zs?.susp || 0} />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <SkillInput label="Peso" value={driver.peso} max={250} onChange={(e: any) => updateDriver('peso', Number(e.target.value))} color="bg-emerald-500" />
                    <SkillInput label="Idade" value={driver.idade} max={99} onChange={(e: any) => updateDriver('idade', Number(e.target.value))} color="bg-emerald-500" />
                </div>
            </div>
        </div>

        {/* COLUNA 3: CARRO & PERFORMANCE (4 colunas na grid de 12) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* CARRO */}
            <div className="glass-panel overflow-hidden flex flex-col max-h-[450px]">
                <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
                    <h3 className="label-header flex items-center gap-2 text-zinc-200"><Car size={14} className="text-purple-400"/> Status do Carro</h3>
                    <span className="text-[9px] font-bold text-zinc-500 bg-black/30 px-2 py-1 rounded border border-white/5">Lvl & Wear</span>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1 p-2"> 
                    <table className="w-full text-left border-collapse">
                        <thead className="text-zinc-500 uppercase font-bold tracking-wider text-[9px] sticky top-0 bg-zinc-900/95 z-10 backdrop-blur">
                            <tr>
                                <th className="px-3 py-3 pl-4">Componente</th>
                                <th className="px-1 py-3 text-center">Nível</th>
                                <th className="px-1 py-3 text-center">Desgaste</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {car.map((part, index) => (
                                <CarPartInput 
                                    key={index} name={part.name} level={part.lvl} wear={part.wear}
                                    onLevelChange={(e: any) => updateCar(index, 'lvl', Number(e.target.value))}
                                    onWearChange={(e: any) => updateCar(index, 'wear', Number(e.target.value))}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PERFORMANCE */}
            <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-white/[0.02] pointer-events-none rotate-12 z-0">
                    <Settings size={150} />
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6 relative z-10">
                    <h3 className="label-header flex items-center gap-2 text-zinc-200">
                        <Activity size={14} className="text-purple-400"/> Setup Performance
                    </h3>
                </div>
                <div className="space-y-8 relative z-10">
                    <PerformanceRow label="Power" part={performanceData.power.part} test={testPoints.power} onTestChange={(v: number) => setTestPoints(p => ({ ...p, power: v }))} carro={performanceData.power.carro} pista={performanceData.power.pista} />
                    <PerformanceRow label="Handling" part={performanceData.handling.part} test={testPoints.handling} onTestChange={(v: number) => setTestPoints(p => ({ ...p, handling: v }))} carro={performanceData.handling.carro} pista={performanceData.handling.pista} />
                    <PerformanceRow label="Accel." part={performanceData.accel.part} test={testPoints.accel} onTestChange={(v: number) => setTestPoints(p => ({ ...p, accel: v }))} carro={performanceData.accel.carro} pista={performanceData.accel.pista} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES REFATORADOS ---

function ZSBox({ label, value }: any) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-zinc-500 font-bold uppercase">{label}</span>
            <div className="bg-black/40 border border-white/10 rounded px-1 py-1.5 w-full text-center shadow-inner">
                <span className="text-[11px] font-mono font-bold text-orange-400">{value}</span>
            </div>
        </div>
    )
}

function StatRow({ label, value, valueColor = "text-zinc-200", icon }: any) {
    return (
        <div className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 hover:bg-white/[0.02] px-2 rounded transition-colors">
            <span className="text-zinc-500 text-xs font-medium flex items-center gap-3">{icon} {label}</span>
            <span className={`text-right text-sm ${valueColor}`}>{value}</span>
        </div>
    )
}

function SkillInput({ label, value, max, color, onChange, readonly, glow }: any) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="flex items-center gap-3 group py-0.5">
            <span className="text-zinc-500 w-24 text-right font-bold text-[9px] uppercase cursor-default group-hover:text-zinc-300 transition-colors tracking-wide">{label}</span>
            <div className="flex-1 flex items-center bg-zinc-950/50 rounded h-5 relative overflow-hidden border border-white/5">
                <div className={`absolute left-0 top-0 bottom-0 transition-all duration-700 opacity-60 ${color || 'bg-purple-600'} ${glow}`} style={{ width: `${percentage}%` }}></div>
                {/* Linha de brilho no topo da barra */}
                <div className="absolute top-0 left-0 h-[1px] bg-white/30 z-10 w-full opacity-0 group-hover:opacity-50 transition-opacity"></div>
                
                <input type="number" value={value} onChange={onChange} readOnly={readonly} className={`w-full bg-transparent text-white text-center text-[10px] font-mono font-bold outline-none z-20 relative ${readonly ? 'cursor-default' : 'focus:text-purple-300'}`} />
            </div>
            <div className="w-8 text-[9px] text-zinc-600 font-mono text-center">{max}</div>
        </div>
    )
}

function CarPartInput({ name, level, wear, onLevelChange, onWearChange }: any) {
    let wearColor = "text-emerald-400";
    if (wear > 50) wearColor = "text-yellow-400";
    if (wear > 85) wearColor = "text-rose-500 font-bold animate-pulse";
    
    return (
        <tr className="hover:bg-white/[0.03] transition-colors group">
            <td className="px-4 py-2 text-zinc-400 font-medium text-[10px] uppercase tracking-wide group-hover:text-zinc-200">{name}</td>
            <td className="px-1 py-1 text-center">
                <input type="number" value={level} onChange={onLevelChange} className="w-10 bg-black/40 border border-white/5 text-zinc-200 text-center outline-none focus:border-purple-500/50 rounded py-1 font-mono text-[10px] transition-all" />
            </td>
            <td className="px-1 py-1 text-center">
                <div className="flex items-center justify-center relative">
                    <input type="number" value={wear} onChange={onWearChange} className={`w-10 bg-black/40 border border-white/5 text-center outline-none focus:border-purple-500/50 rounded py-1 font-mono text-[10px] font-bold transition-all ${wearColor}`} />
                </div>
            </td>
        </tr>
    )
}

function PerformanceRow({ label, part, test, onTestChange, carro, pista }: any) {
    const diff = carro - pista;
    const isPositive = diff >= 0;
    const partWidth = Math.min((part / 200) * 100, 100);
    const testWidth = Math.min((test / 200) * 100, 100 - partWidth);
    const pistaPos = Math.min((pista / 200) * 100, 100);
    
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-end text-xs font-bold uppercase">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-[10px] tracking-widest">{label}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/5 shadow-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                </div>
                <div className="flex gap-1.5 items-center">
                    <StatValue label="PART" value={part} />
                    <div className="flex flex-col items-center">
                        <span className="text-[6px] text-zinc-600 font-bold mb-0.5 tracking-wider">TEST</span>
                        <input type="number" value={test} onChange={(e) => onTestChange(Number(e.target.value))} className="w-10 h-7 bg-black/40 border border-zinc-700 hover:border-zinc-500 rounded text-center font-mono text-[10px] text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all" />
                    </div>
                    <StatValue label="TOTAL" value={carro} highlight={isPositive ? 'green' : 'red'} />
                    <div className="flex flex-col items-center ml-1 opacity-80">
                        <span className="text-[6px] text-zinc-600 font-bold mb-0.5 tracking-wider">REQ</span>
                        <span className="font-mono text-[10px] font-bold text-zinc-300 bg-zinc-800 px-2 py-1.5 rounded border border-white/5 h-7 flex items-center justify-center min-w-[32px]">{pista}</span>
                    </div>
                </div>
            </div>
            
            {/* Barra de Progresso High-End */}
            <div className="relative h-2 w-full bg-zinc-950 rounded-full overflow-visible">
                {/* Background Track */}
                <div className="absolute inset-0 bg-zinc-900 rounded-full border border-white/5"></div>

                {/* Part Bar */}
                <div className="absolute top-0 bottom-0 bg-zinc-600 rounded-l-full z-10 opacity-80" style={{ width: `${partWidth}%` }}></div>
                
                {/* Test Bar (Glowing) */}
                <div className={`absolute top-0 bottom-0 z-10 transition-all duration-300 ${isPositive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'}`} 
                     style={{ left: `${partWidth}%`, width: `${testWidth}%`, borderTopRightRadius: (partWidth + testWidth) >= 98 ? '999px' : '0', borderBottomRightRadius: (partWidth + testWidth) >= 98 ? '999px' : '0' }}></div>
                
                {/* Marcador de Requisito (Pista) */}
                <div className="absolute -top-1 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-20 transition-all duration-500" style={{ height: '16px', left: `${pistaPos}%` }}>
                    <div className="absolute -top-2 -left-1 text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity">{pista}</div>
                </div>
            </div>
        </div>
    );
}

function StatValue({ label, value, highlight }: any) {
    let colors = "bg-zinc-900/50 border-zinc-800 text-zinc-500";
    if (highlight === 'green') colors = "bg-emerald-950/20 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
    if (highlight === 'red') colors = "bg-rose-950/20 border-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]";
    return (
        <div className={`px-1 rounded border flex flex-col items-center justify-center h-7 min-w-[34px] ${colors}`}>
            <span className="text-[6px] opacity-60 font-bold leading-none mb-0.5 tracking-wider">{label}</span>
            <span className="font-mono text-[10px] font-bold leading-none">{value}</span>
        </div>
    );
}