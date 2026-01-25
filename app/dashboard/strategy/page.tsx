'use client';
import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@/app/context/GameContext'; 
import { Settings, Gauge, Zap, HardHat, BarChart3, Loader2, MapPin, AlertCircle, Sparkles, ChevronLeft, ChevronRight, Thermometer, Fuel, Wind, Grip } from 'lucide-react'; 

// --- TIPAGEM ---
type RaceOptions = { desgaste_pneu_percent: number; condicao: string; pneus_fornecedor: string; tipo_pneu: string; pitstops_num: number; ct_valor: number; avg_temp: number; };
type CompoundOption = { forcar_pits: string; forcar_ct: string; };
type CompoundOptions = Record<string, CompoundOption>;
type BoostInput = { volta: string | number | null };
type BoostLapsInput = { boost1: BoostInput; boost2: BoostInput; boost3: BoostInput };
type PersonalStintsInput = { [key: string]: string | number | null };
type InputsState = { race_options: RaceOptions; compound_options: CompoundOptions; boost_laps: BoostLapsInput; personal_stint_voltas: PersonalStintsInput; };

const TRACK_FLAGS: { [key: string]: string } = {
  "A1-Ring": "at", "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar", "Fiorano": "it", "Estoril": "pt", "Fuji": "jp", "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu", "Imola": "it", "Indianapolis Oval": "us", "Indianapolis": "us", "Interlagos": "br", "Irungattukottai": "in", "Istanbul": "tr", "Jerez": "es", "Jyllands-Ringen": "dk", "Kaunas": "lt", "Kyalami": "za", "Laguna Seca": "us", "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it", "New Delhi": "in", "Nurburgring": "de", "Oesterreichring": "at", "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl", "Rafaela Oval": "ar", "Sakhir": "bh", "Sepang": "my", "Serres": "gr", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Slovakiaring": "sk", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Valencia": "es", "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be", "Jeddah": "sa", "Miami": "us", "Losail": "qa", "Las Vegas": "us",
};

export default function StrategyPage() {
  const { track, updateTrack, driver, updateDriver, car, updateCar, weather, updateWeather, raceAvgTemp, tracksList, tyreSuppliers } = useGame(); 

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
        const res = await fetch('/api/python/strategy/state');
        const json = await res.json();
        if (json.sucesso && json.data) {
          const d = json.data;
          if (d.current_track) updateTrack(d.current_track);
          if (d.weather) updateWeather(d.weather);
          if (d.driver) Object.entries(d.driver).forEach(([k, v]) => updateDriver(k as any, Number(v)));
          if (d.car) d.car.forEach((p: any, i: number) => { updateCar(i, 'lvl', p.lvl); updateCar(i, 'wear', p.wear); });
          const excelTemp = Number(d.race_options.avg_temp);
          const initialTemp = (excelTemp && excelTemp !== 0) ? excelTemp : raceAvgTemp;
          setInputs(prev => ({
            ...prev,
            race_options: { ...prev.race_options, ...d.race_options, avg_temp: initialTemp || 0 },
            compound_options: { ...prev.compound_options, ...d.compound_options },
            boost_laps: { ...prev.boost_laps, ...d.boost_laps },
            personal_stint_voltas: { ...prev.personal_stint_voltas, ...d.personal_stint_voltas }
          }));
        }
      } catch (e) { console.error(e); } finally { setIsSyncing(false); }
    }
    loadState();
  }, [raceAvgTemp, updateTrack, updateWeather, updateDriver, updateCar]);

  const fetchStrategy = useCallback(async (currInputs: InputsState, currentTrack: string) => {
    if (!currentTrack || currentTrack === "Selecionar Pista") return;
    if (isSyncing) return; 
    setLoading(true);
    try {
      const res = await fetch('/api/python/strategy/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pista: currentTrack, ...currInputs }) });
      const data = await res.json();
      if (data.sucesso) setOutputs(data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [isSyncing]);

  useEffect(() => {
    if (!isSyncing) {
      const timer = setTimeout(() => fetchStrategy(inputs, track), 700);
      return () => clearTimeout(timer);
    }
  }, [inputs, track, fetchStrategy, isSyncing]);

  const handleInput = (section: keyof InputsState, field: string, value: any, subKey?: string) => {
    setInputs(prev => {
      const next = { ...prev };
      if (subKey) (next[section] as any)[subKey] = { ...(next[section] as any)[subKey], [field]: value };
      else (next[section] as any)[field] = value;
      return next;
    });
  };

  const fmt = (v: any, d=1, s='') => {
    if (v === null || v === undefined || v === "" || v === "-") return "-";
    if (typeof v === 'string' && isNaN(Number(v.replace(',', '.')))) return v; 
    const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
    return n.toFixed(d).replace('.', ',') + s;
  };

  if (isSyncing) return <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400 gap-3"><Loader2 className="animate-spin" /> Sincronizando Engenharia...</div>;

  // Seleciona o conjunto de dados correto baseado na aba ativa
  const currentStintData = activeTab === 'manual' ? outputs?.stints_personal : outputs?.stints_predefined;

  return (
    <div className="p-4 md:p-6 space-y-6 text-slate-200 pb-24 animate-fadeIn font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/50 gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-lg"><BarChart3 size={28} className="text-white" /></div>
          <div><h1 className="text-2xl font-black tracking-tighter uppercase text-white">Engenheiro de <span className="text-purple-400">Estratégia</span></h1><p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Sistema Online</p></div>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col gap-2 min-w-[300px] group transition-all shadow-md">
          <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><MapPin size={12} className="text-purple-500" /> Circuito Ativo</label>
          <div className="relative flex items-center w-full">
            <div className="absolute left-3 pointer-events-none z-10 flex items-center justify-center h-full w-8">{track && TRACK_FLAGS[track] ? <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-6 h-auto shadow-sm rounded-[2px]" /> : <span className="text-lg opacity-50">🏁</span>}</div>
            <select value={track} onChange={(e) => updateTrack(e.target.value)} className="w-full h-10 pl-12 pr-10 bg-slate-950 text-white font-bold text-sm border border-slate-700 rounded-lg outline-none focus:border-purple-500 appearance-none transition-all cursor-pointer">
              <option value="Selecionar Pista">-- Escolher Pista --</option>
              {tracksList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs">▼</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700"><h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300"><Settings size={14}/> Opções de Corrida</h3></div>
            <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-2 bg-slate-900/30 p-1 rounded-lg border border-slate-700/50">
                  {["Dry", "Wet"].map(c => (
                    <button key={c} onClick={() => handleInput('race_options', 'condicao', c)} className={`py-2 rounded-md font-black text-xs uppercase transition-all ${inputs.race_options.condicao === c ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{c === 'Dry' ? '☀️ Seco' : '🌧️ Chuva'}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700 text-center">
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Temp. Média</label>
                        <div className="relative"><input type="number" value={inputs.race_options.avg_temp} onChange={(e) => handleInput('race_options', 'avg_temp', Number(e.target.value))} className="w-full bg-transparent text-center font-black text-sm text-white outline-none focus:text-purple-400" /><span className="absolute right-0 top-0 text-[10px] text-slate-500 font-bold pointer-events-none">°C</span></div>
                    </div>
                    <ConfigInput label="Risco CT" value={inputs.race_options.ct_valor} onChange={(v:any) => handleInput('race_options', 'ct_valor', v)} placeholder="0.0" />
                    <ConfigInput label="Paradas" value={inputs.race_options.pitstops_num} onChange={(v:any) => handleInput('race_options', 'pitstops_num', v)} placeholder="2" />
                </div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block ml-1">Fornecedor</label><SupplierCarousel options={tyreSuppliers} value={inputs.race_options.pneus_fornecedor} onChange={(val: string) => handleInput('race_options', 'pneus_fornecedor', val)} /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block ml-1 text-center">Pneu Base</label>
                    <div className="flex justify-between items-center gap-2 bg-slate-900/20 p-2 rounded-xl border border-slate-700/30">
                        {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(p => {
                            const isSelected = inputs.race_options.tipo_pneu === p;
                            const img = p === 'Extra Soft' ? 'super macio' : p === 'Soft' ? 'macio' : p === 'Medium' ? 'medio' : p === 'Hard' ? 'duro' : 'chuva';
                            return <button key={p} onClick={() => handleInput('race_options', 'tipo_pneu', p)} className={`relative w-11 h-11 rounded-full border-2 transition-all duration-300 ${isSelected ? 'border-purple-500 scale-110 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-transparent opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`} title={p}><img src={`/compound/${img}.png`} alt={p} className="w-full h-full object-contain rounded-full" /></button>
                        })}
                    </div>
                </div>
                <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-700/50"><div className="flex justify-between mb-2"><label className="text-[9px] font-bold text-slate-500 uppercase">Segurança (Wear)</label><span className="text-xs font-black text-purple-400">{inputs.race_options.desgaste_pneu_percent}%</span></div><input type="range" min="0" max="100" value={inputs.race_options.desgaste_pneu_percent} onChange={e => handleInput('race_options', 'desgaste_pneu_percent', Number(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" /></div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700"><h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300"><Zap size={14}/> Boost & Mini Stints</h3></div>
            <div className="p-5 space-y-4">
                {[1, 2, 3].map(i => {
                    const bKey = `boost${i}` as keyof BoostLapsInput;
                    return (
                        <div key={i} className="flex items-center justify-between bg-slate-900/40 p-2 rounded-lg border border-slate-700/50">
                            <span className="text-[10px] font-black text-slate-500 uppercase w-12">Lvl {i}</span>
                            <input type="number" placeholder="Volta" value={inputs.boost_laps[bKey]?.volta ?? ''} onChange={e => handleInput('boost_laps', 'volta', e.target.value, bKey)} className="w-16 bg-slate-800 border border-slate-600 rounded p-1 text-center font-bold text-xs text-white focus:border-purple-500 outline-none" />
                            <div className="flex flex-col items-end w-24 leading-tight"><span className="text-[8px] text-slate-600 font-black uppercase">Stint / Voltas</span><span className="text-[10px] text-purple-400 font-mono font-bold tracking-widest">{outputs?.boost_laps_outputs?.[bKey]?.stint || '-'} / {outputs?.boost_laps_outputs?.[bKey]?.voltas_list || '-'}</span></div>
                        </div>
                    )
                })}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-700/50">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-slate-950/30 p-1.5 rounded border border-slate-700/30 text-center leading-tight">
                      <span className="text-[8px] text-slate-600 font-black block uppercase">S{i}</span>
                      <div className="font-mono font-bold text-[10px] text-slate-300">
                        <div className="text-white">{outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val1 || '-'}</div>
                        <div className="text-purple-400 text-[9px]">{outputs?.boost_mini_stints_outputs?.[`stint${i}`]?.val2 || '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className="xl:col-span-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { l: "Voltas", v: outputs?.race_calculated_data?.voltas, i: <BarChart3 size={14}/> }, { l: "Cons. Fuel", v: outputs?.race_calculated_data?.consumo_combustivel, i: <Fuel size={14}/> }, { l: "Desg. Pneu", v: outputs?.race_calculated_data?.desgaste_pneu_str, i: <Wind size={14}/> }, { l: "Pit I/O", v: outputs?.race_calculated_data?.pit_io, unit: "s", i: <Zap size={14}/> }, { l: "TCD Race", v: outputs?.race_calculated_data?.tcd_corrida, unit: "s", i: <Grip size={14}/> },
                ].map((item, idx) => (
                    <div key={idx} className="bg-slate-800 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:border-purple-500/30 transition-all"><span className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">{item.i}{item.l}</span><span className="text-sm font-black text-white font-mono">{fmt(item.v, 2, item.unit)}</span></div>
                ))}
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="bg-slate-900/50 p-4 border-b border-slate-700"><h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300"><Gauge size={14}/> Análise de Performance</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-xs">
                    <thead><tr className="bg-slate-900/30 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700/50"><th className="p-3 text-left">Composto</th><th className="p-3 text-center">Stops</th><th className="p-3 text-center w-24 bg-slate-950/20">Forçar Pits</th><th className="p-3 text-center w-24 bg-slate-950/20">Forçar CT</th><th className="p-3 text-center">Fuel</th><th className="p-3 text-center">Desgaste</th><th className="p-3 text-center">Gap</th></tr></thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {["Extra Soft", "Soft", "Medium", "Hard", "Rain"].map(c => {
                            if(inputs.race_options.condicao === "Dry" && c === "Rain") return null;
                            if(inputs.race_options.condicao === "Wet" && c !== "Rain") return null;
                            const d = outputs?.compound_details_outputs?.[c];
                            const isBest = d?.total?.toString().toLowerCase() === "best" || d?.total === 0;
                            return (
                                <tr key={c} className={`transition-colors hover:bg-slate-700/10 ${isBest ? 'bg-emerald-950/10' : ''}`}>
                                    <td className="p-3 font-bold flex items-center gap-3"><div className={`w-2.5 h-2.5 rounded-full ${c==='Extra Soft'?'bg-red-500':c==='Soft'?'bg-yellow-400':c==='Medium'?'bg-white':c==='Hard'?'bg-sky-300':'bg-blue-400'}`}></div><span>{c}</span></td>
                                    <td className="p-3 text-center font-black text-white">{fmt(d?.req_stops, 0)}</td>
                                    <td className="p-2 text-center bg-slate-950/10"><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-center font-bold text-white focus:border-purple-500 outline-none" value={inputs.compound_options[c]?.forcar_pits ?? ''} onChange={(e) => handleInput('compound_options', 'forcar_pits', e.target.value, c)} /></td>
                                    <td className="p-2 text-center bg-slate-950/10"><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-center font-bold text-white focus:border-purple-500 outline-none" value={inputs.compound_options[c]?.forcar_ct ?? ''} onChange={(e) => handleInput('compound_options', 'forcar_ct', e.target.value, c)} /></td>
                                    <td className="p-3 text-center font-mono text-slate-300">{fmt(d?.fuel_load, 0, ' L')}</td>
                                    <td className="p-3 text-center font-mono font-bold text-slate-300">{fmt(d?.tyre_wear, 1, '%')}</td>
                                    <td className="p-3 text-center font-black">{isBest ? <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm">BEST</span> : <span className="text-slate-400 font-mono tracking-tighter">+{fmt(d?.total, 1, 's')}</span>}</td>
                                </tr>
                            )
                        })}
                    </tbody></table></div>
            </div>

            {/* TABELAS DE STINTS COM ABAS */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="bg-slate-900/50 p-2 flex items-center gap-4 border-b border-slate-700/50 px-4">
                    <button onClick={() => setActiveTab('auto')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'auto' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}><Sparkles size={14}/> Automática</button>
                    <button onClick={() => setActiveTab('manual')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === 'manual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}><HardHat size={14}/> Manual</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                        <thead><tr className="text-slate-500 uppercase font-black text-[9px] border-b border-slate-700/50"><th className="text-left p-3 w-32">Parâmetro</th>{Array.from({length:8}).map((_,i)=><th key={i} className="p-2 text-center w-16">Stint {i+1}</th>)}<th className="p-3 text-right bg-slate-900/30 w-20 text-white">Total</th></tr></thead>
                        <tbody className="divide-y divide-slate-700/30">
                            <tr className="bg-slate-900/30">
                                <td className="p-3 font-black text-slate-300 uppercase">{activeTab === 'manual' ? 'Voltas (Manual)' : 'Voltas (Calc)'}</td>
                                {Array.from({length:8}).map((_,i) => {
                                    const st = `stint${i+1}`;
                                    if (activeTab === 'manual') return <td key={st} className="p-1 text-center"><input type="number" value={inputs.personal_stint_voltas[st] ?? ''} onChange={e => handleInput('personal_stint_voltas', st, e.target.value)} className="w-10 bg-slate-900 border border-slate-600 rounded p-1 text-center font-bold text-white focus:border-purple-500 outline-none text-xs" /></td>
                                    else return <td key={st} className="p-1 text-center font-bold text-slate-300">{fmt(currentStintData?.voltas?.[st], 0)}</td>
                                })}
                                <td className="p-3 text-right font-black text-white bg-slate-900/50 border-l border-slate-700/30">{fmt(currentStintData?.voltas?.total, 0)}</td>
                            </tr>
                            {[
                                {k: 'desg_final_pneu', l: 'Desgaste Final', u: '%'},
                                {k: 'comb_necessario', l: 'Combustível (L)', u: ' L'},
                                {k: 'est_tempo_pit', l: 'Tempo de Pit', u: ' s'},
                                {k: 'voltas_em_bad', l: 'Voltas em Bad', u: ''} 
                            ].map(row => (
                                <tr key={row.k} className="hover:bg-slate-700/10 transition-all">
                                    <td className="p-3 font-bold text-slate-400 uppercase leading-tight">{row.l}</td>
                                    {Array.from({length:8}).map((_,i) => (
                                        <td key={i} className="p-1 text-center font-mono text-slate-300">
                                            {fmt(currentStintData?.[row.k]?.[`stint${i+1}`], 1, row.u)}
                                        </td>
                                    ))}
                                    <td className={`p-3 text-right font-black bg-slate-900/40 border-l border-slate-700/30 ${row.k === 'voltas_em_bad' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {fmt(currentStintData?.[row.k]?.total, 1, row.u)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
      {loading && <div className="fixed bottom-8 right-8 bg-purple-600 text-white px-5 py-3 rounded-full flex items-center gap-3 font-black shadow-2xl animate-pulse z-50 border-2 border-purple-400"><Loader2 className="animate-spin" size={18} /> CALCULANDO...</div>}
    </div>
  );
}

// --- SUBCOMPONENTES ---
function ConfigInput({ label, value, onChange, placeholder }: any) {
    return <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700 text-center"><label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">{label}</label><input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-center font-black text-sm text-white outline-none focus:text-purple-400" /></div>
}

function SupplierCarousel({ value, options, onChange }: { value: string, options: string[], onChange: (v: string) => void }) {
    const currentIndex = options.indexOf(value) !== -1 ? options.indexOf(value) : 0;
    const handleNext = () => onChange(options[(currentIndex + 1) % options.length]);
    const handlePrev = () => onChange(options[(currentIndex - 1 + options.length) % options.length]);
    return (
        <div className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 flex items-center justify-between group hover:border-purple-500/50 transition-all shadow-inner">
            <button onClick={handlePrev} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-all active:scale-95"><ChevronLeft size={16} /></button>
            <div className="flex flex-col items-center justify-center flex-1 h-14 relative overflow-hidden"><div className="h-10 flex items-center justify-center transition-all duration-300 transform group-hover:scale-105"><img src={`/tyres/${value.toLowerCase().trim() === 'contimental' ? 'continental' : value.toLowerCase().trim()}.gif`} alt={value} className="max-h-full max-w-[120px] object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; const span = e.currentTarget.parentElement?.querySelector('span'); if(span) span.style.display = 'block'; }} /><span className="hidden text-sm font-black uppercase text-white tracking-widest">{value}</span></div></div>
            <button onClick={handleNext} className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-all active:scale-95"><ChevronRight size={16} /></button>
        </div>
    )
}