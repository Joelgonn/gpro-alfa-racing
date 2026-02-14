'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; 
import { useGame } from '../../context/GameContext'; 
import {
  Loader2, MapPin, ChevronDown, Search, X, ShieldCheck,
  Settings, Sun, CloudRain, ChevronLeft, ChevronRight, Zap, Timer, 
  User, CarFront, Wrench, HardHat, Fuel, Activity, Check, Lock, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONSTANTES ---
const TRACK_FLAGS: { [key: string]: string } = { "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be" };

const TYRE_SUPPLIERS = ["Avonn", "Badyear", "Bridgerock", "Contimental", "Dunnolop", "Hancock", "Michelini", "Pipirelli", "Yokomama"];

const TYRE_COMPOUNDS = [
  { id: 'ExSoft', label: 'Extra Soft', img: 'super macio.png' },
  { id: 'Soft', label: 'Soft', img: 'macio.png' },
  { id: 'Medium', label: 'Medium', img: 'medio.png' },
  { id: 'Hard', label: 'Hard', img: 'duro.png' },
  { id: 'Rain', label: 'Rain', img: 'chuva.png' },
];

const TEST_PRIORITIES = ["Nenhuma prioridade em especial", "Velocidade máxima", "Fazer curvas", "Cotovelos", "Frear", "Ultrapassagem", "Chicanes", "Testar os limites do carro", "Afinação do ajuste"];
const CAR_PARTS_LABELS = ['Chassi', 'Motor', 'Asa Dianteira', 'Asa Traseira', 'Assoalho', 'Laterais', 'Radiador', 'Câmbio', 'Freios', 'Suspensão', 'Eletrônicos'];
const DRIVER_FIELDS = [
  { key: 'energia', label: 'Energia', max: 100 }, { key: 'concentracao', label: 'Concentração' }, { key: 'talento', label: 'Talento' }, { key: 'agressividade', label: 'Agressividade' }, { key: 'experiencia', label: 'Experiência', max: 500 }, { key: 'tecnica', label: 'Técnica' }, { key: 'resistencia', label: 'Resistência' }, { key: 'carisma', label: 'Carisma' }, { key: 'motivacao', label: 'Motivação' }, { key: 'reputacao', label: 'Reputação' }, { key: 'peso', label: 'Peso (kg)', max: 100 }, { key: 'idade', label: 'Idade', max: 50 }
];
const TEST_SETUP_PARTS = ['Asa Dianteira', 'Asa Traseira', 'Motor', 'Freios', 'Câmbio', 'Suspensão'];

// --- COMPONENTES AUXILIARES ---
function TrackSelector({ currentTrack, tracksList, onSelect }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const filteredTracks = useMemo(() => tracksList.filter((t: any) => t.toLowerCase().includes(search.toLowerCase())), [tracksList, search]);
    return (
        <div className="relative z-50 w-full md:w-auto">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 text-xs md:text-sm text-white font-black tracking-tighter bg-black/40 px-3 py-2 rounded-lg border border-white/10 uppercase outline-none">
                <span className="truncate">{currentTrack !== "" ? currentTrack : "Selecionar Pista"}</span> <ChevronDown size={16} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-full md:w-64 bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden">
                        <div className="p-3 border-b border-white/5"><input autoFocus type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white outline-none" /></div>
                        <div className="max-h-[300px] overflow-y-auto p-1 custom-scrollbar">{filteredTracks.map((track: any) => (
                          <button key={track} onClick={() => { onSelect(track); setIsOpen(false); }} className="w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-3">
                             {TRACK_FLAGS[track] && <img src={`/flags/${TRACK_FLAGS[track]}.png`} className="w-4 h-3 object-cover rounded-sm" />}
                             {track}
                          </button>
                        ))}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DriverStatRow({ label, value, onChange, max = 250 }: any) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="flex items-center gap-2 md:gap-4 h-6">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase w-20 md:w-24 truncate">{label}</span>
            <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-300" style={{ width: `${percentage}%` }}></div>
            </div>
            <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-10 md:w-12 h-5 text-center bg-black/40 border border-white/10 rounded text-[10px] font-bold text-white outline-none" />
        </div>
    );
}

function CarPartRow({ label, lvl, wear, onUpdate }: any) {
    return (
        <div className="flex items-center justify-between h-8 border-b border-white/5 px-1 hover:bg-white/[0.02] transition-colors">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase flex-1 truncate mr-2">{label}</span>
            <div className="flex gap-1 md:gap-2">
                <div className="flex items-center bg-black/30 rounded border border-white/5 px-1"><span className="text-[7px] text-slate-500 mr-1">LVL</span><input type="number" value={lvl} onChange={(e) => onUpdate('lvl', Number(e.target.value))} className="w-6 md:w-8 h-5 text-center bg-transparent text-[10px] font-bold text-slate-300 outline-none" /></div>
                <div className="flex items-center bg-black/30 rounded border border-white/5 px-1"><span className="text-[7px] text-slate-500 mr-1">DSG</span><input type="number" value={wear} onChange={(e) => onUpdate('wear', Number(e.target.value))} className="w-6 md:w-8 h-5 text-center bg-transparent text-[10px] font-bold text-emerald-400 outline-none" /></div>
            </div>
        </div>
    );
}

export default function TestsPage() {
  const router = useRouter(); 
  const { driver: globalDriver, car: globalCar } = useGame();
  
  const [tracks, setTracks] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [testTrack, setTestTrack] = useState<string>("Adelaide"); 
  const [localDriver, setLocalDriver] = useState<any>({});
  const [localCar, setLocalCar] = useState<any[]>([]);
  const [weather, setWeather] = useState<'Dry' | 'Wet'>('Dry');
  const [inputs, setInputs] = useState({ temp: 24.4, risk: 80, pits: 1 });
  const [priority, setPriority] = useState(TEST_PRIORITIES[0]); 
  const [supplierIndex, setSupplierIndex] = useState(0);
  const [selectedCompound, setSelectedCompound] = useState('Soft');
  
  const [testStints, setTestStints] = useState<any>({ s1: 10, s2: '', s3: '', s4: '', s5: '', s6: '', s7: '', s8: '' });
  const [sheetData, setSheetData] = useState<any[]>(Array(8).fill({ wear: 0, fuel: 0 }));
  const [setupIdeal, setSetupIdeal] = useState<any[]>(Array(6).fill('--'));

  const [lockedStints, setLockedStints] = useState<Record<number, boolean>>({});
  const [frozenResults, setFrozenResults] = useState<any[]>(Array(8).fill(null));

  const toggleLock = (index: number) => {
    const isLocked = lockedStints[index];
    if (!isLocked) {
        const newFrozen = [...frozenResults];
        newFrozen[index] = { ...sheetData[index] };
        setFrozenResults(newFrozen);
    }
    setLockedStints(prev => ({ ...prev, [index]: !isLocked }));
  };

  const visibleStintsCount = useMemo(() => {
    let count = 1; let sum = 0;
    for (let i = 1; i < 8; i++) {
        const val = Number(testStints[`s${i}`]) || 0;
        sum += val; if (sum < 100 && val > 0) count++; else break;
    }
    return count;
  }, [testStints]);

  const totalLaps = useMemo(() => Object.values(testStints).reduce((acc: number, val) => acc + (Number(val) || 0), 0), [testStints]);

  const handleStintChange = (key: string, value: string) => {
      const index = parseInt(key.replace('s', '')) - 1;
      if (lockedStints[index]) return;
      let numVal = value === '' ? '' : parseInt(value);
      if (typeof numVal === 'number') {
          if (numVal > 50) numVal = 50;
          const otherStintsSum = Object.entries(testStints).filter(([k]) => k !== key).reduce((acc, [_, v]) => acc + (Number(v) || 0), 0);
          if (otherStintsSum + numVal > 100) numVal = 100 - otherStintsSum;
      }
      setTestStints((prev: any) => ({ ...prev, [key]: numVal }));
  };

  const validateMinLaps = (key: string) => {
      const val = Number(testStints[key]);
      if (val > 0 && val < 5) setTestStints((prev: any) => ({ ...prev, [key]: 5 }));
  };

  useEffect(() => {
    if (priority === "Testar os limites do carro") setInputs(prev => ({ ...prev, risk: 100 }));
    else setInputs(prev => ({ ...prev, risk: 80 }));
  }, [priority]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return router.push('/login');
      setUserId(session.user.id);
      setIsAuthLoading(false);
    });
    fetch('/api/python?action=tracks').then(res => res.json()).then(data => setTracks(data.tracks || []));
  }, [router]);

  useEffect(() => {
    if (globalDriver && !localDriver.talento) setLocalDriver({...globalDriver});
    if (globalCar && localCar.length === 0) setLocalCar([...globalCar]);
  }, [globalDriver, globalCar]);

  useEffect(() => {
    if (!userId || !testTrack) return;
    const runCalc = async () => {
      setIsSyncing(true);
      try {
        const compoundMap: Record<string, string> = {
            'ExSoft': 'Extra Soft',
            'Soft': 'Soft',
            'Medium': 'Medium',
            'Hard': 'Hard',
            'Rain': 'Rain'
        };

        const res = await fetch('/api/test-calculator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track: testTrack, driver: localDriver, car: localCar, weather, temp: inputs.temp, risk: inputs.risk, pits: inputs.pits,
            tyreSupplier: TYRE_SUPPLIERS[supplierIndex],
            compound: compoundMap[selectedCompound] || selectedCompound,
            stints: testStints, priority
          })
        });
        const data = await res.json();
        if(data.results) setSheetData(data.results);
        if(data.setupIdeal) setSetupIdeal(data.setupIdeal);
      } catch (e) { console.error(e); } finally { setIsSyncing(false); }
    };
    const debounce = setTimeout(runCalc, 600);
    return () => clearTimeout(debounce);
  }, [testTrack, localDriver, localCar, weather, inputs, supplierIndex, selectedCompound, testStints, priority, userId]);

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 animate-fadeIn text-slate-300 pb-24 font-mono max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 backdrop-blur-xl sticky top-4 z-40 shadow-2xl">
        <div className="bg-black/60 rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full md:w-auto">
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="relative group shrink-0">
                  <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full"></div>
                  <div className="w-12 h-8 md:w-16 md:h-10 bg-zinc-900 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative z-10 shadow-lg">
                    {TRACK_FLAGS[testTrack] ? <img src={`/flags/${TRACK_FLAGS[testTrack]}.png`} className="w-full h-full object-cover" /> : <span className="text-xl">🏁</span>}
                  </div>
               </div>
               <div className="flex flex-col w-full md:w-auto">
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Circuito</span>
                 <TrackSelector currentTrack={testTrack} tracksList={tracks} onSelect={setTestTrack} />
               </div>
            </div>
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5 w-full md:w-auto justify-center md:justify-start">
                <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`}></div>
                <span className="text-[9px] font-black uppercase text-slate-400">{isSyncing ? 'Processando...' : 'Sincronizado'}</span>
            </div>
          </div>
          <button onClick={() => { setLocalDriver({...globalDriver}); setLocalCar([...globalCar]); }} className="text-indigo-400 hover:text-white transition-colors flex items-center gap-2 text-[9px] uppercase font-black px-3 py-1.5 border border-indigo-500/20 rounded hover:bg-indigo-500/10"><RotateCcw size={12}/> Resetar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
          <div className="xl:col-span-4 space-y-6">
              {/* PARÂMETROS */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 md:p-6">
                  <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 border-b border-white/5 pb-4 flex items-center gap-2"><Settings size={14} className="text-indigo-500" /> Parâmetros</h2>
                  <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
                      <button onClick={() => setWeather('Dry')} className={`py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${weather === 'Dry' ? 'bg-orange-500 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300'}`}><Sun size={18} /><span className="text-[9px] font-black">DRY</span></button>
                      <button onClick={() => setWeather('Wet')} className={`py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${weather === 'Wet' ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300'}`}><CloudRain size={18} /><span className="text-[9px] font-black">WET</span></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6">
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-indigo-400">Temp</label><input type="number" value={inputs.temp} onChange={e => setInputs({...inputs, temp: Number(e.target.value)})} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-amber-500">Risco</label><input type="number" value={inputs.risk} onChange={e => setInputs({...inputs, risk: Number(e.target.value)})} className="bg-transparent text-amber-500 font-black text-sm w-full outline-none" /></div>
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-emerald-500">Pits</label><input type="number" value={inputs.pits} onChange={e => setInputs({...inputs, pits: Number(e.target.value)})} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
                  </div>
                  <div className="mb-6">
                    <label className="text-[8px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Prioridade</label>
                    <div className="relative"><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-4 pr-10 text-[10px] md:text-[11px] font-black text-white outline-none uppercase cursor-pointer appearance-none hover:bg-white/5 transition-colors">{TEST_PRIORITIES.map(opt => <option key={opt} value={opt} className="bg-[#0F0F13]">{opt.toUpperCase()}</option>)}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                  </div>
                  <div className="mb-6">
                      <div className="bg-black/40 border border-white/10 rounded-xl h-14 flex items-center justify-between px-2 overflow-hidden select-none">
                        <button onClick={() => setSupplierIndex(prev => (prev - 1 + TYRE_SUPPLIERS.length) % TYRE_SUPPLIERS.length)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
                        <div className="flex-1 flex justify-center">
                           <img src={`/tyres/${TYRE_SUPPLIERS[supplierIndex].toLowerCase()}.gif`} alt="supplier" className="h-8 w-auto object-contain drop-shadow-md" />
                        </div>
                        <button onClick={() => setSupplierIndex(prev => (prev + 1) % TYRE_SUPPLIERS.length)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><ChevronRight size={16}/></button>
                      </div>
                  </div>
                  <div className="flex justify-between gap-1 bg-black/20 p-2 md:p-3 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar">
                      {TYRE_COMPOUNDS.map(comp => (
                        <button key={comp.id} onClick={() => setSelectedCompound(comp.id)} className={`relative group transition-all duration-300 shrink-0 ${selectedCompound === comp.id ? 'scale-110 opacity-100' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                           <img src={`/compound/${comp.img}`} alt={comp.label} className={`w-9 h-9 object-contain rounded-full border-[3px] ${selectedCompound === comp.id ? 'border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]' : 'border-transparent'}`} />
                        </button>
                      ))}
                  </div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 md:p-6">
                  <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 border-b border-white/5 pb-4 flex items-center gap-2"><Wrench size={14} className="text-indigo-500" /> Setup Ideal</h2>
                  <div className="space-y-3">{TEST_SETUP_PARTS.map((label, idx) => (<div key={label} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg p-3 hover:border-white/20 transition-colors"><span className="text-xs font-black text-slate-300 uppercase tracking-tight">{label}</span><span className="text-lg font-black text-indigo-400 font-mono">{setupIdeal[idx] ?? '--'}</span></div>))}</div>
              </div>
          </div>

          <div className="xl:col-span-8 space-y-6 md:space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-[#0b0b10] rounded-2xl border border-white/5 p-5 shadow-2xl">
                    <h3 className="text-[10px] font-black text-white uppercase mb-6 pb-4 border-b border-white/5 flex items-center gap-2 tracking-widest"><User size={14} className="text-yellow-400"/> Piloto</h3>
                    <div className="space-y-3">{DRIVER_FIELDS.map(f => (<DriverStatRow key={f.key} label={f.label} value={localDriver[f.key] || 0} max={f.max} onChange={(val:any) => setLocalDriver({...localDriver, [f.key]: val})} />))}</div>
                 </div>
                 <div className="bg-[#0b0b10] rounded-2xl border border-white/5 p-5 shadow-2xl">
                    <h3 className="text-[10px] font-black text-white uppercase mb-6 pb-4 border-b border-white/5 flex items-center gap-2 tracking-widest"><CarFront size={14} className="text-indigo-400"/> Carro</h3>
                    <div className="space-y-1">{CAR_PARTS_LABELS.map((label, i) => (<CarPartRow key={label} label={label} lvl={localCar[i]?.lvl || 1} wear={localCar[i]?.wear || 0} onUpdate={(f:any, v:any) => { const nc = [...localCar]; nc[i] = {...nc[i], [f]: v}; setLocalCar(nc); }} />))}</div>
                 </div>
             </div>

              {/* PLANEJAMENTO MANUAL COM COLUNA FIXA */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                  <div className="bg-white/5 p-4 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
                      <h3 className="font-black text-[10px] uppercase text-white tracking-[0.2em] flex items-center gap-2"><HardHat size={14} className="text-amber-500"/> Planejamento Manual</h3>
                      <div className="bg-black/30 px-3 py-1 rounded border border-white/5 font-black text-[10px] text-indigo-400">{totalLaps} / 100 Voltas</div>
                  </div>
                  
                  {/* Container com scroll horizontal e position relative para o sticky funcionar */}
                  <div className="overflow-x-auto custom-scrollbar relative">
                      <table className="w-full text-[10px] border-separate border-spacing-y-1 min-w-[600px]">
                          <thead>
                              <tr className="text-slate-600 uppercase font-black text-[8px]">
                                  {/* Coluna Sticky - Header */}
                                  <th className="text-left p-3 w-28 sticky left-0 z-20 bg-[#0F0F13] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">Parâmetro</th>
                                  {Array.from({ length: visibleStintsCount }).map((_, i) => (
                                    <th key={i} className={`p-2 text-center transition-colors duration-300 ${lockedStints[i] ? 'text-emerald-400' : ''}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <span>STINT {i + 1}</span>
                                            <button onClick={() => toggleLock(i)} className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all ${lockedStints[i] ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-black/40 text-slate-600 border-white/10 hover:border-white/30 hover:text-white'}`}><Check size={14} strokeWidth={lockedStints[i] ? 4 : 2} /></button>
                                        </div>
                                    </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody>
                              <tr className="bg-white/5 font-black">
                                  {/* Coluna Sticky - Voltas */}
                                  <td className="p-4 text-indigo-400 uppercase sticky left-0 z-20 bg-[#15151a] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">Voltas</td>
                                  {Array.from({ length: visibleStintsCount }).map((_, i) => {
                                      const sk = `s${i+1}`;
                                      return (
                                        <td key={sk} className="p-2 text-center">
                                            <div className="relative flex justify-center">
                                                <input type="number" disabled={lockedStints[i]} value={testStints[sk]} onChange={e => handleStintChange(sk, e.target.value)} onBlur={() => validateMinLaps(sk)} className={`w-14 border rounded p-2 text-center font-black transition-all outline-none ${lockedStints[i] ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400 cursor-not-allowed' : 'bg-black/40 border-white/10 text-white focus:border-amber-500 focus:scale-110'}`} />
                                                {lockedStints[i] && <Lock size={10} className="absolute -top-1 -right-1 text-emerald-500" />}
                                            </div>
                                        </td>
                                      );
                                  })}
                              </tr>
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                  {/* Coluna Sticky - Desgaste */}
                                  <td className="p-4 text-slate-500 uppercase flex items-center gap-2 sticky left-0 z-20 bg-[#0c0c10] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"><Activity size={12} /> Desgaste Total</td>
                                  {Array.from({ length: visibleStintsCount }).map((_, i) => {
                                      const data = lockedStints[i] ? frozenResults[i] : sheetData[i];
                                      return (<td key={i} className={`p-2 text-center font-black text-lg transition-colors ${lockedStints[i] ? 'text-emerald-400' : 'text-rose-500'}`}>{typeof data?.wear === 'number' ? `${data.wear.toFixed(1)}%` : '-'}</td>)
                                  })}
                              </tr>
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                  {/* Coluna Sticky - Combustível */}
                                  <td className="p-4 text-slate-500 uppercase flex items-center gap-2 sticky left-0 z-20 bg-[#0c0c10] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"><Fuel size={12} /> Combustível Total</td>
                                  {Array.from({ length: visibleStintsCount }).map((_, i) => {
                                      const data = lockedStints[i] ? frozenResults[i] : sheetData[i];
                                      return (<td key={i} className={`p-2 text-center font-black text-lg transition-colors ${lockedStints[i] ? 'text-emerald-400' : 'text-cyan-400'}`}>{typeof data?.fuel === 'number' ? `${data.fuel.toFixed(1)}L` : '-'}</td>)
                                  })}
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}