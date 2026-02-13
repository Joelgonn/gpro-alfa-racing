// app/dashboard/tests/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useGame, CarPart } from '../../context/GameContext'; 
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, MapPin, ChevronDown, Loader2, Search, X, ShieldCheck, BarChart3, CheckCircle, Trash2, Zap, LayoutGrid, Gauge, SlidersHorizontal, Package, RefreshCw, Snowflake, Cpu, BarChart, ChevronLeft, ChevronRight } from 'lucide-react';

// --- CONSTANTES ---
const TRACK_FLAGS: { [key: string]: string } = { "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jylland_Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be" };
const COMPONENTS_SETUP = [ 
    { id: 'asaDianteira', label: 'Asa Dianteira' }, 
    { id: 'asaTraseira', label: 'Asa Traseira' }, 
    { id: 'motor', label: 'Motor' }, 
    { id: 'freios', label: 'Freios' }, 
    { id: 'cambio', label: 'Câmbio' }, 
    { id: 'suspensao', label: 'Suspensão' }, 
];

const CAR_PARTS_LIST_UI = [ 
    { id: 'chassi', label: 'Chassi', icon: LayoutGrid, nameInContext: "Chassi" },
    { id: 'motor', label: 'Motor', icon: Zap, nameInContext: "Motor" },
    { id: 'asaDianteira', label: 'Asa dianteira', icon: SlidersHorizontal, nameInContext: "Asa dianteira" },
    { id: 'asaTraseira', label: 'Asa traseira', icon: SlidersHorizontal, nameInContext: "Asa traseira" },
    { id: 'assoalho', label: 'Assoalho', icon: BarChart, nameInContext: "Assoalho" }, 
    { id: 'laterais', label: 'Laterais', icon: BarChart, nameInContext: "Laterais" }, 
    { id: 'radiador', label: 'Radiador', icon: Snowflake, nameInContext: "Radiador" }, 
    { id: 'cambio', label: 'Câmbio', icon: SlidersHorizontal, nameInContext: "Câmbio" },
    { id: 'freios', label: 'Freios', icon: Gauge, nameInContext: "Freios" }, 
    { id: 'suspensao', label: 'Suspensão', icon: SlidersHorizontal, nameInContext: "Suspensão" },
    { id: 'eletronicos', label: 'Eletrônicos', icon: Cpu, nameInContext: "Eletrônicos" }, 
];
const testPriorities = [
  "Escolha uma prioridade", "Nenhuma prioridade em especial", "Velocidade máxima", "Fazer curvas", "Cotovelos", "Frear", "Ultrapassagem", "Chicanes", "Testar os limites do carro", "Afinação do ajuste"
];

export interface SetupIdealResult {
    asaDianteira: string;
    asaTraseira: string;
    motor: string;
    freios: string;
    cambio: string;
    suspensao: string;
}

export interface StintData { 
    voltas: number; 
    desgaste_final_pneu: string; 
    comb_necessario: string; 
    tipo_pneu: string; 
}

export interface TestResults {
    setupIdeal: SetupIdealResult;
    stint1: StintData;
}

interface TestApiResponse {
    sucesso: boolean;
    data?: TestResults;
    error?: string;
}

// ... (TrackSelector e SupplierCarousel mantidos iguais, omitidos para brevidade) ...
function TrackSelector({ currentTrack, tracksList, onSelect }: { currentTrack: string, tracksList: string[], onSelect: (t: string) => void }) { const [isOpen, setIsOpen] = useState(false); const [search, setSearch] = useState(""); const dropdownRef = useRef<HTMLDivElement>(null); useEffect(() => { function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); } document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [dropdownRef]); const filteredTracks = useMemo(() => tracksList.filter(t => t.toLowerCase().includes(search.toLowerCase())), [tracksList, search]); return (<div className="relative z-20 w-full" ref={dropdownRef}> <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between gap-3 text-xl text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group"> <span className="truncate">{currentTrack && currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR PISTA"}</span> <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 shrink-0 ${isOpen ? 'rotate-180' : ''}`} size={20} /> </button> <AnimatePresence> {isOpen && ( <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-full bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50"> <div className="p-3 border-b border-white/5 bg-white/[0.02]"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input autoFocus type="text" placeholder="Buscar pista..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 outline-none font-bold uppercase" />{search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}</div></div> <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">{filteredTracks.map(track => (<button key={track} onClick={() => { onSelect(track); setIsOpen(false); setSearch(""); }} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}> <div className="flex items-center gap-3"> {TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-5 h-3 object-cover rounded-sm shadow-sm" /> : <div className="w-5 h-3 bg-white/10 rounded-sm"></div>} <span>{track}</span> </div> {currentTrack === track && <ShieldCheck size={12} />} </button>))}</div> </motion.div> )} </AnimatePresence> </div>); }
function SupplierCarousel({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) { const [imgError, setImgError] = useState(false); useEffect(() => { setImgError(false); }, [value]); if (!options || options.length === 0) return <div className="bg-black/40 p-3 rounded-lg border border-white/5 text-[9px] text-slate-500">Sem Opções</div>; const currentIndex = options.findIndex(o => o === value); const handleNext = () => onChange(options[(currentIndex + 1) % options.length] || options[0]); const handlePrev = () => onChange(options[(currentIndex - 1 + options.length) % options.length] || options[0]); return (<div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 select-none"> <button onClick={handlePrev} className="text-slate-500 hover:text-white transition-colors p-2"><ChevronLeft size={16}/></button> <div className="flex items-center justify-center flex-1 h-12"> {value && !imgError ? (<img src={`/tyres/${value.toString().toLowerCase().trim()}.gif`} alt={value} className="h-12 w-auto object-contain drop-shadow-md transition-all" onError={() => setImgError(true)} />) : (<span className="font-black text-[10px] text-indigo-400 uppercase tracking-widest truncate max-w-[120px] text-center">{value || "Selecione"}</span>)} </div> <button onClick={handleNext} className="text-slate-500 hover:text-white transition-colors p-2"><ChevronRight size={16}/></button> </div>); }

interface LocalCarParts {
  [key: string]: { level: number; wear: number; };
}

// ... (PartsStatusDisplay mantido igual) ...
function PartsStatusDisplay({ carParts, onUpdate, onResetToContext }: { carParts: LocalCarParts, onUpdate: (partId: string, field: 'level' | 'wear', value: number) => void, onResetToContext: () => void }) {
    if (!carParts) return null;

    const getHealthColor = (health: number) => {
        if (health <= 30) return 'text-red-500';
        if (health <= 60) return 'text-yellow-500';
        return 'text-emerald-500';
    };

    return (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 mb-8 shadow-xl">
            <div className='flex justify-between items-center mb-4 border-b border-white/10 pb-3'>
                <h2 className="text-lg font-bold text-white flex items-center gap-2"> <Package size={20} className="text-indigo-400" /> STATUS DE PEÇAS (EDITÁVEL) </h2>
                <button onClick={onResetToContext} className='text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1'> <RefreshCw size={12} /> Reverter para Contexto </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <div className="grid gap-4" style={{ minWidth: `${CAR_PARTS_LIST_UI.length * 120}px`, gridTemplateColumns: `repeat(${CAR_PARTS_LIST_UI.length}, minmax(0, 1fr))` }}>
                    {CAR_PARTS_LIST_UI.map(part => {
                        const partData = carParts[part.id] || { level: 1, wear: 0.0 };
                        const currentHealth = Math.round(100 - partData.wear); 
                        return (
                            <div key={part.id} className="text-center p-2 rounded-lg bg-black/30 border border-white/5 transition-all">
                                <part.icon size={16} className={`mx-auto ${getHealthColor(currentHealth)}`} />
                                <p className="text-[9px] font-black uppercase text-slate-400 mt-1 truncate">{part.label}</p>
                                <label className="block text-[8px] font-bold text-slate-500 uppercase mt-2">Nível</label>
                                <input type="number" min={1} max={99} value={partData.level} onChange={(e) => onUpdate(part.id, 'level', parseInt(e.target.value) || 1)} className="w-full bg-transparent text-sm font-extrabold text-white text-center outline-none border-b border-indigo-500/50" />
                                <label className="block text-[8px] font-bold text-slate-500 uppercase mt-2">Desgaste (%)</label>
                                <input type="number" min={0} max={100} value={Math.round(partData.wear)} onChange={(e) => onUpdate(part.id, 'wear', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className="w-full bg-transparent text-sm font-extrabold text-white text-center outline-none border-b border-indigo-500/50" />
                                <p className={`text-[8px] font-bold mt-1 ${getHealthColor(currentHealth)}`}> Saúde: {currentHealth}% </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}

const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export default function TestsPage() {
  const { 
    tracksList, 
    tyreSuppliers, 
    driver, 
    car, 
    techDirector,
    staffFacilities,
    weather,
    desgasteModifier
  } = useGame();

  const [localTrack, setLocalTrack] = useState('Selecionar Pista');
  const MAX_TOTAL_LAPS = 100;
  const MIN_LAPS = 5;

  const convertCarArrayToObject = useCallback((carArray: CarPart[]): LocalCarParts => {
    console.log("CAR DATA RECEIVED IN TESTS:", carArray);

    const obj: LocalCarParts = {};
    if (!Array.isArray(carArray) || carArray.length === 0) {
        CAR_PARTS_LIST_UI.forEach(uiPart => { obj[uiPart.id] = { level: 1, wear: 0 }; });
        return obj;
    }

    CAR_PARTS_LIST_UI.forEach(uiPart => {
      const targetName = normalizeString(uiPart.nameInContext);
      const contextPart = carArray.find(cp => normalizeString(cp.name) === targetName);
      if (contextPart) {
        obj[uiPart.id] = { level: contextPart.lvl, wear: contextPart.wear };
      } else {
        obj[uiPart.id] = { level: 1, wear: 0 };
      }
    });
    return obj;
  }, []);

  const [localCarStatus, setLocalCarStatus] = useState<LocalCarParts>(() => convertCarArrayToObject(car));
  
  useEffect(() => {
    setLocalCarStatus(convertCarArrayToObject(car));
  }, [car, convertCarArrayToObject]);

  // CORREÇÃO: Pneus fornecedor inicia como "Pipirelli"
  const [testInputs, setTestInputs] = useState({
    condicao: "Dry" as "Dry" | "Wet", avg_temp: 25, testPriority: "Escolha uma prioridade", voltas: 0, pneus_fornecedor: "Pipirelli", tipo_pneu: "Medium", controlRisk: 75,
  });

  const [loading, setLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<TestResults | null>(null);
  const [committedStints, setCommittedStints] = useState<StintData[]>([]);
  const [isPriorityOpen, setPriorityOpen] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);

  // ... (o restante do componente TestsPage permanece igual) ...
  const { lapsUsed, lapsRemaining } = useMemo(() => {
    const used = committedStints.reduce((acc, stint) => acc + stint.voltas, 0);
    return { lapsUsed: used, lapsRemaining: MAX_TOTAL_LAPS - used };
  }, [committedStints]);

  const handlePartUpdate = (partId: string, field: 'level' | 'wear', value: number) => {
    setLocalCarStatus(prevStatus => ({
        ...prevStatus,
        [partId]: { ...prevStatus[partId], [field]: value }
    }));
  };

  const handleResetCarStatus = () => { setLocalCarStatus(convertCarArrayToObject(car)); };

  const runSimulation = useCallback(async () => {
    if (!localTrack || localTrack === 'Selecionar Pista' || testInputs.voltas <= 0) {
      setPreviewResults(null); 
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/tests', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            track: localTrack, 
            testInputs: testInputs, 
            driver: driver, 
            car: localCarStatus, 
            techDirector: techDirector, 
            staffFacilities: staffFacilities, 
            weather: weather, 
            desgasteModifier: desgasteModifier 
        })
      });
      const data: TestApiResponse = await response.json(); 
      if (data.sucesso && data.data) { setPreviewResults(data.data); } 
      else { console.error("Erro na simulação:", data.error); setPreviewResults(null); }
    } catch (error) { console.error("Erro API:", error); setPreviewResults(null); }
    finally { setLoading(false); }
  }, [localTrack, testInputs, driver, localCarStatus, techDirector, staffFacilities, weather, desgasteModifier]);

  useEffect(() => {
    const handler = setTimeout(() => { runSimulation(); }, 700);
    return () => clearTimeout(handler);
  }, [localTrack, testInputs, localCarStatus, runSimulation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) setPriorityOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCommitStint = () => {
    if (!previewResults?.stint1) return;
    const stintToCommit = previewResults.stint1;
    setCommittedStints(prev => [...prev, stintToCommit]);
    const remainingAfterCommit = lapsRemaining - stintToCommit.voltas;
    let nextVoltas = 0;
    if (remainingAfterCommit >= MIN_LAPS) { nextVoltas = MIN_LAPS; } 
    else if (remainingAfterCommit > 0) { nextVoltas = remainingAfterCommit; }
    setTestInputs(prev => ({ ...prev, testPriority: "Escolha uma prioridade", voltas: nextVoltas }));
  };

  const handleResetTest = () => {
    if (!window.confirm("Resetar stints?")) return;
    setCommittedStints([]);
    setPreviewResults(null);
    setTestInputs(prev => ({ ...prev, testPriority: "Escolha uma prioridade", voltas: 0, controlRisk: 75 }));
  };

  const handleTestInputChange = (field: keyof typeof testInputs, value: any) => {
    let newControlRisk = testInputs.controlRisk;
    if (field === 'testPriority') {
        if (value === "Testar os limites do carro") newControlRisk = 100;
        else if (value !== "Escolha uma prioridade") newControlRisk = 75;
    }
    setTestInputs(prev => ({ ...prev, [field]: value, controlRisk: field === 'testPriority' ? newControlRisk : prev.controlRisk }));
  };

  const lapsInputMax = Math.min(50, lapsRemaining);
  const lapsInputMin = 0;
  const isCommitButtonDisabled = loading || !previewResults?.stint1 || testInputs.testPriority === "Escolha uma prioridade" || testInputs.voltas <= 0 || (lapsRemaining >= MIN_LAPS && testInputs.voltas < MIN_LAPS) || testInputs.voltas > lapsRemaining;
  const isResetButtonDisabled = committedStints.length === 0 && lapsUsed === 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-8 text-slate-300 pb-24 font-mono">
      <PartsStatusDisplay carParts={localCarStatus} onUpdate={handlePartUpdate} onResetToContext={handleResetCarStatus} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Componentes de UI mantidos */}
        <div className="space-y-6 lg:col-span-1">
            <section className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
              <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-white"><Settings size={14} className="text-indigo-400"/> DADOS DO TESTE</h3>
                <div className="text-[10px] uppercase font-bold tracking-wider"><span className="text-slate-500">Voltas Restantes: </span><span className={`${lapsRemaining > 30 ? 'text-emerald-400' : lapsRemaining >= MIN_LAPS ? 'text-yellow-400' : 'text-red-500'}`}>{lapsRemaining} / {MAX_TOTAL_LAPS}</span></div>
              </div>
              <div className="p-6 space-y-6">
                   <div className="bg-black/40 rounded-lg p-4 border border-white/5"> <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"> <MapPin size={12} className="text-indigo-400" /> Circuito </h2> <TrackSelector currentTrack={localTrack} tracksList={tracksList} onSelect={setLocalTrack} /> </div>
                   <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg"> {["Dry", "Wet"].map(c => ( <button key={c} onClick={() => handleTestInputChange('condicao', c)} className={`py-3 rounded font-black text-[10px] uppercase transition-all ${testInputs.condicao === c ? (c === 'Dry' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'): 'text-slate-600 hover:text-slate-400'}`}>{c === 'Dry' ? '☀️ Pista Seca' : '🌧️ Pista Molhada'}</button>))} </div>
                   <div className="grid grid-cols-2 gap-4"> 
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5"> <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2">Temp.</label> <div className="flex items-center justify-between"> <input type="number" value={testInputs.avg_temp} onChange={(e) => handleTestInputChange('avg_temp', Number(e.target.value))} className="bg-transparent font-black text-lg text-white outline-none w-full min-w-0" /> <span className="text-sm text-indigo-500 font-bold ml-1">°C</span> </div> </div> 
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5"> <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2">Voltas (Máx. {lapsInputMax})</label> <input type="number" value={testInputs.voltas} step={1} min={lapsInputMin} max={lapsInputMax} disabled={lapsRemaining === 0} onChange={(e) => { const newMax = lapsInputMax; let value = Number(e.target.value); value = Math.max(lapsInputMin, Math.min(newMax, value)); if (isNaN(value)) { value = 0; } handleTestInputChange('voltas', value); }} className="bg-transparent font-black text-lg text-yellow-400 outline-none w-full disabled:opacity-50" /> </div> 
                    </div>
                    <div className="relative" ref={priorityRef}> 
                        <div className="bg-black/40 p-3 rounded-lg border border-white/5 h-full"> <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2">Prioridade (CTR: {testInputs.controlRisk})</label> <button onClick={() => setPriorityOpen(!isPriorityOpen)} className={`w-full text-left font-black text-lg truncate h-6 ${testInputs.testPriority === 'Escolha uma prioridade' ? 'text-slate-500' : 'text-white'}`}>{testInputs.testPriority}</button> </div> <AnimatePresence> {isPriorityOpen && ( <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full left-0 mt-1 w-full bg-[#16161a] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-10"> <div className="max-h-60 overflow-y-auto custom-scrollbar p-1"> {testPriorities.map(p => ( <button key={p} onClick={() => { handleTestInputChange('testPriority', p); setPriorityOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded text-sm font-medium transition-colors ${testInputs.testPriority === p ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>{p}</button> ))} </div> </motion.div> )} </AnimatePresence> 
                    </div>
                   <div> <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block tracking-widest">Fornecedor de Pneus</label> <SupplierCarousel options={tyreSuppliers} value={testInputs.pneus_fornecedor} onChange={(val) => handleTestInputChange('pneus_fornecedor', val)} /> </div>
                   <div> <label className="text-[9px] font-black text-slate-500 uppercase mb-4 block text-center tracking-widest">Seleção de Composto</label> <div className="flex justify-between items-center gap-2 bg-black/20 p-3 rounded-xl border border-white/5 overflow-x-auto"> {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(p => { const isSelected = testInputs.tipo_pneu === p; const img = p === 'Extra Soft' ? 'super macio' : p === 'Soft' ? 'macio' : p === 'Medium' ? 'medio' : p === 'Hard' ? 'duro' : 'chuva'; return ( <button key={p} onClick={() => handleTestInputChange('tipo_pneu', p)} className={`relative group shrink-0 transition-all duration-500 ${isSelected ? 'scale-110' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}> {isSelected && <motion.div layoutId="pneu-select-test" className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-md" />} <img src={`/compound/${img}.png`} alt={p} className={`w-10 h-10 object-contain rounded-full relative z-10 border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'}`} /> </button> ) })} </div> </div>
              </div>
              <div className="p-6 border-t border-white/5 flex gap-4">
                <button onClick={handleCommitStint} disabled={ isCommitButtonDisabled } className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black py-4 rounded-lg transition-all duration-300 text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/20"> <CheckCircle size={16} /> {lapsRemaining === 0 ? "Limite de Voltas Atingido" : "Confirmar Stint"} </button>
                <button onClick={handleResetTest} disabled={isResetButtonDisabled} className="flex items-center justify-center bg-red-600/30 hover:bg-red-600/50 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-red-400 font-bold p-4 rounded-lg transition-all" title="Resetar todos os testes confirmados"> <Trash2 size={18} /> </button>
              </div>
            </section>
        </div>
        <div className="space-y-6 lg:col-span-1"> 
          <AnimatePresence mode='wait'>
            {loading && testInputs.voltas > 0 && !previewResults ? ( <motion.div key="loading-setup" className="flex flex-col items-center justify-center h-[500px] bg-slate-900/40 border border-white/5 rounded-2xl p-6 text-indigo-400 text-center space-y-4"> <Loader2 className="animate-spin" size={32} /> <span className="text-xs font-bold uppercase tracking-widest">Calculando Setup...</span> </motion.div> ) : (localTrack !== "Selecionar Pista" && previewResults?.setupIdeal) ? ( 
              <motion.div key="setup-display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6"> 
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm"> 
                  <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4"> <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><Settings size={14} className="text-indigo-400" /> Setup Ideal</h2> </div> 
                  <div className='space-y-3'> {COMPONENTS_SETUP.map((part) => ( <div key={part.id} className="bg-black/20 p-4 rounded-lg border border-white/5 grid grid-cols-2 items-center"> <span className="text-sm font-bold text-white uppercase tracking-wider text-[10px]">{part.label}</span> <div className="text-center"> <p className="text-lg text-yellow-400 font-black">{previewResults.setupIdeal[part.id as keyof SetupIdealResult] || '-'}</p> </div> </div> ))} </div> 
                </section> 
              </motion.div>
            ) : (
              <motion.div key="initial-setup" className="flex flex-col items-center justify-center h-[500px] bg-slate-900/40 border border-white/5 rounded-2xl p-6 text-slate-500 text-center space-y-4"> <Settings size={48} className="text-slate-600" /> <p className="text-sm font-bold">Configure o teste para ver a sugestão de Setup Ideal.</p> </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="space-y-6 lg:col-span-1"> 
          <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-sm"> 
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4"> <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><BarChart3 size={14} className="text-emerald-400" /> Desgastes e Combustível</h2> </div> 
            <div className={`border border-indigo-500/30 bg-indigo-500/5 p-4 rounded-xl mb-6 ${testInputs.voltas === 0 || previewResults?.stint1 === undefined ? 'opacity-50' : ''}`}> 
              <h3 className="text-indigo-300 text-[9px] uppercase font-black tracking-widest mb-3">Prévia do Stint Atual</h3> 
              <div className="space-y-2 text-sm"> <div className="flex justify-between items-center"> <span className="text-slate-400">Voltas:</span> <span className="font-bold text-white">{previewResults?.stint1?.voltas ?? '-'}</span> </div> <div className="flex justify-between items-center"> <span className="text-slate-400">Desg. Final Pneu:</span> <span className="font-bold text-slate-300">{previewResults?.stint1 ? `${previewResults.stint1.desgaste_final_pneu}%` : '-'}</span> </div> <div className="flex justify-between items-center"> <span className="text-slate-400">Comb. Necessário:</span> <span className="font-bold text-indigo-300">{previewResults?.stint1 ? `${previewResults.stint1.comb_necessario}L` : '-'}</span> </div> </div> 
            </div> 
            <div> <h3 className="text-slate-400 text-[9px] uppercase font-black tracking-widest mb-3">Stints Confirmados ({lapsUsed} Voltas Usadas)</h3> {committedStints.length > 0 ? ( <div className="space-y-2"> {committedStints.map((stint, index) => ( <div key={index} className="bg-black/20 p-3 rounded-lg border border-white/5"> <div className="flex justify-between items-center text-xs"> <span className="font-bold text-white">Stint {index + 1}</span> <div className="flex items-center gap-1"> <img src={`/compound/${stint.tipo_pneu === 'Extra Soft' ? 'super macio' : stint.tipo_pneu === 'Soft' ? 'macio' : stint.tipo_pneu === 'Medium' ? 'medio' : stint.tipo_pneu === 'Hard' ? 'duro' : 'chuva'}.png`} alt={stint.tipo_pneu} className="w-4 h-4" /> <span className="text-slate-400 font-medium">{stint.tipo_pneu}</span> </div> </div> <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]"> <div> <div className="text-slate-500">VOLTAS</div> <div className="font-black text-lg text-white">{stint.voltas}</div> </div> <div> <div className="text-slate-500">DESGASTE</div> <div className="font-black text-lg text-slate-300">{stint.desgaste_final_pneu}%</div> </div> <div> <div className="text-slate-500">COMB.</div> <div className="font-black text-lg text-indigo-400">{stint.comb_necessario}L</div> </div> </div> </div> ))} </div> ) : ( <p className="text-center text-xs text-slate-500 py-4">Nenhum stint confirmado ainda.</p> )} </div> 
          </section>
        </div>
      </div>
    </div>
  );
}