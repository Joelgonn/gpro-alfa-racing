'use client';
import { useState, useEffect, useCallback, useRef, useMemo, ChangeEvent } from 'react';
import { useGame } from '@/app/context/GameContext';
import {
  Settings, Gauge, Zap, HardHat, BarChart3, Loader2, MapPin,
  Sparkles, ChevronLeft, ChevronRight, Fuel, Wind, TrendingUp,
  ChevronDown, Search, X, ShieldCheck // Novos ícones para o seletor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TIPAGEM ---
type RaceOptions = { desgaste_pneu_percent: number; condicao: string; pneus_fornecedor: string; tipo_pneu: string; pitstops_num: number; ct_valor: number; avg_temp: number; };
type CompoundOption = { forcar_pits: string; forcar_ct: string; };
type CompoundOptions = Record<string, CompoundOption>;
type BoostInput = { volta: string | number | null };
type BoostLapsInput = { boost1: BoostInput; boost2: BoostInput; boost3: BoostInput };
type PersonalStintsInput = { [key: string]: string | number | null };
type InputsState = { race_options: RaceOptions; compound_options: CompoundOptions; boost_laps: BoostLapsInput; personal_stint_voltas: PersonalStintsInput; };

const TRACK_FLAGS: { [key: string]: string } = {
  // A
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at",
  // B
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  // C-D
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb",
  // E-F
  "Estoril": "pt", "Fiorano": "it", "Fuji": "jp",
  // G
  "Grobnik": "hr",
  // H
  "Hockenheim": "de", "Hungaroring": "hu",
  // I
  "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in", "Monaco": "mc",
  // J-K
  "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt",
  // L
  "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa",
  // M
  "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it",
  // N-O
  "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at",
  // P
  "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl",
  // R
  "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar",
  // S
  "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk",
  // T-V
  "Valencia": "es", "Vallelunga": "it",
  // Y-Z
  "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be"
};


// --- COMPONENTE DE SELEÇÃO CUSTOMIZADO ---
function TrackSelector({ currentTrack, tracksList, onSelect }: { currentTrack: string, tracksList: string[], onSelect: (t: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const filteredTracks = useMemo(() => tracksList.filter(t => t.toLowerCase().includes(search.toLowerCase())), [tracksList, search]);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-3 text-2xl text-white font-black tracking-tighter hover:text-indigo-400 transition-colors outline-none group">
                {currentTrack && currentTrack !== "Selecionar Pista" ? currentTrack.toUpperCase() : "SELECIONAR PISTA"}
                <ChevronDown className={`transition-transform duration-300 text-slate-500 group-hover:text-indigo-400 ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-2 w-[300px] bg-[#0F0F13] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input autoFocus type="text" placeholder="Buscar pista..." value={search} onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500/50 outline-none font-bold uppercase" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}
                            </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                            {filteredTracks.map(track => (
                                <button key={track} onClick={() => { onSelect(track); setIsOpen(false); setSearch(""); }}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-between group transition-all ${currentTrack === track ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                    <div className="flex items-center gap-3">
                                        {TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-5 h-3 object-cover rounded-sm shadow-sm" /> : <div className="w-5 h-3 bg-white/10 rounded-sm"></div>}
                                        {track}
                                    </div>
                                    {currentTrack === track && <ShieldCheck size={12} />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function StrategyPage() {
  const {
    track, updateTrack, raceAvgTemp, tracksList, tyreSuppliers,
    updateWeather, driver, updateDriver, car, updateCar
  } = useGame();

  const [inputs, setInputs] = useState<InputsState>({
    race_options: { desgaste_pneu_percent: 18, condicao: "Dry", pneus_fornecedor: "Pipirelli", tipo_pneu: "Medium", pitstops_num: 2, ct_valor: 0, avg_temp: 0 },
    compound_options: { "Extra Soft": { forcar_pits: "", forcar_ct: "" }, "Soft": { forcar_pits: "", forcar_ct: "" }, "Medium": { forcar_pits: "", forcar_ct: "" }, "Hard": { forcar_pits: "", forcar_ct: "" } },
    boost_laps: { boost1: { volta: null }, boost2: { volta: null }, boost3: { volta: null } },
    personal_stint_voltas: { stint1: null, stint2: null, stint3: null, stint4: null, stint5: null, stint6: null, stint7: null, stint8: null }
  });

  const [outputs, setOutputs] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');

  useEffect(() => {
    async function loadState() {
      try {
        const res = await fetch('/api/python?action=state');
        const json = await res.json();
        if (json.sucesso && json.data) {
          const d = json.data;
          if (d.current_track) updateTrack(d.current_track);
          if (d.weather) updateWeather(d.weather);
          if (d.driver) Object.entries(d.driver).forEach(([k, v]) => updateDriver(k as any, Number(v)));
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });

          const excelTemp = d.race_options?.avg_temp;
          const initialTemp = (excelTemp && excelTemp !== 0) ? excelTemp : raceAvgTemp;

          setInputs(prev => ({ ...prev, race_options: { ...prev.race_options, desgaste_pneu_percent: d.race_options?.desgaste_pneu_percent ?? prev.race_options.desgaste_pneu_percent, avg_temp: Number(initialTemp) || 0 }, }));
        }
      } catch (e) { console.error("Erro ao carregar estado:", e); }
      finally { setIsSyncing(false); }
    }
    loadState();
  }, []); // Removido dependências para executar apenas uma vez na montagem

  const fetchStrategy = useCallback(async (currInputs: InputsState, currentTrack: string) => {
    if (!currentTrack || currentTrack === "Selecionar Pista" || isSyncing) return;
    setLoading(true);
    try {
      const res = await fetch('/api/python?endpoint=strategy/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pista: currentTrack, driver: driver, car: car, ...currInputs }) });
      const data = await res.json();
      if (data.sucesso) setOutputs(data.data);
    } catch (e) { console.error("Erro ao calcular estratégia:", e); }
    finally { setLoading(false); }
  }, [isSyncing, driver, car]);

  useEffect(() => {
    if (!isSyncing) {
      const timer = setTimeout(() => fetchStrategy(inputs, track), 700);
      return () => clearTimeout(timer);
    }
  }, [inputs, track, fetchStrategy, isSyncing]);

  const handleInput = (section: keyof InputsState, field: string, value: any, subKey?: string) => {
    setInputs(prev => {
      const next = JSON.parse(JSON.stringify(prev)); // Deep copy to avoid mutation issues
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

  if (isSyncing) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#050507] text-indigo-400 gap-4">
      <div className="relative w-20 h-20"><div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div><div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
      <span className="font-black text-[10px] tracking-[0.4em] uppercase animate-pulse">Sincronizando_Engenharia</span>
    </div>
  );

  const currentStintData = activeTab === 'manual' ? outputs?.stints_personal : outputs?.stints_predefined;

  return (
    <div className="p-6 space-y-8 text-slate-300 pb-24 font-mono">
      {/* HUD HEADER ATUALIZADO */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 shadow-2xl relative z-40">
        <div className="bg-black/40 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
          <div className="flex items-center gap-8 w-full md:w-auto">
            <div className="relative group shrink-0">
              <div className="absolute -inset-2 bg-indigo-500/20 blur-xl rounded-full"></div>
              <div className="w-20 h-12 bg-zinc-900 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative z-10 shadow-lg">
                {track && TRACK_FLAGS[track] ? (
                  <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                ) : <span className="text-xl">🏁</span>}
              </div>
            </div>
            <div>
              <h2 className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <MapPin size={10} className="text-indigo-400" /> Circuito - Pista Atual
              </h2>
              <TrackSelector currentTrack={track} tracksList={tracksList} onSelect={updateTrack} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-bold text-emerald-500 uppercase">Cálculo_Ativo</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* CONFIGURATION SIDEBAR */}
        <div className="xl:col-span-4 space-y-8">
          <section className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
            <div className="bg-white/5 p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-white"><Settings size={14} className="text-indigo-400"/> Dados da Corrida</h3>
                {loading && <Loader2 className="animate-spin text-indigo-500" size={14} />}
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg">
                  {["Dry", "Wet"].map(c => (
                    <button key={c} onClick={() => handleInput('race_options', 'condicao', c)} className={`py-2 rounded font-black text-[10px] uppercase transition-all ${inputs.race_options.condicao === c ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>{c === 'Dry' ? '☀️ Pista Seca' : '🌧️ Pista Molhada'}</button>
                  ))}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                        <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2">Temp. Média</label>
                        <div className="flex items-center justify-between">
                            <input type="number" value={inputs.race_options.avg_temp} onChange={(e) => handleInput('race_options', 'avg_temp', Number(e.target.value))} className="bg-transparent font-black text-sm text-white outline-none w-12" />
                            <span className="text-[10px] text-indigo-500 font-bold">°C</span>
                        </div>
                    </div>
                    <ConfigInput label="Risco CTR" value={inputs.race_options.ct_valor} onChange={(v:any) => handleInput('race_options', 'ct_valor', v)} />
                    <ConfigInput label="Paradas" value={inputs.race_options.pitstops_num} onChange={(v:any) => handleInput('race_options', 'pitstops_num', v)} />
                </div>

                <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block tracking-widest">Fornecedor de Pneus</label>
                    <SupplierCarousel options={tyreSuppliers} value={inputs.race_options.pneus_fornecedor} onChange={(val: string) => handleInput('race_options', 'pneus_fornecedor', val)} />
                </div>

                <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-4 block text-center tracking-widest">Seleção de Composto</label>
                    <div className="flex justify-between items-center gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
                        {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(p => {
                            const isSelected = inputs.race_options.tipo_pneu === p;
                            const img = p === 'Extra Soft' ? 'super macio' : p === 'Soft' ? 'macio' : p === 'Medium' ? 'medio' : p === 'Hard' ? 'duro' : 'chuva';
                            return (
                                <button key={p} onClick={() => handleInput('race_options', 'tipo_pneu', p)} className={`relative group transition-all duration-500 ${isSelected ? 'scale-110' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}>
                                    {isSelected && <motion.div layoutId="pneu-select" className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-md" />}
                                    <img src={`/compound/${img}.png`} alt={p} className={`w-10 h-10 object-contain rounded-full relative z-10 border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'}`} />
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between mb-3">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Margem Segurança: (Desgaste)</label>
                        <span className="text-xs font-black text-indigo-400">{inputs.race_options.desgaste_pneu_percent}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={inputs.race_options.desgaste_pneu_percent} onChange={e => handleInput('race_options', 'desgaste_pneu_percent', Number(e.target.value))} className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
            </div>
          </section>

          {/* ... O RESTO DO CÓDIGO PERMANECE IGUAL ... */}
          <section className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
            <div className="bg-white/5 p-4 border-b border-white/5"><h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-white"><Zap size={14} className="text-amber-400"/> Ativação Boost - Ajuste Manual</h3></div>
            <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => {
                    const bKey = `boost${i}` as keyof BoostLapsInput;
                    return (
                        <div key={i} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5 group hover:border-amber-500/30 transition-all">
                            <span className="text-[9px] font-black text-slate-500 uppercase w-12 group-hover:text-amber-500">Boost: {i}</span>
                            <input type="number" placeholder="Volta" value={inputs.boost_laps[bKey]?.volta ?? ''} onChange={e => handleInput('boost_laps', 'volta', e.target.value, bKey)} className="w-14 bg-black/60 border border-white/10 rounded p-1.5 text-center font-black text-xs text-white focus:border-amber-500 outline-none" />
                            <div className="flex flex-col items-end w-28 leading-tight">
                                <span className="text-[7px] text-slate-600 font-black uppercase">Sequência / Stints</span>
                                <span className="text-[10px] text-amber-500 font-black tracking-tighter">{outputs?.boost_laps_outputs?.[bKey]?.stint || '---'} / {outputs?.boost_laps_outputs?.[bKey]?.voltas_list || '---'}</span>
                            </div>
                        </div>
                    )
                })}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-black/40 p-2 rounded border border-white/5 text-center">
                      <span className="text-[7px] text-slate-600 font-black block uppercase mb-1">S{i}_Comb</span>
                      <div className="text-white font-black text-[10px] leading-none mb-1">{outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val1 || '--'}</div>
                      <div className="text-amber-500 font-black text-[8px]">{outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val2 || '--'} B</div>
                    </div>
                  ))}
                </div>
            </div>
          </section>
        </div>

        {/* MAIN ANALYSIS AREA */}
        <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                    { l: "Voltas", v: outputs?.race_calculated_data?.voltas, i: <BarChart3 size={14}/> }, 
                    { l: "Cons_Comb", v: outputs?.race_calculated_data?.consumo_combustivel, i: <Fuel size={14}/> }, 
                    { l: "Índice_Desg", v: outputs?.race_calculated_data?.desgaste_pneu_str, i: <Wind size={14}/> }, 
                    { l: "Tempo_Pit", v: outputs?.race_calculated_data?.pit_io, unit: "s", i: <Zap size={14}/> }, 
                    { l: "TCD_Corrida", v: outputs?.race_calculated_data?.tcd_corrida, unit: "s", i: <TrendingUp size={14}/> },
                ].map((item, idx) => (
                    <div key={idx} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:border-indigo-500/40 transition-all group">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5 group-hover:text-indigo-400">
                            {item.i} {item.l}
                        </span>
                        <span className="text-lg font-black text-white">{fmt(item.v, 2, item.unit)}</span>
                    </div>
                ))}
            </div>

            <section className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
                <div className="bg-white/5 p-4 border-b border-white/5"><h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-white"><Gauge size={14} className="text-emerald-400"/> Análise da Performance para Compostos</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-black/20 text-slate-500 uppercase font-black text-[9px] tracking-[0.2em] border-b border-white/5">
                                <th className="p-4 text-left">Composto</th>
                                <th className="p-4 text-center">Nº Paradas</th>
                                <th className="p-4 text-center bg-white/5">Forçar_Pits</th>
                                <th className="p-4 text-center bg-white/5">Forçar_CT</th>
                                <th className="p-4 text-center">Comb.</th>
                                <th className="p-4 text-center">Desg.</th>
                                <th className="p-4 text-center">Gap</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(c => {
                                if(inputs.race_options.condicao === "Dry" && c === "Rain") return null;
                                if(inputs.race_options.condicao === "Wet" && c !== "Rain") return null;
                                const d = outputs?.compound_details_outputs?.[c];
                                const isBest = d?.total?.toString().toLowerCase() === "best" || d?.total === 0;
                                return (
                                    <tr key={c} className={`transition-colors hover:bg-white/[0.02] ${isBest ? 'bg-emerald-500/[0.03]' : ''}`}>
                                        <td className="p-4 font-black text-white flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${c==='Extra Soft'?'bg-rose-500 shadow-rose-500':c==='Soft'?'bg-amber-400 shadow-amber-400':c==='Medium'?'bg-white shadow-white':c==='Hard'?'bg-sky-400 shadow-sky-400':'bg-blue-500 shadow-blue-500'}`}></div>
                                            {c.toUpperCase()}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-400">{fmt(d?.req_stops, 0)}</td>
                                        <td className="p-3 text-center bg-black/20"><input type="number" className="w-full bg-black/40 border border-white/10 rounded p-1 text-center font-black text-white focus:border-indigo-500 outline-none text-[10px]" value={inputs.compound_options[c]?.forcar_pits ?? ''} onChange={(e) => handleInput('compound_options', 'forcar_pits', e.target.value, c)} /></td>
                                        <td className="p-3 text-center bg-black/20"><input type="number" className="w-full bg-black/40 border border-white/10 rounded p-1 text-center font-black text-white focus:border-indigo-500 outline-none text-[10px]" value={inputs.compound_options[c]?.forcar_ct ?? ''} onChange={(e) => handleInput('compound_options', 'forcar_ct', e.target.value, c)} /></td>
                                        <td className="p-4 text-center text-indigo-400 font-bold">{fmt(d?.fuel_load, 0, 'L')}</td>
                                        <td className="p-4 text-center text-slate-500 font-bold">{fmt(d?.tyre_wear, 1, '%')}</td>
                                        <td className="p-4 text-center font-black">
                                            {isBest ? <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 text-[9px]">Ideal</span> : <span className="text-slate-500 tracking-tighter">+{fmt(d?.total, 1, 's')}</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
            
            {/* ... O RESTO DO CÓDIGO PERMANECE IGUAL ... */}
            <section className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden">
                <div className="bg-white/5 p-2 flex items-center gap-2 border-b border-white/5 px-4">
                    <button onClick={() => setActiveTab('auto')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'auto' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Sparkles size={14}/> Ajuste Automatico</button>
                    <button onClick={() => setActiveTab('manual')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'manual' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><HardHat size={14}/> Ajuste Manual</button>
                </div>
                <div className="overflow-x-auto p-4">
                    <table className="w-full text-[10px] border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-slate-600 uppercase font-black text-[8px] tracking-widest">
                                <th className="text-left p-3 w-32">Stints</th>
                                {Array.from({length:8}).map((_,i)=><th key={i} className="p-2 text-center">Stint {i+1}</th>)}
                                <th className="p-3 text-right bg-white/5 rounded-t-lg">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-white/5">
                                <td className="p-4 font-black text-indigo-400 uppercase">Nº de Voltas</td>
                                {Array.from({length:8}).map((_,i) => {
                                    const st = `stint${i+1}`;
                                    return (
                                        <td key={st} className="p-2 text-center">
                                            {activeTab === 'manual' ? (
                                                <input type="number" value={inputs.personal_stint_voltas[st] ?? ''} onChange={e => handleInput('personal_stint_voltas', st, e.target.value)} className="w-10 bg-black/40 border border-white/10 rounded p-1 text-center font-black text-white focus:border-amber-500 outline-none" />
                                            ) : (
                                                <span className="font-black text-white">{fmt(currentStintData?.voltas?.[st], 0)}</span>
                                            )}
                                        </td>
                                    )
                                })}
                                <td className="p-4 text-right font-black text-white bg-indigo-500/20">{fmt(currentStintData?.voltas?.total, 0)}</td>
                            </tr>
                            {[
                                {k: 'desg_final_pneu', l: 'Desg. Final Pneu', u: '%', c: 'text-slate-400'},
                                {k: 'comb_necessario', l: 'Combustível', u: 'L', c: 'text-indigo-400'},
                                {k: 'est_tempo_pit', l: 'Duração Pit', u: 's', c: 'text-slate-500'},
                                {k: 'voltas_em_bad', l: 'Voltas bad', u: '', c: 'text-rose-500'} 
                            ].map(row => (
                                <tr key={row.k} className="hover:bg-white/[0.01]">
                                    <td className="p-4 font-bold text-slate-500 uppercase">{row.l}</td>
                                    {Array.from({length:8}).map((_,i) => (
                                        <td key={i} className={`p-2 text-center font-bold ${row.c}`}>
                                            {fmt(currentStintData?.[row.k]?.[`stint${i+1}`], 1, row.u)}
                                        </td>
                                    ))}
                                    <td className={`p-4 text-right font-black bg-white/5 ${row.k === 'voltas_em_bad' ? 'text-rose-500' : 'text-white'}`}>
                                        {fmt(currentStintData?.[row.k]?.total, 1, row.u)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
      </div>

      <AnimatePresence>
        {loading && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-8 right-8 bg-indigo-600 text-white px-6 py-4 rounded-2xl flex items-center gap-4 font-black shadow-[0_10px_40px_rgba(79,70,229,0.5)] z-50 border border-indigo-400"
            >
                <Loader2 className="animate-spin" size={20} />
                <span className="text-[11px] tracking-widest uppercase">Calculando_Estratégia...</span>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUBCOMPONENTES ---
function ConfigInput({ label, value, onChange }: any) {
    return (
        <div className="bg-black/40 p-3 rounded-lg border border-white/5">
            <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2">{label}</label>
            <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-black text-sm text-white outline-none w-full" />
        </div>
    )
}

function SupplierCarousel({ value, options, onChange }: { value: string, options: string[], onChange: (v: string) => void }) {
    const DEFAULT_SUPPLIERS = ["Pipirelli", "Avonn", "Yokomama", "Dunnolop", "Contimental", "Badyear", "Hancock", "Michelini", "Bridgerock"];
    const activeOptions = (options && options.length > 0) ? options : DEFAULT_SUPPLIERS;
    const currentIndex = activeOptions.indexOf(value) !== -1 ? activeOptions.indexOf(value) : 0;

    const handleNext = () => onChange(activeOptions[(currentIndex + 1) % activeOptions.length]);
    const handlePrev = () => onChange(activeOptions[(currentIndex - 1 + activeOptions.length) % activeOptions.length]);

    return (
        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between group hover:border-indigo-500/50 transition-all shadow-inner select-none">
            <button onClick={(e) => { e.preventDefault(); handlePrev(); }} className="p-2 rounded-lg text-slate-600 hover:text-white hover:bg-white/5 transition-all active:scale-95"><ChevronLeft size={18} /></button>
            <div className="flex-1 flex flex-col items-center justify-center h-16 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div key={value} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col items-center">
                        <img src={`/tyres/${value?.toLowerCase().trim()}.gif`} alt={value} className="h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" onError={(e) => { e.currentTarget.src = `/tyres/default.gif`; }} />
                        <span className="text-[10px] font-black uppercase text-white tracking-[0.2em] mt-2 text-center">{value}</span>
                    </motion.div>
                </AnimatePresence>
            </div>
            <button onClick={(e) => { e.preventDefault(); handleNext(); }} className="p-2 rounded-lg text-slate-600 hover:text-white hover:bg-white/5 transition-all active:scale-95"><ChevronRight size={18} /></button>
        </div>
    )
}