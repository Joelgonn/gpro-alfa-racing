'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { 
  Loader2, Gauge, Cloud, Lock, LockOpen, 
  Settings2, Zap, Activity, ShieldAlert, Thermometer,
  CheckCircle2, Trash2, User, Eraser, Star, Crown, Sparkles
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

const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  return texto.toString().trim().toLowerCase();
};

const extrairNomePista = (trackName: string) => {
  if (!trackName) return "";
  return trackName.replace(/\s*GP\s*\([^)]*\)\s*$/i, '').trim();
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
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
  
  const [mobileActiveTab, setMobileActiveTab] = useState(0);
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(true);

  const hasCalculatedRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const calendarLoadedRef = useRef(false);

  const driverStats = [
    { label: 'CON', val: driver?.concentracao || 0, full: 'Concentração' },
    { label: 'TAL', val: driver?.talento || 0, full: 'Talento' },
    { label: 'AGR', val: driver?.agressividade || 0, full: 'Agressividade' },
    { label: 'EXP', val: driver?.experiencia || 0, full: 'Experiência' },
    { label: 'TEC', val: driver?.tecnica || 0, full: 'Técnica' },
    { label: 'RES', val: driver?.resistencia || 0, full: 'Resistência' },
    { label: 'PES', val: driver?.peso || 0, unit: 'kg', full: 'Peso' },
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

  // Carregar Calendário GPRO
  useEffect(() => {
    async function loadCalendar() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id ?? null;
        
        if (!currentUserId) {
          setLoadingCalendar(false);
          setLoading(false);
          return;
        }

        setUserId(currentUserId);

        const url = currentUserId 
          ? `/api/calendar?userId=${currentUserId}`
          : '/api/calendar';
        
        const res = await fetch(url);
        const apiData = await res.json();
        
        if (apiData.sucesso && apiData.calendarRaw?.events) {
          const events = apiData.calendarRaw.events;
          const raceEvents = events.filter((e: any) => e.eventType === 'R');
          
          const mappedRaces = raceEvents.map((event: any, index: number) => {
            const trackName = extrairNomePista(event.trackName || '');
            const trackData = apiData.tracks?.find((t: any) => 
              normalizarTexto(t.name) === normalizarTexto(trackName)
            );
            
            return {
              name: trackName,
              trackFullName: event.trackName || '',
              trackId: String(event.trackId || ''),
              date: event.dateEvent || '',
              isCurrentRace: Boolean(event.isCurrentRace),
              isFavTrack: Boolean(event.isFavTrack),
              natCode: event.trackNatCode || '',
              power: trackData?.power || 0,
              handling: trackData?.handling || 0,
              accel: trackData?.accel || 0,
              downforce: trackData?.downforce || '',
              overtaking: trackData?.overtaking || '',
              suspension: trackData?.suspension || '',
              grip: trackData?.grip || '',
              fuel: trackData?.fuel || '',
              wear: trackData?.wear || '',
              laps: trackData?.laps || 0,
              lapLen: trackData?.lapLen || 0,
              dist: trackData?.dist || 0,
              avgSpeed: trackData?.avgSpeed || 0,
              corners: trackData?.corners || 0,
              pit: trackData?.pit || 0,
              ctr: 0,
              testLaps: 0,
              testEnabled: true,
            };
          });
          
          setCalendarData(apiData);
          setSeasonSlots(mappedRaces);
          calendarLoadedRef.current = true;
        } else {
          console.warn('Não foi possível carregar o calendário');
        }
      } catch (error) {
        console.error('Erro ao carregar calendário:', error);
      } finally {
        setLoadingCalendar(false);
      }
    }

    loadCalendar();
  }, []);

  // Carregar Dados Salvos
  useEffect(() => {
    async function loadSavedData() {
      if (!userId || loadingCalendar || seasonSlots.length === 0) return;

      try {
        const res = await fetch('/api/python/get_planning', { 
          headers: { 'user-id': userId } 
        });
        const cloud = await res.json();

        if (cloud.sucesso && cloud.data && Object.keys(cloud.data).length > 0) {
          const savedSlots = cloud.data.seasonSlots || [];
          const savedOverrides = cloud.data.manualOverrides || {};
          const savedLocks = cloud.data.lockedSlots || [];

          if (savedSlots.length > 0 && seasonSlots.length > 0) {
            const mergedSlots = seasonSlots.map((slot, index) => {
              const saved = savedSlots[index];
              if (saved) {
                return {
                  ...slot,
                  power: slot.power || saved.power || 0,
                  handling: slot.handling || saved.handling || 0,
                  accel: slot.accel || saved.accel || 0,
                  downforce: slot.downforce || saved.downforce || '',
                  overtaking: slot.overtaking || saved.overtaking || '',
                  suspension: slot.suspension || saved.suspension || '',
                  grip: slot.grip || saved.grip || '',
                  fuel: slot.fuel || saved.fuel || '',
                  wear: slot.wear || saved.wear || '',
                  laps: slot.laps || saved.laps || 0,
                  lapLen: slot.lapLen || saved.lapLen || 0,
                  dist: slot.dist || saved.dist || 0,
                  avgSpeed: slot.avgSpeed || saved.avgSpeed || 0,
                  corners: slot.corners || saved.corners || 0,
                  pit: slot.pit || saved.pit || 0,
                  ctr: saved.ctr || 0,
                  testLaps: saved.testLaps || 0,
                  testEnabled: saved.testEnabled !== undefined ? saved.testEnabled : true,
                  isCurrentRace: slot.isCurrentRace || saved.isCurrentRace || false,
                  isFavTrack: slot.isFavTrack || saved.isFavTrack || false,
                };
              }
              return slot;
            });
            setSeasonSlots(mergedSlots);
            hasCalculatedRef.current = false;
          }

          setManualOverrides(savedOverrides);
          setLockedSlots(savedLocks);
        }
      } catch (error) {
        console.error("Erro ao carregar dados salvos:", error);
      }
      
      setLoading(false);
    }

    loadSavedData();
  }, [userId, loadingCalendar, seasonSlots.length]);

  // Função de Cálculo do Motor Python
  const fetchCalculo = useCallback(async () => {
    if (seasonSlots.length === 0 || !userId || hasCalculatedRef.current) return;
    hasCalculatedRef.current = true;
    
    setCalculating(true);
    try {
      const res = await fetch('/api/python/planning_calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({ 
          driver, 
          seasonSlots: seasonSlots.map(slot => ({
            ...slot,
            power: slot.power || 0,
            handling: slot.handling || 0,
            accel: slot.accel || 0,
            wear: slot.wear || '',
            fuel: slot.fuel || '',
            laps: slot.laps || 0,
            lapLen: slot.lapLen || 0,
          })),
          manualOverrides 
        })
      });
      const data = await res.json();
      if (data.sucesso) setResults(data.data);
    } catch (error) {
      console.error('Erro no cálculo:', error);
    } finally { 
      setCalculating(false); 
    }
  }, [seasonSlots, manualOverrides, driver, userId]);

  useEffect(() => {
    if (loading || !userId || seasonSlots.length === 0) return;
    if (hasCalculatedRef.current) return;
    
    const timer = setTimeout(() => {
      fetchCalculo();
    }, 500);
    return () => clearTimeout(timer);
  }, [loading, userId, seasonSlots.length, fetchCalculo]);

  // Salvar no Cloud GPRO Database
  const saveToCloud = useCallback(async (slots: any, overrides: any, locks: number[]) => {
    if (!userId) return;
    setSaving(true);
    try {
      const slotsToSave = slots.map((slot: any) => ({
        name: slot.name,
        trackId: slot.trackId,
        power: slot.power || 0,
        handling: slot.handling || 0,
        accel: slot.accel || 0,
        downforce: slot.downforce || '',
        overtaking: slot.overtaking || '',
        suspension: slot.suspension || '',
        grip: slot.grip || '',
        fuel: slot.fuel || '',
        wear: slot.wear || '',
        laps: slot.laps || 0,
        lapLen: slot.lapLen || 0,
        dist: slot.dist || 0,
        avgSpeed: slot.avgSpeed || 0,
        corners: slot.corners || 0,
        pit: slot.pit || 0,
        ctr: slot.ctr || 0,
        testLaps: slot.testLaps || 0,
        testEnabled: slot.testEnabled !== undefined ? slot.testEnabled : true,
        isCurrentRace: slot.isCurrentRace || false,
        isFavTrack: slot.isFavTrack || false,
        date: slot.date || '',
        trackFullName: slot.trackFullName || '',
        natCode: slot.natCode || '',
      }));

      await fetch('/api/python/save_planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        keepalive: true, 
        body: JSON.stringify({
          planning: { 
            seasonSlots: slotsToSave, 
            manualOverrides: overrides, 
            lockedSlots: locks 
          }
        })
      });
    } catch (e) {
      console.error("Erro ao salvar:", e);
    } finally { 
      setSaving(false); 
    }
  }, [userId]);

  // Auto-Save do Planejamento
  useEffect(() => {
    if (loading || !userId) return;
    const saveTimer = setTimeout(() => {
      saveToCloud(seasonSlots, manualOverrides, lockedSlots);
    }, 1000); 
    return () => clearTimeout(saveTimer);
  }, [manualOverrides, seasonSlots, lockedSlots, saveToCloud, loading, userId]);

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
    if (!confirm(`Tem certeza que deseja limpar os dados de CTR e Teste para ${seasonSlots[index]?.name || 'esta pista'}?`)) return;
    setSeasonSlots(prev => prev.map((slot, i) => i === index ? { ...slot, ctr: 0, testLaps: 0 } : slot));
  };

  const handleMobileTabClick = (idx: number) => {
    setMobileActiveTab(idx);
  };

  return (
    <div className="p-0 sm:p-8 space-y-4 sm:space-y-6 text-slate-700 pb-40 bg-[#eef2f6] min-h-screen font-mono">
      
      {/* HEADER GERAL COM TOQUE DOURADO (LIGHT GELO) */}
      <div className="bg-white border border-slate-200 p-4 sm:p-6 sm:rounded-3xl flex flex-col xl:flex-row justify-between items-center gap-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/[0.03] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/[0.02] blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-5 z-10 w-full sm:w-auto justify-center sm:justify-start">
          <div className="hidden sm:block p-4 bg-amber-50 rounded-3xl border border-amber-200 shadow-sm">
            <Crown size={28} className="text-amber-500" />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter leading-none text-slate-900 flex items-center justify-center sm:justify-start gap-2">
              Planejamento
              <Sparkles size={16} className="text-amber-500" />
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
               {calendarData?.calendarRaw?.group && (
                 <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-600 px-2.5 py-0.5 rounded-full font-black">
                   {calendarData.calendarRaw.group}
                 </span>
               )}
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                 {seasonSlots.length} corridas
               </span>
               {calendarData?.calendarRaw?.nextSeasonEvents?.length > 0 && (
                 <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-600 px-2.5 py-0.5 rounded-full font-black">
                   + {calendarData.calendarRaw.nextSeasonEvents.filter((e: any) => e.eventType === 'R').length} prox. temp.
                 </span>
               )}
            </div>
          </div>
        </div>

        {/* Desktop Stats (Light Gelo) */}
        <div className="hidden lg:flex flex-1 justify-center w-full z-10 px-4">
            <div className="flex items-center gap-1 bg-[#f8fafc] px-6 py-2 rounded-2xl border border-slate-200 shadow-inner hover:border-emerald-500/20 transition-all duration-300">
                <div className="mr-3 p-1.5 bg-white rounded-lg border border-slate-200">
                    <User size={14} className="text-slate-400" />
                </div>
                {driverStats.map((stat) => (
                    <div key={stat.label} className="flex flex-col items-center px-4 border-r border-slate-200 last:border-0 relative">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-0.5">{stat.label}</span>
                        <span className="text-sm font-mono font-bold text-slate-700">
                            {stat.val}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* Controle e Status do Engine */}
        <div className="hidden sm:flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-slate-200 font-mono z-10 w-full sm:w-auto justify-between sm:justify-end shadow-sm hover:border-emerald-500/10 transition-all duration-300">
          <button 
            onClick={() => { if(confirm("ATENÇÃO: Limpar nuvem? Isso resetará TUDO.")) { saveToCloud([], {}, []); window.location.reload(); }}} 
            className="mr-2 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
            title="Limpar planejador da nuvem"
          >
            <Trash2 size={16}/>
          </button>
          <div className="text-right border-l border-slate-200 pl-4 shrink-0">
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">Status de Cálculo</span>
            <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-emerald-600 font-bold">{calculating ? 'CALCULANDO' : 'PRONTO'}</span>
                {calculating && <Loader2 size={14} className="animate-spin text-emerald-600" />}
            </div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP VIEW (LIGHT GELO) --- */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm hover:border-emerald-500/10 transition-all duration-300">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-30 bg-slate-100 p-8 text-left border-b border-r border-slate-200 min-w-[180px] shadow-sm">
                  <span className="text-[11px] font-black uppercase text-slate-500 tracking-[0.3em] flex items-center gap-2">
                    <Settings2 size={14} className="text-emerald-600" />
                    Peças
                  </span>
                </th>
                {seasonSlots.map((slot, i) => {
                  const isLocked = lockedSlots.includes(i);
                  const isCurrent = slot?.isCurrentRace;
                  const isFavorite = slot?.isFavTrack;
                  return (
                    <th key={i} className={`p-6 border-b border-slate-200 min-w-[260px] border-r border-slate-200 transition-all ${isLocked ? 'bg-emerald-50/20' : 'bg-white'}`}>
                      <div className="flex flex-col items-center gap-4">
                        <div className={`flex items-center justify-between gap-3 w-full px-4 py-2 rounded-xl border transition-all hover:shadow-md ${
                          isLocked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800' : 
                          isCurrent ? 'bg-emerald-50 border-emerald-300' : 
                          isFavorite ? 'bg-amber-50 border-amber-300' : 
                          'bg-[#f8fafc] border-slate-200 hover:border-emerald-500/20'
                        }`}>
                          <div className="flex items-center gap-2 truncate">
                             {/* ✅ CORRIGIDO: getFlagSrc com o parâmetro correto mapeado dinamicamente */}
                             <div className="relative w-5 h-3 shadow-sm border border-slate-200/50 rounded-sm overflow-hidden"><Image src={getFlagSrc(slot.name)} alt={slot.name} fill className="object-cover rounded-[1px]" unoptimized /></div>
                             <span className={`text-[10px] font-black uppercase italic truncate ${isLocked ? 'text-emerald-700' : isCurrent ? 'text-emerald-700' : isFavorite ? 'text-amber-700 font-black' : 'text-slate-700'}`}>#{i + 1} {slot.name}</span>
                             {isCurrent && <span className="text-[7px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase font-black border border-emerald-300 shadow-sm animate-pulse">ATUAL</span>}
                             {isFavorite && !isCurrent && <span className="text-[7px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full uppercase font-black flex items-center gap-0.5 border border-amber-200"><Star size={8} className="fill-amber-500 text-amber-500" /> FAV</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {!isLocked && (<button onClick={() => resetTrackSlot(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"><Eraser size={14} /></button>)}
                            <button onClick={() => toggleLock(i)} className={`p-1.5 rounded-lg transition-all ${isLocked ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-800'}`}>{isLocked ? <Lock size={14} /> : <LockOpen size={14} />}</button>
                          </div>
                        </div>
                        <div className={`flex items-center gap-3 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
                          <InputHeader label="CTR" value={slot.ctr} onChange={(v:any) => updateSeasonSlot(i, 'ctr', v)} color="emerald" />
                          <InputHeader label="TESTE" value={slot.testLaps} onChange={(v:any) => updateSeasonSlot(i, 'testLaps', v)} color="amber" />
                          <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</span>
                              <button onClick={() => updateSeasonSlot(i, 'testEnabled', !slot.testEnabled)} className={`h-8 px-3 rounded-lg border text-[10px] font-black transition-all hover:shadow-md ${
                                slot.testEnabled ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 
                                'bg-rose-50 border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white'
                              }`}>{slot.testEnabled ? 'ACTIVE' : 'OFF'}</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 w-full text-[8px] font-black text-slate-400 uppercase mt-1 text-center tracking-widest border-t border-slate-200 pt-2">
                           <span>PWR</span><span>HND</span><span>ACC</span><span>WEAR</span><span>FUEL</span>
                        </div>
                        <div className="grid grid-cols-5 w-full text-[9px] font-bold text-slate-700 text-center">
                           <span>{slot.power || 0}</span>
                           <span>{slot.handling || 0}</span>
                           <span>{slot.accel || 0}</span>
                           <span className="text-amber-600 font-bold">{slot.wear || '-'}</span>
                           <span className="text-blue-600 font-bold">{slot.fuel || '-'}</span>
                        </div>
                        <div className="grid grid-cols-4 w-full text-[8px] font-black text-slate-400 uppercase mt-1 text-center tracking-widest border-t border-slate-200 pt-2">
                           <span>Nível</span><span>Início</span><span>Desg.</span><span className="text-amber-600/70">Final</span>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CAR_PARTS.map((part, pIdx) => (
                <tr key={part.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-200 bg-white">
                  <td className="sticky left-0 z-20 bg-slate-100 p-6 border-r border-slate-200 shadow-sm group-hover:bg-slate-200/50">
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400 group-hover:text-emerald-600 transition-colors">{part.icon}</div>
                      <span className="font-black text-[10px] uppercase text-slate-500 group-hover:text-slate-800 tracking-wider">{part.label}</span>
                    </div>
                  </td>
                  {seasonSlots.map((_, sIdx) => {
                    const isLocked = lockedSlots.includes(sIdx);
                    const data = results?.[part.id]?.[sIdx] || { wear: 0, final: 0 };
                    const prevFinal = sIdx > 0 ? results?.[part.id]?.[sIdx - 1]?.final : 0;
                    const override = manualOverrides[part.id]?.[sIdx] || {};
                    const finalVal = Math.round(Number(data.final)) || 0;
                    return (
                      <td key={sIdx} className={`p-3 border-r border-slate-200 transition-all ${isLocked ? 'grayscale-[0.5] opacity-80' : ''}`}>
                        <div className={`grid grid-cols-4 items-center gap-2 bg-[#f8fafc] p-2.5 rounded-2xl border transition-all hover:shadow-md ${
                          isLocked ? 'border-emerald-300' : 'border-slate-200 hover:border-emerald-500/20'
                        }`}>
                          <input disabled={isLocked} type="text" placeholder="6" value={override.lvl || ""} onChange={(e) => updateOverride(part.id, sIdx, 'lvl', e.target.value.replace(/\D/g, ''))} className={`w-full bg-white text-xs text-center font-mono rounded-md py-1 border border-slate-200 outline-none ${
                            isLocked ? 'text-slate-400' : 'text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 hover:bg-slate-50 transition-all shadow-sm'
                          }`} />
                          <input disabled={isLocked} type="text" placeholder={(Math.round(Number(prevFinal)) || 0).toString()} value={override.start !== undefined ? override.start : ""} onChange={(e) => updateOverride(part.id, sIdx, 'start', e.target.value.replace(/\D/g, ''))} className={`w-full bg-white text-xs text-center font-mono rounded-md py-1 border border-slate-200 outline-none transition-all shadow-sm ${
                            isLocked ? 'text-slate-400' : (override.start !== undefined ? 'text-amber-600 font-bold border-amber-300' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50')
                          }`} />
                          <div className={`text-xs font-bold italic text-center ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>{Math.round(Number(data.wear)) || 0}%</div>
                          <div className={`relative flex items-center justify-center h-8 rounded-lg font-black text-xs border transition-all hover:shadow-md ${
                            isLocked ? 'bg-emerald-50 border-emerald-300 text-emerald-600 shadow-sm' : 
                            finalVal > 90 ? 'bg-rose-50 text-rose-500 border-rose-300' : 
                            finalVal > 70 ? 'bg-amber-50 text-amber-600 border-amber-300' : 
                            'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm'
                          }`}>
                            {isLocked && <CheckCircle2 size={8} className="absolute -top-1 -right-1 text-emerald-500 bg-white rounded-full" />}
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

      {/* --- MOBILE VIEW COM TOQUE DOURADO (LIGHT GELO) --- */}
      <div className="block md:hidden pb-24 px-0 max-w-fit">
        {/* Slider de Pistas */}
        <div className="flex gap-2 overflow-x-auto pb-4 pl-2 snap-x snap-mandatory scrollbar-none items-start justify-start max-w-[315px]">
            {seasonSlots.map((slot, idx) => {
                const isActive = mobileActiveTab === idx;
                const isLocked = lockedSlots.includes(idx);
                const isCurrent = slot?.isCurrentRace;
                const isFavorite = slot?.isFavTrack;
                return (
                    <button 
                        key={idx}
                        onClick={() => handleMobileTabClick(idx)}
                        className={`
                            snap-start flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all w-[72px] relative
                            ${isActive 
                                ? 'bg-white border-emerald-500 shadow-md z-10 font-bold' 
                                : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80 hover:opacity-100 hover:border-slate-350'
                            }
                            ${isCurrent ? 'border-emerald-400' : ''}
                            ${isFavorite ? 'border-amber-400' : ''}
                        `}
                    >
                         {isLocked && <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 text-emerald-600 border border-emerald-300 shadow-sm"><Lock size={8} /></div>}
                         {isCurrent && !isLocked && <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5"><CheckCircle2 size={8} className="text-white" /></div>}
                         {isFavorite && !isCurrent && !isLocked && <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5"><Star size={8} className="text-white fill-white" /></div>}
                         <div className={`relative w-8 h-5 shadow-sm overflow-hidden rounded transition-all ${isActive ? 'ring-2 ring-emerald-500/20' : ''}`}>
                             <Image src={getFlagSrc(slot.name)} alt="flag" fill className="object-cover" unoptimized />
                         </div>
                         <div className="flex flex-col w-full text-center">
                           <span className={`text-[10px] font-black uppercase truncate w-full ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                              {slot.name?.split(' ')[0] || '???'}
                           </span>
                           <span className="text-[8px] font-mono text-slate-400 font-bold">
                             #{idx+1}
                           </span>
                         </div>
                    </button>
                )
            })}
             <div className="w-2 flex-shrink-0" />
        </div>

        {/* Card Principal (Gelo Premium) */}
        {seasonSlots.length > 0 && (
            <div className="bg-white border-y border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:border-emerald-500/10 transition-all duration-300">
                
                {/* Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 max-w-[300px] relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/[0.01] rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center shrink-0 shadow-sm relative">
                                <div className="relative w-7 h-4">
                                  {/* ✅ CORRIGIDO: getFlagSrc com o parâmetro correto no mobile */}
                                  <Image 
                                    src={getFlagSrc(seasonSlots[mobileActiveTab]?.name)} 
                                    alt="flag" 
                                    fill 
                                    className="object-cover rounded-sm border border-slate-200" 
                                    unoptimized 
                                  />
                                </div>
                             </div>
                             <div>
                                <h2 className="text-lg font-black italic uppercase text-slate-900 leading-none truncate max-w-[160px] flex items-center gap-1.5">
                                  {seasonSlots[mobileActiveTab]?.name || 'Carregando...'}
                                  {seasonSlots[mobileActiveTab]?.isFavTrack && <Star size={12} className="text-amber-500 fill-amber-500" />}
                                </h2>
                                <span className="text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 mt-1.5 leading-none">
                                  {seasonSlots[mobileActiveTab]?.isCurrentRace ? (
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🔴 GP ATUAL</span>
                                  ) : seasonSlots[mobileActiveTab]?.isFavTrack ? (
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⭐ FAVORITA</span>
                                  ) : (
                                    <span className="text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Race #{mobileActiveTab + 1}</span>
                                  )}
                                </span>
                             </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!lockedSlots.includes(mobileActiveTab) && (
                                <button onClick={() => resetTrackSlot(mobileActiveTab)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition-all hover:shadow-lg"><Eraser size={14} /></button>
                            )}
                            <button 
                                onClick={() => toggleLock(mobileActiveTab)} 
                                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all hover:shadow-lg ${
                                  lockedSlots.includes(mobileActiveTab) ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-800'
                                }`}
                            >
                                {lockedSlots.includes(mobileActiveTab) ? <Lock size={14} /> : <LockOpen size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1 mb-3 text-[8px] font-black text-slate-400 uppercase text-center tracking-wider">
                        <span>PWR</span><span>HND</span><span>ACC</span><span>WEAR</span><span>FUEL</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 mb-3 text-[10px] font-bold text-slate-700 text-center">
                        <span>{seasonSlots[mobileActiveTab]?.power || 0}</span>
                        <span>{seasonSlots[mobileActiveTab]?.handling || 0}</span>
                        <span>{seasonSlots[mobileActiveTab]?.accel || 0}</span>
                        <span className="text-amber-600 font-bold">{seasonSlots[mobileActiveTab]?.wear || '-'}</span>
                        <span className="text-blue-600 font-bold">{seasonSlots[mobileActiveTab]?.fuel || '-'}</span>
                    </div>

                    <div className={`grid grid-cols-3 gap-2 w-full ${lockedSlots.includes(mobileActiveTab) ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="bg-white rounded-lg p-2 border border-slate-200 hover:border-emerald-500/20 transition-all hover:shadow-md flex flex-col items-center">
                            <span className="text-[8px] text-slate-400 font-black uppercase mb-1">CTR</span>
                            <input type="tel" value={seasonSlots[mobileActiveTab]?.ctr || 0} onChange={(e) => updateSeasonSlot(mobileActiveTab, 'ctr', e.target.value)} className="w-full bg-transparent text-center font-mono text-base font-bold text-emerald-600 outline-none p-0" placeholder="0" />
                        </div>
                        <div className="bg-white rounded-lg p-2 border border-slate-200 hover:border-emerald-500/20 transition-all hover:shadow-md flex flex-col items-center">
                            <span className="text-[8px] text-slate-400 font-black uppercase mb-1">TESTE</span>
                            <input type="tel" value={seasonSlots[mobileActiveTab]?.testLaps || 0} onChange={(e) => updateSeasonSlot(mobileActiveTab, 'testLaps', e.target.value)} className="w-full bg-transparent text-center font-mono text-base font-bold text-amber-600 outline-none p-0" placeholder="0" />
                        </div>
                        <button 
                            onClick={() => updateSeasonSlot(mobileActiveTab, 'testEnabled', !seasonSlots[mobileActiveTab]?.testEnabled)}
                            className={`rounded-lg p-2 border flex flex-col items-center justify-center transition-all hover:shadow-lg ${
                              seasonSlots[mobileActiveTab]?.testEnabled ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-rose-50 border-rose-300 text-rose-500 hover:bg-rose-500 hover:text-white'
                            }`}
                        >
                            <span className="text-[8px] font-black uppercase mb-1 text-slate-400">STATUS</span>
                            <span className={`text-[10px] font-black ${seasonSlots[mobileActiveTab]?.testEnabled ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {seasonSlots[mobileActiveTab]?.testEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tabela de Peças (Gelo) */}
                <div className="flex flex-col w-full overflow-hidden bg-white">
                    <div className="grid grid-cols-[100px_35px_40px_35px_40px] gap-1 px-3 py-2 bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-200 items-center text-center justify-start">
                        <div className="text-left pl-1 flex items-center gap-1.5">
                            <Settings2 size={10} className="text-emerald-600" />
                            Peça
                        </div>
                        <div>Lv</div>
                        <div>Ini</div>
                        <div>Des</div>
                        <div className="text-amber-600/70">Fim</div>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                    {CAR_PARTS.map((part) => {
                         const sIdx = mobileActiveTab;
                         const isLocked = lockedSlots.includes(sIdx);
                         const data = results?.[part.id]?.[sIdx] || { wear: 0, final: 0 };
                         const prevFinal = sIdx > 0 ? results?.[part.id]?.[sIdx - 1]?.final : 0;
                         const override = manualOverrides[part.id]?.[sIdx] || {};
                         const finalVal = Math.round(Number(data.final)) || 0;

                         return (
                             <div key={part.id} className={`grid grid-cols-[100px_35px_40px_35px_40px] gap-1 items-center px-3 py-2 justify-start ${isLocked ? 'opacity-40 grayscale-[0.3]' : ''}`}>
                                 <div className="flex items-center gap-2 overflow-hidden pl-1">
                                     <div className={`shrink-0 ${isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-emerald-600'}`}>{part.icon}</div>
                                     <span className="text-[10px] font-black text-slate-700 uppercase truncate leading-none">{part.label}</span>
                                 </div>
                                 <div>
                                     <input disabled={isLocked} type="tel" placeholder="1" value={override.lvl || ""} onChange={(e) => updateOverride(part.id, sIdx, 'lvl', e.target.value.replace(/\D/g, ''))} className={`w-full h-7 bg-white rounded border border-slate-200 text-center text-[11px] text-slate-800 font-mono focus:border-emerald-500 outline-none p-0 transition-all ${
                                       isLocked ? '' : 'hover:bg-slate-50 hover:border-emerald-300 shadow-sm'
                                     }`} />
                                 </div>
                                 <div>
                                     <input disabled={isLocked} type="tel" placeholder={(Math.round(Number(prevFinal)) || 0).toString()} value={override.start !== undefined ? override.start : ""} onChange={(e) => updateOverride(part.id, sIdx, 'start', e.target.value.replace(/\D/g, ''))} className={`w-full h-7 bg-white rounded border border-slate-200 text-center text-[11px] font-mono focus:border-emerald-500 outline-none p-0 transition-all ${
                                       isLocked ? '' : (override.start !== undefined ? 'text-amber-600 font-bold border-amber-300 hover:bg-slate-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50 shadow-sm')
                                     }`} />
                                 </div>
                                 <div className="text-center text-[10px] font-mono text-slate-400">
                                    {Math.round(Number(data.wear))}%
                                 </div>
                                 <div className="flex justify-center">
                                     <span className={`flex items-center justify-center w-full h-6 rounded text-[10px] font-black border transition-all ${
                                         finalVal > 90 ? 'text-rose-600 bg-rose-50 border-rose-200' : 
                                         finalVal > 70 ? 'text-amber-400 bg-amber-50 border-amber-200' : 
                                         'text-emerald-600 bg-emerald-50 border-emerald-100 shadow-sm'
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

// ============================================
// INPUT HEADER COMPONENT
// ============================================
function InputHeader({ label, value, onChange, color }: any) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-wider">{label}</span>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} 
        className={`w-12 h-8 bg-white border border-slate-200 rounded-xl text-center text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all shadow-sm hover:bg-slate-50`} 
      />
    </div>
  );
}