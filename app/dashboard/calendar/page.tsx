'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, Save, Loader2, 
  Zap, Activity, Wind, Timer, 
  Gauge, Move, Sparkles, CalendarDays, Cloud, ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// --- CONFIGURAÇÃO: IDs DAS PISTAS DO GPRO ---
const TRACK_IDS: Record<string, string> = {
  "buenos aires": "2", "rafaela oval": "54", "adelaide": "19", "melbourne": "34",
  "a1-ring": "12", "oesterreichring": "24", "baku city": "58", "sakhir": "29",
  "spa": "10", "zolder": "26", "brasilia": "31", "interlagos": "1",
  "montreal": "6", "shanghai": "33", "grobnik": "59", "brno": "41",
  "jyllands-ringen": "60", "ahvenisto": "47", "magny cours": "7", "paul ricard": "25",
  "avus": "56", "hockenheim": "17", "nurburgring": "21", "serres": "53",
  "hungaroring": "9", "irungattukottai": "43", "new delhi": "48", "fiorano": "32",
  "monza": "11", "mugello": "28", "fuji": "37", "suzuka": "13",
  "kaunas": "50", "sepang": "15", "mexico city": "22", "monte carlo": "4",
  "zandvoort": "27", "poznan": "42", "estoril": "18", "portimao": "49",
  "losail": "63", "bucharest ring": "45", "sochi": "55", "imola": "3",
  "jeddah": "61", "singapore": "38", "slovakiaring": "52", "kyalami": "20",
  "yeongam": "44", "barcelona": "5", "jerez": "14", "valencia": "39",
  "anderstorp": "30", "bremgarten": "57", "istanbul": "36", "yas marina": "40",
  "brands hatch": "23", "silverstone": "8", "austin": "51", "indianapolis": "16",
  "indianapolis oval": "46", "laguna seca": "35", "las vegas": "64", "miami": "62"
};

// --- HELPER: Normaliza texto para garantir matches (A1-Ring vs a1-ring) ---
const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  return texto.toString().trim().toLowerCase();
};

// --- HELPER: Cores Vibrantes (Estilo Neon/Pílula) ---
const formatarDadosGPRO = (valor: any) => {
  if (typeof valor === 'number') {
    return { pt: valor.toString(), cor: "bg-zinc-800 text-white border-zinc-700" };
  }

  const t = String(valor || "").toLowerCase().trim();
  
  const mapa: Record<string, { pt: string; cor: string }> = {
    // Verdes (Vantajoso)
    "very low": { pt: "Muito Baixa", cor: "bg-emerald-500 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-400" },
    "low": { pt: "Baixo", cor: "bg-lime-400 text-black font-bold shadow-[0_0_15px_rgba(163,230,53,0.4)] border-lime-300" },
    "easy": { pt: "Fácil", cor: "bg-lime-400 text-black font-bold border-lime-300" },
    "very soft": { pt: "Muito Macia", cor: "bg-emerald-500 text-black font-bold border-emerald-400" },
    "soft": { pt: "Macia", cor: "bg-lime-400 text-black font-bold border-lime-300" },

    // Amarelos (Médio)
    "medium": { pt: "Médio", cor: "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(251,191,36,0.3)] border-amber-300" },
    "normal": { pt: "Normal", cor: "bg-amber-400 text-black font-bold border-amber-300" },

    // Vermelhos (Desvantajoso/Difícil)
    "high": { pt: "Alto", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very high": { pt: "Muito Alto", cor: "bg-rose-600 text-white font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)] border-rose-500" },
    "very elevated": { pt: "Muito Elevado", cor: "bg-rose-600 text-white font-bold border-rose-500" },
    "difficult": { pt: "Difícil", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very difficult": { pt: "Muito Difícil", cor: "bg-rose-600 text-white font-bold border-rose-500" },
    "hard": { pt: "Dura", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very hard": { pt: "Muito Dura", cor: "bg-rose-600 text-white font-bold border-rose-500" },
  };

  return mapa[t] || { pt: valor, cor: "bg-zinc-800/80 text-zinc-300 border border-white/5" };
};

export default function CalendarioAlfaPremium() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [allTracks, setAllTracks] = useState<any[]>([]);
  const [seasonNum, setSeasonNum] = useState("109");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [seasonSlots, setSeasonSlots] = useState<{name: string, date: string}[]>(Array(17).fill({ name: "", date: "" }));
  const [testTrackName, setTestTrackName] = useState("");

  useEffect(() => {
    async function carregarDados() {
      try {
        const res = await fetch('/api/calendar');
        const apiData = await res.json();
        if (apiData.sucesso) setAllTracks(apiData.tracks);

        const { data: cloudData } = await supabase.from('calendario_temporada').select('*').maybeSingle();
        if (cloudData) {
          setSeasonNum(cloudData.season_num);
          setStartDate(cloudData.start_date);
          setEndDate(cloudData.end_date);
          setSeasonSlots(cloudData.tracks_json);
          setTestTrackName(cloudData.test_track);
        } else { setIsSetupOpen(true); }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    carregarDados();
  }, []);

  const trackNames = useMemo(() => allTracks.map(t => t.name).sort(), [allTracks]);

  const gerarEGerenciar = async () => {
    const datas: string[] = [];
    let atual = new Date(startDate);
    const fim = new Date(endDate);
    atual.setMinutes(atual.getMinutes() + atual.getTimezoneOffset());
    fim.setMinutes(fim.getMinutes() + fim.getTimezoneOffset());

    while (atual <= fim) {
      const dia = atual.getDay();
      if (dia === 2 || dia === 5) datas.push(atual.toLocaleDateString('pt-BR'));
      atual.setDate(atual.getDate() + 1);
    }

    const slotsAtualizados = seasonSlots.map((slot, i) => ({ ...slot, date: datas[i] || "TBD" }));
    setSeasonSlots(slotsAtualizados);
    setIsSetupOpen(false);
    
    setIsSaving(true);
    await supabase.from('calendario_temporada').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      season_num: seasonNum, start_date: startDate, end_date: endDate,
      tracks_json: slotsAtualizados, test_track: testTrackName, updated_at: new Date()
    });
    setIsSaving(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#050507]"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-10 pb-40 font-sans max-w-[1600px] mx-auto text-slate-200">
      
      {/* HEADER RESPONSIVO (MOBILE/DESKTOP) */}
      <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-4 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 shadow-2xl gap-4 md:gap-0">
        <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto justify-center md:justify-start">
          <CalendarIcon className="text-indigo-400 shrink-0" size={24} />
          <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter text-center">Calendário Temporada</h1>
          {isSaving && <Cloud className="text-amber-500 animate-bounce" size={16} />}
        </div>
        
        <button 
          onClick={() => setIsSetupOpen(!isSetupOpen)} 
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {isSetupOpen ? "Fechar Configuração" : "Editar Temporada"}
        </button>
      </div>

      {/* PAINEL EDIÇÃO */}
      <AnimatePresence>
        {isSetupOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-zinc-900/80 border border-indigo-500/20 rounded-[32px] md:rounded-[40px] p-6 md:p-8 space-y-8 shadow-2xl">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputGroup label="Temporada" value={seasonNum} onChange={setSeasonNum} />
                <InputGroup label="Início da Época" value={startDate} onChange={setStartDate} type="date" />
                <InputGroup label="Fim da Época" value={endDate} onChange={setEndDate} type="date" />
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {seasonSlots.map((slot, i) => (
                  <select key={i} value={slot.name} onChange={(e) => { const n = [...seasonSlots]; n[i] = { ...n[i], name: e.target.value }; setSeasonSlots(n); }}
                    className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-[10px] text-white outline-none">
                    <option value="">Corrida #{i+1}</option>
                    {trackNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                ))}
                <select value={testTrackName} onChange={(e) => setTestTrackName(e.target.value)} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[10px] text-amber-500 font-bold">
                   <option value="">Pista de Testes...</option>
                   {trackNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>
             <button onClick={gerarEGerenciar} className="w-full bg-emerald-600 py-4 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-3 transition-all"><Sparkles size={18}/> Gerar e Salvar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GRID EXIBIÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {seasonSlots.map((slot, i) => (
          <CardExibicao key={i} index={i + 1} slot={slot} allTracks={allTracks} />
        ))}
        <CardExibicao index="TESTE" slot={{name: testTrackName, date: "Pista Ativa"}} allTracks={allTracks} isTest />
      </div>
    </div>
  );
}

function CardExibicao({ index, slot, allTracks, isTest = false }: any) {
  // 1. Encontra a pista ignorando case/espaços
  const pista = allTracks.find((t: any) => 
    normalizarTexto(t.name) === normalizarTexto(slot.name)
  );
  
  // 2. Encontra o ID do GPRO para o Link
  const trackId = pista ? TRACK_IDS[normalizarTexto(pista.name)] : null;
  const gproUrl = trackId ? `https://www.gpro.net/br/TrackDetails.asp?id=${trackId}` : "#";

  return (
    <motion.div 
      layout 
      className={`
        relative overflow-hidden rounded-[24px] md:rounded-[32px] transition-all duration-500 group
        ${isTest 
          ? 'bg-gradient-to-br from-amber-900/20 to-black border border-amber-500/30' 
          : 'bg-gradient-to-br from-indigo-900/20 via-zinc-950 to-black border border-white/10 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]'
        }
      `}
    >
      {/* Efeito Glow Topo */}
      <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${isTest ? 'from-amber-500/10' : 'from-indigo-500/10'} to-transparent pointer-events-none`} />

      {/* HEADER DO CARD */}
      <div className="relative p-4 md:p-6 flex items-start justify-between z-10">
        <div className="flex items-center gap-3 md:gap-4">
          
          {/* Badge (Bandeira) com Link */}
          <a href={gproUrl} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center p-1.5 md:p-2 rounded-xl ${isTest ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'bg-white/5 hover:bg-indigo-500/20'} backdrop-blur-md border border-white/5 transition-colors cursor-pointer shrink-0`}>
             <span className={`text-[9px] md:text-[10px] font-black leading-none mb-1 ${isTest ? 'text-amber-500' : 'text-indigo-400'}`}>
               {isTest ? "TEST" : `#${index}`}
             </span>
             {pista?.flag && pista.flag !== 'xx' && (
                <img 
                  src={`/flags/${pista.flag}.png`} 
                  alt={pista.name} 
                  className="w-7 h-4.5 md:w-8 md:h-5 object-cover rounded shadow-sm"
                  onError={(e) => (e.currentTarget.style.display = 'none')} 
                />
             )}
          </a>

          {/* Nome da Pista com Link */}
          <div className="flex flex-col min-w-0">
            <a href={gproUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 group-hover:opacity-80 transition-opacity">
               <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter italic leading-none hover:text-indigo-400 transition-colors cursor-pointer truncate">
                 {slot.name || "---"}
               </h2>
               {trackId && <ExternalLink size={12} className="text-zinc-600 group-hover:text-indigo-400 shrink-0" />}
            </a>
            {pista && <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5 md:mt-1 truncate">GP de {pista.name}</span>}
          </div>
        </div>

        {/* Data */}
        <div className="flex flex-col items-end shrink-0 pl-2">
           <div className="flex items-center gap-1.5 md:gap-2 bg-white/5 px-2.5 py-1.5 md:px-3 rounded-lg border border-white/5 backdrop-blur-sm shadow-lg">
              <CalendarDays size={12} className="text-zinc-400" />
              <span className="text-[9px] md:text-[10px] font-bold text-zinc-300 uppercase">{slot.date}</span>
           </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="p-4 md:p-6 pt-0 md:pt-2 space-y-5 md:space-y-6 relative z-10">
        {pista ? (
          <>
            {/* Stats Topo (Estilo Painel) */}
            <div className="grid grid-cols-3 gap-2">
               <InfoTopo label="Vel. Média" value={pista.avgSpeed} sulfixo="km/h" icon={Gauge} />
               <InfoTopo label="Curvas" value={pista.corners} icon={Move} />
               <InfoTopo label="Pitstop" value={pista.pit} sulfixo="s" icon={Timer} destaque />
            </div>

            {/* Barras de Progresso Vibrantes */}
            <div className="space-y-3 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5 shadow-inner">
              <Barra label="Potência" value={pista.power} from="from-rose-500" to="to-orange-500" icon={Zap} />
              <Barra label="Dirigibilidade" value={pista.handling} from="from-indigo-500" to="to-cyan-400" icon={Activity} />
              <Barra label="Aceleração" value={pista.accel} from="from-emerald-500" to="to-lime-400" icon={Wind} />
            </div>

            {/* Tags / Pills (Vibrantes) */}
            <div className="grid grid-cols-3 gap-2">
              <Tag label="Apoio Aero" value={pista.downforce} />
              <Tag label="Ultrapassagem" value={pista.overtaking} />
              <Tag label="Suspensão" value={pista.suspension} />
              <Tag label="Aderência" value={pista.grip} />
              <Tag label="Combustível" value={pista.fuel} />
              <Tag label="Desgaste" value={pista.wear} />
              {/* Infos Extras Footer */}
              <div className="col-span-3 grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5">
                 <TagMini label="Voltas" value={pista.laps} />
                 <TagMini label="Extensão" value={`${pista.lapLen}km`} />
                 <TagMini label="Distância" value={`${pista.dist}km`} />
              </div>
            </div>
          </>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-20">
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-white mb-4 animate-spin-slow" />
             <span className="uppercase font-black tracking-widest text-[10px]">Aguardando seleção</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- COMPONENTES AUXILIARES ---

function Tag({ label, value }: any) {
  const { pt, cor } = formatarDadosGPRO(value);
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${cor}`}>
      <span className="text-[6px] md:text-[7px] uppercase font-black opacity-80 mb-0.5 tracking-wider">{label}</span>
      <span className="text-[9px] md:text-[10px] font-black uppercase text-center leading-none">{pt}</span>
    </div>
  );
}

function TagMini({ label, value }: any) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-bold">{label}</span>
      <span className="text-[9px] md:text-[10px] text-zinc-300 font-bold">{value}</span>
    </div>
  );
}

function Barra({ label, value, from, to, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 md:w-6 flex justify-center"><Icon size={14} className="text-zinc-500" /></div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
          <span className="text-[8px] md:text-[9px] font-bold text-white">{value}</span>
        </div>
        <div className="h-1.5 md:h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${(value / 25) * 100}%` }} 
            className={`h-full bg-gradient-to-r ${from} ${to} rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]`} 
          />
        </div>
      </div>
    </div>
  );
}

function InfoTopo({ label, value, sulfixo = "", icon: Icon, destaque }: any) {
  return (
    <div className="bg-black/30 p-2.5 md:p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-white/5 transition-colors">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-tr ${destaque ? 'from-indigo-500' : 'from-zinc-500'} to-transparent`} />
      <Icon size={14} className={`mb-1 md:mb-1.5 ${destaque ? 'text-indigo-400' : 'text-zinc-500'}`} />
      <span className={`text-base md:text-lg font-black italic tracking-tighter ${destaque ? 'text-white' : 'text-zinc-200'}`}>
        {value}<span className="text-[9px] md:text-[10px] not-italic text-zinc-500 ml-0.5 font-bold">{sulfixo}</span>
      </span>
      <span className="text-[5px] md:text-[6px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
    </div>
  );
}

function InputGroup({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-[18px] p-4 text-white font-bold outline-none focus:border-indigo-500 transition-all" />
    </div>
  );
}