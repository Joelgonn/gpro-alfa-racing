'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
  Briefcase, Save, Search, Users, Target, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Handshake, Gauge
} from 'lucide-react';

// --- TIPOS ---
type SponsorAttribute = 'finances' | 'expectations' | 'patience' | 'reputation' | 'image' | 'negotiation' | 'currentProgress' | 'averageProgress' | 'managers';

interface SavedSponsor {
    id: string;
    name: string;
    attributes: Record<SponsorAttribute, number>;
    date: string;
}

// --- CONSTANTES (VERSÃO CURTA / DIRETA) ---
const QUESTIONS_LABELS = [
    "Onde colocar a propaganda?",
    "Objetivo na próxima temporada?",
    "Popularidade do piloto?",
    "Opinião sobre valor proposto?",
    "Opinião sobre duração proposta?"
];

const TRANSLATION_MAP: { [key: string]: string } = {
  "Aileron Dianteiro": "Asa Dianteira",
  "Aileron Traseiro": "Asa Traseira",
  "Sidepods": "Laterais",
  "Nariz": "Bico",
  "Capot do Motor": "Carenagem",
};

function translate(text: string) {
  return TRANSLATION_MAP[text] || text;
}

export default function SponsorsPage() {
  
  // --- ESTADOS ---
  const [attributes, setAttributes] = useState({
    finances: 2,
    expectations: 6,
    patience: 2,
    reputation: 6,
    image: 1,
    negotiation: 3,
    currentProgress: 50.0,
    averageProgress: 50.0,
    managers: 1,
  });

  const [sponsorName, setSponsorName] = useState("VISA");
  
  const [results, setResults] = useState({
      answers: ["...", "...", "...", "...", "..."],
      stats: { diff: 0, opponentProgress: 0 }
  });

  const [loading, setLoading] = useState(false);
  const [savedSponsors, setSavedSponsors] = useState<SavedSponsor[]>([]);

  // --- LÓGICA ---
  const filteredSponsors = savedSponsors.filter(sponsor => 
      sponsor.name.toLowerCase().includes(sponsorName.toLowerCase())
  );

  useEffect(() => {
      const saved = localStorage.getItem('gpro_sponsors_db');
      if (saved) {
          try { setSavedSponsors(JSON.parse(saved)); } catch (e) { console.error(e); }
      }
  }, []);

  useEffect(() => {
      if (savedSponsors.length > 0) {
        localStorage.setItem('gpro_sponsors_db', JSON.stringify(savedSponsors));
      }
  }, [savedSponsors]);

  const handleAttributeChange = (field: SponsorAttribute, value: number) => {
    setAttributes(prev => ({ ...prev, [field]: value }));
  };

  const fetchSponsorData = useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sponsors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attributes)
        });
        const data = await res.json();
        if (data.sucesso) {
            setResults(data.data);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [attributes]);

  useEffect(() => {
      const timer = setTimeout(() => { fetchSponsorData(); }, 500);
      return () => clearTimeout(timer);
  }, [attributes, fetchSponsorData]);

  const saveToDb = () => {
      if (!sponsorName.trim()) return alert("Digite o nome.");
      const newItem: SavedSponsor = {
          id: Date.now().toString(),
          name: sponsorName,
          attributes: { ...attributes },
          date: new Date().toLocaleDateString('pt-BR')
      };
      const existingIndex = savedSponsors.findIndex(s => s.name.toLowerCase() === sponsorName.toLowerCase());
      let newList;
      if (existingIndex >= 0) {
          if (!confirm(`Atualizar "${sponsorName}"?`)) return;
          newList = [...savedSponsors];
          newList[existingIndex] = newItem;
      } else {
          newList = [newItem, ...savedSponsors];
      }
      setSavedSponsors(newList);
      localStorage.setItem('gpro_sponsors_db', JSON.stringify(newList));
  };

  const loadFromDb = (item: SavedSponsor) => {
      setSponsorName(item.name);
      setAttributes(item.attributes);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteFromDb = (id: string) => {
      if (confirm("Remover?")) {
          const newList = savedSponsors.filter(s => s.id !== id);
          setSavedSponsors(newList);
          localStorage.setItem('gpro_sponsors_db', JSON.stringify(newList));
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans pb-20 selection:bg-amber-500/30">
        
        {/* === HEADER OTIMIZADO === */}
        <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md mb-6">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
                        <Briefcase className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight uppercase leading-none">
                            Negociação <span className="text-amber-500">Comercial</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestão de Patrocínios</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group w-64">
                        <input 
                            type="text" 
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            className="w-full bg-slate-950 text-sm font-bold text-white outline-none placeholder-slate-600 h-10 pl-9 pr-4 rounded-xl border border-slate-700 focus:border-amber-500/50 transition-all shadow-inner"
                            placeholder="Nome do Patrocinador..."
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    
                    <button 
                        onClick={saveToDb}
                        className="flex items-center gap-2 px-5 h-10 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wide border border-amber-400/20"
                    >
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                </div>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 flex flex-col gap-6">
            
            {/* === LINHA SUPERIOR: INPUTS E RESULTADOS === */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* ESQUERDA: ATRIBUTOS E MÉTRICAS (5/12) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800/50">
                            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-xs flex items-center gap-2">
                                <BarChart3 size={14} className="text-amber-500" /> Perfil Psicológico
                            </h3>
                            <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-500 border border-slate-800 font-mono">1 - 7</span>
                        </div>
                        <div className="space-y-4">
                            <AttributeSlider label="Finanças" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                            <AttributeSlider label="Expectativas" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                            <AttributeSlider label="Paciência" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                            <AttributeSlider label="Reputação" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                            <AttributeSlider label="Imagem" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                            <AttributeSlider label="Negociação" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                        <h3 className="font-bold text-slate-300 uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
                            <Gauge size={14} className="text-indigo-400" /> Métricas da Rodada
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <MetricInput label="Prog. Atual" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" step={0.1} />
                            <MetricInput label="Prog. Médio" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" step={0.1} />
                            <MetricInput label="Gerentes" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight icon={<Users size={12} />} />
                        </div>
                    </div>
                </div>

                {/* DIREITA: RESPOSTAS E KPIs (7/12) */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                        <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-800 flex justify-between items-center backdrop-blur-md">
                            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare size={16} /> Respostas Sugeridas
                            </h2>
                            {loading && <span className="text-[10px] text-amber-500 font-bold animate-pulse bg-amber-500/10 px-2 py-1 rounded">ANALISANDO...</span>}
                        </div>
                        <div className="p-4 space-y-2">
                            {QUESTIONS_LABELS.map((q, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-950 border border-slate-800/50 rounded-xl p-3 hover:border-amber-500/20 transition-all">
                                    <div className="flex items-center gap-3 pr-4">
                                        <div className="min-w-[24px] h-[24px] flex items-center justify-center bg-slate-900 rounded-lg text-[10px] font-mono font-bold text-slate-500 border border-slate-800">0{index + 1}</div>
                                        <p className="text-xs text-slate-300 font-medium leading-relaxed">{q}</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg border min-w-[140px] text-center transition-all ${loading ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-amber-500/5 border-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.05)]'}`}>
                                        <span className={`font-mono text-xs font-bold uppercase block truncate ${loading && 'blur-sm'}`}>
                                            {translate(results.answers[index]) || "..."}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center relative overflow-hidden group hover:border-slate-700 transition-colors">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                <TrendingUp size={14} /> Diferença Projetada
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl font-black font-mono tracking-tighter ${results.stats.diff >= 0 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'}`}>
                                    {results.stats.diff > 0 ? '+' : ''}{Number(results.stats.diff).toFixed(2)}
                                </span>
                                <span className="text-xs text-slate-500 font-bold">%</span>
                            </div>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <TrendingUp size={60} />
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center relative overflow-hidden group hover:border-slate-700 transition-colors">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                <Users size={14} /> Progresso Adversário
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black font-mono tracking-tighter text-white">
                                    {Number(results.stats.opponentProgress).toFixed(2)}
                                </span>
                                <span className="text-xs text-slate-500 font-bold">%</span>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-800">
                                 <div className="h-full bg-indigo-500 opacity-50" style={{width: `${Math.min(results.stats.opponentProgress, 100)}%`}}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === LINHA INFERIOR: BANCO DE DADOS (FULL WIDTH) === */}
            <div className="w-full">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
                    <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800/50">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <History size={16} /> Banco de Dados Salvo
                        </h3>
                        <div className="flex gap-2">
                             {filteredSponsors.length > 0 && <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">{filteredSponsors.length} registros</span>}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredSponsors.length === 0 ? (
                            <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-600 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                                <Search size={32} className="mb-3 opacity-30" />
                                <span className="text-sm font-medium">Nenhum patrocinador salvo.</span>
                            </div>
                        ) : (
                            filteredSponsors.map((item) => (
                                <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-amber-500/30 transition-all flex flex-col justify-between group h-full">
                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-white text-sm truncate pr-2">{item.name}</h4>
                                                <span className="text-[10px] text-slate-600 font-mono">{item.date}</span>
                                            </div>
                                            <button onClick={() => deleteFromDb(item.id)} className="text-slate-700 hover:text-rose-500 p-1.5 rounded hover:bg-slate-900 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        
                                        {/* Barras de Status Visuais */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-slate-500 w-8 uppercase">Fin</span>
                                                <div className="h-1.5 bg-slate-900 rounded-full flex-1 overflow-hidden"><div className="h-full bg-indigo-500" style={{width: `${(item.attributes.finances/7)*100}%`}}></div></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-slate-500 w-8 uppercase">Exp</span>
                                                <div className="h-1.5 bg-slate-900 rounded-full flex-1 overflow-hidden"><div className="h-full bg-emerald-500" style={{width: `${(item.attributes.expectations/7)*100}%`}}></div></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-slate-500 w-8 uppercase">Neg</span>
                                                <div className="h-1.5 bg-slate-900 rounded-full flex-1 overflow-hidden"><div className="h-full bg-amber-500" style={{width: `${(item.attributes.negotiation/7)*100}%`}}></div></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button onClick={() => loadFromDb(item)} className="w-full py-2 bg-slate-900 hover:bg-amber-600 text-slate-400 hover:text-white text-[10px] font-bold rounded-lg transition-colors uppercase tracking-widest flex items-center justify-center gap-2 group-hover:border-amber-500/50 border border-slate-800">
                                        Carregar <ChevronRight size={10} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

        </main>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---

function AttributeSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    const MAX = 7;
    const blocks = Array.from({ length: MAX }, (_, i) => i + 1);

    const getColor = (idx: number) => {
        if (idx > value) return 'bg-slate-800 border-slate-700/50';
        if (value <= 2) return 'bg-rose-500 border-rose-400 shadow-[0_0_4px_rgba(244,63,94,0.4)]';
        if (value >= 6) return 'bg-emerald-500 border-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.4)]';
        return 'bg-amber-500 border-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.4)]';
    };

    return (
        <div className="flex items-center justify-between gap-4 h-8 group">
            <span className="text-[10px] font-bold text-slate-500 uppercase w-24 text-right truncate group-hover:text-slate-300 transition-colors">{label}</span>
            <div className="flex-1 flex items-center gap-1 h-full cursor-pointer py-1">
                {blocks.map((idx) => (
                    <div 
                        key={idx} 
                        onClick={() => onChange(idx)} 
                        className={`flex-1 h-2.5 rounded-sm border transition-all duration-200 cursor-pointer hover:h-4 ${getColor(idx)}`}
                    ></div>
                ))}
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 w-5 text-center">{value}</span>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, step = 1, highlight, icon }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, step?: number, highlight?: boolean, icon?: any }) {
    return (
        <div className={`flex flex-col bg-slate-950 p-3 rounded-xl border transition-colors ${highlight ? 'border-amber-500/30 bg-amber-900/5' : 'border-slate-800'}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1 ${highlight ? 'text-amber-500' : 'text-slate-500'}`}>
                {icon} {label}
            </span>
            <div className="flex items-center">
                <input 
                    type="number" 
                    step={step} 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className={`w-full bg-transparent text-left font-mono font-bold outline-none text-base p-0 m-0 ${highlight ? 'text-white' : 'text-slate-200'}`} 
                />
            </div>
        </div>
    )
}