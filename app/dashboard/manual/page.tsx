'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, History, ArrowRight, 
  Calculator, Trophy, Timer, Target, Cpu, TrendingUp, TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PARTS = ["Asa Dianteira", "Asa Traseira", "Motor", "Freios", "Câmbio", "Suspensão"];
const STORAGE_KEY = 'gpro_manual_setup_session';

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

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            setXp(data.xp || "0"); setCt(data.ct || "0"); setZs(data.zs || { total: 0, half: 0 });
            setHistory(data.history || []); setInputs(data.inputs || inputs);
            setAnalysis(data.analysis || {}); setAvailableOptions(data.availableOptions || ALL_FEEDBACK_OPTIONS);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ xp, ct, zs, history, inputs, analysis, availableOptions }));
    }, [xp, ct, zs, history, inputs, analysis, availableOptions]);

    const handleCalculate = async () => {
        if (!xp || !ct || xp === "0") return alert("Insira XP e CT.");
        setLoading(true);
        const payload = { driver: { xp, ct }, history, currentLapData: PARTS.reduce((acc: any, part) => { acc[part] = { acerto: inputs[part], msg: feedbacks[part] || "OK" }; return acc; }, {}) };
        try {
            const res = await fetch('/api/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const json = await res.json();
            if (json.sucesso) {
                setZs(json.data.zs);
                setHistory([...history, json.data.processedLap]);
                setInputs(json.data.nextSuggestions);
                setAnalysis(json.data.finalAnalysis);
                if (json.data.allowedOptions) setAvailableOptions(json.data.allowedOptions);
                setFeedbacks({});
            }
        } catch (e) { alert("Erro de rede."); } finally { setLoading(false); }
    };

    const isFinished = history.length >= 8;

    return (
        <div className="min-h-screen bg-[#050506] text-slate-400 font-mono text-xs">
            <header className="border-b border-white/5 bg-[#08080a] px-6 py-3 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4 text-white uppercase font-black tracking-tighter">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]" />
                    <span>TELEMETRIA GPRO</span>
                </div>
                <button onClick={() => {if(confirm("Reiniciar?")) {localStorage.removeItem(STORAGE_KEY); window.location.reload();}}} className="text-[10px] hover:text-rose-500 transition-colors uppercase font-bold">[ REINICIAR_SESSÃO ]</button>
            </header>

            <main className="max-w-[1440px] mx-auto p-6 grid grid-cols-12 gap-6">
                
                {/* Coluna Lateral: Resultados Estimados */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <section className="bg-[#0a0a0c] border border-white/5 p-5 rounded-lg">
                        <div className="text-[10px] text-slate-500 mb-4 flex items-center gap-2 border-b border-white/5 pb-2 uppercase font-bold tracking-widest">
                            <Cpu size={12} /> Habilidades do Piloto
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[8px] mb-1 text-slate-600">XP</label><input type="number" value={xp} onChange={e=>setXp(e.target.value)} disabled={history.length > 0} className="w-full bg-black border border-white/10 p-2 text-white outline-none" /></div>
                            <div><label className="block text-[8px] mb-1 text-slate-600">CT</label><input type="number" value={ct} onChange={e=>setCt(e.target.value)} disabled={history.length > 0} className="w-full bg-black border border-white/10 p-2 text-white outline-none" /></div>
                        </div>
                    </section>

                    <section className="bg-[#0a0a0c] border border-white/5 p-5 rounded-lg">
                        <div className="text-[10px] text-slate-500 mb-6 flex items-center gap-2 border-b border-white/5 pb-2 uppercase font-bold tracking-widest">
                            <Target size={12} /> Ajuste_Ideal_Estimado
                        </div>
                        <div className="space-y-6">
                            {PARTS.map(part => {
                                const data = analysis[part];
                                return (
                                    <div key={part}>
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-slate-500 text-[9px]">{part.toUpperCase()}</span>
                                            <span className="text-indigo-400 font-bold text-sm leading-none">{data?.final || "---"}</span>
                                        </div>
                                        <div className="h-1 bg-white/5 w-full mb-1">
                                            <motion.div animate={{width: data ? `${(Number(data.final)/1000)*100}%` : 0}} className="h-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]" />
                                        </div>
                                        <div className="flex justify-between text-[8px] uppercase tracking-tighter">
                                            <span className="text-slate-700 font-bold">Margem Estimada</span>
                                            <span className="text-slate-500">± {data?.margin || "0"}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {history.length > 0 && (
                            <div className="mt-8 pt-4 border-t border-white/5 text-[8px] text-slate-600 leading-relaxed uppercase">
                                * Valores baseados na telemetria processada até a volta {history.length}. Podem ser usados para Qualificação 1 se o treino for encerrado.
                            </div>
                        )}
                    </section>
                </div>

                {/* Área Principal */}
                <div className="col-span-12 lg:col-span-9 space-y-6">
                    <section className={`border p-8 rounded-xl ${isFinished ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-white/5 bg-[#0a0a0c]'}`}>
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-white text-xl font-black uppercase tracking-tighter">{isFinished ? "CONFIGURAÇÃO FINAL" : `AJUSTE DA VOLTA ${history.length + 1}`}</h2>
                            {!isFinished && (
                                <button onClick={handleCalculate} disabled={loading} className="bg-white text-black px-6 py-3 font-black uppercase text-[10px] hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-3 shadow-2xl shadow-indigo-500/10">
                                    {loading ? "PROCESSANDO..." : "CALCULAR PRÓXIMA VOLTA"} <ArrowRight size={14} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            {PARTS.map(part => (
                                <div key={part} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded">
                                        <span className="text-slate-500 font-bold text-[10px]">{part.toUpperCase()}</span>
                                        {isFinished ? (
                                            <span className="text-emerald-400 font-black text-lg">{analysis[part]?.final}</span>
                                        ) : (
                                            <input type="number" value={inputs[part]} onChange={e=>setInputs({...inputs,[part]:Number(e.target.value)})} className="bg-transparent text-right text-white font-black text-lg w-20 outline-none focus:text-indigo-400" />
                                        )}
                                    </div>
                                    {!isFinished && (
                                        <select 
                                            value={feedbacks[part] || ""} 
                                            onChange={e=>setFeedbacks({...feedbacks,[part]:e.target.value})}
                                            className="bg-black border border-white/10 p-2 text-[10px] text-slate-400 outline-none focus:border-indigo-500/50 appearance-none"
                                        >
                                            <option value="">SELECIONE O FEEDBACK...</option>
                                            {(availableOptions[part] || ALL_FEEDBACK_OPTIONS[part]).map((opt, i) => (
                                                <option 
                                                    key={i} 
                                                    value={opt}
                                                    className={opt === "OK" ? "text-emerald-500 font-bold bg-slate-900" : "text-white bg-slate-900"}
                                                >
                                                    {opt === "OK" ? "✅ OK (SATISFATÓRIO)" : opt.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Timeline com Deltas e Tooltips */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 text-slate-600">
                            <History size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Log_Histórico_Telemetria</span>
                            <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {[...history].reverse().map((lap, idx) => {
                                const lapNumber = history.length - idx;
                                return (
                                    <motion.div key={idx} initial={{opacity:0}} animate={{opacity:1}} className="bg-[#0a0a0c] border border-white/5 rounded overflow-hidden group/lap">
                                        <div className="bg-white/5 px-4 py-2 flex justify-between items-center border-b border-white/5">
                                            <span className="text-indigo-400 font-bold text-[10px]">VOLTA_{lapNumber}</span>
                                            <Timer size={12} className="text-slate-600" />
                                        </div>
                                        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-4">
                                            {PARTS.map(part => {
                                                const lapData = lap[part];
                                                const shortMsg = getShortFeedback(lapData.msg);
                                                
                                                // Lógica do Delta
                                                const prevLap = history[lapNumber - 2];
                                                const delta = prevLap ? lapData.acerto - prevLap[part].acerto : 0;

                                                return (
                                                    <div key={part} className="space-y-1 relative group/item">
                                                        <div className="text-[9px] text-slate-600 uppercase font-bold">{part}</div>
                                                        <div className="flex items-center gap-2 cursor-help">
                                                            {/* Delta Indicator */}
                                                            {delta !== 0 && (
                                                                <div className={`flex items-center text-[9px] font-bold ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    {delta > 0 ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
                                                                    {Math.abs(delta)}
                                                                </div>
                                                            )}
                                                            <span className="text-white font-black text-sm">{lapData.acerto}</span>
                                                            <span className={`text-[8px] font-bold uppercase truncate max-w-[60px] ${getFeedbackColor(lapData.msg)}`}>
                                                                {shortMsg}
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Tooltip Popup */}
                                                        <div className="absolute z-50 bottom-full left-0 mb-2 hidden group-hover/item:block w-48 p-3 bg-slate-900 border border-indigo-500/20 rounded shadow-2xl">
                                                            <p className="text-[9px] leading-tight text-white font-sans normal-case italic">
                                                                "{lapData.msg}"
                                                            </p>
                                                            <div className="absolute top-full left-4 w-2 h-2 bg-slate-900 border-r border-b border-indigo-500/20 rotate-45 -translate-y-1"></div>
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
            </main>
        </div>
    );
}