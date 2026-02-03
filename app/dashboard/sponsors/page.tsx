'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, Save, Search, Users, Target, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Handshake, Gauge, Loader2, X, AlertTriangle, AlertCircle, Info, TrendingDown,
  ChevronDown, HelpCircle
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

// --- CONSTANTES ---
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

const BASE_STORAGE_KEY = 'gpro_sponsors_db';

export default function SponsorsPage() {
  const router = useRouter();

  // --- ESTADOS DO NEGÓCIO ---
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

  const [sponsorName, setSponsorName] = useState("");
  const [results, setResults] = useState({
      answers: ["...", "...", "...", "...", "..."],
      stats: { diff: 0, opponentProgress: 0 }
  });

  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savedSponsors, setSavedSponsors] = useState<SavedSponsor[]>([]);
  
  // --- UI STATES (MODAL) ---
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'info';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  // --- ESTADO DE AUTENTICAÇÃO ---
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');

  // --- MODAL HELPERS ---
  const showAlert = (title: string, message: string) => setModal({ isOpen: true, type: 'alert', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // --- 1. AUTH CHECK ---
  useEffect(() => {
    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            setUserId(session.user.id);
            if (session.user.email) setUserEmail(session.user.email);
        } catch (error) { router.push('/login'); } finally { setIsAuthLoading(false); }
    }
    checkSession();
  }, [router]);

  // --- 2. LOAD DATA ---
  useEffect(() => {
    if (userId) {
        const userKey = `${BASE_STORAGE_KEY}_${userId}`;
        const saved = localStorage.getItem(userKey);
        if (saved) { try { setSavedSponsors(JSON.parse(saved)); } catch (e) { } }
    }
  }, [userId]);

  // --- 3. AUTO SAVE ---
  useEffect(() => {
    if (userId) { localStorage.setItem(`${BASE_STORAGE_KEY}_${userId}`, JSON.stringify(savedSponsors)); }
  }, [savedSponsors, userId]);

  const filteredSponsors = savedSponsors.filter(sponsor => 
      sponsor.name.toLowerCase().includes(sponsorName.toLowerCase())
  );

  const handleAttributeChange = (field: SponsorAttribute, value: number) => {
    setAttributes(prev => ({ ...prev, [field]: value }));
  };

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
        if (data.sucesso) { setResults(data.data); }
      } catch (e) { } finally { setLoading(false); }
  }, [attributes, userId]);

  useEffect(() => {
      if (!userId) return;
      const timer = setTimeout(() => { fetchSponsorData(); }, 500);
      return () => clearTimeout(timer);
  }, [attributes, fetchSponsorData, userId]);

  const saveToDb = () => {
      if (!sponsorName.trim()) return showAlert("Campo Obrigatório", "Por favor, digite o nome do patrocinador.");
      
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
              setSavedSponsors(newList);
          });
      } else {
          setSavedSponsors([newItem, ...savedSponsors]);
      }
  };

  const loadFromDb = (item: SavedSponsor) => {
      setSponsorName(item.name);
      setAttributes(item.attributes);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteFromDb = (id: string, name: string) => {
      showConfirm("Excluir", `Remover "${name}" do banco de dados?`, () => {
          setSavedSponsors(savedSponsors.filter(s => s.id !== id));
      });
  };

  if (isAuthLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#050507]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-amber-500/20 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] text-slate-300 font-mono pb-20">
        
        {/* === HEADER ALFA RACING === */}
        <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#050507]/80">
            <div className="max-w-[1600px] mx-auto p-4 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl shadow-lg">
                        <Briefcase className="text-amber-500" size={18} />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-0.5">Sponsor Negotiation</h1>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">{userEmail}</p>
                    </div>
                </div>

                <div className="flex-1 max-w-md relative">
                    <input 
                        type="text" 
                        value={sponsorName}
                        onChange={(e) => setSponsorName(e.target.value)}
                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-10 text-xs font-bold text-white outline-none focus:border-amber-500/50 transition-all"
                        placeholder="Nome do Patrocinador..."
                    />
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
                
                <button 
                    onClick={saveToDb}
                    className="p-3 sm:px-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-amber-400/20"
                >
                    <Save size={16} />
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Salvar</span>
                </button>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            
            {/* === COLUNA ESQUERDA: PERFIL (5/12) === */}
            <div className="lg:col-span-5 space-y-6">
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 size={14} className="text-amber-500" /> Perfil Comercial
                        </h3>
                        <HelpCircle size={14} className="text-slate-600" />
                    </div>
                    <div className="p-4 md:p-6 space-y-5">
                        <AttributeSlider label="Finanças" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                        <AttributeSlider label="Expectativas" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                        <AttributeSlider label="Paciência" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                        <AttributeSlider label="Reputação" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                        <AttributeSlider label="Imagem" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                        <AttributeSlider label="Negociação" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                    </div>
                </section>

                <section className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Gauge size={14} className="text-indigo-400" /> Métricas Rodada
                    </h3>
                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                        <MetricInput label="Prog. Atual" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" />
                        <MetricInput label="Prog. Médio" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" />
                        <MetricInput label="Gerentes" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight />
                    </div>
                </section>
            </div>

            {/* === COLUNA DIREITA: RESULTADOS (7/12) === */}
            <div className="lg:col-span-7 space-y-6">
                <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                    <div className="bg-amber-500/10 p-4 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={16} /> Respostas Estratégicas
                        </h2>
                        {loading && <div className="animate-pulse flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span className="text-[9px] text-amber-500 font-black">CALCULANDO</span>
                        </div>}
                    </div>
                    <div className="p-4 md:p-6 space-y-3">
                        {QUESTIONS_LABELS.map((q, index) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/40 border border-white/5 rounded-xl p-4 hover:border-amber-500/20 transition-all gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-slate-600 min-w-[20px]">0{index + 1}</span>
                                    <p className="text-[11px] text-slate-400 font-bold leading-tight">{q}</p>
                                </div>
                                <div className={`px-4 py-3 rounded-xl border text-center transition-all ${loading ? 'opacity-30' : 'bg-amber-500/5 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]'}`}>
                                    <span className="font-black text-xs uppercase tracking-wider block">
                                        {translate(results.answers[index]) || "---"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <TrendingUp size={14} /> Diferença Projetada
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-4xl font-black ${results.stats.diff >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {results.stats.diff > 0 ? '+' : ''}{Number(results.stats.diff).toFixed(2)}
                            </span>
                            <span className="text-xs text-slate-600 font-black">%</span>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                            {results.stats.diff >= 0 ? <TrendingUp size={80} /> : <TrendingDown size={80} />}
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Users size={14} /> Progresso Adversário
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-white">
                                {Number(results.stats.opponentProgress).toFixed(2)}
                            </span>
                            <span className="text-xs text-slate-600 font-black">%</span>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                             <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(results.stats.opponentProgress, 100)}%` }}
                                className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                             />
                        </div>
                    </div>
                </div>
            </div>

            {/* === BANCO DE DADOS (FULL WIDTH) === */}
            <section className="lg:col-span-12 space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <History size={16} className="text-slate-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Sponsors Database</h3>
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-[9px] text-amber-500 font-black bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                        {filteredSponsors.length} REGISTROS
                    </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {filteredSponsors.length === 0 ? (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                            <Search size={32} className="text-slate-800 mb-4" />
                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Nenhum patrocinador encontrado</p>
                        </div>
                    ) : (
                        filteredSponsors.map((item) => (
                            <motion.div 
                                key={item.id} 
                                layout
                                className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:border-amber-500/30 transition-all flex flex-col group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="overflow-hidden">
                                        <h4 className="font-black text-white text-sm truncate uppercase tracking-tight">{item.name}</h4>
                                        <span className="text-[9px] text-slate-600 font-bold block mt-1">{item.date}</span>
                                    </div>
                                    <button 
                                        onClick={() => deleteFromDb(item.id, item.name)} 
                                        className="text-slate-700 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                
                                <div className="space-y-2 mb-6">
                                    <DBMiniMetric label="FIN" val={item.attributes.finances} color="bg-indigo-500" />
                                    <DBMiniMetric label="EXP" val={item.attributes.expectations} color="bg-emerald-500" />
                                    <DBMiniMetric label="NEG" val={item.attributes.negotiation} color="bg-amber-500" />
                                </div>
                                
                                <button 
                                    onClick={() => loadFromDb(item)} 
                                    className="w-full h-11 bg-white/5 hover:bg-amber-600 text-[10px] font-black text-slate-400 hover:text-white rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 group-hover:border-amber-500/50 border border-transparent"
                                >
                                    Carregar Dados <ChevronRight size={14} />
                                </button>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
        </main>

        {/* --- CUSTOM DIALOGS --- */}
        <AnimatePresence>
            {modal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0f0f12] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden">
                        <div className={`h-1.5 w-full ${modal.type === 'alert' ? 'bg-rose-500' : modal.type === 'confirm' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                {modal.type === 'alert' && <AlertTriangle className="text-rose-500" size={24} />}
                                {modal.type === 'confirm' && <AlertCircle className="text-indigo-500" size={24} />}
                                {modal.type === 'info' && <Info className="text-emerald-500" size={24} />}
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">{modal.title}</h3>
                            </div>
                            <p className="text-slate-400 text-xs leading-relaxed mb-8">{modal.message}</p>
                            <div className="flex gap-3">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-white/5 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-white/5 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Fechar</button>
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
        <div className="flex flex-col gap-2 group">
            <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-amber-500 transition-colors">{label}</span>
                <span className="text-[10px] font-black text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{value}</span>
            </div>
            <div className="flex gap-1.5 h-10 md:h-8">
                {[1, 2, 3, 4, 5, 6, 7].map((idx) => (
                    <button 
                        key={idx} 
                        onClick={() => onChange(idx)} 
                        className={`flex-1 rounded-md transition-all duration-300 border h-full
                            ${idx <= value 
                                ? (value <= 2 ? 'bg-rose-500 border-rose-400' : value >= 6 ? 'bg-emerald-500 border-emerald-400' : 'bg-amber-500 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]') 
                                : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                    />
                ))}
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, highlight }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, highlight?: boolean }) {
    return (
        <div className={`flex flex-col bg-black/40 p-3 rounded-2xl border transition-all ${highlight ? 'border-amber-500/30' : 'border-white/5'}`}>
            <span className={`text-[8px] font-black uppercase tracking-widest mb-1.5 ${highlight ? 'text-amber-500' : 'text-slate-600'}`}>
                {label}
            </span>
            <div className="flex items-center gap-1">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className="w-full bg-transparent text-sm font-black text-white outline-none" 
                />
                {suffix && <span className="text-[9px] font-bold text-slate-700">{suffix}</span>}
            </div>
        </div>
    )
}

function DBMiniMetric({ label, val, color }: { label: string, val: number, color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[8px] text-slate-600 font-black w-6">{label}</span>
            <div className="h-1 bg-white/5 flex-1 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${(val / 7) * 100}%` }} />
            </div>
            <span className="text-[8px] text-slate-400 font-black w-2">{val}</span>
        </div>
    )
}