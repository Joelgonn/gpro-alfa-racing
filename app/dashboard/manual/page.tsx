'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { supabase } from '../../lib/supabase'; 
import { 
  RefreshCw, History, ArrowRight,
  Calculator, Trophy, Timer, Target, Cpu,
  AlertCircle, CheckCircle2, Flag, StopCircle, Info, X, AlertTriangle, ChevronDown,
  Sparkles, Zap, Flame, Gauge, Brain, Star, Loader2
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

// --- HELPERS ---
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
    if (!msg) return "bg-white/5 text-slate-500 border-white/5";
    if (msg === "OK") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
    if (msg.includes("muito") || msg.includes("não") || msg.includes("explodir") || msg.includes("Não, não, não")) {
      return "bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_20px_rgba(225,29,72,0.15)]";
    }
    return "bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]";
};

const getGradientClass = (part: string, isFinished: boolean) => {
    if (isFinished) return "from-emerald-500/20 via-emerald-600/10 to-transparent";
    const gradients: Record<string, string> = {
        "Asa Dianteira": "from-blue-500/20 via-cyan-500/10 to-transparent",
        "Asa Traseira": "from-indigo-500/20 via-purple-500/10 to-transparent",
        "Motor": "from-rose-500/20 via-red-500/10 to-transparent",
        "Freios": "from-orange-500/20 via-amber-500/10 to-transparent",
        "Câmbio": "from-green-500/20 via-emerald-500/10 to-transparent",
        "Suspensão": "from-violet-500/20 via-purple-500/10 to-transparent"
    };
    return gradients[part] || "from-slate-500/10 to-transparent";
};

export default function ManualSetupPage() {
    const router = useRouter();
    
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
                    setXp(data.xp || "0"); 
                    setCt(data.ct || "0"); 
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
        if (!xp || !ct || xp === "0") return showAlert("Dados Incompletos", "Insira XP e CT do piloto.");
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
        <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#020204] text-indigo-500 font-mono text-xs gap-4">
             <div className="w-12 h-12 border-2 border-indigo-500/10 rounded-full flex items-center justify-center relative">
                <div className="w-12 h-12 border-2 border-t-indigo-500 rounded-full animate-spin absolute" />
                <Calculator size={16} className="animate-pulse text-indigo-400" />
             </div>
             <span className="tracking-widest uppercase">CONECTANDO SISTEMA...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020204] text-slate-300 font-mono pb-24 md:pb-12 selection:bg-indigo-500/30 relative overflow-hidden">
            
            {/* ==========================================
                FUNDO AMBIENTAL COM GRADIENTES
                ========================================== */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 blur-[150px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
            </div>

            {/* Header Telemetria com Gradiente */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#020204]/90 p-3 sm:p-4 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="max-w-[1600px] mx-auto flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                         <div className="bg-gradient-to-br from-indigo-500 to-purple-500 p-2.5 rounded-xl shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                            <Calculator size={16} className="text-white" />
                         </div>
                         <div className="flex flex-col text-left">
                            <h1 className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                                Calculadora Manual
                                <span className="text-[7px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
                            </h1>
                            <p className="text-[9px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{userEmail}</p>
                         </div>
                    </div>
                    <button 
                        onClick={handleReset} 
                        className="p-2.5 bg-rose-500/10 hover:bg-gradient-to-r hover:from-rose-500 hover:to-red-500 hover:text-white text-rose-400 rounded-xl border border-rose-500/20 transition-all duration-300 shadow-[0_0_15px_rgba(225,29,72,0.05)] hover:shadow-[0_0_25px_rgba(225,29,72,0.2)]"
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
                        
                        {/* Piloto Specs com Gradiente */}
                        <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-3.5 border-b border-white/5 flex items-center gap-2">
                                <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                                    <Cpu size={14} className="text-white" />
                                </div>
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Biometria do Piloto</h3>
                            </div>
                            <div className="relative p-4 grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Experiência (XP)</label>
                                    <input type="number" value={xp} onChange={e=>setXp(e.target.value)} disabled={history.length > 0} className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-40 text-xs focus:shadow-[0_0_20px_rgba(99,102,241,0.1)]" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Concentração (CT)</label>
                                    <input type="number" value={ct} onChange={e=>setCt(e.target.value)} disabled={history.length > 0} className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-40 text-xs focus:shadow-[0_0_20px_rgba(99,102,241,0.1)]" />
                                </div>
                            </div>
                        </section>

                        {/* Scanner de Tolerância de Peça com Gradiente */}
                        <section className="relative bg-zinc-950/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm group min-h-[250px]">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="relative bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3.5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                                        <Target size={14} className="text-white" />
                                    </div>
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Scanner de Margens</h3>
                                </div>
                                {history.length > 0 && (
                                    <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20 font-black text-[8px] shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                        VOLTA {history.length}
                                    </div>
                                )}
                            </div>
                            <div className="relative p-4 space-y-4">
                                {PARTS.map(part => {
                                    const data = analysis[part];
                                    const gradient = data?.margin ? 
                                        `from-${parseInt(data.margin) > 50 ? 'emerald-500' : parseInt(data.margin) > 20 ? 'amber-500' : 'rose-500'} 
                                         to-${parseInt(data.margin) > 50 ? 'teal-400' : parseInt(data.margin) > 20 ? 'orange-400' : 'red-400'}` 
                                        : 'from-indigo-500 to-purple-400';
                                    
                                    return (
                                        <div key={part} className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-slate-400 font-bold uppercase tracking-tight">{part}</span>
                                                <span className="text-slate-500 font-mono font-black">{data?.margin ? `±${data.margin}` : "ESTIMANDO"}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 relative p-[1px]">
                                                <motion.div 
                                                    initial={{ width: 0 }} 
                                                    animate={{ width: data ? `${Math.min((Number(data.final)/1000)*100, 100)}%` : 0 }} 
                                                    transition={{ duration: 0.8 }} 
                                                    className={`h-full bg-gradient-to-r ${gradient} rounded-full shadow-[0_0_15px_rgba(99,102,241,0.2)]`} 
                                                />
                                                <div className="absolute inset-y-0 left-1/4 w-[1px] bg-white/5"></div>
                                                <div className="absolute inset-y-0 left-2/4 w-[1px] bg-white/5"></div>
                                                <div className="absolute inset-y-0 left-3/4 w-[1px] bg-white/5"></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    </div>

                    {/* ÁREA PRINCIPAL: ACERTO DE TELEMETRIA */}
                    <div className="xl:col-span-9 space-y-5">
                        
                        <section className={`border-2 rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-500 relative ${
                            isFinished 
                                ? 'border-emerald-500/30 bg-emerald-950/[0.05] shadow-[0_0_40px_rgba(16,185,129,0.05)]' 
                                : 'border-indigo-500/20 bg-gradient-to-br from-indigo-950/[0.03] to-purple-950/[0.03] shadow-[0_0_40px_rgba(99,102,241,0.05)]'
                        }`}>
                            <div className={`absolute inset-0 bg-gradient-to-r ${isFinished ? 'from-emerald-500/5 via-transparent to-teal-500/5' : 'from-indigo-500/5 via-transparent to-purple-500/5'} opacity-50`} />
                            
                            <div className={`relative p-4 border-b flex justify-between items-center ${
                                isFinished 
                                    ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10' 
                                    : 'border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/10'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg ${isFinished ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'}`}>
                                        {isFinished ? <Trophy size={14} /> : <Timer size={14} />}
                                    </div>
                                    <h2 className={`text-xs font-black uppercase tracking-widest ${isFinished ? 'text-emerald-400' : 'text-white'}`}>
                                        {isFinished ? "CONFIGURAÇÃO FINAL DEFINIDA" : `Ajustes da Volta ${history.length + 1}`}
                                    </h2>
                                </div>
                                {isFinished && (
                                    <span className="text-[9px] bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 text-emerald-400 font-black px-3 py-1 rounded-lg animate-pulse uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                        ✅ Sessão Pronta
                                    </span>
                                )}
                            </div>

                            <div className="relative p-4 sm:p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                                    {PARTS.map(part => {
                                        const displayValue = isFinished ? analysis[part]?.final : inputs[part];
                                        const currentFeedback = feedbacks[part];
                                        const gradient = getGradientClass(part, isFinished);
                                        
                                        return (
                                            <div 
                                                key={part} 
                                                className={`relative bg-gradient-to-br ${gradient} border border-white/5 rounded-xl p-3 flex flex-col justify-between space-y-3 overflow-hidden group transition-all duration-300 hover:border-white/10`}
                                            >
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block flex items-center gap-1.5">
                                                    {part === "Motor" && <Zap size={10} className="text-rose-400" />}
                                                    {part === "Freios" && <Gauge size={10} className="text-orange-400" />}
                                                    {part === "Suspensão" && <Brain size={10} className="text-violet-400" />}
                                                    {part === "Câmbio" && <Sparkles size={10} className="text-emerald-400" />}
                                                    {part}
                                                </label>
                                                
                                                <div className="space-y-2">
                                                    {/* Input Valor Setup */}
                                                    <div className="relative">
                                                        {isFinished ? (
                                                            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-center text-lg font-black py-2 rounded-xl text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                                                {displayValue}
                                                            </div>
                                                        ) : (
                                                            <input 
                                                                type="number" 
                                                                value={displayValue} 
                                                                onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} 
                                                                className="w-full h-11 bg-black/60 border border-white/10 text-center text-base font-black rounded-xl outline-none text-white focus:border-indigo-500 focus:bg-black/80 transition-all shadow-inner focus:shadow-[0_0_25px_rgba(99,102,241,0.1)]" 
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Seletor Customizado de Feedback */}
                                                    {!isFinished && (
                                                        <button 
                                                            onClick={() => setActiveFeedbackPart(part)}
                                                            className={`w-full h-10 px-3.5 rounded-xl border text-[10px] uppercase font-black transition-all flex items-center justify-between text-left group relative overflow-hidden
                                                                ${currentFeedback 
                                                                    ? getFeedbackBadgeClass(currentFeedback) 
                                                                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'}`}
                                                        >
                                                            <span className="truncate pr-1 relative z-10">
                                                                {currentFeedback ? getShortFeedback(currentFeedback) : "Selecionar feedback"}
                                                            </span>
                                                            <ChevronDown size={12} className={`shrink-0 transition-transform relative z-10 ${currentFeedback ? 'text-indigo-400' : 'text-slate-600'} group-hover:translate-y-0.5`} />
                                                            {!currentFeedback && (
                                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {!isFinished && (
                                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-white/5">
                                        <button 
                                            onClick={handleManualFinish} 
                                            className="w-full sm:flex-1 h-11 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[9px] border border-white/5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all hover:text-white"
                                        >
                                            <StopCircle size={13} /> Encerrar Setup
                                        </button>
                                        <button 
                                            onClick={handleCalculate} 
                                            disabled={loading} 
                                            className="w-full sm:flex-[2] h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_30px_rgba(99,102,241,0.15)] hover:shadow-[0_0_40px_rgba(99,102,241,0.25)] border border-indigo-400/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
                                        >
                                            {loading ? <Loader2 size={14} className="animate-spin" /> : <>Calcular Telemetria <ArrowRight size={14} /></>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Histórico Segmentado com Gradiente */}
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 px-1">
                                <div className="p-1 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
                                    <History size={14} className="text-amber-400" />
                                </div>
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Histórico de Voltas</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                             </div>

                             <div className="space-y-2.5">
                                {history.length === 0 ? (
                                    <div className="py-12 border border-dashed border-white/10 rounded-2xl text-center bg-gradient-to-br from-white/[0.01] to-transparent">
                                         <div className="text-3xl mb-2 opacity-20">⏳</div>
                                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Aguardando telemetria inicial</p>
                                    </div>
                                ) : (
                                    [...history].reverse().map((lap, idx) => {
                                        const lapNumber = history.length - idx;
                                        return (
                                            <motion.div 
                                                key={idx} 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                className="relative bg-zinc-950/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-indigo-500/20"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                
                                                <div className="relative bg-gradient-to-r from-indigo-500/5 to-purple-500/5 px-4 py-2 flex justify-between items-center border-b border-white/5 text-[10px]">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-indigo-400 font-black tracking-widest uppercase flex items-center gap-1.5">
                                                            <Flag size={12} className="text-indigo-400" />
                                                            Volta {lapNumber}
                                                        </span>
                                                        <span className="text-[8px] bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black border border-amber-500/20">
                                                            ZS: {lap.zs || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="relative p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                                    {PARTS.map(part => {
                                                        const lapData = lap[part];
                                                        const isOk = lapData.msg === "OK";
                                                        return (
                                                            <div 
                                                                key={part} 
                                                                className={`bg-black/20 p-2.5 rounded-lg border transition-all duration-300 ${
                                                                    isOk 
                                                                        ? 'border-emerald-500/20 bg-emerald-500/5' 
                                                                        : 'border-white/[0.02] hover:border-white/5'
                                                                }`}
                                                            >
                                                                <div className="text-[8px] text-slate-600 uppercase font-black truncate">{part}</div>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <span className={`text-xs font-black ${isOk ? 'text-emerald-400' : 'text-slate-200'}`}>{lapData.acerto}</span>
                                                                    <button 
                                                                        onClick={() => showInfo(part, lapData.msg)} 
                                                                        className={`p-1 rounded transition-colors ${
                                                                            isOk 
                                                                                ? 'text-emerald-600 hover:text-emerald-400' 
                                                                                : 'text-slate-600 hover:text-indigo-400'
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

            {/* --- CUSTOM FEEDBACK PICKER (BOTTOM SHEET - PREMIUM) --- */}
            <AnimatePresence>
                {activeFeedbackPart && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/85 backdrop-blur-md"
                            onClick={() => setActiveFeedbackPart(null)}
                        />
                        <motion.div 
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 220 }}
                            className="bg-[#0c0c0e] border-t border-white/10 w-full max-w-lg rounded-t-[2rem] shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Linha Decorativa F1 com Gradiente */}
                            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]" />
                            
                            <div className="p-5 sm:p-6 text-left">
                                <div className="flex justify-between items-center mb-5">
                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-tight leading-none mb-1 flex items-center gap-2">
                                            Feedback
                                            <span className="text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full font-black">PRO</span>
                                        </h3>
                                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 inline-block">
                                            {activeFeedbackPart}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setActiveFeedbackPart(null)} 
                                        className="bg-white/5 p-1.5 rounded-full text-slate-500 hover:text-white transition-colors hover:bg-white/10"
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
                                                className={`w-full p-3.5 rounded-xl border text-[11px] font-bold text-left transition-all flex items-center justify-between group relative overflow-hidden
                                                    ${isSelected 
                                                        ? (isOK 
                                                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400 font-black shadow-[0_0_30px_rgba(16,185,129,0.15)]' 
                                                            : 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-indigo-400/40 text-white font-black shadow-[0_0_30px_rgba(99,102,241,0.15)]') 
                                                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-white'}`}
                                            >
                                                {!isSelected && (
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                )}
                                                <span className="relative z-10">
                                                    {isOK ? "✅ SATISFEITO (OK)" : opt}
                                                </span>
                                                {isSelected && (
                                                    <div className="relative z-10 bg-gradient-to-r from-indigo-500 to-purple-500 p-0.5 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                                                        <CheckCircle2 size={13} className="text-white" />
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

            {/* --- CUSTOM DIALOGS COM GRADIENTE --- */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95 }} 
                            className="bg-[#0c0c0e] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative z-50 text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                            
                            <div className="flex items-center gap-3 mb-4 relative">
                                {modal.type === 'alert' ? (
                                    <span className="p-2 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20 shadow-[0_0_20px_rgba(225,29,72,0.1)]">
                                        <AlertTriangle size={20} />
                                    </span>
                                ) : (
                                    <span className="p-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                                        <Info size={20} />
                                    </span>
                                )}
                                <h3 className="text-sm font-black text-white uppercase tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">{modal.title}</h3>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed mb-6 font-mono uppercase relative">{modal.message}</p>
                            <div className="flex gap-2 relative">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-[9px] font-black uppercase transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(99,102,241,0.15)] hover:shadow-[0_0_40px_rgba(99,102,241,0.25)]">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-[9px] font-black uppercase transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]">Entendido</button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.2); }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
            `}</style>
        </div>
    );
}