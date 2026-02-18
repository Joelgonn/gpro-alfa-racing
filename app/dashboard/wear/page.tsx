'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { 
  Loader2, Gauge, Cloud, Lock, LockOpen, 
  Settings2, Zap, Activity, ShieldAlert, Thermometer,
  CheckCircle2, Trash2, User, Eraser, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { useGame } from '@/app/context/GameContext';

// --- CONFIGURAÇÃO DAS PEÇAS ---
const CAR_PARTS = [
  { id: 'chassi', label: 'CHASSIS', icon: <Settings2 size={12} /> },
  { id: 'motor', label: 'MOTOR', icon: <Zap size={12} /> },
  { id: 'asa_diant', label: 'ASA DIANT.', icon: <Activity size={12} /> },
  { id: 'asa_tras', label: 'ASA TRAS.', icon: <Activity size={12} /> },
  { id: 'assoalho', label: 'ASSOALHO', icon: <ShieldAlert size={12} /> },
  { id: 'laterais', label: 'LATERAIS', icon: <Settings2 size={12} /> },
  { id: 'radiador', label: 'RADIADOR', icon: <Thermometer size={12} /> },
  { id: 'cambio', label: 'CÂMBIO', icon: <Settings2 size={12} /> },
  { id: 'freios', label: 'FREIOS', icon: <ShieldAlert size={12} /> },
  { id: 'suspensao', label: 'SUSPENSÃO', icon: <Settings2 size={12} /> },
  { id: 'eletronicos', label: 'ELETRÔNICOS', icon: <Zap size={12} /> },
];

// --- MAPEAMENTO DE BANDEIRAS ---
const TRACK_TO_FLAG: Record<string, string> = {
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", 
  "A1-Ring": "at", "A1 Ring": "at", "Red Bull Ring": "at", "Oesterreichring": "at",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb", 
  "Estoril": "pt", "Fiorano": "it", "Fuji": "jp", "Grobnik": "hr",
  "Hockenheim": "de", "Hungaroring": "hu", "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in",
  "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt",
  "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa",
  "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it",
  "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in",
  "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl",
  "Rio de Janeiro": "br", "Rafaela Oval": "ar",
  "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk",
  "Valencia": "es", "Vallelunga": "it",
  "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be"
};

export default function WearPlanningPage() {
  const { driver } = useGame();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [seasonSlots, setSeasonSlots] = useState<any[]>([]);
  const [manualOverrides, setManualOverrides] = useState<any>({});
  const [results, setResults] = useState<any>(null);
  const [lockedSlots, setLockedSlots] = useState<number[]>([]);
  
  // Mobile State
  const [mobileActiveTab, setMobileActiveTab] = useState(0);

  const driverStats = [
    { label: 'CON', val: driver.concentracao, full: 'Concentração' },
    { label: 'TAL', val: driver.talento, full: 'Talento' },
    { label: 'AGR', val: driver.agressividade, full: 'Agressividade' },
    { label: 'EXP', val: driver.experiencia, full: 'Experiência' },
    { label: 'TEC', val: driver.tecnica, full: 'Técnica' },
    { label: 'RES', val: driver.resistencia, full: 'Resistência' },
    { label: 'PES', val: driver.peso, unit: 'kg', full: 'Peso' },
  ];

  const stateRef = useRef({ seasonSlots, manualOverrides, lockedSlots });
  useEffect(() => {
    stateRef.current = { seasonSlots, manualOverrides, lockedSlots };
  }, [seasonSlots, manualOverrides, lockedSlots]);

  const getFlagSrc = (trackName: string) => {
    if (!trackName) return '/flags/xx.png';
    const cleanName = trackName.trim(); 
    const code = TRACK_TO_FLAG[cleanName] || TRACK_TO_FLAG[cleanName.replace('-', ' ')] || 'xx';
    return `/flags/${code}.png`;
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: season } = await supabase.from('calendario_temporada').select('tracks_json').maybeSingle();
      const baseSlots = season?.tracks_json?.filter((s: any) => s.name).map((s: any) => ({
        ...s, ctr: 0, testLaps: 0, testEnabled: true
      })) || [];

      try {
        const res = await fetch('/api/python/get_planning', { headers: { 'user-id': user.id } });
        const cloud = await res.json();
        let loadedSlots = baseSlots;
        let loadedOverrides = {};
        let loadedLocks: number[] = [];

        if (cloud.sucesso && cloud.data && Object.keys(cloud.data).length > 0) {
          loadedSlots = cloud.data.seasonSlots?.length > 0 ? cloud.data.seasonSlots : baseSlots;
          loadedOverrides = cloud.data.manualOverrides || {};
          loadedLocks = cloud.data.lockedSlots || [];
        }

        if (Object.keys(loadedOverrides).length === 0) {
           const defaultOverrides: any = {};
           CAR_PARTS.forEach(part => {
             defaultOverrides[part.id] = {};
             for (let i = 0; i < loadedSlots.length; i++) {
               defaultOverrides[part.id][i] = { lvl: "1" };
             }
           });
           loadedOverrides = defaultOverrides;
        }

        setSeasonSlots(loadedSlots);
        setManualOverrides(loadedOverrides);
        setLockedSlots(loadedLocks);
      } catch (error) {
        console.error("Erro ao carregar:", error);
        setSeasonSlots(baseSlots);
      }
      setLoading(false);
    }
    init();
  }, []);

  const saveToCloud = useCallback(async (slots: any, overrides: any, locks: number[]) => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch('/api/python/save_planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        keepalive: true, 
        body: JSON.stringify({
          planning: { seasonSlots: slots, manualOverrides: overrides, lockedSlots: locks }
        })
      });
    } catch (e) {
      console.error("Erro ao salvar:", e);
    } finally { 
      setSaving(false); 
    }
  }, [userId]);

  const fetchCalculo = useCallback(async () => {
    if (seasonSlots.length === 0 || !userId) return;
    setCalculating(true);
    try {
      const res = await fetch('/api/python/planning_calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({ driver, seasonSlots, manualOverrides })
      });
      const data = await res.json();
      if (data.sucesso) setResults(data.data);
    } finally { setCalculating(false); }
  }, [seasonSlots, manualOverrides, driver, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    const saveTimer = setTimeout(() => {
      saveToCloud(seasonSlots, manualOverrides, lockedSlots);
    }, 1000); 
    return () => clearTimeout(saveTimer);
  }, [manualOverrides, seasonSlots, lockedSlots, saveToCloud, loading, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    const calcTimer = setTimeout(() => {
      fetchCalculo();
    }, 1000);
    return () => clearTimeout(calcTimer);
  }, [manualOverrides, seasonSlots, driver, userId, loading, fetchCalculo]);

  useEffect(() => {
    return () => {
      if (userId && !loading) {
        const current = stateRef.current;
        saveToCloud(current.seasonSlots, current.manualOverrides, current.lockedSlots);
      }
    };
  }, [userId, loading, saveToCloud]);

  const updateSeasonSlot = (index: number, field: string, value: any) => {
    if (lockedSlots.includes(index)) return;
    setSeasonSlots(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  const updateOverride = (pId: string, startIndex: number, field: string, value: string) => {
    if (lockedSlots.includes(startIndex)) return;
    setManualOverrides((prev: any) => {
      const newPartOverrides = { ...(prev[pId] || {}) };
      if (field === 'lvl') {
        for (let i = startIndex; i < seasonSlots.length; i++) {
          if (lockedSlots.includes(i)) continue;
          newPartOverrides[i] = { ...(newPartOverrides[i] || {}), lvl: value };
        }
      } else {
        newPartOverrides[startIndex] = { ...(newPartOverrides[startIndex] || {}), [field]: value };
      }
      return { ...prev, [pId]: newPartOverrides };
    });
  };

  const toggleLock = (index: number) => {
    setLockedSlots(prev => prev.includes(index) ? prev.filter(x => x !== index) : [...prev, index]);
  };

  const resetTrackSlot = (index: number) => {
    if (lockedSlots.includes(index)) return;
    if (!confirm(`Tem certeza que deseja limpar os dados de CTR e Teste para ${seasonSlots[index].name}?`)) return;
    setSeasonSlots(prev => prev.map((slot, i) => i === index ? { ...slot, ctr: 0, testLaps: 0 } : slot));
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  
  const handleMobileTabClick = (idx: number) => {
      setMobileActiveTab(idx);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#050505]">
      <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
      <span className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase tracking-tighter">Sincronizando...</span>
    </div>
  );

  return (
    <div className="p-0 sm:p-8 space-y-4 sm:space-y-6 text-slate-200 pb-40 bg-[#050505] min-h-screen">
      
      {/* HEADER GERAL */}
      <div className="bg-zinc-900/40 backdrop-blur-2xl border-b sm:border border-white/5 p-4 sm:p-6 sm:rounded-[2.5rem] flex flex-col xl:flex-row justify-between items-center gap-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-5 z-10 w-full sm:w-auto justify-center sm:justify-start">
          <div className="hidden sm:block p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <Gauge size={28} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter leading-none text-white text-center sm:text-left">Planejamento</h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
               <Cloud size={10} className={saving ? 'text-amber-500 animate-pulse' : 'text-emerald-500'} />
               <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{saving ? 'Salvando...' : 'Sincronizado'}</p>
            </div>
          </div>
        </div>

        {/* Desktop Stats */}
        <div className="hidden lg:flex flex-1 justify-center w-full z-10 px-4">
            <div className="flex items-center gap-1 bg-black/40 px-6 py-2 rounded-2xl border border-white/5 shadow-inner backdrop-blur-sm">
                <div className="mr-3 p-1.5 bg-zinc-800/50 rounded-lg border border-white/5">
                    <User size={14} className="text-zinc-400" />
                </div>
                {driverStats.map((stat) => (
                    <div key={stat.label} className="flex flex-col items-center px-4 border-r border-white/5 last:border-0 relative">
                        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-wider mb-0.5">{stat.label}</span>
                        <span className="text-sm font-mono font-bold text-zinc-200">
                            {stat.val}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 bg-black/60 px-6 py-3 rounded-2xl border border-white/5 font-mono z-10 w-full sm:w-auto justify-between sm:justify-end">
          <button 
            onClick={() => { if(confirm("ATENÇÃO: Limpar nuvem? Isso resetará TUDO.")) { saveToCloud([], {}, []); window.location.reload(); }}} 
            className="mr-2 p-2 text-zinc-600 hover:text-rose-500 transition-colors group relative"
          >
            <Trash2 size={16}/>
          </button>
          <div className="text-right border-l border-white/10 pl-4">
            <span className="block text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Engine Status</span>
            <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-emerald-400 font-bold">{calculating ? 'CALC...' : 'Pronto'}</span>
                {calculating && <Loader2 size={14} className="animate-spin text-amber-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP VIEW (TABELA GRANDE) --- */}
      <div className="hidden md:block bg-zinc-900/20 border border-white/5 rounded-[3rem] overflow-hidden backdrop-blur-md shadow-3xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black/60">
                <th className="sticky left-0 z-30 bg-[#080808] p-8 text-left border-b border-r border-white/10 min-w-[180px]">
                  <span className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.3em]">Peças</span>
                </th>
                {seasonSlots.map((slot, i) => {
                  const isLocked = lockedSlots.includes(i);
                  return (
                    <th key={i} className={`p-6 border-b border-white/5 min-w-[260px] border-r border-white/5 transition-all ${isLocked ? 'bg-black/40' : 'bg-zinc-900/20'}`}>
                      <div className="flex flex-col items-center gap-4">
                        <div className={`flex items-center justify-between gap-3 w-full px-4 py-2 rounded-xl border transition-all ${isLocked ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                          <div className="flex items-center gap-2 truncate">
                             <div className="relative w-5 h-3"><Image src={getFlagSrc(slot.name)} alt={slot.name} fill className="object-cover rounded-[1px]" unoptimized /></div>
                             <span className={`text-[10px] font-black uppercase italic truncate ${isLocked ? 'text-emerald-400' : 'text-zinc-300'}`}>#{i + 1} {slot.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isLocked && (<button onClick={() => resetTrackSlot(i)} className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"><Eraser size={14} /></button>)}
                            <button onClick={() => toggleLock(i)} className={`p-1.5 rounded-lg transition-all ${isLocked ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-600 hover:text-white'}`}>{isLocked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
                          </div>
                        </div>
                        <div className={`flex items-center gap-3 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
                          <InputHeader label="CTR" value={slot.ctr} onChange={(v:any) => updateSeasonSlot(i, 'ctr', v)} color="emerald" />
                          <InputHeader label="TESTE" value={slot.testLaps} onChange={(v:any) => updateSeasonSlot(i, 'testLaps', v)} color="amber" />
                          <div className="flex flex-col items-center">
                              <span className="text-[8px] font-black text-zinc-500 uppercase mb-1">Status</span>
                              <button onClick={() => updateSeasonSlot(i, 'testEnabled', !slot.testEnabled)} className={`h-8 px-3 rounded-lg border text-[10px] font-black transition-all ${slot.testEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>{slot.testEnabled ? 'ACTIVE' : 'OFF'}</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 w-full text-[8px] font-black text-zinc-600 uppercase mt-2 text-center tracking-widest border-t border-white/5 pt-3">
                           <span>Nível</span><span>Início</span><span>Desg.</span><span className="text-emerald-500/50">Final</span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CAR_PARTS.map((part, pIdx) => (
                <tr key={part.id} className="group hover:bg-emerald-500/[0.02] transition-colors border-b border-white/5">
                  <td className="sticky left-0 z-20 bg-[#080808] p-6 border-r border-white/10 group-hover:bg-[#0c0c0c]">
                    <div className="flex items-center gap-3">
                      <div className="text-zinc-600 group-hover:text-amber-400 transition-colors">{part.icon}</div>
                      <span className="font-black text-[10px] uppercase text-zinc-500 group-hover:text-white tracking-wider">{part.label}</span>
                    </div>
                  </td>
                  {seasonSlots.map((_, sIdx) => {
                    const isLocked = lockedSlots.includes(sIdx);
                    const data = results?.[part.id]?.[sIdx] || { wear: 0, final: 0 };
                    const prevFinal = sIdx > 0 ? results?.[part.id]?.[sIdx - 1]?.final : 0;
                    const override = manualOverrides[part.id]?.[sIdx] || {};
                    const finalVal = Math.round(Number(data.final)) || 0;
                    return (
                      <td key={sIdx} className={`p-3 border-r border-white/5 transition-all ${isLocked ? 'grayscale-[0.5] opacity-80' : ''}`}>
                        <div className={`grid grid-cols-4 items-center gap-2 bg-black/40 p-2.5 rounded-2xl border transition-all ${isLocked ? 'border-emerald-500/10' : 'border-white/[0.03]'}`}>
                          <input disabled={isLocked} type="text" placeholder="6" value={override.lvl || ""} onChange={(e) => updateOverride(part.id, sIdx, 'lvl', e.target.value.replace(/\D/g, ''))} className={`w-full bg-zinc-800/30 text-[11px] text-center font-mono rounded-md py-1 outline-none ${isLocked ? 'text-zinc-600' : 'text-white focus:ring-1 ring-amber-500/50'}`} />
                          <input disabled={isLocked} type="text" placeholder={(Math.round(Number(prevFinal)) || 0).toString()} value={override.start !== undefined ? override.start : ""} onChange={(e) => updateOverride(part.id, sIdx, 'start', e.target.value.replace(/\D/g, ''))} className={`w-full bg-zinc-800/30 text-[11px] text-center font-mono rounded-md py-1 outline-none ${isLocked ? 'text-zinc-600' : (override.start !== undefined ? 'text-amber-400' : 'text-zinc-500')}`} />
                          <div className={`text-[11px] font-bold italic text-center ${isLocked ? 'text-zinc-600' : 'text-zinc-100'}`}>{Math.round(Number(data.wear)) || 0}%</div>
                          <div className={`relative flex items-center justify-center h-8 rounded-lg font-black text-xs border ${isLocked ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-600' : finalVal > 90 ? 'bg-rose-500/20 text-rose-500 border-rose-500/30' : finalVal > 70 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {isLocked && <CheckCircle2 size={8} className="absolute -top-1 -right-1 text-emerald-500 bg-black rounded-full" />}
                            {finalVal}%
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MOBILE VIEW (OTIMIZADA E ESQUERDIZADA) --- */}
      <div className="block md:hidden pb-24 px-0">
        
        {/* Slider de Pistas - Cola na esquerda */}
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-4 pl-2 snap-x snap-mandatory scrollbar-none items-start justify-start w-full">
            {seasonSlots.map((slot, idx) => {
                const isActive = mobileActiveTab === idx;
                const isLocked = lockedSlots.includes(idx);
                return (
                    <button 
                        key={idx}
                        onClick={() => handleMobileTabClick(idx)}
                        className={`
                            snap-start flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all w-[72px] relative
                            ${isActive 
                                ? 'bg-zinc-800 border-amber-500/40 shadow-lg z-10' 
                                : 'bg-zinc-900/30 border-white/5 opacity-60'
                            }
                        `}
                    >
                         {isLocked && <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5 text-emerald-400 border border-emerald-500/20"><Lock size={8} /></div>}
                         <div className={`relative w-8 h-5 shadow-sm overflow-hidden rounded ${isActive ? 'ring-1 ring-white/10' : ''}`}>
                             <Image src={getFlagSrc(slot.name)} alt="flag" fill className="object-cover" unoptimized />
                         </div>
                         <div className="flex flex-col w-full text-center">
                           <span className={`text-[9px] font-black uppercase truncate w-full ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                              {slot.name.split(' ')[0]}
                           </span>
                           <span className="text-[7px] font-mono text-zinc-600">
                             #{idx+1}
                           </span>
                         </div>
                    </button>
                )
            })}
             <div className="w-2 flex-shrink-0" />
        </div>

        {/* Card Principal */}
        {seasonSlots.length > 0 && (
            <div className="bg-zinc-900/40 border-y border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Header (Pista + Inputs) */}
                <div className="bg-gradient-to-r from-black/60 to-black/20 p-4 border-b border-white/5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center border border-white/5">
                                 <div className="relative w-7 h-4"><Image src={getFlagSrc(seasonSlots[mobileActiveTab].name)} alt="flag" fill className="object-cover rounded-sm" unoptimized /></div>
                             </div>
                             <div>
                                 <h2 className="text-lg font-black italic uppercase text-white leading-none truncate max-w-[160px]">{seasonSlots[mobileActiveTab].name}</h2>
                                 <span className="text-[9px] text-amber-500 font-bold tracking-widest uppercase">Race #{mobileActiveTab + 1}</span>
                             </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!lockedSlots.includes(mobileActiveTab) && (
                                <button onClick={() => resetTrackSlot(mobileActiveTab)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/40 text-zinc-500 hover:text-rose-400 border border-white/5"><Eraser size={14} /></button>
                            )}
                            <button 
                                onClick={() => toggleLock(mobileActiveTab)} 
                                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${lockedSlots.includes(mobileActiveTab) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800/40 border-white/5 text-zinc-500'}`}
                            >
                                {lockedSlots.includes(mobileActiveTab) ? <Lock size={14} /> : <LockOpen size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className={`grid grid-cols-3 gap-2 w-full ${lockedSlots.includes(mobileActiveTab) ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="bg-zinc-800/30 rounded-lg p-2 border border-white/5 flex flex-col items-center">
                            <span className="text-[7px] text-zinc-500 font-black uppercase mb-0.5">CTR</span>
                            <input type="tel" value={seasonSlots[mobileActiveTab].ctr} onChange={(e) => updateSeasonSlot(mobileActiveTab, 'ctr', e.target.value)} className="w-full bg-transparent text-center font-mono text-base font-bold text-emerald-400 outline-none p-0" placeholder="0" />
                        </div>
                        <div className="bg-zinc-800/30 rounded-lg p-2 border border-white/5 flex flex-col items-center">
                            <span className="text-[7px] text-zinc-500 font-black uppercase mb-0.5">TESTE</span>
                            <input type="tel" value={seasonSlots[mobileActiveTab].testLaps} onChange={(e) => updateSeasonSlot(mobileActiveTab, 'testLaps', e.target.value)} className="w-full bg-transparent text-center font-mono text-base font-bold text-amber-400 outline-none p-0" placeholder="0" />
                        </div>
                        <button 
                            onClick={() => updateSeasonSlot(mobileActiveTab, 'testEnabled', !seasonSlots[mobileActiveTab].testEnabled)}
                            className={`rounded-lg p-2 border flex flex-col items-center justify-center ${seasonSlots[mobileActiveTab].testEnabled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}
                        >
                            <span className="text-[7px] font-black uppercase mb-0.5 text-zinc-500">STATUS</span>
                            <span className={`text-[10px] font-black ${seasonSlots[mobileActiveTab].testEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {seasonSlots[mobileActiveTab].testEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tabela de Peças - CORRIGIDA PARA OCUPAR A LARGURA TOTAL */}
                <div className="flex flex-col w-full overflow-hidden">
                    {/* Cabeçalho com frações (fr) em vez de pixels fixos */}
                    <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1fr] gap-2 px-3 py-2 bg-black/40 text-[8px] font-black uppercase text-zinc-600 tracking-wider border-b border-white/5 items-center text-center">
                        <div className="text-left pl-1">Peça</div>
                        <div>Lv</div>
                        <div>Ini</div>
                        <div>Des</div>
                        <div>Fim</div>
                    </div>
                    
                    <div className="divide-y divide-white/[0.03]">
                    {CAR_PARTS.map((part) => {
                         const sIdx = mobileActiveTab;
                         const isLocked = lockedSlots.includes(sIdx);
                         const data = results?.[part.id]?.[sIdx] || { wear: 0, final: 0 };
                         const prevFinal = sIdx > 0 ? results?.[part.id]?.[sIdx - 1]?.final : 0;
                         const override = manualOverrides[part.id]?.[sIdx] || {};
                         const finalVal = Math.round(Number(data.final)) || 0;

                         return (
                             // ROW com frações (fr) para ocupar 100% da largura
                             <div key={part.id} className={`grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1fr] gap-2 items-center px-3 py-2 ${isLocked ? 'opacity-40 grayscale-[0.3]' : ''}`}>
                                 
                                 {/* Coluna 1: Nome */}
                                 <div className="flex items-center gap-2 overflow-hidden pl-1">
                                     <div className="text-zinc-600 shrink-0">{part.icon}</div>
                                     <span className="text-[9px] font-bold text-zinc-300 uppercase truncate leading-none">{part.label}</span>
                                 </div>
                                 
                                 {/* Coluna 2: Level */}
                                 <div>
                                     <input disabled={isLocked} type="tel" placeholder="1" value={override.lvl || ""} onChange={(e) => updateOverride(part.id, sIdx, 'lvl', e.target.value.replace(/\D/g, ''))} className="w-full h-7 bg-zinc-800/40 rounded border border-white/5 text-center text-[11px] text-white font-mono focus:border-amber-500/50 outline-none p-0" />
                                 </div>
                                 
                                 {/* Coluna 3: Start */}
                                 <div>
                                     <input disabled={isLocked} type="tel" placeholder={(Math.round(Number(prevFinal)) || 0).toString()} value={override.start !== undefined ? override.start : ""} onChange={(e) => updateOverride(part.id, sIdx, 'start', e.target.value.replace(/\D/g, ''))} className={`w-full h-7 bg-zinc-800/40 rounded border border-white/5 text-center text-[11px] font-mono focus:border-amber-500/50 outline-none p-0 ${override.start !== undefined ? 'text-amber-400 font-bold' : 'text-zinc-500'}`} />
                                 </div>
                                 
                                 {/* Coluna 4: Wear */}
                                 <div className="text-center text-[9px] font-mono text-zinc-500">
                                    {Math.round(Number(data.wear))}%
                                 </div>
                                 
                                 {/* Coluna 5: End */}
                                 <div className="flex justify-center">
                                     <span className={`flex items-center justify-center w-full h-6 rounded text-[9px] font-black ${
                                         finalVal > 90 ? 'text-rose-500 bg-rose-500/10' : 
                                         finalVal > 70 ? 'text-amber-400 bg-amber-500/10' : 
                                         'text-emerald-400 bg-emerald-500/5'
                                     }`}>
                                         {finalVal}%
                                     </span>
                                 </div>
                             </div>
                         )
                    })}
                    </div>
                </div>
            </div>
        )}
      </div>

    </div>
  );
}

function InputHeader({ label, value, onChange, color }: any) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-black text-zinc-500 uppercase mb-1 tracking-wider">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} className={`w-12 h-8 bg-${color}-500/5 border border-${color}-500/20 rounded-xl text-center text-[12px] font-mono font-bold text-${color}-400 outline-none focus:border-${color}-500/50 transition-all shadow-inner`} />
    </div>
  );
}