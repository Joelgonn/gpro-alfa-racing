'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, Save, Search, Users, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Loader2, Cloud, Database, Info, TrendingDown, Gauge, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TIPOS ---
type SponsorAttribute = 'finances' | 'expectations' | 'patience' | 'reputation' | 'image' | 'negotiation' | 'currentProgress' | 'averageProgress' | 'managers';

interface SavedSponsor {
    id: string;
    name: string;
    attributes: Record<SponsorAttribute, number>;
    date: string;
}

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
  const router = useRouter();

  // --- ESTADOS DO NEGÓCIO ---
  const [attributes, setAttributes] = useState({
    finances: 2, expectations: 6, patience: 2, reputation: 6,
    image: 1, negotiation: 3, currentProgress: 50.0, averageProgress: 50.0, managers: 1,
  });

  const [sponsorName, setSponsorName] = useState("");
  const [results, setResults] = useState({
      answers: ["...", "...", "...", "...", "..."],
      stats: { diff: 0, opponentProgress: 0 }
  });

  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savedSponsors, setSavedSponsors] = useState<SavedSponsor[]>([]);
  
  // --- UI STATES ---
  const [modal, setModal] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');

  const showAlert = (title: string, message: string) => setModal({ isOpen: true, type: 'alert', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // --- 1. AUTH & LOAD DATA (SUPABASE) ---
  useEffect(() => {
    async function initPage() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            
            const uid = session.user.id;
            setUserId(uid);
            if (session.user.email) setUserEmail(session.user.email);

            const res = await fetch('/api/python?action=get_state', { 
                headers: { 'user-id': uid } 
            });
            const json = await res.json();
            
            if (json.sucesso && json.data?.sponsors_database) {
                setSavedSponsors(json.data.sponsors_database);
            }
        } catch (error) { 
            console.error("Erro ao carregar:", error);
        } finally { 
            setIsAuthLoading(false); 
        }
    }
    initPage();
  }, [router]);

  // --- 2. SYNC FUNCTION (SUPABASE) ---
  const syncWithSupabase = async (newList: SavedSponsor[]) => {
      if (!userId) return;
      setSavedSponsors(newList); 
      
      try {
          await fetch('/api/python?action=update_state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'user-id': userId },
              body: JSON.stringify({ sponsors_database: newList })
          });
      } catch (e) {
          console.error("Erro ao sincronizar com servidor:", e);
      }
  };

  // --- 3. ACTIONS ---
  const fetchSponsorData = useCallback(async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await fetch('/api/python?action=sponsors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify(attributes)
        });
        const data = await res.json();
        if (data.sucesso) setResults(data.data);
      } catch (e) { } finally { setLoading(false); }
  }, [attributes, userId]);

  useEffect(() => {
      const timer = setTimeout(() => { if(userId) fetchSponsorData(); }, 600);
      return () => clearTimeout(timer);
  }, [attributes, fetchSponsorData, userId]);

  const saveToDb = () => {
      if (!sponsorName.trim()) return showAlert("Ops!", "Insira o nome do patrocinador antes de salvar.");
      
      const newItem: SavedSponsor = {
          id: Date.now().toString(),
          name: sponsorName,
          attributes: { ...attributes },
          date: new Date().toLocaleDateString('pt-BR')
      };

      const existingIndex = savedSponsors.findIndex(s => s.name.toLowerCase() === sponsorName.toLowerCase());
      
      if (existingIndex >= 0) {
          showConfirm("Atualizar", `Deseja sobrescrever os dados de "${sponsorName}"?`, () => {
              const newList = [...savedSponsors];
              newList[existingIndex] = newItem;
              syncWithSupabase(newList);
          });
      } else {
          syncWithSupabase([newItem, ...savedSponsors]);
      }
  };

  const deleteFromDb = (id: string, name: string) => {
      showConfirm("Excluir", `Remover "${name}" permanentemente da nuvem?`, () => {
          syncWithSupabase(savedSponsors.filter(s => s.id !== id));
      });
  };

  const loadFromDb = (item: SavedSponsor) => {
      setSponsorName(item.name);
      setAttributes(item.attributes as any);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredSponsors = savedSponsors.filter(s => 
      s.name.toLowerCase().includes(sponsorName.toLowerCase())
  );

  const handleAttributeChange = (field: SponsorAttribute, value: number) => {
    setAttributes(prev => ({ ...prev, [field]: value }));
  };

  if (isAuthLoading) return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#050507]">
      <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
          <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] animate-pulse">Estabelecendo Link Seguro...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] text-slate-300 font-mono pb-24 overflow-x-hidden selection:bg-amber-500/35">
        
        {/* HEADER BAR (OTIMIZADO MOBILE-FIRST) */}
        <div className="p-3 sm:p-4 max-w-6xl mx-auto sticky top-0 sm:top-2 z-40">
            <div className="bg-zinc-950/80 backdrop-blur-md border border-white/5 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col md:flex-row gap-3 justify-between items-center w-full">
                
                <div className="flex justify-between items-center w-full md:w-auto gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                            <Briefcase className="text-amber-500" size={16} />
                        </div>
                        <div className="flex flex-col text-left">
                            <h1 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">Painel Comercial</h1>
                            <div className="flex items-center gap-1.5">
                                <Cloud size={10} className="text-emerald-500 animate-pulse" />
                                <span className="text-[8px] text-emerald-500 font-black uppercase tracking-wider">Nuvem Sincronizada</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 md:max-w-md">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 text-xs font-bold text-white outline-none focus:border-amber-500/40 focus:bg-white/5 transition-all uppercase placeholder-slate-600"
                            placeholder="Buscar / Criar..."
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    </div>
                    <button 
                        onClick={saveToDb}
                        className="h-11 px-4 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl shadow-lg shadow-amber-500/5 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0 font-black text-[10px] uppercase tracking-wider"
                    >
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                </div>

            </div>
        </div>

        {/* CORPO PRINCIPAL - GRID RESPONSIVO */}
        <main className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2">
            
            {/* COLUNA ESQUERDA: CONTROLES DE NEGOCIAÇÃO */}
            <div className="lg:col-span-5 space-y-4 flex flex-col min-w-0">
                
                {/* ATRIBUTOS COM PROPORÇÕES SLIM (Fórmula 1 HUD Style) */}
                <section className="bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                    <div className="bg-white/[0.02] p-4 border-b border-white/5 flex items-center gap-2">
                        <BarChart3 size={14} className="text-amber-500" />
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Atributos do Patrocinador</h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <AttributeSlider label="Finanças (Dinheiro)" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                        <AttributeSlider label="Expectativas (Objetivos)" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                        <AttributeSlider label="Paciência (Prazo)" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                        <AttributeSlider label="Reputação (Importância)" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                        <AttributeSlider label="Imagem (Relevância)" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                        <AttributeSlider label="Negociação (Habilidade)" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                    </div>
                </section>

                {/* MÉTRICAS DE PROGRESSO DA RODADA */}
                <section className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 backdrop-blur-sm">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-3.5 flex items-center gap-2">
                        <Gauge size={14} className="text-indigo-400" /> Progresso da Rodada
                    </h3>
                    <div className="grid grid-cols-3 gap-2 font-mono">
                        <MetricInput label="Atual %" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" />
                        <MetricInput label="Médio %" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" />
                        <MetricInput label="Líderes" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight />
                    </div>
                </section>
            </div>

            {/* COLUNA DIREITA: DECISÕES E KPIs */}
            <div className="lg:col-span-7 space-y-4 flex flex-col min-w-0">
                
                {/* DECISÕES SUGERIDAS (SLIM DESIGN) */}
                <section className="bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden flex-1 backdrop-blur-sm flex flex-col">
                    <div className="bg-emerald-500/10 p-4 border-b border-emerald-500/20 flex justify-between items-center">
                        <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={14} /> Decisões Recomendadas
                        </h2>
                        {loading ? (
                            <Loader2 className="animate-spin text-emerald-400" size={12} />
                        ) : (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        )}
                    </div>
                    
                    <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-center">
                        {QUESTIONS_LABELS.map((q, index) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 border border-white/5 rounded-xl p-3 hover:border-emerald-500/20 transition-all gap-2 group">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">0{index + 1}</span>
                                    <p className="text-[10px] text-slate-400 font-bold group-hover:text-slate-300 transition-colors uppercase">{q}</p>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg border bg-emerald-500/5 border-emerald-500/15 text-emerald-400 text-center sm:min-w-[180px] shrink-0">
                                    <span className="font-black text-[10px] uppercase tracking-wider">
                                        {translate(results.answers[index]) || "Sincronizando"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* KPIS DE RESULTADOS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${results.stats.diff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5 relative z-10">
                            Eficácia Estimada
                        </span>
                        <span className={`text-xl sm:text-2xl font-black relative z-10 ${results.stats.diff >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {results.stats.diff > 0 ? '+' : ''}{Number(results.stats.diff).toFixed(2)}%
                        </span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5 relative z-10">
                            IA Competidora
                        </span>
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-xl sm:text-2xl font-black text-white">
                                {Number(results.stats.opponentProgress).toFixed(2)}<span className="text-xs text-slate-500">%</span>
                            </span>
                        </div>
                        <div className="mt-2.5 w-full h-1 bg-[#050507] rounded-full overflow-hidden relative z-10 border border-white/5">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(results.stats.opponentProgress, 100)}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* BIBLIOTECA DE PATROCINADORES SALVOS */}
            <section className="lg:col-span-12 space-y-4 pt-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-slate-500" />
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.25em]">BIBLIOTECA EM NUVEM</h3>
                    </div>
                    <span className="text-[8px] text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
                        {filteredSponsors.length} REGISTROS SALVOS
                    </span>
                </div>
                
                {/* LISTA COMPACTADA (OTIMIZADA PARA MOBILE) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full">
                    {filteredSponsors.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
                            <Database size={24} className="text-slate-700 mb-2" />
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                    ) : (
                        filteredSponsors.map((item) => (
                            <motion.div key={item.id} layout className="bg-zinc-950/40 border border-white/5 p-3.5 rounded-2xl hover:border-amber-500/20 transition-all flex flex-col justify-between group relative overflow-hidden">
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="overflow-hidden min-w-0 pr-2 text-left">
                                        <h4 className="font-black text-white text-xs truncate uppercase tracking-tight">{item.name}</h4>
                                        <span className="text-[8px] text-slate-500 font-bold block mt-0.5">{item.date}</span>
                                    </div>
                                    <button onClick={() => deleteFromDb(item.id, item.name)} className="text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all shrink-0">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                
                                <button onClick={() => loadFromDb(item)} className="w-full h-8 bg-black/40 hover:bg-amber-500 text-[9px] font-black text-slate-400 hover:text-slate-950 rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-1 border border-white/5 hover:border-amber-400 shadow-inner">
                                    Carregar <ChevronRight size={11} />
                                </button>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
        </main>

        {/* MODAL SYSTEM */}
        <AnimatePresence>
            {modal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-[#0f0f12] border border-white/10 w-full max-w-xs rounded-2xl shadow-2xl relative z-10 overflow-hidden">
                        <div className={`h-1 w-full ${modal.type === 'alert' ? 'bg-amber-500' : modal.type === 'confirm' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                        <div className="p-5 text-left">
                            <h3 className="text-sm font-black text-white uppercase mb-2">{modal.title}</h3>
                            <p className="text-slate-400 text-[11px] leading-relaxed mb-6">{modal.message}</p>
                            <div className="flex gap-2">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-white/5 active:bg-white/10 text-white py-2.5 rounded-xl text-[9px] font-black uppercase transition-colors">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-indigo-600 active:bg-indigo-700 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors shadow-lg">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-white/5 active:bg-white/10 text-white py-2.5 rounded-xl text-[9px] font-black uppercase transition-colors">Entendido</button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTES OTIMIZADOS ---

function AttributeSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div className="flex flex-col gap-1.5 group">
            <div className="flex justify-between items-end px-0.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider group-hover:text-amber-500 transition-colors">{label}</span>
                <span className="text-[9px] font-black text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{value} <span className="text-slate-600">/ 7</span></span>
            </div>
            
            {/* Pílulas Slim de Atributo */}
            <div className="flex gap-1 h-5 sm:h-6">
                {[1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isActive = idx <= value;
                    let colorClass = 'bg-white/5 border-white/5 active:bg-white/10';
                    
                    if (isActive) {
                        if (value <= 2) colorClass = 'bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.25)]';
                        else if (value >= 6) colorClass = 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]';
                        else colorClass = 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]';
                    }

                    return (
                        <button 
                            key={idx} 
                            onClick={() => onChange(idx)} 
                            className={`flex-1 rounded-sm border transition-all duration-300 ${colorClass}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, highlight }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, highlight?: boolean }) {
    return (
        <div className={`flex flex-col bg-black/40 p-2 sm:p-2.5 rounded-xl border transition-all shadow-inner ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5'}`}>
            <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${highlight ? 'text-amber-500' : 'text-slate-500'}`}>
                {label}
            </span>
            <div className="flex items-center gap-0.5">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className={`w-full bg-transparent text-xs font-black outline-none ${highlight ? 'text-amber-400' : 'text-white'}`} 
                />
                {suffix && <span className="text-[9px] font-bold text-slate-600">{suffix}</span>}
            </div>
        </div>
    )
}