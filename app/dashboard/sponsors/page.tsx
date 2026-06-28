'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, Save, Search, Users, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Loader2, Cloud, Database, Info, TrendingDown, Gauge, Sparkles, Crown, Star
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
    <div className="flex h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
      <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-[0.2em] animate-pulse">Estabelecendo Link Seguro...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 overflow-x-hidden selection:bg-amber-500/20 relative">
        
        {/* GLOWS AMBIENTAIS COM TOQUE DOURADO */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.02] blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/[0.01] blur-[150px] rounded-full" />
        </div>

        {/* HEADER BAR COM TOQUE DOURADO */}
        <div className="p-3 sm:p-4 max-w-6xl mx-auto sticky top-0 sm:top-2 z-40 relative">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row gap-3 justify-between items-center w-full hover:border-amber-300/30">
                
                <div className="flex justify-between items-center w-full md:w-auto gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 p-2.5 rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] flex items-center justify-center shrink-0">
                            <Briefcase className="text-white" size={16} />
                        </div>
                        <div className="flex flex-col text-left">
                            <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                                Painel Comercial
                                <Sparkles size={12} className="text-amber-400" />
                            </h1>
                            <div className="flex items-center gap-1.5">
                                <Cloud size={10} className="text-emerald-600 animate-pulse" />
                                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">Nuvem Sincronizada</span>
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
                            className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 shadow-inner hover:border-slate-300 transition-all uppercase placeholder-slate-400"
                            placeholder="Buscar / Criar..."
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button 
                        onClick={saveToDb}
                        className="h-11 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0 font-black text-[10px] uppercase tracking-wider border border-emerald-400"
                    >
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                </div>

            </div>
        </div>

        {/* CORPO PRINCIPAL - GRID RESPONSIVO */}
        <main className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2 relative z-10">
            
            {/* COLUNA ESQUERDA: CONTROLES DE NEGOCIAÇÃO */}
            <div className="lg:col-span-5 space-y-4 flex flex-col min-w-0">
                
                {/* ATRIBUTOS DO PATROCINADOR */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-amber-300/30">
                    <div className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 p-4 border-b border-slate-200 flex items-center gap-2">
                        <BarChart3 size={14} className="text-amber-500" />
                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Atributos do Patrocinador</h3>
                        <Crown size={12} className="text-amber-400 ml-auto" />
                    </div>
                    <div className="p-4 space-y-4 bg-white">
                        <AttributeSlider label="Finanças (Dinheiro)" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                        <AttributeSlider label="Expectativas (Objetivos)" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                        <AttributeSlider label="Paciência (Prazo)" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                        <AttributeSlider label="Reputação (Importância)" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                        <AttributeSlider label="Imagem (Relevância)" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                        <AttributeSlider label="Negociação (Habilidade)" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                    </div>
                </section>

                {/* MÉTRICAS DE PROGRESSO DA RODADA */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 backdrop-blur-sm bg-white hover:border-amber-300/30">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Gauge size={14} className="text-amber-500" /> Progresso da Rodada
                        <Star size={10} className="text-amber-400 ml-auto" />
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5 font-mono">
                        <MetricInput label="Atual %" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" />
                        <MetricInput label="Médio %" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" />
                        <MetricInput label="Líderes" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight />
                    </div>
                </section>
            </div>

            {/* COLUNA DIREITA: DECISÕES E KPIs */}
            <div className="lg:col-span-7 space-y-4 flex flex-col min-w-0">
                
                {/* DECISÕES SUGERIDAS */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden flex-1 backdrop-blur-sm flex flex-col hover:border-amber-300/30">
                    <div className="bg-gradient-to-r from-emerald-50/50 to-amber-50/30 p-4 border-b border-emerald-200/50 flex justify-between items-center">
                        <h2 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={14} className="text-amber-500" /> Decisões Recomendadas
                        </h2>
                        {loading ? (
                            <Loader2 className="animate-spin text-amber-500" size={12} />
                        ) : (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                        )}
                    </div>
                    
                    <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-center bg-white">
                        {QUESTIONS_LABELS.map((q, index) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all duration-300 gap-2 group shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm group-hover:border-amber-300 transition-colors">0{index + 1}</span>
                                    <p className="text-[11px] text-slate-600 font-bold group-hover:text-slate-900 transition-colors uppercase">{q}</p>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg border bg-gradient-to-r from-emerald-50 to-amber-50 border-emerald-300/50 text-emerald-700 text-center sm:min-w-[180px] shrink-0 shadow-sm hover:shadow-md transition-all duration-300">
                                    <span className="font-black text-[11px] uppercase tracking-wider">
                                        {translate(results.answers[index]) || "Sincronizando"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* KPIS DE RESULTADOS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden hover:border-amber-300/30">
                        <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${results.stats.diff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5 relative z-10">
                            Eficácia Estimada
                        </span>
                        <span className={`text-xl sm:text-2xl font-black relative z-10 ${results.stats.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {results.stats.diff > 0 ? '+' : ''}{Number(results.stats.diff).toFixed(2)}%
                        </span>
                    </div>

                    <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 flex flex-col relative overflow-hidden bg-white hover:border-amber-300/30">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.01] rounded-full blur-3xl"></div>
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5 relative z-10">
                            IA Competidora
                        </span>
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-xl sm:text-2xl font-black text-slate-800">
                                {Number(results.stats.opponentProgress).toFixed(2)}<span className="text-xs text-slate-400">%</span>
                            </span>
                        </div>
                        <div className="mt-2.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden relative z-10 border border-slate-200 shadow-inner">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(results.stats.opponentProgress, 100)}%` }} className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* BIBLIOTECA DE PATROCINADORES SALVOS */}
            <section className="lg:col-span-12 space-y-4 pt-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-amber-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-1.5">
                            BIBLIOTECA EM NUVEM
                            <Sparkles size={10} className="text-amber-400" />
                        </h3>
                    </div>
                    <span className="text-[9px] bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg w-fit shadow-sm font-black">
                        {filteredSponsors.length} REGISTROS SALVOS
                    </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full">
                    {filteredSponsors.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-amber-300/30 transition-all duration-300">
                            <Database size={24} className="text-slate-400 mb-2 animate-pulse" />
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                    ) : (
                        filteredSponsors.map((item) => (
                            <motion.div 
                                key={item.id} 
                                layout 
                                className="bg-white border border-slate-200 p-3.5 rounded-2xl hover:border-amber-500/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shadow-sm hover:-translate-y-0.5"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="overflow-hidden min-w-0 pr-2 text-left">
                                        <h4 className="font-black text-slate-800 text-xs truncate uppercase tracking-tight group-hover:text-amber-700 transition-colors">{item.name}</h4>
                                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{item.date}</span>
                                    </div>
                                    <button onClick={() => deleteFromDb(item.id, item.name)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all shrink-0 hover:shadow-md">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                
                                <button 
                                    onClick={() => loadFromDb(item)} 
                                    className="w-full h-8 bg-slate-50 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 text-[10px] font-black text-slate-500 hover:text-white rounded-lg transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-1 border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-lg active:scale-95 relative z-10"
                                >
                                    Carregar <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
        </main>

        {/* MODAL SYSTEM COM TOQUE DOURADO */}
        <AnimatePresence>
            {modal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white border border-slate-200 w-full max-w-xs rounded-2xl shadow-2xl relative z-10 overflow-hidden">
                        <div className={`h-1 w-full ${modal.type === 'alert' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : modal.type === 'confirm' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-amber-500'}`} />
                        <div className="p-5 text-left bg-white">
                            <h3 className="text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-1.5">
                                {modal.type === 'alert' && <TrendingDown size={14} className="text-amber-500" />}
                                {modal.type === 'confirm' && <Crown size={14} className="text-emerald-500" />}
                                {modal.type === 'info' && <Info size={14} className="text-emerald-500" />}
                                {modal.title}
                            </h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed mb-6 font-bold">{modal.message}</p>
                            <div className="flex gap-2">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-md hover:shadow-lg active:scale-95">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Entendido</button>
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

// --- SUB-COMPONENTES OTIMIZADOS COM TOQUE DOURADO ---

function AttributeSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div className="flex flex-col gap-1.5 group">
            <div className="flex justify-between items-end px-0.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">{label}</span>
                <span className="text-[10px] font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm group-hover:border-amber-300 transition-colors">{value} <span className="text-slate-400">/ 7</span></span>
            </div>
            
            <div className="flex gap-1 h-5 sm:h-6">
                {[1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isActive = idx <= value;
                    let colorClass = 'bg-slate-50 border-slate-200 hover:bg-slate-100';
                    
                    if (isActive) {
                        if (value <= 2) colorClass = 'bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)] hover:bg-rose-600';
                        else if (value >= 6) colorClass = 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)] hover:bg-emerald-600';
                        else colorClass = 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)] hover:bg-amber-600';
                    }

                    return (
                        <button 
                            key={idx} 
                            onClick={() => onChange(idx)} 
                            className={`flex-1 rounded-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${colorClass}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, highlight }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, highlight?: boolean }) {
    return (
        <div className={`flex flex-col bg-white p-2 sm:p-2.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md hover:border-amber-300/50 ${highlight ? 'border-amber-300 bg-gradient-to-r from-amber-50/50 to-amber-100/30' : 'border-slate-200 bg-[#f8fafc] hover:bg-white'}`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${highlight ? 'text-amber-600' : 'text-slate-400'}`}>
                {label}
            </span>
            <div className="flex items-center gap-0.5">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className={`w-full bg-transparent text-xs font-black outline-none ${highlight ? 'text-amber-600' : 'text-slate-800'}`} 
                />
                {suffix && <span className="text-[10px] font-bold text-slate-400">{suffix}</span>}
            </div>
        </div>
    )
}