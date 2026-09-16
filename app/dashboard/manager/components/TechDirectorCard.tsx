'use client';
import { Briefcase } from 'lucide-react';
type TD = { name?: string; overall?: string; racesLeft?: string; rdMecanico?: number; rdEletronico?: number; rdAerodinamico?: number };
export function TechDirectorCard({ techDirector }: { techDirector: TD }) {
  return (
    <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
      <div className="bg-[#0a0f1f] p-3 border-b border-white/10 flex items-center gap-2"><Briefcase size={14} className="text-cyan-400" /><h4 className="text-[11px] font-black text-white uppercase tracking-widest">Diretor Técnico</h4></div>
      <div className="p-3 bg-transparent">
        <p className="text-sm font-black text-white truncate">{techDirector?.name || 'Nenhum'}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400"><span className="bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 font-black font-mono">OA {techDirector?.overall || '0'}</span><span>•</span><span>{techDirector?.racesLeft || '0'} corridas</span></div>
        <div className="flex gap-3 mt-1.5 text-xs font-mono text-zinc-400"><span>🔧 {techDirector?.rdMecanico||0}</span><span>⚡ {techDirector?.rdEletronico||0}</span><span>🌀 {techDirector?.rdAerodinamico||0}</span></div>
      </div>
    </div>
  );
}
