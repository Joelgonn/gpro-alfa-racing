'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, Save, Search, Users, Target, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Handshake, Gauge, Loader2, X, AlertTriangle, AlertCircle, Info, TrendingDown,
  ChevronDown, HelpCircle, Sparkles, Cloud, Database // <-- Database adicionado aqui!
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
      setSavedSponsors(newList); // Update UI immediately (Optimistic)
      
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
      if (!sponsorName.trim()) return showAlert("Ops!", "Dê um nome ao patrocinador.");
      
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
    <div className="flex h-screen items-center justify-center bg-[#050507]">
      <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-amber-500" size={32} />
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest animate-pulse">Conectando à Nuvem...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] text-slate-300 font-mono pb-24 overflow-x-hidden">
        
        {/* HEADER MOBILE-FIRST */}
        <div className="p-3 md:p-6 pb-0 max-w-[1600px] mx-auto sticky top-0 md:top-2 z-40">
            <div className="bg-[#0c0c10]/90 backdrop-blur-xl border border-white/5 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col md:flex-row gap-4 justify-between items-center w-full">
                
                <div className="flex justify-between items-center w-full md:w-auto gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                            <Briefcase className="text-amber-500" size={20} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xs md:text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Negociações</h1>
                            <div className="flex items-center gap-1.5">
                                <Cloud size={10} className="text-emerald-500" />
                                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-wider">Sync Ativo</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto md:flex-1 md:max-w-md">
                    <div className="relative flex-1">
                        <input 
                            type="text" 
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            className="w-full h-12 md:h-11 bg-[#050507] border border-white/10 rounded-xl px-10 text-xs font-bold text-white outline-none focus:border-amber-500/50 focus:bg-white/5 transition-all shadow-inner"
                            placeholder="Nome do Patrocinador..."
                        />
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    <button 
                        onClick={saveToDb}
                        className="h-12 w-12 md:h-11 md:w-auto md:px-5 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all active:scale-90 flex items-center justify-center gap-2 border border-amber-400/20 shrink-0"
                    >
                        <Save size={18} />
                        <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Salvar</span>
                    </button>
                </div>

            </div>
        </div>

        <main className="max-w-[1600px] mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
            
            {/* COLUNA ESQUERDA: PERFIL DO PATROCINADOR */}
            <div className="lg:col-span-5 space-y-6 flex flex-col min-w-0">
                
                {/* SLIDERS DE ATRIBUTOS */}
                <section className="bg-[#0b0b10] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                    <div className="bg-white/5 p-4 md:p-5 border-b border-white/5 flex justify-between items-center relative z-10">
                        <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 size={16} className="text-amber-500" /> Perfil Comercial
                        </h3>
                    </div>
                    <div className="p-4 md:p-6 space-y-5 md:space-y-6 relative z-10">
                        <AttributeSlider label="Finanças" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                        <AttributeSlider label="Expectativas" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                        <AttributeSlider label="Paciência" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                        <AttributeSlider label="Reputação" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                        <AttributeSlider label="Imagem" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                        <AttributeSlider label="Negociação" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                    </div>
                </section>

                {/* MÉTRICAS DA RODADA (GRID RESPONSIVO) */}
                <section className="bg-[#0b0b10] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                    <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                        <Gauge size={16} className="text-indigo-400" /> Progresso da Negociação
                    </h3>
                    <div className="grid grid-cols-3 gap-2 md:gap-4 relative z-10">
                        <MetricInput label="Atual" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" />
                        <MetricInput label="Médio" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" />
                        <MetricInput label="Gerentes" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight />
                    </div>
                </section>
            </div>

            {/* COLUNA DIREITA: RESULTADOS E KPIS */}
            <div className="lg:col-span-7 space-y-6 flex flex-col min-w-0">
                
                {/* RESPOSTAS SUGERIDAS */}
                <section className="bg-[#0b0b10] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative flex-1">
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
                    <div className="bg-emerald-500/10 p-4 md:p-5 border-b border-emerald-500/20 flex justify-between items-center relative z-10">
                        <h2 className="text-[10px] md:text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={16} /> Decisões Sugeridas
                        </h2>
                        {loading ? (
                            <Loader2 className="animate-spin text-emerald-500" size={16} />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                        )}
                    </div>
                    
                    <div className="p-4 md:p-6 space-y-3 relative z-10">
                        {QUESTIONS_LABELS.map((q, index) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#050507] border border-white/5 rounded-xl p-4 md:p-5 hover:border-emerald-500/20 transition-all gap-3 md:gap-4 group">
                                <div className="flex items-start md:items-center gap-3">
                                    <span className="text-[10px] md:text-xs font-black text-slate-700 bg-white/5 px-2 py-1 rounded">0{index + 1}</span>
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold leading-tight group-hover:text-slate-300 transition-colors mt-0.5 md:mt-0">{q}</p>
                                </div>
                                <div className="px-4 py-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-emerald-400 text-center sm:min-w-[200px] shadow-inner">
                                    <span className="font-black text-[10px] md:text-xs uppercase tracking-wider drop-shadow-md">
                                        {translate(results.answers[index]) || "..."}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* KPIS (2 COLUNAS NO MOBILE) */}
                <div className="grid grid-cols-2 gap-3 md:gap-6">
                    <div className="bg-[#0b0b10] border border-white/5 rounded-2xl p-5 md:p-6 flex flex-col justify-center relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-20 ${results.stats.diff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2 relative z-10">
                            {results.stats.diff >= 0 ? <TrendingUp size={14} className="text-emerald-500"/> : <TrendingDown size={14} className="text-rose-500"/>} 
                            Eficácia Projetada
                        </span>
                        <span className={`text-2xl md:text-4xl font-black relative z-10 ${results.stats.diff >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}>
                            {results.stats.diff > 0 ? '+' : ''}{Number(results.stats.diff).toFixed(2)}%
                        </span>
                    </div>

                    <div className="bg-[#0b0b10] border border-white/5 rounded-2xl p-5 md:p-6 flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                        <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2 relative z-10">
                            <Users size={14} className="text-indigo-400"/> IA Adversária
                        </span>
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-2xl md:text-4xl font-black text-white drop-shadow-md">
                                {Number(results.stats.opponentProgress).toFixed(2)}<span className="text-lg md:text-xl text-slate-500">%</span>
                            </span>
                        </div>
                        <div className="mt-4 w-full h-1.5 md:h-2 bg-[#050507] rounded-full overflow-hidden relative z-10 border border-white/5">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(results.stats.opponentProgress, 100)}%` }} className="h-full bg-gradient-to-r from-indigo-600 to-blue-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* SESSÃO CLOUD DATABASE */}
            <section className="lg:col-span-12 space-y-6 pt-6 md:pt-8 w-full">
                <div className="flex flex-col md:flex-row md:items-center gap-3 px-1">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-slate-500" />
                        <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em]">Biblioteca na Nuvem</h3>
                    </div>
                    <div className="hidden md:block h-px flex-1 bg-white/5 mx-4" />
                    <span className="text-[9px] text-amber-500 font-black bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-fit">
                        {filteredSponsors.length} REGISTROS SALVOS
                    </span>
                </div>
                
                {/* GRID DE CARDS SALVOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                    {filteredSponsors.length === 0 ? (
                        <div className="col-span-full py-16 md:py-24 flex flex-col items-center justify-center bg-white/[0.01] border border-dashed border-white/10 rounded-3xl">
                            <Database size={32} className="text-slate-700 mb-4" />
                            <p className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-widest">Nenhum patrocinador na nuvem</p>
                        </div>
                    ) : (
                        filteredSponsors.map((item) => (
                            <motion.div key={item.id} layout className="bg-[#0b0b10] border border-white/5 p-4 md:p-5 rounded-2xl hover:border-amber-500/30 transition-all flex flex-col group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex justify-between items-start mb-5 relative z-10">
                                    <div className="overflow-hidden min-w-0 pr-2">
                                        <h4 className="font-black text-white text-sm md:text-base truncate uppercase tracking-tight">{item.name}</h4>
                                        <span className="text-[9px] text-slate-500 font-bold block mt-1">{item.date}</span>
                                    </div>
                                    <button onClick={() => deleteFromDb(item.id, item.name)} className="text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-all shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                
                                <button onClick={() => loadFromDb(item)} className="mt-auto w-full h-12 bg-[#050507] hover:bg-amber-500 text-[10px] font-black text-slate-400 hover:text-[#050507] rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5 hover:border-amber-400 shadow-inner group-hover:shadow-none relative z-10">
                                    Carregar Dados <ChevronRight size={14} />
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
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-[#0f0f12] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden">
                        <div className={`h-1.5 w-full ${modal.type === 'alert' ? 'bg-amber-500' : modal.type === 'confirm' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                        <div className="p-6">
                            <h3 className="text-lg font-black text-white uppercase mb-3">{modal.title}</h3>
                            <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-8">{modal.message}</p>
                            <div className="flex gap-3">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-white/5 active:bg-white/10 text-white py-3.5 rounded-xl text-[10px] font-black uppercase transition-colors">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-indigo-600 active:bg-indigo-700 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-white/5 active:bg-white/10 text-white py-3.5 rounded-xl text-[10px] font-black uppercase transition-colors">Entendido</button>
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

// --- SUB-COMPONENTES ---

function AttributeSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div className="flex flex-col gap-2.5 group">
            <div className="flex justify-between items-end px-1">
                <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-amber-500 transition-colors">{label}</span>
                <span className="text-[10px] font-black text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 shadow-inner">{value} <span className="text-slate-600">/ 7</span></span>
            </div>
            <div className="flex gap-1 md:gap-1.5 h-10 md:h-8">
                {[1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isActive = idx <= value;
                    let colorClass = 'bg-white/5 border-white/5 active:bg-white/10';
                    
                    if (isActive) {
                        if (value <= 2) colorClass = 'bg-rose-500 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
                        else if (value >= 6) colorClass = 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
                        else colorClass = 'bg-amber-500 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
                    }

                    return (
                        <button 
                            key={idx} 
                            onClick={() => onChange(idx)} 
                            className={`flex-1 rounded border transition-all duration-300 ${colorClass}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, highlight }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, highlight?: boolean }) {
    return (
        <div className={`flex flex-col bg-[#050507] p-3 rounded-xl border transition-all shadow-inner ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5'}`}>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-1.5 ${highlight ? 'text-amber-500' : 'text-slate-500'}`}>
                {label}
            </span>
            <div className="flex items-center gap-1">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className={`w-full bg-transparent text-sm md:text-base font-black outline-none ${highlight ? 'text-amber-400' : 'text-white'}`} 
                />
                {suffix && <span className="text-[10px] font-bold text-slate-600">{suffix}</span>}
            </div>
        </div>
    )
}