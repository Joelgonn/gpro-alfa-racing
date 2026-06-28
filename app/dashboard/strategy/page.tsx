'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useGame } from '../../context/GameContext';

import {
  Settings, Gauge, Zap, HardHat, BarChart3, Loader2, MapPin,
  Sparkles, ChevronLeft, ChevronRight, Fuel, TrendingUp,
  ChevronDown, ShieldCheck, ShieldAlert, ChevronsRight, Search, X,
  Lock, Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Importação do serviço de cálculo de setup
import { calculateSetupService } from "@/services/setupService";

// --- TIPAGEM ---
type RaceOptions = { desgaste_pneu_percent: number; condicao: string; pneus_fornecedor: string; tipo_pneu: string; pitstops_num: number; ct_valor: number; avg_temp: number; };
type CompoundOption = { forcar_pits: string; forcar_ct: string; };
type CompoundOptions = Record<string, CompoundOption>;
type BoostInput = { volta: string | number | null };
type BoostLapsInput = { boost1: BoostInput; boost2: BoostInput; boost3: BoostInput };
type PersonalStintsInput = { [key: string]: string | number | null };
type InputsState = { race_options: RaceOptions; compound_options: CompoundOptions; boost_laps: BoostLapsInput; personal_stint_voltas: PersonalStintsInput; };

// --- CONSTANTES ---
const TRACK_FLAGS: { [key: string]: string } = {
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk", "Valencia": "es", "Vallelunga": "it", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be"
};

const TYRE_NAMES: Record<string, string> = {
    "Extra Soft": "X Macio",
    "Soft": "Macio",
    "Medium": "Médio",
    "Hard": "Duro",
    "Rain": "Chuva"
};

// ✅ FORNECEDORES CORRETOS (IGUAL DA PÁGINA DE TESTES)
const TYRE_SUPPLIERS = ["Pipirelli", "Avonn", "Yokomama", "Dunnolop", "Contimental", "Hancock", "Badyear", "Michelini", "Bridgerock"];

// ✅ MAPEAMENTO DE FORNECEDORES PARA IMAGENS
const TYRE_SUPPLIER_IMAGES: Record<string, string> = {
    "Pipirelli": "pipirelli.gif",
    "Avonn": "avonn.gif",
    "Yokomama": "yokomama.gif",
    "Dunnolop": "dunnolop.gif",
    "Contimental": "contimental.gif",
    "Hancock": "hancock.gif",
    "Badyear": "badyear.gif",
    "Michelini": "michelini.gif",
    "Bridgerock": "bridgerock.gif",
};

const clampSetupDisplay = (value: unknown): unknown => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return Math.max(0, Math.min(999, num));
};

// --- COMPONENTES AUXILIARES ---

// ✅ SELETOR DE PISTA CORRIGIDO (IGUAL AO DA PÁGINA DE SETUP)
function TrackSelector({ currentTrack, tracksList, onSelect, placeholder = "SELECIONAR PISTA" }: { currentTrack: string, tracksList: any[], onSelect: (t: string) => void, placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const filteredTracks = useMemo(() => {
        return tracksList.filter((track: any) => {
            const name = typeof track === 'object' ? (track.name || "") : (track || "");
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }, [tracksList, search]);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="
                    flex items-center gap-2 sm:gap-2.5 
                    text-[9px] sm:text-xs 
                    text-slate-800 font-black tracking-wider 
                    hover:text-emerald-600 transition-all duration-300 
                    outline-none group 
                    bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 
                    rounded-lg sm:rounded-xl 
                    border border-slate-200 
                    active:scale-[0.98] 
                    shadow-sm hover:shadow-md 
                    min-w-[100px] sm:min-w-[140px]
                    truncate
                "
            >
                <span className="truncate text-[9px] sm:text-xs">
                    {currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : placeholder}
                </span>
                <ChevronDown 
                    className={`
                        transition-transform duration-300 
                        text-slate-400 group-hover:text-emerald-600 
                        ${isOpen ? 'rotate-180' : ''}
                        w-3 h-3 sm:w-4 sm:h-4
                    `} 
                    size={14} 
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }} 
                        className="absolute top-full left-0 mt-2 w-[240px] sm:w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[60]"
                    >
                        <div className="p-2 sm:p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    autoFocus 
                                    type="text" 
                                    placeholder="Buscar pista..." 
                                    value={search} 
                                    onChange={(e) => setSearch(e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 outline-none font-bold uppercase tracking-wider" 
                                />
                                {search && (
                                    <button 
                                        onClick={() => setSearch('')} 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[200px] sm:max-h-[220px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5 bg-white">
                            {filteredTracks.map((track: any) => {
                                const name = typeof track === 'object' ? track.name : track;
                                return (
                                    <button
                                        key={name}
                                        onClick={() => { onSelect(name); setIsOpen(false); setSearch(""); }}
                                        className={`
                                            w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 
                                            rounded-lg text-[9px] sm:text-xs 
                                            font-black uppercase tracking-wider 
                                            flex items-center justify-between group transition-all
                                            ${currentTrack === name 
                                                ? 'bg-emerald-600 text-white' 
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 sm:gap-2.5">
                                            {TRACK_FLAGS[name] ? (
                                                <img src={`/flags/${TRACK_FLAGS[name]}.png`} alt={name} className="w-3 h-2 sm:w-4 sm:h-2.5 object-cover rounded-sm shadow-sm" />
                                            ) : (
                                                <div className="w-3 h-2 sm:w-4 sm:h-2.5 bg-slate-100 rounded-sm border border-slate-200"></div>
                                            )}
                                            <span className="truncate max-w-[120px] sm:max-w-none">{name}</span>
                                        </div>
                                        {currentTrack === name && <ShieldCheck size={12} className="shrink-0" />}
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

function ConfigInput({ label, value, onChange, max }: { label: string, value: number, onChange: (v: number) => void, max?: number }) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        if (valStr === '') {
            onChange(0);
            return;
        }
        let val = parseInt(valStr, 10);
        if (val < 0) val = 0;
        if (max !== undefined && val > max) val = max;
        onChange(val);
    };

    return (
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500/20 hover:shadow-md transition-all duration-300">
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">{label}</label>
            <div className="flex items-center">
                <input 
                    type="number" 
                    inputMode="numeric"
                    value={value || ''} 
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent font-black text-sm text-slate-800 outline-none w-full min-w-0"
                    placeholder="0"
                />
            </div>
        </div>
    );
}

// ✅ SUPPLIER CAROUSEL CORRIGIDO - COM FORNECEDORES E IMAGENS CORRETAS
function SupplierCarousel({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) {
    const [imgError, setImgError] = useState(false);

    useEffect(() => { setImgError(false); }, [value]);

    if (!options || options.length === 0) return <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] text-slate-400 font-bold">Sem Opções</div>;
    
    const currentIndex = options.findIndex(o => o === value);
    const handleNext = () => onChange(options[(currentIndex + 1) % options.length] || options[0]);
    const handlePrev = () => onChange(options[(currentIndex - 1 + options.length) % options.length] || options[0]);

    // ✅ Obtém o nome do arquivo da imagem baseado no mapeamento
    const getImageSrc = (supplierName: string): string => {
        const imageName = TYRE_SUPPLIER_IMAGES[supplierName];
        return imageName ? `/tyres/${imageName}` : '';
    };

    const imageSrc = value ? getImageSrc(value) : '';

    return (
        <div className="flex items-center justify-between bg-[#f8fafc] p-2 rounded-xl border border-slate-200 h-12 w-full overflow-hidden shadow-sm hover:border-emerald-500/20 hover:shadow-md transition-all duration-300">
            <button 
                onClick={handlePrev} 
                className="text-slate-400 hover:text-slate-800 p-1.5 transition-colors hover:bg-slate-100 rounded-lg"
            >
                <ChevronLeft size={16} />
            </button>
            
            <div className="flex-1 flex justify-center items-center h-full">
                {!imgError && value && imageSrc ? (
                    <img 
                        src={imageSrc}
                        alt={value} 
                        className="h-8 w-auto object-contain drop-shadow-sm transition-all"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                        {value || 'Nenhum'}
                    </span>
                )}
            </div>
            
            <button 
                onClick={handleNext} 
                className="text-slate-400 hover:text-slate-800 p-1.5 transition-colors hover:bg-slate-100 rounded-lg"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}

// --- BOOST PANEL COMPONENT - COM BLOQUEIO NO MODO AUTOMÁTICO E TOOLTIP ---
function BoostSection({ className, inputs, handleInput, outputs, isAutoMode = false }: any) {
    const isDisabled = isAutoMode;
    
    return (
        <section className={`bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
            <div className="bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-800">
                    <Zap size={14} className="text-amber-500"/> Boost - Ajuste Manual
                </h3>
                {isDisabled ? (
                    <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock size={10} /> BLOQUEADO
                    </span>
                ) : (
                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Unlock size={10} /> EDITÁVEL
                    </span>
                )}
            </div>
            
            <div className={`p-4 space-y-3.5 ${isDisabled ? 'opacity-60' : ''}`}>
                {[1, 2, 3].map(i => {
                    const bKey = `boost${i}` as keyof BoostLapsInput;
                    const displayValue = inputs.boost_laps[bKey]?.volta ?? '';
                    
                    return (
                        <div 
                            key={i} 
                            className={`flex items-center justify-between bg-[#f8fafc] p-3 rounded-xl border border-slate-150 group transition-all duration-300 shadow-sm ${
                                isDisabled 
                                    ? 'hover:border-slate-200' 
                                    : 'hover:border-amber-500/30 hover:shadow-md'
                            }`}
                        >
                            <span className={`text-[10px] font-black uppercase ${
                                isDisabled ? 'text-slate-400' : 'text-slate-400 group-hover:text-amber-600'
                            }`}>
                                B{i}
                            </span>
                            
                            <div className="relative group/input">
                                <input 
                                    type="number" 
                                    placeholder="Volta" 
                                    value={displayValue} 
                                    onChange={e => handleInput('boost_laps', 'volta', e.target.value, bKey)} 
                                    className={`w-16 bg-white border border-slate-200 rounded p-2 text-center font-black text-xs text-slate-800 focus:border-amber-500 outline-none transition-all ${
                                        isDisabled 
                                            ? 'cursor-not-allowed opacity-50 bg-slate-100' 
                                            : 'hover:border-amber-300'
                                    }`}
                                    disabled={isDisabled}
                                />
                                
                                {/* Tooltip indicativo quando bloqueado */}
                                {isDisabled && (
                                    <>
                                        {/* Ícone de interrogação */}
                                        <div className="absolute -top-2 -right-2">
                                            <div className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black cursor-help shadow-sm">
                                                ?
                                            </div>
                                        </div>
                                        
                                        {/* Tooltip */}
                                        <div className="
                                            absolute bottom-full left-1/2 -translate-x-1/2 mb-2 
                                            px-3 py-1.5 
                                            bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider 
                                            rounded-lg shadow-xl 
                                            opacity-0 group-hover/input:opacity-100 
                                            transition-all duration-200 
                                            pointer-events-none 
                                            whitespace-nowrap
                                            z-50
                                            border border-slate-700
                                        ">
                                            🔒 Ative o modo Manual
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-800"></div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="flex flex-col items-end leading-tight">
                                <span className={`text-[8px] font-black uppercase ${
                                    isDisabled ? 'text-slate-300' : 'text-slate-400'
                                }`}>
                                    Seq / Stints
                                </span>
                                <span className={`text-[11px] font-black tracking-tighter ${
                                    isDisabled ? 'text-slate-400' : 'text-amber-600'
                                }`}>
                                    {outputs?.boost_laps_outputs?.[bKey]?.stint || '-'} / {outputs?.boost_laps_outputs?.[bKey]?.voltas_list || '-'}
                                </span>
                            </div>
                        </div>
                    )
                })}
                
                {/* Mini Stints Grid - Sempre visível */}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-200">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-150 text-center hover:border-emerald-200 transition-all duration-300">
                            <span className="text-[8px] text-slate-400 font-black block uppercase mb-1">S{i}</span>
                            <div className="text-slate-800 font-black text-[10px] leading-none mb-1">
                                {outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val1 || '--'}
                            </div>
                            <div className={`text-[8px] font-black ${isDisabled ? 'text-slate-400' : 'text-amber-600'}`}>
                                {outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val2 || '-'} B
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function StatsGrid({ outputs, fmt, className = "" }: { outputs: any, fmt: Function, className?: string }) {
    const items = [
        { l: "Voltas", v: outputs?.race_calculated_data?.voltas, i: <BarChart3 size={12}/> }, 
        { l: "Combustível", v: outputs?.race_calculated_data?.consumo_combustivel, i: <Fuel size={12}/> }, 
        { l: "Ultrapass.", v: outputs?.race_calculated_data?.ultrapassagem, i: <ChevronsRight size={12}/> }, 
        { l: "Tempo Pit", v: outputs?.race_calculated_data?.pit_io, unit: "s", i: <Zap size={12}/> }, 
        { l: "TCD Total", v: outputs?.race_calculated_data?.tcd_corrida, unit: "s", i: <TrendingUp size={12}/> },
        { 
            l: "Ganho CTR", 
            v: outputs?.race_calculated_data?.ganho_ctr_total, 
            unit: "s", 
            i: <Sparkles size={12} className="text-emerald-500 animate-pulse"/>,
            isCtr: true 
        },
    ];

    return (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 ${className}`}>
            {items.map((item, idx) => (
                <div key={idx} className={`bg-white border ${item.isCtr ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'} p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 h-[74px] md:h-[84px]`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 ${item.isCtr ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {item.i} {item.l}
                    </span>
                    <span className={`text-base md:text-lg font-black ${item.isCtr ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {item.isCtr && item.v > 0 ? '-' : ''}{fmt(item.v, 3, item.unit)}
                    </span>
                </div>
            ))}
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

    const dropCount = 180;
    const rainColor = '14, 165, 233';
    const speed = 0.02; 

    const drops: any[] = [];
    const resetDrop = (d: any) => {
      d.x = (Math.random() - 0.5) * 2;
      d.y = (Math.random() - 0.5) * 2;
      d.z = 1; 
      d.size = Math.random() * 3 + 1;
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

        const alpha = (5 - d.z) / 4 * 0.15;

        if (alpha > 0) {
          ctx.strokeStyle = `rgba(${rainColor}, ${alpha})`;
          ctx.lineWidth = d.size * perspective * 1.2;
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
      <canvas ref={canvasRef} className="block w-full h-full opacity-60" />
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function StrategyPage() {
  const router = useRouter(); 
  
  const {
    track, updateTrack, tracksList: contextTracks,
    weather, updateWeather, driver, car, updateCar,
    techDirector, updateTechDirector,      
    staffFacilities, updateStaffFacilities, 
    idealSetup, updateIdealSetup,
    updateDriverEditable
  } = useGame();

  // ✅ USANDO OS FORNECEDORES CORRETOS
  const tyreSuppliers = TYRE_SUPPLIERS;

  // ✅ ESTADO LOCAL PARA PISTAS (IGUAL À PÁGINA DE SETUP)
  const [localTracks, setLocalTracks] = useState<string[]>([]);

  // ✅ CARREGA A LISTA DE PISTAS DA API (IGUAL À PÁGINA DE SETUP)
  useEffect(() => {
    async function loadTracks() {
      try {
        const res = await fetch('/api/python?action=tracks');
        const data = await res.json();
        if (data.tracks) {
          setLocalTracks(data.tracks);
          console.log('✅ Pistas carregadas na StrategyPage:', data.tracks.length);
        }
      } catch (error) {
        console.error("❌ Erro ao carregar pistas na StrategyPage:", error);
      }
    }
    loadTracks();
  }, []);

  // ✅ COMBINA AS FONTES DE PISTAS (CONTEXTO + LOCAL)
  const tracksList = useMemo(() => {
    if (contextTracks && contextTracks.length > 0) {
      console.log('📋 Usando pistas do contexto:', contextTracks.length);
      return contextTracks;
    }
    if (localTracks && localTracks.length > 0) {
      console.log('📋 Usando pistas locais:', localTracks.length);
      return localTracks;
    }
    console.log('⚠️ Nenhuma pista disponível, usando fallback');
    return ["Selecionar Pista"];
  }, [contextTracks, localTracks]);

  const [inputs, setInputs] = useState<InputsState>({
    race_options: { desgaste_pneu_percent: 15, condicao: "Dry", pneus_fornecedor: "Pipirelli", tipo_pneu: "Extra Soft", pitstops_num: 1, ct_valor: 0, avg_temp: 0 },
    compound_options: { "Extra Soft": { forcar_pits: "", forcar_ct: "" }, "Soft": { forcar_pits: "", forcar_ct: "" }, "Medium": { forcar_pits: "", forcar_ct: "" }, "Hard": { forcar_pits: "", forcar_ct: "" } },
    boost_laps: { boost1: { volta: null }, boost2: { volta: null }, boost3: { volta: null } },
    personal_stint_voltas: { stint1: null, stint2: null, stint3: null, stint4: null, stint5: null, stint6: null, stint7: null, stint8: null }
  });

  const [outputs, setOutputs] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente'); 

  const driverStr = useMemo(() => JSON.stringify(driver), [driver]);
  const carStr = useMemo(() => JSON.stringify(car), [car]);
  const techDirectorStr = useMemo(() => JSON.stringify(techDirector), [techDirector]);
  const staffFacilitiesStr = useMemo(() => JSON.stringify(staffFacilities), [staffFacilities]);

  const raceOptionsStr = useMemo(() => JSON.stringify(inputs.race_options), [inputs.race_options]);
  const boostLapsStr = useMemo(() => JSON.stringify(inputs.boost_laps), [inputs.boost_laps]);
  const personalStintVoltasStr = useMemo(() => JSON.stringify(inputs.personal_stint_voltas), [inputs.personal_stint_voltas]);

  // Derivação da Melhor Estratégia
  const bestStrategy = useMemo(() => {
    const compounds = outputs?.compound_details_outputs;
    if (!compounds) return { compound: null, pits: null };
    
    const isWetCondition = inputs.race_options.condicao === "Wet";
    
    let winnerCompound: string | null = null;
    let winnerPits: number | null = null;
    
    const getPits = (data: any): number | null => {
      if (!data) return null;
      const pits = data.req_stops;
      if (pits === undefined || pits === null) return null;
      const numPits = Number(pits);
      return isNaN(numPits) ? null : numPits;
    };
    
    if (isWetCondition) {
      if (compounds["Rain"]) {
        winnerCompound = "Rain";
        winnerPits = getPits(compounds["Rain"]);
      }
    } else {
      const dryCompounds = ["Extra Soft", "Soft", "Medium", "Hard"];
      let bestFound = false;
      
      for (const compound of dryCompounds) {
        const data = compounds[compound];
        if (data) {
          const isBest = data?.total?.toString().toLowerCase() === "best" || data?.total === 0;
          if (isBest) {
            winnerCompound = compound;
            winnerPits = getPits(data);
            bestFound = true;
            break;
          }
        }
      }
      
      if (!bestFound) {
        let lowestTime: number | null = null;
        for (const compound of dryCompounds) {
          const data = compounds[compound];
          if (data && data.total !== undefined && data.total !== null) {
            let totalTime: number;
            if (typeof data.total === 'string' && data.total.toLowerCase() === 'best') {
              totalTime = 0;
            } else {
              totalTime = Number(data.total);
            }
            
            if (!isNaN(totalTime) && (lowestTime === null || totalTime < lowestTime)) {
              lowestTime = totalTime;
              winnerCompound = compound;
              winnerPits = getPits(data);
            }
          }
        }
      }
    }
    
    return {
      compound: winnerCompound,
      pits: winnerPits
    };
  }, [outputs?.compound_details_outputs, inputs.race_options.condicao]);

  useEffect(() => {
    if (inputs.race_options.condicao === "Wet" && outputs?.compound_details_outputs) {
      console.log('=== DEBUG CHUVA ===');
      console.log('Rain compound data:', outputs?.compound_details_outputs?.["Rain"]);
      console.log('bestStrategy:', bestStrategy);
    }
  }, [inputs.race_options.condicao, outputs, bestStrategy]);

  // Auth Check
  useEffect(() => {
    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            setUserId(session.user.id);
            if(session.user.email) setUserEmail(session.user.email);
        } catch (error) { console.error("Erro auth:", error); router.push('/login'); }
    }
    checkSession();
  }, [router]);

  // Load State
  useEffect(() => {
    async function loadState() {
      if (!userId) return;
      try {
        const res = await fetch('/api/python?action=get_state', { headers: { 'user-id': userId } });
        const json = await res.json();
        
        if (json.sucesso && json.data) {
          const d = json.data;
          
          if (d.current_track) updateTrack(d.current_track);
          if (d.driver) Object.entries(d.driver).forEach(([k, v]) => updateDriverEditable(k as any, Number(v)));
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });
          
          if (d.tech_director) updateTechDirector(d.tech_director);
          if (d.staff_facilities) updateStaffFacilities(d.staff_facilities);
          
          let dbCalcAvg = 0;
          if (d.weather) {
             updateWeather(d.weather);
             const w = d.weather;
             const vals = [w.r1_temp_min, w.r1_temp_max, w.r2_temp_min, w.r2_temp_max, w.r3_temp_min, w.r3_temp_max, w.r4_temp_min, w.r4_temp_max];
             const sum = vals.reduce((a: number, b: any) => a + (Number(b) || 0), 0);
             dbCalcAvg = sum / 8;
          }

          const savedStrategyTemp = Number(d.race_options?.avg_temp);
          const hasWeatherTemps = Boolean(d.weather) && dbCalcAvg > 0;
          const finalAvgTemp = hasWeatherTemps
            ? dbCalcAvg
            : (savedStrategyTemp && savedStrategyTemp > 0 ? savedStrategyTemp : 0);

          setInputs(prev => ({ 
              ...prev, 
              race_options: { 
                  ...prev.race_options, 
                  desgaste_pneu_percent: d.race_options?.desgaste_pneu_percent ?? prev.race_options.desgaste_pneu_percent,
                  pneus_fornecedor: d.race_options?.pneus_fornecedor ?? prev.race_options.pneus_fornecedor,
                  tipo_pneu: d.race_options?.tipo_pneu ?? prev.race_options.tipo_pneu,
                  condicao: d.race_options?.condicao ?? prev.race_options.condicao,
                  pitstops_num: d.race_options?.pitstops_num ?? prev.race_options.pitstops_num,
                  ct_valor: d.race_options?.ct_valor ?? prev.race_options.ct_valor,
                  avg_temp: finalAvgTemp
              }, 
          }));
        }
      } catch (e) { console.error("Erro load state:", e); }
      finally { setIsSyncing(false); }
    }
    loadState();
  }, [userId]); 

  // Weather Sync
  useEffect(() => {
    if (!userId || isSyncing || !track || track === "Selecionar Pista") return;

    const weatherQ2 = String(weather.weatherQ2 || '').toLowerCase();
    const isWet = weatherQ2.includes('wet') || weatherQ2.includes('rain') || weatherQ2.includes('chuva');
    const nextCondition = isWet ? 'Wet' : 'Dry';
    const nextTyre = isWet ? 'Rain' : 'Extra Soft';

    setInputs(prev => {
      const same =
        prev.race_options.ct_valor === 0 &&
        prev.race_options.pitstops_num === 1 &&
        prev.race_options.desgaste_pneu_percent === 15 &&
        prev.race_options.condicao === nextCondition &&
        prev.race_options.tipo_pneu === nextTyre;

      if (same) return prev;

      return {
        ...prev,
        race_options: {
          ...prev.race_options,
          ct_valor: 0,
          pitstops_num: 1,
          desgaste_pneu_percent: 15,
          condicao: nextCondition,
          tipo_pneu: nextTyre,
        },
      };
    });
  }, [weather.weatherQ2, track, userId, isSyncing]);

  // Função de Cálculo
  const fetchStrategy = useCallback(async (currInputs: InputsState, currentTrack: string) => {
    if (!userId || !currentTrack || currentTrack === "Selecionar Pista" || isSyncing) return;
    
    setLoading(true);
    try {
      const payload = {
          pista: currentTrack, 
          driver: JSON.parse(driverStr), 
          car: JSON.parse(carStr), 
          tech_director: JSON.parse(techDirectorStr),
          staff_facilities: JSON.parse(staffFacilitiesStr),
          race_options: currInputs.race_options, 
          compound_options: currInputs.compound_options, 
          boost_laps: currInputs.boost_laps, 
          personal_stint_voltas: currInputs.personal_stint_voltas 
      };

      const res = await fetch('/api/python?action=strategy_calculate', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', 'user-id': userId }, 
          body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (data.sucesso) {
        setOutputs(data.data);
      }
    } catch (e) { console.error("Erro calc:", e); }
    finally { setLoading(false); }
  }, [userId, isSyncing, driverStr, carStr, techDirectorStr, staffFacilitiesStr]);

  // Trigger Calculation
  useEffect(() => {
    if (!isSyncing && userId && track && track !== "Selecionar Pista") {
      const timer = setTimeout(() => {
        fetchStrategy(inputs, track);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [raceOptionsStr, boostLapsStr, personalStintVoltasStr, track, fetchStrategy, isSyncing, userId]);

  // Setup Recarga Automática
  useEffect(() => {
    async function recarregarSetupIdeal() {
      if (!userId || !track || track === "Selecionar Pista" || isSyncing) return;
      
      try {
        const driverParsed = JSON.parse(driverStr);
        const carParsed = JSON.parse(carStr);
        const techDirectorParsed = JSON.parse(techDirectorStr);
        const staffFacilitiesParsed = JSON.parse(staffFacilitiesStr);

        const data = await calculateSetupService(
          {
            pista: track,
            driver: driverParsed,
            car: carParsed,
            tech_director: techDirectorParsed,
            staff_facilities: staffFacilitiesParsed,
            tempQ1: weather.tempQ1,
            tempQ2: weather.tempQ2,
            weatherQ1: weather.weatherQ1,
            weatherQ2: weather.weatherQ2,
            weatherRace: weather.weatherRace, 
            raceAvgTemp: inputs.race_options.avg_temp || 0,
            desgasteModifier: 0 
          },
          userId
        );
        
        if (data.sucesso) {
          updateIdealSetup(data.data);
        }
      } catch (error) {
        console.error("Erro setup:", error);
      }
    }

    if (track && track !== "Selecionar Pista" && !isSyncing) {
      recarregarSetupIdeal();
    }
  }, [weather.weatherRace, inputs.race_options.avg_temp, track, userId, isSyncing, driverStr, carStr, techDirectorStr, staffFacilitiesStr]);

  // Persistência
  const persistStrategyState = useCallback(async () => {
      if (!userId || isSyncing) return;
      try {
          const raceOptionsWithExtras = {
              ...JSON.parse(raceOptionsStr),
              boost_laps: JSON.parse(boostLapsStr),
              personal_stint_voltas: JSON.parse(personalStintVoltasStr)
          };

          await fetch('/api/python?action=update_state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'user-id': userId },
              body: JSON.stringify({
                  track: track, 
                  race_options: raceOptionsWithExtras,
                  tech_director: JSON.parse(techDirectorStr),     
                  staff_facilities: JSON.parse(staffFacilitiesStr) 
              })
          });
      } catch(e) { console.error("Erro save:", e); }
  }, [userId, isSyncing, track, raceOptionsStr, boostLapsStr, personalStintVoltasStr, techDirectorStr, staffFacilitiesStr]); 

  useEffect(() => {
      if (!isSyncing && userId) {
          const timer = setTimeout(() => persistStrategyState(), 2000);
          return () => clearTimeout(timer);
      }
  }, [raceOptionsStr, boostLapsStr, personalStintVoltasStr, track, techDirectorStr, staffFacilitiesStr, persistStrategyState, isSyncing, userId]);

  const handleInput = (section: keyof InputsState, field: string, value: any, subKey?: string) => {
    setInputs(prev => {
      const next = JSON.parse(JSON.stringify(prev)); 
      if (subKey) (next[section] as any)[subKey][field] = value;
      else (next[section] as any)[field] = value;
      return next;
    });
  };

  const fmt = (v: any, d = 1, s = '') => {
    if (typeof v === 'object' && v !== null) return "-";
    if (v === null || v === undefined || v === "" || v === "-") return "-";
    const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
    if (isNaN(n)) return v;
    return n.toFixed(d).replace('.', ',') + s;
  };

  const visibleStints = useMemo(() => {
      const totalVoltas = outputs?.race_calculated_data?.voltas 
          ? Number(String(outputs.race_calculated_data.voltas).replace(',', '.')) 
          : 999; 

      if (activeTab === 'auto') {
          if (!outputs?.stints_predefined?.voltas) return 1;
          let count = 0;
          for (let i = 1; i <= 8; i++) {
              const val = outputs.stints_predefined.voltas[`stint${i}`];
              if (val && val !== '-' && Number(val) > 0) count++;
          }
          return Math.max(1, count);
      } else {
          let count = 1;
          let currentSum = 0;
          for (let i = 1; i < 8; i++) {
              const val = Number(inputs.personal_stint_voltas[`stint${i}`]) || 0;
              currentSum += val;
              if (currentSum < totalVoltas && val > 0) count++;
              else break;
          }
          return count;
      }
  }, [activeTab, outputs, inputs.personal_stint_voltas]);

  if (isSyncing || !userId) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#eef2f6] text-emerald-600 gap-4 font-mono">
      <div className="relative w-20 h-20"><div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full"></div><div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      <span className="font-black text-xs tracking-[0.4em] uppercase animate-pulse">Sincronizando Estratégia</span>
    </div>
  );

  const currentStintData = activeTab === 'manual' ? outputs?.stints_personal : outputs?.stints_predefined;

  const displaySetupValue = (value: any): string => {
    const clamped = clampSetupDisplay(value);
    return clamped === '-' || clamped === null || clamped === undefined ? '-' : String(clamped);
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 md:pb-12 selection:bg-emerald-500/20 relative overflow-hidden">
      
      {/* GLOWS AMBIENTAIS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.01] blur-[150px] rounded-full" />
      </div>
      
      {/* Chuva Light */}
      <AnimatePresence>
      {inputs.race_options.condicao === "Wet" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
            <SkyViewRainOverlay /> 
          </motion.div>
      )}
      </AnimatePresence>
   
      {/* HEADER BAR (LIGHT GELO) - OTIMIZADO PARA MOBILE */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 bg-white/90 p-3 sm:p-4 relative shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 relative z-10">
          
          {/* ESQUERDA: Logo + Título */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg sm:rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] shrink-0">
              <Settings size={14} className="sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                Estratégia de Corrida
                <span className="text-[7px] sm:text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase truncate max-w-[100px] sm:max-w-[120px]">{userEmail}</p>
            </div>
          </div>
          
          {/* DIREITA: Circuito + Status + Temp */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto">
            
            {/* Circuito Selecionado */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 sm:pr-4">
              <div className="w-7 h-5 sm:w-8 sm:h-6 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {track && TRACK_FLAGS[track] ? (
                  <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] sm:text-xs">🏁</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[6px] sm:text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">Circuito</span>
                <TrackSelector currentTrack={track} tracksList={tracksList} onSelect={updateTrack} />
              </div>
            </div>

            {/* Status + Temperatura */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                <span className={`text-[8px] sm:text-[10px] font-bold ${loading ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {loading ? 'CALCULANDO' : 'SINCRONIZADO'}
                </span>
              </div>
              
              <div className="text-right border-l border-slate-200 pl-3 sm:pl-4 shrink-0 flex flex-col justify-center">
                <p className="text-[7px] sm:text-[8px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5 sm:mb-1">Temp. Média</p>
                <p className="text-base sm:text-xl font-black text-emerald-600 leading-none">
                  {inputs.race_options.avg_temp || '--'}°C
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10">
        
        {/* CARDS PRINCIPAIS */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-8">
          
          {/* COLUNA ESQUERDA: DADOS DA CORRIDA */}
          <div className="xl:col-span-4 space-y-4 md:space-y-8">
            <StatsGrid outputs={outputs} fmt={fmt} className="xl:hidden" />
            
            {/* CONFIGURAÇÃO DA ESTRATÉGIA */}
            <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-600 rounded-lg shadow-sm">
                    <Settings size={14} className="text-white" />
                  </div>
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Dados da Corrida</h3>
                </div>
                {loading && <Loader2 className="animate-spin text-emerald-600" size={14} />}
              </div>
              
              <div className="relative p-4 md:p-6 space-y-6">
                  {/* Chave de Clima Seco/Chuva */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg shadow-inner">
                    {["Dry", "Wet"].map(c => (
                      <button 
                        key={c} 
                        onClick={() => {
                          handleInput('race_options', 'condicao', c);
                          updateWeather({ weatherRace: c });
                        }} 
                        className={`py-3 md:py-2 rounded font-black text-[10px] uppercase transition-all duration-300 ${inputs.race_options.condicao === c ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'}`}
                      >
                        {c === 'Dry' ? '☀️ Pista Seca' : '🌧️ Pista Molhada'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                      {/* Temperatura */}
                      <div className="bg-[#f8fafc] p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                          <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Temp.</label>
                          <div className="flex items-center justify-between">
                              <input 
                                  type="number" 
                                  inputMode="decimal"
                                  value={inputs.race_options.avg_temp ?? ''} 
                                  step="0.1" 
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                      const valStr = e.target.value;
                                      if (valStr === '') {
                                          handleInput('race_options', 'avg_temp', 0);
                                          return;
                                      }
                                      let val = parseFloat(valStr);
                                      if (val < 0) val = 0;
                                      if (val > 60) val = 60;
                                      handleInput('race_options', 'avg_temp', val);
                                  }} 
                                  className="bg-transparent font-black text-sm text-slate-800 outline-none w-full min-w-0" 
                              />
                              <span className="text-[10px] text-emerald-600 font-bold ml-1">°C</span>
                          </div>
                      </div>

                      {/* Risco */}
                      <div className="relative group">
                          <ConfigInput label="Risco" value={inputs.race_options.ct_valor} max={100} onChange={(v:any) => handleInput('race_options', 'ct_valor', v)} />
                          
                          <AnimatePresence>
                              {outputs?.race_calculated_data?.ganho_ctr_volta > 0 && (
                                  <motion.div 
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0 }}
                                      className="absolute -bottom-5 left-0 w-full"
                                  >
                                      <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1 px-1">
                                          <Sparkles size={8} className="animate-pulse" /> 
                                          -{fmt(outputs.race_calculated_data.ganho_ctr_volta, 3)}s 
                                          <span className="text-[8px] opacity-60 uppercase tracking-tighter">/ volta</span>
                                      </span>
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>

                      <ConfigInput label="Pits" value={inputs.race_options.pitstops_num} max={8} onChange={(v:any) => handleInput('race_options', 'pitstops_num', v)} />
                  </div>

                  {/* Fornecedor de Pneus */}
                  <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Fornecedor de Pneus</label>
                      <SupplierCarousel options={tyreSuppliers} value={inputs.race_options.pneus_fornecedor} onChange={(val: string) => handleInput('race_options', 'pneus_fornecedor', val)} />
                  </div>
                  
                  {/* Seleção de Composto */}
                  <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block text-center tracking-widest">Seleção de Composto</label>
                      <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                          {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(p => { 
                              const isSelected = inputs.race_options.tipo_pneu === p; 
                              const img = p === 'Extra Soft' ? 'super macio' : p === 'Soft' ? 'macio' : p === 'Medium' ? 'medio' : p === 'Hard' ? 'duro' : 'chuva'; 
                              return ( 
                                  <button key={p} onClick={() => handleInput('race_options', 'tipo_pneu', p)} className={`relative group flex flex-col items-center justify-center gap-2 transition-all duration-500 ${isSelected ? 'scale-105 opacity-100' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                                      <div className="relative">
                                          {isSelected && <motion.div layoutId="pneu-select" className="absolute -inset-2 bg-emerald-500/10 rounded-full blur-md" />}
                                          <img src={`/compound/${img}.png`} alt={p} className={`w-9 h-9 md:w-10 md:h-10 object-contain rounded-full relative z-10 border-2 ${isSelected ? 'border-emerald-600 shadow-sm' : 'border-transparent'}`} />
                                      </div>
                                      <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${isSelected ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
                                          {TYRE_NAMES[p] || p}
                                      </span>
                                  </button> 
                              ) 
                          })}
                      </div>
                  </div>

                  {/* Range Slider de Margem */}
                  <div className="bg-[#f8fafc] p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex justify-between mb-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Margem: (Desgaste)</label>
                          <span className="text-xs font-black text-emerald-600">{inputs.race_options.desgaste_pneu_percent}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={inputs.race_options.desgaste_pneu_percent} onChange={e => handleInput('race_options', 'desgaste_pneu_percent', Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  </div>
              </div>
            </section>
            
            <BoostSection 
                className="hidden xl:block" 
                inputs={inputs} 
                handleInput={handleInput} 
                outputs={outputs}
                isAutoMode={activeTab === 'auto'}
            />
          </div>
          
          {/* COLUNA DIREITA: ANÁLISE */}
          <div className="xl:col-span-8 space-y-4 md:space-y-8">
              <StatsGrid outputs={outputs} fmt={fmt} className="hidden xl:grid" />
              
              {/* SETUP RECOMENDADO - LIGHT GLASS */}
              <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-300 hover:border-slate-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {!idealSetup ? (
                    <div className="relative p-3.5 md:p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-50 border-b border-amber-200">
                      <div className="flex items-start gap-3 text-left">
                        <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-amber-600 uppercase">Aguardando Parâmetros de Pista</span>
                          <p className="text-[9px] text-amber-700 font-bold leading-relaxed mt-0.5">
                            O setup mecânico ideal para esta pista ainda não foi calculado. Vá até a Setup Calculadora para definir os ajustes.
                          </p>
                        </div>
                      </div>
                      <button 
                          onClick={() => router.push('/dashboard/setup')} 
                          className="shrink-0 w-full md:w-auto px-4 py-2.5 bg-amber-100 hover:bg-amber-500 hover:text-white border border-amber-300 rounded-xl text-amber-600 font-black text-[9px] uppercase transition-all shadow-sm hover:shadow-md"
                      >
                          Ir para Setup Calculadora
                      </button>
                    </div>
                ) : (
                    <>
                      <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-600 rounded-lg shadow-sm">
                            <Settings size={14} className="text-white" />
                          </div>
                          <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Setup Recomendado</h3>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                          Sincronizado
                        </span>
                      </div>
                      
                      <div className="relative p-4 md:p-5 bg-white">
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                          {[
                              { id: 'asaDianteira', label: 'Asa Diant.' },
                              { id: 'asaTraseira', label: 'Asa Tras.' },
                              { id: 'motor', label: 'Motor' },
                              { id: 'freios', label: 'Freios' },
                              { id: 'cambio', label: 'Câmbio' },
                              { id: 'suspensao', label: 'Suspensão' }
                          ].map(part => (
                              <div key={part.id} className="bg-[#f8fafc] p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500/30 hover:shadow-md transition-all duration-300 flex flex-col items-center text-center group shadow-sm">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 group-hover:text-slate-800 transition-colors">{part.label}</span>
                                  <span className="text-sm font-black text-emerald-600 leading-none mb-2">{displaySetupValue(idealSetup[part.id]?.race)}</span>
                                  <div className="flex items-center gap-2 text-[10px] font-black w-full justify-center pt-2 border-t border-slate-150">
                                      <span className="text-rose-600" title="Qualificação 1">Q1: {displaySetupValue(idealSetup[part.id]?.q1)}</span>
                                      <span className="text-amber-600" title="Qualificação 2">Q2: {displaySetupValue(idealSetup[part.id]?.q2)}</span>
                                  </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    </>
                )}
              </section>
              
              {/* ANÁLISE DA PERFORMANCE */}
              <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-600 rounded-lg">
                        <Gauge size={14} className="text-white" />
                      </div>
                      <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Análise da Performance</h3>
                    </div>
                    
                    {bestStrategy.compound && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          {inputs.race_options.condicao === "Wet" ? (
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">🌧 Melhor Estratégia de Chuva</span>
                          ) : (
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">🏆 Melhor Estratégia</span>
                          )}
                          <span className="text-xs font-black text-slate-800">
                            {bestStrategy.compound} • {bestStrategy.pits !== null ? `${bestStrategy.pits} ${bestStrategy.pits === 1 ? 'pit' : 'pits'}` : '-- pits'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            handleInput('race_options', 'tipo_pneu', bestStrategy.compound);
                            if (bestStrategy.pits !== null) {
                              handleInput('race_options', 'pitstops_num', bestStrategy.pits);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg"
                        >
                          <Sparkles size={10} /> Aplicar Estratégia
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="relative overflow-x-auto custom-scrollbar bg-white">
                    <table className="w-full text-xs min-w-[350px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[9px] tracking-[0.2em] border-b border-slate-200">
                                <th className="p-4 text-left">Pneu</th>
                                <th className="p-4 text-center">Paradas</th>
                                <th className="p-4 text-center">Comb.</th>
                                <th className="p-4 text-center">Desg.</th>
                                <th className="p-4 text-center">Gap</th>
                            </tr>
                        </thead>
                        <tbody>
                            {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(c => {
                                if(inputs.race_options.condicao === "Dry" && c === "Rain") return null;
                                if(inputs.race_options.condicao === "Wet" && c !== "Rain") return null;
                                const d = outputs?.compound_details_outputs?.[c];
                                const isBest = d?.total?.toString().toLowerCase() === "best" || d?.total === 0;
                                return ( 
                                    <tr key={c} className={`transition-colors hover:bg-slate-50/50 ${isBest ? 'bg-emerald-500/[0.03]' : ''}`}>
                                        <td className="p-4 font-black text-slate-800 flex items-center gap-3"><div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px] shrink-0 ${c==='Extra Soft'?'bg-rose-500 shadow-rose-500':c==='Soft'?'bg-amber-400 shadow-amber-400':c==='Medium'?'bg-slate-400 shadow-slate-300':c==='Hard'?'bg-sky-400 shadow-sky-400':'bg-blue-500 shadow-blue-500'}`}></div>{c.replace("Extra Soft", "Ex. Soft")}</td>
                                        <td className="p-4 text-center font-black text-slate-600">{fmt(d?.req_stops, 0)}</td>
                                        <td className="p-4 text-center text-indigo-600 font-bold">{fmt(d?.fuel_load, 0, ' s')}</td>
                                        <td className="p-4 text-center text-slate-500 font-bold">{fmt(d?.tyre_wear, 1, '%')}</td>
                                        <td className="p-4 text-center font-black">
                                            {isBest ? (
                                                <button
                                                    onClick={() => {
                                                        handleInput('race_options', 'tipo_pneu', c);
                                                        handleInput('race_options', 'pitstops_num', Number(d?.req_stops ?? 0));
                                                    }}
                                                    className="text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-[10px] font-black transition-all flex items-center gap-1.5 mx-auto shadow-sm hover:shadow-md"
                                                    title="Clique para carregar esta configuração ideal no formulário"
                                                >
                                                    <Sparkles size={10} /> Ideal (Aplicar)
                                                </button>
                                            ) : (
                                                <span className="text-slate-500 tracking-tighter">+{fmt(d?.total, 1, 's')}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
              </section>
              
              {/* STINTS DE CORRIDA */}
              <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative bg-zinc-50 p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 border-b border-slate-200 px-4">
                  <button 
                    onClick={() => setActiveTab('auto')} 
                    className={`flex items-center justify-center gap-2 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all duration-300 ${activeTab === 'auto' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 bg-slate-100 border border-slate-200 hover:bg-slate-200'}`}
                  >
                    <Sparkles size={14}/> Automático
                  </button>
                  <button 
                    onClick={() => setActiveTab('manual')} 
                    className={`flex items-center justify-center gap-2 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all duration-300 ${activeTab === 'manual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 bg-slate-100 border border-slate-200 hover:bg-slate-200'}`}
                  >
                    <HardHat size={14}/> Manual
                  </button>
                </div>
                
                <div className="relative overflow-x-auto p-4 custom-scrollbar bg-white">
                    <table className="w-full text-xs border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-slate-400 uppercase font-black text-[9px] tracking-widest">
                                <th className="text-left p-3 w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-sm">Stints</th>
                                {Array.from({length: visibleStints}).map((_, i) => (
                                    <th key={i} className="p-2 text-center min-w-[50px] animate-fadeIn">S{i+1}</th>
                                ))}
                                <th className="p-3 text-right bg-slate-100 rounded-t-lg min-w-[60px] border-l border-slate-200">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-slate-50/50">
                                <td className="p-4 font-black text-emerald-600 uppercase sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-sm">Voltas</td>
                                {Array.from({length: visibleStints}).map((_, i) => { 
                                    const st = `stint${i+1}`; 
                                    return ( 
                                        <td key={st} className="p-2 text-center">
                                            {activeTab === 'manual' ? ( 
                                                <input 
                                                    type="number" 
                                                    value={inputs.personal_stint_voltas[st] ?? ''} 
                                                    onChange={e => handleInput('personal_stint_voltas', st, e.target.value)}                                                                                                                                                             
                                                    className="w-12 bg-white border border-slate-200 rounded p-2 text-center font-black text-slate-800 focus:border-emerald-500 outline-none transition-all focus:scale-110 shadow-sm hover:shadow-md" 
                                                /> 
                                            ) : ( 
                                                <span className="font-black text-slate-800 block animate-fadeIn">{fmt(currentStintData?.voltas?.[st], 0)}</span> 
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="p-4 text-right font-black text-emerald-700 bg-emerald-50 border-l border-slate-200 rounded-b-lg">
                                    {activeTab === 'manual' 
                                        ? Object.values(inputs.personal_stint_voltas).reduce((a:any, b:any) => Number(a||0) + Number(b||0), 0)
                                        : fmt(currentStintData?.voltas?.total, 0)
                                    }
                                </td>
                            </tr>
                            {[ 
                                {k: 'desg_final_pneu', l: 'Desgaste Final', u: '%', c: 'text-slate-500'}, 
                                {k: 'comb_necessario', l: 'Combustível', u: 'L', c: 'text-indigo-600'}, 
                                {k: 'est_tempo_pit', l: 'Tempo Pit', u: 's', c: 'text-slate-600'}, 
                                {k: 'voltas_em_bad', l: 'Voltas Ruins', u: '', c: 'text-rose-600'} 
                            ].map(row => ( 
                                <tr key={row.k} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 font-bold text-slate-500 uppercase sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-sm whitespace-nowrap">{row.l}</td>
                                    {Array.from({length: visibleStints}).map((_, i) => ( 
                                        <td key={i} className={`p-2 text-center font-bold ${row.c}`}>{fmt(currentStintData?.[row.k]?.[`stint${i+1}`], 1, row.u)}</td>
                                    ))}
                                    <td className={`p-4 text-right font-black bg-slate-50 border-l border-slate-200 ${row.k === 'voltas_em_bad' ? 'text-rose-600' : 'text-slate-800'}`}>{fmt(currentStintData?.[row.k]?.total, 1, row.u)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </section>
              
              <BoostSection 
                  className="block xl:hidden" 
                  inputs={inputs} 
                  handleInput={handleInput} 
                  outputs={outputs}
                  isAutoMode={activeTab === 'auto'}
              />
          </div>
        </div>
      </div>
      
      {/* LOADING OVERLAY */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            className="fixed bottom-4 md:bottom-8 right-4 md:right-8 left-4 md:left-auto bg-emerald-600 text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-4 font-black shadow-lg z-50 border border-emerald-500"
          >
            <Loader2 className="animate-spin" size={20} />
            <span className="text-xs tracking-widest uppercase">Calculando...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}