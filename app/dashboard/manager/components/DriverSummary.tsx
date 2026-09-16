'use client';
import { Target } from 'lucide-react';
export function DriverSummary({ driver }: { driver: { talento: number; concentracao: number; experiencia: number; energia: number } }) {
  return (
    <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
      <div className="bg-[#0a0f1f] p-3 border-b border-white/10 flex items-center gap-2"><Target size={14} className="text-emerald-400" /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Resumo Piloto</h4></div>
      <div className="p-3 bg-transparent grid grid-cols-2 gap-1.5">
        <div className="bg-white/[0.06] rounded-lg p-1.5 text-center border border-white/5"><span className="text-[10px] text-zinc-400 font-black uppercase block">Talento</span><p className="text-sm font-black font-mono text-white">{driver.talento}</p></div>
        <div className="bg-white/[0.06] rounded-lg p-1.5 text-center border border-white/5"><span className="text-[10px] text-zinc-400 font-black uppercase block">Concentração</span><p className="text-sm font-black font-mono text-white">{driver.concentracao}</p></div>
        <div className="bg-white/[0.06] rounded-lg p-1.5 text-center border border-white/5"><span className="text-[10px] text-zinc-400 font-black uppercase block">Experiência</span><p className="text-sm font-black font-mono text-white">{driver.experiencia}</p></div>
        <div className="bg-white/[0.06] rounded-lg p-1.5 text-center border border-white/5"><span className="text-[10px] text-zinc-400 font-black uppercase block">Energia</span><p className={`text-sm font-black font-mono ${driver.energia>=80?'text-emerald-300':driver.energia>=50?'text-amber-300':'text-red-400'}`}>{driver.energia}%</p></div>
      </div>
    </div>
  );
}
