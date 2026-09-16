'use client';
import Image from 'next/image';
import { User, ShieldCheck, Globe, Camera, Loader2 } from 'lucide-react';

type ManagerHeroProps = {
  manager: { firstName: string; lastName: string; group: string; champs: number; status: string; cash: number; credits: number; id: number | null };
  driver: { name: string; overall: number; nationality: string; nationalityName: string; racesLeft: string; energia: number; wins: number; podiums: number; races: number };
  decodedFirstName: string;
  decodedLastName: string;
  decodedDriverName: string;
  decodedNationalityName: string;
  avatarUrl: string | null;
  isUploading: boolean;
  onAvatarClick: () => void;
  getFlagUrl: (n: string) => string | null;
  formatCash: (n: number) => string;
};

export function ManagerHero({ manager, driver, decodedFirstName, decodedLastName, decodedDriverName, decodedNationalityName, avatarUrl, isUploading, onAvatarClick, getFlagUrl, formatCash }: ManagerHeroProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Gerente */}
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="bg-[#0a0f1f] p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 rounded-lg"><User size={14} className="text-white" /></div>
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Gerente</h2>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border text-emerald-300 bg-emerald-500/10 border-emerald-500/20">CONECTADO</span>
        </div>
        <div className="p-4 md:p-6 bg-transparent">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <button
              onClick={onAvatarClick}
              disabled={isUploading}
              aria-label="Alterar avatar do gerente"
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-700 border-2 border-white/10 hover:border-emerald-400/50 flex items-center justify-center text-2xl font-black text-emerald-300 overflow-hidden transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
            >
              {isUploading ? (
                <span className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" size={24} /></span>
              ) : (
                <span className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors" aria-hidden />
              )}
              {avatarUrl ? <img src={avatarUrl} alt={decodedFirstName} className="w-full h-full object-cover" /> : <span>{decodedFirstName.charAt(0)}{decodedLastName.charAt(0)}</span>}
            </button>
            <div className="flex-1 text-center md:text-left min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">{decodedFirstName} <span className="text-emerald-400">{decodedLastName}</span></h3>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 font-bold bg-white/[0.06] px-3 py-1 rounded-full border border-white/10 text-zinc-300 text-xs"><Globe size={13} className="text-emerald-400" />{manager.group}</span>
                <span className="text-zinc-600">•</span>
                <span className="font-bold text-amber-300 text-sm">{manager.champs || 0} 🏆</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${manager.status === 'Activated' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>{manager.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 w-full md:w-auto">
              <div className="bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider block">Saldo</span>
                <p className="text-sm font-black font-mono text-emerald-300 mt-0.5">${formatCash(manager.cash || 0)}</p>
              </div>
              <div className="bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider block">Créditos</span>
                <p className="text-sm font-black font-mono text-amber-300 mt-0.5">{manager.credits || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Piloto */}
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        <div className="bg-[#0a0f1f] p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="p-1.5 bg-emerald-600 rounded-lg"><ShieldCheck size={14} className="text-white" /></div><h2 className="text-[11px] font-black text-white uppercase tracking-widest">Piloto</h2></div>
          <span className="text-[11px] font-mono font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">OA {driver.overall}</span>
        </div>
        <div className="p-4 md:p-6 bg-transparent">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-3xl font-black text-white shadow-md relative">
                {decodedDriverName.charAt(0).toUpperCase() || '?'}
                {driver.nationality && getFlagUrl(driver.nationality) && (
                  <span className="absolute -bottom-1 -right-1 w-7 h-5 rounded-full border-2 border-[#0a0f1f] overflow-hidden shadow-sm">
                    <img src={getFlagUrl(driver.nationality)!} alt={driver.nationality} className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">{decodedDriverName}</h3>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                {driver.nationality && getFlagUrl(driver.nationality) ? (
                  <span className="inline-flex items-center gap-1.5 font-bold bg-white/[0.06] px-3 py-1 rounded-full border border-white/10 text-zinc-300 text-xs">
                    <img src={getFlagUrl(driver.nationality)!} alt={driver.nationality} className="w-4 h-3 object-cover rounded-sm" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />{decodedNationalityName || driver.nationality}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-bold bg-white/[0.06] px-3 py-1 rounded-full border border-white/10 text-zinc-300 text-xs"><Globe size={13} className="text-emerald-400" />{decodedNationalityName || driver.nationality || 'N/A'}</span>
                )}
                <span className="text-zinc-600">•</span><span className="font-bold text-zinc-300 text-sm">{driver.racesLeft} corridas</span><span className="text-zinc-600">•</span><span className={`font-bold text-sm ${driver.energia >= 80 ? 'text-emerald-400' : driver.energia >= 50 ? 'text-amber-300' : 'text-red-400'}`}>🔋 {driver.energia}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto">
              <div className="bg-white/[0.06] border border-white/10 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-zinc-400 font-black uppercase block">Vitórias</span><p className="text-sm font-black font-mono text-emerald-300">{driver.wins}</p></div>
              <div className="bg-white/[0.06] border border-white/10 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-zinc-400 font-black uppercase block">Pódios</span><p className="text-sm font-black font-mono text-amber-300">{driver.podiums}</p></div>
              <div className="bg-white/[0.06] border border-white/10 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-zinc-400 font-black uppercase block">Corridas</span><p className="text-sm font-black font-mono text-white">{driver.races}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
