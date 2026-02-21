// --- START OF FILE app/tests/page.tsx (ou o caminho equivalente) ---
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase'; 
import { useGame } from '../../context/GameContext'; 
import {
  Loader2, MapPin, ChevronDown, Search, X, ShieldCheck,
  Settings, Sun, CloudRain, ChevronLeft, ChevronRight, Zap, Timer, 
  User, CarFront, Wrench, HardHat, Fuel, Activity, Check, Lock, RotateCcw, ShieldAlert, Database, ArrowRight
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

const TEST_PRIORITIES = ["Nenhuma prioridade em especial", "Velocidade máxima", "Fazer curvas", "Cotovelos", "Frear", "Ultrapassagem", "Chicanes", "Testar os limites do carro", "Afinação do ajuste"];
const COMPONENTS = [ 
    { id: 'chassi', label: 'Chassi' }, { id: 'motor', label: 'Motor' }, { id: 'asaDianteira', label: 'Asa Dianteira' }, { id: 'asaTraseira', label: 'Asa Traseira' }, { id: 'assoalho', label: 'Assoalho' }, { id: 'laterais', label: 'Laterais' }, { id: 'radiador', label: 'Radiador' }, { id: 'cambio', label: 'Câmbio' }, { id: 'freios', label: 'Freios' }, { id: 'suspensao', label: 'Suspensão' }, { id: 'eletronicos', label: 'Eletrônicos' } 
];
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
        <div className="flex items-center gap-2 md:gap-4 h-6 w-full">
            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase w-20 md:w-24 truncate">{label}</span>
            <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-300" style={{ width: `${percentage}%` }}></div>
            </div>
            <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-10 md:w-12 h-6 text-center bg-black/40 border border-white/10 rounded text-[10px] font-bold text-white outline-none focus:border-indigo-500 transition-colors" />
        </div>
    );
}

export default function TestsPage() {
  const router = useRouter(); 
  
  // PUXANDO DADOS E STATUS DO NOVO CONTEXTO GLOBAL
  const { 
      driver: globalDriver, 
      car: globalCar, 
      techDirector, 
      staffFacilities, 
      desgasteModifier,
      isGlobalLoading, // <-- NOVO
      isDataSynced     // <-- NOVO
  } = useGame();
  
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

  // --- ESTADO PARA DESGASTE DETALHADO ---
  const [partWearDetails, setPartWearDetails] = useState<any>(null);

  const [lockedStints, setLockedStints] = useState<Record<number, boolean>>({});
  const [frozenResults, setFrozenResults] = useState<any[]>(Array(8).fill(null));

  // --- VERIFICAÇÃO RIGOROSA DE DADOS DO CONTEXTO ---
  const isContextValid = useMemo(() => {
    // 1. Piloto existe e tem talento?
    const driverOk = globalDriver && typeof globalDriver.talento === 'number' && globalDriver.talento > 0;
    
    // 2. Carro existe, tem 11 peças E o nível não está zerado?
    // (Verificamos a primeira peça 'Chassi'. Se for nível 0, é dado falso/inicial)
    const carOk = Array.isArray(globalCar) && globalCar.length >= 11 && globalCar[0].lvl > 0;
    
    return driverOk && carOk;
  }, [globalDriver, globalCar]);

  // --- VERIFICA SE SETUP ESTÁ FALTANDO ---
  const isSetupMissing = useMemo(() => {
    return setupIdeal.some(val => val === '--');
  }, [setupIdeal]);

  const totalLaps = useMemo(() => Object.values(testStints).reduce((acc: number, val) => acc + (Number(val) || 0), 0), [testStints]);

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

  // --- LÓGICA DE AVISO (LIMIT 90%) ---
  const hasTestingLimitWarning = useMemo(() => {
      if (!partWearDetails) return false;
      return Object.values(partWearDetails).some((part: any) => part.pre_race && part.pre_race > 90.4);
  }, [partWearDetails]);

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

  // --- SINCRONIZAÇÃO INTELIGENTE: GLOBAL -> LOCAL ---
  useEffect(() => {
    // 1. Sincroniza Piloto
    if (globalDriver && globalDriver.talento > 0) {
        // Se o piloto local não tem talento ou é 0, puxa do global
        if (!localDriver.talento || localDriver.talento === 0) {
            setLocalDriver({...globalDriver});
        }
    }

    // 2. Sincroniza Carro
    if (globalCar && globalCar.length > 0) {
        const isLocalEmpty = localCar.length === 0;
        
        // Verifica se o carro local está "estagnado" com dados iniciais (Nível 0 ou 1 e sem desgaste)
        // enquanto o carro global tem dados reais (Nível > 1 OU tem algum desgaste)
        const isLocalStale = localCar.length > 0 && 
                             (localCar[0].lvl <= 1 && localCar[0].wear === 0) && 
                             (globalCar[0].lvl > 1 || globalCar[0].wear > 0 || globalCar[1].wear > 0);

        // Se estiver vazio OU se estiver com dados "falsos", força a atualização
        if (isLocalEmpty || isLocalStale) {
            // Fazemos uma cópia profunda para garantir que a edição local não afete o global diretamente
            const deepCopy = globalCar.map(part => ({ ...part }));
            setLocalCar(deepCopy);
        }
    }
  }, [globalDriver, globalCar, isDataSynced]); // Adicionada dependência isDataSynced

  // --- CALCULO DE TESTE ---
  const runCalculations = useCallback(async () => {
    // Só roda o cálculo se os dados estiverem válidos E o contexto já tiver sincronizado
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
                test_laps: totalLaps,
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
  }, [userId, testTrack, localDriver, localCar, weather, inputs, supplierIndex, selectedCompound, testStints, priority, totalLaps, techDirector, staffFacilities, desgasteModifier, isContextValid, isDataSynced]);

  useEffect(() => {
    const debounce = setTimeout(runCalculations, 600);
    return () => clearTimeout(debounce);
  }, [runCalculations]);

  const getWearColor = (val: number) => {
    if(val > 90.4) return 'text-rose-500 font-black';
    if(val > 80) return 'text-amber-400';
    return 'text-emerald-400';
  };

  // 1. CARREGANDO DADOS GLOBAIS OU AUTH
  // AQUI ESTÁ O SEGREDO: Adicionamos "|| !isDataSynced" dentro do Loading.
  // Isso força a tela de carregamento a continuar girando até que a sincronização seja confirmada como TRUE.
  // Se o carregamento acabar e isDataSynced continuar false (erro real), tratamos no próximo if.
  if (isAuthLoading || isGlobalLoading) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#050507]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest animate-pulse">Sincronizando com a Garagem...</span>
            </div>
        </div>
    );
  }

  // 2. TELA DE BLOQUEIO - DADOS NÃO ENCONTRADOS
  // Agora este aviso só aparece se o loading acabou E o isDataSynced CONTINUOU false (ou seja, falhou mesmo).
  if (!isDataSynced) {
    return (
        <div className="flex flex-col h-screen items-center justify-center bg-[#050507] text-slate-300 p-6 relative overflow-hidden">
            {/* ... (seu código da tela de aviso mantém igual) ... */}
            <div className="relative z-10 max-w-lg w-full bg-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
                <div className="mx-auto w-16 h-16 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <Database size={24} className="text-amber-500" />
                </div>
                
                <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Sincronização Necessária</h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8 px-4">
                    Os dados do Piloto e Carro não foram encontrados na sua base de dados. <br/>
                    Acesse a Visão Geral para inicializar sua equipe.
                </p>

                <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(79,70,229,0.2)] hover:shadow-[0_10px_30px_rgba(79,70,229,0.4)] group">
                    <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                    Ir para Visão Geral e Sincronizar
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
  }

  // 3. PÁGINA NORMAL (DADOS VÁLIDOS)
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
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Circuito de Testes</span>
                 <TrackSelector currentTrack={testTrack} tracksList={tracks} onSelect={setTestTrack} />
               </div>
            </div>
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5 w-full md:w-auto justify-center md:justify-start">
                <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                <span className="text-[9px] font-black uppercase text-slate-400">{isSyncing ? 'Recalculando...' : 'Pronto para Teste'}</span>
            </div>
          </div>
          <button onClick={() => { setLocalDriver({...globalDriver}); setLocalCar([...globalCar]); }} className="text-indigo-400 hover:text-white transition-colors flex items-center gap-2 text-[9px] uppercase font-black px-3 py-1.5 border border-indigo-500/20 rounded hover:bg-indigo-500/10"><RotateCcw size={12}/> Resetar Dados</button>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL DO CONTEÚDO */}
      <div className="space-y-6 md:space-y-8">
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 items-stretch">
              
              {/* COLUNA 1: DADOS PISTA + ALERTA SETUP (INTERNO) */}
              <div className="space-y-6 flex flex-col">
                  <div className="bg-[#0b0b10] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl flex-1 flex flex-col justify-between">
                      <div>
                        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 border-b border-white/5 pb-4 flex items-center gap-2"><Settings size={14} className="text-indigo-500" /> Dados Pista de Testes</h2>
                        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
                            <button onClick={() => setWeather('Dry')} className={`py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${weather === 'Dry' ? 'bg-orange-500 border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300'}`}><Sun size={18} /><span className="text-[9px] font-black">SECO</span></button>
                            <button onClick={() => setWeather('Wet')} className={`py-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${weather === 'Wet' ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.3)] text-white' : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300'}`}><CloudRain size={18} /><span className="text-[9px] font-black">CHUVA</span></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6">
                            <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-indigo-400">Temp</label><input type="number" value={inputs.temp} onChange={e => setInputs({...inputs, temp: Number(e.target.value)})} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
                            <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-amber-500">Risco</label><input type="number" value={inputs.risk} onChange={e => setInputs({...inputs, risk: Number(e.target.value)})} className="bg-transparent text-amber-500 font-black text-sm w-full outline-none" /></div>
                            <div className="bg-black/40 border border-white/5 rounded-lg p-3 group hover:border-white/20 transition-all"><label className="text-[7px] font-black text-slate-500 uppercase block mb-1 group-hover:text-emerald-500">Pits</label><input type="number" value={inputs.pits} onChange={e => setInputs({...inputs, pits: Number(e.target.value)})} className="bg-transparent text-white font-black text-sm w-full outline-none" /></div>
                        </div>
                        <div className="mb-6">
                            <label className="text-[8px] font-black text-slate-500 uppercase mb-2 block tracking-widest">Prioridade do Teste</label>
                            <div className="relative"><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-4 pr-10 text-[10px] md:text-[11px] font-black text-white outline-none uppercase cursor-pointer appearance-none hover:bg-white/5 transition-colors">{TEST_PRIORITIES.map(opt => <option key={opt} value={opt} className="bg-[#0F0F13]">{opt.toUpperCase()}</option>)}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/></div>
                        </div>
                        <div className="mb-6">
                            <div className="bg-black/40 border border-white/10 rounded-xl h-14 flex items-center justify-between px-2 overflow-hidden select-none">
                                <button onClick={() => setSupplierIndex(prev => (prev - 1 + TYRE_SUPPLIERS.length) % TYRE_SUPPLIERS.length)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
                                <div className="flex-1 flex justify-center"><img src={`/tyres/${TYRE_SUPPLIERS[supplierIndex].toLowerCase()}.gif`} alt="supplier" className="h-8 w-auto object-contain drop-shadow-md" /></div>
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

                      {/* --- ALERTA: SETUP IDEAL AUSENTE (NO FINAL DA COLUNA) --- */}
                      {isSetupMissing && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3 group hover:bg-amber-500/15 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500 shrink-0">
                                    <ShieldAlert size={18} />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Setup Ideal Ausente</h4>
                                    <p className="text-[9px] text-slate-400 leading-tight mt-1">
                                        Os valores de setup para testes ainda não foram calculados.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => router.push('/dashboard/setup')} className="w-full bg-amber-500 hover:bg-amber-400 text-[#0F0F13] font-black text-[9px] uppercase py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/20">
                                <Wrench size={12} /> Ir para Calculadora
                            </button>
                        </motion.div>
                      )}

                  </div>
              </div>

              {/* COLUNA 2: ATRIBUTOS DO PILOTO */}
              <div className="space-y-6 flex flex-col">
                 <div className="bg-[#0b0b10] rounded-2xl border border-white/5 p-5 shadow-2xl flex-1 flex flex-col">
                    <h3 className="text-[10px] font-black text-white uppercase mb-6 pb-4 border-b border-white/5 flex items-center gap-2 tracking-widest"><User size={14} className="text-yellow-400"/> Atributos do Piloto</h3>
                    <div className="flex flex-col gap-y-4 pt-2">
                        {DRIVER_FIELDS.map(f => (
                            <DriverStatRow key={f.key} label={f.label} value={localDriver[f.key] || 0} max={f.max} onChange={(val:any) => setLocalDriver({...localDriver, [f.key]: val})} />
                        ))}
                    </div>
                 </div>
              </div>

              {/* COLUNA 3: DESGASTE DO CARRO */}
              <div className="space-y-6 flex flex-col">
                 <div className="bg-[#0b0b10] rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex-1">
                    <div className="p-5 border-b border-white/5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
                        <h3 className="text-[10px] font-black text-white uppercase flex items-center gap-2 tracking-widest"><CarFront size={14} className="text-indigo-400"/>Desgaste do Carro Stints Testes</h3>
                        <AnimatePresence>
                            {hasTestingLimitWarning && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                                    <ShieldAlert size={14} className="text-rose-500 animate-pulse" />
                                    <span className="text-[9px] font-black text-rose-500 uppercase">Limite Excedido (+90.4%)</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-[10px] text-left border-separate border-spacing-0 min-w-[350px]">
                            <thead>
                                <tr className="bg-white/5 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="px-3 py-3 border-b border-white/5">Componente</th>
                                    <th className="px-3 py-3 border-b border-white/5 text-center">Nível</th>
                                    <th className="px-3 py-3 border-b border-white/5 text-center">Atual</th>
                                    <th className="px-3 py-3 border-b border-white/5 text-center text-amber-500">Desg. Teste</th>
                                    <th className="px-3 py-3 border-b border-white/5 text-center">Estimado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {COMPONENTS.map((part, i) => {
                                    const lvl = localCar[i]?.lvl || 1;
                                    const currentWear = localCar[i]?.wear || 0;
                                    const testWear = partWearDetails ? partWearDetails[part.id]?.test_wear : 0;
                                    const preRace = partWearDetails ? partWearDetails[part.id]?.pre_race : currentWear;
                                    const isBroken = preRace > 90.4;

                                    return (
                                        <tr key={part.id} className={`group transition-colors ${isBroken ? 'bg-rose-500/5' : 'hover:bg-white/[0.02]'}`}>
                                            <td className="px-3 py-2.5 font-black text-slate-400 uppercase">{part.label}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex justify-center">
                                                    <input type="number" value={lvl} onChange={(e) => { const nc = [...localCar]; nc[i] = {...nc[i], lvl: Number(e.target.value)}; setLocalCar(nc); }} className="w-9 bg-black/40 border border-white/10 rounded text-center py-1 font-bold text-slate-300" />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex justify-center">
                                                    <input type="number" value={currentWear} onChange={(e) => { const nc = [...localCar]; nc[i] = {...nc[i], wear: Number(e.target.value)}; setLocalCar(nc); }} className="w-9 bg-black/40 border border-white/10 rounded text-center py-1 font-bold text-emerald-400" />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-amber-500 font-black">
                                                +{testWear.toFixed(1)}%
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`text-xs ${getWearColor(preRace)}`}>
                                                    {preRace.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                 </div>
              </div>
          </div>

          {/* SETUP HORIZONTAL */}
          <div className="bg-[#0b0b10] border border-white/5 rounded-2xl p-5 md:p-6 shadow-2xl">
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-5 flex items-center gap-2"><Wrench size={14} className="text-emerald-500" /> Setup Recomendado para Testes</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                  {TEST_SETUP_PARTS.map((label, idx) => (
                      <div key={label} className="flex flex-col items-center justify-center gap-1.5 bg-black/40 border border-white/5 rounded-xl p-3 md:p-4 hover:border-emerald-500/30 transition-colors group">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center group-hover:text-slate-300 transition-colors">{label}</span>
                          <span className="text-2xl font-black text-emerald-400 font-mono drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">{setupIdeal[idx] ?? '--'}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* PLANEJAMENTO MANUAL */}
          <div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
                  <div className="bg-white/5 p-4 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-[10px] uppercase text-white tracking-[0.2em] flex items-center gap-2"><HardHat size={14} className="text-amber-500"/> Planejamento de Stints</h3>
                        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded border border-white/10">
                            <Timer size={12} className="text-indigo-400" />
                            <span className="font-black text-[10px] text-indigo-400">{totalLaps} / 100 Voltas Totais</span>
                        </div>
                      </div>
                  </div>
                  
                  <div className="overflow-x-auto custom-scrollbar relative">
                      <table className="w-full text-[10px] border-separate border-spacing-y-1 min-w-[600px]">
                          <thead>
                              <tr className="text-slate-600 uppercase font-black text-[8px]">
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
                                  <td className="p-4 text-indigo-400 uppercase sticky left-0 z-20 bg-[#15151a] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">Nº Voltas</td>
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
                                  <td className="p-4 text-slate-500 uppercase flex items-center gap-2 sticky left-0 z-20 bg-[#0c0c10] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"><Activity size={12} /> Desg. Pneus/Sessão</td>
                                  {Array.from({ length: visibleStintsCount }).map((_, i) => {
                                      const data = lockedStints[i] ? frozenResults[i] : sheetData[i];
                                      return (<td key={i} className={`p-2 text-center font-black text-lg transition-colors ${lockedStints[i] ? 'text-emerald-400' : 'text-rose-500'}`}>{typeof data?.wear === 'number' ? `${data.wear.toFixed(1)}%` : '-'}</td>)
                                  })}
                              </tr>
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                  <td className="p-4 text-slate-500 uppercase flex items-center gap-2 sticky left-0 z-20 bg-[#0c0c10] border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"><Fuel size={12} /> Gasto de Comb.</td>
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