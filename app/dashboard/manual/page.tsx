'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { supabase } from '../../lib/supabase'; 
import { 
  RefreshCw, History, ArrowRight, ArrowDown,
  Calculator, Trophy, Timer, Target, Cpu, TrendingUp, TrendingDown,
  ChevronRight, AlertCircle, StopCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

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

// --- FUNÇÕES AUXILIARES ---
const getShortFeedback = (msg: string) => {
    if (!msg) return "";
    if (msg === "OK") return "SATISFATÓRIO";
    if (msg.includes("muito mais") || msg.includes("não posso") || msg.includes("muito alta") || msg.includes("muito rígid") || msg.includes("muito curta") || msg.includes("explodir")) return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") ? "CRÍTICO BAIXO" : "CRÍTICO ALTO";
    if (msg.includes("um pouco") || msg.includes("pode ser maior") || msg.includes("gostaria")) return msg.includes("baixa") || msg.includes("trás") || msg.includes("menor") ? "AJUSTE BAIXO" : "AJUSTE ALTO";
    return "AJUSTE REQUERIDO";
};
const getFeedbackColor = (msg: string) => {
    if (!msg) return "text-slate-500";
    return msg === "OK" ? "text-emerald-400" : (msg.includes("muito") || msg.includes("não") || msg.includes("explodir") ? "text-rose-500" : "text-amber-400");
};

export default function ManualSetupPage() {
    const router = useRouter();
    
    // --- STATES ---
    const [xp, setXp] = useState<string>("0");
    const [ct, setCt] = useState<string>("0");
    const [zs, setZs] = useState({ total: 0, half: 0 });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputs, setInputs] = useState<Record<string, number>>({ "Asa Dianteira": 500, "Asa Traseira": 500, "Motor": 500, "Freios": 500, "Câmbio": 500, "Suspensão": 500 });
    const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
    const [analysis, setAnalysis] = useState<Record<string, { final: any, margin: any }>>({});
    const [availableOptions, setAvailableOptions] = useState<Record<string, string[]>>(ALL_FEEDBACK_OPTIONS);
    const [isManuallyFinished, setIsManuallyFinished] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');

    // --- EFEITOS ---
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
                    setXp(data.xp || "0"); setCt(data.ct || "0"); setZs(data.zs || { total: 0, half: 0 });
                    setHistory(data.history || []); setInputs(data.inputs || inputs); setAnalysis(data.analysis || {});
                    setAvailableOptions(data.availableOptions || ALL_FEEDBACK_OPTIONS); setIsManuallyFinished(data.isManuallyFinished || false);
                } catch(e) { console.error("Erro ao ler storage", e); }
            }
        }
        initSession();
    }, [router, inputs]); // Adicionei inputs para garantir consistência inicial, mas cuidado com loops

    useEffect(() => {
        if (userId) {
            const userKey = `${BASE_STORAGE_KEY}_${userId}`;
            localStorage.setItem(userKey, JSON.stringify({ xp, ct, zs, history, inputs, analysis, availableOptions, isManuallyFinished }));
        }
    }, [xp, ct, zs, history, inputs, analysis, availableOptions, userId, isManuallyFinished]);

    const handleReset = () => { if (confirm("Reiniciar sessão? Isso apagará seu histórico de voltas atual.")) { if (userId) { localStorage.removeItem(`${BASE_STORAGE_KEY}_${userId}`); } window.location.reload(); }};
    const handleManualFinish = () => { if (history.length === 0) return alert("Processe pelo menos uma volta antes de finalizar."); if (confirm("Deseja encerrar a sessão agora e ver os valores calculados até o momento?")) { setIsManuallyFinished(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }};
    
    // Placeholder para a lógica de cálculo (mantendo a estrutura do seu projeto)
    const handleCalculate = async () => { 
        setLoading(true);
        // Simulando delay de cálculo
        await new Promise(r => setTimeout(r, 800));
        
        // --- LÓGICA SIMULADA PARA DEMONSTRAÇÃO (Substitua pela sua lógica real) ---
        const newEntry: any = {};
        let allOk = true;
        PARTS.forEach(part => {
            newEntry[part] = { acerto: inputs[part], msg: feedbacks[part] || "OK" };
            if((feedbacks[part] || "OK") !== "OK") allOk = false;
        });
        
        // Atualiza histórico
        const newHistory = [...history, newEntry];
        setHistory(newHistory);
        
        // Simplesmente limpa feedbacks para a próxima volta
        setFeedbacks({});
        
        // Se tudo OK, finaliza
        if(allOk) setIsManuallyFinished(true);
        
        setLoading(false);
    };

    const isFinished = history.length >= 8 || isManuallyFinished;
    
    if (!userId) return (
        <div className="flex h-screen items-center justify-center bg-[#050507] text-indigo-500 gap-4">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <span className="font-mono text-xs animate-pulse">CARREGANDO SESSÃO...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050507] text-slate-300 font-mono pb-24">
            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 md:space-y-8 animate-fadeIn">
                
                {/* Header Responsivo */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-2xl flex justify-between items-center backdrop-blur-xl relative z-40"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                         <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 shrink-0">
                            <Calculator size={20} className="text-indigo-400" />
                         </div>
                         <div className="min-w-0">
                            <h1 className="text-xs md:text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Telemetria</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate">Setup • {userEmail}</p>
                         </div>
                    </div>
                    <button 
                        onClick={handleReset} 
                        className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 p-2 md:px-4 md:py-2 rounded-lg border border-rose-500/20 transition-all group shrink-0"
                        title="Reiniciar Sessão"
                    >
                        <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                        <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Reiniciar</span>
                    </button>
                </motion.div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Coluna Lateral: Dados e Status */}
                    <div className="xl:col-span-3 space-y-4 md:space-y-6 order-2 xl:order-1">
                        {/* Card XP/CT - Grid 2 colunas no mobile */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="bg-white/5 p-3 md:p-4 border-b border-white/5 flex items-center gap-2">
                                <Cpu size={14} className="text-indigo-400" />
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Parâmetros</h3>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Experiência</label>
                                    <input 
                                        type="number" 
                                        value={xp} 
                                        onChange={e=>setXp(e.target.value)} 
                                        disabled={history.length > 0} 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50 text-sm md:text-base" 
                                        placeholder="XP"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5 ml-1">Conhec.</label>
                                    <input 
                                        type="number" 
                                        value={ct} 
                                        onChange={e=>setCt(e.target.value)} 
                                        disabled={history.length > 0} 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-black text-center focus:border-indigo-500 outline-none transition-all disabled:opacity-50 text-sm md:text-base" 
                                        placeholder="CT"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Card Análise - Escondido se vazio para economizar espaço no mobile */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="bg-white/5 p-3 md:p-4 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Target size={14} className="text-emerald-400" />
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Margens</h3>
                                </div>
                                {history.length > 0 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">V{history.length}</span>}
                            </div>
                            <div className="p-4 space-y-4">
                                {PARTS.map(part => {
                                    const data = analysis[part];
                                    return (
                                        <div key={part} className="space-y-1.5">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{part}</span>
                                                <span className="text-[10px] text-slate-400 font-bold">±{data?.margin || "?"}</span>
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
                    <div className="xl:col-span-9 space-y-6 order-1 xl:order-2">
                        {/* Card de Input / Resultado */}
                        <section className={`border rounded-2xl overflow-hidden transition-all duration-500 shadow-2xl ${isFinished ? 'border-emerald-500/50 bg-emerald-950/[0.1]' : 'border-indigo-500/30 bg-indigo-900/[0.05]'}`}>
                            <div className={`p-4 border-b flex justify-between items-center ${isFinished ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg shrink-0 ${isFinished ? 'bg-emerald-500 text-black' : 'bg-indigo-500 text-white'}`}>
                                        {isFinished ? <Trophy size={18} /> : <Timer size={18} />}
                                    </div>
                                    <div>
                                        <h2 className={`text-xs md:text-sm font-black uppercase tracking-widest ${isFinished ? 'text-emerald-400' : 'text-white'}`}>
                                            {isFinished ? "Setup Ideal" : `Ajuste da Volta ${history.length + 1}`}
                                        </h2>
                                        <p className="text-[10px] opacity-70 font-bold uppercase hidden sm:block">
                                            {isFinished ? "Valores calculados com sucesso" : "Insira os valores e selecione o feedback"}
                                        </p>
                                    </div>
                                </div>
                                {isFinished && <div className="px-3 py-1 bg-emerald-500 text-black text-[9px] md:text-[10px] font-black uppercase rounded shadow-lg animate-pulse">Concluído</div>}
                            </div>

                            <div className="p-4 md:p-6 lg:p-8">
                                {/* Grid de Inputs Refatorado para Mobile */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-8">
                                    {PARTS.map(part => {
                                        const displayValue = isFinished ? analysis[part]?.final : inputs[part];
                                        return (
                                            <div key={part} className="space-y-2 group">
                                                <div className="flex justify-between items-center">
                                                    <label className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isFinished ? 'text-emerald-500/70' : 'text-slate-400 group-hover:text-indigo-400'}`}>
                                                        {part}
                                                    </label>
                                                </div>
                                                
                                                {isFinished ? (
                                                    <div className="w-full bg-emerald-500/10 border border-emerald-500/50 text-center text-3xl font-black py-4 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                                        {displayValue}
                                                    </div>
                                                ) : (
                                                    <div className="bg-black/20 p-1.5 rounded-2xl border border-white/5 focus-within:border-indigo-500/50 focus-within:bg-black/40 transition-all space-y-2">
                                                        {/* Input Numérico */}
                                                        <input 
                                                            type="number" 
                                                            value={displayValue} 
                                                            onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} 
                                                            className="w-full bg-transparent text-center text-2xl font-black py-2 outline-none text-white placeholder-slate-700"
                                                        />
                                                        {/* Dropdown Customizado */}
                                                        <div className="relative w-full">
                                                            <select 
                                                                value={feedbacks[part] || ""} 
                                                                onChange={e=>setFeedbacks({...feedbacks,[part]:e.target.value})} 
                                                                className={`w-full bg-white/5 border-t border-white/10 text-[10px] font-bold py-3 pl-3 pr-8 rounded-xl outline-none appearance-none cursor-pointer hover:bg-white/10 transition-all ${feedbacks[part] ? (feedbacks[part] === "OK" ? "text-emerald-400" : "text-amber-200") : "text-slate-500"}`}
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
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {!isFinished && (
                                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 sticky bottom-2 z-10 sm:static">
                                        <motion.button 
                                            whileHover={{ scale: 1.01 }} 
                                            whileTap={{ scale: 0.98 }} 
                                            onClick={handleManualFinish} 
                                            className="flex-1 bg-slate-800/90 backdrop-blur hover:bg-slate-700 text-slate-300 py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs border border-white/5 flex items-center justify-center gap-2 transition-all shadow-lg"
                                        >
                                            <StopCircle size={16} />
                                            <span>Encerrar</span>
                                        </motion.button>
                                        
                                        <motion.button 
                                            whileHover={{ scale: 1.01 }} 
                                            whileTap={{ scale: 0.98 }} 
                                            onClick={handleCalculate} 
                                            disabled={loading} 
                                            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-xl shadow-indigo-600/20 border border-indigo-400/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            {loading ? (
                                                <><RefreshCw size={16} className="animate-spin" /> Processando...</>
                                            ) : (
                                                <>Calcular <span className="hidden sm:inline">Volta</span> <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                                            )}
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Timeline de Histórico */}
                        {history.length > 0 && (
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex items-center gap-3 px-2">
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
                                                transition={{ delay: idx * 0.05 }} 
                                                className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors group"
                                            >
                                                <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-indigo-400 font-black text-xs tracking-wider">VOLTA {lapNumber}</span>
                                                        {lapNumber === 1 && <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Início</span>}
                                                    </div>
                                                </div>
                                                
                                                {/* Grid de Histórico Responsivo: 2 col mobile, 3 tablet, 6 desktop */}
                                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-y-6 gap-x-4">
                                                    {PARTS.map(part => {
                                                        const lapData = lap[part]; 
                                                        const shortMsg = getShortFeedback(lapData.msg);
                                                        const prevLap = history[lapNumber - 2]; 
                                                        const delta = prevLap ? lapData.acerto - prevLap[part].acerto : 0;
                                                        const isOk = lapData.msg === "OK";
                                                        
                                                        return (
                                                            <div key={part} className="space-y-1 relative group/tooltip">
                                                                <div className="text-[8px] text-slate-600 uppercase font-black tracking-wider truncate border-b border-white/5 pb-1 mb-1">{part}</div>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-end gap-2">
                                                                        <span className={`text-sm md:text-base font-black leading-none ${isOk ? 'text-emerald-400' : 'text-white'}`}>{lapData.acerto}</span>
                                                                        {delta !== 0 && (
                                                                            <div className={`flex items-center text-[9px] font-bold leading-none mb-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                                {delta > 0 ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />} 
                                                                                {Math.abs(delta)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[8px] font-bold uppercase truncate ${getFeedbackColor(lapData.msg)}`}>
                                                                        {shortMsg}
                                                                    </span>
                                                                </div>
                                                                
                                                                {/* Tooltip melhorado para não sair da tela */}
                                                                <div className="absolute z-50 bottom-full left-0 mb-2 hidden group-hover/tooltip:block w-40 p-2 bg-[#0f0f12] border border-indigo-500/20 rounded shadow-xl pointer-events-none">
                                                                    <p className="text-[9px] leading-tight text-slate-300 italic">"{lapData.msg}"</p>
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}