'use client';
import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext'; 
import { 
  Settings, User, Car, Zap, Activity, Trophy, MapPin, 
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Gauge, Cpu 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TIPAGEM ---
type DriverKeys = 'concentracao' | 'talento' | 'agressividade' | 'experiencia' | 'tecnica' | 'resistencia' | 'carisma' | 'motivacao' | 'reputacao' | 'peso' | 'idade' | 'energia' | 'total';

const TRACK_FLAGS: { [key: string]: string } = {
  "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Estoril": "pt", "Fuji": "jp", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "it", "Interlagos": "br", "Istanbul": "tr", "Monaco": "mc", "Montreal": "ca", "Monza": "it", "Sakhir": "bh", "Silverstone": "gb", "Spa": "be", "Suzuka": "jp", "Yas Marina": "ae", "Zandvoort": "nl", "Jeddah": "sa", "Miami": "us", "Las Vegas": "us"
};

const MOCK_PERFORMANCE_DATA = {
    power: { part: 0, test: 0, carro: 0, pista: 0 },
    handling: { part: 0, test: 0, carro: 0, pista: 0 },
    accel: { part: 0, test: 0, carro: 0, pista: 0 },
    // Garanta que zs tem as chaves certas para não quebrar a tela
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

  // --- 1. HIDRATAÇÃO (PORTUGUÊS) ---
  useEffect(() => {
    async function hydrate() {
        try {
            const [resT, resS] = await Promise.all([
                fetch('/api/python?action=tracks'),
                fetch('/api/python?action=state')
            ]);
            const dataTracks = await resT.json();
            const jsonState = await resS.json();

            if (dataTracks.tracks) setTracksList(dataTracks.tracks);
            if (jsonState.sucesso && jsonState.data) {
                const d = jsonState.data;
                if (d.current_track) updateTrack(d.current_track);
                if (d.driver) Object.entries(d.driver).forEach(([key, val]) => updateDriver(key as any, Number(val)));
                if (d.car) d.car.forEach((part: any, idx: number) => {
                    updateCar(idx, 'lvl', part.lvl);
                    updateCar(idx, 'wear', part.wear);
                });
                if (d.test_points) setTestPoints(d.test_points);
            }
        } catch (e) { console.error(e); }
        finally { setInitialLoaded(true); }
    }
    hydrate();
  }, []);

  // --- 2. PERSISTÊNCIA ---
  const persistToExcel = useCallback(async () => {
    if (!initialLoaded) return;
    setIsSyncing(true);
    try {
        const res = await fetch('/api/python?endpoint=update_driver_car', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driver, car, test_points: testPoints })
        });
        const data = await res.json();
        if (data.sucesso && data.oa !== undefined) updateDriver('total', Number(data.oa));
    } catch (e) { console.error(e); }
    finally { setIsSyncing(false); }
  }, [driver, car, testPoints, initialLoaded, updateDriver]);

  useEffect(() => {
    if (!initialLoaded) return;
    const timer = setTimeout(() => persistToExcel(), 2000);
    return () => clearTimeout(timer);
  }, [driver, car, testPoints, persistToExcel, initialLoaded]);

  // --- 3. PERFORMANCE FETCH (ATUALIZADO PARA O NOVO BACKEND) ---
  const fetchPerformance = useCallback(async () => {
    // Só calcula se tiver pista selecionada
    if (!track || track === "Selecionar Pista") return;
    
    setIsPerformanceLoading(true);
    
    // PREPARA O PAYLOAD ACHATADO (Igual o backend espera)
    // O backend lê: body.chassi_lvl, body.test_power, body.concentracao, etc.
    const payload = {
        pista: track,
        
        // Espalha dados do piloto (concentracao, talento...)
        ...driver, 
        
        // Mapeia o Array do Carro para campos individuais
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
        
        // Mapeia os Pontos de Teste
        test_power: testPoints.power,
        test_handling: testPoints.handling,
        test_accel: testPoints.accel
    };

    try {
        // AQUI ESTÁ A MUDANÇA PRINCIPAL DA ROTA:
        const res = await fetch('/api/python?endpoint=performance', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        const data = await res.json();
        
        if (data.sucesso && data.data) {
            setPerformanceData(data.data);
        }
    } catch (e) { 
        console.error("Erro calculando performance:", e); 
    } finally { 
        setIsPerformanceLoading(false); 
    }
  }, [track, driver, car, testPoints]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && initialLoaded) {
        const timer = setTimeout(() => fetchPerformance(), 500); 
        return () => clearTimeout(timer);
    }
  }, [track, fetchPerformance, initialLoaded]);

  if (!initialLoaded) return (
    <div className="flex h-screen items-center justify-center bg-[#050507]">
        <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="font-mono text-[10px] text-indigo-400 uppercase tracking-[0.4em] animate-pulse">Iniciando_Sistemas...</p>
        </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8 animate-fadeIn text-slate-300 pb-24 font-mono max-w-[1600px] mx-auto">
      
      {/* HEADER BAR: SELEÇÃO DE PISTA */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 shadow-2xl">
        <div className="bg-black/40 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
            <div className="flex items-center gap-8 w-full md:w-auto">
                <div className="relative group">
                    <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/40 transition-all"></div>
                    <div className="w-20 h-12 bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden relative z-10">
                        {track && TRACK_FLAGS[track] ? (
                            <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                        ) : <span className="text-xl">🏁</span>}
                    </div>
                </div>
                <div>
                    <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                        <MapPin size={10} className="text-indigo-400"/> Circuito_Sessão_Atual
                    </h2>
                    <div className="relative flex items-center">
                        <select 
                            value={track} 
                            onChange={(e) => updateTrack(e.target.value)}
                            className="bg-transparent text-2xl text-white font-black tracking-tighter outline-none cursor-pointer hover:text-indigo-400 transition-colors appearance-none pr-8"
                        >
                            <option value="Selecionar Pista" className="bg-slate-900">SELECIONAR_PISTA</option>
                            {tracksList.map((t, i) => <option key={i} value={t} className="bg-slate-900">{t.toUpperCase()}</option>)}
                        </select>
                        <ChevronDown className="absolute right-0 pointer-events-none text-slate-600" size={18} />
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* COLUNA 1: INFO GERENTE */}
        <div className="xl:col-span-3 space-y-6">
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-full backdrop-blur-sm">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <ShieldCheck size={16} className="text-indigo-400"/>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Perfil_Gerente</h3>
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
                    <button onClick={persistToExcel} className="w-full mt-4 bg-white/[0.03] hover:bg-indigo-600 hover:text-white py-4 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-widest group">
                        <RefreshCw size={14} className={`group-hover:rotate-180 transition-transform duration-700 ${isSyncing ? "animate-spin" : ""}`} />
                        Sincronizar_Dados
                    </button>
                </div>
            </section>
        </div>

        {/* COLUNA 2: DADOS PILOTO */}
        <div className="xl:col-span-5 bg-white/[0.02] border border-white/5 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <Cpu size={18} className="text-indigo-400"/>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Telemetria_Piloto</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Pontuação_OA</span>
                    <div className="text-xl font-black text-indigo-400 tracking-tighter bg-indigo-500/10 px-3 py-1 rounded border border-indigo-500/20">{Number(driver.total).toFixed(1)}</div>
                </div>
            </div>

            {/* BARRA DE ENERGIA */}
            <div className="mb-10 bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <span className="flex items-center gap-2"><Zap size={12} className="text-amber-500 animate-pulse"/> Energia_Atual</span>
                    <span className="text-white">{driver.energia}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden flex relative">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${driver.energia}%` }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-[0_0_15px_#6366f1]" />
                    <input type="number" value={driver.energia} onChange={(e)=>updateDriver('energia', Number(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
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
            <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col max-h-[450px]">
                <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2"><Car size={14} className="text-indigo-400"/> Status_Componentes</h3>
                    <span className="text-[8px] font-black text-slate-500">LVL / WEAR</span>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-2">
                    <table className="w-full">
                        <tbody className="divide-y divide-white/5">
                            {car.map((part, idx) => (
                                <CarRow key={idx} part={part} 
                                    onLvl={(e:any)=>updateCar(idx, 'lvl', Number(e.target.value))}
                                    onWear={(e:any)=>updateCar(idx, 'wear', Number(e.target.value))}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <Activity size={16} className="text-indigo-400"/>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Análise_Delta_Setup</h3>
                </div>
                <div className="space-y-8">
                    <PerformanceMetric 
                        label="Power" 
                        data={performanceData.power} 
                        test={testPoints.power} 
                        onTest={(v: number) => setTestPoints(p => ({...p, power: v}))} // Adicionado : number
                    />
                    <PerformanceMetric 
                        label="Handling" 
                        data={performanceData.handling} 
                        test={testPoints.handling} 
                        onTest={(v: number) => setTestPoints(p => ({...p, handling: v}))} // Adicionado : number
                    />
                    <PerformanceMetric 
                        label="Accel" 
                        data={performanceData.accel} 
                        test={testPoints.accel} 
                        onTest={(v: number) => setTestPoints(p => ({...p, accel: v}))} // Adicionado : number
                    />
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES ---

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
        <div className={`space-y-1.5 group ${isSmall ? 'flex-1' : ''}`}>
            <div className="flex justify-between items-end">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{label}</label>
                <span className="text-[8px] font-mono text-slate-600">{max}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-indigo-500/60" />
                <input type="number" value={value} onChange={onChange} className="absolute inset-0 bg-transparent text-center text-[10px] font-black text-white outline-none" />
            </div>
        </div>
    )
}

function CarRow({ part, onLvl, onWear }: any) {
    const isCritical = part.wear > 85;
    return (
        <tr className="hover:bg-white/[0.02] transition-colors">
            <td className="py-2.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-tighter">{part.name}</td>
            <td className="text-center px-1">
                <input type="number" value={part.lvl} onChange={onLvl} className="w-10 bg-black/40 border border-white/5 rounded text-center text-[10px] font-black text-white outline-none focus:border-indigo-500/50" />
            </td>
            <td className="text-center px-1">
                <input type="number" value={part.wear} onChange={onWear} className={`w-10 bg-black/40 border border-white/5 rounded text-center text-[10px] font-black outline-none ${isCritical ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
            </td>
        </tr>
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
                    <div className="text-center">
                        <p className="text-[6px] text-slate-600 font-black uppercase">Peça</p>
                        <p className="text-[10px] font-black text-slate-400">{data.part}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[6px] text-slate-600 font-black uppercase">Teste</p>
                        <input type="number" value={test} onChange={(e)=>onTest(Number(e.target.value))} className="w-8 bg-black/40 border border-white/10 rounded text-center text-[10px] font-black text-indigo-400" />
                    </div>
                    <div className="text-center bg-white/5 px-2 py-1 rounded">
                        <p className="text-[6px] text-slate-500 font-black uppercase">Req</p>
                        <p className="text-[10px] font-black text-white">{data.pista}</p>
                    </div>
                </div>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full relative overflow-visible border border-white/5">
                <div className="h-full bg-slate-600 rounded-l-full" style={{ width: `${barPart}%` }} />
                <div className={`h-full absolute top-0 ${isOk ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'}`} style={{ left: `${barPart}%`, width: `${barTest}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white shadow-[0_0_8px_white] z-10" style={{ left: `${reqPos}%` }} />
            </div>
        </div>
    );
}