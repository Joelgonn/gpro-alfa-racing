'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; 
import { useGame } from '../../context/GameContext'; 
import {
  Loader2, MapPin, ChevronDown, Search, X, ShieldCheck,
  Settings, Sun, CloudRain, ChevronLeft, ChevronRight, Zap, Timer, 
  User, CarFront, Wrench, HardHat, Fuel, Activity, Check, Lock, RotateCcw, ShieldAlert, Database, ArrowRight, Target,
  Gauge, CornerDownLeft, MoveRight, ChevronsUp, GitMerge, SlidersHorizontal, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONSTANTES ---
const TRACK_FLAGS: { [key: string]: string } = { "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be" };

const TYRE_SUPPLIERS = ["Pipirelli", "Avonn", "Yokomama", "Dunnolop", "Contimental", "Hancock", "Badyear", "Michelini", "Bridgerock"];

const TYRE_COMPOUNDS = [
  { id: 'ExSoft', label: 'Extra Soft', img: 'super macio.png' },
  { id: 'Soft', label: 'Soft', img: 'macio.png' },
  { id: 'Medium', label: 'Medium', img: 'medio.png' },
  { id: 'Hard', label: 'Hard', img: 'duro.png' },
  { id: 'Rain', label: 'Rain', img: 'chuva.png' },
];

const COMPOUND_DISPLAY_NAMES: Record<string, string> = {
    'ExSoft': 'X Macio',
    'Soft': 'Macio',
    'Medium': 'Médio',
    'Hard': 'Duro',
    'Rain': 'Chuva'
};

const TEST_PRIORITIES = ["Nenhuma prioridade em especial", "Velocidade máxima", "Fazer curvas", "Cotovelos", "Frear", "Ultrapassagem", "Chicanes", "Testar os limites do carro", "Afinação do ajuste"];

const PRIORITY_ICONS: Record<string, any> = {
    "Nenhuma prioridade em especial": Target,
    "Velocidade máxima": Zap,
    "Fazer curvas": CornerDownLeft,
    "Cotovelos": MoveRight,
    "Frear": ChevronsUp,
    "Ultrapassagem": ArrowRight,
    "Chicanes": GitMerge,
    "Testar os limites do carro": Gauge,
    "Afinação do ajuste": SlidersHorizontal
};

const COMPONENTS = [ 
    { id: 'chassi', label: 'Chassi' }, { id: 'motor', label: 'Motor' }, { id: 'asaDianteira', label: 'Asa Dianteira' }, { id: 'asaTraseira', label: 'Asa Traseira' }, { id: 'assoalho', label: 'Assoalho' }, { id: 'laterais', label: 'Laterais' }, { id: 'radiador', label: 'Radiador' }, { id: 'cambio', label: 'Câmbio' }, { id: 'freios', label: 'Freios' }, { id: 'suspensao', label: 'Suspensão' }, { id: 'eletronicos', label: 'Eletrônicos' } 
];
const DRIVER_FIELDS = [
  { key: 'energia', label: 'Energia', max: 100 }, { key: 'concentracao', label: 'Concentração' }, { key: 'talento', label: 'Talento' }, { key: 'agressividade', label: 'Agressividade' }, { key: 'experiencia', label: 'Experiência', max: 500 }, { key: 'tecnica', label: 'Técnica' }, { key: 'resistencia', label: 'Resistência' }, { key: 'carisma', label: 'Carisma' }, { key: 'motivacao', label: 'Motivação' }, { key: 'reputacao', label: 'Reputação' }, { key: 'peso', label: 'Peso (kg)', max: 100 }, { key: 'idade', label: 'Idade', max: 50 }
];
const TEST_SETUP_PARTS = ['Asa Dianteira', 'Asa Traseira', 'Motor', 'Freios', 'Câmbio', 'Suspensão'];

const PRIORITY_MULTIPLIERS: Record<string, { P: number, D: number, A: number }> = {
    "Nenhuma prioridade em especial": { P: 0.265, D: 0.265, A: 0.265 },
    "Velocidade máxima": { P: 0.645, D: 0.081, A: 0.081 },
    "Fazer curvas": { P: 0.081, D: 0.645, A: 0.081 },
    "Cotovelos": { P: 0.081, D: 0.081, A: 0.645 },
    "Frear": { P: 0.202, D: 0.404, A: 0.202 },
    "Ultrapassagem": { P: 0.404, D: 0.202, A: 0.202 },
    "Chicanes": { P: 0.202, D: 0.202, A: 0.404 },
    "Testar os limites do carro": { P: 0.02, D: 0.02, A: 0.02 },
    "Afinação do ajuste": { P: 0.02, D: 0.02, A: 0.02 }
};

// --- HELPERS ---

/**
 * Mapeia o clima bruto da API GPRO para o formato interno Dry/Wet
 * 
 * @param weatherRaw - String do clima vinda da API (ex: "Sunny", "Partially Cloudy", "Rain")
 * @returns 'Dry' | 'Wet' - Clima mapeado para o sistema interno
 * 
 * Regras de mapeamento:
 * - "Rain" → "Wet"
 * - "Rainy" → "Wet"  
 * - "Wet" → "Wet"
 * - Qualquer outro valor → "Dry" (inclui "Sunny", "Partially Cloudy", "Cloudy", etc.)
 */
function mapTestingWeather(weatherRaw: string): 'Dry' | 'Wet' {
  if (!weatherRaw) return 'Dry';
  
  const normalized = weatherRaw.trim().toLowerCase();

  if (
    normalized === 'rain' ||
    normalized === 'rainy' ||
    normalized === 'wet'
  ) {
    return 'Wet';
  }

  return 'Dry';
}

/**
 * Valida se um valor pode ser convertido para número finito
 * Usado para validar temperatura vinda da API
 */
function isValidNumber(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (value === '') return false;
  return Number.isFinite(Number(value));
}

// --- COMPONENTES AUXILIARES ---

function PrioritySelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const CurrentIcon = PRIORITY_ICONS[value] || Target;

    return (
        <div className="relative w-full z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center justify-between bg-black/40 border border-white/10 rounded-xl py-3 px-3.5 text-[10px] font-black text-white outline-none uppercase active:bg-white/5 transition-all hover:border-white/20 group"
            >
                <div className="flex items-center gap-2.5 truncate">
                    <CurrentIcon size={13} className="text-indigo-400 group-hover:text-white transition-colors" />
                    <span className="truncate">{value.toUpperCase()}</span>
                </div>
                <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 5, scale: 0.98 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, y: 5, scale: 0.98 }} 
                        className="absolute top-full left-0 mt-2 w-full bg-[#15151a] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar ring-1 ring-white/5 overscroll-contain"
                    >
                        {TEST_PRIORITIES.map(opt => {
                            const Icon = PRIORITY_ICONS[opt] || Target;
                            return (
                                <button 
                                    key={opt} 
                                    onClick={() => { onChange(opt); setIsOpen(false); }} 
                                    className={`w-full text-left px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-2.5 transition-colors ${value === opt ? 'bg-indigo-600/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <Icon size={13} className={value === opt ? 'text-indigo-400' : 'text-slate-600'} />
                                    {opt}
                                    {value === opt && <Check size={11} className="ml-auto text-indigo-400" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TrackSelector({ currentTrack, tracksList, onSelect }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    
    const filteredTracks = useMemo(() => tracksList.filter((t: any) => {
        const name = typeof t === 'object' ? (t.name || "") : (t || "");
        return name.toLowerCase().includes(search.toLowerCase());
    }), [tracksList, search]);

    return (
        <div className="relative z-50 w-full md:w-auto">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 text-[11px] text-white font-black tracking-wider bg-black/40 px-3.5 py-2 rounded-xl border border-white/10 uppercase outline-none active:scale-95 transition-transform">
                <span className="truncate">
                    {currentTrack || "SELECIONAR PISTA"}
                </span> 
                <ChevronDown size={14} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-full md:w-64 bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden">
                        <div className="p-3 border-b border-white/5">
                            <input autoFocus type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-[10px] text-white outline-none focus:border-indigo-500" />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                            {filteredTracks.map((t: any) => {
                                const name = typeof t === 'object' ? t.name : t;
                                return (
                                    <button 
                                        key={name} 
                                        onClick={() => { 
                                            const trackName = typeof t === 'object' ? t.name : t;
                                            onSelect(trackName); 
                                            setIsOpen(false); 
                                        }} 
                                        className="w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-3"
                                    >
                                        {TRACK_FLAGS[name] && <img src={`/flags/${TRACK_FLAGS[name]}.png`} className="w-5 h-3.5 object-cover rounded-sm" alt="flag"/>}
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DriverStatRow({ label, value, onChange, max = 250 }: any) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="flex items-center gap-2.5 h-7 w-full">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase w-16 md:w-20 truncate shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5 relative min-w-0">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-300" style={{ width: `${percentage}%` }}></div>
            </div>
            <input 
                type="number" 
                value={value} 
                onChange={(e) => onChange(Number(e.target.value))} 
                onFocus={(e) => e.target.select()}
                className="w-10 shrink-0 h-7 text-center bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold text-white outline-none focus:border-indigo-500 transition-colors" 
            />
        </div>
    );
}

function SkyViewRainOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const handleResize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
    };
    handleResize();

    const dropCount = 350;
    const rainColor = '79, 195, 247'; 
    const speed = 0.03; 

    const drops: any[] = [];
    const resetDrop = (d: any) => {
      d.x = (Math.random() - 0.5) * 2;
      d.y = (Math.random() - 0.5) * 2;
      d.z = 1; 
      d.size = Math.random() * 4 + 1;
    };

    for (let i = 0; i < dropCount; i++) {
      drops.push({});
      resetDrop(drops[i]);
      drops[i].z = Math.random() * 4 + 1; 
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      for (let i = 0; i < dropCount; i++) {
        const d = drops[i];
        d.z += speed; 

        if (d.z > 5) resetDrop(d);

        const perspective = 1 / d.z;
        const x = cx + d.x * w * perspective;
        const y = cy + d.y * h * perspective;

        const pPrev = 1 / (d.z - 0.1);
        const xPrev = cx + d.x * w * pPrev;
        const yPrev = cy + d.y * h * pPrev;

        const alpha = (5 - d.z) / 4 * 0.3;

        if (alpha > 0) {
          ctx.strokeStyle = `rgba(${rainColor}, ${alpha})`;
          ctx.lineWidth = d.size * perspective * 1.5;
          ctx.beginPath();
          ctx.moveTo(xPrev, yPrev);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    };

    const animFrame = requestAnimationFrame(draw);
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

export default function TestsPage() {
  const router = useRouter(); 
  
  const { 
      driver: globalDriver, 
      car: globalCar, 
      techDirector, 
      staffFacilities, 
      desgasteModifier,
      isGlobalLoading,
      isDataSynced
  } = useGame();
  
  const [tracks, setTracks] = useState<string[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('Gerente');

  // --- ESTADOS DE TESTE ---
  const [testTrack, setTestTrack] = useState<string>("Adelaide");
  
  // Clima bruto da API (preserva valor original do GPRO)
  const [testWeatherRaw, setTestWeatherRaw] = useState<string>("");
  
  // Clima mapeado para o sistema interno (Dry/Wet)
  const [weather, setWeather] = useState<'Dry' | 'Wet'>('Dry');
  
  const [localDriver, setLocalDriver] = useState<any>({});
  const [localCar, setLocalCar] = useState<any[]>([]);
  const [inputs, setInputs] = useState({ temp: 24.4, risk: 80, pits: 1 });
  const [priority, setPriority] = useState(TEST_PRIORITIES[0]); 
  const [supplierIndex, setSupplierIndex] = useState(0);
  const [selectedCompound, setSelectedCompound] = useState('Soft');
  
  const [testStints, setTestStints] = useState<any>({ s1: 10, s2: '', s3: '', s4: '', s5: '', s6: '', s7: '', s8: '' });
  const [sheetData, setSheetData] = useState<any[]>(Array(8).fill({ wear: 0, fuel: 0 }));
  const [setupIdeal, setSetupIdeal] = useState<any[]>(Array(6).fill('--'));

  const [partWearDetails, setPartWearDetails] = useState<any>(null);
  const [lockedStints, setLockedStints] = useState<Record<number, boolean>>({});
  const [frozenResults, setFrozenResults] = useState<any[]>(Array(8).fill(null));

  const [stintHistory, setStintHistory] = useState<Record<number, { wear: Record<string, number>, points: { P: number, D: number, A: number } }>>({});

  const isContextValid = useMemo(() => {
    const driverOk = globalDriver && typeof globalDriver.talento === 'number' && globalDriver.talento > 0;
    const carOk = Array.isArray(globalCar) && globalCar.length >= 11 && globalCar[0].lvl > 0;
    return driverOk && carOk;
  }, [globalDriver, globalCar]);

  const isSetupMissing = useMemo(() => {
    return setupIdeal.some(val => val === '--');
  }, [setupIdeal]);

  const totalLaps = useMemo(() => Object.values(testStints).reduce((acc: number, val) => acc + (Number(val) || 0), 0), [testStints]);

  const activePlannedLaps = useMemo(() => {
      return Object.entries(testStints).reduce((acc: number, [key, val]) => {
          const index = parseInt(key.replace('s', '')) - 1;
          if (lockedStints[index]) return acc;
          return acc + (Number(val) || 0);
      }, 0);
  }, [testStints, lockedStints]);

  const lockedPointsTotal = useMemo(() => {
      let P = 0, D = 0, A = 0;
      Object.values(stintHistory).forEach(history => {
          P += history.points.P;
          D += history.points.D;
          A += history.points.A;
      });
      return { P, D, A };
  }, [stintHistory]);

  const toggleLock = (index: number) => {
    const isLocked = lockedStints[index];
    
    if (!isLocked) {
        const newFrozen = [...frozenResults];
        newFrozen[index] = { ...sheetData[index] };
        setFrozenResults(newFrozen);

        const laps = Number(testStints[`s${index + 1}`]) || 0;
        const pdaMult = PRIORITY_MULTIPLIERS[priority] || PRIORITY_MULTIPLIERS["Nenhuma prioridade em especial"];
        const generatedPoints = {
            P: laps * pdaMult.P,
            D: laps * pdaMult.D,
            A: laps * pdaMult.A
        };

        if (partWearDetails) {
            const addedWearForThisStint: Record<string, number> = {};
            const updatedCar = localCar.map((carPart, i) => {
                const comp = COMPONENTS[i];
                if (comp) {
                    const details = partWearDetails[comp.id];
                    if (details && details.test_wear !== undefined) {
                        const wearToAdd = details.test_wear;
                        addedWearForThisStint[comp.id] = wearToAdd; 
                        const novoDesgasteAtual = carPart.wear + wearToAdd;
                        return { ...carPart, wear: parseFloat(novoDesgasteAtual.toFixed(1)) };
                    }
                }
                return carPart;
            });
            setStintHistory(prev => ({ ...prev, [index]: { wear: addedWearForThisStint, points: generatedPoints } }));
            setLocalCar(updatedCar); 
        }
    } else {
        const history = stintHistory[index];
        if (history) {
            const updatedCar = localCar.map((carPart, i) => {
                const comp = COMPONENTS[i];
                if (comp && history.wear[comp.id] !== undefined) {
                    const restoredWear = Math.max(0, carPart.wear - history.wear[comp.id]);
                    return { ...carPart, wear: parseFloat(restoredWear.toFixed(1)) };
                }
                return carPart;
            });
            setLocalCar(updatedCar);
            const newHistory = { ...stintHistory };
            delete newHistory[index];
            setStintHistory(newHistory);
        }
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

  const hasTestingLimitWarning = useMemo(() => {
      if (!partWearDetails) return false;
      return Object.values(partWearDetails).some((part: any) => part.pre_race && part.pre_race > 90.4);
  }, [partWearDetails]);

  const handleResetTests = () => {
      if (!isContextValid) return;
      setLocalDriver({...globalDriver}); 
      setLocalCar(globalCar.map(p => ({...p}))); 
      setTestStints({ s1: 10, s2: '', s3: '', s4: '', s5: '', s6: '', s7: '', s8: '' });
      setLockedStints({});
      setFrozenResults(Array(8).fill(null));
      setStintHistory({});
  };
  
  const handleResetPlanner = () => {
      if (!isContextValid) return;
      setLocalCar(globalCar.map(p => ({...p}))); 
      setTestStints({ s1: 10, s2: '', s3: '', s4: '', s5: '', s6: '', s7: '', s8: '' });
      setLockedStints({});
      setFrozenResults(Array(8).fill(null));
      setStintHistory({});
  };

  useEffect(() => {
    if (globalDriver && globalDriver.talento > 0) {
        if (!localDriver.talento || localDriver.talento === 0) setLocalDriver({...globalDriver});
    }
    if (globalCar && globalCar.length > 0) {
        const isLocalEmpty = localCar.length === 0;
        const isLocalStale = localCar.length > 0 && (localCar[0].lvl <= 1 && localCar[0].wear === 0) && (globalCar[0].lvl > 1 || globalCar[0].wear > 0 || globalCar[1].wear > 0);
        if (isLocalEmpty || isLocalStale) {
            const deepCopy = globalCar.map(part => ({ ...part }));
            setLocalCar(deepCopy);
        }
    }
  }, [globalDriver, globalCar, isDataSynced, localDriver, localCar]);

  useEffect(() => {
    if (priority === "Testar os limites do carro") setInputs(prev => ({ ...prev, risk: 100 }));
    else setInputs(prev => ({ ...prev, risk: 80 }));
  }, [priority]);

  // --- EFFECT 1: AUTH E TRACKS ---
  useEffect(() => {
    let mounted = true;

    // 1. Autenticação
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      if (!session) {
        router.push('/login');
        return;
      }

      setUserId(session.user.id);
      if(session.user.email) setUserEmail(session.user.email);
      setIsAuthLoading(false);
    });

    // 2. Lista de pistas
    fetch('/api/python?action=tracks')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        setTracks(data.tracks || []);
      })
      .catch(err => {
        if (!mounted) return;
        console.warn('Erro ao carregar pistas:', err);
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  // --- EFFECT 2: CARREGAR DADOS DE TESTE DO GPRO ---
  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const loadTestingData = async () => {
      try {
        const response = await fetch('/api/gpro/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        
        const data = await response.json();
        
        if (!mounted) return;
        
        if (data.success && data.testing) {
          // Atualiza pista de teste (sempre com fallback)
          setTestTrack(data.testing.track || 'Adelaide');
          
          // Preserva o clima bruto da API (sempre atualiza, mesmo se for vazio)
          setTestWeatherRaw(data.testing.weather || '');
          
          // Mapeia o clima para o formato interno (Dry/Wet)
          setWeather(mapTestingWeather(data.testing.weather || ''));
          
          // Atualiza temperatura com validação robusta
          if (isValidNumber(data.testing.temp)) {
            setInputs(prev => ({
              ...prev,
              temp: Number(data.testing.temp)
            }));
          }
        } else {
          // Se não tiver dados de teste, limpa os estados
          setTestWeatherRaw('');
          setWeather('Dry');
        }
      } catch (error) {
        if (!mounted) return;
        console.warn('⚠️ Não foi possível carregar dados de testes do GPRO:', error);
        // Mantém valores padrão (Adelaide, Dry, 24.4°C)
        setTestWeatherRaw('');
        setWeather('Dry');
      }
    };

    loadTestingData();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const runCalculations = useCallback(async () => {
    if (!userId || !testTrack || !isContextValid || !isDataSynced) return;

    setIsSyncing(true);
    try {
        const compoundMap: Record<string, string> = { 'ExSoft': 'Extra Soft', 'Soft': 'Soft', 'Medium': 'Medium', 'Hard': 'Hard', 'Rain': 'Rain' };

        const resTest = await fetch('/api/test-calculator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                track: testTrack, driver: localDriver, car: localCar, weather, temp: inputs.temp, risk: inputs.risk, pits: inputs.pits,
                tyreSupplier: TYRE_SUPPLIERS[supplierIndex], compound: compoundMap[selectedCompound] || selectedCompound,
                stints: testStints, priority 
            })
        });
        const dataTest = await resTest.json();
        if(dataTest.results) setSheetData(dataTest.results);
        if(dataTest.setupIdeal) setSetupIdeal(dataTest.setupIdeal); 

        const resParts = await fetch('/api/python?action=test_calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify({ 
                test_track: testTrack, 
                test_laps: activePlannedLaps, 
                driver: localDriver, 
                car: localCar, 
                tech_director: techDirector,
                staff_facilities: staffFacilities,
                desgasteModifier
            })
        });
        const dataParts = await resParts.json();
        if (dataParts.sucesso) setPartWearDetails(dataParts.data);

    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  }, [userId, testTrack, localDriver, localCar, weather, inputs, supplierIndex, selectedCompound, testStints, priority, activePlannedLaps, techDirector, staffFacilities, desgasteModifier, isContextValid, isDataSynced]);

  useEffect(() => {
    const debounce = setTimeout(runCalculations, 600);
    return () => clearTimeout(debounce);
  }, [runCalculations]);

  const getWearColor = (val: number) => {
    if(val > 90.4) return 'text-rose-500 font-black';
    if(val > 80) return 'text-amber-400';
    return 'text-emerald-400';
  };

  if (isAuthLoading || isGlobalLoading) {
    return (
        <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#020204] text-indigo-500 font-mono text-xs gap-4">
            <div className="w-12 h-12 border-2 border-indigo-500/10 rounded-full flex items-center justify-center relative">
                <div className="w-12 h-12 border-2 border-t-indigo-500 rounded-full animate-spin absolute" />
                <Settings size={16} className="animate-pulse text-indigo-400" />
            </div>
            <span className="tracking-widest uppercase">CARREGANDO TESTES...</span>
        </div>
    );
  }

  if (!isDataSynced) {
    return (
        <div className="flex flex-col h-screen items-center justify-center bg-[#020204] text-slate-300 p-6 relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
            </div>
            <div className="relative z-10 max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
                <div className="mx-auto w-16 h-16 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <Database size={24} className="text-amber-500" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Sincronização Necessária</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8 px-4">
                    Os dados do Piloto e Carro não foram encontrados na sua base de dados. <br/>
                    Acesse a Visão Geral para inicializar sua equipe.
                </p>
                <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(79,70,229,0.2)] hover:shadow-[0_10px_30px_rgba(79,70,229,0.4)] group">
                    <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                    Ir para Visão Geral e Sincronizar
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020204] text-slate-300 font-mono pb-24 md:pb-12 selection:bg-indigo-500/30 relative overflow-hidden">
      
      {/* ==========================================
          FUNDO AMBIENTAL COM GRADIENTES
          ========================================== */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 blur-[150px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
      </div>
      
      {/* EFEITO DE CHUVA */}
      <AnimatePresence>
        {weather === "Wet" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
                <SkyViewRainOverlay /> 
            </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER COM GRADIENTE E CIRCUITO ATUAL */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#020204]/90 p-3 sm:p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <Settings size={14} className="text-white" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                Testes & Simulação
                <span className="text-[7px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{userEmail}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* CIRCUITO ATUAL */}
            <div className="flex items-center gap-2 border-r border-white/5 pr-4">
              <div className="w-8 h-6 bg-zinc-900 border border-white/10 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {testTrack && TRACK_FLAGS[testTrack] ? <img src={`/flags/${TRACK_FLAGS[testTrack]}.png`} alt={testTrack} className="w-full h-full object-cover" /> : <span className="text-xs">🏁</span>}
              </div>
              <div className="flex flex-col">
                <span className="text-[6px] text-slate-500 font-black uppercase tracking-widest leading-none">Circuito</span>
                <TrackSelector currentTrack={testTrack} tracksList={tracks} onSelect={setTestTrack} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                <span className={`text-[9px] font-bold ${isSyncing ? 'text-amber-500' : 'text-emerald-400'}`}>
                  {isSyncing ? 'CALCULANDO' : 'PRONTO'}
                </span>
              </div>
              
              <div className="text-right border-l border-white/5 pl-3">
                <p className="text-[7px] text-slate-500 uppercase font-black tracking-widest leading-none mb-0.5">Temp. Pista</p>
                <p className="text-lg font-black text-indigo-400 leading-none">{inputs.temp || '--'}°C</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10">
        
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 items-stretch w-full">
              
              {/* COLUNA 1: CONFIGURAÇÕES DE TESTE COM GRADIENTE */}
              <div className="space-y-6 flex flex-col w-full min-w-0">
                <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl backdrop-blur-sm group flex-1 flex flex-col justify-between">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-3 border-b border-white/5">
                        <h2 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                                <Settings size={13} className="text-white" />
                            </div>
                            Configuração
                        </h2>
                    </div>
                    
                    {/* Removido overflow-hidden daqui, agora o dropdown do PrioritySelector pode expandir */}
                    <div className="relative p-4 w-full">
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                            <button onClick={() => setWeather('Dry')} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${weather === 'Dry' ? 'bg-gradient-to-br from-orange-500 to-amber-600 border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 active:bg-white/5'}`}>
                                <Sun size={18} />
                                <span className="text-[9px] font-black tracking-wider">SECO</span>
                            </button>
                            <button onClick={() => setWeather('Wet')} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${weather === 'Wet' ? 'bg-gradient-to-br from-indigo-500 to-blue-600 border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 active:bg-white/5'}`}>
                                <CloudRain size={18} />
                                <span className="text-[9px] font-black tracking-wider">CHUVA</span>
                            </button>
                        </div>

                        {/* Badge de clima bruto da API - visível quando há dados */}
                        {testWeatherRaw && (
                            <div className="flex justify-center mb-4">
                                <div className="bg-black/60 border border-white/10 rounded-full px-2.5 py-0.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Info size={11} className="text-indigo-400" />
                                        Clima GPRO: <span className="text-white">{testWeatherRaw}</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2.5 mb-5">
                            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex flex-col justify-center items-center group"><label className="text-[8px] font-black text-slate-500 uppercase block mb-0.5">Temp</label><input type="number" value={inputs.temp} onChange={e => setInputs({...inputs, temp: Number(e.target.value)})} onFocus={(e) => e.target.select()} className="bg-transparent text-white font-black text-sm w-full text-center outline-none" /></div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex flex-col justify-center items-center group"><label className="text-[8px] font-black text-slate-500 uppercase block mb-0.5">Risco</label><input type="number" value={inputs.risk} onChange={e => setInputs({...inputs, risk: Number(e.target.value)})} onFocus={(e) => e.target.select()} className="bg-transparent text-amber-500 font-black text-sm w-full text-center outline-none" /></div>
                            <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 flex flex-col justify-center items-center group"><label className="text-[8px] font-black text-slate-500 uppercase block mb-0.5">Pits</label><input type="number" value={inputs.pits} onChange={e => setInputs({...inputs, pits: Number(e.target.value)})} onFocus={(e) => e.target.select()} className="bg-transparent text-emerald-400 font-black text-sm w-full text-center outline-none" /></div>
                        </div>

                        {/* PRIORIDADE - AGORA O DROPDOWN PODE EXPANDIR LIVREMENTE */}
                        <div className="mb-5 w-full relative z-50">
                            <label className="text-[8px] font-black text-slate-500 uppercase mb-1.5 block tracking-widest">Prioridade do Teste</label>
                            <div className="relative w-full">
                                <PrioritySelector value={priority} onChange={setPriority} />
                            </div>
                        </div>

                        <div className="mb-5 w-full">
                            <div className="bg-black/40 border border-white/10 rounded-2xl h-14 flex items-center justify-between px-2 overflow-hidden select-none">
                                <button onClick={() => setSupplierIndex(prev => (prev - 1 + TYRE_SUPPLIERS.length) % TYRE_SUPPLIERS.length)} className="p-2 active:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><ChevronLeft size={18}/></button>
                                <div className="flex-1 flex justify-center"><img src={`/tyres/${TYRE_SUPPLIERS[supplierIndex].toLowerCase()}.gif`} alt="supplier" className="h-9 w-auto object-contain drop-shadow-md" /></div>
                                <button onClick={() => setSupplierIndex(prev => (prev + 1) % TYRE_SUPPLIERS.length)} className="p-2 active:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><ChevronRight size={18}/></button>
                            </div>
                        </div>

                        <div className="w-full flex items-center gap-2.5 bg-black/20 p-2.5 rounded-2xl border border-white/5 overflow-x-auto snap-x custom-scrollbar pb-2.5 min-w-0">
                            {TYRE_COMPOUNDS.map(comp => (
                                <button key={comp.id} onClick={() => setSelectedCompound(comp.id)} className={`relative flex flex-col items-center gap-1.5 snap-center shrink-0 transition-all duration-300 ${selectedCompound === comp.id ? 'scale-110 opacity-100' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0 active:scale-95'}`}>
                                    <img src={`/compound/${comp.img}`} alt={comp.label} className={`w-11 h-11 md:w-12 md:h-12 object-contain rounded-full border-[2.5px] ${selectedCompound === comp.id ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'border-transparent'}`} />
                                    <span className={`text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${selectedCompound === comp.id ? 'text-indigo-400 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]' : 'text-slate-500'}`}>
                                        {COMPOUND_DISPLAY_NAMES[comp.id]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {isSetupMissing && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mt-1 mx-4 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-2.5">
                            <div className="flex items-start gap-2.5">
                                <div className="bg-amber-500/20 p-1.5 rounded-lg text-amber-500 shrink-0"><ShieldAlert size={16} /></div>
                                <div>
                                    <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Calculando Setup... Aguarde!</h4>
                                    <p className="text-[9px] text-slate-400 leading-tight mt-0.5"> Atualizando dados 'Piloto' e 'Carro' da página de visão geral.</p>
                                </div>
                            </div>
                            <button onClick={() => router.push('/dashboard/setup')} className="w-full bg-amber-500 active:bg-amber-600 text-[#0F0F13] font-black text-[9px] uppercase py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg">
                                <Wrench size={13} /> Página de Visão Geral
                            </button>
                        </motion.div>
                    )}
                </section>
            </div>

              {/* COLUNA 2: ATRIBUTOS DO PILOTO COM GRADIENTE */}
              <div className="space-y-6 flex flex-col w-full min-w-0">
                 <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group flex-1 flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="relative bg-gradient-to-r from-yellow-500/10 to-amber-500/10 p-3 border-b border-white/5">
                        <h3 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                            <div className="p-1.5 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg">
                                <User size={13} className="text-white" />
                            </div>
                            Atributos Piloto
                        </h3>
                    </div>
                    <div className="relative p-4 w-full">
                        <div className="flex flex-col gap-y-3 md:gap-y-3.5 pt-1 w-full">
                            {DRIVER_FIELDS.map(f => (
                                <DriverStatRow key={f.key} label={f.label} value={localDriver[f.key] || 0} max={f.max} onChange={(val:any) => setLocalDriver({...localDriver, [f.key]: val})} />
                            ))}
                        </div>
                    </div>
                 </section>
              </div>

              {/* COLUNA 3: DESGASTE CARRO E TOTAL DE PONTOS PDA COM GRADIENTE - CARDS COMPACTOS */}
              <div className="space-y-6 flex flex-col w-full min-w-0">
                 <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group flex-1 flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="relative bg-gradient-to-r from-rose-500/10 to-red-500/10 p-2.5 border-b border-white/5">
                        <div className="flex flex-col items-start gap-1">
                            <h3 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2 bg-gradient-to-r from-rose-400 to-red-400 bg-clip-text text-transparent">
                                <div className="p-1.5 bg-gradient-to-br from-rose-500 to-red-500 rounded-lg">
                                    <CarFront size={13} className="text-white" />
                                </div>
                                Desgaste Pós-Teste
                            </h3>
                            <AnimatePresence>
                                {hasTestingLimitWarning && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex w-full items-center justify-center gap-2 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 mt-0.5">
                                        <ShieldAlert size={13} className="text-rose-500 animate-pulse" />
                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Limite Excedido (+90.4%)</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    
                    <div className="relative p-2.5 flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1 max-h-[500px]">
                        <div className="hidden md:flex items-center justify-between px-2 pb-1 text-[7px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                            <span className="w-1/3">Peça</span>
                            <div className="flex gap-2 w-2/3 justify-end text-center">
                                <span className="w-8">Nível</span>
                                <span className="w-8">Atual</span>
                                <span className="w-10 text-amber-500">Teste</span>
                                <span className="w-10">Final</span>
                            </div>
                        </div>

                        {COMPONENTS.map((part, i) => {
                            const lvl = localCar[i]?.lvl || 1;
                            const currentWear = localCar[i]?.wear || 0;
                            const testWear = partWearDetails ? partWearDetails[part.id]?.test_wear : 0;
                            const finalWear = currentWear + testWear; 
                            const isBroken = finalWear > 90.4;

                            return (
                                <div key={part.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-1.5 p-2 rounded-xl border transition-colors w-full ${isBroken ? 'bg-rose-500/10 border-rose-500/20' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                                    <div className="flex justify-between items-center md:w-1/3">
                                        <span className={`text-[8px] md:text-[9px] font-black uppercase ${isBroken ? 'text-rose-400' : 'text-slate-300'}`}>{part.label}</span>
                                        <span className="md:hidden text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">+{testWear.toFixed(1)}%</span>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-1.5 md:gap-2 md:w-2/3">
                                        <div className="flex flex-col items-center">
                                            <span className="md:hidden text-[6px] font-black text-slate-500 uppercase mb-0.5">Lvl</span>
                                            <input type="number" value={lvl} onChange={(e) => { const nc = [...localCar]; nc[i] = {...nc[i], lvl: Number(e.target.value)}; setLocalCar(nc); }} onFocus={(e) => e.target.select()} className="w-8 bg-[#0F0F13] border border-white/10 rounded-lg text-center py-0.5 text-[9px] font-bold text-slate-300 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="md:hidden text-[6px] font-black text-slate-500 uppercase mb-0.5">Atual</span>
                                            <input type="number" value={currentWear} onChange={(e) => { const nc = [...localCar]; nc[i] = {...nc[i], wear: Number(e.target.value)}; setLocalCar(nc); }} onFocus={(e) => e.target.select()} className="w-8 bg-[#0F0F13] border border-white/10 rounded-lg text-center py-0.5 text-[9px] font-bold text-emerald-400 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="hidden md:flex flex-col items-center w-10 text-center">
                                            <span className="text-[9px] text-amber-500 font-black">+{testWear.toFixed(1)}</span>
                                        </div>
                                        <div className="flex flex-col items-center bg-[#0F0F13]/50 px-2 py-0.5 rounded-lg border border-white/5 w-12">
                                            <span className="md:hidden text-[6px] font-black text-slate-500 uppercase mb-0.5">Final</span>
                                            <span className={`text-[9px] md:text-[10px] font-black ${getWearColor(finalWear)}`}>{finalWear.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="relative bg-[#0F0F13] border-t border-white/5 p-2.5 shrink-0 flex items-center justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                                <Target size={11} /> Pontos Adquiridos
                            </span>
                            <span className="text-[7px] text-slate-500 font-black uppercase">Acumulado da Sessão</span>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="flex flex-col items-center bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 w-11">
                                <span className="text-[7px] font-black text-slate-500 uppercase mb-0.5">P</span>
                                <span className="text-[9px] font-black text-rose-500">{lockedPointsTotal.P.toFixed(1)}</span>
                            </div>
                            <div className="flex flex-col items-center bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 w-11">
                                <span className="text-[7px] font-black text-slate-500 uppercase mb-0.5">D</span>
                                <span className="text-[9px] font-black text-cyan-400">{lockedPointsTotal.D.toFixed(1)}</span>
                            </div>
                            <div className="flex flex-col items-center bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 w-11">
                                <span className="text-[7px] font-black text-slate-500 uppercase mb-0.5">A</span>
                                <span className="text-[9px] font-black text-yellow-400">{lockedPointsTotal.A.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                 </section>
              </div>
          </div>

          {/* SETUP HORIZONTAL COM GRADIENTE */}
          <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-2.5 border-b border-white/5">
                  <h2 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                          <Wrench size={13} className="text-white" />
                      </div>
                      Setup Ideal Estimado
                  </h2>
              </div>
              <div className="relative p-3.5">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 w-full">
                      {TEST_SETUP_PARTS.map((label, idx) => (
                          <div key={label} className="flex flex-col items-center justify-center gap-1 bg-black/40 border border-white/5 rounded-2xl p-2.5 active:scale-95 transition-transform group w-full">
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center">{label}</span>
                              <span className="text-lg md:text-xl font-black text-emerald-400 font-mono drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{setupIdeal[idx] ?? '--'}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </section>

          {/* PLANEJAMENTO DE STINTS COM GRADIENTE */}
          <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <div className="relative bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-2.5 border-b border-white/5">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
                      <h3 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                          <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                              <HardHat size={13} className="text-white" />
                          </div>
                          Planner de Stints
                      </h3>
                      <div className="flex items-center gap-2.5 w-full md:w-auto">
                          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-xl border border-indigo-500/20">
                              <Timer size={13} className="text-indigo-400" />
                              <span className="font-black text-[9px] text-indigo-400">{totalLaps} / 100 Voltas Totais</span>
                          </div>
                          <button 
                              onClick={handleResetPlanner}
                              className="flex items-center gap-1.5 text-[8px] font-black uppercase text-slate-500 hover:text-rose-400 transition-colors px-2.5 py-1 bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 rounded-xl active:scale-95"
                          >
                              <RotateCcw size={11} /> Limpar
                          </button>
                      </div>
                  </div>
              </div>
              
              <div className="relative p-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 w-full">
                  {Array.from({ length: visibleStintsCount }).map((_, i) => {
                      const sk = `s${i+1}`;
                      const isLocked = lockedStints[i];
                      const data = isLocked ? frozenResults[i] : sheetData[i];
                      const laps = Number(testStints[sk]) || 0;
                      
                      const pdaMult = PRIORITY_MULTIPLIERS[priority] || PRIORITY_MULTIPLIERS["Nenhuma prioridade em especial"];
                      let cardPoints = { P: 0, D: 0, A: 0 };
                      
                      if (isLocked) {
                          cardPoints = stintHistory[i]?.points || cardPoints;
                      } else {
                          cardPoints = {
                              P: laps * pdaMult.P,
                              D: laps * pdaMult.D,
                              A: laps * pdaMult.A
                          };
                      }

                      return (
                          <div key={i} className={`w-full flex flex-col gap-2 rounded-2xl p-3 border transition-all duration-300 ${isLocked ? 'bg-emerald-900/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-black/40 border-white/10 hover:border-white/20'}`}>
                              
                              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isLocked ? 'text-emerald-400' : 'text-slate-400'}`}>Stint {i + 1}</span>
                                  <button onClick={() => toggleLock(i)} className={`w-6 h-6 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${isLocked ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-[#0F0F13] text-slate-500 border-white/10 hover:text-white'}`}>
                                      {isLocked ? <Lock size={11} /> : <Check size={11} />}
                                  </button>
                              </div>

                              <div className="flex items-center justify-between gap-2 bg-[#0F0F13]/50 p-1.5 rounded-xl border border-white/5">
                                  <label className="text-[8px] font-black text-indigo-400 uppercase tracking-widest pl-1.5">Voltas</label>
                                  <input 
                                      type="number" 
                                      disabled={isLocked} 
                                      value={testStints[sk]} 
                                      onChange={e => handleStintChange(sk, e.target.value)} 
                                      onBlur={() => validateMinLaps(sk)} 
                                      onFocus={(e) => e.target.select()}
                                      className={`w-14 border rounded-lg p-1 text-center text-sm font-black transition-all outline-none ${isLocked ? 'bg-transparent border-transparent text-emerald-400 cursor-not-allowed' : 'bg-black/60 border-white/10 text-white focus:border-indigo-500 shadow-inner'}`} 
                                      placeholder="0"
                                  />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col items-center justify-center bg-[#0F0F13]/50 py-1.5 rounded-xl border border-white/5">
                                      <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                                          <Activity size={10}/>
                                          <span className="text-[7px] font-black uppercase">Desgaste</span>
                                      </div>
                                      <span className={`text-[10px] font-black ${isLocked ? 'text-emerald-400' : 'text-rose-500'}`}>
                                          {typeof data?.wear === 'number' ? `${data.wear.toFixed(1)}%` : '-'}
                                      </span>
                                  </div>
                                  <div className="flex flex-col items-center justify-center bg-[#0F0F13]/50 py-1.5 rounded-xl border border-white/5">
                                      <div className="flex items-center gap-1 text-slate-500 mb-0.5">
                                          <Fuel size={10}/>
                                          <span className="text-[7px] font-black uppercase">Comb.</span>
                                      </div>
                                      <span className={`text-[10px] font-black ${isLocked ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                          {typeof data?.fuel === 'number' ? `${data.fuel.toFixed(1)}L` : '-'}
                                      </span>
                                  </div>
                              </div>
                              
                              <div className={`mt-0.5 flex items-center justify-between bg-[#0F0F13]/80 px-2 py-1 rounded-lg border ${isLocked ? 'border-emerald-500/20' : 'border-white/5'} transition-all`}>
                                  <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest">
                                      {isLocked ? 'Gerou' : 'Projeção'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[6px] font-black text-slate-400 uppercase">P <span className={`ml-0.5 ${isLocked ? 'text-rose-500' : 'text-rose-500'}`}>+{cardPoints.P.toFixed(1)}</span></span>
                                      <span className="text-[6px] font-black text-slate-400 uppercase">D <span className={`ml-0.5 ${isLocked ? 'text-cyan-400' : 'text-cyan-400'}`}>+{cardPoints.D.toFixed(1)}</span></span>
                                      <span className="text-[6px] font-black text-slate-400 uppercase">A <span className={`ml-0.5 ${isLocked ? 'text-yellow-400' : 'text-yellow-400'}`}>+{cardPoints.A.toFixed(1)}</span></span>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </section>
          
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.2); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}