'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { supabase } from '../../lib/supabase'; 
import { useGame } from '../../context/GameContext';
import { 
  RefreshCw, History, ArrowRight,
  Calculator, Trophy, Timer, Target, Cpu,
  AlertCircle, CheckCircle2, Flag, StopCircle, Info, X, AlertTriangle, ChevronDown,
  Sparkles, Zap, Flame, Gauge, Brain, Star, Loader2, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONSTANTES ---
const PARTS = ["Asa Dianteira", "Asa Traseira", "Motor", "Freios", "Câmbio", "Suspensão"];
const BASE_STORAGE_KEY = 'gpro_manual_setup_session';

const ALL_FEEDBACK_OPTIONS: Record<string, string[]> = {
    "Asa Dianteira": ["Falta ao carro muita velocidade nas retas", "O carro está perdendo alguma velocidade nas retas", "O carro poderia ter um pouco mais de velocidade nas retas", "OK", "Estou perdendo um pouco de aderência nas curvas", "O carro é muito instável em muitas curvas", "Não posso dirigir o carro, ele não tem aderência"],
    "Asa Traseira": ["Falta ao carro muita velocidade nas retas", "O carro está perdendo alguma velocidade nas retas", "O carro poderia ter um pouco mais de velocidade nas retas", "OK", "Estou perdendo um pouco de aderência nas curvas", "O carro é muito instável em muitas curvas", "Não posso dirigir o carro, ele não tem aderência"],
    "Motor": ["Não, não, não!!! Favoreça muito mais as baixas rotações!", "As rotações estão muito altas", "Tente favorecer um pouco mais as baixas rotações", "OK", "Eu sinto que não tenho força suficiente no motor durante as retas", "A força do motor nas retas não é suficiente", "Você deve tentar favorecer muito mais as altas rotações"],
    "Freios": ["Por favor, coloque o balanço dos freios muito mais para trás", "Eu penso que a eficácia dos freios pode ser maior se movermos o balanço para trás", "Coloque o balanço um pouco mais para trás", "OK", "Eu gostaria de ter o balanço um pouco mais para frente", "Eu penso que a eficácia dos freios pode ser maior se movermos o balanço para frente", "Eu me sentiria muito mais confortável se movêssemos o balanço para a frente"],
    "Câmbio": ["Por favor, coloque um pouco menor o intervalo entre as marchas.", "A relação do câmbio é muito longa", "Eu não posso tirar vantagem da força do motor. Coloque a relação do câmbio um pouco menor", "OK", "Estou muito frequentemente no vermelho. Coloque a relação do câmbio um pouco mais alta", "A relação do câmbio está muito curta", "Eu sinto que o motor vai explodir. Coloque o intervalo de marchas bem maior."],
    "Suspensão": ["O carro está rígido demais. Diminua muito mais a rigidez", "A rigidez da suspensão está muito alta", "O carro está muito rígido. Diminua um pouco a rigidez", "OK", "Eu penso que com uma suspensão um pouco mais rígida eu poderei ir mais rápido", "A rigidez da suspensão está muito baixa", "A rigidez da suspensão deve ser muito maior"]
};

// --- HELPERS (OTIMIZADOS PARA LIGHT MODE) ---
const getShortFeedback = (msg: string) => {
    if (!msg) return "PENDENTE";
    if (msg === "OK") return "NOMINAL";
    if (msg.includes("muito mais") || msg.includes("não posso") || msg.includes("muito alta") || msg.includes("muito rígid") || msg.includes("muito curta") || msg.includes("explodir") || msg.includes("Não, não, não")) {
        return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") || msg.includes("diminua") ? "CRÍT. BAIXO" : "CRÍT. ALTO";
    }
    if (msg.includes("um pouco") || msg.includes("pode ser maior") || msg.includes("gostaria") || msg.includes("Tente")) {
        return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") || msg.includes("diminua") ? "AJUSTE BAIXO" : "AJUSTE ALTO";
    }
    return "REQUER AJUSTE";
};

const getFeedbackBadgeClass = (msg: string) => {
    if (!msg) return "bg-slate-50 text-slate-400 border-slate-200";
    if (msg === "OK") return "bg-emerald-50 text-emerald-600 border-emerald-300 shadow-sm font-black";
    if (msg.includes("muito") || msg.includes("não") || msg.includes("explodir") || msg.includes("Não, não, não")) {
      return "bg-rose-50 text-rose-600 border-rose-300 shadow-sm font-black";
    }
    return "bg-amber-50 text-amber-600 border-amber-300 shadow-sm font-black";
};

const getGradientClass = (part: string, isFinished: boolean) => {
    if (isFinished) return "from-amber-500/10 via-amber-600/5 to-transparent border-amber-300/50";
    const gradients: Record<string, string> = {
        "Asa Dianteira": "from-blue-500/5 via-cyan-500/5 to-transparent border-slate-200",
        "Asa Traseira": "from-indigo-500/5 via-purple-500/5 to-transparent border-slate-200",
        "Motor": "from-rose-500/5 via-red-500/5 to-transparent border-slate-200",
        "Freios": "from-orange-500/5 via-amber-500/5 to-transparent border-slate-200",
        "Câmbio": "from-emerald-500/5 via-teal-500/5 to-transparent border-slate-200",
        "Suspensão": "from-violet-500/5 via-purple-500/5 to-transparent border-slate-200"
    };
    return gradients[part] || "from-slate-500/5 to-transparent border-slate-200";
};

const getPartIcon = (part: string, isFinished: boolean): React.ReactNode => {
    const color = isFinished ? "text-amber-500" : "";
    const icons: Record<string, React.ReactNode> = {
        "Asa Dianteira": <Zap size={10} className={`${color || 'text-blue-500'}`} />,
        "Asa Traseira": <Zap size={10} className={`${color || 'text-indigo-500'}`} />,
        "Motor": <Flame size={10} className={`${color || 'text-rose-500'}`} />,
        "Freios": <Gauge size={10} className={`${color || 'text-amber-500'}`} />,
        "Câmbio": <Sparkles size={10} className={`${color || 'text-emerald-600'}`} />,
        "Suspensão": <Brain size={10} className={`${color || 'text-violet-500'}`} />
    };
    return icons[part] || <Star size={10} />;
};

export default function ManualSetupPage() {
    const router = useRouter();
    
    // ✅ PEGAR DADOS DO GameContext
    const { driverEditable } = useGame();
    
    // --- STATE DO SETUP ---
    const [xp, setXp] = useState<string>("0");
    const [ct, setCt] = useState<string>("0");
    const [zs, setZs] = useState({ total: 0, half: 0 });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputs, setInputs] = useState<Record<string, number>>({
        "Asa Dianteira": 500, "Asa Traseira": 500, "Motor": 500, 
        "Freios": 500, "Câmbio": 500, "Suspensão": 500
    });
    const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
    const [analysis, setAnalysis] = useState<Record<string, { final: any, margin: any }>>({});
    const [availableOptions, setAvailableOptions] = useState<Record<string, string[]>>(ALL_FEEDBACK_OPTIONS);
    const [isManuallyFinished, setIsManuallyFinished] = useState(false);
    
    // --- STATE DE UI ---
    const [modal, setModal] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'info';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const [activeFeedbackPart, setActiveFeedbackPart] = useState<string | null>(null);

    // --- STATE DE AUTENTICAÇÃO ---
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');

    // ✅ ATUALIZAR XP E CT QUANDO O GameContext MUDAR
    useEffect(() => {
        if (driverEditable) {
            // XP = experiencia
            const xpValue = driverEditable.experiencia || 0;
            // CT = tecnica (Conhec. Técnico)
            const ctValue = driverEditable.tecnica || 0;
            setXp(String(xpValue));
            setCt(String(ctValue));
        }
    }, [driverEditable]);

    // --- FUNÇÕES DE UI ---
    const showAlert = (title: string, message: string) => setModal({ isOpen: true, type: 'alert', title, message });
    const showInfo = (title: string, message: string) => setModal({ isOpen: true, type: 'info', title, message });
    const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

    // --- INITIALIZATION ---
    useEffect(() => {
        async function initSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            const uid = session.user.id;
            setUserId(uid);
            setUserEmail(session.user.email || 'Gerente');
            
            const userKey = `${BASE_STORAGE_KEY}_${uid}`;
            const saved = localStorage.getItem(userKey);
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    if (data.xp) setXp(data.xp);
                    if (data.ct) setCt(data.ct);
                    setZs(data.zs || { total: 0, half: 0 });
                    setHistory(data.history || []); 
                    setInputs(data.inputs || inputs);
                    setAnalysis(data.analysis || {}); 
                    setAvailableOptions(data.availableOptions || ALL_FEEDBACK_OPTIONS);
                    setIsManuallyFinished(data.isManuallyFinished || false);
                } catch(e) { console.error("Erro ao ler storage", e); }
            }
        }
        initSession();
    }, [router]);

    useEffect(() => {
        if (userId) {
            const userKey = `${BASE_STORAGE_KEY}_${userId}`;
            localStorage.setItem(userKey, JSON.stringify({ xp, ct, zs, history, inputs, analysis, availableOptions, isManuallyFinished }));
        }
    }, [xp, ct, zs, history, inputs, analysis, availableOptions, userId, isManuallyFinished]);

    // --- HANDLERS ---
    const handleReset = () => showConfirm("Reiniciar Sessão?", "Isso apagará todo o histórico de voltas atual.", () => {
        if (userId) { localStorage.removeItem(`${BASE_STORAGE_KEY}_${userId}`); }
        window.location.reload();
    });

    const handleManualFinish = () => {
        if (history.length === 0) return showAlert("Atenção", "Processe pelo menos uma volta.");
        showConfirm("Encerrar Sessão", "Deseja ver os valores ideais agora?", () => {
            setIsManuallyFinished(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    const handleCalculate = async () => {
        if (!userId) return;
        if (!xp || !ct || xp === "0") return showAlert("Dados Incompletos", "Insira XP (Experiência) e CT (Conhec.Técnico) do piloto.");
        const missingFeedbacks = PARTS.filter(p => !feedbacks[p]);
        if (missingFeedbacks.length > 0) return showAlert("Feedback Pendente", `Faltam: ${missingFeedbacks.join(', ')}`);

        setLoading(true);
        const payload = { 
            driver: { xp, ct }, history, 
            currentLapData: PARTS.reduce((acc: any, part) => { acc[part] = { acerto: inputs[part], msg: feedbacks[part] }; return acc; }, {}) 
        };
        
        try {
            const res = await fetch('/api/manual', { method: 'POST', headers: { 'Content-Type': 'application/json', 'user-id': userId }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (json.sucesso) {
                setZs(json.data.zs);
                setHistory([...history, json.data.processedLap]);
                if (history.length < 7) setInputs(json.data.nextSuggestions);
                setAnalysis(json.data.finalAnalysis);
                if (json.data.allowedOptions) setAvailableOptions(json.data.allowedOptions);
                setFeedbacks({}); 
            } else { showAlert("Erro de Cálculo", json.error || "Erro ao processar."); }
        } catch (e) { showAlert("Erro de Conexão", "Não foi possível conectar."); } finally { setLoading(false); }
    };

    const isFinished = history.length >= 8 || isManuallyFinished;

    if (!userId) return (
        <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
             <div className="w-12 h-12 border-2 border-emerald-500/10 rounded-full flex items-center justify-center relative">
                <div className="w-12 h-12 border-2 border-t-emerald-600 rounded-full animate-spin absolute" />
                <Calculator size={16} className="animate-pulse text-emerald-600" />
             </div>
             <span className="tracking-widest uppercase font-bold text-xs">CONECTANDO SISTEMA...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 md:pb-12 selection:bg-amber-500/20 relative overflow-hidden">
            
            {/* GLOWS AMBIENTAIS COM TOQUE DOURADO */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.02] blur-[120px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/[0.01] blur-[150px] rounded-full" />
            </div>

            {/* HEADER BAR COM TOQUE DOURADO */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 bg-white/90 p-3.5 sm:p-4.5 relative shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-amber-500/[0.02] to-emerald-500/[0.02] pointer-events-none" />
                <div className="max-w-[1600px] mx-auto flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                         <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-2.5 rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
                            <Calculator size={16} className="text-white" />
                         </div>
                         <div className="flex flex-col text-left">
                            <h1 className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                                Calculadora Manual
                                <span className="text-[8px] bg-gradient-to-r from-amber-500 to-amber-600 text-white px-1.5 py-0.5 rounded-full font-black shadow-sm">PRO</span>
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{userEmail}</p>
                         </div>
                    </div>
                    <button 
                        onClick={handleReset} 
                        className="p-2.5 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl border border-rose-200 hover:border-rose-400 transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
                        title="Reiniciar Sessão"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10">
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    
                    {/* COLUNA ESQUERDA: PARÂMETROS DO PILOTO E ANÁLISE */}
                    <div className="xl:col-span-3 space-y-4">
                        
                        {/* PARÂMETROS DO PILOTO */}
                        <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-sm group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-amber-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg shadow-sm">
                                    <Cpu size={14} className="text-white" />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Biometria do Piloto</h3>
                            </div>
                            <div className="relative p-4 grid grid-cols-2 gap-3.5 bg-white">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Experiência (XP)</label>
                                    <input type="number" value={xp} onChange={e=>setXp(e.target.value)} disabled={history.length > 0} className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 text-slate-800 font-black text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-40 text-xs shadow-inner hover:border-slate-300" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Conhe. Técnico (CT)</label>
                                    <input type="number" value={ct} onChange={e=>setCt(e.target.value)} disabled={history.length > 0} className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-2.5 text-slate-800 font-black text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all disabled:opacity-40 text-xs shadow-inner hover:border-slate-300" />
                                </div>
                            </div>
                        </section>

                        {/* SCANNER DE MARGENS COM DETALHES DOURADOS */}
                        <section className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-sm group min-h-[250px]">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-amber-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-sm">
                                        <Target size={14} className="text-white" />
                                    </div>
                                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Scanner de Margens</h3>
                                </div>
                                {history.length > 0 && (
                                    <div className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 px-3 py-1 rounded-lg border border-amber-200 font-black text-[9px] shadow-sm animate-pulse">
                                        <Crown size={10} className="inline mr-1" /> VOLTA {history.length}
                                    </div>
                                )}
                            </div>
                            <div className="relative p-4 space-y-4 bg-white">
                                {PARTS.map(part => {
                                    const data = analysis[part];
                                    const gradient = data?.margin ? 
                                        `from-${parseInt(data.margin) > 50 ? 'emerald-500' : parseInt(data.margin) > 20 ? 'amber-500' : 'rose-500'} 
                                         to-${parseInt(data.margin) > 50 ? 'teal-400' : parseInt(data.margin) > 20 ? 'orange-400' : 'red-400'}` 
                                        : 'from-emerald-500 to-teal-400';
                                    
                                    return (
                                        <div key={part} className="space-y-1 group-hover:translate-x-0.5 transition-transform duration-300">
                                            <div className="flex justify-between items-center text-[11px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-tight">{part}</span>
                                                <span className="text-slate-800 font-mono font-black">{data?.margin ? `±${data.margin}` : "ESTIMANDO"}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 relative p-[1px]">
                                                <motion.div 
                                                    initial={{ width: 0 }} 
                                                    animate={{ width: data ? `${Math.min((Number(data.final)/1000)*100, 100)}%` : 0 }} 
                                                    transition={{ duration: 0.8, ease: "easeOut" }} 
                                                    className={`h-full bg-gradient-to-r ${gradient} rounded-full shadow-[0_0_8px_rgba(251,191,36,0.1)]`} 
                                                />
                                                <div className="absolute inset-y-0 left-1/4 w-[1px] bg-slate-200/40"></div>
                                                <div className="absolute inset-y-0 left-2/4 w-[1px] bg-slate-200/40"></div>
                                                <div className="absolute inset-y-0 left-3/4 w-[1px] bg-slate-200/40"></div>
                                                {data && (
                                                    <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.3)]" 
                                                         style={{ left: `calc(${Math.min((Number(data.final)/1000)*100, 100)}% - 3px)` }} />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    </div>

                    {/* ÁREA PRINCIPAL: ACERTO DE TELEMETRIA */}
                    <div className="xl:col-span-9 space-y-5">
                        
                        <section className={`border rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-500 relative ${
                            isFinished 
                                ? 'border-amber-300/50 bg-amber-50/10 shadow-[0_0_30px_rgba(251,191,36,0.05)]' 
                                : 'border-slate-200 bg-white/95 shadow-sm hover:shadow-md transition-shadow duration-300'
                        }`}>
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-amber-500/[0.02] pointer-events-none" />
                            
                            <div className={`relative p-4 border-b flex justify-between items-center ${
                                isFinished 
                                    ? 'border-amber-300/30 bg-gradient-to-r from-amber-50/30 to-transparent' 
                                    : 'border-slate-200 bg-zinc-50'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg ${isFinished ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_4px_12px_rgba(251,191,36,0.2)]' : 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm'}`}>
                                        {isFinished ? <Crown size={14} /> : <Timer size={14} />}
                                    </div>
                                    <h2 className={`text-xs font-black uppercase tracking-widest ${isFinished ? 'text-amber-700' : 'text-slate-800'}`}>
                                        {isFinished ? "🏆 CONFIGURAÇÃO FINAL DEFINIDA" : `Ajustes da Volta ${history.length + 1}`}
                                    </h2>
                                </div>
                                {isFinished && (
                                    <span className="text-[10px] bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 text-amber-700 font-black px-3 py-1 rounded-lg animate-pulse uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                                        <Star size={10} className="fill-amber-500 text-amber-500" /> Sessão Finalizada
                                    </span>
                                )}
                            </div>

                            <div className="relative p-4 sm:p-5 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
                                    {PARTS.map(part => {
                                        const displayValue = isFinished ? analysis[part]?.final : inputs[part];
                                        const currentFeedback = feedbacks[part];
                                        const gradient = getGradientClass(part, isFinished);
                                        const icon = getPartIcon(part, isFinished);
                                        
                                        return (
                                            <div 
                                                key={part} 
                                                className={`relative bg-gradient-to-br ${gradient} border rounded-xl p-3.5 flex flex-col justify-between space-y-3 overflow-hidden group transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                                                    isFinished ? 'hover:border-amber-300/50' : 'hover:border-slate-300'
                                                }`}
                                            >
                                                {isFinished && (
                                                    <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl group-hover:opacity-100 opacity-0 transition-opacity duration-700" />
                                                )}
                                                
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1.5">
                                                    {icon}
                                                    {part}
                                                    {isFinished && (
                                                        <Star size={8} className="text-amber-500 fill-amber-500 ml-1" />
                                                    )}
                                                </label>
                                                
                                                <div className="space-y-2.5">
                                                    <div className="relative">
                                                        {isFinished ? (
                                                            <div className="w-full bg-gradient-to-r from-amber-50/50 to-amber-100/50 border border-amber-200 text-center text-lg font-black py-2 rounded-xl text-amber-700 shadow-inner">
                                                                {displayValue}
                                                            </div>
                                                        ) : (
                                                            <input 
                                                                type="number" 
                                                                value={displayValue} 
                                                                onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} 
                                                                className="w-full h-11 bg-[#f8fafc] border border-slate-200 text-center text-base font-black rounded-xl outline-none text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-inner hover:border-slate-300" 
                                                            />
                                                        )}
                                                    </div>

                                                    {!isFinished && (
                                                        <button 
                                                            onClick={() => setActiveFeedbackPart(part)}
                                                            className={`w-full h-10 px-3.5 rounded-xl border text-[11px] uppercase font-black transition-all flex items-center justify-between text-left group relative overflow-hidden hover:shadow-sm
                                                                ${currentFeedback 
                                                                    ? getFeedbackBadgeClass(currentFeedback) 
                                                                    : 'border-slate-200 bg-[#f8fafc] hover:border-slate-300 hover:bg-slate-50'}`}
                                                        >
                                                            <span className="truncate pr-1 relative z-10">
                                                                {currentFeedback ? getShortFeedback(currentFeedback) : "Selecionar feedback"}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform relative z-10 ${currentFeedback ? 'text-emerald-600' : 'text-slate-400'} group-hover:translate-y-0.5`} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {!isFinished && (
                                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-200">
                                        <button 
                                            onClick={handleManualFinish} 
                                            className="w-full sm:flex-1 h-11 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl font-black uppercase tracking-widest text-[9px] border border-slate-200 hover:border-rose-300 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-300 hover:shadow-md"
                                        >
                                            <StopCircle size={13} /> Encerrar Setup
                                        </button>
                                        <button 
                                            onClick={handleCalculate} 
                                            disabled={loading} 
                                            className="w-full sm:flex-[2] h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm border border-emerald-400 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 active:scale-[0.98] hover:shadow-lg hover:shadow-emerald-500/20"
                                        >
                                            {loading ? <Loader2 size={14} className="animate-spin" /> : <>Calcular Telemetria <ArrowRight size={14} /></>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Histórico de Voltas COM TOQUE DOURADO */}
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 px-1">
                                <div className="p-1 bg-gradient-to-r from-amber-500/20 to-amber-600/20 rounded-lg">
                                    <History size={14} className="text-amber-600" />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Histórico de Voltas</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
                                {history.length > 0 && (
                                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        {history.length}/8
                                    </span>
                                )}
                             </div>

                             <div className="space-y-2.5">
                                {history.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center bg-white shadow-sm hover:border-amber-200 transition-colors duration-300">
                                         <div className="text-3xl mb-2 opacity-20">⏳</div>
                                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Aguardando telemetria inicial</p>
                                    </div>
                                ) : (
                                    [...history].reverse().map((lap, idx) => {
                                        const lapNumber = history.length - idx;
                                        const isLast = idx === 0;
                                        return (
                                            <motion.div 
                                                key={idx} 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                transition={{ delay: idx * 0.05 }}
                                                className={`relative bg-white border shadow-sm rounded-xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                                                    isLast && isFinished 
                                                        ? 'border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.05)]' 
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {isLast && isFinished && (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-transparent" />
                                                )}
                                                
                                                <div className={`relative px-4 py-2 flex justify-between items-center border-b text-xs ${
                                                    isLast && isFinished 
                                                        ? 'bg-gradient-to-r from-amber-50/30 to-transparent border-amber-200/30' 
                                                        : 'bg-zinc-50 border-slate-200'
                                                }`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-800 font-black tracking-widest uppercase flex items-center gap-1.5">
                                                            <Flag size={12} className={`${isLast && isFinished ? 'text-amber-500' : 'text-emerald-600'}`} />
                                                            Volta {lapNumber}
                                                        </span>
                                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black border shadow-sm ${
                                                            isLast && isFinished 
                                                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                                                : 'bg-amber-50 text-amber-600 border-amber-200'
                                                        }`}>
                                                            ZS: {lap.zs || 0}
                                                        </span>
                                                        {isLast && isFinished && (
                                                            <span className="text-[8px] font-black text-amber-500 flex items-center gap-1">
                                                                <Star size={10} className="fill-amber-500 text-amber-500" /> Final
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="relative p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 bg-white">
                                                    {PARTS.map(part => {
                                                        const lapData = lap[part];
                                                        const isOk = lapData.msg === "OK";
                                                        return (
                                                            <div 
                                                                key={part} 
                                                                className={`p-2.5 rounded-lg border transition-all duration-300 ${
                                                                    isOk 
                                                                        ? 'border-emerald-300 bg-emerald-50/50 hover:shadow-md' 
                                                                        : 'border-slate-200 bg-slate-50 hover:shadow-md hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <div className="text-[8px] text-slate-400 uppercase font-black truncate">{part}</div>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <span className={`text-xs font-black ${isOk ? 'text-emerald-600 font-bold' : 'text-slate-800'}`}>{lapData.acerto}</span>
                                                                    <button 
                                                                        onClick={() => showInfo(part, lapData.msg)} 
                                                                        className={`p-1 rounded transition-colors ${
                                                                            isOk 
                                                                                ? 'text-emerald-600 hover:text-emerald-500' 
                                                                                : 'text-slate-400 hover:text-slate-800'
                                                                        }`}
                                                                        title="Ver feedback completo"
                                                                    >
                                                                        <Info size={11} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CUSTOM FEEDBACK PICKER (BOTTOM SHEET) --- */}
            <AnimatePresence>
                {activeFeedbackPart && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => setActiveFeedbackPart(null)}
                        />
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 220 }}
                            className="bg-white border-t border-slate-200 w-full max-w-lg rounded-t-[2rem] shadow-2xl relative z-10 overflow-hidden"
                        >
                            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]" />
                            
                            <div className="p-5 sm:p-6 text-left bg-white">
                                <div className="flex justify-between items-center mb-5">
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none mb-1 flex items-center gap-2">
                                            Feedback
                                            <span className="text-[8px] bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2 py-0.5 rounded-full font-black shadow-sm">PRO</span>
                                        </h3>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 inline-block mt-1">
                                            {activeFeedbackPart}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setActiveFeedbackPart(null)} 
                                        className="bg-slate-100 p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all duration-300"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                
                                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1.5 custom-scrollbar">
                                    {(availableOptions[activeFeedbackPart] || ALL_FEEDBACK_OPTIONS[activeFeedbackPart]).map((opt, i) => {
                                        const isSelected = feedbacks[activeFeedbackPart] === opt;
                                        const isOK = opt === "OK";
                                        
                                        return (
                                            <button 
                                                key={i}
                                                onClick={() => {
                                                    setFeedbacks({ ...feedbacks, [activeFeedbackPart]: opt });
                                                    setActiveFeedbackPart(null);
                                                }}
                                                className={`w-full p-3.5 rounded-xl border text-xs font-bold text-left transition-all duration-300 flex items-center justify-between group relative overflow-hidden hover:shadow-md
                                                    ${isSelected 
                                                        ? (isOK 
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600 font-black shadow-sm' 
                                                            : 'bg-slate-50 border-slate-300 text-slate-800 font-black shadow-sm') 
                                                        : 'bg-white border-slate-150 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'}`}
                                            >
                                                <span className="relative z-10">
                                                    {isOK ? "✅ SATISFEITO (OK)" : opt}
                                                </span>
                                                {isSelected && (
                                                    <div className="relative z-10 bg-emerald-600 p-0.5 rounded-full shadow-sm text-white">
                                                        <CheckCircle2 size={13} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- CUSTOM DIALOGS LIGHT GELO COM TOQUE DOURADO --- */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95 }} 
                            className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative z-50 text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-amber-500/[0.01] pointer-events-none" />
                            
                            <div className="flex items-center gap-3 mb-4 relative">
                                {modal.type === 'alert' ? (
                                    <span className="p-2 bg-rose-50 rounded-xl text-rose-500 border border-rose-200 shadow-sm">
                                        <AlertTriangle size={20} />
                                    </span>
                                ) : modal.type === 'confirm' ? (
                                    <span className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200 shadow-sm">
                                        <Crown size={20} className="text-amber-500" />
                                    </span>
                                ) : (
                                    <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-250 shadow-sm">
                                        <Info size={20} />
                                    </span>
                                )}
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">{modal.title}</h3>
                            </div>
                            <p className="text-slate-500 text-[11px] leading-relaxed mb-6 font-mono uppercase relative font-bold">{modal.message}</p>
                            <div className="flex gap-2 relative">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-md hover:shadow-lg active:scale-95">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Entendido</button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251, 191, 36, 0.3); }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
            `}</style>
        </div>
    );
}