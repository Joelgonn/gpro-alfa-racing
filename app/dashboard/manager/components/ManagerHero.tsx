'use client';
import { User, ShieldCheck, Globe, Loader2 } from 'lucide-react';

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
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-white p-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 rounded-lg"><User size={14} className="text-white" /></div>
            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Gerente</h2>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">CONECTADO</span>
        </div>
        <div className="p-4 md:p-6 bg-white">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <button
              onClick={onAvatarClick}
              disabled={isUploading}
              aria-label="Alterar avatar do gerente"
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-200 hover:border-emerald-300 flex items-center justify-center text-2xl font-black text-emerald-600 overflow-hidden transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
            >
              {isUploading ? (
                <span className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={24} /></span>
              ) : null}
              {avatarUrl ? <img src={avatarUrl} alt={decodedFirstName} className="w-full h-full object-cover" /> : <span>{decodedFirstName.charAt(0)}{decodedLastName.charAt(0)}</span>}
            </button>
            <div className="flex-1 text-center md:text-left min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{decodedFirstName} <span className="text-emerald-600">{decodedLastName}</span></h3>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200 text-slate-700 text-xs"><Globe size={13} className="text-emerald-500" />{manager.group}</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-amber-600 text-sm">{manager.champs || 0} 🏆</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${manager.status === 'Activated' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{manager.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 w-full md:w-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Saldo</span>
                <p className="text-sm font-black font-mono text-emerald-600 mt-0.5">${formatCash(manager.cash || 0)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Créditos</span>
                <p className="text-sm font-black font-mono text-amber-600 mt-0.5">{manager.credits || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Piloto */}
      <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-white p-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="p-1.5 bg-emerald-600 rounded-lg"><ShieldCheck size={14} className="text-white" /></div><h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Piloto</h2></div>
          <span className="text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">OA {driver.overall}</span>
        </div>
        <div className="p-4 md:p-6 bg-white">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-3xl font-black text-white shadow-sm relative">
                {decodedDriverName.charAt(0).toUpperCase() || '?'}
                {driver.nationality && getFlagUrl(driver.nationality) && (
                  <span className="absolute -bottom-1 -right-1 w-7 h-5 rounded-full border-2 border-white overflow-hidden shadow-sm">
                    <img src={getFlagUrl(driver.nationality)!} alt={driver.nationality} className="w-full h-full object-cover" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{decodedDriverName}</h3>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                {driver.nationality && getFlagUrl(driver.nationality) ? (
                  <span className="inline-flex items-center gap-1.5 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200 text-slate-700 text-xs">
                    <img src={getFlagUrl(driver.nationality)!} alt={driver.nationality} className="w-4 h-3 object-cover rounded-sm" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />{decodedNationalityName || driver.nationality}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200 text-slate-700 text-xs"><Globe size={13} className="text-emerald-500" />{decodedNationalityName || driver.nationality || 'N/A'}</span>
                )}
                <span className="text-slate-300">•</span><span className="font-bold text-slate-600 text-sm">{driver.racesLeft} corridas</span><span className="text-slate-300">•</span><span className={`font-bold text-sm ${driver.energia >= 80 ? 'text-emerald-600' : driver.energia >= 50 ? 'text-amber-600' : 'text-red-500'}`}>🔋 {driver.energia}%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-full md:w-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-slate-500 font-black uppercase block">Vitórias</span><p className="text-sm font-black font-mono text-emerald-600">{driver.wins}</p></div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-slate-500 font-black uppercase block">Pódios</span><p className="text-sm font-black font-mono text-amber-600">{driver.podiums}</p></div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-center"><span className="text-[10px] text-slate-500 font-black uppercase block">Corridas</span><p className="text-sm font-black font-mono text-slate-900">{driver.races}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
