'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { supabase } from '../../lib/supabase'; 
import { 
  RefreshCw, History, ArrowRight, ArrowDown,
  Calculator, Trophy, Timer, Target, Cpu, TrendingUp, TrendingDown,
  ChevronRight, AlertCircle, CheckCircle2, Flag, StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [isManuallyFinished, setIsManuallyFinished] = useState(false); // Novo estado
    
    // --- STATE DE AUTENTICAÇÃO ---
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');

    // --- 1. VERIFICAÇÃO DE LOGIN E LOAD DE SESSÃO ---
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

    // --- 2. PERSISTÊNCIA LOCAL ---
    useEffect(() => {
        if (userId) {
            const userKey = `${BASE_STORAGE_KEY}_${userId}`;
            localStorage.setItem(userKey, JSON.stringify({ xp, ct, zs, history, inputs, analysis, availableOptions, isManuallyFinished }));
        }
    }, [xp, ct, zs, history, inputs, analysis, availableOptions, userId, isManuallyFinished]);

    // --- 3. REINICIAR SESSÃO ---
    const handleReset = () => {
        if (confirm("Reiniciar sessão? Isso apagará seu histórico de voltas atual.")) {
            if (userId) {
                const userKey = `${BASE_STORAGE_KEY}_${userId}`;
                localStorage.removeItem(userKey);
            }
            window.location.reload();
        }
    };

    // --- 4. ENCERRAR MANUALMENTE ---
    const handleManualFinish = () => {
        if (history.length === 0) return alert("Processe pelo menos uma volta antes de finalizar.");
        if (confirm("Deseja encerrar a sessão agora e ver os valores calculados até o momento?")) {
            setIsManuallyFinished(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // --- 5. CÁLCULO VIA API ---
    const handleCalculate = async () => {
        if (!userId) return;
        if (!xp || !ct || xp === "0") return alert("Insira XP e CT do piloto para iniciar.");
        
        const missingFeedbacks = PARTS.filter(p => !feedbacks[p]);
        if (missingFeedbacks.length > 0) return alert(`Selecione o feedback para: ${missingFeedbacks.join(', ')}`);

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
                
                // Atualiza inputs com sugestões
                if (history.length < 7) {
                    setInputs(json.data.nextSuggestions);
                }
                
                setAnalysis(json.data.finalAnalysis);
                if (json.data.allowedOptions) setAvailableOptions(json.data.allowedOptions);
                setFeedbacks({}); 
                
                // Auto scroll suave para focar nos inputs novos
                // window.scrollTo({ top: 0, behavior: 'smooth' }); 
            } else {
                alert("Erro no cálculo: " + (json.error || "Desconhecido"));
            }
        } catch (e) { alert("Erro de rede ao calcular."); } finally { setLoading(false); }
    };

    const isFinished = history.length >= 8 || isManuallyFinished;

    if (!userId) return (
        <div className="flex h-screen items-center justify-center bg-[#050507] text-indigo-500 gap-4">
             <div className="relative w-12 h-12"><div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full"></div><div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
             <span className="font-mono text-xs animate-pulse">CARREGANDO SESSÃO...</span>
        </div>
    );

    return (
        <div className="p-6 space-y-8 animate-fadeIn text-slate-300 pb-24 font-mono max-w-[1600px] mx-auto">
            {/* Header / Barra Superior */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-2xl flex justify-between items-center backdrop-blur-xl relative z-40">
                <div className="flex items-center gap-4">
                     <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
                        <Calculator size={20} className="text-indigo-400" />
                     </div>
                     <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Telemetria de Setup</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Sessão Manual • {userEmail}</p>
                     </div>
                </div>
                <button onClick={handleReset} className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 px-4 py-2 rounded-lg border border-rose-500/20 transition-all text-[10px] font-black uppercase tracking-widest group">
                    <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                    Reiniciar Sessão
                </button>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* Coluna Lateral: Dados e Status */}
                <div className="xl:col-span-3 space-y-6">
                    {/* Card de Habilidades */}
                    <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="bg-white/5 p-4 border-b border-white/5 flex items-center gap-2">
                            <Cpu size={14} className="text-indigo-400" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Parâmetros do Piloto</h3>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase block">Experiência (XP)</label>
                                <input 
                                    type="number" 
                                    value={xp} 
                                    onChange={e=>setXp(e.target.value)} 
                                    disabled={history.length > 0} 
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase block">Conhec. Técnico (CT)</label>
                                <input 
                                    type="number" 
                                    value={ct} 
                                    onChange={e=>setCt(e.target.value)} 
                                    disabled={history.length > 0} 
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50" 
                                />
                            </div>
                        </div>
                    </section>

                    {/* Card de Previsão */}
                    <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden min-h-[400px]">
                        <div className="bg-white/5 p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target size={14} className="text-emerald-400" />
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Análise de Margem</h3>
                            </div>
                            {history.length > 0 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">V{history.length}</span>}
                        </div>
                        <div className="p-6 space-y-6">
                            {PARTS.map(part => {
                                const data = analysis[part];
                                return (
                                    <div key={part} className="space-y-1.5">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{part}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-600 font-bold">Margem: ±{data?.margin || "?"}</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: data ? `${(Number(data.final)/1000)*100}%` : 0 }} 
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
                <div className="xl:col-span-9 space-y-8">
                    
                    {/* Card de Input Atual ou RESULTADO FINAL */}
                    <section className={`border rounded-2xl overflow-hidden transition-all duration-500 ${isFinished ? 'border-emerald-500 bg-emerald-950/[0.1] shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-indigo-500/30 bg-indigo-900/[0.05]'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isFinished ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${isFinished ? 'bg-emerald-500 text-black' : 'bg-indigo-500 text-white'}`}>
                                    {isFinished ? <Trophy size={16} /> : <Timer size={16} />}
                                </div>
                                <div>
                                    <h2 className={`text-sm font-black uppercase tracking-widest ${isFinished ? 'text-emerald-400' : 'text-white'}`}>
                                        {isFinished ? "Setup Ideal Calculado" : `Ajuste da Volta ${history.length + 1}`}
                                    </h2>
                                    <p className="text-[9px] opacity-70 font-bold uppercase">{isFinished ? "Estes são os valores ideais estimados baseados na sessão" : "Insira os valores e feedbacks da volta atual"}</p>
                                </div>
                            </div>
                            {isFinished && (
                                <div className="px-3 py-1 bg-emerald-500 text-black text-[10px] font-black uppercase rounded shadow-lg animate-pulse">
                                    Sessão Concluída
                                </div>
                            )}
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mb-8">
                                {PARTS.map(part => {
                                    // *** LÓGICA CRUCIAL ***
                                    // Se finalizado (por 8 voltas OU manual), exibe analysis.final (o melhor cálculo)
                                    // Se não, exibe inputs[part] (a sugestão para a próxima volta)
                                    const displayValue = isFinished ? analysis[part]?.final : inputs[part];
                                    
                                    return (
                                        <div key={part} className="space-y-2 group">
                                            <div className="flex justify-between items-center px-1">
                                                <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isFinished ? 'text-emerald-500/70' : 'text-slate-400 group-hover:text-indigo-400'}`}>{part}</label>
                                                {isFinished && <Flag size={10} className="text-emerald-500" />}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="relative flex-1">
                                                    {isFinished ? (
                                                        <div className="w-full bg-emerald-500/10 border border-emerald-500/50 text-center text-2xl font-black py-3 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                                            {displayValue}
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type="number" 
                                                            value={displayValue} 
                                                            onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} 
                                                            className="w-full bg-black/40 border border-white/10 text-center text-lg font-black py-3 rounded-xl outline-none text-white focus:border-indigo-500 focus:bg-black/60 transition-all" 
                                                        />
                                                    )}
                                                </div>
                                                {!isFinished && (
                                                    <div className="flex-[2] relative">
                                                        <select 
                                                            value={feedbacks[part] || ""} 
                                                            onChange={e=>setFeedbacks({...feedbacks,[part]:e.target.value})}
                                                            className={`w-full bg-black/40 border border-white/10 text-[10px] font-bold py-4 px-4 rounded-xl outline-none appearance-none cursor-pointer hover:border-white/30 transition-all ${feedbacks[part] ? (feedbacks[part] === "OK" ? "text-emerald-400 border-emerald-500/30" : "text-white") : "text-slate-500"}`}
                                                        >
                                                            <option value="">Selecione o feedback...</option>
                                                            {(availableOptions[part] || ALL_FEEDBACK_OPTIONS[part]).map((opt, i) => (
                                                                <option key={i} value={opt} className="bg-slate-900 text-white py-2">
                                                                    {opt === "OK" ? "✅ Satisfeito (OK)" : opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                            <ChevronRight size={14} className="rotate-90" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Botoes de Ação */}
                            {!isFinished && (
                                <div className="flex gap-4">
                                    <motion.button 
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={handleManualFinish}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-5 rounded-xl font-black uppercase tracking-[0.2em] text-xs border border-white/5 flex items-center justify-center gap-3 transition-all"
                                    >
                                        <StopCircle size={16} />
                                        Encerrar e Ver Resultado
                                    </motion.button>

                                    <motion.button 
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={handleCalculate} 
                                        disabled={loading} 
                                        className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-600/20 border border-indigo-400/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {loading ? (
                                            <>
                                                <RefreshCw size={16} className="animate-spin" />
                                                Processando...
                                            </>
                                        ) : (
                                            <>
                                                Calcular Próxima Volta 
                                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Timeline de Histórico */}
                    <div className="space-y-6">
                         <div className="flex items-center gap-3 px-2">
                            <History size={16} className="text-slate-500" />
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Histórico da Sessão</h3>
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
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors group"
                                    >
                                        <div className="bg-white/5 px-6 py-3 flex justify-between items-center border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-indigo-400 font-black text-xs tracking-wider">VOLTA {lapNumber}</span>
                                                {lapNumber === 1 && <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Início</span>}
                                            </div>
                                            <ArrowDown size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                                            {PARTS.map(part => {
                                                const lapData = lap[part];
                                                const shortMsg = getShortFeedback(lapData.msg);
                                                
                                                const prevLap = history[lapNumber - 2];
                                                const delta = prevLap ? lapData.acerto - prevLap[part].acerto : 0;
                                                const isOk = lapData.msg === "OK";

                                                return (
                                                    <div key={part} className="space-y-1 relative group/tooltip">
                                                        <div className="text-[8px] text-slate-600 uppercase font-black tracking-wider">{part}</div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-base font-black ${isOk ? 'text-emerald-400' : 'text-white'}`}>
                                                                {lapData.acerto}
                                                            </span>
                                                            
                                                            <div className="flex flex-col">
                                                                {delta !== 0 && (
                                                                    <div className={`flex items-center text-[9px] font-bold leading-none ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        {delta > 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                                                                        {Math.abs(delta)}
                                                                    </div>
                                                                )}
                                                                <span className={`text-[8px] font-bold uppercase truncate max-w-[80px] mt-0.5 ${getFeedbackColor(lapData.msg)}`}>
                                                                    {shortMsg}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-48 p-3 bg-[#0f0f12] border border-indigo-500/20 rounded-lg shadow-2xl pointer-events-none">
                                                            <div className="flex items-start gap-2">
                                                                <AlertCircle size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                                                                <p className="text-[10px] leading-tight text-slate-300 italic font-medium">
                                                                    "{lapData.msg}"
                                                                </p>
                                                            </div>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f0f12] border-r border-b border-indigo-500/20 rotate-45 -translate-y-1"></div>
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
    );
}