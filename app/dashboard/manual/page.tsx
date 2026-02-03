'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { supabase } from '../../lib/supabase'; 
import { 
  RefreshCw, History, ArrowRight, ArrowDown,
  Calculator, Trophy, Timer, Target, Cpu, TrendingUp, TrendingDown,
  ChevronRight, AlertCircle, CheckCircle2, Flag, StopCircle, Info, X, AlertTriangle
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
    if (msg === "OK") return "SATISFATÓRIO";
    if (msg.includes("muito mais") || msg.includes("não posso") || msg.includes("muito alta") || msg.includes("muito rígid") || msg.includes("muito curta") || msg.includes("explodir")) {
        return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") ? "CRÍTICO BAIXO" : "CRÍTICO ALTO";
    }
    if (msg.includes("um pouco") || msg.includes("pode ser maior") || msg.includes("gostaria")) {
        return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") ? "AJUSTE BAIXO" : "AJUSTE ALTO";
    }
    return "AJUSTE REQUERIDO";
};

const getFeedbackColor = (msg: string) => {
    if (msg === "OK") return "text-emerald-400";
    if (msg.includes("muito") || msg.includes("não") || msg.includes("explodir")) return "text-rose-500";
    return "text-amber-400";
};

// --- COMPONENTE PRINCIPAL ---
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
    
    // --- STATE DE UI (MODAL) ---
    const [modal, setModal] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'info';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    // --- STATE DE AUTENTICAÇÃO ---
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');

    // --- FUNÇÕES DE MODAL ---
    const showAlert = (title: string, message: string) => {
        setModal({ isOpen: true, type: 'alert', title, message });
    };

    const showInfo = (title: string, message: string) => {
        setModal({ isOpen: true, type: 'info', title, message });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        async function initSession() {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

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

    // --- HANDLERS (UPDATED TO USE CUSTOM MODAL) ---
    const handleReset = () => {
        showConfirm(
            "Reiniciar Sessão?", 
            "Isso apagará todo o histórico de voltas atual. Tem certeza?",
            () => {
                if (userId) {
                    const userKey = `${BASE_STORAGE_KEY}_${userId}`;
                    localStorage.removeItem(userKey);
                }
                window.location.reload();
            }
        );
    };

    const handleManualFinish = () => {
        if (history.length === 0) return showAlert("Atenção", "Processe pelo menos uma volta antes de finalizar.");
        
        showConfirm(
            "Encerrar Sessão", 
            "Deseja parar agora e ver os valores ideais calculados com base nos dados atuais?",
            () => {
                setIsManuallyFinished(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        );
    };

    const handleCalculate = async () => {
        if (!userId) return;
        if (!xp || !ct || xp === "0") return showAlert("Dados Incompletos", "Insira a Experiência (XP) e Conhecimento Técnico (CT) do piloto.");
        
        const missingFeedbacks = PARTS.filter(p => !feedbacks[p]);
        if (missingFeedbacks.length > 0) return showAlert("Feedback Pendente", `Selecione o feedback para: ${missingFeedbacks.join(', ')}`);

        setLoading(true);
        const payload = { 
            driver: { xp, ct }, 
            history, 
            currentLapData: PARTS.reduce((acc: any, part) => { 
                acc[part] = { acerto: inputs[part], msg: feedbacks[part] }; 
                return acc; 
            }, {}) 
        };
        
        try {
            const res = await fetch('/api/manual', { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'user-id': userId 
                }, 
                body: JSON.stringify(payload) 
            });
            const json = await res.json();
            if (json.sucesso) {
                setZs(json.data.zs);
                setHistory([...history, json.data.processedLap]);
                
                if (history.length < 7) {
                    setInputs(json.data.nextSuggestions);
                }
                
                setAnalysis(json.data.finalAnalysis);
                if (json.data.allowedOptions) setAvailableOptions(json.data.allowedOptions);
                setFeedbacks({}); 
                
            } else {
                showAlert("Erro de Cálculo", json.error || "Erro desconhecido ao processar dados.");
            }
        } catch (e) { showAlert("Erro de Conexão", "Não foi possível conectar ao servidor."); } finally { setLoading(false); }
    };

    const isFinished = history.length >= 8 || isManuallyFinished;

    if (!userId) return (
        <div className="flex h-screen items-center justify-center bg-[#050507] text-indigo-500 gap-4">
             <div className="relative w-12 h-12"><div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full"></div><div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
             <span className="font-mono text-xs animate-pulse">CARREGANDO...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050507] text-slate-300 font-mono selection:bg-indigo-500/30 pb-32">
            
            {/* Header Sticky com Blur */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#050507]/80">
                <div className="max-w-[1600px] mx-auto p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
                            <Calculator size={18} className="text-indigo-400" />
                         </div>
                         <div className="flex flex-col">
                            <h1 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-0.5">Telemetria</h1>
                            <p className="text-[9px] text-slate-500 font-bold uppercase truncate max-w-[150px] sm:max-w-none">
                                Manual • {userEmail}
                            </p>
                         </div>
                    </div>
                    <button 
                        onClick={handleReset} 
                        className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg border border-rose-500/20 transition-all active:scale-95"
                        aria-label="Reiniciar"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </header>

            <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 md:space-y-8 animate-fadeIn relative z-0">
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
                    
                    {/* Coluna Lateral */}
                    <div className="xl:col-span-3 space-y-4 md:space-y-6">
                        {/* XP/CT */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="bg-white/5 p-3 md:p-4 border-b border-white/5 flex items-center gap-2">
                                <Cpu size={14} className="text-indigo-400" />
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Parâmetros do Piloto</h3>
                            </div>
                            <div className="p-4 md:p-6 grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase block">Experiência (XP)</label>
                                    <input 
                                        type="number" 
                                        value={xp} 
                                        onChange={e=>setXp(e.target.value)} 
                                        disabled={history.length > 0} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50 text-sm" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase block">Técnica (CT)</label>
                                    <input 
                                        type="number" 
                                        value={ct} 
                                        onChange={e=>setCt(e.target.value)} 
                                        disabled={history.length > 0} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50 text-sm" 
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Margens */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden min-h-[300px] md:min-h-[400px]">
                            <div className="bg-white/5 p-3 md:p-4 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Target size={14} className="text-emerald-400" />
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Margens</h3>
                                </div>
                                {history.length > 0 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">V{history.length}</span>}
                            </div>
                            <div className="p-4 md:p-6 space-y-5">
                                {PARTS.map(part => {
                                    const data = analysis[part];
                                    return (
                                        <div key={part} className="space-y-1.5">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{part}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-600 font-bold">±{data?.margin || "?"}</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: data ? `${Math.min((Number(data.final)/1000)*100, 100)}%` : 0 }} 
                                                    transition={{ duration: 1, ease: "easeOut" }}
                                                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    </div>

                    {/* Área Principal */}
                    <div className="xl:col-span-9 space-y-6 md:space-y-8">
                        
                        {/* Inputs e Resultado */}
                        <section className={`border rounded-2xl overflow-hidden transition-all duration-500 ${isFinished ? 'border-emerald-500 bg-emerald-950/[0.1] shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-indigo-500/30 bg-indigo-900/[0.05]'}`}>
                            <div className={`p-4 border-b flex justify-between items-center ${isFinished ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${isFinished ? 'bg-emerald-500 text-black' : 'bg-indigo-500 text-white'}`}>
                                        {isFinished ? <Trophy size={16} /> : <Timer size={16} />}
                                    </div>
                                    <div>
                                        <h2 className={`text-sm font-black uppercase tracking-widest ${isFinished ? 'text-emerald-400' : 'text-white'}`}>
                                            {isFinished ? "Ideal Calculado" : `Setup Volta ${history.length + 1}`}
                                        </h2>
                                    </div>
                                </div>
                                {isFinished && (
                                    <Flag size={16} className="text-emerald-500 animate-pulse" />
                                )}
                            </div>

                            <div className="p-4 md:p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-12 md:gap-y-6 mb-8">
                                    {PARTS.map(part => {
                                        const displayValue = isFinished ? analysis[part]?.final : inputs[part];
                                        
                                        return (
                                            <div key={part} className="bg-white/[0.03] md:bg-transparent rounded-xl p-3 md:p-0 border border-white/5 md:border-0 space-y-2 group">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isFinished ? 'text-emerald-500/70' : 'text-slate-400 md:group-hover:text-indigo-400'}`}>{part}</label>
                                                    {isFinished && <CheckCircle2 size={10} className="text-emerald-500" />}
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                                                    <div className="relative w-full sm:w-auto sm:flex-1">
                                                        {isFinished ? (
                                                            <div className="w-full bg-emerald-500/10 border border-emerald-500/50 text-center text-xl font-black py-3 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                                                {displayValue}
                                                            </div>
                                                        ) : (
                                                            <input 
                                                                type="number" 
                                                                value={displayValue} 
                                                                onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} 
                                                                className="w-full h-12 bg-black/40 border border-white/10 text-center text-lg font-black rounded-xl outline-none text-white focus:border-indigo-500 focus:bg-black/60 transition-all appearance-none" 
                                                            />
                                                        )}
                                                    </div>
                                                    {!isFinished && (
                                                        <div className="flex-[2] relative">
                                                            <select 
                                                                value={feedbacks[part] || ""} 
                                                                onChange={e=>setFeedbacks({...feedbacks,[part]:e.target.value})}
                                                                className={`w-full h-12 bg-black/40 border border-white/10 text-[10px] sm:text-xs font-bold pl-4 pr-8 rounded-xl outline-none appearance-none cursor-pointer focus:border-indigo-500 transition-all ${feedbacks[part] ? (feedbacks[part] === "OK" ? "text-emerald-400 border-emerald-500/30" : "text-white") : "text-slate-500"}`}
                                                            >
                                                                <option value="">Selecione o feedback...</option>
                                                                {(availableOptions[part] || ALL_FEEDBACK_OPTIONS[part]).map((opt, i) => (
                                                                    <option key={i} value={opt} className="bg-slate-900 text-white py-2">
                                                                        {opt === "OK" ? "✅ Satisfeito (OK)" : opt}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                                <ChevronRight size={14} className="rotate-90" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Botões */}
                                {!isFinished && (
                                    <div className="flex flex-col-reverse md:flex-row gap-4">
                                        <motion.button 
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleManualFinish}
                                            className="w-full md:flex-1 bg-slate-800/50 hover:bg-slate-700 text-slate-400 py-4 rounded-xl font-black uppercase tracking-[0.1em] text-[10px] md:text-xs border border-white/5 flex items-center justify-center gap-2 transition-all active:bg-slate-800"
                                        >
                                            <StopCircle size={14} />
                                            Encerrar
                                        </motion.button>

                                        <motion.button 
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleCalculate} 
                                            disabled={loading} 
                                            className="w-full md:flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-4 md:py-5 rounded-xl font-black uppercase tracking-[0.15em] text-xs md:text-sm shadow-xl shadow-indigo-600/20 border border-indigo-400/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:translate-y-0.5"
                                        >
                                            {loading ? (
                                                <>
                                                    <RefreshCw size={18} className="animate-spin" />
                                                    Processando...
                                                </>
                                            ) : (
                                                <>
                                                    Calcular Volta 
                                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Histórico */}
                        <div className="space-y-6">
                             <div className="flex items-center gap-3 px-1">
                                <History size={16} className="text-slate-500" />
                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Histórico</h3>
                                <div className="h-px flex-1 bg-white/5" />
                             </div>

                             <div className="space-y-4">
                                {[...history].reverse().map((lap, idx) => {
                                    const lapNumber = history.length - idx;
                                    return (
                                        <motion.div 
                                            key={idx} 
                                            initial={{ opacity: 0, y: 10 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden"
                                        >
                                            <div className="bg-white/5 px-4 md:px-6 py-3 flex justify-between items-center border-b border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-indigo-400 font-black text-xs tracking-wider">VOLTA {lapNumber}</span>
                                                    {lapNumber === 1 && <span className="hidden sm:inline-block bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Início</span>}
                                                </div>
                                                <div className="text-[9px] text-slate-600 font-mono">
                                                    ZS: {lap.zs || 0}
                                                </div>
                                            </div>
                                            <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
                                                {PARTS.map(part => {
                                                    const lapData = lap[part];
                                                    const shortMsg = getShortFeedback(lapData.msg);
                                                    
                                                    const prevLap = history[lapNumber - 2];
                                                    const delta = prevLap ? lapData.acerto - prevLap[part].acerto : 0;
                                                    const isOk = lapData.msg === "OK";

                                                    return (
                                                        <div key={part} className="space-y-1 relative">
                                                            <div className="text-[8px] text-slate-600 uppercase font-black tracking-wider truncate">{part}</div>
                                                            <div className="flex items-center gap-2 md:gap-3">
                                                                <span className={`text-sm md:text-base font-black ${isOk ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {lapData.acerto}
                                                                </span>
                                                                
                                                                <div className="flex flex-col">
                                                                    {delta !== 0 && (
                                                                        <div className={`flex items-center text-[9px] font-bold leading-none ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                            {delta > 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                                                                            {Math.abs(delta)}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <span className={`text-[8px] font-bold uppercase truncate max-w-[70px] ${getFeedbackColor(lapData.msg)}`}>
                                                                            {shortMsg}
                                                                        </span>
                                                                        {/* Botão de Info para o Feedback Completo */}
                                                                        <button 
                                                                            onClick={() => showInfo(`Feedback: ${part}`, lapData.msg)}
                                                                            className="text-slate-600 hover:text-indigo-400 transition-colors p-0.5 -m-0.5"
                                                                        >
                                                                            <Info size={10} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )
                                })}
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CUSTOM MODAL DIALOG --- */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                            onClick={closeModal} 
                        />
                        <motion.div 
                            initial={{ y: 50, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 50, opacity: 0, scale: 0.95 }}
                            className="bg-[#0f0f12] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl relative z-10 overflow-hidden"
                        >
                            <div className={`h-1.5 w-full ${
                                modal.type === 'alert' ? 'bg-rose-500' : 
                                modal.type === 'confirm' ? 'bg-indigo-500' : 'bg-emerald-500'
                            }`} />
                            
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        {modal.type === 'alert' && <AlertTriangle className="text-rose-500" size={24} />}
                                        {modal.type === 'confirm' && <AlertCircle className="text-indigo-500" size={24} />}
                                        {modal.type === 'info' && <Info className="text-emerald-500" size={24} />}
                                        <h3 className="text-lg font-black text-white uppercase tracking-wide leading-none pt-1">
                                            {modal.title}
                                        </h3>
                                    </div>
                                    <button onClick={closeModal} className="text-slate-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                                    {modal.message}
                                </p>

                                <div className="mt-8 flex gap-3">
                                    {modal.type === 'confirm' ? (
                                        <>
                                            <button 
                                                onClick={closeModal}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    modal.onConfirm && modal.onConfirm();
                                                    closeModal();
                                                }}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all"
                                            >
                                                Confirmar
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={closeModal}
                                            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                        >
                                            Entendido
                                        </button>
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